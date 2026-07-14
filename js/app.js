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
// Loads a classic (non-module) script exactly once, resolving once it's ready.
// Used for CDN libraries distributed as UMD/global scripts rather than ESM,
// where dynamic import() isn't reliable (e.g. onnxruntime-web's ort.min.js).
function loadScriptOnce(src){
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
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
    // Background Remover and Background Changer are now separate pages (each with
    // its own URL for SEO), so the old in-page selectTool('bg-changer') handoff no
    // longer applies — hand off via localStorage, matching the existing auto-save
    // pattern already used elsewhere, then navigate to the standalone page.
    try{
      localStorage.setItem('toolflight_bg_handoff', aiResultCanvas.toDataURL('image/png'));
      window.location.href = 'background-changer.html';
    }catch(err){
      toast('Could not hand off to Background Changer — try downloading and re-uploading instead.', 'err');
    }
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

  // Receive a handoff from the AI Background Remover (now a separate page) via
  // localStorage — set on that page right before it navigates here.
  (function checkBgHandoff(){
    let dataUrl;
    try{ dataUrl = localStorage.getItem('toolflight_bg_handoff'); }catch(e){ return; }
    if (!dataUrl) return;
    try{ localStorage.removeItem('toolflight_bg_handoff'); }catch(e){}
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      fgCanvas = c;
      document.getElementById('bgChangerStage').classList.remove('hidden');
      renderBgComposite();
      toast('Image received from Background Remover.');
    };
    img.onerror = () => { /* handoff data was invalid — just ignore, user can upload manually */ };
    img.src = dataUrl;
  })();

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

  document.querySelectorAll('.bg-mode-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.bg-mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      bgMode = tab.dataset.mode;
      document.querySelectorAll('.bg-mode-panel').forEach(p => p.classList.toggle('hidden', p.dataset.mode !== bgMode));
      renderBgComposite();
    };
  });

  document.querySelectorAll('.bg-swatch[data-color]').forEach(sw => {
    sw.style.background = sw.dataset.color;
    sw.onclick = () => {
      document.querySelectorAll('.bg-swatch[data-color]').forEach(s => s.classList.remove('selected'));
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

/* ============ IMAGE TO PDF (image-to-pdf.html) ============
   Uses pdf-lib (already loaded, MIT license) to build the PDF, and the shared
   loadImageFromFile() helper to decode every input format (JPG/PNG/WEBP/BMP/GIF)
   via the browser's native <img> decoder — no extra library needed for reading. */
if (document.getElementById('itpDrop')){
  let itpImages = []; // { id, img, rotation, name }
  let itpIdSeq = 0;

  const ITP_ACCEPTED = ['image/jpeg','image/png','image/webp','image/bmp','image/gif'];

  setupDropZone('itpDrop','itpInput', async (files) => {
    const imgs = files.filter(f => ITP_ACCEPTED.includes(f.type));
    if (!imgs.length){ if (files.length>0) toast('Please select JPG, PNG, WEBP, BMP, or GIF images.', 'err'); return; }
    for (const f of imgs){
      try{
        const img = await loadImageFromFile(f);
        itpImages.push({ id: itpIdSeq++, img, rotation: 0, name: f.name });
      }catch(err){ toast(`Could not read ${f.name}.`, 'err'); }
    }
    renderItpList();
  });

  function getRotatedCanvas(item){
    const swapped = item.rotation === 90 || item.rotation === 270;
    const w = item.img.naturalWidth, h = item.img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = swapped ? h : w; c.height = swapped ? w : h;
    const cx = c.getContext('2d');
    cx.save();
    cx.translate(c.width/2, c.height/2);
    cx.rotate(item.rotation * Math.PI/180);
    cx.drawImage(item.img, -w/2, -h/2);
    cx.restore();
    return c;
  }

  function computeItpLayout(imgW, imgH){
    const pageSizeMode = document.getElementById('itpPageSize').value;
    const orientation = document.getElementById('itpOrientation').value;
    const margin = parseFloat(document.getElementById('itpMargin').value) || 0;
    let pageW, pageH, drawW, drawH, x, y;
    if (pageSizeMode === 'original'){
      pageW = imgW + margin*2; pageH = imgH + margin*2;
      drawW = imgW; drawH = imgH; x = margin; y = margin;
    } else {
      // 'a4', 'letter', and 'fit' (generic "fit to a standard page") all use a
      // real paper size as the container — 'fit' defaults to A4.
      let baseW = (pageSizeMode === 'letter') ? 612 : 595.28;
      let baseH = (pageSizeMode === 'letter') ? 792 : 841.89;
      if (orientation === 'landscape'){ const t = baseW; baseW = baseH; baseH = t; }
      pageW = baseW; pageH = baseH;
      const availW = pageW - margin*2, availH = pageH - margin*2;
      const fitScale = Math.max(0.01, Math.min(availW/imgW, availH/imgH));
      drawW = imgW * fitScale; drawH = imgH * fitScale;
      x = margin + (availW - drawW)/2; y = margin + (availH - drawH)/2;
    }
    return { pageW, pageH, drawW, drawH, x, y };
  }

  function renderItpPreview(){
    const wrap = document.getElementById('itpPreviewGrid');
    wrap.innerHTML = '';
    if (itpImages.length === 0){
      wrap.innerHTML = '<p class="editor-hint">Add images to see a page preview.</p>';
      return;
    }
    itpImages.forEach((item) => {
      const rotated = getRotatedCanvas(item);
      const { pageW, pageH, drawW, drawH, x, y } = computeItpLayout(rotated.width, rotated.height);
      const s = 100 / Math.max(pageW, pageH);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(pageW*s));
      canvas.height = Math.max(1, Math.round(pageH*s));
      canvas.style.cssText = 'border:1px solid var(--card-border);border-radius:4px;background:#fff;max-width:100%;';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(rotated, x*s, y*s, drawW*s, drawH*s);
      wrap.appendChild(canvas);
    });
  }

  function renderItpList(){
    const list = document.getElementById('itpList');
    list.innerHTML = '';
    itpImages.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <span class="drag-handle">⠿</span>
        <img src="${item.img.src}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;transform:rotate(${item.rotation}deg);flex-shrink:0;" alt="">
        <div class="fmeta"><div class="fname">${i+1}. ${item.name}</div></div>
        <button class="file-remove" data-action="rotate" data-i="${i}" type="button" title="Rotate 90°" style="color:var(--accent1);background:color-mix(in srgb, var(--accent1) 12%, transparent);">⟳</button>
        <button class="file-remove" data-action="remove" data-i="${i}" type="button" title="Remove">✕</button>
      `;
      div.querySelector('[data-action="rotate"]').onclick = () => { item.rotation = (item.rotation + 90) % 360; renderItpList(); };
      div.querySelector('[data-action="remove"]').onclick = () => { itpImages.splice(i,1); renderItpList(); };
      list.appendChild(div);
    });
    enableDragReorder(list, itpImages, renderItpList);
    document.getElementById('itpDownloadBtn').disabled = itpImages.length === 0;
    document.getElementById('itpCountBadge').textContent = itpImages.length + ' image' + (itpImages.length!==1?'s':'');
    renderItpPreview();
  }

  ['itpPageSize','itpOrientation','itpMargin'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderItpPreview);
    document.getElementById(id).addEventListener('change', renderItpPreview);
  });

  document.getElementById('itpClearBtn').onclick = () => { itpImages = []; renderItpList(); };

  document.getElementById('itpDownloadBtn').onclick = async () => {
    if (itpImages.length === 0){ toast('Add at least one image first.', 'err'); return; }
    const btn = document.getElementById('itpDownloadBtn');
    setLoading(btn, true);
    try{
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      for (const item of itpImages){
        const rotated = getRotatedCanvas(item);
        const { pageW, pageH, drawW, drawH, x, y } = computeItpLayout(rotated.width, rotated.height);
        const blob = await new Promise((resolve, reject) => {
          rotated.toBlob((b) => b ? resolve(b) : reject(new Error('Could not encode ' + item.name)), 'image/png');
        });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, { x, y: pageH - y - drawH, width: drawW, height: drawH });
        await nextFrame();
      }
      const outBytes = await pdfDoc.save();
      downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), 'images-to-pdf.pdf');
      toast('PDF created.');
    }catch(err){
      toast('Could not create the PDF: ' + (err.message || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, 'Convert &amp; download PDF');
    }
  };

  renderItpList();
}

/* ============ PDF TO IMAGE (pdf-to-image.html) ============
   Uses PDF.js (pdfjs-dist, Apache 2.0 license, Mozilla) to rasterize pages —
   pdf-lib does not render/rasterize PDF pages, only reads/writes PDF structure,
   so a separate rendering engine is required for this direction. Loaded via
   dynamic import, same pattern as the AI Background Remover's MediaPipe model. */
// Shared PDF.js loader (Apache 2.0, Mozilla) — used by PDF to Image and PDF
// Compress. Version pinned for stability, same pattern as the AI Background
// Remover's MediaPipe loader.
const PDFJS_VERSION = '4.5.136';
let pdfjsLoadPromise = null;
async function ensurePdfJs(){
  if (!pdfjsLoadPromise){
    pdfjsLoadPromise = (async () => {
      const pdfjsLib = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`);
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
      return pdfjsLib;
    })().catch((err) => { pdfjsLoadPromise = null; throw err; });
  }
  return pdfjsLoadPromise;
}

if (document.getElementById('ptiDrop')){
  let ptiFile = null;
  let ptiPages = []; // { num, blob, thumbUrl }

  function setPtiProgress(pct, label){
    const wrap = document.getElementById('ptiProgressWrap');
    wrap.classList.remove('hidden');
    document.getElementById('ptiProgressFill').style.width = pct + '%';
    document.getElementById('ptiProgressLabel').textContent = label;
  }
  function hidePtiProgress(){ document.getElementById('ptiProgressWrap').classList.add('hidden'); }

  setupDropZone('ptiDrop','ptiInput', (files) => {
    const f = files.find(f => f.type === 'application/pdf');
    if (!f){ if (files.length>0) toast('Please select a PDF file.', 'err'); return; }
    ptiFile = f;
    document.getElementById('ptiFileInfo').textContent = f.name + ' · ' + fmtBytes(f.size);
    document.getElementById('ptiStage').classList.remove('hidden');
    document.getElementById('ptiConvertBtn').disabled = false;
    document.getElementById('ptiPageGrid').innerHTML = '';
    document.getElementById('ptiDownloadAllBtn').classList.add('hidden');
  });

  document.getElementById('ptiConvertBtn').onclick = async () => {
    if (!ptiFile) return;
    const btn = document.getElementById('ptiConvertBtn');
    setLoading(btn, true);
    setPtiProgress(0, 'Loading PDF engine…');
    ptiPages.forEach(p => { try{ URL.revokeObjectURL(p.thumbUrl); }catch(e){} });
    ptiPages = [];
    try{
      const pdfjsLib = await ensurePdfJs();
      await nextFrame();
      setPtiProgress(10, 'Reading PDF…');
      const bytes = await ptiFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

      const dpi = parseInt(document.getElementById('ptiDpi').value, 10);
      const scale = dpi / 72;
      const format = document.getElementById('ptiFormat').value;
      const quality = parseInt(document.getElementById('ptiQuality').value, 10) / 100;
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';

      for (let i = 1; i <= pdf.numPages; i++){
        setPtiProgress(10 + Math.round(((i-1)/pdf.numPages)*85), `Rendering page ${i} of ${pdf.numPages}…`);
        await nextFrame();
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        let blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, format === 'png' ? undefined : quality));
        if (!blob){
          // Some browsers can't encode WEBP — fall back to PNG rather than failing the page.
          blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        }
        if (blob) ptiPages.push({ num: i, blob, thumbUrl: URL.createObjectURL(blob) });
        if (page.cleanup) page.cleanup();
      }
      setPtiProgress(100, 'Done.');
      renderPtiPages(format);
      if (ptiPages.length) document.getElementById('ptiDownloadAllBtn').classList.remove('hidden');
      toast(`Converted ${ptiPages.length} page(s).`);
    }catch(err){
      toast('Could not convert this PDF: ' + (err.message || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, 'Convert to images');
      setTimeout(hidePtiProgress, 900);
    }
  };

  function renderPtiPages(format){
    const grid = document.getElementById('ptiPageGrid');
    grid.innerHTML = '';
    ptiPages.forEach(p => {
      const card = document.createElement('div');
      card.className = 'thumb-card';
      card.innerHTML = `<img src="${p.thumbUrl}" alt="Page ${p.num}" loading="lazy"><span class="thumb-label">Page ${p.num}</span>`;
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-ghost';
      dlBtn.type = 'button';
      dlBtn.textContent = 'Download';
      dlBtn.onclick = () => downloadBlob(p.blob, `page-${p.num}.${format}`);
      card.appendChild(dlBtn);
      grid.appendChild(card);
    });
  }

  document.getElementById('ptiDownloadAllBtn').onclick = async () => {
    if (!ptiPages.length) return;
    const format = document.getElementById('ptiFormat').value;
    const zip = new JSZip();
    ptiPages.forEach(p => zip.file(`page-${p.num}.${format}`, p.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'pdf-pages.zip');
    toast('ZIP downloaded.');
  };

  document.getElementById('ptiQuality').addEventListener('input', (e) => {
    document.getElementById('ptiQualityVal').textContent = e.target.value;
  });
  document.getElementById('ptiFormat').addEventListener('change', (e) => {
    document.getElementById('ptiQualityRow').classList.toggle('hidden', e.target.value === 'png');
  });
}

/* ============ PDF COMPRESS (pdf-compress.html) ============
   Genuine image recompression, not just a structural rebuild: walks each
   page's XObject resources, finds embedded JPEG (DCTDecode) images, redraws
   them at a lower quality/resolution via canvas, and — only if the result is
   actually smaller — swaps that specific image reference for the recompressed
   one. Text, fonts, and vector content are never touched, so they stay sharp
   and selectable. Images using other filters (FlateDecode, JPX, CCITT, etc.)
   are safely left as-is rather than risking corruption from a best-effort
   decode of an unfamiliar color space. */
if (document.getElementById('pdfcDrop')){
  let pdfcFile = null;
  let pdfcResultBlob = null;

  setupDropZone('pdfcDrop','pdfcInput', async (files) => {
    const f = files.find(f => f.type === 'application/pdf');
    if (!f){ if (files.length>0) toast('Please select a PDF file.', 'err'); return; }
    pdfcFile = f;
    pdfcResultBlob = null;
    document.getElementById('pdfcOriginalSize').textContent = fmtBytes(f.size);
    document.getElementById('pdfcFileName').textContent = f.name;
    document.getElementById('pdfcStage').classList.remove('hidden');
    document.getElementById('pdfcCompressBtn').disabled = false;
    document.getElementById('pdfcResultRow').classList.add('hidden');
    document.getElementById('pdfcDownloadRow').classList.add('hidden');

    // Best-effort first-page preview thumbnail — reuses the shared PDF.js loader.
    const previewWrap = document.getElementById('pdfcPreview');
    previewWrap.innerHTML = '<span class="placeholder-text">Loading preview…</span>';
    try{
      const pdfjsLib = await ensurePdfJs();
      const bytes = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.6 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      previewWrap.innerHTML = '';
      previewWrap.appendChild(canvas);
      document.getElementById('pdfcPageCount').textContent = pdf.numPages + ' page' + (pdf.numPages!==1?'s':'');
      if (page.cleanup) page.cleanup();
    }catch(err){
      previewWrap.innerHTML = '<span class="placeholder-text">Preview unavailable for this file.</span>';
    }
  });

  function setPdfcProgress(pct, label){
    const wrap = document.getElementById('pdfcProgressWrap');
    wrap.classList.remove('hidden');
    document.getElementById('pdfcProgressFill').style.width = pct + '%';
    document.getElementById('pdfcProgressLabel').textContent = label;
  }
  function hidePdfcProgress(){ document.getElementById('pdfcProgressWrap').classList.add('hidden'); }

  // Inflates raw zlib/FlateDecode bytes using the standard, documented Web
  // Platform Compression Streams API — no pdf-lib internals involved. PDF's
  // /FlateDecode filter uses standard zlib-wrapped DEFLATE data, which is
  // exactly what DecompressionStream('deflate') is specified to decode
  // (as distinct from 'deflate-raw' or 'gzip'). Returns null if the browser
  // doesn't support it or the data fails to decompress, so callers can skip
  // that image safely rather than fail.
  async function inflateFlateBytes(bytes){
    if (typeof DecompressionStream === 'undefined') return null;
    try{
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const chunks = [];
      const reader = ds.readable.getReader();
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      let total = 0;
      for (const c of chunks) total += c.length;
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks){ out.set(c, offset); offset += c.length; }
      return out;
    }catch(e){
      return null;
    }
  }

  async function compressPdfImages(pdfDoc, level, onProgress){
    const { PDFName, PDFDict, PDFRawStream, PDFRef } = PDFLib;
    const maxDim = level === 'high' ? 1000 : level === 'medium' ? 1600 : 2400;
    const quality = level === 'high' ? 0.4 : level === 'medium' ? 0.6 : 0.82;
    const pages = pdfDoc.getPages();
    let processed = 0, skipped = 0;

    for (let pIdx = 0; pIdx < pages.length; pIdx++){
      if (onProgress) onProgress(pIdx, pages.length);
      const page = pages[pIdx];
      let resources;
      try{ resources = page.node.Resources(); }catch(e){ continue; }
      if (!resources) continue;
      const xObjectsRaw = resources.get(PDFName.of('XObject'));
      if (!xObjectsRaw) continue;
      let xObjects = xObjectsRaw;
      if (!(xObjects instanceof PDFDict)){
        try{ xObjects = pdfDoc.context.lookup(xObjectsRaw, PDFDict); }catch(e){ continue; }
      }
      if (!xObjects) continue;

      for (const key of xObjects.keys()){
        const oldRef = xObjects.get(key);
        let obj;
        try{ obj = pdfDoc.context.lookup(oldRef); }catch(e){ continue; }
        if (!obj || !(obj instanceof PDFRawStream)) continue;
        const dict = obj.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        if (!subtype || subtype.toString() !== '/Image') continue;
        const filterEntry = dict.get(PDFName.of('Filter'));
        const filterName = filterEntry ? filterEntry.toString() : '';

        if (filterName.includes('DCTDecode')){
          try{
            const sourceBlob = new Blob([obj.contents], { type: 'image/jpeg' });
            const img = await loadImageFromFile(sourceBlob);
            let w = img.naturalWidth, h = img.naturalHeight;
            if (Math.max(w, h) > maxDim){ const sc = maxDim / Math.max(w, h); w = Math.round(w*sc); h = Math.round(h*sc); }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const newBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (!newBlob) { skipped++; continue; }
            const newBytes = new Uint8Array(await newBlob.arrayBuffer());
            if (newBytes.length >= obj.contents.length) { skipped++; continue; } // never replace with something bigger
            const embedded = await pdfDoc.embedJpg(newBytes);
            xObjects.set(key, embedded.ref);
            if (oldRef instanceof PDFRef){ pdfDoc.context.delete(oldRef); } // remove the now-orphaned original image bytes so the file actually shrinks (instanceof is robust against the minified bundle's mangled constructor names — a plain constructor.name check silently failed here)
            processed++;
          }catch(e){ skipped++; } // skip any image that fails to decode/re-encode, never abort the whole file
          await nextFrame();
          continue;
        }

        // FlateDecode (or no filter) raster images are extremely common — this is
        // what every image ToolFlight's own Image to PDF tool produces, and what
        // many scanners/PDF writers use instead of JPEG. The previous version of
        // this tool skipped these entirely, which is the real reason compression
        // often barely changed file size. Handle the common 8-bit DeviceRGB /
        // DeviceGray case; anything more unusual (CMYK, Indexed, 16-bit, JPX,
        // CCITT) is still safely skipped rather than risked. Decompression uses
        // the standard, documented Web Platform Compression Streams API
        // (DecompressionStream) — not any undocumented pdf-lib internal. Every
        // pdf-lib call in this block (PDFName, PDFDict, PDFRawStream,
        // context.lookup, embedJpg) is part of pdf-lib's documented public API.
        if ((filterName.includes('FlateDecode') || !filterEntry) && typeof DecompressionStream !== 'undefined'){
          try{
            const bpcEntry = dict.get(PDFName.of('BitsPerComponent'));
            const bitsPerComponent = bpcEntry ? Number(bpcEntry.toString()) : null;
            if (bitsPerComponent !== 8) { skipped++; continue; }
            const csEntry = dict.get(PDFName.of('ColorSpace'));
            const csName = csEntry ? csEntry.toString() : '';
            let channels = 0;
            if (csName.includes('DeviceRGB')) channels = 3;
            else if (csName.includes('DeviceGray') || csName.includes('CalGray')) channels = 1;
            if (!channels) { skipped++; continue; }

            const widthEntry = dict.get(PDFName.of('Width'));
            const heightEntry = dict.get(PDFName.of('Height'));
            const width = widthEntry ? Number(widthEntry.toString()) : 0;
            const height = heightEntry ? Number(heightEntry.toString()) : 0;
            if (!width || !height || width * height > 30000000) { skipped++; continue; }

            const decoded = await inflateFlateBytes(obj.contents);
            const expectedLen = width * height * channels;
            if (!decoded || decoded.length < expectedLen) { skipped++; continue; }

            const rawCanvas = document.createElement('canvas');
            rawCanvas.width = width; rawCanvas.height = height;
            const rawCtx = rawCanvas.getContext('2d');
            const imgData = rawCtx.createImageData(width, height);
            if (channels === 3){
              for (let i = 0, j = 0; i < expectedLen; i += 3, j += 4){
                imgData.data[j] = decoded[i]; imgData.data[j+1] = decoded[i+1]; imgData.data[j+2] = decoded[i+2]; imgData.data[j+3] = 255;
              }
            } else {
              for (let i = 0, j = 0; i < expectedLen; i += 1, j += 4){
                imgData.data[j] = decoded[i]; imgData.data[j+1] = decoded[i]; imgData.data[j+2] = decoded[i]; imgData.data[j+3] = 255;
              }
            }
            rawCtx.putImageData(imgData, 0, 0);

            let outCanvas = rawCanvas;
            if (Math.max(width, height) > maxDim){
              const sc = maxDim / Math.max(width, height);
              const w2 = Math.round(width * sc), h2 = Math.round(height * sc);
              const resized = document.createElement('canvas');
              resized.width = w2; resized.height = h2;
              resized.getContext('2d').drawImage(rawCanvas, 0, 0, w2, h2);
              outCanvas = resized;
            }
            const newBlob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/jpeg', quality));
            if (!newBlob) { skipped++; continue; }
            const newBytes = new Uint8Array(await newBlob.arrayBuffer());
            if (newBytes.length >= obj.contents.length) { skipped++; continue; }
            const embedded = await pdfDoc.embedJpg(newBytes);
            xObjects.set(key, embedded.ref);
            if (oldRef instanceof PDFRef){ pdfDoc.context.delete(oldRef); } // remove the now-orphaned original image bytes so the file actually shrinks (instanceof is robust against the minified bundle's mangled constructor names — a plain constructor.name check silently failed here)
            processed++;
          }catch(e){ skipped++; }
          await nextFrame();
          continue;
        }

        skipped++; // unsupported filter (CMYK/Indexed/JPX/CCITT/etc) — left untouched, never guessed at
      }
    }
    return { processed, skipped };
  }

  document.getElementById('pdfcCompressBtn').onclick = async () => {
    if (!pdfcFile) return;
    const btn = document.getElementById('pdfcCompressBtn');
    setLoading(btn, true);
    setPdfcProgress(5, 'Reading PDF…');
    try{
      const level = document.querySelector('.pdfc-level-toggle button.active').dataset.level;
      const { PDFDocument } = PDFLib;
      const originalBytes = await pdfcFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(originalBytes);
      await nextFrame();

      let compressResult = { processed: 0, skipped: 0 };
      try{
        compressResult = await compressPdfImages(pdfDoc, level, (i, total) => {
          setPdfcProgress(10 + Math.round((i/Math.max(1,total))*75), `Compressing images — page ${i+1} of ${total}…`);
        });
      }catch(err){
        // Low-level image access didn't work for this PDF's structure — fall back
        // to structural-only compression rather than failing outright.
      }

      setPdfcProgress(90, 'Saving…');
      await nextFrame();
      const outBytes = await pdfDoc.save({ useObjectStreams: true });
      const outBlob = new Blob([outBytes], { type: 'application/pdf' });

      const originalSize = pdfcFile.size;
      const newSize = outBlob.size;
      setPdfcProgress(100, 'Done.');

      document.getElementById('pdfcResultRow').classList.remove('hidden');
      document.getElementById('pdfcOriginalSize2').textContent = fmtBytes(originalSize);
      document.getElementById('pdfcCompressedSize').textContent = fmtBytes(newSize);

      if (newSize >= originalSize){
        document.getElementById('pdfcSavedAmount').textContent = '—';
        document.getElementById('pdfcSavedPct').textContent = '—';
        document.getElementById('pdfcResultNote').textContent = "This PDF is already efficiently compressed — the result wasn't smaller, so the original file is kept instead.";
        pdfcResultBlob = null;
        document.getElementById('pdfcDownloadRow').classList.add('hidden');
        toast("Already efficiently compressed — original file kept, nothing to download.");
      } else {
        const saved = originalSize - newSize;
        const pct = Math.round((saved / originalSize) * 100);
        document.getElementById('pdfcSavedAmount').textContent = fmtBytes(saved);
        document.getElementById('pdfcSavedPct').textContent = pct + '%';
        document.getElementById('pdfcResultNote').textContent = compressResult.processed > 0
          ? `Recompressed ${compressResult.processed} image${compressResult.processed!==1?'s':''} in this PDF.`
          : 'No compressible images were found — size reduction came from PDF structure optimization only.';
        pdfcResultBlob = outBlob;
        document.getElementById('pdfcDownloadRow').classList.remove('hidden');
        toast('PDF compressed.');
      }
    }catch(err){
      toast('Could not compress this PDF: ' + (err.message || 'please try a different file.'), 'err');
    }finally{
      setLoading(btn, false, 'Compress PDF');
      setTimeout(hidePdfcProgress, 900);
    }
  };

  document.querySelectorAll('.pdfc-level-toggle button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.pdfc-level-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  document.getElementById('pdfcDownloadBtn').onclick = () => {
    if (!pdfcResultBlob){ toast('Nothing to download yet.', 'err'); return; }
    downloadBlob(pdfcResultBlob, 'compressed.pdf');
  };
}

/* ============ AI KEYWORD GENERATOR (ai-keyword-generator.html) ============
   No real keyword-research API is used here — there is no backend and no API
   key on this static site, so any tool claiming to show live keyword-planner
   numbers would be fabricating data. Instead this generates keyword
   IDEAS via template-based combination (a well-established, legitimate SEO
   ideation technique — the same basic approach tools like AnswerThePublic use
   for their free tier) and attaches DETERMINISTIC, clearly-labeled ESTIMATED
   metrics (same keyword always yields the same numbers, seeded from the text
   itself) so users get consistent, useful starting points for their own
   research — never numbers presented as real search-engine data. */
if (document.getElementById('gkwForm')){
  const GKW_QUESTION_WORDS = ['what is','how to','why','when','where','who','can','does','is','will','which','how much','how many','how does'];
  const GKW_BUYING_WORDS = ['buy','price','cost','cheap','best','top','discount','deal','coupon','review','for sale','affordable'];
  const GKW_COMPARISON_TERMS = ['alternative','alternatives','competitors','similar options'];
  const GKW_MODIFIERS = ['best','top','cheap','free','online','guide','tutorial','for beginners','2026','review','tips','ideas','examples','checklist','template','vs','pros and cons','worth it','explained'];
  const GKW_LOCAL_SUFFIXES = ['near me','in my area','local','nearby','close to me'];
  const GKW_VOICE_TEMPLATES = ["what's the best way to {kw}","how do i {kw}","where can i find {kw}","what should i know about {kw}","hey google what is {kw}","find {kw} near me"];
  const GKW_YOUTUBE_TEMPLATES = ['{kw} tutorial','how to {kw}','{kw} explained','{kw} for beginners','{kw} review 2026','top 10 {kw}','{kw} tips and tricks','{kw} step by step','{kw} mistakes to avoid','{kw} in 5 minutes'];
  const GKW_LSI_TEMPLATES = ['types of {kw}','benefits of {kw}','{kw} meaning','{kw} definition','history of {kw}','{kw} examples','{kw} statistics','{kw} trends','{kw} vs alternatives','how {kw} works'];
  const GKW_TRENDING_TEMPLATES = ['{kw} 2026','new {kw}','latest {kw}','{kw} trends 2026','future of {kw}','{kw} predictions','{kw} this year','emerging {kw}'];
  const GKW_BLOG_TITLE_TEMPLATES = [
    'The Ultimate Guide to {KW} in 2026','{N} {KW} Tips You Need to Know','How to {kw}: A Complete Beginner\u2019s Guide',
    '{KW} 101: Everything You Need to Know','Why {KW} Matters More Than Ever','{N} Common {KW} Mistakes (and How to Avoid Them)',
    '{KW} Explained in Plain English','The Complete {KW} Checklist for 2026','What Nobody Tells You About {KW}',
    '{N} Best {KW} Strategies That Actually Work'
  ];
  const GKW_META_TITLE_TEMPLATES = ['{KW}: The Complete Guide (2026)','Best {KW} Tips & Strategies | Full Guide','{KW} Guide: Everything You Need to Know','{N} {KW} Ideas for 2026'];
  const GKW_META_DESC_TEMPLATES = [
    'Learn everything about {kw} with our complete 2026 guide. Practical tips, examples, and strategies to help you get started today.',
    'Discover the best {kw} strategies, tips, and ideas. A complete, up-to-date guide covering everything you need to know.',
    'Looking for {kw}? This guide covers the essentials, common mistakes to avoid, and practical tips you can use right away.'
  ];

  function titleCase(s){ return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1)); }

  function fillTemplate(tpl, kw, n){
    return tpl.replace(/\{kw\}/g, kw).replace(/\{KW\}/g, titleCase(kw)).replace(/\{N\}/g, n || (5 + (kw.length % 10)));
  }

  function dedupeCap(list, max){
    const seen = new Set(); const out = [];
    for (const item of list){
      const key = item.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
      if (out.length >= max) break;
    }
    return out;
  }

  function genFromTemplates(templates, kw, max){
    return dedupeCap(templates.map(t => fillTemplate(t, kw)), max);
  }

  function genModifierCombos(kw, modifiers, max, prefixAndSuffix){
    const out = [];
    for (const m of modifiers){ out.push(`${m} ${kw}`); if (prefixAndSuffix) out.push(`${kw} ${m}`); }
    return dedupeCap(out, max);
  }

  // Deterministic seeded PRNG — the same keyword text always produces the same
  // estimated metrics across runs, rather than random numbers on every reload.
  function seededRand(str){
    let h = 2166136261;
    for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){ h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return ((h >>> 0) % 100000) / 100000; };
  }

  const GKW_INDUSTRY_MULTIPLIER = { general:1, finance:2.4, insurance:2.8, legal:2.6, health:1.7, tech:1.4, ecommerce:1.5, travel:1.2, education:1.1, realestate:1.9, marketing:1.6 };

  function estimateMetrics(kw, industry){
    const rand = seededRand(kw.toLowerCase());
    const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
    const wordCount = kw.trim().split(/\s+/).filter(Boolean).length;
    const mult = GKW_INDUSTRY_MULTIPLIER[industry] || 1;
    const volume = Math.max(10, Math.round((6000 / Math.max(1, wordCount)) * (0.3 + r1 * 1.3) * (mult / 1.4)));
    const competitionScore = Math.min(1, r2 * (1 / Math.sqrt(wordCount)) + 0.12);
    const competition = competitionScore > 0.66 ? 'High' : competitionScore > 0.33 ? 'Medium' : 'Low';
    const difficulty = competitionScore > 0.7 ? 'Hard' : competitionScore > 0.35 ? 'Medium' : 'Easy';
    const cpc = (0.1 + r3 * 4.8 * mult).toFixed(2);
    const trend = ['Rising','Stable','Declining'][Math.floor(r4 * 3)];
    const contentScore = Math.round(35 + (1 - competitionScore) * 55 + r5 * 10);
    const lower = kw.toLowerCase();
    let intent = 'Informational';
    if (GKW_BUYING_WORDS.some(w => lower.includes(w))) intent = 'Transactional';
    else if (lower.includes(' vs ') || lower.includes('alternative')) intent = 'Commercial';
    else if (lower.includes('near me') || lower.includes('local') || lower.includes('in my area')) intent = 'Local';
    else if (GKW_QUESTION_WORDS.some(w => lower.startsWith(w))) intent = 'Informational';
    return { volume, competition, difficulty, cpc, trend, contentScore, intent, wordCount };
  }

  function buildSections(seed, opts){
    const kw = seed.trim();
    const total = opts.count;
    // Rough share of the requested total per keyword-bearing section (content-idea
    // sections like Blog Titles/FAQ get smaller fixed counts since they aren't
    // "keywords" in the same sense).
    const bigShare = Math.max(6, Math.round(total * 0.10));
    const midShare = Math.max(6, Math.round(total * 0.07));

    const sections = [];
    const push = (title, items, isKeywordList) => sections.push({ title, items, isKeywordList: isKeywordList !== false });

    push('Primary Keywords', genModifierCombos(kw, ['best','top','cheap','free','online','guide','review','2026'], bigShare, false));
    push('Long Tail Keywords', dedupeCap(
      GKW_MODIFIERS.flatMap(m1 => GKW_MODIFIERS.slice(0,6).map(m2 => `${m1} ${kw} ${m2}`)), bigShare));
    push('Question Keywords', genModifierCombos(kw, GKW_QUESTION_WORDS, bigShare, false));
    push('Buying Keywords', genModifierCombos(kw, GKW_BUYING_WORDS, midShare, true));
    push('Comparison Keywords', dedupeCap([
      ...(opts.competitor ? [`${kw} vs ${opts.competitor}`, `${kw} or ${opts.competitor}`, `${opts.competitor} alternative`] : []),
      ...GKW_COMPARISON_TERMS.map(t => `${kw} ${t}`),
      `${kw} vs competitors`, `best ${kw} alternative`
    ], midShare));
    push('Alphabet Keywords (A\u2013Z)', dedupeCap('abcdefghijklmnopqrstuvwxyz'.split('').map(l => `${kw} ${l}`), 26));
    push('Related Searches', genModifierCombos(kw, ['similar to','related to','like','instead of','compared with'], midShare, false));
    push('Semantic Keywords (LSI)', genFromTemplates(GKW_LSI_TEMPLATES, kw, midShare));
    push('Trending Keyword Ideas', genFromTemplates(GKW_TRENDING_TEMPLATES, kw, midShare));
    push('Local Keywords', genModifierCombos(kw, GKW_LOCAL_SUFFIXES, midShare, true));
    push('Voice Search Keywords', genFromTemplates(GKW_VOICE_TEMPLATES, kw, midShare));
    push('YouTube Keywords', genFromTemplates(GKW_YOUTUBE_TEMPLATES, kw, midShare));
    push('Blog Title Ideas', genFromTemplates(GKW_BLOG_TITLE_TEMPLATES, kw, 10), false);
    push('FAQ Ideas', dedupeCap(GKW_QUESTION_WORDS.map(q => `${titleCase(q)} ${kw}?`), 12), false);
    push('Meta Title Suggestions', genFromTemplates(GKW_META_TITLE_TEMPLATES, kw, 6), false);
    push('Meta Description Suggestions', genFromTemplates(GKW_META_DESC_TEMPLATES, kw, 3), false);
    push('URL Slug Suggestions', dedupeCap([
      kw.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      `best-${kw.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}`,
      `${kw.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-guide-2026`,
      `${kw.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-for-beginners`
    ], 6), false);
    push('Internal Linking Ideas', dedupeCap([
      `Link from your homepage using the anchor text "${kw}"`,
      `Link from related blog posts using "learn more about ${kw}"`,
      `Link from your ${kw} category or hub page`,
      `Cross-link with comparison and buying-guide content about ${kw}`,
      `Link from FAQ answers that mention ${kw}`
    ], 6), false);
    push('Content Cluster Ideas', dedupeCap([
      `Pillar page: "The Complete Guide to ${titleCase(kw)}"`,
      `Supporting article: "${titleCase(kw)} for Beginners"`,
      `Supporting article: "Best ${titleCase(kw)} Tools Compared"`,
      `Supporting article: "${titleCase(kw)} Mistakes to Avoid"`,
      `Supporting article: "${titleCase(kw)} FAQ"`,
      `Supporting article: "${titleCase(kw)} Case Studies"`
    ], 8), false);
    push('Content Outline', dedupeCap([
      `H1: ${titleCase(kw)} \u2014 The Complete Guide`,
      `H2: What is ${kw}?`,
      `H2: Why ${kw} Matters`,
      `H2: How to Get Started with ${kw}`,
      `H2: Best Practices for ${kw}`,
      `H2: Common ${titleCase(kw)} Mistakes`,
      `H2: ${titleCase(kw)} Tools & Resources`,
      `H2: Frequently Asked Questions`,
      `H2: Conclusion`
    ], 10), false);

    return sections;
  }

  let gkwAllRows = []; // flattened { keyword, section, ...metrics }
  let gkwFiltered = [];
  let gkwSelected = new Set();

  function renderResults(sections, opts){
    gkwAllRows = [];
    sections.forEach(sec => {
      sec.items.forEach(item => {
        const m = sec.isKeywordList ? estimateMetrics(item, opts.industry) : null;
        gkwAllRows.push({ keyword: item, section: sec.title, isKeywordList: sec.isKeywordList, ...(m || {}) });
      });
    });
    applyFiltersAndRender();
    document.getElementById('gkwSummary').classList.remove('hidden');
    document.getElementById('gkwResultsWrap').classList.remove('hidden');
    updateSummaryStats();
  }

  function updateSummaryStats(){
    const kwRows = gkwAllRows.filter(r => r.isKeywordList);
    document.getElementById('gkwCountStat').textContent = gkwAllRows.length;
    if (kwRows.length){
      const avgVol = Math.round(kwRows.reduce((a,r)=>a+r.volume,0) / kwRows.length);
      const avgCpc = (kwRows.reduce((a,r)=>a+parseFloat(r.cpc),0) / kwRows.length).toFixed(2);
      const diffScore = { Easy:1, Medium:2, Hard:3 };
      const avgDiff = kwRows.reduce((a,r)=>a+diffScore[r.difficulty],0) / kwRows.length;
      document.getElementById('gkwVolStat').textContent = avgVol.toLocaleString();
      document.getElementById('gkwCpcStat').textContent = '$' + avgCpc;
      document.getElementById('gkwDiffStat').textContent = avgDiff < 1.6 ? 'Easy' : avgDiff < 2.4 ? 'Medium' : 'Hard';
    }
  }

  function applyFiltersAndRender(){
    const diffFilter = document.getElementById('gkwFilterDifficulty').value;
    const intentFilter = document.getElementById('gkwFilterIntent').value;
    const questionOnly = document.getElementById('gkwFilterQuestion').checked;
    const buyingOnly = document.getElementById('gkwFilterBuying').checked;
    const sortBy = document.getElementById('gkwSort').value;

    gkwFiltered = gkwAllRows.filter(r => {
      if (diffFilter && r.isKeywordList && r.difficulty !== diffFilter) return false;
      if (intentFilter && r.isKeywordList && r.intent !== intentFilter) return false;
      if (questionOnly && !GKW_QUESTION_WORDS.some(q => r.keyword.toLowerCase().startsWith(q))) return false;
      if (buyingOnly && !GKW_BUYING_WORDS.some(b => r.keyword.toLowerCase().includes(b))) return false;
      return true;
    });

    if (sortBy === 'az') gkwFiltered.sort((a,b) => a.keyword.localeCompare(b.keyword));
    else if (sortBy === 'volume') gkwFiltered.sort((a,b) => (b.volume||0) - (a.volume||0));
    else if (sortBy === 'competition') gkwFiltered.sort((a,b) => (a.volume ? (a.competition==='Low'?0:a.competition==='Medium'?1:2) : 9) - (b.volume ? (b.competition==='Low'?0:b.competition==='Medium'?1:2) : 9));
    else if (sortBy === 'longest') gkwFiltered.sort((a,b) => b.keyword.length - a.keyword.length);
    else if (sortBy === 'shortest') gkwFiltered.sort((a,b) => a.keyword.length - b.keyword.length);

    renderTable();
  }

  function renderTable(){
    const wrap = document.getElementById('gkwResultsBody');
    wrap.innerHTML = '';
    let currentSection = null;
    gkwFiltered.forEach((row, i) => {
      if (row.section !== currentSection){
        currentSection = row.section;
        const h = document.createElement('h3');
        h.className = 'gkw-section-heading';
        h.textContent = currentSection;
        wrap.appendChild(h);
      }
      const div = document.createElement('div');
      div.className = 'gkw-row' + (row.contentScore >= 80 ? ' gkw-row-best' : '');
      const checked = gkwSelected.has(row.keyword) ? 'checked' : '';
      if (row.isKeywordList){
        div.innerHTML = `
          <label class="gkw-check"><input type="checkbox" data-kw="${encodeURIComponent(row.keyword)}" ${checked}></label>
          <span class="gkw-kw">${row.keyword}</span>
          <span class="badge">${row.intent}</span>
          <span class="badge">${row.competition} comp.</span>
          <span class="badge">$${row.cpc} CPC</span>
          <span class="badge">${row.trend}</span>
          <span class="badge">Score ${row.contentScore}</span>
          <span class="badge">${row.difficulty}</span>
          <span class="badge">~${row.volume.toLocaleString()}/mo</span>
        `;
      } else {
        div.innerHTML = `<label class="gkw-check"><input type="checkbox" data-kw="${encodeURIComponent(row.keyword)}" ${checked}></label><span class="gkw-kw">${row.keyword}</span>`;
      }
      wrap.appendChild(div);
    });
    document.querySelectorAll('#gkwResultsBody input[type=checkbox]').forEach(cb => {
      cb.onchange = () => {
        const kw = decodeURIComponent(cb.dataset.kw);
        cb.checked ? gkwSelected.add(kw) : gkwSelected.delete(kw);
      };
    });
  }

  document.getElementById('gkwForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const seed = document.getElementById('gkwSeed').value.trim();
    if (!seed){ toast('Enter a main keyword first.', 'err'); return; }
    const btn = document.getElementById('gkwGenerateBtn');
    setLoading(btn, true);
    gkwSelected = new Set();
    setTimeout(() => { // brief delay so the loading state is visible — generation itself is instant
      const opts = {
        count: parseInt(document.getElementById('gkwCount').value, 10),
        industry: document.getElementById('gkwIndustry').value,
        competitor: document.getElementById('gkwCompetitor').value.trim(),
      };
      const sections = buildSections(seed, opts);
      renderResults(sections, opts);
      setLoading(btn, false, 'Generate keywords');
      toast('Keyword ideas generated.');
    }, 250);
  });

  ['gkwFilterDifficulty','gkwFilterIntent','gkwSort'].forEach(id => document.getElementById(id).addEventListener('change', applyFiltersAndRender));
  ['gkwFilterQuestion','gkwFilterBuying'].forEach(id => document.getElementById(id).addEventListener('change', applyFiltersAndRender));

  document.getElementById('gkwRegenerateBtn').onclick = () => document.getElementById('gkwForm').requestSubmit();

  document.getElementById('gkwSelectAllBtn').onclick = () => {
    gkwFiltered.forEach(r => gkwSelected.add(r.keyword));
    renderTable();
  };
  document.getElementById('gkwSelectNoneBtn').onclick = () => {
    gkwSelected.clear();
    renderTable();
  };

  document.getElementById('gkwCopyAllBtn').onclick = () => {
    const text = gkwFiltered.map(r => r.keyword).join('\n');
    copyToClipboard(text).then(() => toast(`Copied ${gkwFiltered.length} keywords.`)).catch(() => toast('Could not copy — try exporting instead.', 'err'));
  };
  document.getElementById('gkwCopySelectedBtn').onclick = () => {
    if (!gkwSelected.size){ toast('Select at least one keyword first.', 'err'); return; }
    copyToClipboard(Array.from(gkwSelected).join('\n')).then(() => toast(`Copied ${gkwSelected.size} selected keyword(s).`)).catch(() => toast('Could not copy.', 'err'));
  };

  document.getElementById('gkwExportTxtBtn').onclick = () => {
    if (!gkwFiltered.length){ toast('Generate keywords first.', 'err'); return; }
    downloadBlob(new Blob([gkwFiltered.map(r => r.keyword).join('\n')], {type:'text/plain'}), 'keywords.txt');
  };
  document.getElementById('gkwExportCsvBtn').onclick = () => {
    if (!gkwFiltered.length){ toast('Generate keywords first.', 'err'); return; }
    const header = 'Keyword,Section,Intent,Competition,CPC,Trend,ContentScore,Difficulty,EstimatedVolume\n';
    const rows = gkwFiltered.map(r => [
      `"${r.keyword.replace(/"/g,'""')}"`, `"${r.section}"`,
      r.intent||'', r.competition||'', r.cpc||'', r.trend||'', r.contentScore||'', r.difficulty||'', r.volume||''
    ].join(','));
    downloadBlob(new Blob([header + rows.join('\n')], {type:'text/csv'}), 'keywords.csv');
  };
  document.getElementById('gkwExportJsonBtn').onclick = () => {
    if (!gkwFiltered.length){ toast('Generate keywords first.', 'err'); return; }
    downloadBlob(new Blob([JSON.stringify(gkwFiltered, null, 2)], {type:'application/json'}), 'keywords.json');
  };
  document.getElementById('gkwExportMdBtn').onclick = () => {
    if (!gkwFiltered.length){ toast('Generate keywords first.', 'err'); return; }
    let md = '# Keyword Research Results\n\n';
    let currentSection = null;
    gkwFiltered.forEach(r => {
      if (r.section !== currentSection){ currentSection = r.section; md += `\n## ${currentSection}\n\n`; }
      md += r.isKeywordList ? `- ${r.keyword} (${r.intent}, ${r.competition} competition, ~${r.volume}/mo)\n` : `- ${r.keyword}\n`;
    });
    downloadBlob(new Blob([md], {type:'text/markdown'}), 'keywords.md');
  };

  document.getElementById('gkwRemoveDuplicatesBtn').onclick = () => {
    const before = gkwAllRows.length;
    const seen = new Set();
    gkwAllRows = gkwAllRows.filter(r => {
      const k = r.keyword.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    applyFiltersAndRender();
    updateSummaryStats();
    toast(`Removed ${before - gkwAllRows.length} duplicate(s).`);
  };

  document.getElementById('gkwRandomBtn').onclick = () => {
    const ideas = ['best budget laptops','healthy meal prep ideas','how to start a podcast','digital marketing for small business','home workout routines','sustainable fashion brands','freelance writing tips','indoor plants for beginners','personal finance basics','remote team management'];
    document.getElementById('gkwSeed').value = ideas[Math.floor(Math.random()*ideas.length)];
    toast('Random seed keyword added — tap Generate.');
  };
}

/* ============ MAGIC ERASER / AI OBJECT REMOVER (magic-eraser.html) ============
   Real generative inpainting, not a blur/clone/fill trick: uses LaMa (Large
   Mask Inpainting, Apache 2.0, github.com/advimman/lama), a genuine neural
   inpainting model, exported to ONNX and run entirely client-side via
   onnxruntime-web (MIT license, Microsoft). No backend, no API key — the
   model file (~200MB) downloads once from Hugging Face's public CDN and is
   cached by the browser afterward. See the tool's own FAQ for the specific
   honest limitations of this approach (fixed 512x512 model input, first-use
   download size). */
if (document.getElementById('meDrop')){
  const ORT_VERSION = '1.17.3';
  const LAMA_MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';

  let meOriginalImg = null;      // full-resolution source <img>
  let meOriginalCanvas = null;   // full-res, never modified
  let meMaskCanvas = null;       // full-res, white = "remove this"
  let meEditCanvas = null;       // visible canvas (original + red mask overlay)
  let meResultCanvas = null;     // full-res result after AI processing, once available
  let meHistoryStack = [], meHistoryIndex = -1;
  const ME_MAX_HISTORY = 25;
  let meBrushSize = 40, meBrushSoftness = 60;
  let meIsDrawing = false;
  let meSession = null;
  let ortLoadPromise = null;

  async function ensureOrt(){
    if (window.ort) return window.ort;
    if (!ortLoadPromise){
      ortLoadPromise = (async () => {
        await loadScriptOnce(`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.js`);
        if (!window.ort) throw new Error('ONNX Runtime failed to initialize.');
        window.ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
        return window.ort;
      })().catch((err) => { ortLoadPromise = null; throw err; });
    }
    return ortLoadPromise;
  }

  async function ensureModel(onProgress){
    if (meSession) return meSession;
    const ort = await ensureOrt();
    if (onProgress) onProgress('Downloading AI model (~200MB, one-time — cached by your browser after this)…');
    meSession = await ort.InferenceSession.create(LAMA_MODEL_URL, { executionProviders: ['wasm'] });
    return meSession;
  }

  setupDropZone('meDrop','meInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > 50*1024*1024){ toast(`That image is ${fmtBytes(f.size)} — the limit is 50MB.`, 'err'); return; }
    try{
      meOriginalImg = await loadImageFromFile(f);
      initMagicEraser();
      toast('Image loaded — brush over what you want removed.');
    }catch(err){
      toast(err.message || 'Could not read this image.', 'err');
    }
  });

  function initMagicEraser(){
    const w = meOriginalImg.naturalWidth, h = meOriginalImg.naturalHeight;
    meOriginalCanvas = document.createElement('canvas');
    meOriginalCanvas.width = w; meOriginalCanvas.height = h;
    meOriginalCanvas.getContext('2d').drawImage(meOriginalImg, 0, 0); // re-drawing via canvas already strips EXIF, same as every other ToolFlight image tool

    meMaskCanvas = document.createElement('canvas');
    meMaskCanvas.width = w; meMaskCanvas.height = h;

    meResultCanvas = null;
    meEditCanvas = document.getElementById('meEditCanvas');
    meEditCanvas.width = w; meEditCanvas.height = h;

    meHistoryStack = []; meHistoryIndex = -1;
    pushMeHistory();
    renderMeComposite();

    document.getElementById('meStage').classList.remove('hidden');
    document.getElementById('meRemoveBtn').disabled = false;
    document.getElementById('meDownloadRow').classList.add('hidden');
    document.getElementById('meCompareWrap').classList.add('hidden');
    setMeZoom(100);
  }

  function renderMeComposite(){
    const w = meOriginalCanvas.width, h = meOriginalCanvas.height;
    const ectx = meEditCanvas.getContext('2d');
    ectx.drawImage(meResultCanvas || meOriginalCanvas, 0, 0);
    // Red translucent overlay wherever the mask is painted, so the selection is
    // always clearly visible against both light and dark source photos.
    const maskData = meMaskCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const imgData = ectx.getImageData(0, 0, w, h);
    for (let i = 0; i < maskData.length; i += 4){
      const m = maskData[i+3];
      if (m > 10){
        const alpha = (m/255) * 0.55;
        imgData.data[i]   = imgData.data[i]   * (1-alpha) + 255*alpha;
        imgData.data[i+1] = imgData.data[i+1] * (1-alpha);
        imgData.data[i+2] = imgData.data[i+2] * (1-alpha);
      }
    }
    ectx.putImageData(imgData, 0, 0);
  }

  function pushMeHistory(){
    const snap = meMaskCanvas.getContext('2d').getImageData(0, 0, meMaskCanvas.width, meMaskCanvas.height);
    meHistoryStack = meHistoryStack.slice(0, meHistoryIndex + 1);
    meHistoryStack.push(snap);
    if (meHistoryStack.length > ME_MAX_HISTORY) meHistoryStack.shift();
    meHistoryIndex = meHistoryStack.length - 1;
  }
  function restoreMeHistory(idx){
    if (idx < 0 || idx >= meHistoryStack.length) return;
    meMaskCanvas.getContext('2d').putImageData(meHistoryStack[idx], 0, 0);
    meHistoryIndex = idx;
    renderMeComposite();
  }
  function meUndo(){ if (meHistoryIndex > 0) restoreMeHistory(meHistoryIndex - 1); else toast('Nothing to undo.'); }
  function meRedo(){ if (meHistoryIndex < meHistoryStack.length - 1) restoreMeHistory(meHistoryIndex + 1); else toast('Nothing to redo.'); }

  function mePaintDab(x, y){
    const mctx = meMaskCanvas.getContext('2d');
    const hardStop = Math.max(0, 1 - meBrushSoftness/100);
    const grad = mctx.createRadialGradient(x, y, (meBrushSize/2)*hardStop, x, y, meBrushSize/2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(x, y, meBrushSize/2, 0, Math.PI*2);
    mctx.fill();
  }

  function meCanvasPoint(e){
    const rect = meEditCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * meEditCanvas.width,
      y: ((e.clientY - rect.top) / rect.height) * meEditCanvas.height,
    };
  }

  const meStageWrap = document.getElementById('meStageWrap');
  let meSpacePan = false;

  meStageWrap.addEventListener('pointerdown', (e) => {
    if (!meMaskCanvas || meSpacePan) return;
    const canvas = document.getElementById('meEditCanvas');
    canvas.setPointerCapture(e.pointerId);
    meIsDrawing = true;
    const pt = meCanvasPoint(e);
    mePaintDab(pt.x, pt.y);
    renderMeComposite();
  });
  document.addEventListener('pointermove', (e) => {
    if (!meIsDrawing || meSpacePan) return;
    const pt = meCanvasPoint(e);
    mePaintDab(pt.x, pt.y);
    renderMeComposite();
  });
  document.addEventListener('pointerup', () => {
    if (meIsDrawing){ meIsDrawing = false; pushMeHistory(); }
  });

  function setMeZoom(pct){
    const canvas = document.getElementById('meEditCanvas');
    if (!canvas || !canvas.width) return;
    canvas.style.width = Math.round(canvas.width * (pct/100)) + 'px';
    canvas.style.height = Math.round(canvas.height * (pct/100)) + 'px';
    const sel = document.getElementById('meZoomSelect');
    if (sel) sel.value = String(pct);
  }
  document.getElementById('meZoomSelect').onchange = (e) => setMeZoom(+e.target.value);
  document.getElementById('meFitScreenBtn').onclick = () => {
    const canvas = document.getElementById('meEditCanvas');
    const wrapWidth = meStageWrap.clientWidth - 20;
    const pct = Math.max(10, Math.min(100, Math.round((wrapWidth / canvas.width) * 100)));
    setMeZoom(pct);
  };
  meStageWrap.addEventListener('wheel', (e) => {
    if (!meMaskCanvas) return;
    e.preventDefault();
    const sel = document.getElementById('meZoomSelect');
    const current = sel ? +sel.value : 100;
    setMeZoom(Math.max(25, Math.min(400, current + (e.deltaY < 0 ? 15 : -15))));
  }, { passive: false });

  // Space = pan (native container scroll does the actual panning)
  document.addEventListener('keydown', (e) => {
    const stage = document.getElementById('meStage');
    if (!stage || stage.classList.contains('hidden')) return;
    if (e.code === 'Space' && !meSpacePan){ meSpacePan = true; meStageWrap.style.cursor = 'grab'; e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){ meUndo(); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ meRedo(); e.preventDefault(); }
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space'){ meSpacePan = false; meStageWrap.style.cursor = ''; } });

  document.getElementById('meBrushSize').oninput = (e) => {
    meBrushSize = +e.target.value;
    document.getElementById('meBrushSizeVal').textContent = meBrushSize;
  };
  document.getElementById('meBrushSoftness').oninput = (e) => {
    meBrushSoftness = +e.target.value;
    document.getElementById('meBrushSoftnessVal').textContent = meBrushSoftness;
  };
  document.getElementById('meUndoBtn').onclick = meUndo;
  document.getElementById('meRedoBtn').onclick = meRedo;
  document.getElementById('meClearSelectionBtn').onclick = () => {
    meMaskCanvas.getContext('2d').clearRect(0, 0, meMaskCanvas.width, meMaskCanvas.height);
    renderMeComposite();
    pushMeHistory();
  };
  document.getElementById('meResetImageBtn').onclick = () => {
    if (!meOriginalImg) return;
    initMagicEraser();
    toast('Reset to the original image.');
  };

  function hasAnyMaskPainted(){
    const d = meMaskCanvas.getContext('2d').getImageData(0, 0, meMaskCanvas.width, meMaskCanvas.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) return true;
    return false;
  }

  document.getElementById('meRemoveBtn').onclick = async () => {
    if (!meOriginalCanvas){ toast('Upload an image first.', 'err'); return; }
    if (!hasAnyMaskPainted()){ toast('Brush over the object you want removed first.', 'err'); return; }
    const btn = document.getElementById('meRemoveBtn');
    setLoading(btn, true);
    const progressWrap = document.getElementById('meProgressWrap');
    const progressLabel = document.getElementById('meProgressLabel');
    const progressFill = document.getElementById('meProgressFill');
    progressWrap.classList.remove('hidden');
    progressFill.style.width = '5%';
    try{
      const session = await ensureModel((msg) => { progressLabel.textContent = msg; progressFill.style.width = '20%'; });
      progressLabel.textContent = 'Preparing image for the AI model…';
      progressFill.style.width = '55%';
      await nextFrame();

      const w = meOriginalCanvas.width, h = meOriginalCanvas.height;
      // This specific ONNX export requires a fixed 512x512 input (documented
      // limitation — see the tool's FAQ). Resize the whole frame down for
      // inference, matching the model's own documented reference usage, then
      // composite only the newly-generated pixels back onto the untouched
      // full-resolution original — so everything outside the brushed area
      // keeps its true original resolution and quality.
      const SZ = 512;
      const smallImg = document.createElement('canvas'); smallImg.width = SZ; smallImg.height = SZ;
      smallImg.getContext('2d').drawImage(meOriginalCanvas, 0, 0, SZ, SZ);
      const smallMask = document.createElement('canvas'); smallMask.width = SZ; smallMask.height = SZ;
      smallMask.getContext('2d').drawImage(meMaskCanvas, 0, 0, SZ, SZ);

      const imgData = smallImg.getContext('2d').getImageData(0, 0, SZ, SZ).data;
      const maskData = smallMask.getContext('2d').getImageData(0, 0, SZ, SZ).data;

      const imgFloat = new Float32Array(3 * SZ * SZ);
      const maskFloat = new Float32Array(1 * SZ * SZ);
      const plane = SZ * SZ;
      for (let p = 0; p < plane; p++){
        const i = p * 4;
        imgFloat[p] = imgData[i] / 255;
        imgFloat[plane + p] = imgData[i+1] / 255;
        imgFloat[plane*2 + p] = imgData[i+2] / 255;
        maskFloat[p] = maskData[i+3] > 20 ? 1.0 : 0.0;
      }

      const ort = await ensureOrt();
      const imageTensor = new ort.Tensor('float32', imgFloat, [1, 3, SZ, SZ]);
      const maskTensor = new ort.Tensor('float32', maskFloat, [1, 1, SZ, SZ]);
      const feeds = {};
      feeds[session.inputNames[0]] = imageTensor;
      feeds[session.inputNames[1]] = maskTensor;

      progressLabel.textContent = 'Running AI inpainting…';
      progressFill.style.width = '75%';
      await nextFrame();
      const results = await session.run(feeds);
      const outTensor = results[session.outputNames[0]];
      const outData = outTensor.data;
      const maxVal = Math.max(1e-6, ...outData.slice(0, 3000)); // sample rather than scan millions of values
      const scale = maxVal > 1.5 ? 255 : 255; // both branches end in 0-255 8-bit output; kept explicit for clarity
      const isZeroToOne = maxVal <= 1.5;

      progressLabel.textContent = 'Blending result into your photo…';
      progressFill.style.width = '90%';
      await nextFrame();

      // Build the 512x512 RGBA result canvas from model output (channel order
      // is [3,512,512] planar, matching the input layout).
      const outCanvas = document.createElement('canvas'); outCanvas.width = SZ; outCanvas.height = SZ;
      const outCtx = outCanvas.getContext('2d');
      const outImgData = outCtx.createImageData(SZ, SZ);
      for (let p = 0; p < plane; p++){
        const r = outData[p], g = outData[plane+p], b = outData[plane*2+p];
        outImgData.data[p*4]   = Math.max(0, Math.min(255, isZeroToOne ? r*255 : r));
        outImgData.data[p*4+1] = Math.max(0, Math.min(255, isZeroToOne ? g*255 : g));
        outImgData.data[p*4+2] = Math.max(0, Math.min(255, isZeroToOne ? b*255 : b));
        outImgData.data[p*4+3] = 255;
      }
      outCtx.putImageData(outImgData, 0, 0);

      // Upscale the AI result back to full resolution, then composite it into
      // the untouched original ONLY where the mask was painted (feathered by
      // the mask's own soft edge), so unedited pixels stay pixel-for-pixel
      // original quality.
      const upscaled = document.createElement('canvas'); upscaled.width = w; upscaled.height = h;
      upscaled.getContext('2d').imageSmoothingEnabled = true;
      upscaled.getContext('2d').drawImage(outCanvas, 0, 0, w, h);

      const finalCanvas = document.createElement('canvas'); finalCanvas.width = w; finalCanvas.height = h;
      const fctx = finalCanvas.getContext('2d');
      const origData = meOriginalCanvas.getContext('2d').getImageData(0, 0, w, h);
      const upscaledData = upscaled.getContext('2d').getImageData(0, 0, w, h);
      const fullMaskData = meMaskCanvas.getContext('2d').getImageData(0, 0, w, h);
      const finalImgData = fctx.createImageData(w, h);
      for (let i = 0; i < origData.data.length; i += 4){
        const alpha = fullMaskData.data[i+3] / 255;
        finalImgData.data[i]   = origData.data[i]   * (1-alpha) + upscaledData.data[i]   * alpha;
        finalImgData.data[i+1] = origData.data[i+1] * (1-alpha) + upscaledData.data[i+1] * alpha;
        finalImgData.data[i+2] = origData.data[i+2] * (1-alpha) + upscaledData.data[i+2] * alpha;
        finalImgData.data[i+3] = 255;
      }
      fctx.putImageData(finalImgData, 0, 0);

      meResultCanvas = finalCanvas;
      progressFill.style.width = '100%';
      renderMeComposite();
      showMeCompare();
      document.getElementById('meDownloadRow').classList.remove('hidden');
      toast('Object removed.');
    }catch(err){
      toast('AI processing failed: ' + (err.message || 'please try a different image or a smaller selection.'), 'err');
    }finally{
      setLoading(btn, false, 'Remove Object');
      setTimeout(() => progressWrap.classList.add('hidden'), 900);
    }
  };

  function showMeCompare(){
    if (!meResultCanvas) return;
    document.getElementById('meCompareBefore').src = meOriginalCanvas.toDataURL('image/png');
    document.getElementById('meCompareAfter').src = meResultCanvas.toDataURL('image/png');
    document.getElementById('meCompareWrap').classList.remove('hidden');
    document.getElementById('meCompareAfterWrap').style.width = '50%';
    document.getElementById('meCompareHandle').style.left = '50%';
  }
  const meCompareHandle = document.getElementById('meCompareHandle');
  const meCompareWrap = document.getElementById('meCompareWrap');
  function setMeComparePct(clientX){
    const rect = meCompareWrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    document.getElementById('meCompareAfterWrap').style.width = pct + '%';
    meCompareHandle.style.left = pct + '%';
  }
  meCompareHandle.addEventListener('pointerdown', (e) => {
    meCompareHandle.setPointerCapture(e.pointerId);
    function move(ev){ setMeComparePct(ev.clientX); }
    function up(){ meCompareHandle.removeEventListener('pointermove', move); meCompareHandle.removeEventListener('pointerup', up); }
    meCompareHandle.addEventListener('pointermove', move);
    meCompareHandle.addEventListener('pointerup', up);
  });

  document.getElementById('meDownloadPngBtn').onclick = () => {
    if (!meResultCanvas){ toast('Remove an object first.', 'err'); return; }
    meResultCanvas.toBlob((blob) => {
      if (!blob){ toast('Could not export this image.', 'err'); return; }
      downloadBlob(blob, 'object-removed.png');
    }, 'image/png');
  };
  document.getElementById('meDownloadJpgBtn').onclick = () => {
    if (!meResultCanvas){ toast('Remove an object first.', 'err'); return; }
    meResultCanvas.toBlob((blob) => {
      if (!blob){ toast('Could not export this image.', 'err'); return; }
      downloadBlob(blob, 'object-removed.jpg');
    }, 'image/jpeg', 0.92);
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
  contact: `
    <h3>Contact ToolFlight</h3>
    <p>Have a question, found a bug, need a custom tool, or want professional image editing services? We'd love to hear from you.</p>

    <div id="contactSuccessBanner" class="hidden" role="status" style="background:color-mix(in srgb, var(--ok) 10%, var(--card));border:1px solid var(--card-border);border-radius:12px;padding:12px;margin:14px 0;font-size:13px;">Thanks — your message has been sent. We'll get back to you within one to two business days.</div>

    <form id="contactForm" name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" netlify>
      <input type="hidden" name="form-name" value="contact">
      <p style="display:none;">
        <label>Don't fill this out if you're human: <input name="bot-field" tabindex="-1" autocomplete="off"></label>
      </p>

      <span class="field-label">Full Name</span>
      <input type="text" id="contactName" name="name" placeholder="Your full name" required aria-required="true">
      <span class="field-error" id="contactNameError"></span>

      <span class="field-label" style="margin-top:12px;">Email Address</span>
      <input type="email" id="contactEmail" name="email" placeholder="you@example.com" required aria-required="true">
      <span class="field-error" id="contactEmailError"></span>

      <span class="field-label" style="margin-top:12px;">WhatsApp Number</span>
      <input type="tel" id="contactWhatsapp" name="whatsapp" placeholder="+1 555 123 4567" required aria-required="true">
      <span class="field-error" id="contactWhatsappError"></span>

      <span class="field-label" style="margin-top:12px;">Subject <span style="text-transform:none;font-weight:500;color:var(--ink-soft);">(optional)</span></span>
      <input type="text" id="contactSubject" name="subject" placeholder="What's this about?">

      <span class="field-label" style="margin-top:12px;">Message</span>
      <textarea id="contactMessage" name="message" placeholder="Tell us a bit more..." required aria-required="true"></textarea>
      <span class="field-error" id="contactMessageError"></span>

      <div class="row">
        <button class="btn btn-primary" id="contactSubmitBtn" type="submit" style="flex:1;">Send message</button>
      </div>
    </form>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--card-border);">
      <h3 style="font-size:15px;">Direct Contact</h3>
      <p style="margin-bottom:10px;">Prefer email? Reach us directly:</p>
      <a href="mailto:qsrjehan@gmail.com" class="btn btn-ghost" style="text-decoration:none;display:inline-flex;">qsrjehan@gmail.com</a>
    </div>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--card-border);">
      <h3 style="font-size:15px;">Professional Freelancing Services</h3>
      <p style="margin-bottom:10px;">Beyond the free automated tools on this site, ToolFlight also offers hands-on freelance image editing for projects that need a closer touch:</p>
      <ul class="trust-list">
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Background Removal</strong> — precise, hand-refined removal for photos where automated tools fall short.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Background Replacement</strong> — swap in a new background, matched carefully to lighting and edges.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Transparent PNG Creation</strong> — clean, ready-to-use transparent PNGs for any use case.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Product Photo Editing</strong> — consistent, marketplace-ready product photography edits.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Image Enhancement</strong> — color, exposure, and clarity improvements.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Image Retouching</strong> — detail-level cleanup and refinement.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Object Removal</strong> — remove unwanted elements from a photo cleanly.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Watermark Removal</strong> — for images you own the rights to.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Social Media Image Editing</strong> — formatted and sized for your platform of choice.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Custom Photoshop Editing</strong> — bespoke edits for requests outside the list above.</span></li>
      </ul>
    </div>

    <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--card-border);">
      <h3 style="font-size:15px;">Why Contact Us</h3>
      <ul class="trust-list">
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Fast Response</strong> — replies within one to two business days.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Professional Quality</strong> — careful, detail-oriented editing work.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Affordable Pricing</strong> — reasonable rates discussed directly with you.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Custom Editing</strong> — tell us what you need; we'll let you know what's possible.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Worldwide Service</strong> — we work with clients anywhere, over email and WhatsApp.</span></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;margin-top:2px;color:var(--ok);"><path d="M20 6L9 17l-5-5"/></svg><span><strong>Client Satisfaction</strong> — we aim to get every edit right before calling it done.</span></li>
      </ul>
    </div>
  `,
};
function initContactForm(){
  const form = document.getElementById('contactForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  const submitBtn = document.getElementById('contactSubmitBtn');

  function showFieldError(id, message){
    const el = document.getElementById(id + 'Error');
    if (el) el.textContent = message || '';
  }
  function isValidEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function isValidPhone(v){ return /^\+?[1-9][\d\s-]{6,17}$/.test(v.trim()); }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const honeypot = form.querySelector('[name="bot-field"]');
    if (honeypot && honeypot.value){ return; }

    const fullName = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const whatsapp = document.getElementById('contactWhatsapp').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    ['contactName','contactEmail','contactWhatsapp','contactMessage'].forEach(id => showFieldError(id, ''));
    let valid = true;
    if (!fullName){ showFieldError('contactName', 'Please enter your name.'); valid = false; }
    if (!email || !isValidEmail(email)){ showFieldError('contactEmail', 'Please enter a valid email address.'); valid = false; }
    if (!whatsapp || !isValidPhone(whatsapp)){ showFieldError('contactWhatsapp', 'Please enter a valid number with country code, e.g. +1 555 123 4567.'); valid = false; }
    if (!message || message.length < 10){ showFieldError('contactMessage', 'Please enter a message (at least 10 characters).'); valid = false; }

    if (!valid){ toast('Please fix the highlighted fields.', 'err'); return; }

    setLoading(submitBtn, true);
    const formData = new FormData(form);
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    }).then((res) => {
      setLoading(submitBtn, false, 'Send message');
      if (!res.ok) throw new Error('Submission failed');
      toast("Message sent — we'll get back to you soon.");
      form.reset();
      const banner = document.getElementById('contactSuccessBanner');
      if (banner) banner.classList.remove('hidden');
    }).catch(() => {
      setLoading(submitBtn, false, 'Send message');
      toast('Something went wrong — please try again or email us directly.', 'err');
    });
  });
}
function openLegal(key){
  const content = document.getElementById('legalContent');
  const modal = document.getElementById('legalModal');
  if (!content || !modal) return;
  content.innerHTML = legalContent[key];
  modal.classList.add('show');
  if (key === 'contact') initContactForm();
}
function closeLegal(){
  const modal = document.getElementById('legalModal');
  if (modal) modal.classList.remove('show');
}
const legalModalEl = document.getElementById('legalModal');
if (legalModalEl) legalModalEl.addEventListener('click', (e) => { if (e.target.id === 'legalModal') closeLegal(); });
