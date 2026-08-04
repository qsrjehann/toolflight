/* ToolFlight Invoice Maker — Phase 1 (Guest mode only)
   ------------------------------------------------------
   Isolated on purpose: this file owns nothing outside the
   invoice-maker.html page. It does not read or write any global
   variable, DOM id, or CSS class used by any other ToolFlight tool,
   so it cannot break existing functionality by construction, not
   just by convention.

   Architecture note for Phase 2+: everything here operates on a single
   plain-object `invoiceState`. When account mode is built, the same
   state shape and the same calculateTotals()/renderPreview() functions
   should be reusable as-is — only where the state is loaded from
   (localStorage today, Firestore later) and where it's saved to should
   need to change. */

if (document.getElementById('invModeSelect')) {

  const CURRENCIES = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'CA$',
    AUD: 'A$', JPY: '¥', AED: 'AED ', PKR: 'Rs '
  };

  let invoiceState = {
    business: { name: '', email: '', address: '', phone: '' },
    customer: { name: '', email: '', address: '' },
    meta: { number: '', date: '', dueDate: '', currency: 'USD', currencySymbol: null },
    items: [ { description: '', qty: 1, price: 0, productId: null } ],
    tax: { enabled: false, rate: 0 },
    discount: { type: 'percent', value: 0 },
    notes: ''
  };

  /* ---------- Pure calculation, no DOM access -- safe to unit test
     and safe to reuse unchanged when account mode is added later. ---------- */
  function calculateTotals(state) {
    const subtotal = state.items.reduce((sum, item) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      return sum + (qty * price);
    }, 0);

    let discountAmount = 0;
    const discountValue = Number(state.discount.value) || 0;
    if (state.discount.type === 'percent') {
      discountAmount = subtotal * (discountValue / 100);
    } else {
      discountAmount = discountValue;
    }
    discountAmount = Math.min(discountAmount, subtotal); // never let discount push the total negative

    const afterDiscount = subtotal - discountAmount;
    const taxRate = state.tax.enabled ? (Number(state.tax.rate) || 0) : 0;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  }

  function formatMoney(amount, currencyCode) {
    // Custom currency symbol only applies when this call is genuinely
    // about the current invoice's own currency (not, say, a saved
    // product's unrelated currency shown in a dropdown option) --
    // scoped this precisely rather than a blanket override.
    const symbol = (currencyCode === invoiceState.meta.currency && invoiceState.meta.currencySymbol)
      ? invoiceState.meta.currencySymbol
      : (CURRENCIES[currencyCode] || (currencyCode ? currencyCode + ' ' : ''));
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
    return symbol + rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ---------- Rendering ---------- */
  function productOptionsHtml(selectedProductId) {
    if (!window.toolflightInvoiceBusiness) return '';
    const products = window.toolflightInvoiceBusiness.getProducts ? window.toolflightInvoiceBusiness.getProducts() : [];
    if (!products.length) return '';
    const options = products.map(p =>
      `<option value="${p.id}"${p.id === selectedProductId ? ' selected' : ''}>${escapeHtml(p.name)} (${formatMoney(p.sellingPrice||0, p.currency||'USD')})</option>`
    ).join('');
    return `<option value="">— Type manually —</option>${options}`;
  }

  function renderItemsTable() {
    const tbody = document.getElementById('invItemsBody');
    tbody.innerHTML = '';
    invoiceState.items.forEach((item, i) => {
      const tr = document.createElement('tr');
      const productOptions = productOptionsHtml(item.productId);
      tr.innerHTML = `
        <td>
          ${productOptions ? `<select class="inv-item-product-select" data-idx="${i}" style="margin-bottom:4px;width:100%;">${productOptions}</select>` : ''}
          <input type="text" class="inv-item-desc" data-idx="${i}" placeholder="Item or service" value="${escapeHtml(item.description)}">
        </td>
        <td><input type="number" class="inv-item-qty" data-idx="${i}" min="0" step="1" value="${item.qty}"></td>
        <td><input type="number" class="inv-item-price" data-idx="${i}" min="0" step="0.01" value="${item.price}"></td>
        <td class="inv-item-total">${formatMoney((Number(item.qty)||0) * (Number(item.price)||0), invoiceState.meta.currency)}</td>
        <td><button type="button" class="inv-item-remove" data-idx="${i}" aria-label="Remove line item">&times;</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPreview() {
    const totals = calculateTotals(invoiceState);
    const cur = invoiceState.meta.currency;
    const b = invoiceState.business, c = invoiceState.customer, m = invoiceState.meta;

    const itemRows = invoiceState.items.map(item => `
      <tr>
        <td>${escapeHtml(item.description) || '<span style="color:var(--ink-soft);">—</span>'}</td>
        <td style="text-align:center;">${Number(item.qty)||0}</td>
        <td style="text-align:right;">${formatMoney(Number(item.price)||0, cur)}</td>
        <td style="text-align:right;">${formatMoney((Number(item.qty)||0)*(Number(item.price)||0), cur)}</td>
      </tr>
    `).join('');

    document.getElementById('invPreviewSheet').innerHTML = `
      <div class="inv-preview-header">
        <div>
          ${b.logoUrl ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name) || 'Business logo'}" class="inv-preview-logo">` : ''}
          <div class="inv-preview-biz-name">${escapeHtml(b.name) || 'Your Business Name'}</div>
          ${b.address ? `<div class="inv-preview-muted">${escapeHtml(b.address).replace(/\n/g,'<br>')}</div>` : ''}
          ${b.email ? `<div class="inv-preview-muted">${escapeHtml(b.email)}</div>` : ''}
          ${b.phone ? `<div class="inv-preview-muted">${escapeHtml(b.phone)}</div>` : ''}
        </div>
        <div class="inv-preview-title">
          <div class="inv-preview-invoice-label">INVOICE</div>
          ${m.number ? `<div class="inv-preview-muted">#${escapeHtml(m.number)}</div>` : ''}
          ${m.date ? `<div class="inv-preview-muted">Date: ${escapeHtml(m.date)}</div>` : ''}
          ${m.dueDate ? `<div class="inv-preview-muted">Due: ${escapeHtml(m.dueDate)}</div>` : ''}
        </div>
      </div>

      <div class="inv-preview-billto">
        <div class="inv-preview-label">Bill To</div>
        <div class="inv-preview-biz-name" style="font-size:14px;">${escapeHtml(c.name) || '<span style="color:var(--ink-soft);">Customer name</span>'}</div>
        ${c.address ? `<div class="inv-preview-muted">${escapeHtml(c.address).replace(/\n/g,'<br>')}</div>` : ''}
        ${c.email ? `<div class="inv-preview-muted">${escapeHtml(c.email)}</div>` : ''}
      </div>

      <table class="inv-preview-table">
        <thead><tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="inv-preview-totals">
        <div class="inv-preview-totals-row"><span>Subtotal</span><span>${formatMoney(totals.subtotal, cur)}</span></div>
        ${totals.discountAmount > 0 ? `<div class="inv-preview-totals-row"><span>Discount</span><span>-${formatMoney(totals.discountAmount, cur)}</span></div>` : ''}
        ${invoiceState.tax.enabled ? `<div class="inv-preview-totals-row"><span>Tax (${Number(invoiceState.tax.rate)||0}%)</span><span>${formatMoney(totals.taxAmount, cur)}</span></div>` : ''}
        <div class="inv-preview-totals-row inv-preview-totals-final"><span>Total</span><span>${formatMoney(totals.total, cur)}</span></div>
      </div>

      ${invoiceState.notes ? `<div class="inv-preview-notes"><div class="inv-preview-label">Notes</div><div class="inv-preview-muted">${escapeHtml(invoiceState.notes).replace(/\n/g,'<br>')}</div></div>` : ''}
    `;
  }

  function renderAll() {
    renderItemsTable();
    renderPreview();
  }

  /* ---------- Event wiring ---------- */
  function bindField(id, path) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const keys = path.split('.');
      let target = invoiceState;
      for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
      target[keys[keys.length - 1]] = el.type === 'checkbox' ? el.checked : el.value;
      renderAll();
    });
  }

  function initFieldBindings() {
    bindField('invBizName', 'business.name');
    bindField('invBizEmail', 'business.email');
    bindField('invBizAddress', 'business.address');
    bindField('invBizPhone', 'business.phone');
    bindField('invCustName', 'customer.name');
    bindField('invCustEmail', 'customer.email');
    bindField('invCustAddress', 'customer.address');
    bindField('invNumber', 'meta.number');
    bindField('invDate', 'meta.date');
    bindField('invDueDate', 'meta.dueDate');
    bindField('invCurrency', 'meta.currency');
    document.getElementById('invCurrency').addEventListener('change', (e) => {
      const isCustom = e.target.value === 'CUSTOM';
      document.getElementById('invCustomCurrencyWrap').style.display = isCustom ? '' : 'none';
      if (isCustom) {
        // meta.currency was just set to the literal string "CUSTOM" by
        // bindField above -- replace it with whatever code the user has
        // already typed (or leave blank for them to fill in), and use
        // the code field as the actual state going forward.
        invoiceState.meta.currency = document.getElementById('invCustomCurrencyCode').value.trim().toUpperCase() || '';
      } else {
        // Switching back to a standard currency -- clear any leftover
        // custom symbol so it can't accidentally linger and get applied
        // to a currency code that coincidentally matches later.
        invoiceState.meta.currencySymbol = null;
      }
      renderAll();
    });
    document.getElementById('invCustomCurrencyCode').addEventListener('input', (e) => {
      invoiceState.meta.currency = e.target.value.trim().toUpperCase();
      renderAll();
    });
    document.getElementById('invCustomCurrencySymbol').addEventListener('input', (e) => {
      invoiceState.meta.currencySymbol = e.target.value;
      renderAll();
    });
    bindField('invDiscountType', 'discount.type');
    bindField('invDiscountValue', 'discount.value');
    bindField('invNotes', 'notes');

    document.getElementById('invTaxEnabled').addEventListener('change', (e) => {
      invoiceState.tax.enabled = e.target.checked;
      document.getElementById('invTaxRate').disabled = !e.target.checked;
      renderAll();
    });
    document.getElementById('invTaxRate').addEventListener('input', (e) => {
      invoiceState.tax.rate = e.target.value;
      renderAll();
    });

    document.getElementById('invItemsBody').addEventListener('input', (e) => {
      const idx = +e.target.dataset.idx;
      if (Number.isNaN(idx)) return;
      if (e.target.classList.contains('inv-item-desc')) invoiceState.items[idx].description = e.target.value;
      else if (e.target.classList.contains('inv-item-qty')) invoiceState.items[idx].qty = e.target.value;
      else if (e.target.classList.contains('inv-item-price')) invoiceState.items[idx].price = e.target.value;
      renderPreview();
      // Only re-render this row's own total cell, not the whole table --
      // rebuilding every <input> on every keystroke would steal focus
      // from whichever field the user is actively typing in.
      const row = e.target.closest('tr');
      const totalCell = row.querySelector('.inv-item-total');
      const item = invoiceState.items[idx];
      totalCell.textContent = formatMoney((Number(item.qty)||0) * (Number(item.price)||0), invoiceState.meta.currency);
    });

    document.getElementById('invItemsBody').addEventListener('change', (e) => {
      if (!e.target.classList.contains('inv-item-product-select')) return;
      const idx = +e.target.dataset.idx;
      if (Number.isNaN(idx)) return;
      const productId = e.target.value || null;
      const item = invoiceState.items[idx];
      if (!productId) {
        // "Type manually" selected -- unlink without clearing whatever
        // text the user may already have typed.
        item.productId = null;
        return;
      }
      const products = window.toolflightInvoiceBusiness && window.toolflightInvoiceBusiness.getProducts ? window.toolflightInvoiceBusiness.getProducts() : [];
      const product = products.find(p => p.id === productId);
      if (!product) return;
      item.productId = productId;
      item.description = product.name;
      item.price = product.sellingPrice || 0;
      renderAll();
    });

    document.getElementById('invItemsBody').addEventListener('click', (e) => {
      if (!e.target.classList.contains('inv-item-remove')) return;
      const idx = +e.target.dataset.idx;
      if (invoiceState.items.length <= 1) return; // always keep at least one row
      invoiceState.items.splice(idx, 1);
      renderAll();
    });

    document.getElementById('invAddItemBtn').addEventListener('click', () => {
      invoiceState.items.push({ description: '', qty: 1, price: 0, productId: null });
      renderAll();
    });
  }

  function initModeSelection() {
    document.getElementById('invStartGuestBtn').addEventListener('click', () => {
      document.getElementById('invModeSelect').classList.add('hidden');
      document.getElementById('invGuestBuilder').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    document.getElementById('invBackToModeBtn').addEventListener('click', () => {
      document.getElementById('invGuestBuilder').classList.add('hidden');
      document.getElementById('invModeSelect').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    // "My Business" is intentionally disabled in Phase 1 -- no fake
    // click handler pretending an account system exists yet.
  }

  function initExport() {
    document.getElementById('invPrintBtn').addEventListener('click', () => {
      const printOnly = document.getElementById('invPrintOnly');
      const previewClone = document.getElementById('invPreviewSheet').cloneNode(true);
      printOnly.innerHTML = '';
      printOnly.appendChild(previewClone);
      window.print();
    });

    document.getElementById('invDownloadBtn').addEventListener('click', async () => {
      const btn = document.getElementById('invDownloadBtn');
      const originalText = btn.textContent;
      btn.textContent = 'Generating…';
      btn.disabled = true;
      try {
        await downloadInvoicePdf();
      } catch (err) {
        if (typeof toast === 'function') toast('Could not generate the PDF: ' + err.message, 'err');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  /* Genuine PDF generation via PDFLib, drawing real text (not a
     screenshot) so the exported invoice stays crisp and selectable. */
  async function downloadInvoicePdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const totals = calculateTotals(invoiceState);
    const cur = invoiceState.meta.currency;
    const b = invoiceState.business, c = invoiceState.customer, m = invoiceState.meta;

    const doc = await PDFDocument.create();
    let page = doc.addPage([612, 792]); // US Letter, points
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.1, 0.1, 0.15);
    const soft = rgb(0.45, 0.45, 0.5);

    let y = 740;
    const left = 50, right = 562;

    function drawItemsTableHeader() {
      page.drawText('Description', { x: left, y, size: 9, font: fontBold, color: soft });
      page.drawText('Qty', { x: 380, y, size: 9, font: fontBold, color: soft });
      page.drawText('Price', { x: 440, y, size: 9, font: fontBold, color: soft });
      page.drawText('Total', { x: 510, y, size: 9, font: fontBold, color: soft });
      y -= 16;
    }

    page.drawText('INVOICE', { x: left, y, size: 22, font: fontBold, color: ink });
    if (m.number) page.drawText('#' + m.number, { x: right - font.widthOfTextAtSize('#' + m.number, 11), y: y + 4, size: 11, font, color: soft });
    y -= 34;

    page.drawText(b.name || 'Your Business Name', { x: left, y, size: 13, font: fontBold, color: ink }); y -= 16;
    [b.address, b.email, b.phone].filter(Boolean).forEach(line => {
      String(line).split('\n').forEach(l => { page.drawText(l, { x: left, y, size: 10, font, color: soft }); y -= 13; });
    });

    let yRight = 706;
    [['Date', m.date], ['Due', m.dueDate]].forEach(([label, val]) => {
      if (val) { page.drawText(`${label}: ${val}`, { x: right - font.widthOfTextAtSize(`${label}: ${val}`, 10), y: yRight, size: 10, font, color: soft }); yRight -= 14; }
    });

    y -= 14;
    page.drawText('BILL TO', { x: left, y, size: 9, font: fontBold, color: soft }); y -= 14;
    page.drawText(c.name || 'Customer name', { x: left, y, size: 12, font: fontBold, color: ink }); y -= 15;
    [c.address, c.email].filter(Boolean).forEach(line => {
      String(line).split('\n').forEach(l => { page.drawText(l, { x: left, y, size: 10, font, color: soft }); y -= 13; });
    });

    y -= 16;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0.85,0.85,0.88) });
    y -= 18;
    drawItemsTableHeader();

    invoiceState.items.forEach(item => {
      // A real new page, not just resetting y on the same page (which
      // would silently overwrite earlier rows) -- the table header
      // repeats on the new page so it stays readable mid-list.
      if (y < 100) {
        page = doc.addPage([612, 792]);
        y = 740;
        drawItemsTableHeader();
      }
      const qty = Number(item.qty) || 0, price = Number(item.price) || 0;
      page.drawText((item.description || '—').slice(0, 48), { x: left, y, size: 10, font, color: ink });
      page.drawText(String(qty), { x: 380, y, size: 10, font, color: ink });
      page.drawText(formatMoney(price, cur), { x: 440, y, size: 10, font, color: ink });
      page.drawText(formatMoney(qty*price, cur), { x: 510, y, size: 10, font, color: ink });
      y -= 16;
    });

    y -= 8;
    if (y < 140) { page = doc.addPage([612, 792]); y = 740; }
    page.drawLine({ start: { x: 380, y }, end: { x: right, y }, thickness: 1, color: rgb(0.85,0.85,0.88) });
    y -= 18;

    const totalsRows = [['Subtotal', totals.subtotal]];
    if (totals.discountAmount > 0) totalsRows.push(['Discount', -totals.discountAmount]);
    if (invoiceState.tax.enabled) totalsRows.push([`Tax (${Number(invoiceState.tax.rate)||0}%)`, totals.taxAmount]);
    totalsRows.forEach(([label, val]) => {
      page.drawText(label, { x: 420, y, size: 10, font, color: soft });
      const text = (val < 0 ? '-' : '') + formatMoney(Math.abs(val), cur);
      page.drawText(text, { x: right - font.widthOfTextAtSize(text, 10), y, size: 10, font, color: ink });
      y -= 15;
    });
    page.drawText('Total', { x: 420, y, size: 12, font: fontBold, color: ink });
    const totalText = formatMoney(totals.total, cur);
    page.drawText(totalText, { x: right - fontBold.widthOfTextAtSize(totalText, 12), y, size: 12, font: fontBold, color: ink });

    if (invoiceState.notes) {
      y -= 40;
      page.drawText('Notes', { x: left, y, size: 9, font: fontBold, color: soft }); y -= 14;
      invoiceState.notes.split('\n').forEach(line => { page.drawText(line.slice(0,90), { x: left, y, size: 10, font, color: soft }); y -= 13; });
    }

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (m.number ? m.number : 'invoice') + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    // Sensible default dates so the invoice preview isn't blank on first load.
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('invDate').value = today;
    invoiceState.meta.date = today;

    initModeSelection();
    initFieldBindings();
    initExport();
    renderAll();
  }

  /* ---------- Bridge for js/invoice-history.js (Phase 4) ----------
     invoice-history.js is a module script and can't reach invoiceState
     directly (it's a variable local to this guard block, on purpose --
     nothing outside this file has ever been able to mutate it). Exposed
     here as a small, explicit, read/write API instead of widening
     access more broadly. Existing guest-mode logic above is unchanged. */
  window.toolflightInvoice = {
    getState: () => JSON.parse(JSON.stringify(invoiceState)),
    getTotals: () => calculateTotals(invoiceState),
    loadState: (snapshot) => {
      invoiceState = JSON.parse(JSON.stringify(snapshot));
      // Repopulate every visible form field -- setting invoiceState alone
      // wouldn't touch the DOM, since bindField()'s input listeners only
      // flow form -> state, never the reverse.
      document.getElementById('invBizName').value = invoiceState.business.name || '';
      document.getElementById('invBizEmail').value = invoiceState.business.email || '';
      document.getElementById('invBizAddress').value = invoiceState.business.address || '';
      document.getElementById('invBizPhone').value = invoiceState.business.phone || '';
      document.getElementById('invCustName').value = invoiceState.customer.name || '';
      document.getElementById('invCustEmail').value = invoiceState.customer.email || '';
      document.getElementById('invCustAddress').value = invoiceState.customer.address || '';
      document.getElementById('invNumber').value = invoiceState.meta.number || '';
      document.getElementById('invDate').value = invoiceState.meta.date || '';
      document.getElementById('invDueDate').value = invoiceState.meta.dueDate || '';
      if (invoiceState.meta.currencySymbol) {
        // A custom currency was used on this saved invoice -- the
        // dropdown has no option matching an arbitrary code, so select
        // "Custom Currency" and repopulate the two fields that actually
        // hold the real values.
        document.getElementById('invCurrency').value = 'CUSTOM';
        document.getElementById('invCustomCurrencyWrap').style.display = '';
        document.getElementById('invCustomCurrencyCode').value = invoiceState.meta.currency || '';
        document.getElementById('invCustomCurrencySymbol').value = invoiceState.meta.currencySymbol;
      } else {
        document.getElementById('invCurrency').value = invoiceState.meta.currency || 'USD';
        document.getElementById('invCustomCurrencyWrap').style.display = 'none';
      }
      document.getElementById('invDiscountType').value = invoiceState.discount.type || 'percent';
      document.getElementById('invDiscountValue').value = invoiceState.discount.value || 0;
      document.getElementById('invNotes').value = invoiceState.notes || '';
      document.getElementById('invTaxEnabled').checked = !!invoiceState.tax.enabled;
      document.getElementById('invTaxRate').value = invoiceState.tax.rate || 0;
      document.getElementById('invTaxRate').disabled = !invoiceState.tax.enabled;
      renderAll();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
