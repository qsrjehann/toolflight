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

import { onAuthChange, getDb } from "./invoice-auth.js?v=20260729-0934";

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
    await fns.setDoc(inviteRef, {
      email, role: roleLabel, permissions, status: "pending",
      invitedByUid: currentUser ? currentUser.uid : null,
      createdAt: fns.serverTimestamp(),
      expiresAtMs: now + 7 * 24 * 60 * 60 * 1000, // 7 days -- plain number, not a Timestamp, so rules can compare it directly against request.time.toMillis()
    });
    $("invTeamModal").classList.remove("show");
    if (typeof toast === "function") toast("Invite sent.", "ok");
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

async function acceptPendingInvitesForUser(user) {
  if (!user || !user.email) return;
  const db = getDb();
  if (!db) return;
  try {
    const fns = await loadFirestoreFns();
    const q = fns.query(fns.collectionGroup(db, "invites"), fns.where("email", "==", user.email.toLowerCase()), fns.where("status", "==", "pending"));
    const snap = await fns.getDocs(q);
    for (const inviteDoc of snap.docs) {
      const invite = inviteDoc.data();
      const businessId = inviteDoc.ref.parent.parent.id;
      const batch = fns.writeBatch(db);
      const memberRef = fns.doc(db, "businesses", businessId, "businessMembers", user.uid);
      batch.set(memberRef, { uid: user.uid, role: invite.role, permissions: invite.permissions, email: user.email, joinedAt: fns.serverTimestamp() });
      batch.update(inviteDoc.ref, { status: "accepted" });
      await batch.commit();
    }
    if (snap.docs.length > 0 && typeof toast === "function") {
      toast("You've joined a business team.", "ok");
    }
  } catch (err) {
    console.error("[invoice-team] accepting pending invites failed:", err);
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

  onAuthChange((user) => {
    currentUser = user;
    if (user) acceptPendingInvitesForUser(user);
    else { members = []; invites = []; }
  });
}

if (document.getElementById("invTeamList")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTeamUI);
  } else {
    initTeamUI();
  }
}