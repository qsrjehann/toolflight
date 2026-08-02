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

import { onAuthChange, getDb } from "./invoice-auth.js?v=20260802-0530";
import { emailjsConfig, isEmailjsConfigured } from "./emailjs-config.js?v=20260802-0530";

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

async function sendInvitationEmail(email, roleLabel, businessId) {
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
    invoice_maker_url: window.location.origin + window.location.pathname + "?invite=" + encodeURIComponent(email) + "&biz=" + encodeURIComponent(businessId),
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
    sendInvitationEmail(email, roleLabel, businessId); // best-effort, deliberately not awaited into this function's own error handling
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

// Parsed once, at module load, directly from the URL -- this is what
// makes the invitation survive Login/Signup: opening the auth modal to
// sign in or create an account never touches window.location, so this
// value is still here after the person finishes authenticating, exactly
// as it was when they first clicked the email link.
const urlParams = new URLSearchParams(window.location.search);
const linkedInvite = urlParams.has("invite") && urlParams.has("biz")
  ? { inviteId: urlParams.get("invite"), businessId: urlParams.get("biz") }
  : null;

function showInvalidInviteScreen(title, message) {
  $("invInvalidInviteTitle").textContent = title;
  $("invInvalidInviteMessage").textContent = message;
  hide("invModeSelect"); hide("invGuestBuilder"); hide("invBusinessArea"); hide("invSetupPrompt"); hide("invAcceptScreen");
  show("invInvalidInviteScreen");
}

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

    if (linkedInvite) {
      // A specific invite was identified by the link itself -- look it
      // up directly by path (a single-document read, not a query), and
      // give a precise, honest reason if it can't be used.
      const inviteRef = fns.doc(db, "businesses", linkedInvite.businessId, "invites", linkedInvite.inviteId);
      let snap;
      try {
        snap = await fns.getDoc(inviteRef);
      } catch (err) {
        console.error("[invoice-team] looking up linked invite failed:", err);
        showInvalidInviteScreen("Couldn't Check Invitation", "Error: " + (err && err.message ? err.message : "unknown error"));
        return;
      }
      if (!snap.exists()) {
        showInvalidInviteScreen("Invitation Not Found", "This invitation link doesn't match any invitation we have on record. It may have been removed, or the link may be incomplete.");
        return;
      }
      const invite = snap.data();
      if (invite.email !== user.email.toLowerCase()) {
        showInvalidInviteScreen("Invitation Not For This Account", "This invitation was sent to a different email address. Please sign in with the email address the invitation was sent to.");
        return;
      }
      if (invite.status === "accepted") {
        showInvalidInviteScreen("Invitation Already Accepted", "This invitation has already been accepted. If you already have access, use My Business to continue.");
        return;
      }
      if (invite.status === "declined") {
        showInvalidInviteScreen("Invitation Declined", "This invitation was previously declined. Ask the business owner to send a new invitation if you'd like to join.");
        return;
      }
      if (invite.status === "revoked") {
        showInvalidInviteScreen("Invitation Cancelled", "This invitation has been cancelled by the business owner.");
        return;
      }
      if (invite.expiresAtMs && invite.expiresAtMs <= Date.now()) {
        showInvalidInviteScreen("Invitation Expired", "This invitation has expired. Ask the business owner to send a new invitation.");
        return;
      }
      // Genuinely valid -- show the real accept/decline screen.
      pendingInvitesForCurrentUser = [{ id: linkedInvite.inviteId, businessId: linkedInvite.businessId, ...invite }];
      renderInviteAcceptScreen();
      return;
    }

    // No specific invite identified by the URL -- fall back to the
    // original broad scan for ANY pending invite matching this email,
    // exactly as before this change.
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
    try {
      await fns.setDoc(fns.doc(db, "users", currentUser.uid), { primaryBusinessId: invite.businessId }, { merge: true });
    } catch (err) {
      // Non-fatal: membership was already granted successfully above.
      // Worst case, this account falls back to the migration lookup on
      // its next sign-in instead of the fast path.
      console.error("[invoice-team] writing primaryBusinessId after accepting invite failed:", err);
    }

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

async function handleDeclineInvite() {
  const btn = $("invDeclineBtn");
  const invite = pendingInvitesForCurrentUser[0];
  if (!invite) return;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.updateDoc(fns.doc(db, "businesses", invite.businessId, "invites", invite.id), { status: "declined" });
  } catch (err) {
    console.error("[invoice-team] declining invite failed:", err);
    setError("invAcceptError", "Couldn't decline: " + (err && err.message ? err.message : "unknown error") + ". Please try again.");
    return;
  }
  pendingInvitesForCurrentUser.shift();
  $("invAcceptScreen").classList.add("hidden");
  if (typeof toast === "function") toast("Invitation declined.", "ok");
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
  $("invInvalidInviteContinueBtn").addEventListener("click", () => {
    hide("invInvalidInviteScreen");
    show("invModeSelect");
  });

  onAuthChange((user) => {
    currentUser = user;
    if (user) detectPendingInvitesForUser(user);
    else {
      members = []; invites = []; pendingInvitesForCurrentUser = [];
      hide("invAcceptScreen");
    }
  });
}

if (document.getElementById("invTeamList")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTeamUI);
  } else {
    initTeamUI();
  }
}
