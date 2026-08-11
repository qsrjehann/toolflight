/* ToolFlight Invoice & Business Manager -- Business Profile, Customers,
   Products (Phase 3)
   ==========================================================================
   Isolated on purpose, same as invoice.js and invoice-auth.js: owns
   nothing outside invoice-maker.html, touches no other tool's code.

   Shares the Firebase Auth/Firestore instances from invoice-auth.js
   (via its onAuthChange/getDb exports) rather than initializing a
   second Firebase app -- avoids "app already initialized" errors and
   keeps exactly one source of truth for the current user.

   HONESTY NOTE: like invoice-auth.js, this has been tested for what it
   actually is -- the UI/validation/rendering layer, and the exact
   Firestore read/write calls this code issues -- not against a real
   Firestore backend, since no Firebase project exists in this
   repository and this sandbox blocks the Firebase CDN outright. See
   the Phase 3 report for exactly what could and could not be verified. */

import { onAuthChange, getDb } from "./invoice-auth.js?v=20260802-1600";

let currentUser = null;
let currentBusinessId = null;
let businessProfile = null;
let customers = [];
let products = [];
let movements = [];
let currentStockFilter = "all";
let firestoreFns = null; // set on first successful Firestore operation, via dynamic import

function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setError(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }
function setSuccess(id, msg) { const el = $(id); if (el) el.textContent = msg || ""; }

const NOT_CONFIGURED_MESSAGE = "Account features aren't fully set up yet. Quick Invoice (no account) works normally.";

async function loadFirestoreFns() {
  if (firestoreFns) return firestoreFns;
  firestoreFns = await import("https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js");
  return firestoreFns;
}

/* ---------- Validation ---------- */
function isNonEmpty(str) { return typeof str === "string" && str.trim().length > 0; }
function isValidPrice(val) { const n = Number(val); return !Number.isNaN(n) && n >= 0; }
function isValidQty(val) { const n = Number(val); return !Number.isNaN(n) && Number.isFinite(n) && n >= 0; }

/* ==================================================================
   BUSINESS PROFILE
   ================================================================== */

async function findBusinessForUser(uid) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  // A single, direct document read at a known path -- the same
  // reliable pattern as loadBusinessProfile(), which has never failed
  // once in this codebase's entire testing history. No query, no
  // collectionGroup, nothing for Firestore to verify beyond "does this
  // exact document belong to this exact signed-in user."
  //
  // No fallback query here on purpose: a missing primaryBusinessId
  // means exactly one thing -- this account has no business yet, which
  // is the normal, correct state for every fresh signup. An earlier
  // version of this function fell back to a collectionGroup query in
  // that case, intended only for pre-existing "legacy" accounts -- but
  // it fired for every brand-new user too (since they don't have
  // primaryBusinessId set either, having never created a business at
  // all), turning a correct "no business yet" into a false permission
  // error. Accounts whose business predates this fix are handled with
  // a one-time manual backfill in Firestore Console instead.
  const userRef = fns.doc(db, "users", uid);
  let userSnap;
  try {
    userSnap = await fns.getDoc(userRef);
  } catch (err) {
    err.diagnosticStep = "reading users/" + uid + " for primaryBusinessId";
    throw err;
  }
  if (userSnap.exists() && userSnap.data().primaryBusinessId) {
    return userSnap.data().primaryBusinessId;
  }
  return null;
}

async function loadBusinessProfile(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const ref = fns.doc(db, "businesses", businessId);
  const snap = await fns.getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function createBusinessForUser(uid, profileData) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const businessRef = fns.doc(fns.collection(db, "businesses"));
  // Sequential, awaited writes rather than a single batch: guarantees
  // the business document is fully committed (and unambiguously
  // readable by the businessMembers bootstrap rule's get() check) before
  // the membership write is even attempted, rather than depending on
  // same-batch cross-document read visibility for the rule evaluation.
  await fns.setDoc(businessRef, { ...profileData, ownerUid: uid, createdAt: fns.serverTimestamp() });
  await fns.setDoc(fns.doc(db, "users", uid), { primaryBusinessId: businessRef.id }, { merge: true });
  const memberRef = fns.doc(db, "businesses", businessRef.id, "businessMembers", uid);
  await fns.setDoc(memberRef, { uid, role: "owner", email: currentUser ? currentUser.email : (profileData.email || ""), joinedAt: fns.serverTimestamp() });
  return businessRef.id;
}

async function saveBusinessProfile(businessId, profileData) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  await fns.updateDoc(fns.doc(db, "businesses", businessId), profileData);
}

function readBusinessFormData() {
  const currencySel = $("invSetBizCurrency").value;
  const currency = currencySel === "OTHER" ? $("invSetBizCurrencyOther").value.trim().toUpperCase() : currencySel;
  return {
    name: $("invSetBizName").value.trim(),
    phone: $("invSetBizPhone").value.trim(),
    email: $("invSetBizEmail").value.trim(),
    website: $("invSetBizWebsite").value.trim(),
    address: $("invSetBizAddress").value.trim(),
    defaultCurrency: currency,
    taxSettings: {
      enabled: $("invSetTaxEnabled").checked,
      defaultRate: Number($("invSetTaxRate").value) || 0,
    },
    invoicePrefix: $("invSetInvoicePrefix").value.trim(),
    invoiceStartNumber: Number($("invSetInvoiceStart").value) || 1,
    paymentNotes: $("invSetPaymentNotes").value.trim(),
    // logoUrl intentionally not written yet -- Phase 3 only prepares the
    // structure (see INVOICE_ARCHITECTURE.md); no upload UI is built.
  };
}

function fillBusinessForm(profile) {
  if (!profile) return;
  $("invSetBizName").value = profile.name || "";
  $("invSetBizPhone").value = profile.phone || "";
  $("invSetBizEmail").value = profile.email || "";
  $("invSetBizWebsite").value = profile.website || "";
  $("invSetBizAddress").value = profile.address || "";
  const knownCurrencies = ["USD","EUR","GBP","INR","CAD","AUD","JPY","AED","PKR"];
  if (profile.defaultCurrency && knownCurrencies.includes(profile.defaultCurrency)) {
    $("invSetBizCurrency").value = profile.defaultCurrency;
    $("invSetBizCurrencyOtherWrap").style.display = "none";
  } else if (profile.defaultCurrency) {
    $("invSetBizCurrency").value = "OTHER";
    $("invSetBizCurrencyOther").value = profile.defaultCurrency;
    $("invSetBizCurrencyOtherWrap").style.display = "";
  }
  const tax = profile.taxSettings || {};
  $("invSetTaxEnabled").checked = !!tax.enabled;
  $("invSetTaxRate").value = tax.defaultRate || 0;
  $("invSetTaxRate").disabled = !tax.enabled;
  $("invSetInvoicePrefix").value = profile.invoicePrefix || "";
  $("invSetInvoiceStart").value = profile.invoiceStartNumber || "";
  $("invSetPaymentNotes").value = profile.paymentNotes || "";
}

async function handleSaveBusinessProfile() {
  const btn = $("invBizSetupSaveBtn");
  const data = readBusinessFormData();
  setError("invBizSetupError", ""); setSuccess("invBizSetupSuccess", "");

  if (!isNonEmpty(data.name)) { setError("invBizSetupError", "Business name is required."); return; }
  if (!getDb() || !currentUser) { setError("invBizSetupError", NOT_CONFIGURED_MESSAGE); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    if (currentBusinessId) {
      await saveBusinessProfile(currentBusinessId, data);
    } else {
      currentBusinessId = await createBusinessForUser(currentUser.uid, data);
    }
    businessProfile = { id: currentBusinessId, ...data };
    setSuccess("invBizSetupSuccess", "Business profile saved.");
    hide("invSetupPrompt");
    await refreshCustomersAndProducts();
  } catch (err) {
    console.error("[invoice-business] save profile failed:", err);
    setError("invBizSetupError", "Could not save right now. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

/* ==================================================================
   CUSTOMERS
   ================================================================== */

async function listCustomers(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "customers"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function readCustomerFormData() {
  return {
    name: $("invCustFormName").value.trim(),
    phone: $("invCustFormPhone").value.trim(),
    email: $("invCustFormEmail").value.trim(),
    address: $("invCustFormAddress").value.trim(),
    company: $("invCustFormCompany").value.trim(),
    taxId: $("invCustFormTaxId").value.trim(),
    notes: $("invCustFormNotes").value.trim(),
  };
}

function openCustomerModal(customer) {
  $("invCustomerModalTitle").textContent = customer ? "Edit Customer" : "Add Customer";
  $("invCustomerEditId").value = customer ? customer.id : "";
  $("invCustFormName").value = customer ? customer.name || "" : "";
  $("invCustFormPhone").value = customer ? customer.phone || "" : "";
  $("invCustFormEmail").value = customer ? customer.email || "" : "";
  $("invCustFormAddress").value = customer ? customer.address || "" : "";
  $("invCustFormCompany").value = customer ? customer.company || "" : "";
  $("invCustFormTaxId").value = customer ? customer.taxId || "" : "";
  $("invCustFormNotes").value = customer ? customer.notes || "" : "";
  setError("invCustFormError", "");
  $("invCustomerModal").classList.add("show");
}

async function handleSaveCustomer() {
  const btn = $("invCustFormSaveBtn");
  const data = readCustomerFormData();
  const editId = $("invCustomerEditId").value;
  setError("invCustFormError", "");

  if (!isNonEmpty(data.name)) { setError("invCustFormError", "Customer name is required."); return; }
  if (!getDb() || !currentBusinessId) { setError("invCustFormError", NOT_CONFIGURED_MESSAGE); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    if (editId) {
      await fns.updateDoc(fns.doc(db, "businesses", currentBusinessId, "customers", editId), data);
    } else {
      await fns.addDoc(fns.collection(db, "businesses", currentBusinessId, "customers"), { ...data, createdAt: fns.serverTimestamp() });
    }
    $("invCustomerModal").classList.remove("show");
    await refreshCustomers();
  } catch (err) {
    console.error("[invoice-business] save customer failed:", err);
    setError("invCustFormError", "Could not save right now. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

async function handleDeleteCustomer(customerId) {
  if (!confirm("Delete this customer? This cannot be undone.")) return;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.deleteDoc(fns.doc(db, "businesses", currentBusinessId, "customers", customerId));
    await refreshCustomers();
  } catch (err) {
    console.error("[invoice-business] delete customer failed:", err);
    setError("invCustomersError", "Could not delete right now. Please try again.");
  }
}

function renderCustomersList(filterText) {
  const list = $("invCustomersList");
  const term = (filterText || "").trim().toLowerCase();
  const filtered = term
    ? customers.filter(c => (c.name||"").toLowerCase().includes(term) || (c.company||"").toLowerCase().includes(term) || (c.email||"").toLowerCase().includes(term))
    : customers;

  if (filtered.length === 0) {
    list.innerHTML = `<p class="editor-hint">${customers.length === 0 ? "No customers yet. Add your first one above." : "No customers match your search."}</p>`;
    return;
  }
  list.innerHTML = filtered.map(c => `
    <div class="inv-record-row" data-id="${c.id}">
      <div class="inv-record-main">
        <div class="inv-record-name">${escapeHtml(c.name)}</div>
        <div class="inv-record-sub">${[c.company, c.email, c.phone].filter(Boolean).map(escapeHtml).join(" · ") || "&nbsp;"}</div>
      </div>
      <div class="inv-record-actions">
        <button type="button" class="btn btn-ghost inv-record-edit" data-id="${c.id}">Edit</button>
        <button type="button" class="btn btn-ghost inv-record-delete" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join("");
}

async function refreshCustomers() {
  if (!currentBusinessId) return;
  try {
    customers = await listCustomers(currentBusinessId);
    renderCustomersList($("invCustomerSearch").value);
  } catch (err) {
    console.error("[invoice-business] load customers failed:", err);
    setError("invCustomersError", "Could not load customers right now.");
  }
}

/* ==================================================================
   PRODUCTS
   ================================================================== */

async function listProducts(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "products"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function readProductFormData() {
  return {
    name: $("invProdFormName").value.trim(),
    sku: $("invProdFormSku").value.trim(),
    description: $("invProdFormDescription").value.trim(),
    costPrice: $("invProdFormCost").value ? Number($("invProdFormCost").value) : null,
    sellingPrice: Number($("invProdFormPrice").value),
    currency: $("invProdFormCurrency").value,
    taxable: $("invProdFormTaxEnabled").checked,
    taxRate: Number($("invProdFormTaxRate").value) || 0,
    inventoryTracking: $("invProdFormInventoryTracking").checked,
    lowStockThreshold: Number($("invProdFormThreshold").value) || 0,
    // NOTE: stock is deliberately NOT included here -- see handleSaveProduct.
    // It's set once at creation time from the Initial Stock field, and
    // never touched again by this form on edit; all later changes must
    // go through Add Stock / Adjust Stock so a movement record exists.
  };
}

function openProductModal(product) {
  $("invProductModalTitle").textContent = product ? "Edit Product" : "Add Product";
  $("invProductEditId").value = product ? product.id : "";
  $("invProdFormName").value = product ? product.name || "" : "";
  $("invProdFormSku").value = product ? product.sku || "" : "";
  $("invProdFormDescription").value = product ? product.description || "" : "";
  $("invProdFormCost").value = product && product.costPrice != null ? product.costPrice : "";
  $("invProdFormPrice").value = product ? product.sellingPrice || "" : "";
  $("invProdFormCurrency").value = product ? product.currency || "USD" : (businessProfile ? businessProfile.defaultCurrency || "USD" : "USD");
  $("invProdFormTaxEnabled").checked = product ? !!product.taxable : false;
  $("invProdFormTaxRate").value = product ? product.taxRate || 0 : 0;
  $("invProdFormTaxRate").disabled = !(product && product.taxable);

  // Stock is only ever set from this form when CREATING a product.
  // Editing an existing product must never silently overwrite its live
  // stock -- that has to go through Add/Adjust Stock so a movement
  // record is created. The field is hidden entirely when editing, with
  // the current value shown as read-only context instead.
  if (product) {
    $("invProdFormQtyLabel").parentElement.style.display = "none";
    $("invProdCurrentStockNote").textContent = `Current stock: ${product.stock != null ? product.stock : 0} — use Adjust Stock in the Inventory tab to change it.`;
    show("invProdCurrentStockNote");
  } else {
    $("invProdFormQtyLabel").parentElement.style.display = "";
    $("invProdFormQty").value = 0;
    hide("invProdCurrentStockNote");
  }

  $("invProdFormInventoryTracking").checked = product ? !!product.inventoryTracking : false;
  $("invProdFormThreshold").value = product ? product.lowStockThreshold || 0 : 0;
  $("invProdFormThresholdWrap").style.display = $("invProdFormInventoryTracking").checked ? "" : "none";

  setError("invProdFormError", "");
  $("invProductModal").classList.add("show");
}

async function handleSaveProduct() {
  const btn = $("invProdFormSaveBtn");
  const data = readProductFormData();
  const editId = $("invProductEditId").value;
  const initialStock = Number($("invProdFormQty").value) || 0;
  setError("invProdFormError", "");

  if (!isNonEmpty(data.name)) { setError("invProdFormError", "Product name is required."); return; }
  if (!isValidPrice(data.sellingPrice)) { setError("invProdFormError", "Enter a valid selling price."); return; }
  if (!editId && !isValidQty(initialStock)) { setError("invProdFormError", "Quantity cannot be negative."); return; }
  if (data.inventoryTracking && !isValidQty(data.lowStockThreshold)) { setError("invProdFormError", "Low-stock threshold cannot be negative."); return; }
  if (!getDb() || !currentBusinessId) { setError("invProdFormError", NOT_CONFIGURED_MESSAGE); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    if (editId) {
      // Stock is intentionally absent from `data` and never written here.
      await fns.updateDoc(fns.doc(db, "businesses", currentBusinessId, "products", editId), data);
    } else {
      const productRef = fns.doc(fns.collection(db, "businesses", currentBusinessId, "products"));
      const batch = fns.writeBatch(db);
      batch.set(productRef, { ...data, stock: initialStock, createdAt: fns.serverTimestamp() });
      if (data.inventoryTracking && initialStock > 0) {
        const movementRef = fns.doc(fns.collection(db, "businesses", currentBusinessId, "inventoryMovements"));
        batch.set(movementRef, {
          productId: productRef.id, productName: data.name,
          type: "Opening Stock", quantityChange: initialStock,
          previousQuantity: 0, newQuantity: initialStock,
          reason: "Initial stock", relatedInvoiceId: null,
          performedByUid: currentUser ? currentUser.uid : null,
          createdAt: fns.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    $("invProductModal").classList.remove("show");
    await refreshProducts();
  } catch (err) {
    console.error("[invoice-business] save product failed:", err);
    setError("invProdFormError", "Could not save right now. Please try again.");
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

async function handleDeleteProduct(productId) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    await fns.deleteDoc(fns.doc(db, "businesses", currentBusinessId, "products", productId));
    await refreshProducts();
  } catch (err) {
    console.error("[invoice-business] delete product failed:", err);
    setError("invProductsError", "Could not delete right now. Please try again.");
  }
}

/* ==================================================================
   Adjust Stock (Phase 5) -- covers both "Add Stock" (a positive
   change, e.g. a new purchase) and "Stock Adjustment" (positive or
   negative, e.g. damage/loss/correction) with one form, since both are
   the same underlying operation: a signed quantity change with a
   reason, recorded as a movement.
   ================================================================== */

function openStockAdjustModal(product) {
  $("invStockAdjustProductId").value = product.id;
  $("invStockAdjustTitle").textContent = "Adjust Stock — " + product.name;
  const currentStock = product.stock != null ? product.stock : 0;
  $("invStockAdjustCurrent").textContent = `Current stock: ${currentStock}`;
  $("invStockAdjustAmount").value = "";
  $("invStockAdjustReason").value = "New purchase";
  $("invStockAdjustPreview").textContent = "";
  setError("invStockAdjustError", "");
  $("invStockAdjustModal").classList.add("show");
}

function updateStockAdjustPreview() {
  const productId = $("invStockAdjustProductId").value;
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const currentStock = product.stock != null ? product.stock : 0;
  const change = Number($("invStockAdjustAmount").value);
  if ($("invStockAdjustAmount").value === "" || Number.isNaN(change)) {
    $("invStockAdjustPreview").textContent = "";
    return;
  }
  const newStock = currentStock + change;
  $("invStockAdjustPreview").textContent = newStock < 0
    ? `New stock would be ${newStock} -- stock cannot go below 0.`
    : `New stock: ${newStock}`;
}

async function handleSaveStockAdjustment() {
  const btn = $("invStockAdjustSaveBtn");
  const productId = $("invStockAdjustProductId").value;
  const change = Number($("invStockAdjustAmount").value);
  const reason = $("invStockAdjustReason").value;
  setError("invStockAdjustError", "");

  if ($("invStockAdjustAmount").value === "" || Number.isNaN(change) || change === 0) {
    setError("invStockAdjustError", "Enter a non-zero quantity change."); return;
  }
  if (!getDb() || !currentBusinessId) { setError("invStockAdjustError", NOT_CONFIGURED_MESSAGE); return; }

  const originalText = btn.textContent;
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const db = getDb();
    const fns = await loadFirestoreFns();
    const productRef = fns.doc(db, "businesses", currentBusinessId, "products", productId);

    await fns.runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error("Product no longer exists.");
      const product = snap.data();
      const prevStock = product.stock != null ? product.stock : 0;
      const newStock = prevStock + change;
      if (newStock < 0) {
        throw new Error(`INSUFFICIENT_STOCK_ADJUST:${prevStock}:${change}`);
      }
      tx.update(productRef, { stock: newStock });
      const movementRef = fns.doc(fns.collection(db, "businesses", currentBusinessId, "inventoryMovements"));
      tx.set(movementRef, {
        productId, productName: product.name,
        type: change > 0 ? "Stock Added" : "Adjustment",
        quantityChange: change,
        previousQuantity: prevStock, newQuantity: newStock,
        reason, relatedInvoiceId: null,
        performedByUid: currentUser ? currentUser.uid : null,
        createdAt: fns.serverTimestamp(),
      });
    });

    $("invStockAdjustModal").classList.remove("show");
    await refreshProducts();
  } catch (err) {
    if (err && err.message && err.message.startsWith("INSUFFICIENT_STOCK_ADJUST:")) {
      const [, current, requested] = err.message.split(":");
      setError("invStockAdjustError", `That would take stock below 0 (current: ${current}, change: ${requested}).`);
    } else {
      console.error("[invoice-business] stock adjustment failed:", err);
      setError("invStockAdjustError", "Could not save right now. Please try again.");
    }
  } finally {
    btn.disabled = false; btn.textContent = originalText;
  }
}

function stockStatusBadge(p) {
  if (!p.inventoryTracking) return "";
  const stock = p.stock != null ? p.stock : 0;
  const threshold = p.lowStockThreshold || 0;
  if (stock <= 0) return ` · <span style="color:#dc2626;font-weight:700;">Out of Stock</span>`;
  if (stock <= threshold) return ` · <span style="color:#d97706;font-weight:700;">Low Stock</span>`;
  return ` · <span style="color:var(--ok);">In Stock</span>`;
}

function renderProductsList(filterText) {
  const list = $("invProductsList");
  const term = (filterText || "").trim().toLowerCase();
  const filtered = term
    ? products.filter(p => (p.name||"").toLowerCase().includes(term) || (p.sku||"").toLowerCase().includes(term))
    : products;

  if (filtered.length === 0) {
    list.innerHTML = `<p class="editor-hint">${products.length === 0 ? "No products yet. Add your first one above." : "No products match your search."}</p>`;
    return;
  }
  list.innerHTML = filtered.map(p => `
    <div class="inv-record-row" data-id="${p.id}">
      <div class="inv-record-main">
        <div class="inv-record-name">${escapeHtml(p.name)}</div>
        <div class="inv-record-sub">${escapeHtml(p.currency||"USD")} ${Number(p.sellingPrice||0).toFixed(2)}${p.sku ? " · SKU: " + escapeHtml(p.sku) : ""}${p.inventoryTracking ? " · Stock: " + (p.stock!=null?p.stock:0) : ""}${stockStatusBadge(p)}</div>
      </div>
      <div class="inv-record-actions">
        ${p.inventoryTracking ? `<button type="button" class="btn btn-ghost inv-record-adjust-stock" data-id="${p.id}">Adjust Stock</button>` : ""}
        <button type="button" class="btn btn-ghost inv-record-edit" data-id="${p.id}">Edit</button>
        <button type="button" class="btn btn-ghost inv-record-delete" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join("");
}

async function refreshProducts() {
  if (!currentBusinessId) return;
  try {
    products = await listProducts(currentBusinessId);
    renderProductsList($("invProductSearch").value);
  } catch (err) {
    console.error("[invoice-business] load products failed:", err);
    setError("invProductsError", "Could not load products right now.");
  }
}

async function refreshCustomersAndProducts() {
  await Promise.all([refreshCustomers(), refreshProducts()]);
}

function matchesStockFilter(p, filter) {
  if (!p.inventoryTracking) return filter === "all";
  const stock = p.stock != null ? p.stock : 0;
  const threshold = p.lowStockThreshold || 0;
  if (filter === "all") return true;
  if (filter === "out") return stock <= 0;
  if (filter === "low") return stock > 0 && stock <= threshold;
  if (filter === "in") return stock > threshold;
  return true;
}

function renderInventoryList() {
  const list = $("invInventoryList");
  const trackedProducts = products.filter(p => p.inventoryTracking);
  const filtered = trackedProducts.filter(p => matchesStockFilter(p, currentStockFilter));

  if (trackedProducts.length === 0) {
    $("invInventoryEmptyNote").textContent = "No products have inventory tracking enabled yet. Turn on \"Track inventory\" when adding or editing a product.";
    list.innerHTML = "";
    return;
  }
  $("invInventoryEmptyNote").textContent = filtered.length === 0 ? "No products match this filter." : "";
  list.innerHTML = filtered.map(p => `
    <div class="inv-record-row">
      <div class="inv-record-main">
        <div class="inv-record-name">${escapeHtml(p.name)}${p.sku ? " · SKU: " + escapeHtml(p.sku) : ""}</div>
        <div class="inv-record-sub">Stock: ${p.stock != null ? p.stock : 0} · ${escapeHtml(p.currency||"USD")} ${Number(p.sellingPrice||0).toFixed(2)}${stockStatusBadge(p)}</div>
      </div>
    </div>
  `).join("");
}

async function loadMovements(businessId) {
  const db = getDb();
  const fns = await loadFirestoreFns();
  const snap = await fns.getDocs(fns.collection(db, "businesses", businessId, "inventoryMovements"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderMovementsList() {
  const list = $("invMovementsList");
  if (movements.length === 0) {
    list.innerHTML = `<p class="editor-hint">No stock movements yet.</p>`;
    return;
  }
  const sorted = movements.slice().sort((a, b) => (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0)).slice(0, 30);
  list.innerHTML = sorted.map(m => `
    <div class="inv-record-row">
      <div class="inv-record-main">
        <div class="inv-record-name">${escapeHtml(m.productName || "Unknown product")} — ${escapeHtml(m.type)}</div>
        <div class="inv-record-sub">${m.quantityChange > 0 ? "+" : ""}${m.quantityChange} (${m.previousQuantity} → ${m.newQuantity}) · ${escapeHtml(m.reason || "")}${m.relatedInvoiceId ? " · Invoice-linked" : ""}</div>
      </div>
    </div>
  `).join("");
}

async function refreshInventoryTab(businessId) {
  if (!businessId) return;
  try {
    movements = await loadMovements(businessId);
    renderInventoryList();
    renderMovementsList();
  } catch (err) {
    console.error("[invoice-business] load inventory/movements failed:", err);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ==================================================================
   Bridge for js/invoice.js (a regular, non-module script -- it can't
   `import` this file directly, so these are exposed as plain globals,
   the same bridging technique invoice.js already uses for other
   cross-file needs). invoice.js's own guest-mode logic is untouched;
   these are purely additive, optional lookups it may call.
   ================================================================== */
window.toolflightInvoiceBusiness = {
  getCustomers: () => customers.slice(),
  getProducts: () => products.slice(),
  getBusinessProfile: () => businessProfile,
  getBusinessId: () => currentBusinessId,
  refreshAfterJoiningBusiness: async (businessId) => {
    currentBusinessId = businessId;
    businessProfile = await loadBusinessProfile(businessId);
    await refreshCustomersAndProducts();
    showBusinessArea();
    switchBusinessTab("dashboard");
  },
};

/* ==================================================================
   Tab + navigation wiring
   ================================================================== */
function switchBusinessTab(tab) {
  document.querySelectorAll(".inv-business-tab[data-tab]").forEach(btn => {
    btn.classList.toggle("inv-business-tab--active", btn.dataset.tab === tab);
  });
  hide("invTabDashboard"); hide("invTabProfile"); hide("invTabCustomers"); hide("invTabProducts");
  hide("invTabInvoices"); hide("invTabInventory"); hide("invTabTeam"); hide("invTabSuppliers"); hide("invTabReports");
  show("invTab" + tab.charAt(0).toUpperCase() + tab.slice(1));
  closeProfileMenu();
  if (tab === "inventory") refreshInventoryTab(currentBusinessId);
  if (tab === "dashboard") renderDashboard();
}

function showBusinessArea() {
  hide("invModeSelect"); hide("invSetupPrompt"); hide("invGuestBuilder"); hide("invBusinessLookupError"); hide("invAccountBar");
  show("invBusinessArea");
  if (businessProfile) fillBusinessForm(businessProfile);
  updateShellProfileHeader();
}

function updateShellProfileHeader() {
  const nameEl = $("invShellProfileName");
  const bizEl = $("invShellProfileBiz");
  const avatarEl = $("invShellProfileAvatar");
  if (!nameEl || !bizEl || !avatarEl) return; // defensive -- these only exist inside invBusinessArea
  const displayName = (currentUser && currentUser.email) ? currentUser.email : "Account";
  const bizName = (businessProfile && businessProfile.name) ? businessProfile.name : "My Business";
  nameEl.textContent = displayName;
  bizEl.textContent = bizName;
  avatarEl.textContent = displayName.charAt(0).toUpperCase();
}

function closeProfileMenu() {
  const menu = $("invShellProfileMenu");
  if (menu) menu.classList.add("hidden");
}

/* ==================================================================
   Dashboard (Phase 2) -- overview built ONLY from data already loaded
   elsewhere (customers/products in this module, invoices via the
   invoice-history.js bridge). No invented numbers, no status field
   that doesn't exist in the real invoice data shape.
   ================================================================== */
async function renderDashboard() {
  const displayName = (currentUser && currentUser.email) ? currentUser.email.split("@")[0] : "there";
  $("invDashGreeting").textContent = "Welcome back, " + displayName;
  $("invDashGreetingSub").textContent = (businessProfile && businessProfile.name)
    ? "Here's what's happening with " + businessProfile.name + "."
    : "Here's what's happening with your business.";

  $("invDashStatCustomers").textContent = String(customers.length);
  $("invDashStatProducts").textContent = String(products.length);

  // Low stock -- reuses the exact same fields/logic as the Inventory tab.
  const lowStockProducts = products.filter(p => {
    if (!p.inventoryTracking) return false;
    const stock = p.stock != null ? p.stock : 0;
    const threshold = p.lowStockThreshold || 0;
    return stock <= threshold;
  }).slice(0, 5);
  const lowStockEl = $("invDashLowStock");
  lowStockEl.innerHTML = lowStockProducts.length === 0
    ? `<p class="inv-dash-empty">No low-stock products right now.</p>`
    : lowStockProducts.map(p => `
        <div class="inv-record-row">
          <div class="inv-record-main">
            <div class="inv-record-name">${escapeHtml(p.name || "")}</div>
            <div class="inv-record-sub">Stock: ${p.stock != null ? p.stock : 0}${p.sku ? " · SKU: " + escapeHtml(p.sku) : ""}</div>
          </div>
        </div>`).join("");

  // Invoices -- loaded lazily via invoice-history.js's bridge (same lazy
  // pattern the Invoices tab itself already uses; the Dashboard just
  // triggers the same refresh instead of duplicating the Firestore call).
  if (window.toolflightInvoiceHistory && currentBusinessId) {
    try {
      await window.toolflightInvoiceHistory.refreshInvoices(currentBusinessId);
    } catch (err) {
      console.error("[invoice-business] dashboard: could not refresh invoices:", err);
    }
    const invoices = window.toolflightInvoiceHistory.getInvoices();
    $("invDashStatInvoices").textContent = String(invoices.length);

    const totalSales = invoices.reduce((sum, inv) => sum + Number((inv.totals && inv.totals.total) || 0), 0);
    const currency = (businessProfile && businessProfile.defaultCurrency) ||
      (invoices[0] && invoices[0].meta && invoices[0].meta.currency) || "USD";
    $("invDashStatSales").textContent = window.toolflightInvoiceHistory.formatMoney(totalSales, currency);

    const recent = invoices.slice().sort((a, b) => {
      const at = (a.createdAt && a.createdAt.seconds) || 0;
      const bt = (b.createdAt && b.createdAt.seconds) || 0;
      return bt - at;
    }).slice(0, 5);
    const recentEl = $("invDashRecentInvoices");
    recentEl.innerHTML = recent.length === 0
      ? `<p class="inv-dash-empty">No invoices yet. Create your first one from Quick Actions.</p>`
      : recent.map(inv => {
          const number = escapeHtml((inv.meta && inv.meta.number) || "(no number)");
          const date = escapeHtml((inv.meta && inv.meta.date) || "");
          const customerName = escapeHtml((inv.customer && inv.customer.name) || "(no customer)");
          const total = window.toolflightInvoiceHistory.formatMoney(inv.totals && inv.totals.total, inv.meta && inv.meta.currency);
          return `
            <div class="inv-record-row">
              <div class="inv-record-main">
                <div class="inv-record-name">${number} — ${customerName}</div>
                <div class="inv-record-sub">${date} · ${total}</div>
              </div>
            </div>`;
        }).join("");
  } else {
    $("invDashStatInvoices").textContent = "—";
    $("invDashStatSales").textContent = "—";
    $("invDashRecentInvoices").innerHTML = `<p class="inv-dash-empty">Invoices unavailable right now.</p>`;
  }
}

async function openMyBusiness() {
  if (!currentUser) {
    // Not signed in -- My Business shouldn't be reachable in that state
    // since invAccountBar (which contains the button) is itself hidden
    // until sign-in, but guard here too rather than assume.
    return;
  }
  if (!currentBusinessId) {
    hide("invModeSelect"); hide("invGuestBuilder"); hide("invBusinessArea"); hide("invBusinessLookupError");
    show("invSetupPrompt");
    return;
  }
  showBusinessArea();
  switchBusinessTab("dashboard");
}

function initBusinessUI() {
  $("invMyBusinessBtn").addEventListener("click", openMyBusiness);
  $("invShellHomeBtn").addEventListener("click", () => {
    hide("invBusinessArea");
    show("invModeSelect");
    if (currentUser) show("invAccountBar");
  });

  // Profile/business dropdown -- toggle on the trigger, close on any
  // outside click or Escape, and close automatically whenever a menu
  // item is chosen (the item's own click handler, e.g. switchBusinessTab
  // or logout, runs first via event bubbling before this listener).
  $("invShellProfileTrigger").addEventListener("click", (e) => {
    e.stopPropagation();
    $("invShellProfileMenu").classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    const menu = $("invShellProfileMenu");
    if (!menu || menu.classList.contains("hidden")) return;
    if (!menu.contains(e.target) && e.target !== $("invShellProfileTrigger")) closeProfileMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProfileMenu();
  });
  $("invShellLogoutBtn").addEventListener("click", () => {
    closeProfileMenu();
    $("invSignOutBtn").click();
  });
  $("invDashNewInvoiceBtn").addEventListener("click", () => $("invCreateInvoiceBtn").click());

  $("invStartSetupBtn").addEventListener("click", () => {
    hide("invSetupPrompt");
    show("invBusinessArea");
    switchBusinessTab("profile");
  });
  $("invSkipSetupLink").addEventListener("click", (e) => {
    e.preventDefault();
    hide("invSetupPrompt");
    show("invGuestBuilder");
    // Deliberately does NOT force account creation or business setup --
    // an authenticated user can still use the guest-style invoice builder
    // manually, matching "do not make the user feel trapped."
  });

  document.querySelectorAll(".inv-business-tab[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => switchBusinessTab(btn.dataset.tab));
  });

  document.querySelectorAll(".inv-business-tab[data-stock-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentStockFilter = btn.dataset.stockFilter;
      document.querySelectorAll(".inv-business-tab[data-stock-filter]").forEach(b => {
        b.classList.toggle("inv-business-tab--active", b === btn);
      });
      renderInventoryList();
    });
  });

  $("invSetBizCurrency").addEventListener("change", (e) => {
    $("invSetBizCurrencyOtherWrap").style.display = e.target.value === "OTHER" ? "" : "none";
  });
  $("invSetTaxEnabled").addEventListener("change", (e) => {
    $("invSetTaxRate").disabled = !e.target.checked;
  });
  $("invBizSetupSaveBtn").addEventListener("click", handleSaveBusinessProfile);

  $("invAddCustomerBtn").addEventListener("click", () => openCustomerModal(null));
  $("invCustFormSaveBtn").addEventListener("click", handleSaveCustomer);
  $("invCustomerSearch").addEventListener("input", (e) => renderCustomersList(e.target.value));
  $("invCustomersList").addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("inv-record-edit")) openCustomerModal(customers.find(c => c.id === id));
    else if (e.target.classList.contains("inv-record-delete")) handleDeleteCustomer(id);
  });

  $("invAddProductBtn").addEventListener("click", () => openProductModal(null));
  $("invProdFormTaxEnabled").addEventListener("change", (e) => { $("invProdFormTaxRate").disabled = !e.target.checked; });
  $("invProdFormInventoryTracking").addEventListener("change", (e) => { $("invProdFormThresholdWrap").style.display = e.target.checked ? "" : "none"; });
  $("invProdFormSaveBtn").addEventListener("click", handleSaveProduct);
  $("invProductSearch").addEventListener("input", (e) => renderProductsList(e.target.value));
  $("invProductsList").addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains("inv-record-edit")) openProductModal(products.find(p => p.id === id));
    else if (e.target.classList.contains("inv-record-delete")) handleDeleteProduct(id);
    else if (e.target.classList.contains("inv-record-adjust-stock")) openStockAdjustModal(products.find(p => p.id === id));
  });

  $("invStockAdjustAmount").addEventListener("input", updateStockAdjustPreview);
  $("invStockAdjustSaveBtn").addEventListener("click", handleSaveStockAdjustment);

  let lastProcessedUid = null;

  async function resolveBusinessForUser(user) {
    try {
      const businessId = await findBusinessForUser(user.uid);
      if (businessId) {
        currentBusinessId = businessId;
        try {
          businessProfile = await loadBusinessProfile(businessId);
        } catch (err) {
          err.diagnosticStep = "loading the business profile document (businessId=" + businessId + ")";
          throw err;
        }
        try {
          await refreshCustomersAndProducts();
        } catch (err) {
          err.diagnosticStep = "loading customers/products for this business";
          throw err;
        }
      } else {
        currentBusinessId = null; businessProfile = null;
        // Proactively invite a fresh account holder to set up their
        // business -- but only if they're not already mid-way through
        // the guest invoice builder, so signing in never interrupts
        // someone actively typing an invoice.
        const guestBuilderActive = !$("invGuestBuilder").classList.contains("hidden");
        if (!guestBuilderActive) {
          hide("invModeSelect");
          hide("invBusinessLookupError");
          show("invSetupPrompt");
        }
      }
    } catch (err) {
      // Issue 2 fix: a failed lookup must never look identical to
      // "confirmed no business exists" -- that ambiguity is exactly
      // what let a real device/browser-switch lookup failure silently
      // masquerade as a fresh account, risking a duplicate business.
      // This is a distinct, honest error state with the exact reason
      // and a real way to retry, not a silent console-only failure.
      console.error("[invoice-business] loading business for signed-in user failed:", err);
      hide("invModeSelect"); hide("invGuestBuilder"); hide("invSetupPrompt"); hide("invBusinessArea");
      const stepText = err && err.diagnosticStep ? " (during: " + err.diagnosticStep + ")" : "";
      const uidText = user && user.uid ? " [Signed in UID: " + user.uid + "]" : "";
      $("invBusinessLookupErrorText").textContent = "Error: " + (err && err.message ? err.message : "unknown error") + stepText + uidText;
      show("invBusinessLookupError");
    }
  }

  $("invBusinessLookupRetryBtn").addEventListener("click", () => {
    if (currentUser) resolveBusinessForUser(currentUser);
  });

  onAuthChange(async (user) => {
    const isSameUserReFire = user && lastProcessedUid === user.uid && currentBusinessId;
    currentUser = user;
    if (!user) {
      lastProcessedUid = null;
      currentBusinessId = null; businessProfile = null; customers = []; products = [];
      // Sign-out bug fix: clearing the in-memory state above was never
      // enough on its own -- if the person was inside My Business (or
      // any protected screen) at the moment they signed out, the DOM
      // itself stayed exactly as it was, showing stale business data to
      // whoever uses the browser next. Every protected screen is hidden
      // explicitly here, and the app returns to the exact same guest
      // state (invModeSelect) a brand-new visitor sees -- immediately,
      // with no refresh required.
      hide("invBusinessArea");
      hide("invSetupPrompt");
      hide("invBusinessLookupError");
      hide("invGuestBuilder");
      show("invModeSelect");
      return;
    }
    if (isSameUserReFire) {
      // onAuthStateChanged can fire again for the SAME signed-in user
      // (token refresh, re-authentication) without any real sign-in/out
      // having happened. Re-deriving currentBusinessId from a fresh
      // Firestore lookup on every one of these re-fires is fragile --
      // any transient failure there would silently overwrite an
      // already-correct value, making the UI think no business exists
      // and the next save create a duplicate. A business already
      // resolved for this exact user in this session is trusted as-is.
      return;
    }
    lastProcessedUid = user.uid;
    await resolveBusinessForUser(user);
  });
}

if (document.getElementById("invBusinessArea")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBusinessUI);
  } else {
    initBusinessUI();
  }
}
