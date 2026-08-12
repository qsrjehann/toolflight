/* ToolFlight Invoice Maker -- Backup & Restore (Increment #1: Backup only)
   ==========================================================================
   HONESTY NOTE: this is Increment #1 as approved -- backup creation and
   download only. The restore engine (reading a .toolflight-backup file
   back into Firestore, with old-ID -> new-ID remapping) is explicitly
   NOT implemented here and must not be assumed to exist.

   Isolated on purpose, same as every other invoice-*.js module: owns
   nothing outside its own DOM ids, reuses getDb()/onAuthChange from
   invoice-auth.js and currentBusinessId/businessProfile via the existing
   window.toolflightInvoiceBusiness bridge, same as invoice-team.js and
   invoice-history.js already do. No new Firestore collection is created:
   businesses/{id}/backups/{backupId} already exists in firestore.rules
   (write: isOwner(businessId)) but had never been used by any client
   code -- this is its first real use, storing only lightweight metadata
   (timestamp, who created it, record counts), never the actual business
   data. The full backup content exists only in the file the user
   downloads -- it is never written to Firestore, never uploaded
   anywhere, and never leaves the browser except as a local download.

   Data included (confirmed against the actual repository, not assumed):
   business profile, customers, products, inventoryMovements, invoices,
   businessMembers (role/permissions/email -- NOT Firebase Auth
   credentials, which live in Firebase Auth itself and are never read or
   exported here), and settings/invoiceCounter. payments/sales/inventory
   (top-level) are deliberately excluded -- confirmed via repository
   search that no client code writes to them, so backing them up would
   only ever produce empty arrays that look like real data but aren't. */

import { onAuthChange, getDb, getAuthInstance } from "./invoice-auth.js?v=20260802-1600";

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setError(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }

const BACKUP_FORMAT = "toolflight-backup";
const BACKUP_VERSION = "1.0";

let currentUser = null;
let firestoreFns = null;
let lastBackup = null; // the most recently created backup object, held in memory so "Download" doesn't need to re-fetch

async function loadFirestoreFns() {
  if (firestoreFns) return firestoreFns;
  firestoreFns = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
  return firestoreFns;
}

/** Recursively converts Firestore Timestamp instances (which have a
    .toDate() method and .seconds/.nanoseconds) into a plain, portable
    {__type:"timestamp", seconds, nanoseconds} object. Without this, the
    backup file would contain live SDK objects that don't survive
    JSON.stringify predictably and would tie the file format to a
    specific Firestore SDK version -- exactly what "portable, versioned
    format" rules out. */
function serializeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === "object" && typeof val.toDate === "function" && typeof val.seconds === "number") {
    return { __type: "timestamp", seconds: val.seconds, nanoseconds: val.nanoseconds || 0 };
  }
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === "object") {
    const out = {};
    for (const k in val) if (Object.prototype.hasOwnProperty.call(val, k)) out[k] = serializeValue(val[k]);
    return out;
  }
  return val;
}

async function fetchAllDocs(db, fns, businessId, subcollection) {
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, subcollection));
  // _originalId is carried along specifically so a future restore engine
  // can build an oldId -> newId map and keep cross-references (e.g. an
  // invoice item's productId) internally consistent after restore --
  // see ADR-style note in the module header. It is NOT written back to
  // Firestore as a real field; restore is not implemented in this
  // increment, so nothing currently reads this field yet.
  return snap.docs.map(d => ({ _originalId: d.id, ...serializeValue(d.data()) }));
}

/** Builds the complete backup object for `businessId`. Read-only --
    performs only getDocs()/getDoc() calls, never a write, so creating a
    backup can never modify existing business data (verified by reading
    every function this calls: all are read operations). */
async function buildBackup(businessId, businessProfile) {
  const db = getDb();
  const fns = await loadFirestoreFns();

  const [customers, products, inventoryMovements, invoices, businessMembers] = await Promise.all([
    fetchAllDocs(db, fns, businessId, "customers"),
    fetchAllDocs(db, fns, businessId, "products"),
    fetchAllDocs(db, fns, businessId, "inventoryMovements"),
    fetchAllDocs(db, fns, businessId, "invoices"),
    fetchAllDocs(db, fns, businessId, "businessMembers"),
  ]);

  let invoiceCounter = null;
  try {
    const counterSnap = await fns.getDoc(fns.doc(db, "businesses", businessId, "settings", "invoiceCounter"));
    invoiceCounter = counterSnap.exists() ? serializeValue(counterSnap.data()) : null;
  } catch (err) {
    // Non-fatal: a business that has never saved an invoice may not have
    // this document yet. The backup is still complete without it.
    console.error("[invoice-backup] could not read settings/invoiceCounter (continuing without it):", err);
  }

  const profile = businessProfile || {};
  return {
    backupFormat: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    toolflightVersion: "1.0",
    createdAt: new Date().toISOString(),
    business: {
      _originalId: businessId,
      name: profile.name || "",
      phone: profile.phone || "",
      email: profile.email || "",
      website: profile.website || "",
      address: profile.address || "",
      defaultCurrency: profile.defaultCurrency || "",
      taxSettings: profile.taxSettings || null,
      invoicePrefix: profile.invoicePrefix || "",
      invoiceStartNumber: profile.invoiceStartNumber || 1,
      paymentNotes: profile.paymentNotes || "",
    },
    recordCounts: {
      customers: customers.length,
      products: products.length,
      inventoryMovements: inventoryMovements.length,
      invoices: invoices.length,
      businessMembers: businessMembers.length,
    },
    data: {
      customers,
      products,
      inventoryMovements,
      invoices,
      businessMembers,
      settings: { invoiceCounter },
    },
  };
}

function slugify(text) {
  return String(text || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "business";
}

function downloadBackupFile(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = backup.createdAt.slice(0, 10);
  a.href = url;
  a.download = `toolflight-backup-${slugify(backup.business.name)}-${dateStr}.toolflight-backup.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Writes ONLY lightweight metadata to businesses/{id}/backups/{auto} --
    never the actual business data (see module header). If this write
    fails for any reason, the user's downloaded file is completely
    unaffected -- it was already built and offered for download before
    this runs, so a metadata-write failure never costs the user their
    backup. */
async function recordBackupMetadata(businessId, backup) {
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const ref = fns.doc(fns.collection(db, "businesses", businessId, "backups"));
    await fns.setDoc(ref, {
      createdAt: fns.serverTimestamp(),
      createdByUid: currentUser ? currentUser.uid : null,
      createdByEmail: currentUser ? currentUser.email : null,
      backupVersion: BACKUP_VERSION,
      recordCounts: backup.recordCounts,
    });
  } catch (err) {
    console.error("[invoice-backup] could not record backup metadata (backup file itself is unaffected):", err);
  }
}

async function loadLastBackupInfo(businessId) {
  const infoEl = $("invBackupLastInfo");
  if (!infoEl || !businessId) return;
  infoEl.textContent = "Checking for previous backups…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const q = fns.query(
      fns.collection(db, "businesses", businessId, "backups"),
      fns.orderBy("createdAt", "desc"),
      fns.limit(1)
    );
    const snap = await fns.getDocs(q);
    if (snap.empty) {
      infoEl.textContent = "No backups yet.";
      return;
    }
    const last = snap.docs[0].data();
    const when = last.createdAt && last.createdAt.toDate ? last.createdAt.toDate() : null;
    infoEl.textContent = when
      ? "Last backup: " + when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "Last backup: just now.";
  } catch (err) {
    console.error("[invoice-backup] could not load last backup info:", err);
    infoEl.textContent = "";
  }
}

/** Shows/hides the whole Backup & Restore section based on ownership --
    matches the existing firestore.rules exactly (backups: write requires
    isOwner(businessId)), so this is a UI convenience, not a new access
    boundary: a non-owner who somehow saw this button would still be
    rejected by Firestore itself when the metadata write attempted. */
async function refreshBackupSection() {
  const section = $("invBackupSection");
  if (!section) return;
  const bridge = window.toolflightInvoiceBusiness;
  const businessId = bridge && bridge.getBusinessId();
  const profile = bridge && bridge.getBusinessProfile();
  const isOwner = !!(profile && currentUser && profile.ownerUid === currentUser.uid);
  if (!isOwner || !businessId) {
    hide("invBackupSection");
    return;
  }
  show("invBackupSection");
  hide("invBackupResult");
  setError("invBackupError", "");
  await loadLastBackupInfo(businessId);
}

async function handleCreateBackup() {
  const btn = $("invCreateBackupBtn");
  const bridge = window.toolflightInvoiceBusiness;
  const businessId = bridge && bridge.getBusinessId();
  const profile = bridge && bridge.getBusinessProfile();
  setError("invBackupError", "");
  if (!businessId) { setError("invBackupError", "No business is loaded right now."); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Creating backup…";
  try {
    const backup = await buildBackup(businessId, profile);
    lastBackup = backup;

    // Show real, verified counts -- these are the actual lengths of the
    // arrays just fetched, not an assumed/expected number, so this
    // directly reflects what was exported, not what "should" exist.
    const rc = backup.recordCounts;
    $("invBackupCounts").innerHTML = `
      <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">Customers</div></div><div class="inv-record-amount num">${rc.customers}</div></div>
      <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">Products</div></div><div class="inv-record-amount num">${rc.products}</div></div>
      <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">Invoices</div></div><div class="inv-record-amount num">${rc.invoices}</div></div>
      <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">Inventory movements</div></div><div class="inv-record-amount num">${rc.inventoryMovements}</div></div>
      <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">Team members</div></div><div class="inv-record-amount num">${rc.businessMembers}</div></div>
    `;
    show("invBackupResult");
    await recordBackupMetadata(businessId, backup);
    await loadLastBackupInfo(businessId);
  } catch (err) {
    console.error("[invoice-backup] backup creation failed:", err);
    setError("invBackupError", "Could not create a backup right now. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

function handleDownloadBackup() {
  if (!lastBackup) return;
  downloadBackupFile(lastBackup);
}

/* ==========================================================================
   Increment #2 -- Backup validation + preview (NO restore engine).
   Select Backup -> Read File -> Validate -> Show Preview -> User
   Confirmation -> STOP. Zero Firestore writes anywhere below this line.
   ========================================================================== */

const SUPPORTED_BACKUP_VERSIONS = ["1.0"];
const REQUIRED_DATA_ARRAYS = ["customers", "products", "inventoryMovements", "invoices", "businessMembers"];
let pendingRestoreBackup = null; // the validated backup object currently shown in the preview, if any

// Same escaping approach already used in invoice-team.js -- every file in
// this codebase keeps its own copy rather than sharing a utility module,
// so this matches the established pattern rather than introducing a new one.
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function isPlainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

function isValidTimestampShape(v) {
  // A field that's genuinely absent (null/undefined) is valid -- e.g. a
  // business that never saved an invoice has no invoiceCounter yet, and
  // Increment #1 already exports that as null rather than omitting it.
  if (v === null || v === undefined) return true;
  return isPlainObject(v) && v.__type === "timestamp" && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
}

/** Structural check for one exported record -- not a semantic/business-
    rule check (this increment never touches Firestore, so there's no
    "does this productId still exist" check to make; that's Increment
    #3's job at actual restore time). Checks the two things every record
    from Increment #1's fetchAllDocs() is guaranteed to have: a valid
    _originalId, and (if present) a validly-shaped createdAt timestamp. */
function validateRecordShape(record, kind) {
  if (!isPlainObject(record)) return "A " + kind + " record is not a valid object.";
  if (typeof record._originalId !== "string" || !record._originalId) return "A " + kind + " record is missing its original ID.";
  if ("createdAt" in record && !isValidTimestampShape(record.createdAt)) return "A " + kind + " record has an invalid timestamp.";
  return null;
}

/** Pure function: raw file text in, { ok, backup|error, detail } out.
    Zero DOM access, zero Firestore calls -- deliberately, so this exact
    function can be unit-tested outside the browser (see the audit
    report). Every check below runs unconditionally over the FULL
    arrays, not a sample -- for a 10,000-invoice backup this is a single
    O(n) pass of cheap typeof/property checks, not a meaningful cost,
    and sampling would risk missing a malformed record past the sampled
    range (unacceptable for "malformed records are detected"). */
function validateBackup(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return { ok: false, error: "This file isn't valid JSON -- it may be corrupted, or it isn't a ToolFlight backup at all.", detail: "JSON.parse failed: " + (err && err.message) };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "This file doesn't look like a ToolFlight backup.", detail: "Top-level JSON value is not an object." };
  }
  if (parsed.backupFormat !== "toolflight-backup") {
    return { ok: false, error: "Invalid ToolFlight backup file.", detail: "backupFormat field is missing or incorrect: " + JSON.stringify(parsed.backupFormat) };
  }
  if (typeof parsed.backupVersion !== "string" || !SUPPORTED_BACKUP_VERSIONS.includes(parsed.backupVersion)) {
    return { ok: false, error: "Backup version is not supported.", detail: "backupVersion: " + JSON.stringify(parsed.backupVersion) + " -- supported: " + SUPPORTED_BACKUP_VERSIONS.join(", ") };
  }
  if (typeof parsed.createdAt !== "string" || isNaN(Date.parse(parsed.createdAt))) {
    return { ok: false, error: "The backup appears to be corrupted.", detail: "createdAt is missing or not a valid date string." };
  }
  if (!isPlainObject(parsed.business) || typeof parsed.business.name !== "string") {
    return { ok: false, error: "Some required business data is missing from this backup.", detail: "business section is missing or malformed." };
  }
  if (!isPlainObject(parsed.recordCounts)) {
    return { ok: false, error: "The backup appears to be corrupted.", detail: "recordCounts section is missing." };
  }
  if (!isPlainObject(parsed.data)) {
    return { ok: false, error: "The backup appears to be corrupted.", detail: "data section is missing." };
  }

  for (const key of REQUIRED_DATA_ARRAYS) {
    if (!Array.isArray(parsed.data[key])) {
      return { ok: false, error: "Some required business data is missing from this backup.", detail: "data." + key + " is not an array." };
    }
    if (typeof parsed.recordCounts[key] !== "number") {
      return { ok: false, error: "The backup appears to be corrupted.", detail: "recordCounts." + key + " is not a number." };
    }
  }
  for (const key of REQUIRED_DATA_ARRAYS) {
    if (parsed.data[key].length !== parsed.recordCounts[key]) {
      return { ok: false, error: "Record counts do not match the backup contents -- this file may be corrupted.", detail: key + ": recordCounts says " + parsed.recordCounts[key] + " but data has " + parsed.data[key].length + " records." };
    }
  }
  for (const key of REQUIRED_DATA_ARRAYS) {
    for (const record of parsed.data[key]) {
      const err = validateRecordShape(record, key);
      if (err) return { ok: false, error: "Some records in this backup are malformed and can't be restored safely.", detail: err };
    }
  }
  if (parsed.data.settings && parsed.data.settings.invoiceCounter !== null && parsed.data.settings.invoiceCounter !== undefined
      && !isPlainObject(parsed.data.settings.invoiceCounter)) {
    return { ok: false, error: "The backup appears to be corrupted.", detail: "data.settings.invoiceCounter is present but not an object." };
  }

  return { ok: true, backup: parsed };
}

function formatBackupDate(isoString) {
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? isoString : d.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
}

/** Renders the preview using textContent/escapeHtml for every value that
    came from the untrusted file -- never innerHTML with a raw backup
    field, so the file cannot inject markup/scripts into the page
    regardless of what it contains (see security notes in the audit
    report). */
function renderRestorePreview(backup) {
  $("invRestoreBizName").textContent = backup.business.name || "(unnamed business)";
  $("invRestoreCreatedAt").textContent = formatBackupDate(backup.createdAt);
  $("invRestoreVersion").textContent = backup.backupVersion;

  const rc = backup.recordCounts;
  const rows = [
    ["Customers", rc.customers],
    ["Products", rc.products],
    ["Invoices", rc.invoices],
    ["Inventory movements", rc.inventoryMovements],
    ["Team members", rc.businessMembers],
  ];
  $("invRestoreCounts").innerHTML = rows.map(([label, count]) => `
    <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">${escapeHtml(label)}</div></div><div class="inv-record-amount num">${escapeHtml(String(count))}</div></div>
  `).join("");

  // Every item below is only ever shown once validateBackup() has
  // already returned ok:true -- so all four are always checkmarks here,
  // not a mixed pass/fail list. They exist to tell the shop owner what
  // was actually verified, in plain language.
  const checks = [
    "Backup file is valid",
    "Backup version is supported",
    "Data structure is valid",
    "Record counts verified",
  ];
  $("invRestoreChecklist").innerHTML = checks.map(c => `
    <div style="display:flex;align-items:center;gap:8px;color:var(--ok-solid);"><span style="font-weight:800;">&#10003;</span><span style="color:var(--ink);">${escapeHtml(c)}</span></div>
  `).join("");

  show("invRestorePreview");
  $("invRestorePreview").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetRestoreUI() {
  pendingRestoreBackup = null;
  hide("invRestorePreview");
  hide("invRestoreProgressBox");
  hide("invRestoreResultSuccess");
  hide("invRestoreResultFailure");
  setError("invRestoreError", "");
  $("invRestoreFileInput").value = "";
}

function handleSelectBackupFile() {
  resetRestoreUI();
  $("invRestoreFileInput").click();
}

function handleBackupFileChosen(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  setError("invRestoreError", "Reading file…");
  hide("invRestorePreview");

  const reader = new FileReader();
  reader.onerror = () => {
    setError("invRestoreError", "Could not read this file. Please try again.");
    console.error("[invoice-backup] FileReader error:", reader.error);
  };
  reader.onload = () => {
    // Everything from here on treats `reader.result` as untrusted input:
    // it is only ever passed to JSON.parse() (never eval()'d, never
    // assigned via innerHTML, never used to build a URL or script tag).
    const result = validateBackup(String(reader.result));
    if (!result.ok) {
      setError("invRestoreError", result.error);
      console.error("[invoice-backup] backup validation failed:", result.detail);
      return;
    }
    setError("invRestoreError", "");
    pendingRestoreBackup = result.backup;
    renderRestorePreview(result.backup);
  };
  reader.readAsText(file);
}

function handleRestoreCancel() {
  resetRestoreUI();
}

/* ==========================================================================
   Increment #3 -- Restore Engine.
   Runs ONLY after Increment #2's validateBackup() has already returned
   ok:true (pendingRestoreBackup is only ever set from there) and the user
   has explicitly clicked "Continue to Restore". Always creates a NEW
   business -- there is no code path anywhere below that accepts an
   existing businessId as a restore target, and old_ownerUid from the
   backup is never read into any write.
   ========================================================================== */

const RESTORE_BATCH_SIZE = 400; // safely under Firestore's 500-op batch limit

/** Mirror of Increment #1's serializeValue(), in reverse: turns a
    {__type:"timestamp", seconds, nanoseconds} marker back into a real
    Firestore Timestamp. Everything else passes through unchanged. */
function deserializeValue(fns, val) {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(v => deserializeValue(fns, v));
  if (typeof val === "object") {
    if (val.__type === "timestamp" && typeof val.seconds === "number") {
      return new fns.Timestamp(val.seconds, val.nanoseconds || 0);
    }
    const out = {};
    for (const k in val) if (Object.prototype.hasOwnProperty.call(val, k)) out[k] = deserializeValue(fns, val[k]);
    return out;
  }
  return val;
}

/** Strips the backup-only _originalId marker and reconstructs real
    Firestore Timestamps -- the baseline transform every restored record
    needs before it's writable. Collection-specific transforms (product
    ID remapping) wrap this. */
function stripAndDeserialize(fns, record) {
  const { _originalId, ...rest } = record;
  return deserializeValue(fns, rest);
}

/** Writes `records` into businesses/{businessId}/{subcollectionName} in
    sequential, awaited batches of RESTORE_BATCH_SIZE. Returns a map of
    oldId -> newId for every record actually committed. A batch that
    throws stops everything immediately -- no later batch, and no later
    collection, is attempted (see runRestoreEngine's try/catch). Every
    successfully-committed doc is appended to `writtenTracker` so a
    failure anywhere later can still find and clean up everything this
    function did manage to write. */
async function writeBatchedCollection(db, fns, businessId, subcollectionName, records, transformFn, onProgress, writtenTracker) {
  const idMap = {};
  let done = 0;
  onProgress(0, records.length);
  for (let i = 0; i < records.length; i += RESTORE_BATCH_SIZE) {
    const chunk = records.slice(i, i + RESTORE_BATCH_SIZE);
    const batch = fns.writeBatch(db);
    const chunkRefs = [];
    for (const record of chunk) {
      const newRef = fns.doc(fns.collection(db, "businesses", businessId, subcollectionName));
      batch.set(newRef, transformFn(record));
      chunkRefs.push({ oldId: record._originalId, newId: newRef.id });
    }
    await batch.commit(); // if this throws, chunkRefs below is never applied -- this chunk's docs were never committed
    for (const { oldId, newId } of chunkRefs) {
      idMap[oldId] = newId;
      writtenTracker.push({ subcollectionName, id: newId });
    }
    done += chunk.length;
    onProgress(done, records.length);
  }
  return idMap;
}

/** Step 1 of restore: create a brand-new, empty business owned by the
    CURRENT signed-in user. Deliberately mirrors invoice-business.js's
    own createBusinessForUser() sequence exactly (business doc -> users/
    {uid}.primaryBusinessId -> owner businessMembers bootstrap) rather
    than inventing a different one -- same three awaited writes, same
    order, same reasoning (the businessMembers bootstrap rule needs the
    parent business doc to already exist and be readable). The backup's
    own business._originalId and any ownerUid-like field are never read
    here; ownerUid is hardcoded to currentUser.uid. */
async function createEmptyBusinessForRestore(db, fns, user, backupBusinessProfile, writtenTracker) {
  const businessRef = fns.doc(fns.collection(db, "businesses"));
  const profile = {
    name: backupBusinessProfile.name || "",
    phone: backupBusinessProfile.phone || "",
    email: user.email || "",
    website: backupBusinessProfile.website || "",
    address: backupBusinessProfile.address || "",
    defaultCurrency: backupBusinessProfile.defaultCurrency || "",
    taxSettings: backupBusinessProfile.taxSettings || null,
    invoicePrefix: backupBusinessProfile.invoicePrefix || "",
    invoiceStartNumber: backupBusinessProfile.invoiceStartNumber || 1,
    paymentNotes: backupBusinessProfile.paymentNotes || "",
  };
  await fns.setDoc(businessRef, { ...profile, ownerUid: user.uid, createdAt: fns.serverTimestamp(), restoreStatus: "in_progress" });
  writtenTracker.businessCreated = true;

  await fns.setDoc(fns.doc(db, "users", user.uid), { primaryBusinessId: businessRef.id }, { merge: true });
  writtenTracker.primaryBusinessIdChanged = true;

  const memberRef = fns.doc(db, "businesses", businessRef.id, "businessMembers", user.uid);
  await fns.setDoc(memberRef, { uid: user.uid, role: "owner", email: user.email || "", joinedAt: fns.serverTimestamp() });
  writtenTracker.ownerMemberCreated = true;

  return businessRef.id;
}

/** Re-reads ACTUAL Firestore counts (via getCountFromServer -- a
    count-only query that never pulls full documents, so this stays
    cheap even for tens of thousands of records) and compares against
    the backup's own recordCounts. Restore is never reported successful
    unless every one of these matches exactly. */
async function verifyRestore(db, fns, businessId, backup) {
  const mismatches = [];
  for (const key of REQUIRED_DATA_ARRAYS) {
    let actual;
    try {
      const countSnap = await fns.getCountFromServer(fns.collection(db, "businesses", businessId, key));
      actual = countSnap.data().count;
    } catch (err) {
      mismatches.push({ collection: key, expected: backup.recordCounts[key], actual: "could not read: " + err.message });
      continue;
    }
    if (actual !== backup.recordCounts[key]) {
      mismatches.push({ collection: key, expected: backup.recordCounts[key], actual });
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/** Best-effort cleanup after a failed restore. Deletes every record this
    attempt actually wrote (from writtenTracker), then the business
    document itself, then restores the user's previous primaryBusinessId.

    KNOWN, ACCEPTED LIMITATION (see final report): firestore.rules'
    businessMembers delete rule requires request.auth.uid != memberUid --
    an owner can never delete their OWN membership record, by design
    (prevents a business ending up ownerless). This means the owner
    bootstrap doc created in createEmptyBusinessForRestore() cannot be
    deleted here. This is not a security issue: once the parent business
    document is deleted (which IS permitted and IS done below), that
    orphaned membership record is unreachable through any normal app
    path -- nothing resolves a business via a businessMembers doc alone
    without its parent business document existing. It is a small,
    inert leftover, not a data-integrity or access-control problem. */
async function cleanupPartialRestore(db, fns, businessId, writtenTracker, oldPrimaryBusinessId, user) {
  const failures = [];

  for (let i = 0; i < writtenTracker.length; i += RESTORE_BATCH_SIZE) {
    const chunk = writtenTracker.slice(i, i + RESTORE_BATCH_SIZE);
    try {
      const batch = fns.writeBatch(db);
      for (const item of chunk) {
        batch.delete(fns.doc(db, "businesses", businessId, item.subcollectionName, item.id));
      }
      await batch.commit();
    } catch (err) {
      failures.push("Could not remove " + chunk.length + " " + chunk[0].subcollectionName + " record(s): " + err.message);
    }
  }

  if (writtenTracker.businessCreated) {
    try {
      // Best-effort -- may not exist if it was never reached.
      await fns.deleteDoc(fns.doc(db, "businesses", businessId, "settings", "invoiceCounter"));
    } catch (err) { /* fine if this never existed */ }
    try {
      await fns.deleteDoc(fns.doc(db, "businesses", businessId));
    } catch (err) {
      failures.push("Could not remove the incomplete business record: " + err.message);
    }
  }

  if (writtenTracker.primaryBusinessIdChanged && user) {
    try {
      await fns.setDoc(fns.doc(db, "users", user.uid), { primaryBusinessId: oldPrimaryBusinessId || null }, { merge: true });
    } catch (err) {
      failures.push("Could not restore your previous business selection: " + err.message);
    }
  }

  return { cleanupOk: failures.length === 0, failures };
}

function updateRestoreProgress(stageLabel, current, total) {
  const el = $("invRestoreProgressText");
  if (!el) return;
  el.textContent = total > 0 ? `${stageLabel} ${current} / ${total}` : stageLabel;
}

function showRestoreProgressUI() {
  hide("invRestorePreview");
  hide("invRestoreResultSuccess");
  hide("invRestoreResultFailure");
  show("invRestoreProgressBox");
  $("invRestoreProgressText").textContent = "Starting…";
}

function showRestoreSuccess(businessId, backup, teamToReinvite) {
  hide("invRestoreProgressBox");
  const rc = backup.recordCounts;
  const rows = [
    ["Customers restored", rc.customers],
    ["Products restored", rc.products],
    ["Inventory movements restored", rc.inventoryMovements],
    ["Invoices restored", rc.invoices],
  ];
  $("invRestoreSuccessCounts").innerHTML = rows.map(([label, count]) => `
    <div class="inv-record-row"><div class="inv-record-main"><div class="inv-record-name">${escapeHtml(label)}</div></div><div class="inv-record-amount num">${escapeHtml(String(count))}</div></div>
  `).join("");
  const reinviteEl = $("invRestoreReinviteNote");
  if (teamToReinvite.length > 0) {
    reinviteEl.innerHTML = `<strong>${escapeHtml(String(teamToReinvite.length))} team member(s)</strong> were found in this backup but were not automatically restored: ${escapeHtml(teamToReinvite.join(", "))}. Please invite them again from Team Members.`;
    show("invRestoreReinviteNote");
  } else {
    hide("invRestoreReinviteNote");
  }
  show("invRestoreResultSuccess");
}

function showRestoreFailure(stageLabel, cleanupResult) {
  hide("invRestoreProgressBox");
  const box = $("invRestoreFailureDetail");
  if (cleanupResult.cleanupOk) {
    box.textContent = "Restore failed while " + stageLabel.toLowerCase() + " No business data was left behind -- the incomplete restore was automatically cleaned up. Please check your backup file and try again.";
  } else {
    box.innerHTML = `Restore failed while ${escapeHtml(stageLabel.toLowerCase())} Some incomplete data may remain in a partially-restored business (cleanup could not fully complete). Recommended: go to My Business and delete the incomplete business shown there, then try restoring again.<br><br><span style="font-size:11.5px;">Cleanup issues: ${escapeHtml(cleanupResult.failures.join(" · "))}</span>`;
  }
  show("invRestoreResultFailure");
}

/** Orchestrates the full restore. Every stage is sequential and awaited;
    the very first thrown error anywhere stops all further writes (the
    try/catch below is the ONLY place that decides "stop now"), triggers
    best-effort cleanup, and reports failure -- there is no path in this
    function that reports success without first passing verifyRestore(). */
async function runRestoreEngine(backup) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const user = currentUser;
  if (!user) {
    setError("invRestoreError", "You need to be signed in to restore a backup.");
    return;
  }

  showRestoreProgressUI();
  const writtenTracker = [];
  let newBusinessId = null;
  let oldPrimaryBusinessId = null;
  let stageLabel = "starting.";

  try {
    const bridge = window.toolflightInvoiceBusiness;
    oldPrimaryBusinessId = (bridge && bridge.getBusinessId && bridge.getBusinessId()) || null;

    stageLabel = "creating the new business.";
    updateRestoreProgress("Creating business…", 0, 1);
    newBusinessId = await createEmptyBusinessForRestore(db, fns, user, backup.business, writtenTracker);
    updateRestoreProgress("Creating business…", 1, 1);

    stageLabel = "restoring customers.";
    await writeBatchedCollection(db, fns, newBusinessId, "customers", backup.data.customers,
      (record) => stripAndDeserialize(fns, record),
      (done, total) => updateRestoreProgress("Restoring customers…", done, total),
      writtenTracker);

    stageLabel = "restoring products.";
    const productIdMap = await writeBatchedCollection(db, fns, newBusinessId, "products", backup.data.products,
      (record) => stripAndDeserialize(fns, record),
      (done, total) => updateRestoreProgress("Restoring products…", done, total),
      writtenTracker);

    stageLabel = "restoring inventory movements.";
    await writeBatchedCollection(db, fns, newBusinessId, "inventoryMovements", backup.data.inventoryMovements,
      (record) => {
        const clean = stripAndDeserialize(fns, record);
        // Defensive: an unmapped/malformed productId becomes null rather
        // than a dangling reference to an ID that no longer exists --
        // never lets one bad reference corrupt an otherwise-good record.
        if (clean.productId) clean.productId = productIdMap[clean.productId] || null;
        return clean;
      },
      (done, total) => updateRestoreProgress("Restoring inventory…", done, total),
      writtenTracker);

    stageLabel = "restoring invoices.";
    await writeBatchedCollection(db, fns, newBusinessId, "invoices", backup.data.invoices,
      (record) => {
        const clean = stripAndDeserialize(fns, record);
        if (Array.isArray(clean.items)) {
          clean.items = clean.items.map(item => {
            if (!item || typeof item !== "object") return item;
            const productId = item.productId ? (productIdMap[item.productId] || null) : (item.productId === undefined ? undefined : null);
            return { ...item, productId };
          });
        }
        return clean;
      },
      (done, total) => updateRestoreProgress("Restoring invoices…", done, total),
      writtenTracker);

    stageLabel = "restoring settings.";
    if (backup.data.settings && backup.data.settings.invoiceCounter) {
      updateRestoreProgress("Restoring settings…", 0, 1);
      const counterData = deserializeValue(fns, backup.data.settings.invoiceCounter);
      await fns.setDoc(fns.doc(db, "businesses", newBusinessId, "settings", "invoiceCounter"), counterData);
      writtenTracker.push({ subcollectionName: "settings", id: "invoiceCounter" });
      updateRestoreProgress("Restoring settings…", 1, 1);
    }

    stageLabel = "verifying restored data.";
    updateRestoreProgress("Verifying restored data…", 0, 1);
    const verifyResult = await verifyRestore(db, fns, newBusinessId, backup);
    if (!verifyResult.ok) {
      throw new Error("Verification found mismatched record counts: " + JSON.stringify(verifyResult.mismatches));
    }
    updateRestoreProgress("Verifying restored data…", 1, 1);

    await fns.updateDoc(fns.doc(db, "businesses", newBusinessId), { restoreStatus: "complete" });

    const teamToReinvite = (backup.data.businessMembers || [])
      .filter(m => m && m.role !== "owner")
      .map(m => (m && m.email) || "(no email on file)");
    showRestoreSuccess(newBusinessId, backup, teamToReinvite);

  } catch (err) {
    console.error("[invoice-backup] restore failed at stage \"" + stageLabel + "\":", err);
    let cleanupResult = { cleanupOk: false, failures: ["Cleanup was not attempted (business was never created)."] };
    if (newBusinessId) {
      updateRestoreProgress("Restore failed -- cleaning up…", 0, 0);
      cleanupResult = await cleanupPartialRestore(db, fns, newBusinessId, writtenTracker, oldPrimaryBusinessId, user);
    } else {
      cleanupResult = { cleanupOk: true, failures: [] }; // nothing was ever created
    }
    showRestoreFailure(stageLabel, cleanupResult);
  }
}

function handleRestoreContinue() {
  if (!pendingRestoreBackup) return;
  runRestoreEngine(pendingRestoreBackup);
}

/* ==========================================================================
   Increment #4 -- Google Drive backup/restore + Automatic Daily Backup.

   ARCHITECTURE: Drive is just a different place to put/get the exact same
   .toolflight-backup.json file Increment #1/#2 already produce and read.
   buildBackup(), validateBackup(), and runRestoreEngine() are reused
   completely unmodified -- a backup from Drive goes through the identical
   validation and restore path as a locally-selected file.

   SCOPE: https://www.googleapis.com/auth/drive.file only -- this grants
   access ONLY to files this app itself creates, never the user's whole
   Drive. Requesting it re-prompts Google's consent screen (an
   "incremental authorization" on top of the existing Firebase Google
   Sign-In, not a replacement for it) via a SEPARATE GoogleAuthProvider
   instance from the one invoice-auth.js uses for normal sign-in, so
   this can never interfere with that flow.

   TOKEN HANDLING: the resulting Drive access token lives ONLY in the
   driveAccessToken module variable below -- never written to Firestore,
   never to localStorage/sessionStorage. This means Drive shows as "Not
   connected" again after every page reload, by design: that is the
   safe, explicit tradeoff of never persisting an OAuth token
   client-side, and matches the requirement not to store one in
   Firestore. Reconnecting is a single click.

   FIRESTORE WRITES: only two new fields on the business document itself
   (autoBackupEnabled: boolean, lastAutoBackupAt: Timestamp) -- both
   already covered by the EXISTING businesses/{id} update rule
   (hasPermission(businessId,'settings','edit') with ownerUid unchanged).
   No rules change. No new collection. */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

let driveAccessToken = null; // in-memory ONLY -- see header note above
let firebaseAuthFns = null;

async function loadFirebaseAuthFns() {
  if (firebaseAuthFns) return firebaseAuthFns;
  firebaseAuthFns = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js");
  return firebaseAuthFns;
}

function driveFileNameFor(businessName, businessId) {
  // Full businessId (not truncated) -- guarantees zero collision risk
  // between two different businesses, even ones with identical names.
  return `ToolFlight-Backup-${slugify(businessName)}-${businessId}.toolflight.json`;
}

async function driveFetch(url, options) {
  if (!driveAccessToken) throw new Error("DRIVE_NOT_CONNECTED");
  const res = await fetch(url, {
    ...options,
    headers: { ...(options && options.headers), Authorization: "Bearer " + driveAccessToken },
  });
  if (res.status === 401) {
    driveAccessToken = null;
    updateDriveConnectionUI();
    throw new Error("DRIVE_TOKEN_EXPIRED");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Drive API error " + res.status + ": " + text.slice(0, 200));
  }
  return res;
}

async function findExistingDriveBackupFile(fileName) {
  const q = encodeURIComponent(`name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`);
  const res = await driveFetch(`${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive`, { method: "GET" });
  const json = await res.json();
  return (json.files && json.files[0]) || null;
}

async function uploadDriveBackupContent(fileId, fileName, jsonText) {
  const metadata = fileId ? { name: fileName } : { name: fileName, mimeType: "application/json" };
  const boundary = "toolflight-boundary-" + Date.now();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${jsonText}\r\n--${boundary}--`;
  const url = fileId
    ? `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;
  const res = await driveFetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

async function saveBackupToDrive(businessId, businessName, backup) {
  const fileName = driveFileNameFor(businessName, businessId);
  const existing = await findExistingDriveBackupFile(fileName);
  const jsonText = JSON.stringify(backup);
  await uploadDriveBackupContent(existing ? existing.id : null, fileName, jsonText);
}

async function listDriveBackupFiles() {
  // No name filter: drive.file scope already means this app can only
  // ever see files it created itself, so every result here is already
  // guaranteed to be a ToolFlight file -- a name filter isn't needed for
  // correctness, and Drive's `contains` operator does prefix/tokenized
  // matching (hyphens are token boundaries), which unreliably matched
  // hyphenated filenames like this app's own. See regression notes.
  const q = encodeURIComponent(`trashed = false`);
  const res = await driveFetch(`${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`, { method: "GET" });
  const json = await res.json();
  return json.files || [];
}

async function downloadDriveFileContent(fileId) {
  const res = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, { method: "GET" });
  return res.text();
}

function updateDriveConnectionUI() {
  const statusEl = $("invDriveStatus");
  const connectBtn = $("invDriveConnectBtn");
  if (!statusEl) return;
  if (driveAccessToken) {
    statusEl.textContent = "Connected";
    statusEl.style.color = "var(--ok-solid)";
    connectBtn.textContent = "Reconnect Google Drive";
    show("invDriveActions");
  } else {
    statusEl.textContent = "Not connected";
    statusEl.style.color = "var(--ink-soft)";
    connectBtn.textContent = "Connect Google Drive";
    hide("invDriveActions");
  }
}

async function handleConnectDrive() {
  setError("invDriveMsg", "");
  const btn = $("invDriveConnectBtn");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Connecting…";
  try {
    const authFns = await loadFirebaseAuthFns();
    const auth = getAuthInstance();
    if (!auth) throw new Error("Not signed in.");
    const provider = new authFns.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    const result = await authFns.signInWithPopup(auth, provider);
    const credential = authFns.GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) throw new Error("Google did not grant Drive access.");
    driveAccessToken = credential.accessToken;
    updateDriveConnectionUI();
  } catch (err) {
    console.error("[invoice-backup] Google Drive connect failed:", err);
    setError("invDriveMsg", "Could not connect Google Drive. Please try again.");
  } finally {
    btn.disabled = false;
    updateDriveConnectionUI();
  }
}

async function handleBackupToDrive() {
  const btn = $("invDriveBackupBtn");
  const bridge = window.toolflightInvoiceBusiness;
  const businessId = bridge && bridge.getBusinessId();
  const profile = bridge && bridge.getBusinessProfile();
  setError("invDriveMsg", "");
  if (!driveAccessToken) { setError("invDriveMsg", "Connect Google Drive to store automatic backups."); return; }
  if (!businessId) { setError("invDriveMsg", "No business is loaded right now."); return; }

  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving to Drive…";
  try {
    const backup = await buildBackup(businessId, profile);
    await saveBackupToDrive(businessId, profile.name || "business", backup);
    setSuccessMsg("invDriveMsg", "Your latest backup has been saved to Google Drive.");
  } catch (err) {
    console.error("[invoice-backup] Drive backup failed:", err);
    if (String(err.message).includes("DRIVE_TOKEN_EXPIRED")) {
      setError("invDriveMsg", "Google Drive permission expired. Please reconnect Google Drive.");
    } else {
      setError("invDriveMsg", "Backup could not be uploaded. Your local backup is still available.");
    }
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

async function handleRestoreFromDrive() {
  setError("invDriveMsg", "");
  if (!driveAccessToken) { setError("invDriveMsg", "Connect Google Drive first to restore from it."); return; }
  const btn = $("invDriveRestoreBtn");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Checking Google Drive…";
  try {
    const files = await listDriveBackupFiles();
    if (files.length === 0) {
      setError("invDriveMsg", "No ToolFlight backups were found in your Google Drive.");
      return;
    }
    const text = await downloadDriveFileContent(files[0].id);
    const result = validateBackup(text);
    if (!result.ok) {
      setError("invDriveMsg", result.error);
      console.error("[invoice-backup] Drive backup validation failed:", result.detail);
      return;
    }
    pendingRestoreBackup = result.backup;
    renderRestorePreview(result.backup);
  } catch (err) {
    console.error("[invoice-backup] Drive restore failed:", err);
    if (String(err.message).includes("DRIVE_TOKEN_EXPIRED")) {
      setError("invDriveMsg", "Google Drive permission expired. Please reconnect Google Drive.");
    } else {
      setError("invDriveMsg", "Could not read backups from Google Drive right now.");
    }
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

async function checkAndRunAutoBackup(businessId, profile) {
  if (!profile || !profile.autoBackupEnabled) return;
  if (!driveAccessToken) return;
  const last = profile.lastAutoBackupAt;
  const lastMs = last && typeof last.toDate === "function" ? last.toDate().getTime() : 0;
  if (Date.now() - lastMs < AUTO_BACKUP_INTERVAL_MS) return;

  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const backup = await buildBackup(businessId, profile);
    await saveBackupToDrive(businessId, profile.name || "business", backup);
    await fns.updateDoc(fns.doc(db, "businesses", businessId), { lastAutoBackupAt: fns.serverTimestamp() });
    refreshAutoBackupStatusUI(businessId);
  } catch (err) {
    console.error("[invoice-backup] automatic daily backup failed (local backup remains available):", err);
  }
}

function refreshAutoBackupStatusUI(businessId) {
  const bridge = window.toolflightInvoiceBusiness;
  const profile = bridge && bridge.getBusinessProfile();
  const toggle = $("invAutoBackupToggle");
  const lastEl = $("invAutoBackupLast");
  if (!toggle || !profile) return;
  toggle.checked = !!profile.autoBackupEnabled;
  if (profile.lastAutoBackupAt && typeof profile.lastAutoBackupAt.toDate === "function") {
    lastEl.textContent = "Last automatic backup: " + profile.lastAutoBackupAt.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } else {
    lastEl.textContent = "Last automatic backup: never yet.";
  }
}

async function handleToggleAutoBackup(e) {
  const bridge = window.toolflightInvoiceBusiness;
  const businessId = bridge && bridge.getBusinessId();
  if (!businessId) { e.target.checked = !e.target.checked; return; }
  const enabled = e.target.checked;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.updateDoc(fns.doc(db, "businesses", businessId), { autoBackupEnabled: enabled });
    if (enabled && !driveAccessToken) {
      setSuccessMsg("invDriveMsg", "Automatic backup is on. Connect Google Drive so it has somewhere to save to.");
    }
  } catch (err) {
    console.error("[invoice-backup] could not update automatic backup setting:", err);
    e.target.checked = !enabled;
    setError("invDriveMsg", "Could not update automatic backup right now.");
  }
}

function setSuccessMsg(id, msg) {
  const el = $(id);
  if (!el) return;
  el.style.color = "var(--ok-solid)";
  el.textContent = msg;
}

function initBackupUI() {
  if (!$("invBackupSection")) return; // defensive -- only wire up if the HTML section actually exists
  $("invCreateBackupBtn").addEventListener("click", handleCreateBackup);
  $("invDownloadBackupBtn").addEventListener("click", handleDownloadBackup);

  // Same lazy-refresh-on-tab-open pattern already used by invoice-team.js
  // and invoice-history.js -- querySelectorAll (not querySelector), since
  // multiple nav surfaces (sidebar, mobile "More" sheet, profile dropdown)
  // can all lead to the profile/settings tab.
  document.querySelectorAll('.inv-business-tab[data-tab="profile"]').forEach(btn => {
    btn.addEventListener("click", () => {
      refreshBackupSection();
      const bridge = window.toolflightInvoiceBusiness;
      const businessId = bridge && bridge.getBusinessId();
      const profile = bridge && bridge.getBusinessProfile();
      if (businessId && profile) {
        refreshAutoBackupStatusUI(businessId);
        checkAndRunAutoBackup(businessId, profile);
      }
    });
  });

  // Increment #2 wiring -- file picker is a plain <input type="file">, so
  // any location the device/OS file picker itself exposes (local storage,
  // Downloads, Google Drive/OneDrive/Dropbox if the OS has them mounted
  // as picker sources, etc.) works without any dedicated integration.
  $("invSelectBackupBtn").addEventListener("click", handleSelectBackupFile);
  $("invRestoreFileInput").addEventListener("change", handleBackupFileChosen);
  $("invRestoreCancelBtn").addEventListener("click", handleRestoreCancel);
  $("invRestoreContinueBtn").addEventListener("click", handleRestoreContinue);
  $("invRestoreDismissSuccessBtn").addEventListener("click", () => { hide("invRestoreResultSuccess"); resetRestoreUI(); });
  $("invRestoreDismissFailureBtn").addEventListener("click", () => { hide("invRestoreResultFailure"); resetRestoreUI(); });

  // Increment #4 wiring
  $("invDriveConnectBtn").addEventListener("click", handleConnectDrive);
  $("invDriveBackupBtn").addEventListener("click", handleBackupToDrive);
  $("invDriveRestoreBtn").addEventListener("click", handleRestoreFromDrive);
  $("invAutoBackupToggle").addEventListener("change", handleToggleAutoBackup);
  updateDriveConnectionUI();

  onAuthChange((user) => {
    currentUser = user;
  });
}

if (document.getElementById("invBackupSection")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBackupUI);
  } else {
    initBackupUI();
  }
}
