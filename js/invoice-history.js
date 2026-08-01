/* ToolFlight Invoice & Business Manager -- Saved Invoices / History (Phase 4)
   ==========================================================================
   Isolated on purpose, same as the other invoice-*.js files: owns nothing
   outside invoice-maker.html, touches no other tool's code.

   Reuses the shared Firebase Auth/Firestore instances from invoice-auth.js
   and the business/customer/product state from invoice-business.js (via
   its window.toolflightInvoiceBusiness bridge) rather than duplicating
   either. Reuses invoice.js's existing calculation/render/PDF logic
   entirely unchanged via its window.toolflightInvoice bridge -- this file
   never recalculates a total or reimplements PDF export itself.

   HONESTY NOTE: same as invoice-auth.js and invoice-business.js -- tested
   for the UI/validation/rendering layer and the exact Firestore calls
   this code issues, not against a real Firestore backend, since none
   exists and this sandbox blocks the Firebase CDN outright. See the
   Phase 4 report for exactly what could and could not be verified. */

import { onAuthChange, getDb } from "./invoice-auth.js?v=20260801-2010";

let currentUser = null;
let invoices = []; // cached list for the currently loaded business
let firestoreFns = null;
let editingInvoiceId = null; // null while creating a NEW invoice; set while editing an existing one
let editingOriginalSnapshot = null; // the full pre-edit invoice, needed to compute inventory deltas correctly

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setError(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }

const NOT_CONFIGURED_MESSAGE = "Account features aren't fully set up yet. Quick Invoice (no account) works normally.";
const GUEST_SAVE_MESSAGE = "Saving invoice history requires a free account. You can still download or print this invoice right now.";

async function loadFirestoreFns() {
  if (firestoreFns) return firestoreFns;
  firestoreFns = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
  return firestoreFns;
}

/* ==================================================================
   Atomic invoice numbering
   ================================================================== */


/* ==================================================================
   Save (create or edit)
   ================================================================== */

async function handleSaveInvoice() {
  const btn = $("invSaveInvoiceBtn");
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();

  if (!currentUser) {
    // Guest -- never force account creation. Explain, don't block the
    // rest of the page (print/download remain fully usable).
    if (typeof toast === "function") toast(GUEST_SAVE_MESSAGE, "err");
    else alert(GUEST_SAVE_MESSAGE);
    return;
  }
  if (!businessId) {
    if (typeof toast === "function") toast("Set up your business first to save invoices.", "err");
    return;
  }
  if (!getDb()) {
    if (typeof toast === "function") toast(NOT_CONFIGURED_MESSAGE, "err");
    return;
  }

  const state = window.toolflightInvoice.getState();
  const totals = window.toolflightInvoice.getTotals();
  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  setError("invSaveError", "");

  try {
    const invoiceId = await saveInvoiceWithInventory(businessId, state, totals, editingInvoiceId, editingOriginalSnapshot);
    editingInvoiceId = invoiceId;
    if (typeof toast === "function") toast("Invoice saved.", "ok");
    await refreshInvoices(businessId);
  } catch (err) {
    if (err && err.message && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const { name, available, requested } = JSON.parse(err.message.slice("INSUFFICIENT_STOCK:".length));
      setError("invSaveError", `Not enough stock available for "${name}". Available: ${available}, Requested: ${requested}.`);
      if (typeof toast === "function") toast(`Not enough stock for "${name}" (available: ${available}, requested: ${requested}).`, "err");
    } else {
      console.error("[invoice-history] save failed:", err);
      if (typeof toast === "function") toast("Could not save right now. Please try again.", "err");
    }
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

// Combines invoice number reservation (new invoices only), per-product
// stock deduction/restoration, and movement-record creation into ONE
// Firestore transaction alongside the invoice write itself -- so a
// failure partway through can never leave the invoice saved without its
// matching stock change, or vice versa.
async function saveInvoiceWithInventory(businessId, state, totals, editingId, oldSnapshot) {
  const db = getDb();
  const fns = await loadFirestoreFns();

  // Sum quantities per product across all line items (a product could
  // appear more than once in one invoice), for the OLD saved snapshot
  // (0 for every product if this is a brand-new invoice) and the NEW
  // state about to be saved.
  const sumByProduct = (items) => {
    const map = {};
    for (const item of (items || [])) {
      if (!item.productId) continue;
      map[item.productId] = (map[item.productId] || 0) + (Number(item.qty) || 0);
    }
    return map;
  };
  const newQtyByProduct = sumByProduct(state.items);
  const oldQtyByProduct = sumByProduct(oldSnapshot ? oldSnapshot.items : []);
  const allProductIds = new Set([...Object.keys(newQtyByProduct), ...Object.keys(oldQtyByProduct)]);

  // delta > 0 means "deduct this many more units than before" (a genuine
  // additional sale); delta < 0 means "return this many units" (an
  // edit that reduced quantity, removed the product, or swapped it for
  // a different one). delta === 0 needs no stock touch at all.
  const deltas = {};
  for (const pid of allProductIds) {
    deltas[pid] = (newQtyByProduct[pid] || 0) - (oldQtyByProduct[pid] || 0);
  }
  const productIdsNeedingStockChange = [...allProductIds].filter(pid => deltas[pid] !== 0);

  const invoiceRef = editingId
    ? fns.doc(db, "businesses", businessId, "invoices", editingId)
    : fns.doc(fns.collection(db, "businesses", businessId, "invoices"));
  const counterRef = fns.doc(db, "businesses", businessId, "settings", "invoiceCounter");
  const profile = window.toolflightInvoiceBusiness.getBusinessProfile();
  const startNumber = (profile && profile.invoiceStartNumber) || 1;
  const prefix = (profile && profile.invoicePrefix) || "";

  return fns.runTransaction(db, async (tx) => {
    // ---- ALL READS FIRST (a hard Firestore transaction requirement) ----
    const productRefs = {}, productSnaps = {};
    for (const pid of productIdsNeedingStockChange) {
      const ref = fns.doc(db, "businesses", businessId, "products", pid);
      productRefs[pid] = ref;
      productSnaps[pid] = await tx.get(ref);
    }
    const counterSnap = editingId ? null : await tx.get(counterRef);

    // ---- Validate stock sufficiency BEFORE writing anything ----
    for (const pid of productIdsNeedingStockChange) {
      const delta = deltas[pid];
      if (delta <= 0) continue; // a restore/reduction is always safe
      const snap = productSnaps[pid];
      if (!snap.exists()) continue; // product was deleted since -- nothing to deduct from, treat as untracked
      const product = snap.data();
      if (!product.inventoryTracking) continue;
      const currentStock = product.stock != null ? product.stock : 0;
      if (currentStock < delta) {
        throw new Error(`INSUFFICIENT_STOCK:${JSON.stringify({ name: product.name, available: currentStock, requested: delta })}`);
      }
    }

    // ---- Writes ----
    let invoiceNumber = state.meta.number;
    if (!editingId) {
      const next = counterSnap.exists() && typeof counterSnap.data().nextNumber === "number" ? counterSnap.data().nextNumber : startNumber;
      invoiceNumber = prefix + String(next).padStart(4, "0");
      tx.set(counterRef, { nextNumber: next + 1 }, { merge: true });
    }

    for (const pid of productIdsNeedingStockChange) {
      const delta = deltas[pid];
      const snap = productSnaps[pid];
      if (!snap.exists()) continue;
      const product = snap.data();
      if (!product.inventoryTracking) continue;
      const prevStock = product.stock != null ? product.stock : 0;
      const newStock = prevStock - delta;
      tx.update(productRefs[pid], { stock: newStock });
      const movementRef = fns.doc(fns.collection(db, "businesses", businessId, "inventoryMovements"));
      tx.set(movementRef, {
        productId: pid,
        productName: product.name,
        type: delta > 0 ? "Sale" : "Return",
        quantityChange: -delta, // negative for a sale (stock going down), positive for a return
        previousQuantity: prevStock,
        newQuantity: newStock,
        reason: delta > 0 ? "Invoice sale" : "Invoice edited or removed",
        relatedInvoiceId: invoiceRef.id,
        performedByUid: currentUser ? currentUser.uid : null,
        createdAt: fns.serverTimestamp(),
      });
    }

    const snapshot = { ...state, meta: { ...state.meta, number: invoiceNumber }, totals, updatedAt: fns.serverTimestamp() };
    if (editingId) {
      tx.update(invoiceRef, snapshot);
    } else {
      tx.set(invoiceRef, { ...snapshot, createdAt: fns.serverTimestamp() });
    }

    return invoiceRef.id;
  }).then((invoiceId) => {
    // Reflect the reserved number in the visible field once the
    // transaction has actually committed -- never guessed beforehand.
    if (!editingId) {
      fns_getInvoiceNumberForDisplay(businessId, invoiceId);
    }
    return invoiceId;
  });
}

// Small helper: after a brand-new invoice's transaction commits, read
// back its assigned number just to reflect it in the visible field --
// avoids threading the reserved number through the .then() chain above
// in a way that would need loadFirestoreFns() imported twice.
async function fns_getInvoiceNumberForDisplay(businessId, invoiceId) {
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const snap = await fns.getDoc(fns.doc(db, "businesses", businessId, "invoices", invoiceId));
    if (snap.exists()) {
      document.getElementById("invNumber").value = (snap.data().meta && snap.data().meta.number) || "";
    }
  } catch (err) {
    console.error("[invoice-history] could not read back invoice number:", err);
  }
}

/* ==================================================================
   List / search
   ================================================================== */

async function listInvoices(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "invoices"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function refreshInvoices(businessId) {
  if (!businessId) return;
  try {
    invoices = await listInvoices(businessId);
    renderHistoryList($("invHistorySearch").value);
  } catch (err) {
    console.error("[invoice-history] load failed:", err);
    setError("invHistoryError", "Could not load invoice history right now.");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatMoney(amount, currencyCode) {
  const symbols = { USD:'$', EUR:'€', GBP:'£', INR:'₹', CAD:'CA$', AUD:'A$', JPY:'¥', AED:'AED ', PKR:'Rs ' };
  const symbol = symbols[currencyCode] || (currencyCode ? currencyCode + " " : "");
  const rounded = Math.round((Number(amount||0) + Number.EPSILON) * 100) / 100;
  return symbol + rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderHistoryList(filterText) {
  const list = $("invHistoryList");
  const term = (filterText || "").trim().toLowerCase();
  const filtered = term
    ? invoices.filter(inv =>
        ((inv.meta && inv.meta.number) || "").toLowerCase().includes(term) ||
        ((inv.customer && inv.customer.name) || "").toLowerCase().includes(term))
    : invoices;

  if (invoices.length === 0) {
    hide("invHistoryList");
    show("invHistoryEmptyState");
    return;
  }
  hide("invHistoryEmptyState");
  show("invHistoryList");

  if (filtered.length === 0) {
    list.innerHTML = `<p class="editor-hint">No invoices match your search.</p>`;
    return;
  }

  // Most recently created first -- Firestore Timestamps compare correctly
  // with plain "<", falling back gracefully if createdAt hasn't resolved
  // client-side yet (offline cache before server ack).
  const sorted = filtered.slice().sort((a, b) => {
    const at = a.createdAt && a.createdAt.seconds || 0;
    const bt = b.createdAt && b.createdAt.seconds || 0;
    return bt - at;
  });

  list.innerHTML = sorted.map(inv => {
    const number = escapeHtml((inv.meta && inv.meta.number) || "(no number)");
    const date = escapeHtml((inv.meta && inv.meta.date) || "");
    const customerName = escapeHtml((inv.customer && inv.customer.name) || "(no customer)");
    const total = formatMoney(inv.totals && inv.totals.total, inv.meta && inv.meta.currency);
    return `
      <div class="inv-record-row" data-id="${inv.id}">
        <div class="inv-record-main">
          <div class="inv-record-name">${number} — ${customerName}</div>
          <div class="inv-record-sub">${date} · ${total}</div>
        </div>
        <div class="inv-record-actions">
          <button type="button" class="btn btn-ghost inv-history-view" data-id="${inv.id}">View</button>
          <button type="button" class="btn btn-ghost inv-history-edit" data-id="${inv.id}">Edit</button>
          <button type="button" class="btn btn-ghost inv-history-delete" data-id="${inv.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ==================================================================
   View / Edit -- both load the SAVED SNAPSHOT, never reconstruct from
   current customer/product records, per "the saved invoice must remain
   historically accurate."
   ================================================================== */

function openInvoiceInBuilder(invoice, isEditing) {
  editingInvoiceId = isEditing ? invoice.id : null;
  editingOriginalSnapshot = isEditing ? invoice : null;
  const { totals, id, createdAt, updatedAt, ...state } = invoice; // strip storage-only fields before loading into the builder's state shape
  window.toolflightInvoice.loadState(state);

  hide("invBusinessArea");
  show("invGuestBuilder");
  updateSaveHintForAuthState();
}

function handleViewOrEditClick(e, isEditing) {
  const id = e.target.dataset.id;
  if (!id) return;
  const invoice = invoices.find(inv => inv.id === id);
  if (!invoice) return;
  openInvoiceInBuilder(invoice, isEditing);
}

/* ==================================================================
   Delete
   ================================================================== */

function openDeleteConfirm(invoiceId) {
  $("invDeleteConfirmId").value = invoiceId;
  $("invDeleteConfirmModal").classList.add("show");
}

async function handleConfirmDelete() {
  const invoiceId = $("invDeleteConfirmId").value;
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();
  if (!invoiceId || !businessId) return;
  try {
    await deleteInvoiceWithInventoryRestore(businessId, invoiceId);
    $("invDeleteConfirmModal").classList.remove("show");
    await refreshInvoices(businessId);
  } catch (err) {
    console.error("[invoice-history] delete failed:", err);
    setError("invHistoryError", "Could not delete right now. Please try again.");
  }
}

async function deleteInvoiceWithInventoryRestore(businessId, invoiceId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const invoiceRef = fns.doc(db, "businesses", businessId, "invoices", invoiceId);

  return fns.runTransaction(db, async (tx) => {
    // Read the invoice INSIDE the transaction, not from the cached list --
    // this is what makes a retried/duplicate delete safe. If a prior
    // attempt already committed, this read finds nothing and the
    // transaction below does no restoration at all, rather than
    // double-crediting stock back.
    const invoiceSnap = await tx.get(invoiceRef);
    if (!invoiceSnap.exists()) return; // already deleted -- nothing to restore, nothing to do

    const invoice = invoiceSnap.data();
    const qtyByProduct = {};
    for (const item of (invoice.items || [])) {
      if (!item.productId) continue;
      qtyByProduct[item.productId] = (qtyByProduct[item.productId] || 0) + (Number(item.qty) || 0);
    }
    const productIds = Object.keys(qtyByProduct);

    // Reads before writes.
    const productRefs = {}, productSnaps = {};
    for (const pid of productIds) {
      const ref = fns.doc(db, "businesses", businessId, "products", pid);
      productRefs[pid] = ref;
      productSnaps[pid] = await tx.get(ref);
    }

    for (const pid of productIds) {
      const snap = productSnaps[pid];
      if (!snap.exists()) continue; // product deleted since -- nothing to restore to
      const product = snap.data();
      if (!product.inventoryTracking) continue;
      const qty = qtyByProduct[pid];
      const prevStock = product.stock != null ? product.stock : 0;
      const newStock = prevStock + qty;
      tx.update(productRefs[pid], { stock: newStock });
      const movementRef = fns.doc(fns.collection(db, "businesses", businessId, "inventoryMovements"));
      tx.set(movementRef, {
        productId: pid,
        productName: product.name,
        type: "Return",
        quantityChange: qty,
        previousQuantity: prevStock,
        newQuantity: newStock,
        reason: "Invoice deleted",
        relatedInvoiceId: invoiceId,
        performedByUid: currentUser ? currentUser.uid : null,
        createdAt: fns.serverTimestamp(),
      });
    }

    tx.delete(invoiceRef);
  });
}

/* ==================================================================
   "Create Invoice" entry point -- fixes the gap found during Phase 4
   audit where a returning authenticated user with an existing business
   had no path back to the builder at all. Pre-fills business defaults
   per the Phase 3 integration requirement that was not yet wired up:
   default currency, default tax settings, and business info.
   ================================================================== */

function startNewInvoice() {
  editingInvoiceId = null;
  editingOriginalSnapshot = null;
  const profile = window.toolflightInvoiceBusiness.getBusinessProfile();
  const today = new Date().toISOString().slice(0, 10);
  const blankState = {
    business: profile ? { name: profile.name||'', email: profile.email||'', address: profile.address||'', phone: profile.phone||'' } : { name:'', email:'', address:'', phone:'' },
    customer: { name: '', email: '', address: '' },
    meta: {
      number: '', // left blank until saved -- a real number is only ever reserved atomically at save time, never guessed client-side
      date: today,
      dueDate: '',
      currency: (profile && profile.defaultCurrency) || 'USD',
      currencySymbol: null,
    },
    items: [ { description: '', qty: 1, price: 0 } ],
    tax: { enabled: !!(profile && profile.taxSettings && profile.taxSettings.enabled), rate: (profile && profile.taxSettings && profile.taxSettings.defaultRate) || 0 },
    discount: { type: 'percent', value: 0 },
    notes: (profile && profile.paymentNotes) || '',
  };
  window.toolflightInvoice.loadState(blankState);
  hide("invBusinessArea"); hide("invModeSelect");
  show("invGuestBuilder");
  updateSaveHintForAuthState();
}

function updateSaveHintForAuthState() {
  const hint = $("invSaveHint");
  if (!hint) return;
  hint.textContent = currentUser
    ? "Saving stores this invoice to your account so you can find it later in Invoice History."
    : "This invoice is created entirely in your browser. Nothing is uploaded, and nothing is saved once you leave this page — download or print before you go.";
}

/* ==================================================================
   Wiring
   ================================================================== */

function switchToInvoicesTab() {
  const businessId = window.toolflightInvoiceBusiness.getBusinessId();
  if (businessId) refreshInvoices(businessId);
}

function initHistoryUI() {
  $("invCreateInvoiceBtn").addEventListener("click", startNewInvoice);
  $("invHistoryCreateBtn").addEventListener("click", startNewInvoice);
  $("invSaveInvoiceBtn").addEventListener("click", handleSaveInvoice);

  $("invHistorySearch").addEventListener("input", (e) => renderHistoryList(e.target.value));
  $("invHistoryList").addEventListener("click", (e) => {
    if (e.target.classList.contains("inv-history-view")) handleViewOrEditClick(e, false);
    else if (e.target.classList.contains("inv-history-edit")) handleViewOrEditClick(e, true);
    else if (e.target.classList.contains("inv-history-delete")) openDeleteConfirm(e.target.dataset.id);
  });

  $("invDeleteCancelBtn").addEventListener("click", () => $("invDeleteConfirmModal").classList.remove("show"));
  $("invDeleteConfirmBtn").addEventListener("click", handleConfirmDelete);

  // Corrects the existing Back button's behavior for authenticated users
  // without touching invoice.js's own handler: that handler always shows
  // invModeSelect (the guest/signup choice screen), which would be
  // confusing to show someone already signed in. Runs after it, as a
  // second listener on the same button, and re-shows the correct state.
  $("invBackToModeBtn").addEventListener("click", () => {
    if (currentUser) {
      hide("invModeSelect");
      show("invAccountBar");
    }
  });

  // Refresh the invoice list whenever the Invoice History tab is opened --
  // piggybacks on the existing tab buttons rather than adding a second,
  // parallel tab-switching mechanism.
  const invoicesTabBtn = document.querySelector('.inv-business-tab[data-tab="invoices"]');
  if (invoicesTabBtn) invoicesTabBtn.addEventListener("click", switchToInvoicesTab);

  onAuthChange((user) => {
    currentUser = user;
    updateSaveHintForAuthState();
    if (!user) invoices = [];
  });
}

if (document.getElementById("invSaveInvoiceBtn")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHistoryUI);
  } else {
    initHistoryUI();
  }
}
