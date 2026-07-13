/* ToolFlight — shared app logic. Loaded on every page.
   Every tool block below is guarded with an element-existence check
   so this single file works whether that tool exists on the page or not. */

/* ============ THEME ============ */
let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
function applyTheme(){
  document.documentElement.classList.toggle('dark', isDark);
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  if (sun) sun.classList.toggle('hidden', isDark);
  if (moon) moon.classList.toggle('hidden', !isDark);
}
const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) themeToggleBtn.onclick = () => { isDark = !isDark; applyTheme(); };
applyTheme();
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ============ TOASTS ============ */
function toast(message, type='ok'){
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type === 'ok'
    ? '<svg class="ticon" viewBox="0 0 24 24" fill="none" stroke="#12A66B" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
    : '<svg class="ticon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  el.innerHTML = icon + '<span>' + message + '</span>';
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(()=>el.remove(), 300); }, 3400);
}

/* ============ TOOL CARD NAV (within a page that has multiple tool-views) ============ */
function selectTool(name){
  const view = document.getElementById('view-' + name);
  if (!view){
    // No workspace for this tool on this page — likely a cross-page link, let it navigate normally.
    return true;
  }
  document.querySelectorAll('.tool-card').forEach(c => c.classList.toggle('active', c.dataset.tool === name));
  document.querySelectorAll('.tool-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  return false;
}
document.querySelectorAll('.tool-card[data-tool]').forEach(card => {
  card.addEventListener('click', (e) => {
    if (card.dataset.placeholder === 'true'){
      toast("This tool is coming soon — it's on our roadmap!", 'ok');
      return;
    }
    selectTool(card.dataset.tool);
  });
});

/* ============ ACTIVE NAV LINK ============ */
(function highlightActiveNav(){
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === path) a.classList.add('active');
  });
})();

/* ============ HERO CTA: SMOOTH SCROLL + ANIMATE-IN (index.html) ============ */
const heroCta = document.getElementById('heroCta');
if (heroCta){
  heroCta.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById('tools');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Animate tool/category cards and feature chips into view as the user scrolls to them.
(function setupScrollAnimations(){
  const targets = document.querySelectorAll('.tools-grid .tool-card, .category-hub-grid .category-hub-card, .feature-chip');
  if (targets.length === 0) return;
  if (!('IntersectionObserver' in window)){
    targets.forEach(t => t.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting){
        const el = entry.target;
        setTimeout(() => el.classList.add('in-view'), i * 55);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => observer.observe(t));
})();

/* ============ SHARED HELPERS ============ */
// navigator.clipboard is undefined in some insecure/embedded contexts, and calling
// .writeText on undefined throws synchronously rather than rejecting a promise —
// this guards that case and falls back to the older execCommand approach.
function copyToClipboard(text){
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('Copy command was blocked by the browser.'));
    }catch(err){
      reject(err);
    }
  });
}
function fmtBytes(bytes){
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}
function setLoading(btn, loading, labelWhenIdle){
  if (!btn) return;
  if (loading){
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Processing…';
    btn.disabled = true;
  } else {
    btn.innerHTML = labelWhenIdle || btn.dataset.label || btn.innerHTML;
    btn.disabled = false;
  }
}
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function nextFrame(){ return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
// Single shared loader used by every image tool (Crop, Watermark, Rotate/Flip, AI Remover,
// Background Changer) — consolidated from 5 nearly-identical copies for maintainability.
function loadImageFromFile(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
    img.src = url;
  });
}
function canvasToBlobAsync(canvas, type, quality){
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Could not encode image on this device.')); }, type, quality);
  });
}
function setupDropZone(zoneId, inputId, onFiles){
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;
  zone.onclick = () => input.click();
  input.onchange = () => { onFiles(Array.from(input.files)); input.value = ''; };
  ['dragover','dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => onFiles(Array.from(e.dataTransfer.files)));
}
function enableDragReorder(listEl, arr, rerender){
  let dragIndex = null;
  Array.from(listEl.children).forEach((item, i) => {
    item.draggable = true;
    item.ondragstart = () => { dragIndex = i; item.classList.add('dragging'); };
    item.ondragend = () => item.classList.remove('dragging');
    item.ondragover = (e) => e.preventDefault();
    item.ondrop = (e) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === i) return;
      const moved = arr.splice(dragIndex, 1)[0];
      arr.splice(i, 0, moved);
      rerender();
    };
  });
}

/* ============ MERGE PDF (pdf-tools.html) ============ */
if (document.getElementById('mergeDrop')){
  const { PDFDocument } = PDFLib;
  let mergeFiles = [];
  setupDropZone('mergeDrop','mergeInput', async (files) => {
    const pdfs = files.filter(f => f.type === 'application/pdf');
    if (pdfs.length === 0 && files.length > 0){ toast('Please select PDF files only.', 'err'); return; }
    for (const f of pdfs){
      let pageCount = null;
      try{ const bytes = await f.arrayBuffer(); const doc = await PDFDocument.load(bytes); pageCount = doc.getPageCount(); }catch(e){}
      mergeFiles.push({ file: f, pageCount });
    }
    renderMergeList();
  });
  function renderMergeList(){
    const list = document.getElementById('mergeList');
    list.innerHTML = '';
    let totalPages = 0;
    mergeFiles.forEach((item, i) => {
      if (item.pageCount) totalPages += item.pageCount;
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <span class="drag-handle">⠿</span>
        <div class="fmeta">
          <div class="fname">${i+1}. ${item.file.name}</div>
          <div class="fsub">${fmtBytes(item.file.size)}${item.pageCount ? ' · ' + item.pageCount + ' pages' : ''}</div>
        </div>
        <button class="file-remove" data-i="${i}">✕</button>
      `;
      div.querySelector('.file-remove').onclick = () => { mergeFiles.splice(i,1); renderMergeList(); };
      list.appendChild(div);
    });
    enableDragReorder(list, mergeFiles, renderMergeList);
    document.getElementById('mergeBtn').disabled = mergeFiles.length < 2;
    document.getElementById('mergePageBadge').textContent = mergeFiles.length + ' file' + (mergeFiles.length!==1?'s':'') + (totalPages ? ' · ' + totalPages + ' pages' : '');
  }
  document.getElementById('mergeClearBtn').onclick = () => { mergeFiles = []; renderMergeList(); };
  document.getElementById('mergeBtn').onclick = async () => {
    const btn = document.getElementById('mergeBtn');
    setLoading(btn, true);
    try{
      const merged = await PDFDocument.create();
      for (const item of mergeFiles){
        const bytes = await item.file.arrayBuffer();
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const outBytes = await merged.save();
      downloadBlob(new Blob([outBytes], {type:'application/pdf'}), 'merged.pdf');
      toast('PDFs merged successfully.');
    }catch(err){
      toast('Merge failed: ' + err.message, 'err');
    }finally{
      setLoading(btn, false, 'Merge &amp; download');
    }
  };
}

/* ============ SPLIT PDF (pdf-tools.html) ============ */
if (document.getElementById('splitDrop')){
  const { PDFDocument } = PDFLib;
  let splitFile = null;
  let splitTotalPages = 0;
  let selectedPages = new Set();
  setupDropZone('splitDrop','splitInput', async (files) => {
    const f = files.find(f => f.type === 'application/pdf');
    if (!f){ if (files.length>0) toast('Please select a PDF file.', 'err'); return; }
    splitFile = f;
    try{
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      splitTotalPages = doc.getPageCount();
      selectedPages = new Set(Array.from({length:splitTotalPages}, (_,i)=>i));
      renderPageGrid();
      document.getElementById('splitPagePicker').classList.remove('hidden');
      document.getElementById('splitPageBadge').classList.remove('hidden');
      document.getElementById('splitPageBadge').textContent = splitTotalPages + ' pages';
    }catch(e){
      toast('Could not read that PDF.', 'err');
      return;
    }
    renderSplitList();
  });
  function renderSplitList(){
    const list = document.getElementById('splitList');
    list.innerHTML = '';
    if (splitFile){
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `<div class="fmeta"><div class="fname">${splitFile.name}</div><div class="fsub">${fmtBytes(splitFile.size)} · ${splitTotalPages} pages</div></div><button class="file-remove">✕</button>`;
      div.querySelector('.file-remove').onclick = clearSplit;
      list.appendChild(div);
    }
    document.getElementById('splitBtn').disabled = !splitFile;
  }
  function renderPageGrid(){
    const grid = document.getElementById('pageGrid');
    grid.innerHTML = '';
    for (let i = 0; i < splitTotalPages; i++){
      const chip = document.createElement('div');
      chip.className = 'page-chip' + (selectedPages.has(i) ? ' selected' : '');
      chip.textContent = i+1;
      chip.onclick = () => { selectedPages.has(i) ? selectedPages.delete(i) : selectedPages.add(i); renderPageGrid(); };
      grid.appendChild(chip);
    }
  }
  document.getElementById('selectAllBtn').onclick = () => { selectedPages = new Set(Array.from({length:splitTotalPages},(_,i)=>i)); renderPageGrid(); };
  document.getElementById('selectNoneBtn').onclick = () => { selectedPages = new Set(); renderPageGrid(); };
  function clearSplit(){
    splitFile = null; splitTotalPages = 0; selectedPages = new Set();
    document.getElementById('splitPagePicker').classList.add('hidden');
    document.getElementById('splitPageBadge').classList.add('hidden');
    renderSplitList();
  }
  document.getElementById('splitClearBtn').onclick = clearSplit;
  document.getElementById('splitBtn').onclick = async () => {
    const btn = document.getElementById('splitBtn');
    if (selectedPages.size === 0){ toast('Select at least one page.', 'err'); return; }
    setLoading(btn, true);
    try{
      const bytes = await splitFile.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const zip = new JSZip();
      const sorted = Array.from(selectedPages).sort((a,b)=>a-b);
      for (const pageIndex of sorted){
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(src, [pageIndex]);
        doc.addPage(page);
        const outBytes = await doc.save();
        zip.file(`page-${pageIndex+1}.pdf`, outBytes);
      }
      const zipBlob = await zip.generateAsync({type:'blob'});
      downloadBlob(zipBlob, 'split-pages.zip');
      toast(sorted.length + ' page(s) exported.');
    }catch(err){
      toast('Split failed: ' + err.message, 'err');
    }finally{
      setLoading(btn, false, 'Split &amp; download .zip');
    }
  };
}

/* ============ COMPRESS IMAGE (image-tools.html) ============ */
if (document.getElementById('compressDrop')){
  const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB hard reject
  const MAX_DIMENSION = 2000; // longest side after resize
  const COMPRESS_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  let compressFile = null;
  let compressedBlobUrl = null;
  let originalPreviewUrl = null;

  function setCompressProgress(pct, label){
    const wrap = document.getElementById('compressProgressWrap');
    wrap.classList.remove('hidden');
    document.getElementById('compressProgressFill').style.width = pct + '%';
    document.getElementById('compressProgressLabel').textContent = label;
  }
  function hideCompressProgress(){
    document.getElementById('compressProgressWrap').classList.add('hidden');
    document.getElementById('compressProgressFill').style.width = '0%';
  }
  // Universal, Android-Chrome-safe image load: object URL + <img> + onload. No createImageBitmap.
  // Named distinctly from the shared top-level loadImageFromFile() — a same-named function
  // declared inside this block previously shadowed the shared one at script scope (a classic
  // "function declarations in blocks" hazard in non-strict JS), which caused every OTHER tool's
  // loadImg*/loadImageFromFile alias to silently receive {img, url} objects instead of the Image
  // itself, breaking drawImage() calls throughout the AI Background Remover, Crop, Watermark,
  // Rotate/Flip, and Background Changer tools.
  function loadImageWithUrl(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('This file could not be read as an image. Try a JPG, PNG, or WEBP file.'));
      };
      img.src = url;
    });
  }
  function computeTargetDims(w, h, maxDim){
    if (w <= maxDim && h <= maxDim) return { width: w, height: h };
    const scale = w >= h ? maxDim / w : maxDim / h;
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  setupDropZone('compressDrop','compressInput', async (files) => {
    const f = files.find(f => COMPRESS_ACCEPTED_TYPES.includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > MAX_FILE_BYTES){
      toast(`That image is ${fmtBytes(f.size)} — the limit is 50 MB. Try a smaller file.`, 'err');
      return;
    }
    compressFile = f;
    document.getElementById('compressBtn').disabled = false;
    document.getElementById('compressDownloadBtn').classList.add('hidden');
    document.getElementById('savedRow').classList.add('hidden');
    hideCompressProgress();
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    originalPreviewUrl = URL.createObjectURL(f);
    document.getElementById('origPreview').src = originalPreviewUrl;
    document.getElementById('origSize').textContent = fmtBytes(f.size);
    document.getElementById('compareBox').classList.remove('hidden');
  });

  document.getElementById('qualitySlider').oninput = (e) => { document.getElementById('qualityVal').textContent = e.target.value; };

  document.getElementById('compressBtn').onclick = async () => {
    const btn = document.getElementById('compressBtn');
    if (!compressFile) return;
    setLoading(btn, true);
    setCompressProgress(10, 'Reading image…');
    let loadedUrl = null;
    try{
      await nextFrame();
      const quality = parseInt(document.getElementById('qualitySlider').value,10) / 100;

      setCompressProgress(30, 'Decoding image…');
      await nextFrame();
      const { img, url } = await loadImageWithUrl(compressFile);
      loadedUrl = url;

      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height){
        throw new Error('This file could not be read as an image. Try a JPG, PNG, or WEBP file.');
      }
      const target = computeTargetDims(width, height, MAX_DIMENSION);

      setCompressProgress(55, 'Resizing for your device…');
      await nextFrame();
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, target.width, target.height);

      URL.revokeObjectURL(loadedUrl);
      loadedUrl = null;

      setCompressProgress(80, 'Encoding…');
      await nextFrame();
      const blob = await canvasToBlobAsync(canvas, 'image/jpeg', quality);

      setCompressProgress(95, 'Finishing up…');
      await nextFrame();

      if (compressedBlobUrl) URL.revokeObjectURL(compressedBlobUrl);
      compressedBlobUrl = URL.createObjectURL(blob);
      document.getElementById('compPreview').src = compressedBlobUrl;
      document.getElementById('compSize').textContent = fmtBytes(blob.size);

      const savedPct = Math.max(0, Math.round((1 - blob.size / compressFile.size) * 100));
      document.getElementById('savedBadge').textContent = savedPct + '% smaller' +
        (target.width !== width || target.height !== height ? ` · resized to ${target.width}×${target.height}` : '');
      document.getElementById('savedRow').classList.remove('hidden');
      document.getElementById('compressDownloadBtn').classList.remove('hidden');

      setCompressProgress(100, 'Done.');
      toast('Image compressed.');
    }catch(err){
      toast('Compression failed: ' + (err.message || 'please try a different image.'), 'err');
    }finally{
      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
      setLoading(btn, false, 'Compress');
      setTimeout(hideCompressProgress, 900);
    }
  };

  document.getElementById('compressDownloadBtn').onclick = () => {
    if (!compressedBlobUrl) return;
    const a = document.createElement('a');
    a.href = compressedBlobUrl; a.download = 'compressed.jpg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
}

/* ============ AGE CALCULATOR (calculators.html) ============ */
if (document.getElementById('ageCalcBtn')){
  const dobInput = document.getElementById('ageDobInput');
  const asOfInput = document.getElementById('ageAsOfInput');
  const todayStr = new Date().toISOString().split('T')[0];
  if (asOfInput && !asOfInput.value) asOfInput.value = todayStr;

  document.getElementById('ageCalcBtn').onclick = () => {
    const dobVal = dobInput.value;
    const asOfVal = asOfInput.value || todayStr;
    if (!dobVal){ toast('Please enter a date of birth.', 'err'); return; }
    const dob = new Date(dobVal + 'T00:00:00');
    const asOf = new Date(asOfVal + 'T00:00:00');
    if (isNaN(dob.getTime()) || isNaN(asOf.getTime())){ toast('That date could not be read. Please try again.', 'err'); return; }
    if (dob > asOf){ toast('Date of birth must be on or before the "as of" date.', 'err'); return; }

    let years = asOf.getFullYear() - dob.getFullYear();
    let months = asOf.getMonth() - dob.getMonth();
    let days = asOf.getDate() - dob.getDate();
    if (days < 0){
      months -= 1;
      const prevMonthLastDay = new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0){ months += 12; years -= 1; }
    const totalDays = Math.floor((asOf - dob) / 86400000);

    document.getElementById('ageYears').textContent = years;
    document.getElementById('ageMonths').textContent = months;
    document.getElementById('ageDays').textContent = days;
    document.getElementById('ageTotalDays').textContent = totalDays.toLocaleString();
    document.getElementById('ageResultBox').classList.remove('hidden');
    document.getElementById('ageTotalDaysLine').classList.remove('hidden');
    toast('Age calculated.');
  };

  document.getElementById('ageClearBtn').onclick = () => {
    dobInput.value = '';
    asOfInput.value = todayStr;
    document.getElementById('ageResultBox').classList.add('hidden');
    document.getElementById('ageTotalDaysLine').classList.add('hidden');
  };
}

/* ============ BMI CALCULATOR (calculators.html) ============ */
if (document.getElementById('bmiCalcBtn')){
  let bmiUnit = 'metric';

  document.querySelectorAll('.bmi-unit-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.bmi-unit-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      bmiUnit = btn.dataset.unit;
      document.getElementById('bmiMetricFields').classList.toggle('hidden', bmiUnit !== 'metric');
      document.getElementById('bmiImperialFields').classList.toggle('hidden', bmiUnit !== 'imperial');
    };
  });

  function bmiCategoryFor(bmi){
    if (bmi < 18.5) return { label: 'Underweight', color: 'var(--accent1-solid)' };
    if (bmi < 25) return { label: 'Normal weight', color: 'var(--ok-solid)' };
    if (bmi < 30) return { label: 'Overweight', color: 'var(--warn-solid)' };
    return { label: 'Obesity', color: 'var(--err-solid)' };
  }

  document.getElementById('bmiCalcBtn').onclick = () => {
    let heightM, weightKg;
    if (bmiUnit === 'metric'){
      const cm = parseFloat(document.getElementById('bmiHeightCm').value);
      const kg = parseFloat(document.getElementById('bmiWeightKg').value);
      if (!cm || !kg || cm <= 0 || kg <= 0){ toast('Enter a valid height and weight.', 'err'); return; }
      heightM = cm / 100; weightKg = kg;
    } else {
      const ft = parseFloat(document.getElementById('bmiHeightFt').value) || 0;
      const inch = parseFloat(document.getElementById('bmiHeightIn').value) || 0;
      const lb = parseFloat(document.getElementById('bmiWeightLb').value);
      if ((ft <= 0 && inch <= 0) || !lb || lb <= 0){ toast('Enter a valid height and weight.', 'err'); return; }
      heightM = ((ft * 12) + inch) * 0.0254;
      weightKg = lb * 0.453592;
    }
    if (!isFinite(heightM) || heightM <= 0){ toast('Enter a valid height.', 'err'); return; }

    const bmi = weightKg / (heightM * heightM);
    const cat = bmiCategoryFor(bmi);
    document.getElementById('bmiValue').textContent = bmi.toFixed(1);
    const badge = document.getElementById('bmiCategoryBadge');
    badge.textContent = cat.label;
    badge.style.background = cat.color;
    document.getElementById('bmiResultBox').classList.remove('hidden');
    toast('BMI calculated.');
  };

  document.getElementById('bmiClearBtn').onclick = () => {
    ['bmiHeightCm','bmiWeightKg','bmiHeightFt','bmiHeightIn','bmiWeightLb'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('bmiResultBox').classList.add('hidden');
  };
}

/* ============ ROBOTS.TXT GENERATOR (seo-tools.html) ============ */
if (document.getElementById('robotsPreview')){
  let robotsRules = [{ path: '/private/', type: 'Disallow' }];

  function renderRobotsRules(){
    const list = document.getElementById('robotsRulesList');
    list.innerHTML = '';
    robotsRules.forEach((rule, i) => {
      const row = document.createElement('div');
      row.className = 'rule-row';
      row.innerHTML = `
        <select data-i="${i}" class="rule-type-select">
          <option value="Disallow" ${rule.type==='Disallow'?'selected':''}>Disallow</option>
          <option value="Allow" ${rule.type==='Allow'?'selected':''}>Allow</option>
        </select>
        <input type="text" data-i="${i}" class="rule-path-input" value="${rule.path}" placeholder="/path/">
        <button class="rule-remove" data-i="${i}" type="button">✕</button>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll('.rule-type-select').forEach(sel => {
      sel.onchange = (e) => { robotsRules[+e.target.dataset.i].type = e.target.value; updateRobotsPreview(); };
    });
    list.querySelectorAll('.rule-path-input').forEach(inp => {
      inp.oninput = (e) => { robotsRules[+e.target.dataset.i].path = e.target.value; updateRobotsPreview(); };
    });
    list.querySelectorAll('.rule-remove').forEach(btn => {
      btn.onclick = (e) => { robotsRules.splice(+e.target.dataset.i, 1); renderRobotsRules(); updateRobotsPreview(); };
    });
  }

  function updateRobotsPreview(){
    const site = document.getElementById('robotsWebsiteUrl').value.trim().replace(/\/$/, '');
    let sitemap = document.getElementById('robotsSitemapUrl').value.trim();
    if (!sitemap && site) sitemap = site + '/sitemap.xml';

    let lines = ['User-agent: *'];
    if (robotsRules.length === 0){
      lines.push('Allow: /');
    } else {
      robotsRules.forEach(r => {
        const path = r.path.trim() || '/';
        lines.push(`${r.type}: ${path}`);
      });
    }
    lines.push('');
    if (sitemap) lines.push(`Sitemap: ${sitemap}`);
    document.getElementById('robotsPreview').textContent = lines.join('\n').trim() + '\n';
  }

  document.getElementById('robotsWebsiteUrl').addEventListener('input', updateRobotsPreview);
  document.getElementById('robotsSitemapUrl').addEventListener('input', updateRobotsPreview);
  document.getElementById('robotsAddRuleBtn').onclick = () => {
    robotsRules.push({ path: '/', type: 'Disallow' });
    renderRobotsRules();
    updateRobotsPreview();
  };

  document.getElementById('robotsCopyBtn').onclick = () => {
    const text = document.getElementById('robotsPreview').textContent;
    copyToClipboard(text).then(() => toast('robots.txt copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
  };
  document.getElementById('robotsDownloadBtn').onclick = () => {
    const text = document.getElementById('robotsPreview').textContent;
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'robots.txt');
  };

  renderRobotsRules();
  updateRobotsPreview();
}

/* ============ META TAG GENERATOR (seo-tools.html) ============ */
if (document.getElementById('metaPreview')){
  const metaFieldIds = ['metaTitle','metaDescription','metaKeywords','metaCanonical','metaAuthor','metaRobots','metaOgImage','metaOgUrl','metaTwitterCard'];

  function escapeAttr(str){
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function updateMetaPreview(){
    const title = document.getElementById('metaTitle').value.trim();
    const description = document.getElementById('metaDescription').value.trim();
    const keywords = document.getElementById('metaKeywords').value.trim();
    const canonical = document.getElementById('metaCanonical').value.trim();
    const author = document.getElementById('metaAuthor').value.trim();
    const robotsVal = document.getElementById('metaRobots').value;
    const ogImage = document.getElementById('metaOgImage').value.trim();
    const ogUrl = document.getElementById('metaOgUrl').value.trim() || canonical;
    const twitterCard = document.getElementById('metaTwitterCard').value;

    let lines = [];
    if (title) lines.push(`<title>${escapeAttr(title)}</title>`);
    if (description) lines.push(`<meta name="description" content="${escapeAttr(description)}">`);
    if (keywords) lines.push(`<meta name="keywords" content="${escapeAttr(keywords)}">`);
    if (author) lines.push(`<meta name="author" content="${escapeAttr(author)}">`);
    lines.push(`<meta name="robots" content="${escapeAttr(robotsVal)}">`);
    if (canonical) lines.push(`<link rel="canonical" href="${escapeAttr(canonical)}">`);

    lines.push('');
    lines.push('<!-- Open Graph -->');
    if (title) lines.push(`<meta property="og:title" content="${escapeAttr(title)}">`);
    if (description) lines.push(`<meta property="og:description" content="${escapeAttr(description)}">`);
    lines.push(`<meta property="og:type" content="website">`);
    if (ogUrl) lines.push(`<meta property="og:url" content="${escapeAttr(ogUrl)}">`);
    if (ogImage) lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}">`);

    lines.push('');
    lines.push('<!-- Twitter Card -->');
    lines.push(`<meta name="twitter:card" content="${escapeAttr(twitterCard)}">`);
    if (title) lines.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
    if (description) lines.push(`<meta name="twitter:description" content="${escapeAttr(description)}">`);
    if (ogImage) lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}">`);

    document.getElementById('metaPreview').textContent = lines.join('\n');
  }

  metaFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateMetaPreview);
    if (el && el.tagName === 'SELECT') el.addEventListener('change', updateMetaPreview);
  });

  document.getElementById('metaCopyBtn').onclick = () => {
    const text = document.getElementById('metaPreview').textContent;
    copyToClipboard(text).then(() => toast('Meta tags copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
  };
  document.getElementById('metaDownloadBtn').onclick = () => {
    const text = document.getElementById('metaPreview').textContent;
    downloadBlob(new Blob([text], { type: 'text/html' }), 'meta-tags.html');
  };

  updateMetaPreview();
}

/* ============ PERCENTAGE CALCULATOR (calculators.html) ============ */
if (document.getElementById('pctCalcBtn')){
  let pctMode = 'of';
  const pctLabelConfig = {
    of: { x: 'Percentage (%)', y: 'Of value', xPh: 'e.g. 20', yPh: 'e.g. 250' },
    percentOf: { x: 'Part value', y: 'Total value', xPh: 'e.g. 40', yPh: 'e.g. 250' },
    increase: { x: 'Original value', y: 'New value', xPh: 'e.g. 100', yPh: 'e.g. 125' },
    decrease: { x: 'Original value', y: 'New value', xPh: 'e.g. 100', yPh: 'e.g. 80' },
    difference: { x: 'Value 1', y: 'Value 2', xPh: 'e.g. 100', yPh: 'e.g. 120' },
  };

  document.querySelectorAll('.pct-mode-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.pct-mode-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pctMode = btn.dataset.mode;
      const cfg = pctLabelConfig[pctMode];
      document.getElementById('pctLabelX').textContent = cfg.x;
      document.getElementById('pctLabelY').textContent = cfg.y;
      document.getElementById('pctX').placeholder = cfg.xPh;
      document.getElementById('pctY').placeholder = cfg.yPh;
      document.getElementById('pctResultBox').classList.add('hidden');
    };
  });

  document.getElementById('pctCalcBtn').onclick = () => {
    const x = parseFloat(document.getElementById('pctX').value);
    const y = parseFloat(document.getElementById('pctY').value);
    if (!isFinite(x) || !isFinite(y)){ toast('Enter both values.', 'err'); return; }

    let result, formula;
    if (pctMode === 'of'){
      result = (x / 100) * y;
      formula = `${x}% of ${y} = ${result.toFixed(2)}`;
    } else if (pctMode === 'percentOf'){
      if (y === 0){ toast("The total value can't be zero.", 'err'); return; }
      result = (x / y) * 100;
      formula = `${x} is ${result.toFixed(2)}% of ${y}`;
    } else if (pctMode === 'increase'){
      if (x === 0){ toast("The original value can't be zero.", 'err'); return; }
      result = ((y - x) / x) * 100;
      formula = `Change from ${x} to ${y} = ${result.toFixed(2)}% ${result >= 0 ? 'increase' : 'decrease'}`;
    } else if (pctMode === 'decrease'){
      if (x === 0){ toast("The original value can't be zero.", 'err'); return; }
      result = ((x - y) / x) * 100;
      formula = `Change from ${x} to ${y} = ${result.toFixed(2)}% ${result >= 0 ? 'decrease' : 'increase'}`;
    } else if (pctMode === 'difference'){
      const avg = (x + y) / 2;
      if (avg === 0){ toast("Values can't both be zero.", 'err'); return; }
      result = (Math.abs(x - y) / avg) * 100;
      formula = `Difference between ${x} and ${y} = ${result.toFixed(2)}%`;
    }

    document.getElementById('pctValue').textContent = result.toFixed(2) + (pctMode === 'of' ? '' : '%');
    document.getElementById('pctFormula').textContent = formula;
    document.getElementById('pctResultBox').classList.remove('hidden');
    toast('Calculated.');
  };

  document.getElementById('pctClearBtn').onclick = () => {
    document.getElementById('pctX').value = '';
    document.getElementById('pctY').value = '';
    document.getElementById('pctResultBox').classList.add('hidden');
  };
}

/* ============ DISCOUNT CALCULATOR (calculators.html) ============ */
if (document.getElementById('discOriginal')){
  function updateDiscount(){
    const price = parseFloat(document.getElementById('discOriginal').value);
    const pct = parseFloat(document.getElementById('discPercent').value);
    if (!isFinite(price) || !isFinite(pct) || price < 0 || pct < 0){
      document.getElementById('discFinal').textContent = '0.00';
      document.getElementById('discSaved').textContent = '0.00';
      return;
    }
    const saved = price * (pct / 100);
    const final = price - saved;
    document.getElementById('discFinal').textContent = final.toFixed(2);
    document.getElementById('discSaved').textContent = saved.toFixed(2);
  }
  document.getElementById('discOriginal').addEventListener('input', updateDiscount);
  document.getElementById('discPercent').addEventListener('input', updateDiscount);
}

/* ============ EMI / LOAN CALCULATOR (calculators.html) ============ */
if (document.getElementById('emiCalcBtn')){
  document.getElementById('emiCalcBtn').onclick = () => {
    const amount = parseFloat(document.getElementById('emiAmount').value);
    const rate = parseFloat(document.getElementById('emiRate').value);
    const term = parseFloat(document.getElementById('emiTerm').value);
    const unit = document.getElementById('emiTermUnit').value;
    if (!isFinite(amount) || amount <= 0){ toast('Enter a valid loan amount.', 'err'); return; }
    if (!isFinite(rate) || rate < 0){ toast('Enter a valid interest rate.', 'err'); return; }
    if (!isFinite(term) || term <= 0){ toast('Enter a valid loan term.', 'err'); return; }

    const months = unit === 'years' ? term * 12 : term;
    const monthlyRate = rate / 12 / 100;
    let emi;
    if (monthlyRate === 0){
      emi = amount / months;
    } else {
      const factor = Math.pow(1 + monthlyRate, months);
      emi = (amount * monthlyRate * factor) / (factor - 1);
    }
    const totalPayment = emi * months;
    const totalInterest = totalPayment - amount;

    document.getElementById('emiMonthly').textContent = emi.toFixed(2);
    document.getElementById('emiInterest').textContent = totalInterest.toFixed(2);
    document.getElementById('emiTotal').textContent = totalPayment.toFixed(2);
    document.getElementById('emiResultBox').classList.remove('hidden');
    toast('EMI calculated.');
  };
  document.getElementById('emiResetBtn').onclick = () => {
    ['emiAmount','emiRate','emiTerm'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('emiTermUnit').value = 'years';
    document.getElementById('emiResultBox').classList.add('hidden');
  };
}

/* ============ GST / VAT CALCULATOR (calculators.html) ============ */
if (document.getElementById('gstCalcBtn')){
  let gstMode = 'add';
  document.querySelectorAll('.gst-mode-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.gst-mode-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gstMode = btn.dataset.mode;
      document.getElementById('gstAmountLabel').textContent = gstMode === 'add' ? 'Original amount' : 'Amount (tax included)';
      document.getElementById('gstResultBox').classList.add('hidden');
    };
  });

  document.getElementById('gstCalcBtn').onclick = () => {
    const amount = parseFloat(document.getElementById('gstAmount').value);
    const pct = parseFloat(document.getElementById('gstPercent').value);
    if (!isFinite(amount) || amount < 0){ toast('Enter a valid amount.', 'err'); return; }
    if (!isFinite(pct) || pct < 0){ toast('Enter a valid tax percentage.', 'err'); return; }

    let taxAmount, finalAmount;
    if (gstMode === 'add'){
      taxAmount = amount * (pct / 100);
      finalAmount = amount + taxAmount;
    } else {
      const base = amount / (1 + pct / 100);
      taxAmount = amount - base;
      finalAmount = base;
    }
    document.getElementById('gstTaxAmount').textContent = taxAmount.toFixed(2);
    document.getElementById('gstFinalAmount').textContent = finalAmount.toFixed(2);
    document.getElementById('gstResultBox').classList.remove('hidden');
    toast('Calculated.');
  };
  document.getElementById('gstResetBtn').onclick = () => {
    document.getElementById('gstAmount').value = '';
    document.getElementById('gstPercent').value = '';
    document.getElementById('gstResultBox').classList.add('hidden');
  };
}

/* ============ SCIENTIFIC CALCULATOR (calculators.html) ============ */
if (document.getElementById('sciDisplay')){
  let sciExpr = '';
  let sciMemory = 0;
  let sciAngleMode = 'deg';
  const display = document.getElementById('sciDisplay');

  function renderSciDisplay(){
    display.textContent = sciExpr === '' ? '0' : sciExpr;
  }

  function sciEvaluate(){
    if (!sciExpr){ return null; }
    // Only allow characters/tokens our own buttons ever insert — defense in depth,
    // since evaluation still runs through named functions rather than raw eval.
    if (!/^[0-9+\-*/().^%\s a-zA-Z]*$/.test(sciExpr)){
      toast('Invalid expression.', 'err');
      return null;
    }
    try{
      const degMode = sciAngleMode === 'deg';
      const toRad = (x) => degMode ? (x * Math.PI / 180) : x;
      const sin = (x) => Math.sin(toRad(x));
      const cos = (x) => Math.cos(toRad(x));
      const tan = (x) => Math.tan(toRad(x));
      const log = (x) => Math.log10(x);
      const ln = (x) => Math.log(x);
      const sqrt = (x) => Math.sqrt(x);
      const PI = Math.PI;
      const E = Math.E;
      let cleanExpr = sciExpr.replace(/\^/g, '**').replace(/(\d+(\.\d+)?)%/g, '($1/100)');
      const fn = new Function('sin','cos','tan','log','ln','sqrt','PI','E', '"use strict"; return (' + cleanExpr + ');');
      const result = fn(sin,cos,tan,log,ln,sqrt,PI,E);
      if (!isFinite(result)){ toast('That expression is undefined.', 'err'); return null; }
      return result;
    }catch(err){
      toast('Invalid expression.', 'err');
      return null;
    }
  }

  document.querySelectorAll('#sciGrid .sci-btn[data-insert]').forEach(btn => {
    btn.onclick = () => { sciExpr += btn.dataset.insert; renderSciDisplay(); };
  });
  document.querySelectorAll('#sciGrid .sci-btn[data-action]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      if (action === 'clear'){ sciExpr = ''; renderSciDisplay(); }
      else if (action === 'backspace'){ sciExpr = sciExpr.slice(0, -1); renderSciDisplay(); }
      else if (action === 'equals'){
        const result = sciEvaluate();
        if (result !== null){ sciExpr = String(result); renderSciDisplay(); }
      }
      else if (action === 'mc'){ sciMemory = 0; toast('Memory cleared.'); }
      else if (action === 'mr'){ sciExpr += String(sciMemory); renderSciDisplay(); }
      else if (action === 'mplus'){
        const result = sciEvaluate();
        if (result !== null){ sciMemory += result; toast('Added to memory.'); }
      }
      else if (action === 'mminus'){
        const result = sciEvaluate();
        if (result !== null){ sciMemory -= result; toast('Subtracted from memory.'); }
      }
    };
  });

  document.querySelectorAll('#sciAngleToggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#sciAngleToggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sciAngleMode = btn.dataset.angle;
    };
  });

  // Keyboard support — only active while the Scientific Calculator view is visible.
  document.addEventListener('keydown', (e) => {
    const sciEl = document.getElementById('sciDisplay');
    if (!sciEl) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    if (/^[0-9+\-*/().%]$/.test(e.key)){
      sciExpr += e.key; renderSciDisplay(); e.preventDefault();
    } else if (e.key === 'Enter' || e.key === '='){
      const result = sciEvaluate();
      if (result !== null){ sciExpr = String(result); renderSciDisplay(); }
      e.preventDefault();
    } else if (e.key === 'Backspace'){
      sciExpr = sciExpr.slice(0, -1); renderSciDisplay(); e.preventDefault();
    } else if (e.key === 'Escape'){
      sciExpr = ''; renderSciDisplay(); e.preventDefault();
    }
  });

  renderSciDisplay();
}

/* ============ UNIT CONVERTER (calculators.html) ============ */
if (document.getElementById('unitCategory')){
  const UNIT_DATA = {
    length: { units: { mm:0.001, cm:0.01, m:1, km:1000, in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344 } },
    weight: { units: { mg:0.000001, g:0.001, kg:1, tonne:1000, oz:0.0283495, lb:0.453592 } },
    area: { units: { 'm2':1, 'km2':1000000, 'ft2':0.092903, acre:4046.86, hectare:10000 } },
    volume: { units: { ml:0.001, l:1, 'm3':1000, gallon:3.78541, quart:0.946353, cup:0.24 } },
    speed: { units: { 'm/s':1, 'km/h':0.277778, mph:0.44704, knot:0.514444 } },
    time: { units: { seconds:1, minutes:60, hours:3600, days:86400, weeks:604800 } },
    data: { units: { bit:0.125, byte:1, KB:1024, MB:1048576, GB:1073741824, TB:1099511627776 } },
  };
  const TEMP_UNITS = ['celsius','fahrenheit','kelvin'];

  function unitsForCategory(cat){
    if (cat === 'temperature') return TEMP_UNITS;
    return Object.keys(UNIT_DATA[cat].units);
  }

  function populateUnitSelects(){
    const cat = document.getElementById('unitCategory').value;
    const units = unitsForCategory(cat);
    const fromSel = document.getElementById('unitFromSelect');
    const toSel = document.getElementById('unitToSelect');
    fromSel.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    toSel.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
    fromSel.selectedIndex = 0;
    toSel.selectedIndex = units.length > 1 ? 1 : 0;
    runUnitConversion();
  }

  function convertTemperature(from, to, v){
    let celsius;
    if (from === 'celsius') celsius = v;
    else if (from === 'fahrenheit') celsius = (v - 32) * 5 / 9;
    else celsius = v - 273.15;
    if (to === 'celsius') return celsius;
    if (to === 'fahrenheit') return celsius * 9 / 5 + 32;
    return celsius + 273.15;
  }

  function runUnitConversion(){
    const cat = document.getElementById('unitCategory').value;
    const from = document.getElementById('unitFromSelect').value;
    const to = document.getElementById('unitToSelect').value;
    const value = parseFloat(document.getElementById('unitFromValue').value);
    if (!isFinite(value)){
      document.getElementById('unitToValue').textContent = '—';
      return;
    }
    let result;
    if (cat === 'temperature'){
      result = convertTemperature(from, to, value);
    } else {
      const units = UNIT_DATA[cat].units;
      result = (value * units[from]) / units[to];
    }
    document.getElementById('unitToValue').textContent = Number(result.toFixed(6)).toString();
    document.getElementById('unitToLabel').textContent = `Result (${to})`;
  }

  document.getElementById('unitCategory').addEventListener('change', populateUnitSelects);
  document.getElementById('unitFromSelect').addEventListener('change', runUnitConversion);
  document.getElementById('unitToSelect').addEventListener('change', runUnitConversion);
  document.getElementById('unitFromValue').addEventListener('input', runUnitConversion);
  document.getElementById('unitSwapBtn').onclick = () => {
    const fromSel = document.getElementById('unitFromSelect');
    const toSel = document.getElementById('unitToSelect');
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
    runUnitConversion();
  };

  populateUnitSelects();
}

/* ============ CURRENCY CONVERTER (calculators.html) ============ */
if (document.getElementById('curFrom')){
  const CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','HKD','NZD','SEK','KRW','SGD','NOK','MXN','INR','ZAR','TRY','BRL','DKK','PLN','THB','IDR','HUF','CZK','ILS','PHP','MYR','RON','BGN'];
  let ratesCache = {}; // { BASE: { date, rates } }

  const fromSel = document.getElementById('curFrom');
  const toSel = document.getElementById('curTo');
  fromSel.innerHTML = CURRENCIES.map(c => `<option value="${c}" ${c==='USD'?'selected':''}>${c}</option>`).join('');
  toSel.innerHTML = CURRENCIES.map(c => `<option value="${c}" ${c==='EUR'?'selected':''}>${c}</option>`).join('');

  // Three independently-hosted, free, keyless, CORS-enabled, commercial-use-friendly
  // providers, tried in order. If one is down or blocked, the next is used
  // automatically — the user only ever sees an error if all three fail.
  const CURRENCY_PROVIDERS = [
    {
      name: 'frankfurter',
      buildUrl: (base) => `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`,
      parse: (data) => {
        if (!data || !data.rates) throw new Error('Unexpected response from frankfurter.');
        return { date: data.date, rates: data.rates };
      }
    },
    {
      name: 'fawazahmed0-jsdelivr',
      buildUrl: (base) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
      parse: (data, base) => {
        const raw = data && data[base.toLowerCase()];
        if (!raw) throw new Error('Unexpected response from currency-api (jsDelivr).');
        const rates = {};
        for (const k in raw) rates[k.toUpperCase()] = raw[k];
        return { date: data.date, rates };
      }
    },
    {
      name: 'fawazahmed0-pages',
      buildUrl: (base) => `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.json`,
      parse: (data, base) => {
        const raw = data && data[base.toLowerCase()];
        if (!raw) throw new Error('Unexpected response from currency-api (Pages.dev).');
        const rates = {};
        for (const k in raw) rates[k.toUpperCase()] = raw[k];
        return { date: data.date, rates };
      }
    }
  ];

  function fetchWithTimeout(url, ms){
    // AbortSignal.timeout isn't in every browser on the compatibility list yet —
    // feature-detected so older engines just fetch without a client-side timeout
    // instead of throwing.
    const opts = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
      ? { signal: AbortSignal.timeout(ms) }
      : {};
    return fetch(url, opts);
  }

  async function getRates(base){
    if (ratesCache[base]) return ratesCache[base];
    let lastErr = null;
    for (const provider of CURRENCY_PROVIDERS){
      try{
        const res = await fetchWithTimeout(provider.buildUrl(base), 8000);
        if (!res.ok) throw new Error(`${provider.name} responded with HTTP ${res.status}`);
        const data = await res.json();
        const normalized = provider.parse(data, base);
        if (!normalized.rates || Object.keys(normalized.rates).length === 0){
          throw new Error(`${provider.name} returned no rate data`);
        }
        ratesCache[base] = normalized;
        return normalized;
      }catch(err){
        lastErr = err; // try the next provider
      }
    }
    throw new Error('All exchange rate providers are temporarily unreachable. Please try again shortly.');
  }

  async function runCurrencyConversion(){
    const status = document.getElementById('curStatus');
    const amount = parseFloat(document.getElementById('curAmount').value);
    const from = fromSel.value;
    const to = toSel.value;
    if (!isFinite(amount)){
      document.getElementById('curResult').textContent = '—';
      return;
    }
    if (from === to){
      document.getElementById('curResult').textContent = amount.toFixed(2);
      document.getElementById('curResultLabel').textContent = `= ${to}`;
      status.textContent = 'Same currency selected.';
      return;
    }
    try{
      status.textContent = 'Loading exchange rates…';
      const data = await getRates(from);
      const rate = data.rates[to];
      if (!rate){ throw new Error(`No rate available for ${to} right now.`); }
      const converted = amount * rate;
      document.getElementById('curResult').textContent = converted.toFixed(2);
      document.getElementById('curResultLabel').textContent = `= ${to}`;
      status.textContent = `1 ${from} = ${rate} ${to} · Last updated: ${data.date}`;
    }catch(err){
      // Never surface a raw browser error like "Failed to fetch" — always a friendly message.
      status.textContent = 'Exchange rates are temporarily unavailable. Please try again in a moment.';
      toast('Could not load exchange rates right now — please try again shortly.', 'err');
    }
  }

  document.getElementById('curAmount').addEventListener('input', runCurrencyConversion);
  fromSel.addEventListener('change', runCurrencyConversion);
  toSel.addEventListener('change', runCurrencyConversion);
  document.getElementById('curSwapBtn').onclick = () => {
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
    runCurrencyConversion();
  };

  runCurrencyConversion();
}

/* ============ IMAGE CROP TOOL (image-tools.html) ============
   Full-resolution crop is always reconstructed from the original image at
   download time — the on-screen canvas may be downscaled for performance,
   but exported files are never limited by that display resolution. */
if (document.getElementById('cropCanvas')){
  let cropImg = null;
  let cropRotation = 0;
  let cropAspect = null; // null = free
  let cropBox = { x: 0, y: 0, w: 100, h: 100 };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const loadImg = loadImageFromFile;

  function setCropLoading(on){
    document.getElementById('cropLoading').classList.toggle('show', on);
  }

  setupDropZone('cropDrop','cropInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f){ if (files.length>0) toast('Please select an image file.', 'err'); return; }
    setCropLoading(true);
    try{
      cropImg = await loadImg(f);
      cropRotation = 0;
      document.getElementById('cropStageWrap').classList.remove('hidden');
      setupCropCanvas();
      toast('Image loaded.');
    }catch(err){
      toast(err.message, 'err');
    }finally{
      setCropLoading(false);
    }
  });

  function setupCropCanvas(){
    const canvas = document.getElementById('cropCanvas');
    const ctx = canvas.getContext('2d');
    const swapped = (cropRotation === 90 || cropRotation === 270);
    const preW = cropImg.naturalWidth, preH = cropImg.naturalHeight;
    let w = swapped ? preH : preW;
    let h = swapped ? preW : preH;
    const MAX = 900;
    if (Math.max(w, h) > MAX){ const sc = MAX / Math.max(w, h); w = Math.round(w*sc); h = Math.round(h*sc); }
    canvas.width = w; canvas.height = h;
    const s = swapped ? w / preH : w / preW;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.rotate(cropRotation * Math.PI / 180);
    ctx.drawImage(cropImg, -preW*s/2, -preH*s/2, preW*s, preH*s);
    ctx.restore();
    cropBox = { x: 0, y: 0, w, h };
    requestAnimationFrame(renderCropBox);
  }

  function renderCropBox(){
    const canvas = document.getElementById('cropCanvas');
    const stage = document.getElementById('cropStage');
    const rect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const box = document.getElementById('cropBoxEl');
    box.style.left = ((rect.left - stageRect.left) + cropBox.x*scale) + 'px';
    box.style.top = ((rect.top - stageRect.top) + cropBox.y*scale) + 'px';
    box.style.width = (cropBox.w*scale) + 'px';
    box.style.height = (cropBox.h*scale) + 'px';
    updateCropPreview();
  }

  function updateCropPreview(){
    const canvas = document.getElementById('cropCanvas');
    const prev = document.getElementById('cropPreview');
    const pctx = prev.getContext('2d');
    prev.width = 160; prev.height = Math.max(1, Math.round(160 * (cropBox.h / cropBox.w)));
    pctx.clearRect(0,0,prev.width,prev.height);
    if (cropBox.w > 0 && cropBox.h > 0){
      pctx.drawImage(canvas, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, prev.width, prev.height);
    }
  }

  function setAspect(ratio){
    cropAspect = ratio;
    const canvas = document.getElementById('cropCanvas');
    let w = canvas.width, h = canvas.height;
    if (ratio){
      if (w / h > ratio) w = h * ratio; else h = w / ratio;
    }
    cropBox = { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, w, h };
    renderCropBox();
  }
  const ASPECT_RATIOS = { square: 1, '16:9': 16/9, '9:16': 9/16 };
  document.querySelectorAll('.crop-aspect-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.crop-aspect-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.dataset.ratio;
      setAspect(r === 'free' ? null : ASPECT_RATIOS[r]);
    };
  });

  // Drag to move
  const boxEl = document.getElementById('cropBoxEl');
  boxEl.addEventListener('pointerdown', (e) => {
    if (e.target !== boxEl) return;
    e.preventDefault();
    boxEl.setPointerCapture(e.pointerId);
    const canvas = document.getElementById('cropCanvas');
    const scale = canvas.getBoundingClientRect().width / canvas.width;
    const startX = e.clientX, startY = e.clientY;
    const startBox = { ...cropBox };
    function onMove(ev){
      const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
      cropBox.x = clamp(startBox.x + dx, 0, canvas.width - cropBox.w);
      cropBox.y = clamp(startBox.y + dy, 0, canvas.height - cropBox.h);
      renderCropBox();
    }
    function onUp(){
      boxEl.releasePointerCapture(e.pointerId);
      boxEl.removeEventListener('pointermove', onMove);
      boxEl.removeEventListener('pointerup', onUp);
    }
    boxEl.addEventListener('pointermove', onMove);
    boxEl.addEventListener('pointerup', onUp);
  });

  // Resize via corner handles
  function setupHandle(handleEl, corner){
    handleEl.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      handleEl.setPointerCapture(e.pointerId);
      const canvas = document.getElementById('cropCanvas');
      const scale = canvas.getBoundingClientRect().width / canvas.width;
      const startX = e.clientX, startY = e.clientY;
      const startBox = { ...cropBox };
      function onMove(ev){
        const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
        let { x, y, w, h } = startBox;
        if (corner === 'br'){ w = startBox.w + dx; h = startBox.h + dy; }
        else if (corner === 'bl'){ x = startBox.x + dx; w = startBox.w - dx; h = startBox.h + dy; }
        else if (corner === 'tr'){ w = startBox.w + dx; y = startBox.y + dy; h = startBox.h - dy; }
        else { x = startBox.x + dx; y = startBox.y + dy; w = startBox.w - dx; h = startBox.h - dy; }
        if (cropAspect){
          h = w / cropAspect;
          if (corner === 'tl' || corner === 'tr') y = startBox.y + startBox.h - h;
          if (corner === 'tl' || corner === 'bl') x = startBox.x + startBox.w - w;
        }
        w = Math.max(20, w); h = Math.max(20, h);
        x = clamp(x, 0, canvas.width - w);
        y = clamp(y, 0, canvas.height - h);
        cropBox = { x, y, w, h };
        renderCropBox();
      }
      function onUp(){
        handleEl.releasePointerCapture(e.pointerId);
        handleEl.removeEventListener('pointermove', onMove);
        handleEl.removeEventListener('pointerup', onUp);
      }
      handleEl.addEventListener('pointermove', onMove);
      handleEl.addEventListener('pointerup', onUp);
    });
  }
  ['tl','tr','bl','br'].forEach(c => setupHandle(document.querySelector(`.crop-handle.${c}`), c));

  document.getElementById('cropRotateLeftBtn').onclick = () => {
    cropRotation = (cropRotation + 270) % 360;
    cropAspect = null;
    document.querySelectorAll('.crop-aspect-toggle button').forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));
    setupCropCanvas();
  };
  document.getElementById('cropRotateRightBtn').onclick = () => {
    cropRotation = (cropRotation + 90) % 360;
    cropAspect = null;
    document.querySelectorAll('.crop-aspect-toggle button').forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));
    setupCropCanvas();
  };
  document.getElementById('cropResetBtn').onclick = () => {
    if (!cropImg) return;
    cropRotation = 0;
    cropAspect = null;
    document.querySelectorAll('.crop-aspect-toggle button').forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));
    setupCropCanvas();
  };
  document.getElementById('cropDownloadBtn').onclick = () => {
    if (!cropImg){ toast('Load an image first.', 'err'); return; }
    setCropLoading(true);
    try{
      const canvas = document.getElementById('cropCanvas');
      const swapped = (cropRotation === 90 || cropRotation === 270);
      const preW = cropImg.naturalWidth, preH = cropImg.naturalHeight;
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = swapped ? preH : preW;
      fullCanvas.height = swapped ? preW : preH;
      const fctx = fullCanvas.getContext('2d');
      fctx.save();
      fctx.translate(fullCanvas.width/2, fullCanvas.height/2);
      fctx.rotate(cropRotation * Math.PI / 180);
      fctx.drawImage(cropImg, -preW/2, -preH/2);
      fctx.restore();

      const scaleUp = fullCanvas.width / canvas.width;
      const outW = Math.max(1, Math.round(cropBox.w * scaleUp));
      const outH = Math.max(1, Math.round(cropBox.h * scaleUp));
      const out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      out.getContext('2d').drawImage(fullCanvas, cropBox.x*scaleUp, cropBox.y*scaleUp, cropBox.w*scaleUp, cropBox.h*scaleUp, 0, 0, outW, outH);
      out.toBlob((blob) => {
        setCropLoading(false);
        if (!blob){ toast('Could not export this image.', 'err'); return; }
        downloadBlob(blob, 'cropped.png');
        toast('Cropped image downloaded.');
      }, 'image/png');
    }catch(err){
      setCropLoading(false);
      toast('Crop failed: ' + err.message, 'err');
    }
  };

  window.addEventListener('resize', () => { if (cropImg) renderCropBox(); });
}

/* ============ IMAGE WATERMARK TOOL (image-tools.html) ============ */
if (document.getElementById('wmCanvas')){
  let wmBaseImg = null;
  let wmLogoImg = null;
  let wmPos = { xFrac: 0.85, yFrac: 0.9 }; // fractional position, draggable
  const loadImg2 = loadImageFromFile;
  function setWmLoading(on){ document.getElementById('wmLoading').classList.toggle('show', on); }

  setupDropZone('wmDrop','wmInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f){ if (files.length>0) toast('Please select an image file.', 'err'); return; }
    setWmLoading(true);
    try{
      wmBaseImg = await loadImg2(f);
      document.getElementById('wmStageWrap').classList.remove('hidden');
      drawWatermark();
      toast('Image loaded.');
    }catch(err){ toast(err.message, 'err'); }
    finally{ setWmLoading(false); }
  });

  setupDropZone('wmLogoDrop','wmLogoInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f) return;
    try{ wmLogoImg = await loadImg2(f); drawWatermark(); toast('Logo loaded.'); }
    catch(err){ toast(err.message, 'err'); }
  });

  function currentWmType(){
    return document.querySelector('.wm-type-toggle button.active').dataset.type;
  }

  function drawWatermark(){
    if (!wmBaseImg) return;
    const canvas = document.getElementById('wmCanvas');
    const ctx = canvas.getContext('2d');
    const MAX = 900;
    let w = wmBaseImg.naturalWidth, h = wmBaseImg.naturalHeight;
    if (Math.max(w,h) > MAX){ const sc = MAX/Math.max(w,h); w=Math.round(w*sc); h=Math.round(h*sc); }
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(wmBaseImg, 0, 0, w, h);

    const opacity = parseInt(document.getElementById('wmOpacity').value,10) / 100;
    ctx.globalAlpha = opacity;

    const type = currentWmType();
    const x = wmPos.xFrac * w, y = wmPos.yFrac * h;
    if (type === 'text'){
      const text = document.getElementById('wmText').value || 'Watermark';
      const fontSize = parseInt(document.getElementById('wmFontSize').value,10);
      const color = document.getElementById('wmColor').value;
      ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y);
    } else if (wmLogoImg){
      const logoW = w * 0.22;
      const logoH = logoW * (wmLogoImg.naturalHeight / wmLogoImg.naturalWidth);
      ctx.drawImage(wmLogoImg, x - logoW/2, y - logoH/2, logoW, logoH);
    }
    ctx.globalAlpha = 1;
    document.getElementById('wmDownloadBtn').classList.remove('hidden');
  }

  document.querySelectorAll('.wm-type-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.wm-type-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('wmTextFields').classList.toggle('hidden', btn.dataset.type !== 'text');
      document.getElementById('wmLogoFields').classList.toggle('hidden', btn.dataset.type !== 'logo');
      drawWatermark();
    };
  });

  ['wmText','wmFontSize','wmColor','wmOpacity'].forEach(id => {
    document.getElementById(id).addEventListener('input', drawWatermark);
  });

  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const map = {
        'tl': [0.15, 0.1], 'tr': [0.85, 0.1], 'c': [0.5, 0.5], 'bl': [0.15, 0.9], 'br': [0.85, 0.9]
      };
      const p = map[btn.dataset.pos];
      if (p){ wmPos = { xFrac: p[0], yFrac: p[1] }; drawWatermark(); }
    };
  });

  // Drag watermark directly on canvas
  const wmCanvas = document.getElementById('wmCanvas');
  wmCanvas.addEventListener('pointerdown', (e) => {
    if (!wmBaseImg) return;
    wmCanvas.setPointerCapture(e.pointerId);
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    function move(ev){
      const rect = wmCanvas.getBoundingClientRect();
      const xFrac = clampNum((ev.clientX - rect.left) / rect.width, 0, 1);
      const yFrac = clampNum((ev.clientY - rect.top) / rect.height, 0, 1);
      wmPos = { xFrac, yFrac };
      drawWatermark();
    }
    function up(){
      wmCanvas.releasePointerCapture(e.pointerId);
      wmCanvas.removeEventListener('pointermove', move);
      wmCanvas.removeEventListener('pointerup', up);
    }
    move(e);
    wmCanvas.addEventListener('pointermove', move);
    wmCanvas.addEventListener('pointerup', up);
  });
  function clampNum(v,min,max){ return Math.max(min,Math.min(max,v)); }

  document.getElementById('wmDownloadBtn').onclick = () => {
    if (!wmBaseImg) return;
    setWmLoading(true);
    try{
      const full = document.createElement('canvas');
      full.width = wmBaseImg.naturalWidth; full.height = wmBaseImg.naturalHeight;
      const fctx = full.getContext('2d');
      fctx.drawImage(wmBaseImg, 0, 0);
      const opacity = parseInt(document.getElementById('wmOpacity').value,10) / 100;
      fctx.globalAlpha = opacity;
      const type = currentWmType();
      const x = wmPos.xFrac * full.width, y = wmPos.yFrac * full.height;
      if (type === 'text'){
        const text = document.getElementById('wmText').value || 'Watermark';
        const fontSize = parseInt(document.getElementById('wmFontSize').value,10) * (full.width / document.getElementById('wmCanvas').width);
        fctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
        fctx.fillStyle = document.getElementById('wmColor').value;
        fctx.textBaseline = 'middle';
        fctx.textAlign = 'center';
        fctx.fillText(text, x, y);
      } else if (wmLogoImg){
        const logoW = full.width * 0.22;
        const logoH = logoW * (wmLogoImg.naturalHeight / wmLogoImg.naturalWidth);
        fctx.drawImage(wmLogoImg, x - logoW/2, y - logoH/2, logoW, logoH);
      }
      fctx.globalAlpha = 1;
      full.toBlob((blob) => {
        setWmLoading(false);
        if (!blob){ toast('Could not export this image.', 'err'); return; }
        downloadBlob(blob, 'watermarked.png');
        toast('Watermarked image downloaded.');
      }, 'image/png');
    }catch(err){
      setWmLoading(false);
      toast('Watermarking failed: ' + err.message, 'err');
    }
  };
}

/* ============ IMAGE ROTATE & FLIP TOOL (image-tools.html) ============ */
if (document.getElementById('rfCanvas')){
  let rfImg = null;
  let rfRotation = 0;
  let rfFlipH = false;
  let rfFlipV = false;
  const loadImg3 = loadImageFromFile;
  function setRfLoading(on){ document.getElementById('rfLoading').classList.toggle('show', on); }

  setupDropZone('rfDrop','rfInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f){ if (files.length>0) toast('Please select an image file.', 'err'); return; }
    setRfLoading(true);
    try{
      rfImg = await loadImg3(f);
      rfRotation = 0; rfFlipH = false; rfFlipV = false;
      document.getElementById('rfStageWrap').classList.remove('hidden');
      drawRotateFlip();
      toast('Image loaded.');
    }catch(err){ toast(err.message, 'err'); }
    finally{ setRfLoading(false); }
  });

  function drawRotateFlip(){
    const canvas = document.getElementById('rfCanvas');
    const ctx = canvas.getContext('2d');
    const swapped = (rfRotation === 90 || rfRotation === 270);
    const MAX = 900;
    let preW = rfImg.naturalWidth, preH = rfImg.naturalHeight;
    let w = swapped ? preH : preW, h = swapped ? preW : preH;
    if (Math.max(w,h) > MAX){ const sc = MAX/Math.max(w,h); w=Math.round(w*sc); h=Math.round(h*sc); preW=Math.round(preW*sc); preH=Math.round(preH*sc); }
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.translate(w/2, h/2);
    ctx.rotate(rfRotation * Math.PI/180);
    ctx.scale(rfFlipH ? -1 : 1, rfFlipV ? -1 : 1);
    ctx.drawImage(rfImg, -preW/2, -preH/2, preW, preH);
    ctx.restore();
  }

  document.getElementById('rfRotate90Btn').onclick = () => { if(!rfImg)return; rfRotation=(rfRotation+90)%360; drawRotateFlip(); };
  document.getElementById('rfRotate180Btn').onclick = () => { if(!rfImg)return; rfRotation=(rfRotation+180)%360; drawRotateFlip(); };
  document.getElementById('rfRotate270Btn').onclick = () => { if(!rfImg)return; rfRotation=(rfRotation+270)%360; drawRotateFlip(); };
  document.getElementById('rfFlipHBtn').onclick = () => { if(!rfImg)return; rfFlipH=!rfFlipH; drawRotateFlip(); };
  document.getElementById('rfFlipVBtn').onclick = () => { if(!rfImg)return; rfFlipV=!rfFlipV; drawRotateFlip(); };
  document.getElementById('rfResetBtn').onclick = () => { if(!rfImg)return; rfRotation=0; rfFlipH=false; rfFlipV=false; drawRotateFlip(); };

  document.getElementById('rfDownloadBtn').onclick = () => {
    if (!rfImg){ toast('Load an image first.', 'err'); return; }
    setRfLoading(true);
    try{
      const swapped = (rfRotation === 90 || rfRotation === 270);
      const preW = rfImg.naturalWidth, preH = rfImg.naturalHeight;
      const out = document.createElement('canvas');
      out.width = swapped ? preH : preW;
      out.height = swapped ? preW : preH;
      const octx = out.getContext('2d');
      octx.save();
      octx.translate(out.width/2, out.height/2);
      octx.rotate(rfRotation * Math.PI/180);
      octx.scale(rfFlipH ? -1 : 1, rfFlipV ? -1 : 1);
      octx.drawImage(rfImg, -preW/2, -preH/2);
      octx.restore();
      out.toBlob((blob) => {
        setRfLoading(false);
        if (!blob){ toast('Could not export this image.', 'err'); return; }
        downloadBlob(blob, 'rotated.png');
        toast('Image downloaded.');
      }, 'image/png');
    }catch(err){
      setRfLoading(false);
      toast('Rotate/flip failed: ' + err.message, 'err');
    }
  };
}

/* ============ AI BACKGROUND REMOVER (image-tools.html) ============
   Uses Google's MediaPipe Image Segmenter (Apache 2.0 license, free for
   commercial use, no API key). Runs entirely in the browser — the model
   (~a few MB) downloads once on first use and is cached by the browser
   after that. Version is pinned deliberately since Google labels this a
   "Preview" API; bump MP_VERSION only after testing. */
if (document.getElementById('aiRemoveDrop')){
  const MP_VERSION = '0.10.2';
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite';
  let segmenter = null;
  let segmenterLoadPromise = null;
  let aiSourceImg = null;
  let aiResultCanvas = null;
  const loadImgAi = loadImageFromFile;

  function setAiStatus(state, message){
    const el = document.getElementById('aiModelStatus');
    if (!el) return;
    el.className = 'model-status-line' + (state ? ' ' + state : '');
    const label = el.querySelector('span');
    if (label) label.textContent = message;
  }

  async function ensureSegmenter(){
    if (segmenter) return segmenter;
    if (!segmenterLoadPromise){
      segmenterLoadPromise = (async () => {
        setAiStatus('', 'Loading AI model (first use only, a few MB, cached after)…');
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`);
        const { ImageSegmenter, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
        );
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
          runningMode: 'IMAGE'
        });
        segmenter = seg;
        setAiStatus('ready', 'AI model ready.');
        return seg;
      })().catch((err) => {
        setAiStatus('error', 'Could not load the AI model — check your connection and try again.');
        segmenterLoadPromise = null;
        throw err;
      });
    }
    return segmenterLoadPromise;
  }

  setupDropZone('aiRemoveDrop','aiRemoveInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > 50*1024*1024){ toast(`That image is ${fmtBytes(f.size)} — the limit is 50 MB.`, 'err'); return; }
    try{
      aiSourceImg = await loadImgAi(f);
      document.getElementById('aiRemoveStage').classList.remove('hidden');
      const wrap = document.getElementById('aiRemovePreview');
      wrap.innerHTML = '';
      const preview = document.createElement('img');
      preview.src = aiSourceImg.src;
      preview.style.maxWidth = '100%';
      preview.style.display = 'block';
      wrap.appendChild(preview);
      document.getElementById('aiRemoveBtn').disabled = false;
      // Warm up the model in the background as soon as an image is loaded.
      ensureSegmenter().catch(() => {});
      toast('Image loaded.');
    }catch(err){
      toast(err.message, 'err');
    }
  });

  document.getElementById('aiRemoveBtn').onclick = async () => {
    const btn = document.getElementById('aiRemoveBtn');
    if (!aiSourceImg){ toast('Load an image first.', 'err'); return; }
    setLoading(btn, true);
    try{
      const seg = await ensureSegmenter();
      await nextFrame();

      const MAX = 1200;
      let w = aiSourceImg.naturalWidth, h = aiSourceImg.naturalHeight;
      if (Math.max(w, h) > MAX){ const sc = MAX / Math.max(w, h); w = Math.round(w*sc); h = Math.round(h*sc); }

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w; srcCanvas.height = h;
      srcCanvas.getContext('2d').drawImage(aiSourceImg, 0, 0, w, h);

      const result = await new Promise((resolve, reject) => {
        try{ seg.segment(srcCanvas, (res) => resolve(res)); }
        catch(err){ reject(err); }
      });

      if (!result || !result.categoryMask){ throw new Error('The AI model did not return a result for this image.'); }
      const maskData = result.categoryMask.getAsUint8Array();
      const maskW = result.categoryMask.width || w;
      const maskH = result.categoryMask.height || h;

      const outCanvas = document.createElement('canvas');
      outCanvas.width = w; outCanvas.height = h;
      const octx = outCanvas.getContext('2d');
      octx.drawImage(srcCanvas, 0, 0);
      const imageData = octx.getImageData(0, 0, w, h);
      const pixels = imageData.data;

      for (let y = 0; y < h; y++){
        for (let x = 0; x < w; x++){
          const mx = Math.min(maskW - 1, Math.floor((x / w) * maskW));
          const my = Math.min(maskH - 1, Math.floor((y / h) * maskH));
          const category = maskData[my * maskW + mx];
          if (category === 0){ // category 0 = background in this model
            pixels[((y * w) + x) * 4 + 3] = 0;
          }
        }
      }
      octx.putImageData(imageData, 0, 0);
      if (result.categoryMask.close) result.categoryMask.close();

      aiResultCanvas = outCanvas;
      initManualEditor(srcCanvas, outCanvas);
      document.getElementById('aiRemoveDownloadRow').classList.remove('hidden');
      document.getElementById('sendToAiChangerBtn').classList.remove('hidden');
      toast('Background removed. Refine it below if needed.');
    }catch(err){
      // Error recovery: don't strand the user — let them continue in Manual Mode
      // on the image they already uploaded, using Brush/Eraser/Wand/Polygon/Lasso.
      try{
        const MAX = 1200;
        let w = aiSourceImg.naturalWidth, h = aiSourceImg.naturalHeight;
        if (Math.max(w, h) > MAX){ const sc = MAX / Math.max(w, h); w = Math.round(w*sc); h = Math.round(h*sc); }
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = w; srcCanvas.height = h;
        srcCanvas.getContext('2d').drawImage(aiSourceImg, 0, 0, w, h);
        const fallback = document.createElement('canvas');
        fallback.width = w; fallback.height = h;
        const fctx = fallback.getContext('2d');
        fctx.drawImage(srcCanvas, 0, 0); // fully opaque — nothing removed yet
        aiResultCanvas = fallback;
        initManualEditor(srcCanvas, fallback);
        document.getElementById('aiRemoveDownloadRow').classList.remove('hidden');
        document.getElementById('sendToAiChangerBtn').classList.remove('hidden');
        toast('AI processing failed, but your image is safe — use the manual tools below (start with Lasso or Polygon).', 'err');
      }catch(fallbackErr){
        toast('AI background removal failed: ' + (err.message || 'please try a different image.'), 'err');
      }
    }finally{
      setLoading(btn, false, 'Remove background (AI)');
    }
  };

  document.getElementById('aiRemoveDownloadBtn').onclick = () => {
    if (!aiResultCanvas){ toast('Remove a background first.', 'err'); return; }
    aiResultCanvas.toBlob((blob) => {
      if (!blob){ toast('Could not export this image.', 'err'); return; }
      downloadBlob(blob, 'background-removed.png');
    }, 'image/png');
  };

  document.getElementById('sendToAiChangerBtn').onclick = () => {
    if (!aiResultCanvas) return;
    selectTool('bg-changer');
    if (typeof receiveForegroundForAiChanger === 'function') receiveForegroundForAiChanger(aiResultCanvas);
    toast('Sent to Background Changer.');
  };

  /* ---------- Manual Selection Editor ---------- */
  let originalCanvas = null;   // full-color source, never modified
  let maskCanvas = null;       // grayscale keep-mask (red channel = keep amount 0-255)
  let editCanvas = null;       // visible live-composited canvas (original * mask alpha)
  let currentTool = 'brush';
  let selectMode = 'add';      // add|subtract — used by wand/polygon/lasso
  let brushSize = 40, brushSoftness = 50, wandTolerance = 30;
  let historyStack = [], historyIndex = -1;
  const MAX_HISTORY = 25;
  let polygonPoints = [], lassoPoints = [];
  let isDrawingStroke = false;
  let spacePan = false;

  function initManualEditor(srcColorCanvas, aiOutputCanvas){
    const w = srcColorCanvas.width, h = srcColorCanvas.height;
    originalCanvas = document.createElement('canvas');
    originalCanvas.width = w; originalCanvas.height = h;
    originalCanvas.getContext('2d').drawImage(srcColorCanvas, 0, 0);

    maskCanvas = document.createElement('canvas');
    maskCanvas.width = w; maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    // Seed the mask from the AI result's alpha channel
    const aiData = aiOutputCanvas.getContext('2d').getImageData(0, 0, w, h);
    const maskData = mctx.createImageData(w, h);
    for (let i = 0; i < aiData.data.length; i += 4){
      const a = aiData.data[i+3];
      maskData.data[i] = a; maskData.data[i+1] = a; maskData.data[i+2] = a; maskData.data[i+3] = 255;
    }
    mctx.putImageData(maskData, 0, 0);

    editCanvas = document.getElementById('aiEditCanvas');
    editCanvas.width = w; editCanvas.height = h;

    historyStack = []; historyIndex = -1;
    pushHistory();
    renderComposite();

    document.getElementById('aiEditorPanel').classList.remove('hidden');
    setZoom(100);
    setTool('brush');
  }

  function renderComposite(){
    const w = originalCanvas.width, h = originalCanvas.height;
    const ectx = editCanvas.getContext('2d');
    const colorData = originalCanvas.getContext('2d').getImageData(0, 0, w, h);
    const maskData = maskCanvas.getContext('2d').getImageData(0, 0, w, h);
    const out = ectx.createImageData(w, h);
    for (let i = 0; i < colorData.data.length; i += 4){
      out.data[i] = colorData.data[i];
      out.data[i+1] = colorData.data[i+1];
      out.data[i+2] = colorData.data[i+2];
      out.data[i+3] = maskData.data[i]; // red channel of mask = keep amount
    }
    ectx.putImageData(out, 0, 0);
    aiResultCanvas = editCanvas; // keep download/send-to-changer pointed at the live edit
  }

  function pushHistory(){
    if (!maskCanvas) return;
    const snap = maskCanvas.getContext('2d').getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    historyIndex = historyStack.length - 1;
    if (typeof autoSaveSession === 'function') autoSaveSession();
  }
  function restoreHistory(idx){
    if (idx < 0 || idx >= historyStack.length) return;
    maskCanvas.getContext('2d').putImageData(historyStack[idx], 0, 0);
    historyIndex = idx;
    renderComposite();
  }
  function undo(){ if (historyIndex > 0) restoreHistory(historyIndex - 1); else toast('Nothing to undo.'); }
  function redo(){ if (historyIndex < historyStack.length - 1) restoreHistory(historyIndex + 1); else toast('Nothing to redo.'); }

  function setTool(tool){
    currentTool = tool;
    document.querySelectorAll('.editor-tool-btn').forEach(b => {
      const isActive = b.dataset.tool === tool;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    document.getElementById('aiEditStageWrap').className = 'editor-stage-wrap tool-' + tool + (overlayMode ? ' overlay-on' : '');
    polygonPoints = []; lassoPoints = [];
  }
  document.querySelectorAll('.editor-tool-btn').forEach(btn => {
    btn.onclick = () => setTool(btn.dataset.tool);
  });
  document.querySelectorAll('.select-mode-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.select-mode-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectMode = btn.dataset.mode;
    };
  });

  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushSoftSlider = document.getElementById('brushSoftSlider');
  const wandToleranceSlider = document.getElementById('wandToleranceSlider');
  if (brushSizeSlider) brushSizeSlider.oninput = (e) => { brushSize = +e.target.value; document.getElementById('brushSizeVal').textContent = brushSize; };
  if (brushSoftSlider) brushSoftSlider.oninput = (e) => { brushSoftness = +e.target.value; document.getElementById('brushSoftVal').textContent = brushSoftness; };
  if (wandToleranceSlider) wandToleranceSlider.oninput = (e) => { wandTolerance = +e.target.value; document.getElementById('wandToleranceVal').textContent = wandTolerance; };

  function canvasPointFromEvent(e){
    const rect = editCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * editCanvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * editCanvas.height;
    return { x, y };
  }

  function paintDab(x, y, erase){
    const mctx = maskCanvas.getContext('2d');
    const hardStop = Math.max(0, 1 - brushSoftness / 100);
    const grad = mctx.createRadialGradient(x, y, brushSize/2 * hardStop, x, y, brushSize/2);
    if (erase){
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
    }
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(x, y, brushSize/2, 0, Math.PI*2);
    mctx.fill();
  }

  function magicWandAt(x, y, tolerance, subtract){
    const w = originalCanvas.width, h = originalCanvas.height;
    const cData = originalCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const mctx = maskCanvas.getContext('2d');
    const mData = mctx.getImageData(0, 0, w, h);
    const startX = Math.round(x), startY = Math.round(y);
    if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;
    const startI = (startY*w+startX)*4;
    const r0 = cData[startI], g0 = cData[startI+1], b0 = cData[startI+2];
    const visited = new Uint8Array(w*h);
    const stack = [startY*w+startX];
    const tol = tolerance * 2.6; // scale 0-100 to a usable RGB-distance range
    while (stack.length){
      const p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;
      const px = p % w, py = (p - px) / w;
      const ci = p*4;
      const dr = cData[ci]-r0, dg = cData[ci+1]-g0, db = cData[ci+2]-b0;
      if (Math.sqrt(dr*dr+dg*dg+db*db) > tol) continue;
      const v = subtract ? 0 : 255;
      mData.data[ci] = v; mData.data[ci+1] = v; mData.data[ci+2] = v; mData.data[ci+3] = 255;
      if (px>0) stack.push(p-1);
      if (px<w-1) stack.push(p+1);
      if (py>0) stack.push(p-w);
      if (py<h-1) stack.push(p+w);
    }
    mctx.putImageData(mData, 0, 0);
  }

  function fillPathIntoMask(points, subtract){
    if (points.length < 3) return;
    const mctx = maskCanvas.getContext('2d');
    mctx.fillStyle = subtract ? '#000000' : '#ffffff';
    mctx.globalCompositeOperation = subtract ? 'destination-out' : 'source-over';
    if (subtract){
      // destination-out needs a solid alpha shape; draw then let compositing punch a hole
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      mctx.globalCompositeOperation = 'lighten';
    }
    mctx.beginPath();
    mctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) mctx.lineTo(points[i].x, points[i].y);
    mctx.closePath();
    mctx.fill();
    mctx.globalCompositeOperation = 'source-over';
  }

  function drawInProgressPath(points, closeLoop){
    renderComposite();
    const ectx = editCanvas.getContext('2d');
    if (points.length < 2) return;
    ectx.save();
    ectx.strokeStyle = '#6D5EF5';
    ectx.lineWidth = Math.max(1, editCanvas.width / 500);
    ectx.setLineDash([6,4]);
    ectx.beginPath();
    ectx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ectx.lineTo(points[i].x, points[i].y);
    if (closeLoop) ectx.closePath();
    ectx.stroke();
    ectx.restore();
  }

  editCanvas = null; // real element assigned in initManualEditor; listeners below use getElementById lazily
  const editStageWrap = document.getElementById('aiEditStageWrap');

  editStageWrap.addEventListener('pointerdown', (e) => {
    if (!maskCanvas || spacePan) return;
    const canvas = document.getElementById('aiEditCanvas');
    editCanvas = canvas;
    const pt = canvasPointFromEvent(e);

    if (currentTool === 'brush' || currentTool === 'eraser'){
      isDrawingStroke = true;
      canvas.setPointerCapture(e.pointerId);
      paintDab(pt.x, pt.y, currentTool === 'eraser');
      renderComposite();
    } else if (currentTool === 'edge'){
      isDrawingStroke = true;
      canvas.setPointerCapture(e.pointerId);
      edgeRefineDab(pt.x, pt.y);
      renderComposite();
    } else if (currentTool === 'wand'){
      magicWandAt(pt.x, pt.y, wandTolerance, selectMode === 'subtract');
      renderComposite();
      pushHistory();
    } else if (currentTool === 'polygon'){
      polygonPoints.push(pt);
      drawInProgressPath(polygonPoints, false);
    } else if (currentTool === 'lasso'){
      isDrawingStroke = true;
      lassoPoints = [pt];
      canvas.setPointerCapture(e.pointerId);
    }
  });
  editStageWrap.addEventListener('pointermove', (e) => {
    if (!maskCanvas || spacePan) return;
    const pt = canvasPointFromEvent(e);
    if (isDrawingStroke && (currentTool === 'brush' || currentTool === 'eraser')){
      paintDab(pt.x, pt.y, currentTool === 'eraser');
      renderComposite();
    } else if (isDrawingStroke && currentTool === 'edge'){
      edgeRefineDab(pt.x, pt.y);
      renderComposite();
    } else if (isDrawingStroke && currentTool === 'lasso'){
      lassoPoints.push(pt);
      drawInProgressPath(lassoPoints, true);
    }
  });
  editStageWrap.addEventListener('pointerup', () => {
    if (isDrawingStroke && (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'edge')){
      isDrawingStroke = false;
      pushHistory();
    } else if (isDrawingStroke && currentTool === 'lasso'){
      isDrawingStroke = false;
      fillPathIntoMask(lassoPoints, selectMode === 'subtract');
      lassoPoints = [];
      renderComposite();
      pushHistory();
    }
  });
  editStageWrap.addEventListener('dblclick', () => {
    if (currentTool === 'polygon' && polygonPoints.length >= 3){
      fillPathIntoMask(polygonPoints, selectMode === 'subtract');
      polygonPoints = [];
      renderComposite();
      pushHistory();
    }
  });

  // Zoom controls
  function setZoom(pct){
    const canvas = document.getElementById('aiEditCanvas');
    if (!canvas || !canvas.width) return;
    canvas.style.width = Math.round(canvas.width * (pct/100)) + 'px';
    canvas.style.height = Math.round(canvas.height * (pct/100)) + 'px';
    const sel = document.getElementById('zoomSelect');
    if (sel) sel.value = String(pct);
  }
  const zoomSelect = document.getElementById('zoomSelect');
  if (zoomSelect) zoomSelect.onchange = (e) => setZoom(+e.target.value);
  editStageWrap.addEventListener('wheel', (e) => {
    if (!maskCanvas) return;
    e.preventDefault();
    const current = zoomSelect ? +zoomSelect.value : 100;
    const next = Math.max(25, Math.min(400, current + (e.deltaY < 0 ? 15 : -15)));
    setZoom(next);
  }, { passive: false });

  // Space = pan (native scroll does the actual panning; this just changes cursor/behavior)
  document.addEventListener('keydown', (e) => {
    const panel = document.getElementById('aiEditorPanel');
    if (!panel || panel.classList.contains('hidden')) return;
    if (e.code === 'Space' && !spacePan){
      spacePan = true;
      editStageWrap.classList.add('panning');
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){
      undo(); e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))){
      redo(); e.preventDefault();
    } else if (e.key === 'Escape'){
      polygonPoints = []; lassoPoints = []; renderComposite();
    } else if (e.key === 'Delete' || e.key === 'Backspace'){
      if (polygonPoints.length || lassoPoints.length){
        polygonPoints = []; lassoPoints = []; renderComposite();
      }
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space'){ spacePan = false; editStageWrap.classList.remove('panning'); }
  });

  document.getElementById('undoBtn').onclick = undo;
  document.getElementById('redoBtn').onclick = redo;
  document.getElementById('resetSelBtn').onclick = () => {
    if (!maskCanvas) return;
    restoreHistory(0);
    pushHistory();
    toast('Selection reset to AI result.');
  };
  document.getElementById('invertSelBtn').onclick = () => {
    if (!maskCanvas) return;
    const mctx = maskCanvas.getContext('2d');
    const d = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let i = 0; i < d.data.length; i += 4){
      const inv = 255 - d.data[i];
      d.data[i] = inv; d.data[i+1] = inv; d.data[i+2] = inv;
    }
    mctx.putImageData(d, 0, 0);
    renderComposite();
    pushHistory();
  };

  function blurMask(px){
    if (!maskCanvas || px <= 0) return;
    const w = maskCanvas.width, h = maskCanvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.filter = `blur(${px}px)`;
    tctx.drawImage(maskCanvas, 0, 0);
    const mctx = maskCanvas.getContext('2d');
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(tmp, 0, 0);
  }
  const featherSlider = document.getElementById('featherSlider');
  const smoothSlider = document.getElementById('smoothSlider');
  const expandSlider = document.getElementById('expandSlider');
  if (featherSlider) featherSlider.oninput = (e) => { document.getElementById('featherVal').textContent = e.target.value; };
  if (smoothSlider) smoothSlider.oninput = (e) => { document.getElementById('smoothVal').textContent = e.target.value; };
  if (expandSlider) expandSlider.oninput = (e) => { document.getElementById('expandVal').textContent = e.target.value; };
  if (featherSlider) featherSlider.onchange = (e) => { blurMask(+e.target.value); renderComposite(); pushHistory(); };
  if (smoothSlider) smoothSlider.onchange = (e) => { blurMask(+e.target.value); renderComposite(); pushHistory(); };
  if (expandSlider) expandSlider.onchange = (e) => {
    const amt = +e.target.value;
    if (!maskCanvas || amt === 0) return;
    const w = maskCanvas.width, h = maskCanvas.height;
    const mctx = maskCanvas.getContext('2d');
    const src = document.createElement('canvas');
    src.width = w; src.height = h;
    src.getContext('2d').drawImage(maskCanvas, 0, 0);
    mctx.clearRect(0, 0, w, h);
    mctx.globalCompositeOperation = amt > 0 ? 'lighten' : 'darken';
    const steps = 12, radius = Math.abs(amt);
    for (let s = 0; s < steps; s++){
      const angle = (s / steps) * Math.PI * 2;
      mctx.drawImage(src, Math.cos(angle)*radius, Math.sin(angle)*radius);
    }
    mctx.drawImage(src, 0, 0);
    mctx.globalCompositeOperation = 'source-over';
    renderComposite();
    pushHistory();
  };

  /* ---------- Edge Refinement Brush ----------
     Not a re-invocation of the neural network (the segmentation API works on whole
     images only) — this is a real, content-aware refinement: within the brush
     radius it samples a foreground color reference from nearby high-confidence
     mask pixels, then blends the mask toward "keep" or "remove" based on how
     close each pixel's actual color is to that reference. This tends to snap
     rough AI edges onto real hair/fur color boundaries far better than a plain
     uniform brush, without claiming to be something it isn't. */
  function edgeRefineDab(x, y){
    const w = maskCanvas.width, h = maskCanvas.height;
    const cData = originalCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const mctx = maskCanvas.getContext('2d');
    const radius = Math.max(6, brushSize/2);
    const cx = Math.round(x), cy = Math.round(y);
    const x0 = Math.max(0, Math.floor(cx-radius)), x1 = Math.min(w, Math.ceil(cx+radius));
    const y0 = Math.max(0, Math.floor(cy-radius)), y1 = Math.min(h, Math.ceil(cy+radius));
    if (x1 <= x0 || y1 <= y0) return;
    const mData = mctx.getImageData(x0, y0, x1-x0, y1-y0);
    const mw = x1-x0;

    let refR=0, refG=0, refB=0, refCount=0;
    const sampleR = Math.max(2, Math.round(radius*0.3));
    for (let dy=-sampleR; dy<=sampleR; dy++){
      for (let dx=-sampleR; dx<=sampleR; dx++){
        const px=cx+dx, py=cy+dy;
        if (px<0||py<0||px>=w||py>=h) continue;
        const pi=(py*w+px)*4;
        if (cData[pi+3] !== undefined){} // no-op, keeps V8 shape stable
        const mi = ((py-y0)*mw+(px-x0))*4;
        if (mData.data[mi] > 200){ refR+=cData[pi]; refG+=cData[pi+1]; refB+=cData[pi+2]; refCount++; }
      }
    }
    if (refCount === 0){
      const ci = (cy*w+cx)*4;
      refR = cData[ci]; refG = cData[ci+1]; refB = cData[ci+2]; refCount = 1;
    }
    refR/=refCount; refG/=refCount; refB/=refCount;

    const r2 = radius*radius;
    for (let py = y0; py < y1; py++){
      for (let px = x0; px < x1; px++){
        const dx = px-cx, dy = py-cy;
        const distSq = dx*dx+dy*dy;
        if (distSq > r2) continue;
        const ci = (py*w+px)*4;
        const mi = ((py-y0)*mw+(px-x0))*4;
        const dr=cData[ci]-refR, dg=cData[ci+1]-refG, db=cData[ci+2]-refB;
        const colorDist = Math.sqrt(dr*dr+dg*dg+db*db);
        const falloff = 1 - Math.sqrt(distSq)/radius;
        const targetKeep = Math.max(0, 255 - colorDist*2.2);
        const strength = falloff * 0.55;
        const newVal = mData.data[mi]*(1-strength) + targetKeep*strength;
        mData.data[mi]=newVal; mData.data[mi+1]=newVal; mData.data[mi+2]=newVal; mData.data[mi+3]=255;
      }
    }
    mctx.putImageData(mData, x0, y0);
  }

  /* ---------- Selection Overlay (red translucent) ---------- */
  let overlayMode = false;
  const overlayToggleBtn = document.getElementById('overlayToggleBtn');
  if (overlayToggleBtn) overlayToggleBtn.onclick = () => {
    overlayMode = !overlayMode;
    overlayToggleBtn.classList.toggle('active', overlayMode);
    overlayToggleBtn.setAttribute('aria-pressed', overlayMode ? 'true' : 'false');
    renderComposite();
  };

  /* ---------- Before / After compare slider ---------- */
  function updateCompareImages(){
    document.getElementById('compareBefore').src = originalCanvas.toDataURL('image/png');
    const onWhite = document.createElement('canvas');
    onWhite.width = originalCanvas.width; onWhite.height = originalCanvas.height;
    const octx = onWhite.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, onWhite.width, onWhite.height);
    octx.drawImage(editCanvas, 0, 0);
    document.getElementById('compareAfter').src = onWhite.toDataURL('image/png');
  }
  const compareToggleBtn = document.getElementById('compareToggleBtn');
  const compareWrap = document.getElementById('compareWrap');
  if (compareToggleBtn) compareToggleBtn.onclick = () => {
    const showing = compareWrap.classList.contains('hidden');
    compareWrap.classList.toggle('hidden', !showing);
    document.getElementById('aiEditCanvas').classList.toggle('hidden', showing);
    compareToggleBtn.setAttribute('aria-pressed', showing ? 'true' : 'false');
    compareToggleBtn.textContent = showing ? 'Back to editing' : 'Before / After';
    if (showing) updateCompareImages();
  };
  const compareHandle = document.getElementById('compareHandle');
  const compareAfterWrap = document.getElementById('compareAfterWrap');
  if (compareHandle){
    function setComparePct(clientX){
      const rect = compareWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      compareAfterWrap.style.width = pct + '%';
      compareHandle.style.left = pct + '%';
    }
    compareHandle.addEventListener('pointerdown', (e) => {
      compareHandle.setPointerCapture(e.pointerId);
      function move(ev){ setComparePct(ev.clientX); }
      function up(){
        compareHandle.removeEventListener('pointermove', move);
        compareHandle.removeEventListener('pointerup', up);
      }
      compareHandle.addEventListener('pointermove', move);
      compareHandle.addEventListener('pointerup', up);
    });
    // Keyboard support for the compare handle: Left/Right arrow nudges it
    compareHandle.addEventListener('keydown', (e) => {
      const rect = compareWrap.getBoundingClientRect();
      const current = parseFloat(compareHandle.style.left) || 50;
      if (e.key === 'ArrowLeft'){ setComparePct(rect.left + rect.width*(Math.max(0,current-2)/100)); e.preventDefault(); }
      if (e.key === 'ArrowRight'){ setComparePct(rect.left + rect.width*(Math.min(100,current+2)/100)); e.preventDefault(); }
    });
  }

  /* ---------- Auto Save (localStorage, best-effort) ---------- */
  const AUTOSAVE_KEY = 'toolflight_ai_remover_session';
  let autoSaveTimer = null;
  function autoSaveSession(){
    if (!originalCanvas || !maskCanvas) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      try{
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          ts: Date.now(),
          original: originalCanvas.toDataURL('image/png'),
          mask: maskCanvas.toDataURL('image/png')
        }));
      }catch(e){ /* private-mode or quota exceeded — auto-save is best-effort, fail silently */ }
    }, 900);
  }
  function offerAutoSavedSession(){
    let raw;
    try{ raw = localStorage.getItem(AUTOSAVE_KEY); }catch(e){ return; }
    if (!raw) return;
    let data;
    try{ data = JSON.parse(raw); }catch(e){ return; }
    if (!data || Date.now() - data.ts > 24*60*60*1000){ try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){} return; }
    const banner = document.getElementById('autoSaveBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    document.getElementById('autoSaveResumeBtn').onclick = async () => {
      try{
        const origImg = await loadDataUrlAsImage(data.original);
        const maskImg = await loadDataUrlAsImage(data.mask);
        const oc = document.createElement('canvas'); oc.width = origImg.naturalWidth; oc.height = origImg.naturalHeight;
        oc.getContext('2d').drawImage(origImg, 0, 0);
        const mc = document.createElement('canvas'); mc.width = maskImg.naturalWidth; mc.height = maskImg.naturalHeight;
        mc.getContext('2d').drawImage(maskImg, 0, 0);
        originalCanvas = oc; maskCanvas = mc;
        aiSourceImg = origImg; // resolution-preserving export will use this
        editCanvas = document.getElementById('aiEditCanvas');
        editCanvas.width = oc.width; editCanvas.height = oc.height;
        historyStack = []; historyIndex = -1; pushHistory();
        renderComposite();
        document.getElementById('aiRemoveStage').classList.remove('hidden');
        document.getElementById('aiEditorPanel').classList.remove('hidden');
        document.getElementById('aiRemoveDownloadRow').classList.remove('hidden');
        setZoom(100); setTool('brush');
        banner.classList.add('hidden');
        toast('Previous session restored.');
      }catch(err){
        toast('Could not restore the previous session.', 'err');
        banner.classList.add('hidden');
      }
    };
    document.getElementById('autoSaveDiscardBtn').onclick = () => {
      try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){}
      banner.classList.add('hidden');
    };
  }
  function loadDataUrlAsImage(dataUrl){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Saved session data could not be read.'));
      img.src = dataUrl;
    });
  }
  offerAutoSavedSession();

  /* ---------- High-quality multi-format export ---------- */
  function supportsWorkerExport(){
    return typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function';
  }
  let exportWorker = null;
  function getExportWorker(){
    if (exportWorker) return exportWorker;
    const workerSrc = `
      self.onmessage = async function(e){
        try{
          const { originalBitmap, maskBitmap, w, h } = e.data;
          const oc = new OffscreenCanvas(w, h);
          const octx = oc.getContext('2d');
          octx.drawImage(originalBitmap, 0, 0, w, h);
          const colorData = octx.getImageData(0, 0, w, h);
          const mc = new OffscreenCanvas(w, h);
          const mctx = mc.getContext('2d');
          mctx.drawImage(maskBitmap, 0, 0, w, h);
          const maskData = mctx.getImageData(0, 0, w, h);
          const out = new OffscreenCanvas(w, h);
          const outCtx = out.getContext('2d');
          const outData = outCtx.createImageData(w, h);
          for (let i = 0; i < colorData.data.length; i += 4){
            outData.data[i] = colorData.data[i];
            outData.data[i+1] = colorData.data[i+1];
            outData.data[i+2] = colorData.data[i+2];
            outData.data[i+3] = maskData.data[i];
          }
          outCtx.putImageData(outData, 0, 0);
          const blob = await out.convertToBlob({ type: 'image/png' });
          self.postMessage({ ok: true, blob });
        }catch(err){
          self.postMessage({ ok: false, error: err.message });
        }
      };
    `;
    try{
      exportWorker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'application/javascript' })));
    }catch(e){
      exportWorker = null;
    }
    return exportWorker;
  }
  function buildFullResExportMainThread(){
    const fullW = aiSourceImg.naturalWidth, fullH = aiSourceImg.naturalHeight;
    const fullOriginal = document.createElement('canvas');
    fullOriginal.width = fullW; fullOriginal.height = fullH;
    fullOriginal.getContext('2d').drawImage(aiSourceImg, 0, 0);
    const fullMask = document.createElement('canvas');
    fullMask.width = fullW; fullMask.height = fullH;
    fullMask.getContext('2d').drawImage(maskCanvas, 0, 0, fullW, fullH);
    const out = document.createElement('canvas');
    out.width = fullW; out.height = fullH;
    const octx = out.getContext('2d');
    const colorData = fullOriginal.getContext('2d').getImageData(0, 0, fullW, fullH);
    const maskData = fullMask.getContext('2d').getImageData(0, 0, fullW, fullH);
    const outData = octx.createImageData(fullW, fullH);
    for (let i = 0; i < colorData.data.length; i += 4){
      outData.data[i] = colorData.data[i];
      outData.data[i+1] = colorData.data[i+1];
      outData.data[i+2] = colorData.data[i+2];
      outData.data[i+3] = maskData.data[i];
    }
    octx.putImageData(outData, 0, 0);
    return out;
  }
  async function buildFullResExport(){
    const fullW = aiSourceImg.naturalWidth, fullH = aiSourceImg.naturalHeight;
    if (supportsWorkerExport()){
      try{
        const originalBitmap = await createImageBitmap(aiSourceImg);
        const maskBitmap = await createImageBitmap(maskCanvas);
        const worker = getExportWorker();
        if (!worker) throw new Error('Worker unavailable');
        const blob = await new Promise((resolve, reject) => {
          worker.onmessage = (e) => { e.data.ok ? resolve(e.data.blob) : reject(new Error(e.data.error)); };
          worker.onerror = (err) => reject(err);
          worker.postMessage({ originalBitmap, maskBitmap, w: fullW, h: fullH }, [originalBitmap, maskBitmap]);
        });
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = fullW; canvas.height = fullH;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        return canvas;
      }catch(err){
        return buildFullResExportMainThread(); // graceful fallback, same visual result
      }
    }
    return buildFullResExportMainThread();
  }

  const exportQualitySlider = document.getElementById('exportQuality');
  const exportFormatSelect = document.getElementById('exportFormat');
  if (exportQualitySlider) exportQualitySlider.oninput = (e) => { document.getElementById('exportQualityVal').textContent = e.target.value; };
  if (exportFormatSelect) exportFormatSelect.onchange = (e) => {
    document.getElementById('exportQualityRow').classList.toggle('hidden', e.target.value === 'png');
    document.getElementById('exportBgColorRow').classList.toggle('hidden', e.target.value !== 'jpg');
  };

  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.onclick = async () => {
    if (!maskCanvas || !aiSourceImg){ toast('Nothing to export yet.', 'err'); return; }
    setLoading(exportBtn, true);
    try{
      await nextFrame();
      const format = document.getElementById('exportFormat').value;
      const quality = +document.getElementById('exportQuality').value / 100;
      let finalCanvas = await buildFullResExport();

      let mime = 'image/png', ext = 'png';
      if (format === 'jpg'){
        mime = 'image/jpeg'; ext = 'jpg';
        const bgColor = document.getElementById('exportBgColor').value;
        const flat = document.createElement('canvas');
        flat.width = finalCanvas.width; flat.height = finalCanvas.height;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = bgColor;
        fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(finalCanvas, 0, 0);
        finalCanvas = flat;
      } else if (format === 'webp'){
        mime = 'image/webp'; ext = 'webp';
      }

      finalCanvas.toBlob((blob) => {
        setLoading(exportBtn, false, 'Export image');
        if (!blob){ toast('This browser could not encode that format — try PNG instead.', 'err'); return; }
        downloadBlob(blob, 'toolflight-export.' + ext);
        toast('Exported at full resolution.');
      }, mime, format === 'png' ? undefined : quality);
    }catch(err){
      setLoading(exportBtn, false, 'Export image');
      toast('Export failed: ' + (err.message || 'please try again.'), 'err');
    }
  };

  /* ---------- Mobile: two-finger pinch zoom + two-finger pan ---------- */
  let pinchStartDist = null, pinchStartZoom = 100, pinchStartMid = null, pinchStartScroll = null;
  editStageWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2){
      e.preventDefault();
      const [a, b] = e.touches;
      pinchStartDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      pinchStartZoom = zoomSelect ? +zoomSelect.value : 100;
      pinchStartMid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      pinchStartScroll = { left: editStageWrap.scrollLeft, top: editStageWrap.scrollTop };
    }
  }, { passive: false });
  editStageWrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist){
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      setZoom(Math.max(25, Math.min(400, Math.round(pinchStartZoom * (dist/pinchStartDist)))));
      const mid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      editStageWrap.scrollLeft = pinchStartScroll.left - (mid.x - pinchStartMid.x);
      editStageWrap.scrollTop = pinchStartScroll.top - (mid.y - pinchStartMid.y);
    }
  }, { passive: false });
  editStageWrap.addEventListener('touchend', (e) => {
    if (e.touches.length < 2){ pinchStartDist = null; pinchStartMid = null; }
  });
}

/* ============ BACKGROUND CHANGER (image-tools.html) ============ */
let receiveForegroundForAiChanger = null;
if (document.getElementById('bgChangerDrop')){
  let fgCanvas = null;
  let bgMode = 'color';
  let customBgImg = null;
  const loadImgBg = loadImageFromFile;

  setupDropZone('bgChangerDrop','bgChangerInput', async (files) => {
    const f = files.find(f => f.type === 'image/png' || f.type === 'image/webp');
    if (!f){ if (files.length>0) toast('Please select a transparent PNG or WEBP (e.g. output of the Background Remover).', 'err'); return; }
    try{
      const img = await loadImgBg(f);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      fgCanvas = c;
      document.getElementById('bgChangerStage').classList.remove('hidden');
      renderBgComposite();
      toast('Image loaded — choose a new background.');
    }catch(err){ toast(err.message, 'err'); }
  });

  receiveForegroundForAiChanger = (canvas) => {
    fgCanvas = canvas;
    document.getElementById('bgChangerStage').classList.remove('hidden');
    renderBgComposite();
  };

  document.querySelectorAll('#view-bg-changer .bg-mode-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#view-bg-changer .bg-mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      bgMode = tab.dataset.mode;
      document.querySelectorAll('#view-bg-changer .bg-mode-panel').forEach(p => p.classList.toggle('hidden', p.dataset.mode !== bgMode));
      renderBgComposite();
    };
  });

  document.querySelectorAll('#view-bg-changer .bg-swatch[data-color]').forEach(sw => {
    sw.style.background = sw.dataset.color;
    sw.onclick = () => {
      document.querySelectorAll('#view-bg-changer .bg-swatch[data-color]').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('bgChangerSolidColor').value = sw.dataset.color;
      renderBgComposite();
    };
  });
  document.getElementById('bgChangerSolidColor').oninput = renderBgComposite;
  document.getElementById('bgChangerGradStart').oninput = renderBgComposite;
  document.getElementById('bgChangerGradEnd').oninput = renderBgComposite;
  document.getElementById('bgChangerGradAngle').oninput = (e) => {
    document.getElementById('bgChangerGradAngleVal').textContent = e.target.value;
    renderBgComposite();
  };

  setupDropZone('bgChangerCustomDrop','bgChangerCustomInput', async (files) => {
    const f = files.find(f => f.type.startsWith('image/'));
    if (!f) return;
    customBgImg = await loadImgBg(f);
    renderBgComposite();
  });

  function renderBgComposite(){
    if (!fgCanvas) return;
    const w = fgCanvas.width, h = fgCanvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');

    if (bgMode === 'color'){
      ctx.fillStyle = document.getElementById('bgChangerSolidColor').value;
      ctx.fillRect(0,0,w,h);
    } else if (bgMode === 'gradient'){
      const angle = parseInt(document.getElementById('bgChangerGradAngle').value,10) * Math.PI/180;
      const x1 = w/2 - Math.cos(angle)*w/2, y1 = h/2 - Math.sin(angle)*h/2;
      const x2 = w/2 + Math.cos(angle)*w/2, y2 = h/2 + Math.sin(angle)*h/2;
      const grad = ctx.createLinearGradient(x1,y1,x2,y2);
      grad.addColorStop(0, document.getElementById('bgChangerGradStart').value);
      grad.addColorStop(1, document.getElementById('bgChangerGradEnd').value);
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,w,h);
    } else if (bgMode === 'image' && customBgImg){
      const ir = customBgImg.naturalWidth / customBgImg.naturalHeight;
      const cr = w / h;
      let dw, dh, dx, dy;
      if (ir > cr){ dh = h; dw = h*ir; dx = (w-dw)/2; dy = 0; }
      else { dw = w; dh = w/ir; dx = 0; dy = (h-dh)/2; }
      ctx.drawImage(customBgImg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,w,h);
    }

    ctx.drawImage(fgCanvas, 0, 0);
    const wrap = document.getElementById('bgChangerPreview');
    wrap.innerHTML = '';
    wrap.appendChild(out);
    document.getElementById('bgChangerDownloadRow').classList.remove('hidden');
    window.__bgChangerResult = out;
  }

  document.getElementById('bgChangerDownloadBtn').onclick = () => {
    const out = window.__bgChangerResult;
    if (!out){ toast('Load an image first.', 'err'); return; }
    out.toBlob((blob) => {
      if (!blob){ toast('Could not export this image.', 'err'); return; }
      downloadBlob(blob, 'background-changed.png');
    }, 'image/png');
  };
}

/* ============ FAQ (index.html) ============ */
if (document.getElementById('faqList')){
  const faqs = [
    { q: "Do my files get uploaded anywhere?", a: "No. Every tool on this site runs entirely in your browser using JavaScript. Your PDFs and images never leave your device." },
    { q: "Is ToolFlight really free?", a: "Yes, every live tool is free to use with no account or sign-up required." },
    { q: "What file size limits apply?", a: "Since processing happens on your device, limits depend on your browser and device memory. Image Compressor rejects files over 50MB and auto-resizes very large images for reliability on mobile." },
    { q: "Which browsers are supported?", a: "Any modern browser: Chrome, Edge, Firefox, or Safari, on desktop or mobile, including Android Chrome." },
  ];
  const faqList = document.getElementById('faqList');
  faqs.forEach(f => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML = `<div class="faq-q">${f.q} <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg></div><div class="faq-a">${f.a}</div>`;
    item.querySelector('.faq-q').onclick = () => item.classList.toggle('open');
    faqList.appendChild(item);
  });
}

/* ============ LEGAL MODAL (every page) ============ */
const legalContent = {
  privacy: `<h3>Privacy Policy</h3><p>ToolFlight does not upload, store, or transmit your files. All PDF and image processing happens locally in your browser using client-side JavaScript. We do not collect personal data beyond standard, anonymized analytics (such as page views) if analytics are enabled on the deployed site.</p>`,
  terms: `<h3>Terms of Service</h3><p>ToolFlight is provided "as is" for free personal and commercial use. We make no warranty regarding uptime or fitness for a particular purpose. You are responsible for the content of files you process using these tools.</p>`,
  contact: `<h3>Contact</h3><p>For questions or feedback, reach out at <strong>hello@yourdomain.com</strong> (replace with your real support email before launch).</p>`,
};
function openLegal(key){
  const content = document.getElementById('legalContent');
  const modal = document.getElementById('legalModal');
  if (!content || !modal) return;
  content.innerHTML = legalContent[key];
  modal.classList.add('show');
}
function closeLegal(){
  const modal = document.getElementById('legalModal');
  if (modal) modal.classList.remove('show');
}
const legalModalEl = document.getElementById('legalModal');
if (legalModalEl) legalModalEl.addEventListener('click', (e) => { if (e.target.id === 'legalModal') closeLegal(); });
