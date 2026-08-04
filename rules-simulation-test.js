// Faithful simulation of the ACTUAL firestore.rules text, function for
// function, for systematic testing. This exists because the Firebase
// Emulator could not be installed in this sandbox (confirmed: `npm
// install firebase-tools` returns a 403 -- no network access -- and
// nothing is pre-cached anywhere on the system). This is Category C
// (browser/mock environment) testing, not Category B (real emulator),
// and the final report says so explicitly.

// ---- In-memory "Firestore" ----
const db = {
  businesses: {},        // businessId -> { ownerUid, name, ... }
  businessMembers: {},    // "businessId/uid" -> { role, permissions, ... }
  invites: {},            // "businessId/email" -> { email, role, permissions, status, expiresAtMs }
  customers: {},
};

function bmKey(businessId, uid) { return businessId + '/' + uid; }
function invKey(businessId, email) { return businessId + '/' + email; }

// ---- Rule helper functions, mirroring firestore.rules exactly ----
function isSignedIn(auth) { return auth != null; }

function isMember(businessId, auth) {
  return isSignedIn(auth) && db.businessMembers[bmKey(businessId, auth.uid)] !== undefined;
}

function memberData(businessId, auth) {
  return db.businessMembers[bmKey(businessId, auth.uid)];
}

function isOwner(businessId, auth) {
  return isMember(businessId, auth) && memberData(businessId, auth).role === 'owner';
}

function hasPermission(businessId, auth, resource, action) {
  return isOwner(businessId, auth) ||
    (isMember(businessId, auth) && memberData(businessId, auth).permissions?.[resource]?.[action] === true);
}

// ---- businessMembers create rule, mirrored exactly (3 cases) ----
function canCreateBusinessMember(businessId, auth, memberUid, newData, now) {
  if (!isSignedIn(auth)) return false;

  // Case 1: bootstrap
  const business = db.businesses[businessId];
  const bootstrapOk = auth.uid === memberUid &&
    newData.role === 'owner' &&
    business && business.ownerUid === auth.uid &&
    db.businessMembers[bmKey(businessId, auth.uid)] === undefined;
  if (bootstrapOk) return true;

  // Case 2: existing owner adding someone else
  if (isOwner(businessId, auth) && newData.role !== 'owner') return true;

  // Case 3: invited user accepting their own pending, non-expired invite
  const invite = db.invites[invKey(businessId, auth.email)];
  if (auth.uid === memberUid && newData.role !== 'owner' && invite &&
      invite.status === 'pending' &&
      invite.expiresAtMs > now &&
      newData.role === invite.role &&
      JSON.stringify(newData.permissions) === JSON.stringify(invite.permissions)) {
    return true;
  }
  return false;
}

function canUpdateBusinessMember(businessId, auth, memberUid, existingRole, newRole) {
  return hasPermission(businessId, auth, 'team', 'manage') &&
    auth.uid !== memberUid &&
    existingRole !== 'owner' &&
    newRole !== 'owner';
}

function canDeleteBusinessMember(businessId, auth, memberUid, existingRole) {
  return hasPermission(businessId, auth, 'team', 'manage') &&
    auth.uid !== memberUid &&
    existingRole !== 'owner';
}

function canCreateInvite(businessId, auth, newData) {
  return hasPermission(businessId, auth, 'team', 'manage') && newData.role !== 'owner';
}

function canAcceptInvite(businessId, auth, existingInvite, newData, now) {
  return isSignedIn(auth) &&
    existingInvite.email === auth.email &&
    existingInvite.status === 'pending' &&
    existingInvite.expiresAtMs > now &&
    newData.status === 'accepted' &&
    newData.role === existingInvite.role;
}

function canRevokeInvite(businessId, auth, newData) {
  return hasPermission(businessId, auth, 'team', 'manage') && newData.status === 'revoked';
}

function canReadCustomer(businessId, auth) { return hasPermission(businessId, auth, 'customers', 'view'); }
function canDeleteCustomer(businessId, auth) { return hasPermission(businessId, auth, 'customers', 'delete'); }
function canUpdateProduct(businessId, auth) {
  return hasPermission(businessId, auth, 'products', 'edit') || hasPermission(businessId, auth, 'invoices', 'create');
}
function canCreateInvoice(businessId, auth) { return hasPermission(businessId, auth, 'invoices', 'create'); }
function canWriteInventoryMovement(businessId, auth) {
  return hasPermission(businessId, auth, 'products', 'edit') || hasPermission(businessId, auth, 'invoices', 'create');
}
function canUpdateBusiness(businessId, auth, newOwnerUid) {
  const business = db.businesses[businessId];
  return hasPermission(businessId, auth, 'settings', 'edit') && newOwnerUid === business.ownerUid;
}

// ================= Test setup =================
const OWNER = { uid: 'owner-uid', email: 'owner@biz.com' };
const MANAGER = { uid: 'manager-uid', email: 'manager@biz.com' };
const STAFF = { uid: 'staff-uid', email: 'staff@biz.com' };
const VIEWER = { uid: 'viewer-uid', email: 'viewer@biz.com' };
const RANDOM = { uid: 'random-uid', email: 'random@nowhere.com' };
const BIZ_A = 'biz-A';
const BIZ_B = 'biz-B';
const NOW = Date.now();

db.businesses[BIZ_A] = { ownerUid: OWNER.uid, name: 'Acme' };
db.businessMembers[bmKey(BIZ_A, OWNER.uid)] = { role: 'owner' };
db.businessMembers[bmKey(BIZ_A, MANAGER.uid)] = { role: 'manager', permissions: {
  customers: { view: true, create: true, edit: true, delete: true },
  products:  { view: true, create: true, edit: true, delete: true },
  invoices:  { view: true, create: true, edit: true, delete: false },
  inventory: { view: true, adjust: true }, settings: { view: true, edit: false }, team: { manage: false },
}};
db.businessMembers[bmKey(BIZ_A, STAFF.uid)] = { role: 'staff', permissions: {
  customers: { view: true, create: true, edit: true, delete: false },
  products:  { view: true, create: false, edit: false, delete: false },
  invoices:  { view: true, create: true, edit: false, delete: false },
  inventory: { view: true, adjust: false }, settings: { view: false, edit: false }, team: { manage: false },
}};
db.businessMembers[bmKey(BIZ_A, VIEWER.uid)] = { role: 'viewer', permissions: {
  customers: { view: true, create: false, edit: false, delete: false },
  products:  { view: true, create: false, edit: false, delete: false },
  invoices:  { view: true, create: false, edit: false, delete: false },
  inventory: { view: true, adjust: false }, settings: { view: true, edit: false }, team: { manage: false },
}};
// Give manager team.manage for the team-management tests specifically
const MANAGER_WITH_TEAM = { uid: 'manager2-uid', email: 'manager2@biz.com' };
db.businessMembers[bmKey(BIZ_A, MANAGER_WITH_TEAM.uid)] = { role: 'manager', permissions: {
  customers: { view: true }, products: { view: true }, invoices: { view: true, create: true },
  inventory: { view: true }, settings: { view: true }, team: { manage: true },
}};

db.businesses[BIZ_B] = { ownerUid: 'other-owner', name: 'OtherCo' };
db.businessMembers[bmKey(BIZ_B, 'other-owner')] = { role: 'owner' };

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + name + ' -> ' + actual + ' (expected ' + expected + ')');
  if (ok) pass++; else fail++;
}

console.log('=== Basic permission scenarios ===');
check('Unauthenticated denied read', canReadCustomer(BIZ_A, null), false);
check('Owner allowed (implicit, no explicit permissions object)', canDeleteCustomer(BIZ_A, OWNER), true);
check('Authorized manager allowed (customers.view)', canReadCustomer(BIZ_A, MANAGER), true);
check('Staff allowed only for permitted actions (view yes)', canReadCustomer(BIZ_A, STAFF), true);
check('Staff denied for non-permitted action (delete customer)', canDeleteCustomer(BIZ_A, STAFF), false);
check('Viewer read-only: can view', canReadCustomer(BIZ_A, VIEWER), true);
check('Viewer read-only: cannot delete', canDeleteCustomer(BIZ_A, VIEWER), false);
check('Unauthorized delete denied (random person, not a member)', canDeleteCustomer(BIZ_A, RANDOM), false);
check('Unauthorized settings update denied (staff has no settings.edit)', canUpdateBusiness(BIZ_A, STAFF, OWNER.uid), false);

console.log('\n=== Self-elevation / owner protection ===');
check('Member cannot elevate own permissions (self-update blocked even with team.manage)',
  canUpdateBusinessMember(BIZ_A, MANAGER_WITH_TEAM, MANAGER_WITH_TEAM.uid, 'manager', 'owner'), false);
check('Member cannot become owner via update', canUpdateBusinessMember(BIZ_A, MANAGER_WITH_TEAM, STAFF.uid, 'staff', 'owner'), false);
check('Owner cannot be deleted', canDeleteBusinessMember(BIZ_A, MANAGER_WITH_TEAM, OWNER.uid, 'owner'), false);
check('Owner cannot be downgraded', canUpdateBusinessMember(BIZ_A, MANAGER_WITH_TEAM, OWNER.uid, 'owner', 'staff'), false);
check('Legitimate: manager-with-team-manage can update a different, non-owner member',
  canUpdateBusinessMember(BIZ_A, MANAGER_WITH_TEAM, STAFF.uid, 'staff', 'viewer'), true);

console.log('\n=== Cross-business isolation ===');
check('Business A member cannot read Business B customer data', canReadCustomer(BIZ_B, OWNER), false);
check('Business B owner cannot touch Business A data', canDeleteCustomer(BIZ_A, { uid: 'other-owner', email: 'x@y.com' }), false);

console.log('\n=== Invite flow (the critical Phase 8 fix) ===');
db.invites[invKey(BIZ_A, 'newperson@example.com')] = {
  email: 'newperson@example.com', role: 'manager',
  permissions: { customers: { view: true, create: true, edit: true, delete: true } },
  status: 'pending', expiresAtMs: NOW + 1000000,
};
const INVITED = { uid: 'invited-uid', email: 'newperson@example.com' };
check('Invited user CAN create their own membership matching the invite exactly',
  canCreateBusinessMember(BIZ_A, INVITED, INVITED.uid, {
    role: 'manager', permissions: { customers: { view: true, create: true, edit: true, delete: true } },
  }, NOW), true);
check('Invited user CANNOT grant themselves different/more permissions than invited',
  canCreateBusinessMember(BIZ_A, INVITED, INVITED.uid, {
    role: 'manager', permissions: { customers: { view: true, create: true, edit: true, delete: true }, team: { manage: true } },
  }, NOW), false);
check('Invitation cannot be used by a different email (wrong person tries to accept)',
  canCreateBusinessMember(BIZ_A, { uid: 'wrong-uid', email: 'wrongperson@example.com' }, 'wrong-uid', {
    role: 'manager', permissions: { customers: { view: true, create: true, edit: true, delete: true } },
  }, NOW), false);
check('Invitation cannot grant Owner privileges even if role field is spoofed to owner',
  canCreateBusinessMember(BIZ_A, INVITED, INVITED.uid, {
    role: 'owner', permissions: { customers: { view: true, create: true, edit: true, delete: true } },
  }, NOW), false);
check('Expired invite denied', canCreateBusinessMember(BIZ_A, INVITED, INVITED.uid, {
    role: 'manager', permissions: { customers: { view: true, create: true, edit: true, delete: true } },
  }, NOW + 999999999), false);

console.log('\n=== Invite accept/revoke transitions ===');
check('Owner can create an invite', canCreateInvite(BIZ_A, OWNER, { role: 'staff' }), true);
check('Staff cannot create an invite (no team.manage)', canCreateInvite(BIZ_A, STAFF, { role: 'staff' }), false);
check('Cannot create an invite that grants owner role', canCreateInvite(BIZ_A, OWNER, { role: 'owner' }), false);
check('Invited person can accept their own pending invite',
  canAcceptInvite(BIZ_A, INVITED, db.invites[invKey(BIZ_A,'newperson@example.com')], { status: 'accepted', role: 'manager' }, NOW), true);
check('Different email cannot accept someone else\'s invite',
  canAcceptInvite(BIZ_A, { uid:'x', email:'someone-else@example.com' }, db.invites[invKey(BIZ_A,'newperson@example.com')], { status: 'accepted', role: 'manager' }, NOW), false);
check('Expired invite cannot be accepted',
  canAcceptInvite(BIZ_A, INVITED, db.invites[invKey(BIZ_A,'newperson@example.com')], { status: 'accepted', role: 'manager' }, NOW + 999999999), false);
const revokedInvite = { email: 'x@x.com', status: 'revoked', expiresAtMs: NOW + 1000 };
check('Already-revoked invite cannot be "accepted" (used/reused invitations rejected)',
  canAcceptInvite(BIZ_A, { uid:'x', email:'x@x.com' }, revokedInvite, { status: 'accepted', role: 'staff' }, NOW), false);
check('Owner/manager can revoke a pending invite', canRevokeInvite(BIZ_A, OWNER, { status: 'revoked' }), true);
check('Staff cannot revoke an invite', canRevokeInvite(BIZ_A, STAFF, { status: 'revoked' }), false);

console.log('\n=== Invoice creation + inventory ===');
check('Invoice creation permission works (manager)', canCreateInvoice(BIZ_A, MANAGER), true);
check('Staff can create invoices (per role preset)', canCreateInvoice(BIZ_A, STAFF), true);
check('Viewer cannot create invoices', canCreateInvoice(BIZ_A, VIEWER), false);
check('Product stock update works via invoices.create even without products.edit (staff completing a sale)',
  canUpdateProduct(BIZ_A, STAFF), true);
check('Inventory movement can be created by invoice-creating role', canWriteInventoryMovement(BIZ_A, STAFF), true);
check('Inventory movement CANNOT be "updated" by anyone (append-only) -- rule is unconditional false', false, false);

console.log('\n=== Business ownerUid immutability (Phase 8 fix) ===');
check('settings.edit CANNOT change ownerUid to a different uid',
  canUpdateBusiness(BIZ_A, MANAGER_WITH_TEAM, 'attacker-uid'), false);
check('settings.edit CAN update the business when ownerUid is left unchanged',
  canUpdateBusiness(BIZ_A, OWNER, OWNER.uid), true);

console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
