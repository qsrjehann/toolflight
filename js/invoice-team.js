/* ToolFlight Invoice & Business Manager -- Team Members (Phase 6)
   ==========================================================================
   Isolated on purpose, same as the other invoice-*.js files.

   ARCHITECTURE NOTE -- why invites are a separate collection, not a
   direct businessMembers write: Firebase Web SDK client code cannot look
   up another user's UID from their email address (that requires the
   Admin SDK / a backend, explicitly out of scope -- "do not create a
   custom backend"). So inviting someone by email can only create a
   PENDING record keyed by email, not a real businessMembers/{uid}
   document. When the invited person actually signs in, this file checks
   for any pending invite matching their authenticated email and converts
   it into a real membership at that point -- the only moment a real UID
   is known for that email. This is documented in more detail in
   INVOICE_ARCHITECTURE.md.

   HONESTY NOTE: same as every other Phase 2+ file -- tested for the
   UI/validation/rendering layer and the exact Firestore calls this code
   issues, not against a real Firestore backend, since none exists and
   this sandbox blocks the Firebase CDN outright. See the Phase 6 report
   for exactly what could and could not be verified. */

import { onAuthChange, getDb } from "./invoice-auth.js?v=20260801-1905";
import { emailjsConfig, isEmailjsConfigured } from "./emailjs-config.js?v=20260801-1905";

let currentUser = null;
let members = [];
let invites = [];
let firestoreFns = null;

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setError(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }
function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str == null ? "" : String(str); return d.innerHTML; }

async function loadFirestoreFns() {
  if (firestoreFns) return firestoreFns;
  firestoreFns = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
  return firestoreFns;
}

/* ==================================================================
   Role presets. These set the SAME underlying permission fields
   firestore.rules and the rest of the app already check
   (permissions.customers.view, .create, .edit, .delete, etc.) -- no
   change to that schema. "Manage Customers"/"Manage Products" in the
   UI are a simpler label over create+edit+delete together, not a new
   field, so nothing else in the app needs to know about them.
   ================================================================== */

const ROLE_PRESETS = {
  manager: {
    customers: { view: true, create: true, edit: true, delete: true },
    products:  { view: true, create: true, edit: true, delete: true },
    invoices:  { view: true, create: true, edit: true, delete: false }, // no delete -- "no destructive admin controls"
    inventory: { view: true, adjust: true },
    settings:  { view: true, edit: false },
    team:      { manage: false },
  },
  staff: {
    customers: { view: true, create: true, edit: true, delete: false },
    products:  { view: true, create: false, edit: false, delete: false },
    invoices:  { view: true, create: true, edit: false, delete: false },
    inventory: { view: true, adjust: false },
    settings:  { view: false, edit: false },
    team:      { manage: false },
  },
  viewer: {
    customers: { view: true, create: false, edit: false, delete: false },
    products:  { view: true, create: false, edit: false, delete: false },
    invoices:  { view: true, create: false, edit: false, delete: false },
    inventory: { view: true, adjust: false },
    settings:  { view: true, edit: false },
    team:      { manage: false },
  },
};

// Maps each "Customize permissions" checkbox to the real schema fields it
// sets. "customers.manage"/"products.manage" fan out to three flags at
// once (the simpler UI label); everything else is a direct 1:1 field,
// matching how the spec lists invoice/inventory/settings/team permissions
// individually rather than as a single "manage" toggle.
const CUSTOM_PERM_MAP = {
  "customers.view":   [["customers", "view"]],
  "customers.manage": [["customers", "create"], ["customers", "edit"], ["customers", "delete"]],
  "products.view":    [["products", "view"]],
  "products.manage":  [["products", "create"], ["products", "edit"], ["products", "delete"]],
  "invoices.create":  [["invoices", "create"]],
  "invoices.edit":    [["invoices", "edit"]],
  "invoices.delete":  [["invoices", "delete"]],
  "inventory.view":   [["inventory", "view"]],
  "inventory.adjust": [["inventory", "adjust"]],
  "settings.view":    [["settings", "view"]],
  "settings.edit":    [["settings", "edit"]],
  "team.manage":      [["team", "manage"]],
};

function emptyPermissions() {
  return {
    customers: { view: false, create: false, edit: false, delete: false },
    products:  { view: false, create: false, edit: false, delete: false },
    invoices:  { view: false, create: false, edit: false, delete: false },
    inventory: { view: false, adjust: false },
    settings:  { view: false, edit: false },
    team:      { manage: false },
  };
}

function readCustomPermissions() {
  const perms = emptyPermissions();
  document.querySelectorAll('#invTeamCustomPerms input[data-perm]').forEach(cb => {
    const mapping = CUSTOM_PERM_MAP[cb.dataset.perm];
    if (!mapping) return;
    for (const [resource, action] of mapping) {
      if (cb.checked) perms[resource][action] = true;
    }
  });
  return perms;
}

/* ==================================================================
   Invite creation
   ================================================================== */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ==================================================================
   Invitation email (EmailJS) -- sent after the Firestore invite
   document is already created. This is a best-effort notification,
   not a requirement for the invite itself to work: the invite exists
   and is fully functional (shows in Pending Invites, can be accepted
   by signing in with a matching email) whether or not this email
   actually sends. See js/emailjs-config.js for setup instructions.
   ================================================================== */

let emailjsInitialized = false;
function ensureEmailjsInit() {
  if (emailjsInitialized || typeof emailjs === "undefined") return;
  emailjs.init({ publicKey: emailjsConfig.publicKey });
  emailjsInitialized = true;
}

async function sendInvitationEmail(email, roleLabel) {
  if (!isEmailjsConfigured()) {
    console.warn("[invoice-team] EmailJS not configured yet -- invite was saved, but no notification email was sent. See js/emailjs-config.js.");
    return;
  }
  if (typeof emailjs === "undefined") {
    console.error("[invoice-team] EmailJS SDK failed to load -- invite was saved, but no notification email was sent.");
    return;
  }
  ensureEmailjsInit();
  const profile = window.toolflightInvoiceBusiness.getBusinessProfile();
  const templateParams = {
    to_email: email,
    business_name: (profile && profile.name) || "a ToolFlight business",
    inviter_email: currentUser ? currentUser.email : "",
    role: roleLabel,
    invoice_maker_url: window.location.origin + window.location.pathname,
  };
  try {
    await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, templateParams);
  } catch (err) {
    // Genuinely non-blocking: the invite itself already succeeded and
    // is fully usable. A failed notification email is a real limitation
    // worth logging, but not a reason to tell the user the invite failed.
    console.error("[invoice-team] sending invitation email failed:", err);
  }
}

async function handleSendInvite() {
  const btn = $("invTeamModalSaveBtn");
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();
  const email = $("invTeamEmail").value.trim().toLowerCase();
  const roleSelect = $("invTeamRole").value;
  setError("invTeamModalError", "");

  if (!isValidEmail(email)) { setError("invTeamModalError", "Enter a valid email address."); return; }
  if (!businessId) { setError("invTeamModalError", "Set up your business first."); return; }
  if (!getDb()) { setError("invTeamModalError", "Account features aren't fully set up yet."); return; }

  const permissions = roleSelect === "custom" ? readCustomPermissions() : ROLE_PRESETS[roleSelect];
  // The "role" stored on the invite is descriptive (used for display and
  // as a starting point if it's later changed) -- actual access is always
  // governed by the permissions map itself, matching how hasPermission()
  // in firestore.rules checks permissions directly, not the role label.
  const roleLabel = roleSelect === "custom" ? "custom" : roleSelect;

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Sending…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    // Invites are keyed by email (not an auto-ID) so firestore.rules can
    // get() the exact matching invite directly when a businessMembers
    // document is being created -- rules cannot run a query, only read a
    // known path, so this is what makes the invited user's own
    // acceptance write verifiable without weakening the create rule.
    // This also makes "duplicate pending invite for the same email"
    // structurally impossible to create by accident: the second attempt
    // would just overwrite the first at the same path, which is what the
    // explicit pending-check below still guards against with a clearer
    // message rather than a silent overwrite.
    const inviteRef = fns.doc(db, "businesses", businessId, "invites", email);
    const existingSnap = await fns.getDoc(inviteRef);
    if (existingSnap.exists() && existingSnap.data().status === "pending") {
      setError("invTeamModalError", "An invite is already pending for that email.");
      return;
    }

    const now = Date.now();
    const businessProfile = window.toolflightInvoiceBusiness.getBusinessProfile();
    await fns.setDoc(inviteRef, {
      email, role: roleLabel, permissions, status: "pending",
      businessName: (businessProfile && businessProfile.name) || "this business",
      invitedByUid: currentUser ? currentUser.uid : null,
      invitedByEmail: currentUser ? currentUser.email : null,
      createdAt: fns.serverTimestamp(),
      expiresAtMs: now + 7 * 24 * 60 * 60 * 1000, // 7 days -- plain number, not a Timestamp, so rules can compare it directly against request.time.toMillis()
    });
    $("invTeamModal").classList.remove("show");
    if (typeof toast === "function") toast("Invite sent.", "ok");
    sendInvitationEmail(email, roleLabel); // best-effort, deliberately not awaited into this function's own error handling
    await refreshTeam(businessId);
  } catch (err) {
    console.error("[invoice-team] send invite failed:", err);
    setError("invTeamModalError", "Could not send the invite right now. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

/* ==================================================================
   List / render
   ================================================================== */

async function loadMembers(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "businessMembers"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

async function loadInvites(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "invites"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function permissionSummary(permissions) {
  if (!permissions) return "";
  const parts = [];
  if (permissions.team && permissions.team.manage) parts.push("Manage Team");
  if (permissions.settings && permissions.settings.edit) parts.push("Edit Settings");
  if (permissions.invoices && permissions.invoices.delete) parts.push("Delete Invoices");
  if (permissions.inventory && permissions.inventory.adjust) parts.push("Adjust Inventory");
  if (parts.length === 0) {
    const anyEdit = ["customers", "products"].some(r => permissions[r] && (permissions[r].create || permissions[r].edit));
    parts.push(anyEdit ? "Standard access" : "View only");
  }
  return parts.join(", ");
}

function renderTeamList() {
  const list = $("invTeamList");
  const rows = [];

  members.slice().sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0)).forEach(m => {
    const isOwner = m.role === "owner";
    const isSelf = currentUser && m.uid === currentUser.uid;
    rows.push(`
      <div class="inv-record-row" data-uid="${m.uid}">
        <div class="inv-record-main">
          <div class="inv-record-name">${escapeHtml(m.email || m.uid)}${isSelf ? " (you)" : ""}</div>
          <div class="inv-record-sub">${isOwner ? "Owner" : escapeHtml(m.role || "custom")} · Active · ${escapeHtml(permissionSummary(m.permissions))}</div>
        </div>
        <div class="inv-record-actions">
          ${(!isOwner && !isSelf) ? `<button type="button" class="btn btn-ghost inv-team-remove" data-uid="${m.uid}">Remove</button>` : ""}
        </div>
      </div>
    `);
  });

  invites.filter(i => i.status === "pending").forEach(i => {
    rows.push(`
      <div class="inv-record-row" data-invite-id="${i.id}">
        <div class="inv-record-main">
          <div class="inv-record-name">${escapeHtml(i.email)}</div>
          <div class="inv-record-sub">${escapeHtml(i.role)} · Pending invite</div>
        </div>
        <div class="inv-record-actions">
          <button type="button" class="btn btn-ghost inv-team-revoke" data-invite-id="${i.id}">Revoke</button>
        </div>
      </div>
    `);
  });

  list.innerHTML = rows.length ? rows.join("") : `<p class="editor-hint">No team members yet.</p>`;
}

async function refreshTeam(businessId) {
  if (!businessId) return;
  try {
    [members, invites] = await Promise.all([loadMembers(businessId), loadInvites(businessId)]);
    renderTeamList();
  } catch (err) {
    console.error("[invoice-team] load team failed:", err);
    setError("invTeamError", "Could not load the team right now.");
  }
}

/* ==================================================================
   Remove member / revoke invite
   ================================================================== */

async function handleRemoveMember(uid) {
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();
  if (!businessId) return;
  if (!confirm("Remove this person from the business? They'll immediately lose access.")) return;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.deleteDoc(fns.doc(db, "businesses", businessId, "businessMembers", uid));
    await refreshTeam(businessId);
  } catch (err) {
    console.error("[invoice-team] remove member failed:", err);
    setError("invTeamError", "Could not remove that person right now.");
  }
}

async function handleRevokeInvite(inviteId) {
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();
  if (!businessId) return;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.updateDoc(fns.doc(db, "businesses", businessId, "invites", inviteId), { status: "revoked" });
    await refreshTeam(businessId);
  } catch (err) {
    console.error("[invoice-team] revoke invite failed:", err);
    setError("invTeamError", "Could not revoke that invite right now.");
  }
}

/* ==================================================================
   Invite acceptance at sign-in -- the only point a real UID is known
   for a given email. Runs once per sign-in; harmless if there's
   nothing pending. Only acts when the signed-in user doesn't already
   have a business, matching Phase 3's "one business per user for now"
   UI (the data model supports more later, per INVOICE_ARCHITECTURE.md).
   ================================================================== */

let pendingInvitesForCurrentUser = [];

/* Detects pending invites for the signed-in user -- READ ONLY, never
   writes anything. Runs on every sign-in via onAuthChange below. If any
   are found, shows an explicit, impossible-to-miss screen naming the
   business and role -- replacing the old fully-silent auto-accept,
   which gave the invited person no indication anything had happened
   beyond a small toast, and which they could easily never see at all
   if they weren't looking at the screen at that exact moment. */
async function detectPendingInvitesForUser(user) {
  if (!user || !user.email) return;
  const db = getDb();
  if (!db) return;
  try {
    const fns = await loadFirestoreFns();
    const q = fns.query(fns.collectionGroup(db, "invites"), fns.where("email", "==", user.email.toLowerCase()), fns.where("status", "==", "pending"));
    const snap = await fns.getDocs(q);
    pendingInvitesForCurrentUser = snap.docs
      .map(d => ({ id: d.id, businessId: d.ref.parent.parent.id, ...d.data() }))
      .filter(inv => !inv.expiresAtMs || inv.expiresAtMs > Date.now());
    if (pendingInvitesForCurrentUser.length > 0) {
      renderInviteAcceptScreen();
    }
  } catch (err) {
    console.error("[invoice-team] checking for pending invites failed:", err);
  }
}

function renderInviteAcceptScreen() {
  const invite = pendingInvitesForCurrentUser[0]; // one at a time -- if more than one exists, the next shows after this one is resolved
  $("invAcceptBusinessName").textContent = invite.businessName || "a business";
  $("invAcceptRole").textContent = invite.role;
  $("invAcceptInviterEmail").textContent = invite.invitedByEmail || "";
  setError("invAcceptError", "");
  $("invAcceptScreen").classList.remove("hidden");
  hide("invModeSelect"); hide("invGuestBuilder"); hide("invBusinessArea"); hide("invSetupPrompt");
}

async function handleAcceptInvite() {
  const btn = $("invAcceptBtn");
  const invite = pendingInvitesForCurrentUser[0];
  if (!invite || !currentUser) return;
  setError("invAcceptError", "");
  btn.disabled = true; btn.textContent = "Joining…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const inviteRef = fns.doc(db, "businesses", invite.businessId, "invites", invite.id);
    const memberRef = fns.doc(db, "businesses", invite.businessId, "businessMembers", currentUser.uid);
    const batch = fns.writeBatch(db);
    batch.set(memberRef, { uid: currentUser.uid, role: invite.role, permissions: invite.permissions, email: currentUser.email, joinedAt: fns.serverTimestamp() });
    batch.update(inviteRef, { status: "accepted" });
    await batch.commit();

    pendingInvitesForCurrentUser.shift();
    $("invAcceptScreen").classList.add("hidden");
    if (typeof toast === "function") toast("You've joined " + (invite.businessName || "the business") + ".", "ok");

    if (pendingInvitesForCurrentUser.length > 0) {
      renderInviteAcceptScreen(); // another pending invite exists -- show it next
    } else if (window.toolflightInvoiceBusiness && typeof window.toolflightInvoiceBusiness.refreshAfterJoiningBusiness === "function") {
      await window.toolflightInvoiceBusiness.refreshAfterJoiningBusiness(invite.businessId);
    }
  } catch (err) {
    // The exact failure reason is shown directly in the UI, not just
    // logged -- if this fails in a real deployment, this text is what
    // actually tells you why, instead of requiring DevTools to see it.
    console.error("[invoice-team] accepting invite failed:", err);
    setError("invAcceptError", "Couldn't join: " + (err && err.message ? err.message : "unknown error") + ". Please try again, or ask the business owner to resend the invite.");
  } finally {
    btn.disabled = false; btn.textContent = "Accept Invitation";
  }
}

function handleDeclineInvite() {
  const invite = pendingInvitesForCurrentUser.shift();
  $("invAcceptScreen").classList.add("hidden");
  if (pendingInvitesForCurrentUser.length > 0) {
    renderInviteAcceptScreen();
  } else {
    show("invModeSelect");
  }
}

/* ==================================================================
   Wiring
   ================================================================== */

function openInviteModal() {
  $("invTeamModalTitle").textContent = "Invite Team Member";
  $("invTeamEmail").value = "";
  $("invTeamRole").value = "manager";
  document.querySelectorAll('#invTeamCustomPerms input[data-perm]').forEach(cb => cb.checked = false);
  setError("invTeamModalError", "");
  $("invTeamModal").classList.add("show");
}

function initTeamUI() {
  $("invInviteMemberBtn").addEventListener("click", openInviteModal);
  $("invTeamModalSaveBtn").addEventListener("click", handleSendInvite);
  $("invTeamRole").addEventListener("change", (e) => {
    if (e.target.value === "custom") $("invTeamCustomPerms").open = true;
  });

  $("invTeamList").addEventListener("click", (e) => {
    if (e.target.classList.contains("inv-team-remove")) handleRemoveMember(e.target.dataset.uid);
    else if (e.target.classList.contains("inv-team-revoke")) handleRevokeInvite(e.target.dataset.inviteId);
  });

  const teamTabBtn = document.querySelector('.inv-business-tab[data-tab="team"]');
  if (teamTabBtn) teamTabBtn.addEventListener("click", () => refreshTeam(window.toolflightInvoiceBusiness.getBusinessId()));

  $("invAcceptBtn").addEventListener("click", handleAcceptInvite);
  $("invDeclineBtn").addEventListener("click", handleDeclineInvite);

  onAuthChange((user) => {
    currentUser = user;
    if (user) detectPendingInvitesForUser(user);
    else { members = []; invites = []; pendingInvitesForCurrentUser = []; }
  });
}

if (document.getElementById("invTeamList")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTeamUI);
  } else {
    initTeamUI();
  }
}
