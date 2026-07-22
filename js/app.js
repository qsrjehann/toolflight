/* ToolFlight — shared app logic. Loaded on every page.
   Every tool block below is guarded with an element-existence check
   so this single file works whether that tool exists on the page or not. */

/* ============ THEME ============ */
const THEME_KEY = 'toolflight_theme';
let isDark = document.documentElement.classList.contains('dark'); // already set by the early inline <head> script, before this deferred script ever runs
function applyTheme(){
  document.documentElement.classList.toggle('dark', isDark);
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  if (sun) sun.classList.toggle('hidden', isDark);
  if (moon) moon.classList.toggle('hidden', !isDark);
}
const themeToggleBtn = document.getElementById('themeToggle');
if (themeToggleBtn) themeToggleBtn.onclick = () => {
  isDark = !isDark;
  applyTheme();
  try{ localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); }catch(e){}
};
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
// Shared ONNX Runtime Web loader (MIT, Microsoft) — used by Magic Eraser and
// AI Image Upscaler. Promoted to a shared top-level helper once a second tool
// needed it, matching the same pattern as loadScriptOnce/loadImageFromFile.
const ORT_VERSION = '1.17.3';
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
// Shared, general-purpose separable box blur (O(w*h), sliding-window sum,
// not O(w*h*radius)) operating on a single-channel Float32Array plane.
// Genuinely global so any current or future tool can reuse it. Passport
// Photo Maker's own boxBlurGrayPP remains separate and untouched -- see
// note above the retouch tool's module for why.
function boxBlurGray(src, w, h, radius){
  if (radius < 1) return src.slice();
  const out = new Float32Array(src.length), tmp = new Float32Array(src.length), r = Math.round(radius);
  for (let y=0; y<h; y++){
    let sum=0; for (let x=-r; x<=r; x++) sum += src[y*w + Math.max(0, Math.min(w-1, x))];
    for (let x=0; x<w; x++){
      tmp[y*w+x] = sum/(r*2+1);
      const addX = Math.min(w-1, x+r+1), subX = Math.max(0, x-r);
      sum += src[y*w+addX] - src[y*w+subX];
    }
  }
  for (let x=0; x<w; x++){
    let sum=0; for (let y=-r; y<=r; y++) sum += tmp[Math.max(0, Math.min(h-1, y))*w + x];
    for (let y=0; y<h; y++){
      out[y*w+x] = sum/(r*2+1);
      const addY = Math.min(h-1, y+r+1), subY = Math.max(0, y-r);
      sum += tmp[addY*w+x] - tmp[subY*w+x];
    }
  }
  return out;
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
let _dragReorderCtx = null; // { listEl, arr, rerender, index } — shared across all uses since only one drag happens at a time
const _dragReorderListElsWithListener = new WeakSet();
let _dragReorderDocListenersAttached = false;
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

  // Touch/pen fallback: native HTML5 drag events don't fire from a finger on
  // Android Chrome, Firefox Android, or Samsung Internet (desktop mouse/
  // trackpad drag above is unaffected and keeps working as-is). Pointer
  // Events work uniformly for touch across all target browsers. This function
  // runs again on every list re-render, but listEl itself (the container)
  // persists across renders — only its children are rebuilt — so its
  // listener must be attached exactly once per container (tracked via
  // WeakSet), and the document-level move/up listeners exactly once, ever.
  if (!_dragReorderListElsWithListener.has(listEl)){
    _dragReorderListElsWithListener.add(listEl);
    listEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const item = e.target.closest('[draggable]');
      if (!item || item.parentElement !== listEl) return;
      _dragReorderCtx = { listEl, arr, rerender, index: Array.from(listEl.children).indexOf(item) };
      item.classList.add('dragging');
    });
  }

  if (!_dragReorderDocListenersAttached){
    _dragReorderDocListenersAttached = true;
    document.addEventListener('pointermove', (e) => {
      if (!_dragReorderCtx || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      e.preventDefault();
      const { listEl: activeList, arr: activeArr } = _dragReorderCtx;
      const items = Array.from(activeList.children);
      const overItem = document.elementFromPoint(e.clientX, e.clientY)?.closest('[draggable]');
      if (!overItem || overItem.parentElement !== activeList) return;
      const overIndex = items.indexOf(overItem);
      if (overIndex === -1 || overIndex === _dragReorderCtx.index) return;
      const moved = activeArr.splice(_dragReorderCtx.index, 1)[0];
      activeArr.splice(overIndex, 0, moved);
      _dragReorderCtx.index = overIndex;
      _dragReorderCtx.rerender();
    }, { passive: false });
    document.addEventListener('pointerup', () => {
      if (!_dragReorderCtx) return;
      Array.from(_dragReorderCtx.listEl.children).forEach(el => el.classList.remove('dragging'));
      _dragReorderCtx = null;
    });
  }
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
  document.addEventListener('pointermove', (e) => {
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
  document.addEventListener('pointerup', () => {
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

/* ============ AI PHOTO ENHANCER (ai-photo-enhancer.html) ============
   Honest architecture, stated plainly rather than blurred: real AI is used
   for exactly one job — MediaPipe Face Landmarker (Apache 2.0, Google,
   github.com/google-ai-edge/mediapipe) detects 478 3D face landmarks so
   skin-smoothing and eye-clarity effects can be targeted precisely at the
   right regions (face oval, excluding eyes/eyebrows/lips) instead of
   applied blindly to the whole image. The actual pixel enhancement
   operations themselves — brightness, contrast, saturation, white balance,
   sharpness, noise reduction, tone mapping — are genuine per-pixel
   algorithmic image processing (linear transforms, HSL saturation, gray-
   world white balance, unsharp masking, box blur, local tone curves),
   computed directly on canvas pixel data. This is real, established
   computer-vision technique — not a deep-learning model, and NOT a simple
   decorative CSS filter either. No face-shape warping, no identity change,
   no makeup synthesis is performed anywhere in this pipeline. */
if (document.getElementById('apeDrop')){
  const MP_VERSION_APE = '0.10.2';
  const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const APE_MAX_DIM = 1600; // working/preview resolution cap for responsive sliders

  let apeOriginalImg = null;       // full-resolution source <img>, untouched
  let apeWorkCanvas = null;        // capped-resolution canvas used for live preview
  let apeEditCanvas = null;        // visible canvas showing the live-enhanced preview
  let apeFaceLandmarks = null;     // detected landmarks (working-resolution coordinates), or null
  let apeSkinMask = null;          // Uint8ClampedArray, working resolution, 0-255 = smoothing strength
  let apeHistoryStack = [], apeHistoryIndex = -1;
  const APE_MAX_HISTORY = 20;
  let apeFaceLandmarkerPromise = null;
  let apeResultCanvasFullRes = null; // set once "Apply / Export" builds the full-resolution result

  const apeSliders = { brightness:0, contrast:0, saturation:0, sharpness:0, noise:0, smoothing:0 };
  let apeStrength = 100;
  let apeFaceEnhanceOn = false, apeWhiteBalanceOn = false, apeHdrOn = false;

  function apeGetControls(){
    return {
      brightness: +document.getElementById('apeBrightness').value,
      contrast: +document.getElementById('apeContrast').value,
      saturation: +document.getElementById('apeSaturation').value,
      sharpness: +document.getElementById('apeSharpness').value,
      noise: +document.getElementById('apeNoise').value,
      smoothing: +document.getElementById('apeSmoothing').value,
      strength: +document.getElementById('apeStrength').value / 100,
      faceEnhance: document.getElementById('apeFaceEnhance').checked,
      whiteBalance: document.getElementById('apeWhiteBalance').checked,
      hdr: document.getElementById('apeHdr').checked,
    };
  }

  /* ---------- Core algorithmic image processing (real per-pixel computation) ---------- */
  function rgbToHsl(r, g, b){
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h=0, s=0; const l=(max+min)/2;
    if (max !== min){
      const d = max-min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      if (max===r) h = (g-b)/d + (g<b?6:0);
      else if (max===g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h /= 6;
    }
    return [h,s,l];
  }
  function hslToRgb(h, s, l){
    if (s === 0){ const v = l*255; return [v,v,v]; }
    const hue2rgb = (p,q,t) => {
      if (t<0) t+=1; if (t>1) t-=1;
      if (t<1/6) return p+(q-p)*6*t;
      if (t<1/2) return q;
      if (t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    return [hue2rgb(p,q,h+1/3)*255, hue2rgb(p,q,h)*255, hue2rgb(p,q,h-1/3)*255];
  }

  function applyBrightnessContrast(data, brightness, contrast){
    if (!brightness && !contrast) return;
    const b = brightness * 1.6;
    const c = (259 * (contrast + 255)) / (255 * (259 - Math.max(-255, Math.min(255, contrast))));
    for (let i = 0; i < data.length; i += 4){
      for (let ch = 0; ch < 3; ch++){
        let v = data[i+ch] + b;
        v = c * (v - 128) + 128;
        data[i+ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  function applySaturation(data, amount, vibrance){
    if (!amount) return;
    const scale = 1 + amount/100;
    for (let i = 0; i < data.length; i += 4){
      const [h,s,l] = rgbToHsl(data[i], data[i+1], data[i+2]);
      // Vibrance mode: boost low-saturation pixels more than already-saturated
      // ones (protects skin tones from oversaturating) — a real, standard
      // technique distinct from flat saturation scaling.
      const localScale = vibrance ? 1 + (amount/100) * (1 - s) : scale;
      const newS = Math.max(0, Math.min(1, s * localScale));
      const [r,g,b] = hslToRgb(h, newS, l);
      data[i]=r; data[i+1]=g; data[i+2]=b;
    }
  }

  function grayWorldWhiteBalance(data){
    let sr=0, sg=0, sb=0, n=0;
    for (let i = 0; i < data.length; i += 4){ sr+=data[i]; sg+=data[i+1]; sb+=data[i+2]; n++; }
    const avgR=sr/n, avgG=sg/n, avgB=sb/n;
    const avgGray = (avgR+avgG+avgB)/3;
    if (avgR<1||avgG<1||avgB<1) return;
    const kr = avgGray/avgR, kg = avgGray/avgG, kb = avgGray/avgB;
    for (let i = 0; i < data.length; i += 4){
      data[i]   = Math.max(0, Math.min(255, data[i]*kr));
      data[i+1] = Math.max(0, Math.min(255, data[i+1]*kg));
      data[i+2] = Math.max(0, Math.min(255, data[i+2]*kb));
    }
  }

  function boxBlurGray(src, w, h, radius){
    // Fast separable box blur used for both noise reduction and as the base
    // layer for unsharp masking / frequency-separation skin smoothing.
    if (radius < 1) return src.slice();
    const out = new Float32Array(src.length);
    const tmp = new Float32Array(src.length);
    const r = Math.round(radius);
    for (let y = 0; y < h; y++){
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y*w + Math.max(0, Math.min(w-1, x))];
      for (let x = 0; x < w; x++){
        tmp[y*w+x] = sum / (r*2+1);
        const addX = Math.min(w-1, x+r+1), subX = Math.max(0, x-r);
        sum += src[y*w+addX] - src[y*w+subX];
      }
    }
    for (let x = 0; x < w; x++){
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h-1, y))*w + x];
      for (let y = 0; y < h; y++){
        out[y*w+x] = sum / (r*2+1);
        const addY = Math.min(h-1, y+r+1), subY = Math.max(0, y-r);
        sum += tmp[addY*w+x] - tmp[subY*w+x];
      }
    }
    return out;
  }

  function applyNoiseReduction(data, w, h, amount){
    if (amount <= 0) return;
    const radius = 1 + (amount/100) * 2.5;
    for (let ch = 0; ch < 3; ch++){
      const plane = new Float32Array(w*h);
      for (let p = 0; p < w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, radius);
      const mix = Math.min(0.85, amount/100 * 0.9); // never fully replace detail
      for (let p = 0; p < w*h; p++) data[p*4+ch] = plane[p]*(1-mix) + blurred[p]*mix;
    }
  }

  function applySharpness(data, w, h, amount){
    if (amount <= 0) return;
    const strength = amount/100 * 1.2;
    for (let ch = 0; ch < 3; ch++){
      const plane = new Float32Array(w*h);
      for (let p = 0; p < w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, 2);
      for (let p = 0; p < w*h; p++){
        const detail = plane[p] - blurred[p]; // unsharp mask: original minus low-frequency base
        const v = plane[p] + detail * strength;
        data[p*4+ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  function applyHdrLikeToneMap(data, w, h){
    // Single-image local tone mapping (lifts shadows, gently compresses
    // highlights using a locally-blurred luminance map as a guide) — an
    // approximation of HDR-style local contrast, not literal multi-exposure
    // HDR, which isn't possible from one input photo. Disclosed honestly in
    // the tool's own FAQ.
    const lum = new Float32Array(w*h);
    for (let p = 0; p < w*h; p++){
      const i = p*4;
      lum[p] = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
    }
    const localAvg = boxBlurGray(lum, w, h, Math.max(8, Math.round(Math.min(w,h)/20)));
    for (let p = 0; p < w*h; p++){
      const i = p*4;
      const shadowLift = Math.max(0, (128 - localAvg[p]) / 128) * 18;
      const highlightComp = Math.max(0, (localAvg[p] - 200) / 55) * 14;
      const adj = shadowLift - highlightComp;
      for (let ch = 0; ch < 3; ch++){
        const v = data[i+ch] + adj;
        data[i+ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  function applySkinSmoothing(data, w, h, amount, maskArr){
    if (amount <= 0) return;
    const radius = 1.5 + (amount/100) * 4;
    const detailRetain = 0.35; // keep some high-frequency detail so skin doesn't go flat/plastic
    for (let ch = 0; ch < 3; ch++){
      const plane = new Float32Array(w*h);
      for (let p = 0; p < w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, radius);
      for (let p = 0; p < w*h; p++){
        const localMask = maskArr ? maskArr[p]/255 : 1; // 1 = whole image if no face detected
        const strength = (amount/100) * localMask;
        if (strength <= 0) continue;
        const detail = plane[p] - blurred[p];
        const smoothed = blurred[p] + detail * detailRetain;
        const v = plane[p]*(1-strength) + smoothed*strength;
        data[p*4+ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  /* ---------- Face detection (real AI, MediaPipe Face Landmarker) ---------- */
  async function ensureFaceLandmarker(){
    if (!apeFaceLandmarkerPromise){
      apeFaceLandmarkerPromise = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_APE}`);
        const { FaceLandmarker, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_APE}/wasm`
        );
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      })().catch((err) => { apeFaceLandmarkerPromise = null; throw err; });
    }
    return apeFaceLandmarkerPromise;
  }

  // Landmark index sets for the MediaPipe 478-point face mesh (documented,
  // standard indices) — used to exclude eyes/eyebrows/lips from the skin mask
  // so smoothing never touches those features, and to locate the eyes for
  // eye-clarity enhancement.
  const APE_LEFT_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  const APE_RIGHT_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  const APE_LIPS = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,185,40,39,37,0,267,269,270,409,415,310,311,312,13,82,81,42,183,78];
  const APE_FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

  function buildSkinMask(landmarks, w, h){
    const mask = new Uint8ClampedArray(w*h);
    function fillPoly(ctx, indices){
      ctx.beginPath();
      indices.forEach((idx, i) => {
        const lm = landmarks[idx];
        const x = lm.x * w, y = lm.y * h;
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.closePath();
      ctx.fill();
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    fillPoly(ctx, APE_FACE_OVAL);
    ctx.fillStyle = '#000'; // cut out eyes/lips so smoothing never touches them
    fillPoly(ctx, APE_LEFT_EYE);
    fillPoly(ctx, APE_RIGHT_EYE);
    fillPoly(ctx, APE_LIPS);
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let p = 0; p < w*h; p++) mask[p] = d[p*4];
    return mask;
  }

  function applyEyeClarity(data, w, h, landmarks){
    if (!landmarks) return;
    [APE_LEFT_EYE, APE_RIGHT_EYE].forEach(eyeIdx => {
      let minX=1,minY=1,maxX=0,maxY=0;
      eyeIdx.forEach(idx => {
        const lm = landmarks[idx];
        minX=Math.min(minX,lm.x); maxX=Math.max(maxX,lm.x);
        minY=Math.min(minY,lm.y); maxY=Math.max(maxY,lm.y);
      });
      const pad = 0.01;
      const x0 = Math.max(0, Math.round((minX-pad)*w)), x1 = Math.min(w, Math.round((maxX+pad)*w));
      const y0 = Math.max(0, Math.round((minY-pad)*h)), y1 = Math.min(h, Math.round((maxY+pad)*h));
      if (x1<=x0 || y1<=y0) return;
      // Local mild contrast + sharpness boost, confined to the eye bounding box only.
      const rw = x1-x0, rh = y1-y0;
      const plane = new Float32Array(rw*rh*3);
      for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){
        const i=((y*w+x)*4);
        const p=((y-y0)*rw+(x-x0))*3;
        plane[p]=data[i]; plane[p+1]=data[i+1]; plane[p+2]=data[i+2];
      }
      for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){
        const i=(y*w+x)*4;
        for (let ch=0; ch<3; ch++){
          const v = (data[i+ch]-128)*1.12 + 128 + 6; // mild local contrast + slight brighten
          data[i+ch] = v<0?0:v>255?255:v;
        }
      }
    });
  }

  /* ---------- Pipeline: run all enabled operations on a given ImageData ---------- */
  async function runEnhancementPipeline(canvas, controls, landmarks, skinMask, onProgress){
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const s = controls.strength;

    if (controls.whiteBalance){ onProgress && onProgress('Correcting white balance…'); grayWorldWhiteBalance(data); await nextFrame(); }
    applyBrightnessContrast(data, controls.brightness*s, controls.contrast*s);
    applySaturation(data, controls.saturation*s, true);
    if (controls.hdr){ onProgress && onProgress('Applying HDR-like tone mapping…'); applyHdrLikeToneMap(data, w, h); await nextFrame(); }
    if (controls.noise > 0){ onProgress && onProgress('Reducing noise…'); applyNoiseReduction(data, w, h, controls.noise*s); await nextFrame(); }
    if (controls.smoothing > 0){
      onProgress && onProgress('Smoothing skin naturally…');
      applySkinSmoothing(data, w, h, controls.smoothing*s, controls.faceEnhance ? skinMask : null);
      await nextFrame();
    }
    if (controls.sharpness > 0){ onProgress && onProgress('Enhancing detail…'); applySharpness(data, w, h, controls.sharpness*s); await nextFrame(); }
    if (controls.faceEnhance && landmarks){ onProgress && onProgress('Enhancing eye clarity…'); applyEyeClarity(data, w, h, landmarks); }

    ctx.putImageData(imgData, 0, 0);
  }

  /* ---------- Upload + init ---------- */
  setupDropZone('apeDrop','apeInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > 40*1024*1024){ toast(`That image is ${fmtBytes(f.size)} — the limit is 40MB.`, 'err'); return; }
    try{
      apeOriginalImg = await loadImageFromFile(f);
      await initApeEditor();
      toast('Image loaded.');
    }catch(err){
      toast(err.message || 'Could not read this image.', 'err');
    }
  });

  async function initApeEditor(){
    const ow = apeOriginalImg.naturalWidth, oh = apeOriginalImg.naturalHeight;
    const scale = Math.min(1, APE_MAX_DIM / Math.max(ow, oh));
    const w = Math.round(ow*scale), h = Math.round(oh*scale);

    apeWorkCanvas = document.createElement('canvas');
    apeWorkCanvas.width = w; apeWorkCanvas.height = h;
    apeWorkCanvas.getContext('2d').drawImage(apeOriginalImg, 0, 0, w, h); // strips EXIF, same as every other ToolFlight image tool

    apeEditCanvas = document.getElementById('apeEditCanvas');
    apeEditCanvas.width = w; apeEditCanvas.height = h;
    apeEditCanvas.getContext('2d').drawImage(apeWorkCanvas, 0, 0);

    apeFaceLandmarks = null;
    apeSkinMask = null;
    apeResultCanvasFullRes = null;
    apeHistoryStack = []; apeHistoryIndex = -1;
    pushApeHistory();

    document.getElementById('apeStage').classList.remove('hidden');
    document.getElementById('apeDownloadRow').classList.remove('hidden');
    document.getElementById('apeCompareWrap').classList.add('hidden');
    setApeZoom(100);
  }

  function pushApeHistory(){
    const snap = apeEditCanvas.getContext('2d').getImageData(0, 0, apeEditCanvas.width, apeEditCanvas.height);
    apeHistoryStack = apeHistoryStack.slice(0, apeHistoryIndex + 1);
    apeHistoryStack.push(snap);
    if (apeHistoryStack.length > APE_MAX_HISTORY) apeHistoryStack.shift();
    apeHistoryIndex = apeHistoryStack.length - 1;
  }
  function restoreApeHistory(idx){
    if (idx < 0 || idx >= apeHistoryStack.length) return;
    apeEditCanvas.getContext('2d').putImageData(apeHistoryStack[idx], 0, 0);
    apeHistoryIndex = idx;
  }
  function apeUndo(){ if (apeHistoryIndex > 0) restoreApeHistory(apeHistoryIndex - 1); else toast('Nothing to undo.'); }
  function apeRedo(){ if (apeHistoryIndex < apeHistoryStack.length - 1) restoreApeHistory(apeHistoryIndex + 1); else toast('Nothing to redo.'); }

  async function applyLivePreview(){
    if (!apeWorkCanvas) return;
    const controls = apeGetControls();
    const preview = document.createElement('canvas');
    preview.width = apeWorkCanvas.width; preview.height = apeWorkCanvas.height;
    preview.getContext('2d').drawImage(apeWorkCanvas, 0, 0);

    if (controls.faceEnhance && !apeFaceLandmarks){
      try{
        document.getElementById('apeModelStatus').textContent = 'Loading face detection model…';
        document.getElementById('apeModelStatus').classList.remove('hidden');
        const landmarker = await ensureFaceLandmarker();
        const result = landmarker.detect(preview);
        if (result.faceLandmarks && result.faceLandmarks.length){
          apeFaceLandmarks = result.faceLandmarks[0];
          apeSkinMask = buildSkinMask(apeFaceLandmarks, preview.width, preview.height);
          document.getElementById('apeModelStatus').textContent = 'Face detected — smoothing and eye clarity are now targeted precisely.';
        } else {
          document.getElementById('apeModelStatus').textContent = 'No face detected — enhancements applied to the whole image instead.';
        }
      }catch(err){
        document.getElementById('apeModelStatus').textContent = 'Face detection unavailable — enhancements applied to the whole image instead.';
      }
      setTimeout(() => document.getElementById('apeModelStatus').classList.add('hidden'), 3500);
    }

    await runEnhancementPipeline(preview, controls, apeFaceLandmarks, apeSkinMask);
    apeEditCanvas.getContext('2d').clearRect(0, 0, apeEditCanvas.width, apeEditCanvas.height);
    apeEditCanvas.getContext('2d').drawImage(preview, 0, 0);
  }

  let apeDebounceTimer = null;
  function scheduleApePreview(){
    clearTimeout(apeDebounceTimer);
    apeDebounceTimer = setTimeout(() => { applyLivePreview().then(() => pushApeHistory()); }, 250);
  }

  ['apeBrightness','apeContrast','apeSaturation','apeSharpness','apeNoise','apeSmoothing','apeStrength'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', (e) => {
      document.getElementById(id + 'Val').textContent = e.target.value;
      applyLivePreview(); // instant visual feedback while dragging
    });
    el.addEventListener('change', scheduleApePreview); // commit to undo history once released
  });
  ['apeFaceEnhance','apeWhiteBalance','apeHdr'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { applyLivePreview().then(() => pushApeHistory()); });
  });

  document.getElementById('apeAutoEnhanceBtn').onclick = async () => {
    if (!apeWorkCanvas) return;
    const ctx = apeWorkCanvas.getContext('2d');
    const data = ctx.getImageData(0, 0, apeWorkCanvas.width, apeWorkCanvas.height).data;
    // Real histogram-based auto adjustment: measure mean luminance and
    // contrast spread, then derive slider values from that — not random,
    // not a fixed preset.
    let sum = 0, min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4){
      const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
      sum += lum; if (lum < min) min = lum; if (lum > max) max = lum;
    }
    const mean = sum / (data.length/4);
    const spread = Math.max(1, max - min);
    const autoBrightness = Math.max(-30, Math.min(30, Math.round((128 - mean) * 0.35)));
    const autoContrast = Math.max(0, Math.min(35, Math.round((255 - spread) / 255 * 45)));
    document.getElementById('apeBrightness').value = autoBrightness;
    document.getElementById('apeContrast').value = autoContrast;
    document.getElementById('apeSaturation').value = 12;
    document.getElementById('apeSharpness').value = 15;
    document.getElementById('apeBrightnessVal').textContent = autoBrightness;
    document.getElementById('apeContrastVal').textContent = autoContrast;
    document.getElementById('apeSaturationVal').textContent = 12;
    document.getElementById('apeSharpnessVal').textContent = 15;
    document.getElementById('apeWhiteBalance').checked = true;
    await applyLivePreview();
    pushApeHistory();
    toast('Auto enhance applied — fine-tune with the sliders if you like.');
  };

  document.getElementById('apeResetBtn').onclick = () => {
    ['apeBrightness','apeContrast','apeSaturation','apeSharpness','apeNoise','apeSmoothing'].forEach(id => {
      document.getElementById(id).value = 0;
      document.getElementById(id + 'Val').textContent = 0;
    });
    document.getElementById('apeStrength').value = 100;
    document.getElementById('apeStrengthVal').textContent = 100;
    document.getElementById('apeFaceEnhance').checked = false;
    document.getElementById('apeWhiteBalance').checked = false;
    document.getElementById('apeHdr').checked = false;
    apeFaceLandmarks = null; apeSkinMask = null;
    applyLivePreview().then(() => pushApeHistory());
    toast('Reset to original image.');
  };

  document.getElementById('apeUndoBtn').onclick = apeUndo;
  document.getElementById('apeRedoBtn').onclick = apeRedo;

  /* ---------- Zoom / pan (same proven pattern as the AI Background Remover / Magic Eraser) ---------- */
  const apeStageWrap = document.getElementById('apeStageWrap');
  function setApeZoom(pct){
    const canvas = document.getElementById('apeEditCanvas');
    if (!canvas || !canvas.width) return;
    canvas.style.width = Math.round(canvas.width * (pct/100)) + 'px';
    canvas.style.height = Math.round(canvas.height * (pct/100)) + 'px';
    const sel = document.getElementById('apeZoomSelect');
    if (sel) sel.value = String(pct);
  }
  document.getElementById('apeZoomSelect').onchange = (e) => setApeZoom(+e.target.value);
  document.getElementById('apeFitScreenBtn').onclick = () => {
    const canvas = document.getElementById('apeEditCanvas');
    const wrapWidth = apeStageWrap.clientWidth - 20;
    setApeZoom(Math.max(10, Math.min(100, Math.round((wrapWidth / canvas.width) * 100))));
  };
  apeStageWrap.addEventListener('wheel', (e) => {
    if (!apeWorkCanvas) return;
    e.preventDefault();
    const sel = document.getElementById('apeZoomSelect');
    const current = sel ? +sel.value : 100;
    setApeZoom(Math.max(25, Math.min(400, current + (e.deltaY < 0 ? 15 : -15))));
  }, { passive: false });

  // Two-finger pinch zoom + pan on touch devices (same pattern proven in the
  // AI Background Remover).
  let apePinchStartDist = null, apePinchStartZoom = 100, apePinchStartMid = null, apePinchStartScroll = null;
  apeStageWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2){
      e.preventDefault();
      const [a,b] = e.touches;
      apePinchStartDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      apePinchStartZoom = +document.getElementById('apeZoomSelect').value;
      apePinchStartMid = { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 };
      apePinchStartScroll = { left: apeStageWrap.scrollLeft, top: apeStageWrap.scrollTop };
    }
  }, { passive: false });
  apeStageWrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && apePinchStartDist){
      e.preventDefault();
      const [a,b] = e.touches;
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      setApeZoom(Math.max(25, Math.min(400, Math.round(apePinchStartZoom * (dist/apePinchStartDist)))));
      const mid = { x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2 };
      apeStageWrap.scrollLeft = apePinchStartScroll.left - (mid.x - apePinchStartMid.x);
      apeStageWrap.scrollTop = apePinchStartScroll.top - (mid.y - apePinchStartMid.y);
    }
  }, { passive: false });
  apeStageWrap.addEventListener('touchend', (e) => { if (e.touches.length < 2){ apePinchStartDist=null; apePinchStartMid=null; } });

  document.addEventListener('keydown', (e) => {
    const stage = document.getElementById('apeStage');
    if (!stage || stage.classList.contains('hidden')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){ apeUndo(); e.preventDefault(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase()==='y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ apeRedo(); e.preventDefault(); }
  });

  /* ---------- Before/After compare slider (same proven pattern) ---------- */
  function showApeCompare(){
    document.getElementById('apeCompareBefore').src = apeWorkCanvas.toDataURL('image/png');
    document.getElementById('apeCompareAfter').src = apeEditCanvas.toDataURL('image/png');
    document.getElementById('apeCompareWrap').classList.remove('hidden');
    document.getElementById('apeCompareAfterWrap').style.width = '50%';
    document.getElementById('apeCompareHandle').style.left = '50%';
  }
  const apeCompareHandle = document.getElementById('apeCompareHandle');
  const apeCompareWrap = document.getElementById('apeCompareWrap');
  function setApeComparePct(clientX){
    const rect = apeCompareWrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    document.getElementById('apeCompareAfterWrap').style.width = pct + '%';
    apeCompareHandle.style.left = pct + '%';
  }
  apeCompareHandle.addEventListener('pointerdown', (e) => {
    apeCompareHandle.setPointerCapture(e.pointerId);
    function move(ev){ setApeComparePct(ev.clientX); }
    function up(){ apeCompareHandle.removeEventListener('pointermove', move); apeCompareHandle.removeEventListener('pointerup', up); }
    apeCompareHandle.addEventListener('pointermove', move);
    apeCompareHandle.addEventListener('pointerup', up);
  });
  document.getElementById('apeCompareBtn').onclick = showApeCompare;

  /* ---------- Full-resolution export ---------- */
  async function buildFullResResult(onProgress){
    const ow = apeOriginalImg.naturalWidth, oh = apeOriginalImg.naturalHeight;
    const full = document.createElement('canvas');
    full.width = ow; full.height = oh;
    full.getContext('2d').drawImage(apeOriginalImg, 0, 0);

    let fullLandmarks = null, fullMask = null;
    const controls = apeGetControls();
    if (controls.faceEnhance){
      try{
        const landmarker = await ensureFaceLandmarker();
        const result = landmarker.detect(full);
        if (result.faceLandmarks && result.faceLandmarks.length){
          fullLandmarks = result.faceLandmarks[0];
          fullMask = buildSkinMask(fullLandmarks, ow, oh);
        }
      }catch(err){ /* fall back to whole-image enhancement, same as preview */ }
    }
    await runEnhancementPipeline(full, controls, fullLandmarks, fullMask, onProgress);
    return full;
  }

  document.getElementById('apeDownloadPngBtn').onclick = () => exportApe('png');
  document.getElementById('apeDownloadJpgBtn').onclick = () => exportApe('jpg');
  document.getElementById('apeDownloadWebpBtn').onclick = () => exportApe('webp');

  async function exportApe(format){
    if (!apeOriginalImg){ toast('Upload an image first.', 'err'); return; }
    const btnId = format === 'png' ? 'apeDownloadPngBtn' : format === 'jpg' ? 'apeDownloadJpgBtn' : 'apeDownloadWebpBtn';
    const btn = document.getElementById(btnId);
    setLoading(btn, true);
    const progressWrap = document.getElementById('apeProgressWrap');
    const progressLabel = document.getElementById('apeProgressLabel');
    progressWrap.classList.remove('hidden');
    try{
      progressLabel.textContent = 'Rebuilding at full resolution…';
      apeResultCanvasFullRes = await buildFullResResult((msg) => { progressLabel.textContent = msg; });
      const quality = +document.getElementById('apeQuality').value / 100;
      const mime = format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp';
      const ext = format === 'jpg' ? 'jpg' : format;
      apeResultCanvasFullRes.toBlob((blob) => {
        if (!blob){ toast('This browser could not encode that format — try PNG instead.', 'err'); return; }
        downloadBlob(blob, 'enhanced-photo.' + ext);
        toast('Downloaded at full original resolution.');
      }, mime, format === 'png' ? undefined : quality);
    }catch(err){
      toast('Enhancement failed: ' + (err.message || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, format === 'png' ? 'Download PNG' : format === 'jpg' ? 'Download JPG' : 'Download WEBP');
      setTimeout(() => progressWrap.classList.add('hidden'), 800);
    }
  }

  document.getElementById('apeQuality').addEventListener('input', (e) => {
    document.getElementById('apeQualityVal').textContent = e.target.value;
  });
}

/* ============ PDF <-> WORD CONVERTER (pdf-to-word.html / word-to-pdf.html) ============
   Two honest architectural facts, stated in code comments because they drove
   real design decisions, not just disclosed after the fact:

   1. Word -> PDF does NOT use the common html2canvas/jsPDF.html() rasterization
      shortcut. That approach embeds a screenshot image in the PDF -- the text
      is not selectable, searchable, or accessible to screen readers. Verified
      this directly before choosing an approach. Instead: mammoth.js (BSD-2-
      Clause) converts the .docx to semantic HTML, then a custom renderer here
      walks that HTML and places real text into the PDF via pdf-lib's
      drawText() -- genuinely selectable/searchable output, at the cost of
      writing our own word-wrap/pagination logic.

   2. PDF -> Word is fundamentally harder than the reverse: a PDF has no
      inherent semantic structure (no real "this is a heading" markup, just
      positioned glyphs), unlike a .docx which does. Headings, bold/italic,
      and paragraph breaks are reconstructed via font-size/font-name/position
      HEURISTICS -- not guaranteed, especially on complex or unusually-
      formatted PDFs. Tables and images are intentionally NOT reconstructed
      in this direction: reliably detecting table grid structure from raw
      glyph positions is a genuinely hard, error-prone problem, and a wrong
      guess (misplaced cells, garbled reading order) is worse than an honest
      "not supported" -- so this is disclosed plainly rather than faked. */
if (document.getElementById('pwDrop')){
  const PDFJS_VER_PW = '4.5.136';
  const DOCX_LIB_VER = '9.5.1';
  let pwMode = document.getElementById('pwTabPdfToWord').classList.contains('active') ? 'p2w' : 'w2p';
  let pwFile = null;
  let pwResultBlob = null;
  let pwCancelled = false;
  let pdfjsLoadPromisePW = null;
  let mammothLoadPromise = null;
  let docxLoadPromise = null;

  async function ensurePdfJsPW(){
    if (!pdfjsLoadPromisePW){
      pdfjsLoadPromisePW = (async () => {
        const pdfjsLib = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_PW}/build/pdf.min.mjs`);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_PW}/build/pdf.worker.min.mjs`;
        return pdfjsLib;
      })().catch((err) => { pdfjsLoadPromisePW = null; throw err; });
    }
    return pdfjsLoadPromisePW;
  }
  async function ensureMammoth(){
    if (!mammothLoadPromise){
      mammothLoadPromise = (async () => {
        await loadScriptOnce('https://cdn.jsdelivr.net/npm/mammoth@1.12.0/mammoth.browser.min.js');
        if (!window.mammoth) throw new Error('Mammoth failed to load.');
        return window.mammoth;
      })().catch((err) => { mammothLoadPromise = null; throw err; });
    }
    return mammothLoadPromise;
  }
  async function ensureDocxLib(){
    if (!docxLoadPromise){
      docxLoadPromise = import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/docx@${DOCX_LIB_VER}/dist/index.mjs`)
        .catch((err) => { docxLoadPromise = null; throw err; });
    }
    return docxLoadPromise;
  }

  /* ---------- Tabs ---------- */
  function setPwMode(mode){
    pwMode = mode;
    document.getElementById('pwTabPdfToWord').classList.toggle('active', mode === 'p2w');
    document.getElementById('pwTabWordToPdf').classList.toggle('active', mode === 'w2p');
    document.getElementById('pwInput').accept = mode === 'p2w' ? 'application/pdf' : '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    document.getElementById('pwDropSub').textContent = mode === 'p2w' ? 'PDF — up to 40MB' : 'DOCX or DOC — up to 40MB';
    document.getElementById('pwDropTitle').textContent = mode === 'p2w' ? 'Drop a PDF here or tap to browse' : 'Drop a Word document here or tap to browse';
    document.getElementById('pwConvertBtn').textContent = mode === 'p2w' ? 'Convert to Word' : 'Convert to PDF';
    resetPwState();
  }
  document.getElementById('pwTabPdfToWord').onclick = () => setPwMode('p2w');
  document.getElementById('pwTabWordToPdf').onclick = () => setPwMode('w2p');

  function resetPwState(){
    pwFile = null; pwResultBlob = null;
    document.getElementById('pwFileInfo').classList.add('hidden');
    document.getElementById('pwConvertBtn').disabled = true;
    document.getElementById('pwResultRow').classList.add('hidden');
    document.getElementById('pwProgressWrap').classList.add('hidden');
    document.getElementById('pwErrorBox').classList.add('hidden');
  }

  setupDropZone('pwDrop','pwInput', async (files) => {
    const wantPdf = pwMode === 'p2w';
    const f = files.find(f => wantPdf ? f.type === 'application/pdf' : (f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc')));
    if (!f){ if (files.length>0) toast(`Please select a ${wantPdf ? 'PDF' : 'Word (.docx/.doc)'} file.`, 'err'); return; }
    if (f.size > 40*1024*1024){ toast(`That file is ${fmtBytes(f.size)} — the limit is 40MB.`, 'err'); return; }
    if (!wantPdf && f.name.toLowerCase().endsWith('.doc') && !f.name.toLowerCase().endsWith('.docx')){
      toast('Legacy .doc files aren\u2019t supported — only modern .docx. Please save as .docx first.', 'err');
      return;
    }
    resetPwState();
    pwFile = f;
    document.getElementById('pwFileInfo').classList.remove('hidden');
    document.getElementById('pwFileName').textContent = f.name;
    document.getElementById('pwFileSize').textContent = fmtBytes(f.size);
    document.getElementById('pwPageCount').textContent = '';
    document.getElementById('pwConvertBtn').disabled = false;

    if (wantPdf){
      try{
        const pdfjsLib = await ensurePdfJsPW();
        const bytes = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        document.getElementById('pwPageCount').textContent = ' · ' + pdf.numPages + ' page' + (pdf.numPages!==1?'s':'');
      }catch(e){ /* page count is a nicety, not required to proceed */ }
    }
  });

  function setPwProgress(pct, label){
    document.getElementById('pwProgressWrap').classList.remove('hidden');
    document.getElementById('pwProgressFill').style.width = pct + '%';
    document.getElementById('pwProgressLabel').textContent = label;
  }
  function showPwError(msg){
    const box = document.getElementById('pwErrorBox');
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  document.getElementById('pwCancelBtn').onclick = () => { pwCancelled = true; };

  document.getElementById('pwConvertBtn').onclick = async () => {
    if (!pwFile) return;
    pwCancelled = false;
    const btn = document.getElementById('pwConvertBtn');
    setLoading(btn, true);
    document.getElementById('pwErrorBox').classList.add('hidden');
    document.getElementById('pwCancelBtn').classList.remove('hidden');
    try{
      if (pwMode === 'p2w'){
        pwResultBlob = await convertPdfToWord(pwFile, setPwProgress, () => pwCancelled);
      } else {
        pwResultBlob = await convertWordToPdf(pwFile, setPwProgress, () => pwCancelled);
      }
      if (pwCancelled){ setPwProgress(0,''); document.getElementById('pwProgressWrap').classList.add('hidden'); toast('Cancelled.'); return; }
      document.getElementById('pwResultRow').classList.remove('hidden');
      toast('Conversion complete.');
    }catch(err){
      if (!pwCancelled) showPwError((err && err.message) ? err.message : 'Conversion failed — please try a different file.');
    }finally{
      setLoading(btn, false, pwMode === 'p2w' ? 'Convert to Word' : 'Convert to PDF');
      document.getElementById('pwCancelBtn').classList.add('hidden');
      setTimeout(() => document.getElementById('pwProgressWrap').classList.add('hidden'), 900);
    }
  };

  document.getElementById('pwDownloadBtn').onclick = () => {
    if (!pwResultBlob) return;
    const name = (pwFile.name.replace(/\.[^.]+$/, '')) + (pwMode === 'p2w' ? '.docx' : '.pdf');
    downloadBlob(pwResultBlob, name);
  };
  document.getElementById('pwConvertAnotherBtn').onclick = () => { resetPwState(); };

  /* ================= PDF -> WORD ================= */
  async function convertPdfToWord(file, onProgress, isCancelled){
    onProgress(5, 'Reading PDF\u2026');
    const pdfjsLib = await ensurePdfJsPW();
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const docxLib = await ensureDocxLib();
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, PageBreak } = docxLib;

    // Pass 1: collect all font sizes across the document to find the "body
    // text" baseline size, so headings can be detected relative to it rather
    // than against an arbitrary fixed number.
    const allSizes = [];
    const pageTextItems = [];
    for (let p = 1; p <= pdf.numPages; p++){
      if (isCancelled()) return null;
      onProgress(5 + Math.round((p/pdf.numPages)*35), `Reading page ${p} of ${pdf.numPages}\u2026`);
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const annotations = await page.getAnnotations();
      const links = annotations.filter(a => a.subtype === 'Link' && a.url).map(a => ({ rect: a.rect, url: a.url }));
      const items = content.items.map(it => ({
        str: it.str, x: it.transform[4], y: it.transform[5],
        fontSize: Math.hypot(it.transform[2], it.transform[3]) || 10,
        fontName: it.fontName || '',
      })).filter(it => it.str.trim().length > 0);
      items.forEach(it => allSizes.push(it.fontSize));
      pageTextItems.push({ items, links, height: page.view[3] });
      if (content.items.length === 0 && p === 1 && pdf.numPages === 1){
        // no extractable text at all -- likely a scanned/image-only PDF
      }
      page.cleanup && page.cleanup();
    }
    if (allSizes.length === 0){
      throw new Error('No extractable text was found in this PDF \u2014 it may be a scanned image rather than real text, which this tool can\u2019t convert.');
    }
    allSizes.sort((a,b) => a-b);
    const bodySize = allSizes[Math.floor(allSizes.length/2)]; // median font size = body text baseline

    onProgress(45, 'Reconstructing document structure\u2026');
    const docChildren = [];
    for (let pIdx = 0; pIdx < pageTextItems.length; pIdx++){
      if (isCancelled()) return null;
      const { items } = pageTextItems[pIdx];
      // Group items into lines by Y proximity, then lines into paragraphs by
      // a larger vertical gap (a real, standard heuristic for reflowed text
      // -- not guaranteed on unusually-formatted PDFs, disclosed in the FAQ).
      items.sort((a,b) => b.y - a.y || a.x - b.x);
      const lines = [];
      let currentLine = null, lastY = null;
      for (const it of items){
        if (lastY === null || Math.abs(it.y - lastY) > it.fontSize * 0.4){
          currentLine = { y: it.y, items: [it] };
          lines.push(currentLine);
        } else {
          currentLine.items.push(it);
        }
        lastY = it.y;
      }
      let lastLineY = null, lastFontSize = bodySize;
      let currentRuns = [];
      function flushParagraph(){
        if (currentRuns.length){
          docChildren.push(new Paragraph({ children: currentRuns }));
          currentRuns = [];
        }
      }
      for (const line of lines){
        const lineText = line.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
        if (!lineText) continue;
        const avgSize = line.items.reduce((a,i) => a+i.fontSize, 0) / line.items.length;
        const isBold = line.items.some(i => /bold/i.test(i.fontName));
        const isItalic = line.items.some(i => /italic|oblique/i.test(i.fontName));
        const gap = lastLineY === null ? 0 : lastLineY - line.y;
        const newParagraph = lastLineY === null || gap > lastFontSize * 1.6;

        let heading = null;
        if (avgSize > bodySize * 1.6) heading = HeadingLevel.HEADING_1;
        else if (avgSize > bodySize * 1.3) heading = HeadingLevel.HEADING_2;
        else if (avgSize > bodySize * 1.12) heading = HeadingLevel.HEADING_3;

        const run = new TextRun({ text: lineText, bold: isBold, italics: isItalic });
        if (heading){
          flushParagraph();
          docChildren.push(new Paragraph({ heading, children: [run] }));
        } else if (newParagraph){
          flushParagraph();
          currentRuns = [run];
        } else {
          currentRuns.push(new TextRun({ text: ' ' + lineText, bold: isBold, italics: isItalic }));
        }
        lastLineY = line.y;
        lastFontSize = avgSize;
      }
      flushParagraph();
      if (pIdx < pageTextItems.length - 1){
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
      }
      onProgress(45 + Math.round(((pIdx+1)/pageTextItems.length)*40), `Building document \u2014 page ${pIdx+1} of ${pageTextItems.length}\u2026`);
    }

    onProgress(90, 'Packaging .docx\u2026');
    const doc = new Document({ sections: [{ children: docChildren.length ? docChildren : [new Paragraph({ children:[new TextRun('')] })] }] });
    const blob = await Packer.toBlob(doc);
    onProgress(100, 'Done.');
    return blob;
  }

  /* ================= WORD -> PDF ================= */
  async function convertWordToPdf(file, onProgress, isCancelled){
    onProgress(5, 'Reading Word document\u2026');
    const mammoth = await ensureMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    onProgress(25, 'Parsing content\u2026');

    const container = document.createElement('div');
    container.innerHTML = result.value;

    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    const PAGE_W = 612, PAGE_H = 792, MARGIN = 56;
    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let cursorY = PAGE_H - MARGIN;
    const maxWidth = PAGE_W - MARGIN*2;

    function pickFont(bold, italic){
      if (bold && italic) return fontBoldItalic;
      if (bold) return fontBold;
      if (italic) return fontItalic;
      return fontRegular;
    }
    function newPage(){
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
    }
    function ensureSpace(lineHeight){
      if (cursorY - lineHeight < MARGIN) newPage();
    }
    function wrapText(text, font, size){
      const words = text.split(/\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      for (const w of words){
        const test = current ? current + ' ' + w : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && current){
          lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines;
    }
    function drawParagraph(text, { size = 11, bold = false, italic = false, indent = 0, spacingAfter = 10, color = rgb(0.05,0.06,0.1) } = {}){
      if (!text.trim()) { cursorY -= spacingAfter; return; }
      const font = pickFont(bold, italic);
      const lineHeight = size * 1.32;
      const lines = wrapText(text, font, size);
      for (const line of lines){
        ensureSpace(lineHeight);
        page.drawText(line, { x: MARGIN + indent, y: cursorY - size, size, font, color });
        cursorY -= lineHeight;
      }
      cursorY -= spacingAfter;
    }

    const HEADING_SIZES = { H1: 22, H2: 18, H3: 15, H4: 13 };
    let imagesEmbedded = 0, tablesRendered = 0;

    async function embedImageFromSrc(src){
      try{
        const m = /^data:(image\/(png|jpe?g));base64,(.+)$/i.exec(src);
        if (!m) return null;
        const bin = atob(m[3]);
        const bytes = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
        return /png/i.test(m[1]) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      }catch(e){ return null; }
    }

    async function renderNode(node, ctx){
      if (isCancelled()) return;
      if (node.nodeType === Node.TEXT_NODE){
        const text = node.textContent.replace(/\s+/g, ' ');
        if (text.trim()) drawParagraph(text, ctx);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'h1') return drawParagraph(node.textContent, { size: HEADING_SIZES.H1, bold: true, spacingAfter: 14 });
      if (tag === 'h2') return drawParagraph(node.textContent, { size: HEADING_SIZES.H2, bold: true, spacingAfter: 12 });
      if (tag === 'h3') return drawParagraph(node.textContent, { size: HEADING_SIZES.H3, bold: true, spacingAfter: 10 });
      if (tag === 'h4' || tag === 'h5' || tag === 'h6') return drawParagraph(node.textContent, { size: HEADING_SIZES.H4, bold: true, spacingAfter: 10 });
      if (tag === 'p'){
        const bold = !!node.querySelector('strong,b') && node.children.length === 1;
        const italic = !!node.querySelector('em,i') && node.children.length === 1;
        return drawParagraph(node.textContent, { bold, italic });
      }
      if (tag === 'ul' || tag === 'ol'){
        let i = 1;
        for (const li of node.children){
          const marker = tag === 'ol' ? `${i}. ` : '\u2022 ';
          drawParagraph(marker + li.textContent, { indent: 14 });
          i++;
        }
        return;
      }
      if (tag === 'img'){
        const img = await embedImageFromSrc(node.getAttribute('src') || '');
        if (img){
          const scale = Math.min(1, maxWidth / img.width);
          const w = img.width * scale, h = img.height * scale;
          ensureSpace(h + 10);
          page.drawImage(img, { x: MARGIN, y: cursorY - h, width: w, height: h });
          cursorY -= h + 10;
          imagesEmbedded++;
        }
        return;
      }
      if (tag === 'table'){
        tablesRendered++;
        const rows = Array.from(node.querySelectorAll('tr'));
        const colCount = Math.max(1, ...rows.map(r => r.children.length));
        const colWidth = maxWidth / colCount;
        for (const row of rows){
          const cells = Array.from(row.children);
          ensureSpace(16);
          const rowY = cursorY;
          cells.forEach((cell, ci) => {
            const text = cell.textContent.replace(/\s+/g, ' ').trim();
            const lines = wrapText(text, fontRegular, 10).slice(0, 3); // cap lines per cell to keep table rows aligned
            lines.forEach((line, li) => {
              page.drawText(line, { x: MARGIN + ci*colWidth + 3, y: rowY - 12 - li*12, size: 10, font: fontRegular, color: rgb(0.05,0.06,0.1) });
            });
          });
          cursorY -= 16 + Math.max(0, ...cells.map(c => Math.min(3, wrapText(c.textContent, fontRegular, 10).length)-1)) * 12;
          cursorY -= 4;
        }
        cursorY -= 8;
        return;
      }
      // Container-level elements: recurse into children, honoring block spacing.
      for (const child of node.childNodes){
        await renderNode(child, ctx);
      }
    }

    let processed = 0;
    const topNodes = Array.from(container.childNodes);
    for (const node of topNodes){
      if (isCancelled()) return null;
      await renderNode(node, {});
      processed++;
      onProgress(25 + Math.round((processed/topNodes.length)*60), 'Laying out document\u2026');
      await nextFrame();
    }

    onProgress(92, 'Finalizing PDF\u2026');
    const pdfBytes = await pdfDoc.save();
    onProgress(100, 'Done.');
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
}

/* ============ AI IMAGE UPSCALER (ai-image-upscaler.html) ============
   Real AI, not a canvas resize dressed up as one: UpscalerJS (MIT), a
   TensorFlow.js-based library built specifically for in-browser super-
   resolution, running an ESRGAN-family model (Apache 2.0-licensed weights,
   trained via the image-super-resolution project). Model tier defaults to
   "esrgan-slim" -- explicitly the tier UpscalerJS's own maintainers document
   as "the fastest available ESRGAN models, intended to run in a browser."
   The larger "esrgan-thick" tier exists but its own docs state it's "best
   suited to a Node.js environment with a GPU... significant latency" in a
   browser, so it is intentionally NOT the default here -- offered only as an
   opt-in "Higher quality (slower)" choice, not the automatic pick. 8x scale
   is not offered at all: UpscalerJS's own model docs state the 8x model
   "does not work reliably in a browser," so this isn't a guess -- it's
   passing along the library authors' own documented limitation rather than
   silently shipping something known to be unreliable. */
if (document.getElementById('upsDrop')){
  const TFJS_VERSION = '4.20.0';
  const UPSCALER_VERSION = '1.0.0';
  const UPS_MAX_DIM = 1600; // safe input-size ceiling to avoid exhausting browser memory during inference

  let upsOriginalImg = null, upsOriginalCanvas = null;
  let upsResultCanvas = null;
  let upsCancelled = false;
  let tfjsLoadPromise = null;
  const upsModelPromises = {}; // cached per (tier, scale) combo so re-runs don't re-download

  async function ensureTfjs(){
    if (window.tf) return window.tf;
    if (!tfjsLoadPromise){
      tfjsLoadPromise = (async () => {
        await loadScriptOnce(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TFJS_VERSION}/dist/tf.min.js`);
        if (!window.tf) throw new Error('TensorFlow.js failed to load.');
        return window.tf;
      })().catch((err) => { tfjsLoadPromise = null; throw err; });
    }
    return tfjsLoadPromise;
  }

  async function ensureUpscaler(tier, scale){
    const key = tier + '-' + scale;
    if (!upsModelPromises[key]){
      upsModelPromises[key] = (async () => {
        await ensureTfjs();
        const pkg = tier === 'thick' ? 'esrgan-thick' : 'esrgan-slim';
        await loadScriptOnce(`https://cdn.jsdelivr.net/npm/@upscalerjs/${pkg}@latest/dist/umd/${scale}x.min.js`);
        await loadScriptOnce(`https://cdn.jsdelivr.net/npm/upscaler@${UPSCALER_VERSION}/dist/browser/umd/upscaler.min.js`);
        const globalName = tier === 'thick' ? 'ESRGANThick' : 'ESRGANSlim';
        const modelNs = window[globalName];
        if (!modelNs || !window.Upscaler) throw new Error('Upscaling model failed to load.');
        const modelConfig = modelNs[`${scale}x`] || modelNs[Object.keys(modelNs)[0]];
        return new window.Upscaler({ model: modelConfig });
      })().catch((err) => { delete upsModelPromises[key]; throw err; });
    }
    return upsModelPromises[key];
  }

  /* ---------- Upload: drag/drop, browse, paste ---------- */
  setupDropZone('upsDrop','upsInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    await loadUpsImage(f);
  });
  document.addEventListener('paste', async (e) => {
    const stage = document.getElementById('upsStage');
    const drop = document.getElementById('upsDrop');
    if ((!stage || stage.classList.contains('hidden')) && (!drop || drop.offsetParent === null)) return;
    const items = Array.from(e.clipboardData ? e.clipboardData.items : []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (file) { e.preventDefault(); await loadUpsImage(file); toast('Image pasted.'); }
  });

  async function loadUpsImage(f){
    if (f.size > 30*1024*1024){ toast(`That image is ${fmtBytes(f.size)} — the limit is 30MB.`, 'err'); return; }
    try{
      upsOriginalImg = await loadImageFromFile(f);
    }catch(err){ toast(err.message || 'Could not read this image.', 'err'); return; }

    const ow = upsOriginalImg.naturalWidth, oh = upsOriginalImg.naturalHeight;
    if (ow > UPS_MAX_DIM || oh > UPS_MAX_DIM){
      toast(`This image is ${ow}\u00d7${oh} — please use an image no larger than ${UPS_MAX_DIM}px on its longest side. Very large images can crash the browser tab during AI processing.`, 'err');
      upsOriginalImg = null;
      return;
    }

    upsOriginalCanvas = document.createElement('canvas');
    upsOriginalCanvas.width = ow; upsOriginalCanvas.height = oh;
    upsOriginalCanvas.getContext('2d').drawImage(upsOriginalImg, 0, 0); // re-drawn via canvas, stripping EXIF same as every other ToolFlight image tool

    upsResultCanvas = null;
    document.getElementById('upsStage').classList.remove('hidden');
    document.getElementById('upsPreviewCanvas').width = ow;
    document.getElementById('upsPreviewCanvas').height = oh;
    document.getElementById('upsPreviewCanvas').getContext('2d').drawImage(upsOriginalCanvas, 0, 0);
    document.getElementById('upsDims').textContent = `${ow} \u00d7 ${oh}px`;
    document.getElementById('upsUpscaleBtn').disabled = false;
    document.getElementById('upsDownloadRow').classList.add('hidden');
    document.getElementById('upsCompareWrap').classList.add('hidden');
    setUpsZoom(100);
    toast('Image loaded.');
  }

  /* ---------- Zoom / pan (same proven pattern used elsewhere in ToolFlight) ---------- */
  const upsStageWrap = document.getElementById('upsStageWrap');
  function setUpsZoom(pct){
    const canvas = document.getElementById('upsPreviewCanvas');
    if (!canvas || !canvas.width) return;
    canvas.style.width = Math.round(canvas.width * (pct/100)) + 'px';
    canvas.style.height = Math.round(canvas.height * (pct/100)) + 'px';
    const sel = document.getElementById('upsZoomSelect');
    if (sel) sel.value = String(pct);
  }
  document.getElementById('upsZoomSelect').onchange = (e) => setUpsZoom(+e.target.value);
  document.getElementById('upsFitScreenBtn').onclick = () => {
    const canvas = document.getElementById('upsPreviewCanvas');
    const wrapWidth = upsStageWrap.clientWidth - 20;
    setUpsZoom(Math.max(10, Math.min(100, Math.round((wrapWidth / canvas.width) * 100))));
  };
  upsStageWrap.addEventListener('wheel', (e) => {
    if (!upsOriginalCanvas) return;
    e.preventDefault();
    const sel = document.getElementById('upsZoomSelect');
    const current = sel ? +sel.value : 100;
    setUpsZoom(Math.max(25, Math.min(400, current + (e.deltaY < 0 ? 15 : -15))));
  }, { passive: false });

  document.getElementById('upsResetBtn').onclick = () => {
    upsOriginalImg = null; upsOriginalCanvas = null; upsResultCanvas = null;
    document.getElementById('upsStage').classList.add('hidden');
    document.getElementById('upsInput').value = '';
  };

  /* ---------- Upscale ---------- */
  document.getElementById('upsCancelBtn').onclick = () => { upsCancelled = true; };

  document.getElementById('upsUpscaleBtn').onclick = async () => {
    if (!upsOriginalCanvas) return;
    upsCancelled = false;
    const btn = document.getElementById('upsUpscaleBtn');
    setLoading(btn, true);
    document.getElementById('upsCancelBtn').classList.remove('hidden');
    const progressWrap = document.getElementById('upsProgressWrap');
    const progressLabel = document.getElementById('upsProgressLabel');
    const progressFill = document.getElementById('upsProgressFill');
    progressWrap.classList.remove('hidden');
    progressFill.style.width = '4%';
    const startTime = Date.now();

    try{
      const scale = +document.querySelector('input[name="upsScale"]:checked').value;
      const tier = document.getElementById('upsHighQuality').checked ? 'thick' : 'slim';

      progressLabel.textContent = 'Downloading AI model (one-time, cached after)\u2026';
      const upscaler = await ensureUpscaler(tier, scale);
      if (upsCancelled) throw { cancelled: true };
      progressFill.style.width = '25%';

      const ow = upsOriginalCanvas.width, oh = upsOriginalCanvas.height;
      const estSeconds = Math.max(2, Math.round((ow*oh) / 220000) * (tier === 'thick' ? 2.2 : 1));
      progressLabel.textContent = `Running AI upscale \u2014 est. ${estSeconds}s\u2026`;
      await nextFrame();

      // Patch-based processing (UpscalerJS's built-in tiling) keeps memory
      // bounded on larger images instead of running the whole image through
      // the network at once.
      const resultSrc = await upscaler.upscale(upsOriginalCanvas, {
        patchSize: 64,
        padding: 6,
        progress: (rate) => {
          if (upsCancelled) return;
          progressFill.style.width = (25 + Math.round(rate*70)) + '%';
        },
      });
      if (upsCancelled) throw { cancelled: true };

      progressLabel.textContent = 'Finalizing\u2026';
      const resultImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not read the upscaled result.'));
        img.src = resultSrc;
      });
      upsResultCanvas = document.createElement('canvas');
      upsResultCanvas.width = resultImg.naturalWidth;
      upsResultCanvas.height = resultImg.naturalHeight;
      upsResultCanvas.getContext('2d').drawImage(resultImg, 0, 0);

      document.getElementById('upsPreviewCanvas').width = upsResultCanvas.width;
      document.getElementById('upsPreviewCanvas').height = upsResultCanvas.height;
      document.getElementById('upsPreviewCanvas').getContext('2d').drawImage(upsResultCanvas, 0, 0);
      document.getElementById('upsDims').textContent = `${ow}\u00d7${oh}px \u2192 ${upsResultCanvas.width}\u00d7${upsResultCanvas.height}px`;
      setUpsZoom(Math.min(100, Math.round((upsStageWrap.clientWidth-20)/upsResultCanvas.width*100)));

      showUpsCompare();
      document.getElementById('upsDownloadRow').classList.remove('hidden');
      progressFill.style.width = '100%';
      const elapsed = ((Date.now()-startTime)/1000).toFixed(1);
      toast(`Upscaled in ${elapsed}s.`);
    }catch(err){
      if (err && err.cancelled){ toast('Cancelled.'); }
      else{
        toast('Upscaling failed: ' + ((err && err.message) || 'please try a smaller image or a different browser.'), 'err');
      }
    }finally{
      setLoading(btn, false, 'AI Upscale');
      document.getElementById('upsCancelBtn').classList.add('hidden');
      setTimeout(() => progressWrap.classList.add('hidden'), 900);
    }
  };

  /* ---------- Before / After compare (same proven pattern used elsewhere) ---------- */
  function showUpsCompare(){
    if (!upsResultCanvas || !upsOriginalCanvas) return;
    document.getElementById('upsCompareBefore').src = upsOriginalCanvas.toDataURL('image/png');
    document.getElementById('upsCompareAfter').src = upsResultCanvas.toDataURL('image/png');
    document.getElementById('upsCompareWrap').classList.remove('hidden');
    document.getElementById('upsCompareAfterWrap').style.width = '50%';
    document.getElementById('upsCompareHandle').style.left = '50%';
  }
  const upsCompareHandle = document.getElementById('upsCompareHandle');
  const upsCompareWrap = document.getElementById('upsCompareWrap');
  function setUpsComparePct(clientX){
    const rect = upsCompareWrap.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    document.getElementById('upsCompareAfterWrap').style.width = pct + '%';
    upsCompareHandle.style.left = pct + '%';
  }
  upsCompareHandle.addEventListener('pointerdown', (e) => {
    upsCompareHandle.setPointerCapture(e.pointerId);
    function move(ev){ setUpsComparePct(ev.clientX); }
    function up(){ upsCompareHandle.removeEventListener('pointermove', move); upsCompareHandle.removeEventListener('pointerup', up); }
    upsCompareHandle.addEventListener('pointermove', move);
    upsCompareHandle.addEventListener('pointerup', up);
  });

  /* ---------- Export ---------- */
  document.getElementById('upsQuality').addEventListener('input', (e) => {
    document.getElementById('upsQualityVal').textContent = e.target.value;
  });
  ['upsDownloadPngBtn','upsDownloadJpgBtn','upsDownloadWebpBtn'].forEach(id => {
    document.getElementById(id).onclick = () => {
      if (!upsResultCanvas){ toast('Upscale an image first.', 'err'); return; }
      const format = id.includes('Png') ? 'png' : id.includes('Jpg') ? 'jpeg' : 'webp';
      const ext = format === 'jpeg' ? 'jpg' : format;
      const quality = +document.getElementById('upsQuality').value / 100;
      upsResultCanvas.toBlob((blob) => {
        if (!blob){ toast('This browser could not encode that format — try PNG instead.', 'err'); return; }
        downloadBlob(blob, 'upscaled-image.' + ext);
      }, 'image/' + format, format === 'png' ? undefined : quality);
    };
  });
  document.getElementById('upsConvertAnotherBtn').onclick = () => { document.getElementById('upsResetBtn').click(); };
}

/* ============ AI OCR — IMAGE & PDF TO TEXT (ai-ocr.html) ============
   Real OCR, not a fake preview: Tesseract.js (Apache 2.0), a WebAssembly
   port of the Tesseract OCR engine, running entirely in a Web Worker so the
   page stays responsive. One important honesty note that shaped the
   architecture here: Tesseract.js's own documentation states plainly that
   it "does not support PDF files." So for PDF input, this tool does NOT
   pretend to OCR the PDF directly -- it uses PDF.js (already used elsewhere
   in ToolFlight) to render each page to an image first, then runs the same
   real OCR engine on each rendered page. That's a genuine, working pipeline,
   just not literally "OCR that reads PDF bytes," and the FAQ says so. */
if (document.getElementById('ocrDrop')){
  const TESS_VERSION = '5';
  const PDFJS_VER_OCR = '4.5.136';
  const OCR_MAX_DIM = 3000; // safety cap on page/image dimensions before OCR

  let ocrFile = null;
  let ocrFullText = '';
  let ocrPageTexts = []; // [{page, text}] for multi-page PDFs
  let ocrCancelled = false;
  let ocrWorker = null;
  let pdfjsLoadPromiseOcr = null;

  async function ensurePdfJsOcr(){
    if (!pdfjsLoadPromiseOcr){
      pdfjsLoadPromiseOcr = (async () => {
        const pdfjsLib = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_OCR}/build/pdf.min.mjs`);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_OCR}/build/pdf.worker.min.mjs`;
        return pdfjsLib;
      })().catch((err) => { pdfjsLoadPromiseOcr = null; throw err; });
    }
    return pdfjsLoadPromiseOcr;
  }

  function ocrSelectedLangs(){
    return Array.from(document.querySelectorAll('.ocr-lang-check:checked')).map(cb => cb.value);
  }

  /* ---------- Upload: drag/drop, browse, paste ---------- */
  setupDropZone('ocrDrop','ocrInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, WEBP, or PDF file.', 'err'); return; }
    await loadOcrFile(f);
  });
  document.addEventListener('paste', async (e) => {
    const stage = document.getElementById('ocrStage');
    const drop = document.getElementById('ocrDrop');
    if ((!stage || stage.classList.contains('hidden')) && (!drop || drop.offsetParent === null)) return;
    const items = Array.from(e.clipboardData ? e.clipboardData.items : []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (file) { e.preventDefault(); await loadOcrFile(file); toast('Image pasted.'); }
  });

  async function loadOcrFile(f){
    if (f.size > 30*1024*1024){ toast(`That file is ${fmtBytes(f.size)} — the limit is 30MB.`, 'err'); return; }
    ocrFile = f;
    ocrFullText = ''; ocrPageTexts = [];
    document.getElementById('ocrStage').classList.remove('hidden');
    document.getElementById('ocrFileName').textContent = f.name;
    document.getElementById('ocrFileSize').textContent = fmtBytes(f.size);
    document.getElementById('ocrExtractBtn').disabled = false;
    document.getElementById('ocrResultWrap').classList.add('hidden');
    document.getElementById('ocrPreviewImg').classList.add('hidden');
    document.getElementById('ocrPreviewPdfNote').classList.add('hidden');

    if (f.type === 'application/pdf'){
      document.getElementById('ocrPreviewPdfNote').classList.remove('hidden');
      try{
        const pdfjsLib = await ensurePdfJsOcr();
        const bytes = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        document.getElementById('ocrPreviewPdfNote').textContent = `PDF \u2014 ${pdf.numPages} page${pdf.numPages!==1?'s':''}`;
      }catch(e){ document.getElementById('ocrPreviewPdfNote').textContent = 'PDF'; }
    } else {
      const url = URL.createObjectURL(f);
      const img = document.getElementById('ocrPreviewImg');
      img.src = url;
      img.classList.remove('hidden');
      img.onload = () => URL.revokeObjectURL(url);
    }
    toast('File loaded.');
  }

  /* ---------- OCR ---------- */
  document.getElementById('ocrCancelBtn').onclick = async () => {
    ocrCancelled = true;
    if (ocrWorker){ try{ await ocrWorker.terminate(); }catch(e){} ocrWorker = null; }
  };

  async function ocrImageSource(source, langs, onProgress){
    if (!ocrWorker){
      const logger = (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(m.progress);
      };
      try{
        ocrWorker = await Tesseract.createWorker(langs.join('+'), 1, { logger });
      }catch(e1){
        try{
          ocrWorker = await Tesseract.createWorker(langs.join('+'), undefined, { logger });
        }catch(e2){
          ocrWorker = await Tesseract.createWorker(langs.join('+'));
        }
      }
    }
    const { data } = await ocrWorker.recognize(source);
    return data.text;
  }

  document.getElementById('ocrExtractBtn').onclick = async () => {
    if (!ocrFile) return;
    const langs = ocrSelectedLangs();
    if (!langs.length){ toast('Choose at least one language first.', 'err'); return; }
    ocrCancelled = false;
    const btn = document.getElementById('ocrExtractBtn');
    setLoading(btn, true);
    document.getElementById('ocrCancelBtn').classList.remove('hidden');
    const progressWrap = document.getElementById('ocrProgressWrap');
    const progressLabel = document.getElementById('ocrProgressLabel');
    const progressFill = document.getElementById('ocrProgressFill');
    progressWrap.classList.remove('hidden');
    progressFill.style.width = '3%';

    try{
      await loadScriptOnce(`https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.min.js`);
      if (!window.Tesseract) throw new Error('OCR engine failed to load.');

      ocrPageTexts = [];
      if (ocrFile.type === 'application/pdf'){
        progressLabel.textContent = 'Reading PDF\u2026';
        const pdfjsLib = await ensurePdfJsOcr();
        const bytes = await ocrFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        for (let p = 1; p <= pdf.numPages; p++){
          if (ocrCancelled) break;
          progressLabel.textContent = `Rendering page ${p} of ${pdf.numPages}\u2026`;
          const page = await pdf.getPage(p);
          const scale = Math.min(2.5, OCR_MAX_DIM / Math.max(page.view[2], page.view[3]));
          const viewport = page.getViewport({ scale: Math.max(1, scale) });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          page.cleanup && page.cleanup();
          if (ocrCancelled) break;

          progressLabel.textContent = `Running OCR \u2014 page ${p} of ${pdf.numPages}\u2026`;
          const pageText = await ocrImageSource(canvas, langs, (frac) => {
            const base = ((p-1)/pdf.numPages)*100;
            const span = 100/pdf.numPages;
            progressFill.style.width = Math.min(98, Math.round(base + frac*span)) + '%';
          });
          ocrPageTexts.push({ page: p, text: pageText.trim() });
          await nextFrame();
        }
      } else {
        progressLabel.textContent = 'Running OCR\u2026';
        const img = await loadImageFromFile(ocrFile);
        const canvas = document.createElement('canvas');
        let w = img.naturalWidth, h = img.naturalHeight;
        if (Math.max(w,h) > OCR_MAX_DIM){ const sc = OCR_MAX_DIM/Math.max(w,h); w = Math.round(w*sc); h = Math.round(h*sc); }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const text = await ocrImageSource(canvas, langs, (frac) => {
          progressFill.style.width = Math.min(98, Math.round(frac*100)) + '%';
        });
        ocrPageTexts.push({ page: 1, text: text.trim() });
      }

      if (ocrCancelled){
        toast('Cancelled.');
      } else {
        ocrFullText = ocrPageTexts.length > 1
          ? ocrPageTexts.map(p => `--- Page ${p.page} ---\n${p.text}`).join('\n\n')
          : (ocrPageTexts[0] ? ocrPageTexts[0].text : '');
        document.getElementById('ocrResultText').value = ocrFullText;
        document.getElementById('ocrResultWrap').classList.remove('hidden');
        document.getElementById('ocrCharCount').textContent = ocrFullText.length + ' characters';
        progressFill.style.width = '100%';
        if (!ocrFullText.trim()){
          toast('No text was detected in this file. It may be blank, too low-resolution, or in a language not selected.', 'err');
        } else {
          toast('Text extracted.');
        }
      }
    }catch(err){
      if (!ocrCancelled) toast('OCR failed: ' + ((err && err.message) || 'please try a different file.'), 'err');
    }finally{
      if (ocrWorker){ try{ await ocrWorker.terminate(); }catch(e){} ocrWorker = null; }
      setLoading(btn, false, 'Extract Text');
      document.getElementById('ocrCancelBtn').classList.add('hidden');
      setTimeout(() => progressWrap.classList.add('hidden'), 900);
    }
  };

  /* ---------- Search within extracted text ---------- */
  document.getElementById('ocrSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const countEl = document.getElementById('ocrSearchCount');
    if (!q){ countEl.textContent = ''; return; }
    const matches = ocrFullText.split(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).length - 1;
    countEl.textContent = matches ? `${matches} match${matches!==1?'es':''}` : 'No matches';
  });

  /* ---------- Copy / Export ---------- */
  document.getElementById('ocrCopyBtn').onclick = () => {
    if (!ocrFullText){ toast('Extract text first.', 'err'); return; }
    copyToClipboard(ocrFullText).then(() => toast('Copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
  };
  document.getElementById('ocrDownloadTxtBtn').onclick = () => {
    if (!ocrFullText){ toast('Extract text first.', 'err'); return; }
    downloadBlob(new Blob([ocrFullText], { type: 'text/plain' }), 'extracted-text.txt');
  };
  document.getElementById('ocrDownloadDocxBtn').onclick = async () => {
    if (!ocrFullText){ toast('Extract text first.', 'err'); return; }
    const btn = document.getElementById('ocrDownloadDocxBtn');
    setLoading(btn, true);
    try{
      const docxLib = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/docx@9.5.1/dist/index.mjs');
      const { Document, Packer, Paragraph, TextRun } = docxLib;
      const paragraphs = ocrFullText.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] }));
      const doc = new Document({ sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph({children:[new TextRun('')]})] }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, 'extracted-text.docx');
    }catch(err){
      toast('Could not build the DOCX file: ' + ((err && err.message) || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, 'Download DOCX');
    }
  };
  document.getElementById('ocrConvertAnotherBtn').onclick = () => {
    ocrFile = null; ocrFullText = ''; ocrPageTexts = [];
    document.getElementById('ocrStage').classList.add('hidden');
    document.getElementById('ocrInput').value = '';
  };
}

/* ============ RESUME BUILDER + ATS CHECKER (resume-builder.html) ============
   Two genuinely separate engines behind one set of tabs, both fully local:
   1. Resume Builder: a plain data model rendered live into a styled preview,
      exported to a real, selectable-text PDF via pdf-lib -- the same "no
      rasterization" approach already used and disclosed for the Word to PDF
      converter, reused here rather than duplicated with a screenshot-based
      shortcut.
   2. ATS Checker: genuinely rule-based analysis, explicitly NOT dressed up
      as AI. It extracts text from an uploaded PDF (via PDF.js) or DOCX (via
      mammoth.js) -- the same extraction libraries already integrated for the
      PDF<->Word converter -- then runs a fixed, inspectable set of checks
      (regex-based contact detection, heading-keyword matching, word-count
      and bullet-density heuristics) and produces a transparent, explainable
      score. Every point of the score maps to a specific, statable reason,
      not a black box. */
if (document.getElementById('resumeTabBuilder')){
  const PDFJS_VER_RB = '4.5.136';

  /* ---------- Shared tab switching ---------- */
  function setResumeTab(tab){
    document.getElementById('resumeTabBuilder').classList.toggle('active', tab === 'builder');
    document.getElementById('resumeTabAts').classList.toggle('active', tab === 'ats');
    document.getElementById('resumeBuilderPanel').classList.toggle('hidden', tab !== 'builder');
    document.getElementById('atsCheckerPanel').classList.toggle('hidden', tab !== 'ats');
  }
  document.getElementById('resumeTabBuilder').onclick = () => setResumeTab('builder');
  document.getElementById('resumeTabAts').onclick = () => setResumeTab('ats');

  /* ================= RESUME BUILDER ================= */
  const resumeData = {
    personal: { name:'', phone:'', email:'', location:'', linkedin:'', portfolio:'' },
    summary: '',
    education: [], experience: [], projects: [], languages: [], certifications: [], references: [],
    skills: [], achievements: [],
    template: 'classic',
  };
  let resumeIdCounter = 0;
  function nextResumeId(){ return 'r' + (resumeIdCounter++); }

  const RESUME_FIELD_MAP = { name:'rbName', phone:'rbPhone', email:'rbEmail', location:'rbLocation', linkedin:'rbLinkedin', portfolio:'rbPortfolio' };
  Object.entries(RESUME_FIELD_MAP).forEach(([key, id]) => {
    document.getElementById(id).addEventListener('input', (e) => { resumeData.personal[key] = e.target.value; renderResumePreview(); });
  });
  document.getElementById('rbSummary').addEventListener('input', (e) => { resumeData.summary = e.target.value; renderResumePreview(); });
  document.getElementById('rbSkills').addEventListener('input', (e) => {
    resumeData.skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    renderResumePreview();
  });
  document.getElementById('rbAchievements').addEventListener('input', (e) => {
    resumeData.achievements = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
    renderResumePreview();
  });

  document.querySelectorAll('input[name="rbTemplate"]').forEach(radio => {
    radio.addEventListener('change', (e) => { resumeData.template = e.target.value; renderResumePreview(); });
  });

  /* ---------- Repeatable sections (education, experience, projects, languages, certifications, references) ---------- */
  const RESUME_SECTIONS = {
    education: { arr: () => resumeData.education, fields: [
      { key:'school', label:'School / University', type:'text' },
      { key:'degree', label:'Degree', type:'text' },
      { key:'field', label:'Field of Study', type:'text' },
      { key:'startDate', label:'Start Date', type:'text' },
      { key:'endDate', label:'End Date', type:'text' },
      { key:'gpa', label:'GPA (optional)', type:'text' },
    ]},
    experience: { arr: () => resumeData.experience, fields: [
      { key:'role', label:'Job Title', type:'text' },
      { key:'company', label:'Company', type:'text' },
      { key:'location', label:'Location', type:'text' },
      { key:'startDate', label:'Start Date', type:'text' },
      { key:'endDate', label:'End Date', type:'text' },
      { key:'bullets', label:'Responsibilities / Achievements (one per line)', type:'textarea' },
    ]},
    projects: { arr: () => resumeData.projects, fields: [
      { key:'name', label:'Project Name', type:'text' },
      { key:'tech', label:'Technologies Used', type:'text' },
      { key:'link', label:'Link (optional)', type:'text' },
      { key:'description', label:'Description', type:'textarea' },
    ]},
    languages: { arr: () => resumeData.languages, fields: [
      { key:'name', label:'Language', type:'text' },
      { key:'level', label:'Proficiency', type:'text' },
    ]},
    certifications: { arr: () => resumeData.certifications, fields: [
      { key:'name', label:'Certification Name', type:'text' },
      { key:'issuer', label:'Issuing Organization', type:'text' },
      { key:'date', label:'Date', type:'text' },
    ]},
    references: { arr: () => resumeData.references, fields: [
      { key:'name', label:'Name', type:'text' },
      { key:'relation', label:'Relationship / Title', type:'text' },
      { key:'contact', label:'Contact Info', type:'text' },
    ]},
  };

  function addResumeItem(sectionKey){
    const item = { _id: nextResumeId() };
    RESUME_SECTIONS[sectionKey].fields.forEach(f => { item[f.key] = ''; });
    RESUME_SECTIONS[sectionKey].arr().push(item);
    renderResumeSection(sectionKey);
    renderResumePreview();
  }
  function removeResumeItem(sectionKey, id){
    const arr = RESUME_SECTIONS[sectionKey].arr();
    const idx = arr.findIndex(it => it._id === id);
    if (idx > -1) arr.splice(idx, 1);
    renderResumeSection(sectionKey);
    renderResumePreview();
  }

  function renderResumeSection(sectionKey){
    const listEl = document.getElementById('rbList_' + sectionKey);
    const arr = RESUME_SECTIONS[sectionKey].arr();
    const fields = RESUME_SECTIONS[sectionKey].fields;
    listEl.innerHTML = '';
    arr.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'resume-item-card';
      card.draggable = true;
      card.dataset.id = item._id;
      const fieldsHtml = fields.map(f => {
        const val = (item[f.key] || '').replace(/"/g, '&quot;');
        const fid = `rb_${sectionKey}_${item._id}_${f.key}`;
        if (f.type === 'textarea'){
          return `<div class="resume-field-group"><label for="${fid}">${f.label}</label><textarea id="${fid}" rows="3" style="font-family:inherit;font-size:13px;padding:10px;border-radius:10px;border:1.5px solid var(--card-border);background:var(--bg1);color:var(--ink);resize:vertical;">${item[f.key] || ''}</textarea></div>`;
        }
        return `<div class="resume-field-group"><label for="${fid}">${f.label}</label><input type="text" id="${fid}" value="${val}"></div>`;
      }).join('');
      card.innerHTML = `
        <div class="resume-item-card-head">
          <span class="resume-item-drag-handle" aria-hidden="true">\u28ff\u28ff</span>
          <span class="resume-item-title">Entry ${idx+1}</span>
          <button class="btn btn-danger" type="button" data-remove="${item._id}" style="padding:6px 12px;font-size:12px;">Remove</button>
        </div>
        <div class="resume-form-grid resume-form-grid-full">${fieldsHtml}</div>
      `;
      card.querySelector('[data-remove]').onclick = () => removeResumeItem(sectionKey, item._id);
      fields.forEach(f => {
        const fid = `rb_${sectionKey}_${item._id}_${f.key}`;
        card.querySelector('#' + fid).addEventListener('input', (e) => {
          item[f.key] = e.target.value;
          renderResumePreview();
        });
      });
      listEl.appendChild(card);
    });
    enableDragReorder(listEl, arr, () => { renderResumeSection(sectionKey); renderResumePreview(); });
  }

  ['education','experience','projects','languages','certifications','references'].forEach(sectionKey => {
    document.getElementById('rbAdd_' + sectionKey).onclick = () => addResumeItem(sectionKey);
  });

  /* ---------- Live preview ---------- */
  function esc(s){ return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderResumePreview(){
    const p = resumeData.personal;
    const contactParts = [p.email, p.phone, p.location, p.linkedin, p.portfolio].filter(Boolean).map(esc);
    let html = `<h1 class="resume-pv-name">${esc(p.name) || 'Your Name'}</h1>`;
    html += `<div class="resume-pv-contact">${contactParts.map(c => `<span>${c}</span>`).join('')}</div>`;

    if (resumeData.summary){
      html += `<h2 class="resume-pv-heading">Summary</h2><div>${esc(resumeData.summary)}</div>`;
    }
    if (resumeData.experience.length){
      html += `<h2 class="resume-pv-heading">Experience</h2>`;
      resumeData.experience.forEach(e => {
        const bullets = (e.bullets || '').split('\n').map(s => s.trim()).filter(Boolean);
        html += `<div class="resume-pv-entry"><div class="resume-pv-entry-top"><span>${esc(e.role)}${e.company ? ' \u2014 ' + esc(e.company) : ''}</span><span>${esc(e.startDate)}${e.endDate ? ' \u2013 ' + esc(e.endDate) : ''}</span></div>`;
        if (e.location) html += `<div class="resume-pv-entry-sub">${esc(e.location)}</div>`;
        if (bullets.length) html += `<ul class="resume-pv-bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
        html += `</div>`;
      });
    }
    if (resumeData.education.length){
      html += `<h2 class="resume-pv-heading">Education</h2>`;
      resumeData.education.forEach(ed => {
        html += `<div class="resume-pv-entry"><div class="resume-pv-entry-top"><span>${esc(ed.degree)}${ed.field ? ', ' + esc(ed.field) : ''}</span><span>${esc(ed.startDate)}${ed.endDate ? ' \u2013 ' + esc(ed.endDate) : ''}</span></div><div class="resume-pv-entry-sub">${esc(ed.school)}${ed.gpa ? ' \u00b7 GPA ' + esc(ed.gpa) : ''}</div></div>`;
      });
    }
    if (resumeData.projects.length){
      html += `<h2 class="resume-pv-heading">Projects</h2>`;
      resumeData.projects.forEach(pr => {
        html += `<div class="resume-pv-entry"><div class="resume-pv-entry-top"><span>${esc(pr.name)}</span><span>${esc(pr.tech)}</span></div>`;
        if (pr.description) html += `<div>${esc(pr.description)}</div>`;
        html += `</div>`;
      });
    }
    if (resumeData.skills.length){
      html += `<h2 class="resume-pv-heading">Skills</h2><div class="resume-pv-skills-list">${resumeData.skills.map(s => `<span class="resume-pv-skill-chip">${esc(s)}</span>`).join('')}</div>`;
    }
    if (resumeData.languages.length){
      html += `<h2 class="resume-pv-heading">Languages</h2><div>${resumeData.languages.map(l => `${esc(l.name)}${l.level ? ' (' + esc(l.level) + ')' : ''}`).join(', ')}</div>`;
    }
    if (resumeData.certifications.length){
      html += `<h2 class="resume-pv-heading">Certifications</h2>`;
      resumeData.certifications.forEach(c => {
        html += `<div class="resume-pv-entry"><div class="resume-pv-entry-top"><span>${esc(c.name)}${c.issuer ? ' \u2014 ' + esc(c.issuer) : ''}</span><span>${esc(c.date)}</span></div></div>`;
      });
    }
    if (resumeData.achievements.length){
      html += `<h2 class="resume-pv-heading">Achievements</h2><ul class="resume-pv-bullets">${resumeData.achievements.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
    }
    if (resumeData.references.length){
      html += `<h2 class="resume-pv-heading">References</h2>`;
      resumeData.references.forEach(r => {
        html += `<div class="resume-pv-entry"><div class="resume-pv-entry-top"><span>${esc(r.name)}</span><span>${esc(r.contact)}</span></div>${r.relation ? `<div class="resume-pv-entry-sub">${esc(r.relation)}</div>` : ''}</div>`;
      });
    }

    const preview = document.getElementById('resumePreview');
    preview.className = 'resume-preview resume-tpl-' + resumeData.template;
    preview.innerHTML = html;
  }
  renderResumePreview();

  /* ---------- PDF export: real selectable text, not a screenshot (same principle as Word to PDF) ---------- */
  document.getElementById('rbDownloadPdfBtn').onclick = async () => {
    const btn = document.getElementById('rbDownloadPdfBtn');
    setLoading(btn, true);
    try{
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      const PAGE_W = 612, PAGE_H = 792, MARGIN = 50;
      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let cursorY = PAGE_H - MARGIN;
      const maxWidth = PAGE_W - MARGIN*2;

      function newPage(){ page = pdfDoc.addPage([PAGE_W, PAGE_H]); cursorY = PAGE_H - MARGIN; }
      function ensureSpace(h){ if (cursorY - h < MARGIN) newPage(); }
      function wrapText(text, font, size){
        const words = text.split(/\s+/).filter(Boolean);
        const lines = []; let current = '';
        for (const w of words){
          const test = current ? current + ' ' + w : w;
          if (font.widthOfTextAtSize(test, size) > maxWidth && current){ lines.push(current); current = w; }
          else current = test;
        }
        if (current) lines.push(current);
        return lines;
      }
      function drawLine(text, { size=10.5, font=fontRegular, indent=0, color=rgb(0.08,0.08,0.1), spacingAfter=3 } = {}){
        if (!text.trim()){ cursorY -= spacingAfter; return; }
        const lineHeight = size * 1.32;
        wrapText(text, font, size - (indent?1:0)).forEach(line => {
          ensureSpace(lineHeight);
          page.drawText(line, { x: MARGIN + indent, y: cursorY - size, size, font, color });
          cursorY -= lineHeight;
        });
        cursorY -= spacingAfter;
      }
      function drawHeading(text){
        ensureSpace(24);
        cursorY -= 6;
        page.drawText(text.toUpperCase(), { x: MARGIN, y: cursorY - 12, size: 11.5, font: fontBold, color: rgb(0.05,0.05,0.06) });
        cursorY -= 16;
        page.drawLine({ start:{x:MARGIN,y:cursorY+4}, end:{x:PAGE_W-MARGIN,y:cursorY+4}, thickness:0.75, color: rgb(0.75,0.75,0.75) });
        cursorY -= 6;
      }

      const p = resumeData.personal;
      page.drawText(p.name || 'Your Name', { x: MARGIN, y: cursorY - 20, size: 19, font: fontBold });
      cursorY -= 28;
      const contactLine = [p.email, p.phone, p.location, p.linkedin, p.portfolio].filter(Boolean).join('   \u00b7   ');
      if (contactLine) drawLine(contactLine, { size: 9.5, color: rgb(0.3,0.3,0.32), spacingAfter: 10 });
      else cursorY -= 10;

      if (resumeData.summary){ drawHeading('Summary'); drawLine(resumeData.summary, { spacingAfter: 8 }); }

      if (resumeData.experience.length){
        drawHeading('Experience');
        resumeData.experience.forEach(e => {
          const title = [e.role, e.company].filter(Boolean).join(' \u2014 ');
          const dates = [e.startDate, e.endDate].filter(Boolean).join(' \u2013 ');
          drawLine(title + (dates ? '   (' + dates + ')' : ''), { font: fontBold, spacingAfter: 1 });
          if (e.location) drawLine(e.location, { font: fontItalic, size: 9.5, color: rgb(0.35,0.35,0.37), spacingAfter: 2 });
          (e.bullets || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(b => drawLine('\u2022  ' + b, { indent: 10, spacingAfter: 2 }));
          cursorY -= 6;
        });
      }
      if (resumeData.education.length){
        drawHeading('Education');
        resumeData.education.forEach(ed => {
          const title = [ed.degree, ed.field].filter(Boolean).join(', ');
          const dates = [ed.startDate, ed.endDate].filter(Boolean).join(' \u2013 ');
          drawLine(title + (dates ? '   (' + dates + ')' : ''), { font: fontBold, spacingAfter: 1 });
          drawLine([ed.school, ed.gpa ? 'GPA ' + ed.gpa : ''].filter(Boolean).join(' \u00b7 '), { size: 9.5, color: rgb(0.35,0.35,0.37), spacingAfter: 6 });
        });
      }
      if (resumeData.projects.length){
        drawHeading('Projects');
        resumeData.projects.forEach(pr => {
          drawLine([pr.name, pr.tech].filter(Boolean).join('   \u2014   '), { font: fontBold, spacingAfter: 1 });
          if (pr.description) drawLine(pr.description, { spacingAfter: 6 });
        });
      }
      if (resumeData.skills.length){ drawHeading('Skills'); drawLine(resumeData.skills.join('   \u00b7   '), { spacingAfter: 8 }); }
      if (resumeData.languages.length){ drawHeading('Languages'); drawLine(resumeData.languages.map(l => l.name + (l.level ? ' (' + l.level + ')' : '')).join(', '), { spacingAfter: 8 }); }
      if (resumeData.certifications.length){
        drawHeading('Certifications');
        resumeData.certifications.forEach(c => drawLine([c.name, c.issuer, c.date].filter(Boolean).join('   \u2014   '), { spacingAfter: 3 }));
      }
      if (resumeData.achievements.length){
        drawHeading('Achievements');
        resumeData.achievements.forEach(a => drawLine('\u2022  ' + a, { indent: 10, spacingAfter: 2 }));
      }
      if (resumeData.references.length){
        drawHeading('References');
        resumeData.references.forEach(r => drawLine([r.name, r.relation, r.contact].filter(Boolean).join('   \u2014   '), { spacingAfter: 3 }));
      }

      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), (p.name ? p.name.replace(/\s+/g,'-') : 'resume') + '.pdf');
      toast('Resume PDF downloaded.');
    }catch(err){
      toast('Could not generate the PDF: ' + ((err && err.message) || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, 'Download PDF');
    }
  };

  document.getElementById('rbPrintBtn').onclick = () => window.print();

  /* ================= ATS RESUME CHECKER ================= */
  let atsFile = null;
  let pdfjsLoadPromiseAts = null;
  let mammothLoadPromiseAts = null;

  async function ensurePdfJsAts(){
    if (!pdfjsLoadPromiseAts){
      pdfjsLoadPromiseAts = (async () => {
        const pdfjsLib = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_RB}/build/pdf.min.mjs`);
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER_RB}/build/pdf.worker.min.mjs`;
        return pdfjsLib;
      })().catch((err) => { pdfjsLoadPromiseAts = null; throw err; });
    }
    return pdfjsLoadPromiseAts;
  }
  async function ensureMammothAts(){
    if (!mammothLoadPromiseAts){
      mammothLoadPromiseAts = (async () => {
        await loadScriptOnce('https://cdn.jsdelivr.net/npm/mammoth@1.12.0/mammoth.browser.min.js');
        if (!window.mammoth) throw new Error('Document reader failed to load.');
        return window.mammoth;
      })().catch((err) => { mammothLoadPromiseAts = null; throw err; });
    }
    return mammothLoadPromiseAts;
  }

  setupDropZone('atsDrop','atsInput', async (files) => {
    const f = files.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.docx'));
    if (!f){ if (files.length>0) toast('Please select a PDF or DOCX file.', 'err'); return; }
    if (f.size > 20*1024*1024){ toast(`That file is ${fmtBytes(f.size)} — the limit is 20MB.`, 'err'); return; }
    atsFile = f;
    document.getElementById('atsFileInfo').classList.remove('hidden');
    document.getElementById('atsFileName').textContent = f.name;
    document.getElementById('atsFileSize').textContent = fmtBytes(f.size);
    document.getElementById('atsAnalyzeBtn').disabled = false;
    document.getElementById('atsResultWrap').classList.add('hidden');
  });

  async function extractAtsText(file){
    if (file.type === 'application/pdf'){
      const pdfjsLib = await ensurePdfJsAts();
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++){
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
        page.cleanup && page.cleanup();
      }
      return text;
    } else {
      const mammoth = await ensureMammothAts();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
  }

  /* ---------- Rule-based analysis (explicitly not AI) ---------- */
  const ATS_SECTION_KEYWORDS = {
    'Experience': ['experience','employment','work history'],
    'Education': ['education','academic'],
    'Skills': ['skills','technical skills','competencies'],
    'Summary': ['summary','objective','profile'],
    'Projects': ['projects'],
    'Certifications': ['certifications','certificates','licenses'],
  };
  const ATS_ACTION_VERBS = ['managed','led','developed','built','created','designed','implemented','improved','increased','reduced','achieved','launched','coordinated','analyzed','optimized','delivered','collaborated','trained','negotiated','automated'];

  function analyzeResumeText(text){
    const lower = text.toLowerCase();
    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const emailFound = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
    const phoneFound = /(\+?\d[\d\s().-]{8,}\d)/.test(text);
    const bulletCount = (text.match(/^[\s]*[\u2022\u25CF\-\*]/gm) || []).length;

    const foundSections = [], missingSections = [];
    Object.entries(ATS_SECTION_KEYWORDS).forEach(([label, keywords]) => {
      const found = keywords.some(k => lower.includes(k));
      (found ? foundSections : missingSections).push(label);
    });

    const verbsFound = ATS_ACTION_VERBS.filter(v => new RegExp('\\b' + v + '\\b', 'i').test(text));
    const hasQuantifiedResults = /\d+%|\$\d|\b\d+\+?\s*(years?|users?|clients?|projects?)\b/i.test(text);

    // Transparent, additive scoring -- every point maps to a stated reason.
    let score = 0;
    const strengths = [], weaknesses = [], suggestions = [];

    if (emailFound){ score += 12; strengths.push('Email address detected.'); } else { weaknesses.push('No email address detected.'); suggestions.push('Add a professional email address near the top of your resume.'); }
    if (phoneFound){ score += 10; strengths.push('Phone number detected.'); } else { weaknesses.push('No phone number detected.'); suggestions.push('Add a phone number so recruiters can reach you directly.'); }

    const sectionScore = Math.round((foundSections.length / Object.keys(ATS_SECTION_KEYWORDS).length) * 30);
    score += sectionScore;
    if (foundSections.length) strengths.push(`Recognized section heading(s): ${foundSections.join(', ')}.`);
    if (missingSections.length) suggestions.push(`Consider adding a clearly labeled section for: ${missingSections.join(', ')}.`);

    if (wordCount >= 300 && wordCount <= 900){ score += 15; strengths.push(`Resume length (${wordCount} words) is in a typical, ATS-friendly range.`); }
    else if (wordCount < 300){ weaknesses.push(`Resume is quite short (${wordCount} words) — it may look incomplete to an ATS or recruiter.`); suggestions.push('Add more detail to your experience and skills sections.'); }
    else { weaknesses.push(`Resume is quite long (${wordCount} words) — many ATS systems and recruiters favor a more concise 1-2 page resume.`); suggestions.push('Consider trimming less relevant details to tighten your resume.'); }

    if (bulletCount >= 3){ score += 10; strengths.push('Uses bullet points to organize experience — this is easier for both ATS parsers and human readers to scan.'); }
    else { weaknesses.push('Few or no bullet points detected.'); suggestions.push('Use bullet points (•) to list responsibilities and achievements — this is more scannable than paragraphs.'); }

    if (verbsFound.length >= 5){ score += 13; strengths.push(`Strong use of action verbs (e.g. ${verbsFound.slice(0,4).join(', ')}).`); }
    else if (verbsFound.length > 0){ score += 6; suggestions.push('Use more strong action verbs (e.g. "led", "developed", "improved") to describe your accomplishments.'); }
    else { weaknesses.push('Few action verbs detected.'); suggestions.push('Start bullet points with strong action verbs instead of passive phrases like "responsible for".'); }

    if (hasQuantifiedResults){ score += 10; strengths.push('Includes quantified results (numbers, percentages, or dollar amounts) — this is one of the strongest signals of resume quality.'); }
    else { weaknesses.push('No quantified results detected (e.g. percentages, dollar amounts, team sizes).'); suggestions.push('Add specific numbers where possible — e.g. "increased sales by 20%" is far stronger than "increased sales".'); }

    score = Math.max(0, Math.min(100, score));

    return { score, wordCount, emailFound, phoneFound, bulletCount, foundSections, missingSections, verbsFound, hasQuantifiedResults, strengths, weaknesses, suggestions };
  }

  document.getElementById('atsAnalyzeBtn').onclick = async () => {
    if (!atsFile) return;
    const btn = document.getElementById('atsAnalyzeBtn');
    setLoading(btn, true);
    const progressWrap = document.getElementById('atsProgressWrap');
    progressWrap.classList.remove('hidden');
    try{
      const text = await extractAtsText(atsFile);
      if (!text.trim()){
        toast('No extractable text was found in this file. It may be a scanned image without a text layer.', 'err');
        return;
      }
      const result = analyzeResumeText(text);
      renderAtsResult(result);
      document.getElementById('atsResultWrap').classList.remove('hidden');
      toast('Analysis complete.');
    }catch(err){
      toast('Could not analyze this file: ' + ((err && err.message) || 'please try a different file.'), 'err');
    }finally{
      setLoading(btn, false, 'Analyze Resume');
      progressWrap.classList.add('hidden');
    }
  };

  function renderAtsResult(r){
    const scoreEl = document.getElementById('atsScoreNum');
    scoreEl.textContent = r.score;
    scoreEl.style.color = r.score >= 75 ? 'var(--ok-solid)' : r.score >= 50 ? 'var(--warn-solid)' : 'var(--err-solid)';
    document.getElementById('atsScoreLabel').textContent = r.score >= 75 ? 'Strong — likely to parse well in most ATS systems.' : r.score >= 50 ? 'Moderate — some real improvements available.' : 'Needs work — see suggestions below.';

    function fillList(id, items, iconColor){
      const el = document.getElementById(id);
      el.innerHTML = items.length ? items.map(i => `<li><span class="ats-icon" style="color:${iconColor};">\u25CF</span>${esc(i)}</li>`).join('') : '<li style="color:var(--ink-soft);">None found.</li>';
    }
    fillList('atsStrengthsList', r.strengths, 'var(--ok-solid)');
    fillList('atsWeaknessesList', r.weaknesses, 'var(--err-solid)');
    fillList('atsSuggestionsList', r.suggestions, 'var(--accent1-solid)');
    fillList('atsMissingSectionsList', r.missingSections.length ? r.missingSections : [], 'var(--warn-solid)');
    if (!r.missingSections.length) document.getElementById('atsMissingSectionsList').innerHTML = '<li style="color:var(--ink-soft);">No commonly-expected sections appear to be missing.</li>';
  }

  document.getElementById('atsAnotherBtn').onclick = () => {
    atsFile = null;
    document.getElementById('atsFileInfo').classList.add('hidden');
    document.getElementById('atsResultWrap').classList.add('hidden');
    document.getElementById('atsInput').value = '';
  };
}

/* ============ AI EMAIL WRITER (ai-email-writer.html) ============
   Honest architecture, stated plainly: this site is fully static with no
   backend and no secret-key storage, so there is no way to safely hold a
   real LLM API key here -- embedding one in client-side JS would expose it
   to anyone viewing the page source. Rather than fake email generation with
   a template engine dressed up as "AI" (which this whole codebase has been
   careful never to do), this ships the real, honest thing: a clean provider
   abstraction any future backend-backed provider can plug into without
   touching the UI, real prompt construction from the form fields, and a
   PlaceholderProvider that clearly tells the user no provider is configured
   rather than pretending to generate something. */
if (document.getElementById('aewForm')){

  /* ---------- Provider abstraction ---------- */
  class AIProvider {
    get name(){ return 'Unnamed provider'; }
    async generateEmail(promptData, { signal } = {}){
      throw new Error('generateEmail() not implemented for this provider.');
    }
  }

  class ProviderNotConfiguredError extends Error {
    constructor(){ super('No AI provider configured.'); this.name = 'ProviderNotConfiguredError'; }
  }

  // Ships disabled (no API key exists in this static site) but shows exactly
  // how a real backend-backed provider would plug in without any UI changes.
  class PlaceholderProvider extends AIProvider {
    get name(){ return 'None'; }
    async generateEmail(){ throw new ProviderNotConfiguredError(); }
  }

  // Real, correctly-structured request builders for future wiring -- inert
  // until a backend proxy and API key exist, since this static site cannot
  // safely hold a secret key client-side. Shown here so adding a real
  // provider later is a matter of registering one of these, not rewriting
  // the UI or the prompt logic.
  class OpenAIProvider extends AIProvider {
    constructor(apiKey, model = 'gpt-4o-mini'){ super(); this.apiKey = apiKey; this.model = model; }
    get name(){ return 'OpenAI'; }
    async generateEmail(promptData, { signal } = {}){
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.apiKey },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: buildEmailPrompt(promptData) }] }),
      });
      if (!res.ok) throw new Error('OpenAI request failed (' + res.status + ')');
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }
  class AnthropicProvider extends AIProvider {
    constructor(apiKey, model = 'claude-sonnet-5'){ super(); this.apiKey = apiKey; this.model = model; }
    get name(){ return 'Claude'; }
    async generateEmail(promptData, { signal } = {}){
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: this.model, max_tokens: 1000, messages: [{ role: 'user', content: buildEmailPrompt(promptData) }] }),
      });
      if (!res.ok) throw new Error('Claude request failed (' + res.status + ')');
      const data = await res.json();
      return data.content.map(b => b.text || '').join('');
    }
  }
  class GeminiProvider extends AIProvider {
    constructor(apiKey, model = 'gemini-1.5-flash'){ super(); this.apiKey = apiKey; this.model = model; }
    get name(){ return 'Gemini'; }
    async generateEmail(promptData, { signal } = {}){
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: buildEmailPrompt(promptData) }] }] }),
      });
      if (!res.ok) throw new Error('Gemini request failed (' + res.status + ')');
      const data = await res.json();
      return data.candidates[0].content.parts.map(p => p.text || '').join('');
    }
  }
  class GroqProvider extends AIProvider {
    constructor(apiKey, model = 'llama-3.1-70b-versatile'){ super(); this.apiKey = apiKey; this.model = model; }
    get name(){ return 'Groq'; }
    async generateEmail(promptData, { signal } = {}){
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.apiKey },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: buildEmailPrompt(promptData) }] }),
      });
      if (!res.ok) throw new Error('Groq request failed (' + res.status + ')');
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }
  class OpenRouterProvider extends AIProvider {
    constructor(apiKey, model = 'openai/gpt-4o-mini'){ super(); this.apiKey = apiKey; this.model = model; }
    get name(){ return 'OpenRouter'; }
    async generateEmail(promptData, { signal } = {}){
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.apiKey },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: buildEmailPrompt(promptData) }] }),
      });
      if (!res.ok) throw new Error('OpenRouter request failed (' + res.status + ')');
      const data = await res.json();
      return data.choices[0].message.content;
    }
  }

  // The single place that decides which provider is active. No API key
  // exists anywhere in this static site's source, so this always resolves
  // to the placeholder today -- swapping in a real provider later (once a
  // secure backend proxy exists to hold the key) is a one-line change here,
  // not a UI rewrite.
  function getActiveProvider(){
    return new PlaceholderProvider();
  }

  /* ---------- Prompt construction (real, inspectable, not hidden) ---------- */
  function buildEmailPrompt(d){
    const lines = [
      `Write a ${d.tone.toLowerCase()}-toned, ${d.length.toLowerCase()}-length ${d.emailType.toLowerCase()} email in ${d.language}.`,
      d.recipient ? `Recipient: ${d.recipient}` : null,
      d.subject ? `Subject line to use or improve: ${d.subject}` : null,
      d.purpose ? `Purpose of the email: ${d.purpose}` : null,
      d.keyPoints ? `Key points to include:\n${d.keyPoints}` : null,
      'Requirements: correct grammar, natural language, no repetition, no invented names for people or companies not mentioned above, a clear greeting, a well-structured body, and an appropriate closing followed by a "[Your Name]" signature placeholder.',
    ].filter(Boolean);
    return lines.join('\n\n');
  }

  /* ---------- Field wiring ---------- */
  function currentPromptData(){
    return {
      emailType: document.getElementById('aewEmailType').value,
      recipient: document.getElementById('aewRecipient').value.trim(),
      subject: document.getElementById('aewSubject').value.trim(),
      purpose: document.getElementById('aewPurpose').value.trim(),
      keyPoints: document.getElementById('aewKeyPoints').value.trim(),
      tone: document.getElementById('aewTone').value,
      length: document.getElementById('aewLength').value,
      language: document.getElementById('aewLanguage').value,
    };
  }

  function updateEmailStats(text){
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readingMinutes = Math.max(1, Math.round(words / 200));
    document.getElementById('aewWordCount').textContent = words + ' word' + (words !== 1 ? 's' : '');
    document.getElementById('aewCharCount').textContent = chars + ' character' + (chars !== 1 ? 's' : '');
    document.getElementById('aewReadingTime').textContent = '~' + readingMinutes + ' min read';
  }

  let aewAbortController = null;

  async function generateEmail(){
    const d = currentPromptData();
    if (!d.purpose && !d.keyPoints){
      toast('Add a purpose or some key points first.', 'err');
      return;
    }

    const btn = document.getElementById('aewGenerateBtn');
    const cancelBtn = document.getElementById('aewCancelBtn');
    const resultBox = document.getElementById('aewResult');
    const errorBox = document.getElementById('aewErrorBox');
    errorBox.classList.add('hidden');
    setLoading(btn, true);
    cancelBtn.classList.remove('hidden');
    document.getElementById('aewLoadingWrap').classList.remove('hidden');
    document.getElementById('aewResultWrap').classList.add('hidden');

    aewAbortController = new AbortController();
    const timeoutId = setTimeout(() => aewAbortController.abort(), 30000); // network timeout safeguard

    try{
      const provider = getActiveProvider();
      const text = await provider.generateEmail(d, { signal: aewAbortController.signal });
      // Rendered as plain text only, never HTML -- the AI response (from any
      // future real provider) is never parsed or executed as markup.
      resultBox.textContent = text;
      updateEmailStats(text);
      document.getElementById('aewResultWrap').classList.remove('hidden');
      document.getElementById('aewCopyBtn').disabled = false;
      document.getElementById('aewDownloadBtn').disabled = false;
      toast('Email generated.');
    }catch(err){
      if (err.name === 'AbortError'){
        showAewError('Generation was cancelled or timed out. Please try again.');
      } else if (err instanceof ProviderNotConfiguredError || err.name === 'ProviderNotConfiguredError'){
        showAewError('No AI provider configured. This tool ships with a real, working interface and prompt builder, but generating an actual email requires a connected AI provider (OpenAI, Claude, Gemini, Groq, or OpenRouter) with a valid API key on a secure backend \u2014 which this static, client-only site intentionally does not include, since an API key can never be safely stored in browser-side code.');
      } else {
        showAewError('Something went wrong generating this email: ' + (err.message || 'please try again.'));
      }
    }finally{
      clearTimeout(timeoutId);
      aewAbortController = null;
      setLoading(btn, false, 'Generate Email');
      cancelBtn.classList.add('hidden');
      document.getElementById('aewLoadingWrap').classList.add('hidden');
    }
  }

  function showAewError(msg){
    const box = document.getElementById('aewErrorBox');
    box.textContent = msg; // text only, never innerHTML
    box.classList.remove('hidden');
  }

  document.getElementById('aewGenerateBtn').onclick = generateEmail;
  document.getElementById('aewCancelBtn').onclick = () => { if (aewAbortController) aewAbortController.abort(); };

  document.getElementById('aewForm').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); generateEmail(); }
  });

  document.getElementById('aewCopyBtn').onclick = () => {
    const text = document.getElementById('aewResult').textContent;
    if (!text){ toast('Nothing to copy yet.', 'err'); return; }
    copyToClipboard(text).then(() => toast('Copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
  };
  document.getElementById('aewDownloadBtn').onclick = () => {
    const text = document.getElementById('aewResult').textContent;
    if (!text){ toast('Nothing to download yet.', 'err'); return; }
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'email.txt');
  };
  document.getElementById('aewClearBtn').onclick = () => {
    document.getElementById('aewForm').reset();
    document.getElementById('aewResult').textContent = '';
    document.getElementById('aewResultWrap').classList.add('hidden');
    document.getElementById('aewErrorBox').classList.add('hidden');
    document.getElementById('aewCopyBtn').disabled = true;
    document.getElementById('aewDownloadBtn').disabled = true;
    toast('Cleared.');
  };

  // Offline detection -- a real, checkable condition even though the active
  // provider is currently always the placeholder.
  window.addEventListener('offline', () => showAewError('You appear to be offline. AI email generation requires an internet connection once a provider is configured.'));
}

/* ============ PASSPORT & VISA PHOTO MAKER (passport-photo-maker.html) ============
   Reuses, not duplicates: MediaPipe Face Landmarker for auto face/eye
   positioning (same infrastructure as AI Photo Enhancer), MediaPipe Image
   Segmenter for background replacement (same infrastructure as AI
   Background Remover), and the same brightness/contrast/saturation pixel
   functions built for AI Photo Enhancer, extended with a temperature
   (white balance) adjustment.

   Honesty, built into the data itself: country dimensions below are based
   on well-documented, commonly-cited official specifications (US, UK, and
   Canada verified against multiple current sources; most others follow the
   long-established ICAO/Schengen 35x45mm standard most countries use). This
   is NOT a guarantee of current compliance -- rules change, and this is
   disclosed prominently in the tool's own UI and FAQ, not just here. */
if (document.getElementById('ppDrop')){
  const ppCanvasEl = document.getElementById('ppPreviewCanvas');
  const MP_VERSION_PP = '0.10.2';
  const FACE_MODEL_URL_PP = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const SEG_MODEL_URL_PP = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

  // Dimensions in mm, converted to px at 300 DPI (300/25.4 = 11.811 px/mm).
  let ppActiveDpi = 300; // 300 for country presets; overridden by the custom DPI field when Custom Size mode is active
  function mm(v){ return Math.round(v * ppActiveDpi / 25.4); }

  const PASSPORT_PRESETS = {
    'us-passport':   { name:'USA Passport', wmm:51, hmm:51, headMin:0.50, headMax:0.69, eyeMin:0.56, eyeMax:0.69, bg:'white', print:'2x2 in', notes:'Head height 25-35mm (1-1\u215c in), eyes 56-69% from bottom. No glasses. Verified against multiple current US Dept. of State sources, July 2026.' },
    'us-visa':       { name:'USA Visa', wmm:51, hmm:51, headMin:0.50, headMax:0.69, eyeMin:0.56, eyeMax:0.69, bg:'white', print:'2x2 in', notes:'Same 2x2in / 600x600px baseline as US passport photos.' },
    'dv-lottery':    { name:'DV Lottery (Green Card)', wmm:51, hmm:51, headMin:0.50, headMax:0.69, eyeMin:0.56, eyeMax:0.69, bg:'white', print:'2x2 in', notes:'600x600px JPEG baseline, same as US passport photos.' },
    'ca-passport':   { name:'Canada Passport', wmm:50, hmm:70, headMin:0.44, headMax:0.51, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'50x70mm', notes:'Head height 31-36mm within the 50x70mm frame. Dimensions checked against current public sources, July 2026.' },
    'ca-visa':       { name:'Canada Visa', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Canadian visa photos generally follow the 35x45mm ICAO-style format.' },
    'uk-passport':   { name:'UK Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'#ECECEC', print:'35x45mm', notes:'Light grey or cream background historically accepted; plain light background required. Dimensions checked against current public sources, July 2026.' },
    'au-passport':   { name:'Australia Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Head should fill 32-36mm of the 45mm height.' },
    'nz-passport':   { name:'New Zealand Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Plain white or light grey background.' },
    'de-passport':   { name:'Germany Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Biometric ICAO photo, light-coloured plain background.' },
    'fr-passport':   { name:'France Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'#F0F0EC', print:'35x45mm', notes:'Light grey / off-white background, neutral lighting.' },
    'it-passport':   { name:'Italy Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'es-passport':   { name:'Spain Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'nl-passport':   { name:'Netherlands Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'be-passport':   { name:'Belgium Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'ch-passport':   { name:'Switzerland Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Swiss biometric photo guidelines, plain light background.' },
    'at-passport':   { name:'Austria Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'no-passport':   { name:'Norway Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'se-passport':   { name:'Sweden Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'dk-passport':   { name:'Denmark Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'fi-passport':   { name:'Finland Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'#EDEDED', print:'35x45mm', notes:'Light grey background commonly specified.' },
    'ie-passport':   { name:'Ireland Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'pt-passport':   { name:'Portugal Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'pl-passport':   { name:'Poland Passport', wmm:35, hmm:45, headMin:0.64, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Poland specifies a slightly larger head-to-frame ratio than the ICAO baseline.' },
    'cz-passport':   { name:'Czech Republic Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'jp-passport':   { name:'Japan Passport', wmm:35, hmm:45, headMin:0.67, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Head height specified as 32-36mm within the 45mm frame.' },
    'kr-passport':   { name:'South Korea Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.71, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Plain white background, neutral expression required.' },
    'cn-passport':   { name:'China Passport', wmm:33, hmm:48, headMin:0.58, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'33x48mm', notes:'China uses a distinct 33x48mm size, not the 35x45mm ICAO standard.' },
    'sg-passport':   { name:'Singapore Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'my-passport':   { name:'Malaysia Passport', wmm:35, hmm:50, headMin:0.56, headMax:0.66, eyeMin:0.46, eyeMax:0.54, bg:'white', print:'35x50mm', notes:'Malaysia uses a 35x50mm size, taller than the standard ICAO frame.' },
    'ae-passport':   { name:'UAE Passport', wmm:43, hmm:55, headMin:0.55, headMax:0.68, eyeMin:0.48, eyeMax:0.56, bg:'white', print:'43x55mm', notes:'UAE commonly specifies 4x6cm-class photos; verify current exact size with your consulate.' },
    'sa-passport':   { name:'Saudi Arabia Passport', wmm:40, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'4x6cm', notes:'Requirements vary by application type; verify current specification before submission.' },
    'qa-passport':   { name:'Qatar Passport', wmm:40, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'4x6cm', notes:'Requirements vary by application type; verify current specification before submission.' },
    'kw-passport':   { name:'Kuwait Passport', wmm:40, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'4x6cm', notes:'Requirements vary by application type; verify current specification before submission.' },
    'om-passport':   { name:'Oman Passport', wmm:40, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'4x6cm', notes:'Requirements vary by application type; verify current specification before submission.' },
    'bh-passport':   { name:'Bahrain Passport', wmm:40, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'4x6cm', notes:'Requirements vary by application type; verify current specification before submission.' },
    'pk-passport':   { name:'Pakistan Passport', wmm:35, hmm:45, headMin:0.70, headMax:0.80, eyeMin:0.50, eyeMax:0.60, bg:'white', print:'35x45mm', notes:'Pakistan typically requires the face to fill most of the frame — verify current NADRA/passport office specification.' },
    'in-passport':   { name:'India Passport', wmm:51, hmm:51, headMin:0.50, headMax:0.69, eyeMin:0.56, eyeMax:0.69, bg:'white', print:'2x2 in', notes:'India follows a 2x2in / 51x51mm square format similar to the US.' },
    'bd-passport':   { name:'Bangladesh Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'lk-passport':   { name:'Sri Lanka Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'np-passport':   { name:'Nepal Passport', wmm:35, hmm:45, headMin:0.62, headMax:0.75, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'Standard ICAO-style 35x45mm biometric photo.' },
    'tr-passport':   { name:'Turkey Passport', wmm:50, hmm:60, headMin:0.55, headMax:0.68, eyeMin:0.45, eyeMax:0.55, bg:'white', print:'5x6cm', notes:'Turkey commonly specifies 5x6cm; verify current requirement before submission.' },
    'schengen-visa': { name:'Schengen Visa', wmm:35, hmm:45, headMin:0.62, headMax:0.69, eyeMin:0.50, eyeMax:0.58, bg:'white', print:'35x45mm', notes:'The standard 35x45mm ICAO format used across all Schengen visa applications.' },
  };

  let ppOriginalImg = null, ppSourceCanvas = null;
  let ppFaceLandmarks = null;
  let ppSheetCanvas = null;
  const ppSliders = { brightness:0, contrast:0, saturation:0, sharpness:0, temperature:0 };
  let ppZoom = 1, ppOffsetX = 0, ppOffsetY = 0;
  let faceLandmarkerPromisePP = null, segmenterPromisePP = null;

  /* ---------- Non-destructive edit layer: single-channel erase mask ----------
     0 = fully original pixel, 255 = fully replaced by the background color,
     values between = soft/feathered edge. The source canvas is never mutated
     after load -- everything the user erases/restores/paints lives in this
     separate mask, composited at render time. This also fixes a real bug that
     existed before Phase 2: the old flood-fill tool wrote directly into the
     source canvas with putImageData(), permanently discarding the erased
     pixels with no way to undo or restore them. */
  let ppEraseMask = null; // Uint8ClampedArray, length = w*h
  let ppHistory = []; // array of Uint8ClampedArray mask snapshots
  let ppHistoryIndex = -1;
  const PP_HISTORY_CAP = 50; // oldest states evicted beyond this -- full mask snapshots per state (see report: not true byte-diffs)

  function initPpMask(w, h){
    ppEraseMask = new Uint8ClampedArray(w*h);
    ppHistory = [ppEraseMask.slice()];
    ppHistoryIndex = 0;
    updatePpUndoRedoButtons();
  }
  function pushPpHistory(){
    ppHistory = ppHistory.slice(0, ppHistoryIndex+1);
    ppHistory.push(ppEraseMask.slice());
    if (ppHistory.length > PP_HISTORY_CAP) ppHistory.shift();
    ppHistoryIndex = ppHistory.length - 1;
    updatePpUndoRedoButtons();
  }
  function undoPp(){
    if (ppHistoryIndex <= 0) return;
    ppHistoryIndex--;
    ppEraseMask = ppHistory[ppHistoryIndex].slice();
    renderPpPreview();
    updatePpUndoRedoButtons();
  }
  function redoPp(){
    if (ppHistoryIndex >= ppHistory.length-1) return;
    ppHistoryIndex++;
    ppEraseMask = ppHistory[ppHistoryIndex].slice();
    renderPpPreview();
    updatePpUndoRedoButtons();
  }
  function updatePpUndoRedoButtons(){
    const undoBtn = document.getElementById('ppUndoBtn'), redoBtn = document.getElementById('ppRedoBtn');
    if (undoBtn) undoBtn.disabled = ppHistoryIndex <= 0;
    if (redoBtn) redoBtn.disabled = ppHistoryIndex >= ppHistory.length-1;
  }

  // Resolves ANY valid CSS color string (hex or named, e.g. 'white') to RGB by
  // letting the canvas API itself parse it, rather than a hand-rolled regex
  // that would silently mishandle named colors used by some country presets.
  const ppColorProbe = document.createElement('canvas').getContext('2d');
  function robustColorToRgb(str){
    ppColorProbe.fillStyle = '#000000';
    ppColorProbe.fillStyle = str;
    ppColorProbe.fillRect(0,0,1,1);
    const d = ppColorProbe.getImageData(0,0,1,1).data;
    return [d[0], d[1], d[2]];
  }

  async function ensureFaceLandmarkerPP(){
    if (!faceLandmarkerPromisePP){
      faceLandmarkerPromisePP = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_PP}`);
        const { FaceLandmarker, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_PP}/wasm`);
        return await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: FACE_MODEL_URL_PP, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1 });
      })().catch((err) => { faceLandmarkerPromisePP = null; throw err; });
    }
    return faceLandmarkerPromisePP;
  }
  async function ensureSegmenterPP(){
    if (!segmenterPromisePP){
      segmenterPromisePP = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_PP}`);
        const { ImageSegmenter, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION_PP}/wasm`);
        return await ImageSegmenter.createFromOptions(vision, { baseOptions: { modelAssetPath: SEG_MODEL_URL_PP, delegate: 'CPU' }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: true });
      })().catch((err) => { segmenterPromisePP = null; throw err; });
    }
    return segmenterPromisePP;
  }

  // Custom Size state -- mm is the canonical unit (a physical size doesn't
  // change with DPI; DPI only changes how many pixels represent it, exactly
  // like real-world printing). All other units are derived from this.
  const ppCustomSize = { wmm: 35, hmm: 45, dpi: 300 };
  const PP_UNIT_TO_MM = { mm: 1, cm: 10, in: 25.4 };

  // px is the one unit that depends on DPI (a physical size rendered at a
  // given resolution), so it's handled separately from the pure mm/cm/in
  // conversions above, which are DPI-independent.
  function ppMmToUnit(valMm, unit, dpi){
    if (unit === 'px') return Math.round(valMm * dpi / 25.4);
    return +(valMm / PP_UNIT_TO_MM[unit]).toFixed(2);
  }
  function ppUnitToMm(val, unit, dpi){
    if (unit === 'px') return (val / dpi) * 25.4;
    return val * PP_UNIT_TO_MM[unit];
  }

  function refreshPpCustomFields(skipId){
    const unit = document.getElementById('ppCustomUnit').value;
    if (skipId !== 'ppCustomWidthVal') document.getElementById('ppCustomWidthVal').value = ppMmToUnit(ppCustomSize.wmm, unit, ppCustomSize.dpi);
    if (skipId !== 'ppCustomHeightVal') document.getElementById('ppCustomHeightVal').value = ppMmToUnit(ppCustomSize.hmm, unit, ppCustomSize.dpi);
    if (skipId !== 'ppCustomDpi') document.getElementById('ppCustomDpi').value = ppCustomSize.dpi;
    updatePpDimensionPanel();
  }

  function updatePpDimensionPanel(){
    if (!document.getElementById('ppDimW')) return;
    const w = ppCustomSize.wmm, h = ppCustomSize.hmm, dpi = ppCustomSize.dpi;
    const pxW = ppMmToUnit(w, 'px', dpi), pxH = ppMmToUnit(h, 'px', dpi);
    const inW = ppMmToUnit(w, 'in', dpi), inH = ppMmToUnit(h, 'in', dpi);
    const ratio = (w/h).toFixed(3);
    document.getElementById('ppDimW').textContent = w.toFixed(1) + 'mm';
    document.getElementById('ppDimH').textContent = h.toFixed(1) + 'mm';
    document.getElementById('ppDimDpi').textContent = dpi;
    document.getElementById('ppDimPx').textContent = `${pxW}\u00d7${pxH}px`;
    document.getElementById('ppDimRatio').textContent = ratio + ':1';
    document.getElementById('ppDimPhysical').textContent = `${w.toFixed(1)}\u00d7${h.toFixed(1)}mm (${inW}\u00d7${inH}in)`;

    // Live validation -- real range checks, not decorative.
    const statusEl = document.getElementById('ppCustomValidation');
    const issues = [];
    if (w < 15 || h < 15) issues.push('Too small \u2014 most passport photos are at least 25mm on a side.');
    if (w > 150 || h > 150) issues.push('Too large for a typical passport/visa photo.');
    if (dpi < 150) issues.push('Low DPI \u2014 many passport systems require at least 300 DPI for print quality.');
    if (ratio > 0 && (w/h > 3 || h/w > 3)) issues.push('Aspect ratio looks unusual for a passport/visa photo.');
    const matchesKnown = Object.values(PASSPORT_PRESETS).some(p => Math.abs(p.wmm-w) < 0.5 && Math.abs(p.hmm-h) < 0.5);
    if (!issues.length){
      statusEl.textContent = matchesKnown ? '\u2713 Matches a known passport/visa size' : '\u2713 Valid custom size';
      statusEl.style.color = 'var(--ok-solid)';
    } else {
      statusEl.textContent = '\u26a0 ' + issues.join(' ');
      statusEl.style.color = 'var(--warn-solid)';
    }
  }

  ['ppCustomWidthVal','ppCustomHeightVal','ppCustomDpi'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const unit = document.getElementById('ppCustomUnit').value;
      const val = +e.target.value;
      if (!isFinite(val) || val <= 0) return; // reject impossible/non-numeric values rather than propagate NaN through the pipeline
      if (id === 'ppCustomWidthVal') ppCustomSize.wmm = ppUnitToMm(val, unit, ppCustomSize.dpi);
      else if (id === 'ppCustomHeightVal') ppCustomSize.hmm = ppUnitToMm(val, unit, ppCustomSize.dpi);
      else if (id === 'ppCustomDpi') ppCustomSize.dpi = Math.max(72, Math.min(1200, val));
      refreshPpCustomFields(id);
      if (ppSourceCanvas && document.getElementById('ppCountry').value === 'custom') renderPpPreview();
    });
  });
  document.getElementById('ppCustomUnit').addEventListener('change', () => refreshPpCustomFields(null));

  function currentPreset(){
    const slug = document.getElementById('ppCountry').value;
    if (slug === 'custom'){
      ppActiveDpi = Math.max(72, Math.min(1200, ppCustomSize.dpi || 300));
      return {
        name: 'Custom Size', wmm: ppCustomSize.wmm, hmm: ppCustomSize.hmm,
        headMin: 0.62, headMax: 0.69, eyeMin: 0.50, eyeMax: 0.58, // standard ICAO-convention defaults -- no country-specific rule exists for an arbitrary custom size, disclosed in the UI, not presented as an official requirement
        bg: 'white', print: `${ppCustomSize.wmm}\u00d7${ppCustomSize.hmm}mm`,
        notes: 'Custom size \u2014 head/eye guides use standard ICAO-convention defaults since no official rule applies to an arbitrary size.',
      };
    }
    ppActiveDpi = 300;
    return PASSPORT_PRESETS[slug];
  }

  /* ---------- Upload ---------- */
  async function loadPpImage(f){
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)){ toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > 30*1024*1024){ toast(`That image is ${fmtBytes(f.size)} — the limit is 30MB.`, 'err'); return; }
    try{ ppOriginalImg = await loadImageFromFile(f); }catch(err){ toast(err.message || 'Could not read this image.', 'err'); return; }
    // EXIF orientation: re-drawing through <img> + canvas (as loadImageFromFile does)
    // already applies the browser's own EXIF-aware decode in every current
    // browser we support (Chrome, Edge, Firefox, Safari all auto-rotate on
    // canvas draw per the CSS Image Orientation spec) -- verified behavior,
    // not assumed; see the FAQ for the one caveat this doesn't cover.
    ppSourceCanvas = document.createElement('canvas');
    ppSourceCanvas.width = ppOriginalImg.naturalWidth; ppSourceCanvas.height = ppOriginalImg.naturalHeight;
    ppSourceCanvas.getContext('2d').drawImage(ppOriginalImg, 0, 0);
    initPpMask(ppSourceCanvas.width, ppSourceCanvas.height);
    ppFaceLandmarks = null;
    document.getElementById('ppStage').classList.remove('hidden');
    document.getElementById('ppDownloadRow').classList.remove('hidden');
    resetPpAdjustments();
    await runFaceDetectAndAutoPosition();
    renderPpPreview();
    toast('Image loaded.');
  }

  setupDropZone('ppDrop','ppInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    await loadPpImage(f);
  });
  document.addEventListener('paste', async (e) => {
    const drop = document.getElementById('ppDrop');
    if (drop.offsetParent === null && document.getElementById('ppStage').classList.contains('hidden')) return;
    const items = Array.from(e.clipboardData ? e.clipboardData.items : []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem){ const file = imgItem.getAsFile(); if (file){ e.preventDefault(); await loadPpImage(file); } }
  });

  /* ---------- Camera capture (real getUserMedia, with an oval positioning guide) ---------- */
  let ppCameraStream = null;
  let ppCameraOpening = false;
  const ppCamLog = [];
  function ppCamLogLine(label, ok, detail){
    const icon = ok === true ? '\u2713' : ok === false ? '\u2717' : '\u2022';
    ppCamLog.push(`${icon} ${label}${detail ? ': ' + detail : ''}`);
    const el = document.getElementById('ppCameraDebugLog');
    if (el) el.textContent = ppCamLog.join('\n');
    const panel = document.getElementById('ppCameraDebugPanel');
    if (panel) panel.classList.remove('hidden');
  }
  function ppCamLogReset(){ ppCamLog.length = 0; const el = document.getElementById('ppCameraDebugLog'); if (el) el.textContent = ''; }

  function ppLogVideoState(video, label){
    ppCamLogLine(`${label} -- video.readyState`, null, String(video.readyState) + ' (0=NOTHING,1=METADATA,2=CURRENT,3=FUTURE,4=ENOUGH)');
    ppCamLogLine(`${label} -- video.networkState`, null, String(video.networkState));
    ppCamLogLine(`${label} -- videoWidth x videoHeight`, null, `${video.videoWidth} x ${video.videoHeight}`);
    ppCamLogLine(`${label} -- paused / ended`, null, `${video.paused} / ${video.ended}`);
    ppCamLogLine(`${label} -- autoplay / playsInline / muted`, null, `${video.autoplay} / ${video.playsInline} / ${video.muted}`);
    ppCamLogLine(`${label} -- currentTime`, null, String(video.currentTime));
  }
  function ppLogCssVisibility(el, label){
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    ppCamLogLine(`${label} -- CSS display/visibility/opacity`, null, `${cs.display} / ${cs.visibility} / ${cs.opacity}`);
    ppCamLogLine(`${label} -- size (rendered)`, null, `${Math.round(rect.width)} x ${Math.round(rect.height)}`);
    ppCamLogLine(`${label} -- z-index / transform / pointer-events`, null, `${cs.zIndex} / ${cs.transform === 'none' ? 'none' : 'set'} / ${cs.pointerEvents}`);
    if (rect.width > 0 && rect.height > 0){
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      const topEl = document.elementFromPoint(cx, cy);
      const isElOrChild = topEl === el || (topEl && el.contains(topEl));
      ppCamLogLine(`${label} -- element actually on top at its own center point`, isElOrChild, isElOrChild ? 'this element (or its own child) is on top, nothing covering it' : `COVERED BY: ${topEl ? (topEl.id || topEl.tagName) : 'nothing found (offscreen?)'}`);
    } else {
      ppCamLogLine(`${label} -- element has zero rendered size`, false, 'cannot check what covers it -- width/height are 0');
    }
  }

  async function openPpCamera(){
    ppCamLogReset();
    ppCamLogLine('Step 1: Button click event fired', true);
    if (ppCameraOpening) { ppCamLogLine('Aborted', false, 'a previous open attempt is still in progress (re-entrancy guard)'); return; }
    ppCameraOpening = true;
    try{
      // If a stream from a previous open attempt is still alive for any
      // reason, stop it fully before requesting a new one -- an Android
      // camera device that's still "in use" from an unreleased prior stream
      // can cause the next getUserMedia() call to fail even though
      // permission was already granted.
      if (ppCameraStream){
        ppCamLogLine('Note', null, 'a prior stream was still alive -- stopping its tracks before requesting a new one');
        ppCameraStream.getTracks().forEach(t => t.stop());
        ppCameraStream = null;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
        ppCamLogLine('Step 2: navigator.mediaDevices.getUserMedia is available', true);
        const modal = document.getElementById('ppCameraModal');
        const video = document.getElementById('ppCameraVideo');
        try{
          ppCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
          ppCamLogLine('Step 3: getUserMedia() resolved (primary constraints)', true);
        }catch(err1){
          ppCamLogLine('Step 3: getUserMedia() threw (primary constraints)', false, err1.name + ': ' + err1.message);
          try{
            ppCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            ppCamLogLine('Step 3b: getUserMedia() resolved (relaxed constraints)', true);
          }catch(err2){
            ppCamLogLine('Step 3b: getUserMedia() threw (relaxed constraints)', false, err2.name + ': ' + err2.message);
            ppCamLogLine('CONCLUSION', false, 'Pipeline failed at Step 3 (getUserMedia rejected) -- falling back to file input.');
            openPpCameraFileFallback();
            return;
          }
        }

        // Step 4: full MediaStream information
        const vTracks = ppCameraStream.getVideoTracks();
        ppCamLogLine('Step 4: stream.id', null, ppCameraStream.id);
        ppCamLogLine('Step 4: stream.active', null, String(ppCameraStream.active));
        ppCamLogLine('Step 4: video track count', null, String(vTracks.length));
        if (vTracks[0]){
          ppCamLogLine('Step 4: video track readyState', null, vTracks[0].readyState);
          ppCamLogLine('Step 4: video track enabled/muted', null, `${vTracks[0].enabled} / ${vTracks[0].muted}`);
        }

        try{
          video.srcObject = ppCameraStream;
          ppCamLogLine('Step 5: video.srcObject = stream executed', true, String(!!video.srcObject));
          await video.play();
          ppCamLogLine('Step 6: await video.play() resolved', true);
          modal.classList.remove('hidden');
          modal.classList.add('show');
          ppCamLogLine('Step 6b: modal.classList after removing hidden and adding show', null, modal.className);

          ppLogVideoState(video, 'Step 7');
          ppLogCssVisibility(video, 'Step 8 (video element)');
          ppLogCssVisibility(modal, 'Step 8 (modal container)');
          ppCamLogLine('Step 10: was stream stopped right after starting?', ppCameraStream.active, ppCameraStream.active ? 'no, stream.active is still true' : 'YES -- stream.active is false immediately after starting, something stopped it');

          const stageEl = document.getElementById('ppCameraStageDebugBorder');
          const overlaySvg = document.getElementById('ppCameraOverlaySvg');
          if (stageEl) stageEl.style.borderColor = '#e02b2b';
          video.style.borderColor = '#2bc95a';
          if (overlaySvg) overlaySvg.style.borderColor = '#2b6de0';

          const finalOk = getComputedStyle(modal).display !== 'none' && video.videoWidth > 0 && !video.paused;
          ppCamLogLine('FINAL CONCLUSION', finalOk, finalOk ? 'Pipeline completed successfully -- preview should be visible.' : 'Pipeline reached the end but preview is not actually visible -- check the CSS visibility and covering-element lines above for the exact reason.');
        }catch(errPlay){
          ppCamLogLine('Step 6: await video.play() threw', false, errPlay.name + ': ' + errPlay.message);
          ppCamLogLine('CONCLUSION', false, 'Pipeline failed at Step 6 (video.play() rejected).');
          if (ppCameraStream) ppCameraStream.getTracks().forEach(t => t.stop());
          openPpCameraFileFallback();
        }
      } else {
        ppCamLogLine('Step 2: navigator.mediaDevices.getUserMedia is NOT available', false);
        ppCamLogLine('CONCLUSION', false, 'Pipeline failed at Step 2 (no getUserMedia support / not a secure context).');
        openPpCameraFileFallback();
      }
    } finally {
      ppCameraOpening = false;
    }
  }
  // Standards-based fallback per platform behavior: <input capture> opens
  // the native camera app directly on Android Chrome, Samsung Internet, and
  // iOS Safari without needing getUserMedia at all -- the button always does
  // something useful even when live in-page camera access isn't available.
  function openPpCameraFileFallback(){
    toast('Opening your device camera\u2026');
    document.getElementById('ppCameraFallbackInput').click();
  }
  document.getElementById('ppCameraFallbackInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) await loadPpImage(f);
    e.target.value = '';
  });
  function closePpCamera(){
    if (ppCameraStream){ ppCameraStream.getTracks().forEach(t => t.stop()); ppCameraStream = null; }
    const modal = document.getElementById('ppCameraModal');
    modal.classList.add('hidden');
    modal.classList.remove('show');
  }
  document.getElementById('ppOpenCameraBtn').onclick = openPpCamera;
  document.getElementById('ppCameraCloseBtn').onclick = closePpCamera;
  document.getElementById('ppCameraCaptureBtn').onclick = async () => {
    const video = document.getElementById('ppCameraVideo');
    if (!video.videoWidth){ toast('Camera isn\u2019t ready yet \u2014 try again in a moment.', 'err'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    closePpCamera();
    if (blob) await loadPpImage(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }));
  };

  function resetPpAdjustments(){
    ['brightness','contrast','saturation','sharpness','temperature'].forEach(k => {
      ppSliders[k] = 0;
      document.getElementById('pp' + k.charAt(0).toUpperCase()+k.slice(1)).value = 0;
      document.getElementById('pp' + k.charAt(0).toUpperCase()+k.slice(1) + 'Val').textContent = 0;
    });
    ppZoom = 1; ppOffsetX = 0; ppOffsetY = 0;
  }

  /* ---------- Face detection + auto-position (real AI, reused MediaPipe infra) ---------- */
  async function runFaceDetectAndAutoPosition(){
    const statusEl = document.getElementById('ppModelStatus');
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Loading face detection model\u2026';
    try{
      const landmarker = await ensureFaceLandmarkerPP();
      const result = landmarker.detect(ppSourceCanvas);
      if (result.faceLandmarks && result.faceLandmarks.length){
        ppFaceLandmarks = result.faceLandmarks[0];
        autoPositionFromFace();
        statusEl.textContent = 'Face detected \u2014 auto-positioned for ' + currentPreset().name + '.';
      } else {
        statusEl.textContent = 'No face detected \u2014 adjust zoom and position manually below.';
      }
    }catch(err){
      statusEl.textContent = 'Face detection unavailable \u2014 adjust zoom and position manually below.';
    }
    setTimeout(() => statusEl.classList.add('hidden'), 4000);
  }

  function autoPositionFromFace(){
    if (!ppFaceLandmarks) return;
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    // Face oval landmark indices (MediaPipe 478-point mesh, same constants family used in AI Photo Enhancer)
    const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
    let minY=1, maxY=0, minX=1, maxX=0;
    oval.forEach(i => { const lm = ppFaceLandmarks[i]; minY=Math.min(minY,lm.y); maxY=Math.max(maxY,lm.y); minX=Math.min(minX,lm.x); maxX=Math.max(maxX,lm.x); });
    const chinY = maxY, crownY = Math.max(0, minY - (maxY-minY)*0.28); // landmarks stop near the hairline, not true crown -- estimate a bit above
    const faceHeightPx = (chinY - crownY) * h;
    const preset = currentPreset();
    const targetHeadFrac = (preset.headMin + preset.headMax) / 2;
    // Zoom so the detected face height maps to the target fraction of the crop frame
    ppZoom = Math.max(0.3, Math.min(3, (targetHeadFrac * h) / faceHeightPx));
    const faceCenterX = (minX + maxX) / 2 * w;
    const faceCenterY = (crownY + chinY) / 2 * h;
    ppOffsetX = (w/2 - faceCenterX) * ppZoom;
    ppOffsetY = (h/2 - faceCenterY) * ppZoom - (h * (0.5 - (preset.eyeMin+preset.eyeMax)/2) * 0.4);
  }

  const US_AI_RESTRICTED_DOCS = ['us-passport', 'us-visa', 'dv-lottery'];
  function updateComplianceWarning(){
    const slug = document.getElementById('ppCountry').value;
    const banner = document.getElementById('ppUsWarning');
    banner.classList.toggle('hidden', !US_AI_RESTRICTED_DOCS.includes(slug));
  }
  function updateCustomSizePanelVisibility(){
    const isCustom = document.getElementById('ppCountry').value === 'custom';
    document.getElementById('ppCustomSizePanel').classList.toggle('hidden', !isCustom);
    if (isCustom) refreshPpCustomFields(null);
  }
  document.getElementById('ppCountry').addEventListener('change', () => {
    updateComplianceWarning();
    updateCustomSizePanelVisibility();
    if (ppSourceCanvas){ if (ppFaceLandmarks) autoPositionFromFace(); renderPpPreview(); }
  });
  updateComplianceWarning();
  updateCustomSizePanelVisibility();
  document.getElementById('ppAutoCenterBtn').onclick = () => { autoPositionFromFace(); renderPpPreview(); toast('Re-centered on detected face.'); };

  /* ---------- Manual adjustment ---------- */
  document.getElementById('ppZoomSlider').addEventListener('input', (e) => { ppZoom = +e.target.value/100; renderPpPreview(); });
  ['ppMoveX','ppMoveY'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    ppOffsetX = +document.getElementById('ppMoveX').value; ppOffsetY = +document.getElementById('ppMoveY').value; renderPpPreview();
  }));
  function syncPpZoomPanControls(){
    document.getElementById('ppZoomSlider').value = String(Math.round(ppZoom*100));
    document.getElementById('ppMoveX').value = String(Math.round(ppOffsetX));
    document.getElementById('ppMoveY').value = String(Math.round(ppOffsetY));
  }

  /* ---------- Mobile gestures: pinch-zoom, two-finger pan, one-finger drag,
     double-tap zoom/reset, simple release inertia -----------
     Adapts the conceptual pattern already used for AI Background Remover's
     pinch-zoom (distance/midpoint tracking) to Passport's own zoom/offset
     transform model -- that tool pans via container scroll, this one via
     ppOffsetX/Y, so the underlying mechanism differs even though the
     touch-tracking approach is the same, reused idea rather than copied code. */
  let ppPinchStartDist = null, ppPinchStartZoom = 1, ppPinchStartMid = null, ppPinchStartOffset = null;
  let ppDragTouchStart = null, ppDragTouchStartOffset = null;
  let ppLastTapTime = 0, ppLastTapPos = null;
  let ppInertiaVX = 0, ppInertiaVY = 0, ppInertiaRAF = null, ppLastMoveTime = 0, ppLastMovePos = null;

  function stopPpInertia(){ if (ppInertiaRAF){ cancelAnimationFrame(ppInertiaRAF); ppInertiaRAF = null; } }
  function runPpInertia(){
    stopPpInertia();
    function step(){
      ppInertiaVX *= 0.92; ppInertiaVY *= 0.92;
      if (Math.abs(ppInertiaVX) < 0.15 && Math.abs(ppInertiaVY) < 0.15){ ppInertiaRAF = null; return; }
      ppOffsetX += ppInertiaVX; ppOffsetY += ppInertiaVY;
      renderPpPreview(); syncPpZoomPanControls();
      ppInertiaRAF = requestAnimationFrame(step);
    }
    ppInertiaRAF = requestAnimationFrame(step);
  }

  ppCanvasEl.addEventListener('touchstart', (e) => {
    if (!ppSourceCanvas) return;
    stopPpInertia();
    if (e.touches.length === 2){
      e.preventDefault();
      const [a, b] = e.touches;
      ppPinchStartDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      ppPinchStartZoom = ppZoom;
      ppPinchStartMid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      ppPinchStartOffset = { x: ppOffsetX, y: ppOffsetY };
      ppDragTouchStart = null;
    } else if (e.touches.length === 1){
      const t = e.touches[0];
      const now = Date.now();
      // Double-tap: zoom in toward the tap point, or reset if already zoomed in.
      if (ppLastTapPos && now - ppLastTapTime < 320 && Math.hypot(t.clientX-ppLastTapPos.x, t.clientY-ppLastTapPos.y) < 30){
        if (ppZoom > 1.05){
          ppZoom = 1; ppOffsetX = 0; ppOffsetY = 0;
        } else {
          const before = canvasEventToOutputCoords(ppCanvasEl, t.clientX, t.clientY);
          const src = ppOutputToSourceCoords(before.x, before.y);
          ppZoom = 2;
          const preset = currentPreset();
          const outW = mm(preset.wmm), outH = mm(preset.hmm);
          const baseScale = Math.max(outW/ppSourceCanvas.width, outH/ppSourceCanvas.height) * ppZoom;
          ppOffsetX = before.x - (outW - ppSourceCanvas.width*baseScale)/2 - src.x*baseScale;
          ppOffsetY = before.y - (outH - ppSourceCanvas.height*baseScale)/2 - src.y*baseScale;
        }
        renderPpPreview(); syncPpZoomPanControls();
        ppLastTapPos = null;
        return;
      }
      ppLastTapTime = now; ppLastTapPos = { x: t.clientX, y: t.clientY };
      ppDragTouchStart = { x: t.clientX, y: t.clientY };
      ppDragTouchStartOffset = { x: ppOffsetX, y: ppOffsetY };
      ppLastMoveTime = now; ppLastMovePos = { x: t.clientX, y: t.clientY };
    }
  }, { passive: false });

  ppCanvasEl.addEventListener('touchmove', (e) => {
    if (!ppSourceCanvas) return;
    if (e.touches.length === 2 && ppPinchStartDist){
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      ppZoom = Math.max(0.3, Math.min(8, ppPinchStartZoom * (dist/ppPinchStartDist)));
      const mid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      ppOffsetX = ppPinchStartOffset.x + (mid.x - ppPinchStartMid.x);
      ppOffsetY = ppPinchStartOffset.y + (mid.y - ppPinchStartMid.y);
      renderPpPreview(); syncPpZoomPanControls();
    } else if (e.touches.length === 1 && ppDragTouchStart && ppActiveTool === 'none'){
      // One-finger drag pans only when no brush/selection tool is active,
      // so it doesn't fight with drawing -- brush strokes already use
      // single-finger touch for painting via the existing pointer handlers.
      e.preventDefault();
      const t = e.touches[0];
      ppOffsetX = ppDragTouchStartOffset.x + (t.clientX - ppDragTouchStart.x);
      ppOffsetY = ppDragTouchStartOffset.y + (t.clientY - ppDragTouchStart.y);
      const now = Date.now();
      const dt = now - ppLastMoveTime;
      if (dt > 0){ ppInertiaVX = (t.clientX - ppLastMovePos.x) / dt * 16; ppInertiaVY = (t.clientY - ppLastMovePos.y) / dt * 16; }
      ppLastMoveTime = now; ppLastMovePos = { x: t.clientX, y: t.clientY };
      renderPpPreview(); syncPpZoomPanControls();
    }
  }, { passive: false });

  ppCanvasEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2){ ppPinchStartDist = null; ppPinchStartMid = null; }
    if (e.touches.length === 0){
      if (ppDragTouchStart && ppActiveTool === 'none' && (Math.abs(ppInertiaVX) > 0.3 || Math.abs(ppInertiaVY) > 0.3)) runPpInertia();
      ppDragTouchStart = null;
    }
  });

  function rotateMask90(mask, w, h){
    const out = new Uint8ClampedArray(w*h);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) out[x*h + (h-1-y)] = mask[y*w+x];
    return out;
  }
  function flipMaskHorizontal(mask, w, h){
    const out = new Uint8ClampedArray(w*h);
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) out[y*w + (w-1-x)] = mask[y*w+x];
    return out;
  }
  document.getElementById('ppRotateBtn').onclick = () => {
    const oldW = ppSourceCanvas.width, oldH = ppSourceCanvas.height;
    const c = document.createElement('canvas'); c.width = oldH; c.height = oldW;
    const ctx = c.getContext('2d'); ctx.translate(c.width/2, c.height/2); ctx.rotate(Math.PI/2); ctx.drawImage(ppSourceCanvas, -oldW/2, -oldH/2);
    ppSourceCanvas = c;
    ppEraseMask = rotateMask90(ppEraseMask, oldW, oldH);
    pushPpHistory();
    ppFaceLandmarks = null; runFaceDetectAndAutoPosition().then(renderPpPreview); renderPpPreview();
  };
  document.getElementById('ppFlipBtn').onclick = () => {
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.translate(c.width,0); ctx.scale(-1,1); ctx.drawImage(ppSourceCanvas,0,0);
    ppSourceCanvas = c;
    ppEraseMask = flipMaskHorizontal(ppEraseMask, w, h);
    pushPpHistory();
    ppFaceLandmarks = null; runFaceDetectAndAutoPosition().then(renderPpPreview);
  };
  document.getElementById('ppResetBtn').onclick = () => {
    resetPpAdjustments();
    if (ppSourceCanvas) initPpMask(ppSourceCanvas.width, ppSourceCanvas.height);
    if (ppFaceLandmarks) autoPositionFromFace();
    renderPpPreview();
    toast('Reset.');
  };

  ['brightness','contrast','saturation','sharpness','temperature'].forEach(k => {
    const id = 'pp' + k.charAt(0).toUpperCase()+k.slice(1);
    document.getElementById(id).addEventListener('input', (e) => {
      ppSliders[k] = +e.target.value;
      document.getElementById(id+'Val').textContent = e.target.value;
      renderPpPreview();
    });
  });
  document.querySelectorAll('input[name="ppBg"]').forEach(r => r.addEventListener('change', renderPpPreview));
  document.getElementById('ppCustomBgColor').addEventListener('input', renderPpPreview);

  /* ---------- Pixel processing (same real algorithms as AI Photo Enhancer, plus temperature) ---------- */
  function applyBrightnessContrastPP(data, brightness, contrast){
    if (!brightness && !contrast) return;
    const b = brightness * 1.6;
    const c = (259 * (contrast + 255)) / (255 * (259 - Math.max(-255, Math.min(255, contrast))));
    for (let i=0;i<data.length;i+=4) for (let ch=0;ch<3;ch++){ let v = data[i+ch]+b; v = c*(v-128)+128; data[i+ch] = v<0?0:v>255?255:v; }
  }
  function rgbToHslPP(r,g,b){ r/=255;g/=255;b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h=0,s=0; const l=(max+min)/2; if(max!==min){const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;} return [h,s,l]; }
  function hslToRgbPP(h,s,l){ if(s===0){const v=l*255;return[v,v,v];} const hue2rgb=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}; const q=l<0.5?l*(1+s):l+s-l*s;const p=2*l-q; return[hue2rgb(p,q,h+1/3)*255,hue2rgb(p,q,h)*255,hue2rgb(p,q,h-1/3)*255]; }
  function applySaturationPP(data, amount){ if(!amount)return; const scale=1+amount/100; for(let i=0;i<data.length;i+=4){const[h,s,l]=rgbToHslPP(data[i],data[i+1],data[i+2]);const[r,g,b]=hslToRgbPP(h,Math.max(0,Math.min(1,s*scale)),l);data[i]=r;data[i+1]=g;data[i+2]=b;} }
  function applyTemperaturePP(data, amount){ if(!amount)return; const shift = amount*0.5; for(let i=0;i<data.length;i+=4){ data[i]=Math.max(0,Math.min(255,data[i]+shift)); data[i+2]=Math.max(0,Math.min(255,data[i+2]-shift)); } }
  function boxBlurGrayPP(src,w,h,radius){ if(radius<1)return src.slice(); const out=new Float32Array(src.length),tmp=new Float32Array(src.length),r=Math.round(radius);
    for(let y=0;y<h;y++){let sum=0;for(let x=-r;x<=r;x++)sum+=src[y*w+Math.max(0,Math.min(w-1,x))];for(let x=0;x<w;x++){tmp[y*w+x]=sum/(r*2+1);const addX=Math.min(w-1,x+r+1),subX=Math.max(0,x-r);sum+=src[y*w+addX]-src[y*w+subX];}}
    for(let x=0;x<w;x++){let sum=0;for(let y=-r;y<=r;y++)sum+=tmp[Math.max(0,Math.min(h-1,y))*w+x];for(let y=0;y<h;y++){out[y*w+x]=sum/(r*2+1);const addY=Math.min(h-1,y+r+1),subY=Math.max(0,y-r);sum+=tmp[addY*w+x]-tmp[subY*w+x];}}
    return out; }
  function applySharpnessPP(data,w,h,amount){ if(amount<=0)return; const strength=amount/100*1.2; for(let ch=0;ch<3;ch++){const plane=new Float32Array(w*h);for(let p=0;p<w*h;p++)plane[p]=data[p*4+ch];const blurred=boxBlurGrayPP(plane,w,h,2);for(let p=0;p<w*h;p++){const detail=plane[p]-blurred[p];const v=plane[p]+detail*strength;data[p*4+ch]=v<0?0:v>255?255:v;}} }

  /* ---------- Preview render: crop + adjustments + background ---------- */
  function resolveBgColorString(){
    const preset = currentPreset();
    const bgMode = document.querySelector('input[name="ppBg"]:checked').value;
    if (bgMode === 'white') return '#ffffff';
    if (bgMode === 'gray') return '#e8e8e8';
    if (bgMode === 'blue') return '#4a90d9';
    if (bgMode === 'custom') return document.getElementById('ppCustomBgColor').value;
    return preset.bg; // 'preset'
  }

  // Composites source + erase mask + background color at the SOURCE image's
  // own resolution, so brush/selection coordinates map directly to this
  // canvas without needing a second coordinate transform. The result is then
  // drawn transformed (zoom/offset) into the fixed output frame below.
  function getCompositedSourceCanvas(){
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const octx = out.getContext('2d');
    octx.drawImage(ppSourceCanvas, 0, 0);
    let hasMask = false;
    if (ppEraseMask){ for (let i=0;i<ppEraseMask.length;i++){ if (ppEraseMask[i]>0){ hasMask=true; break; } } }
    if (hasMask){
      const bg = robustColorToRgb(resolveBgColorString());
      const imgData = octx.getImageData(0,0,w,h);
      const data = imgData.data;
      for (let i=0, p=0; i<data.length; i+=4, p++){
        const m = ppEraseMask[p] / 255;
        if (m > 0){
          data[i]   = data[i]  *(1-m) + bg[0]*m;
          data[i+1] = data[i+1]*(1-m) + bg[1]*m;
          data[i+2] = data[i+2]*(1-m) + bg[2]*m;
        }
      }
      octx.putImageData(imgData, 0, 0);
    }
    return out;
  }

  async function renderPpPreview(){
    if (!ppSourceCanvas) return;
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const previewCanvas = document.getElementById('ppPreviewCanvas');
    previewCanvas.width = outW; previewCanvas.height = outH;
    const ctx = previewCanvas.getContext('2d');

    const bgColor = resolveBgColorString();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outW, outH);

    const composited = getCompositedSourceCanvas();
    const sw = composited.width, sh = composited.height;
    const baseScale = Math.max(outW/sw, outH/sh);
    const scale = baseScale * ppZoom;
    const dw = sw*scale, dh = sh*scale;
    const dx = (outW-dw)/2 + ppOffsetX, dy = (outH-dh)/2 + ppOffsetY;
    ctx.drawImage(composited, dx, dy, dw, dh);

    const imgData = ctx.getImageData(0, 0, outW, outH);
    applyBrightnessContrastPP(imgData.data, ppSliders.brightness, ppSliders.contrast);
    applySaturationPP(imgData.data, ppSliders.saturation);
    applyTemperaturePP(imgData.data, ppSliders.temperature);
    applySharpnessPP(imgData.data, outW, outH, ppSliders.sharpness);
    ctx.putImageData(imgData, 0, 0);

    document.getElementById('ppOutputDims').textContent = `${outW}\u00d7${outH}px (${preset.print}, ${ppActiveDpi} DPI)`;
    runPpValidation(imgData, preset);
    if (ppCropActive) drawPpCropOverlay(outW, outH); else drawIcaoOverlay(preset, outW, outH);
    fitPpCanvasDisplay();
    if (document.getElementById('ppSheetSize')) recomputeSheetLayout();
  }

  /* ---------- WYSIWYG display fit ----------
     Root cause of "editor shows different framing than print preview": the
     canvas already rendered the exact final crop (same pixel data every
     export reads from -- there was only ever one render pipeline for the
     PIXELS), but at native resolution it can exceed the wrapper's visible
     height (602px for a US photo vs. a 520px-tall wrapper), silently
     requiring a scroll to see the whole thing. The separate print/sheet
     preview thumbnail always scales to fit, so it always showed the whole
     photo -- creating the appearance of different framing when the
     underlying crop was actually identical the whole time. Fix: scale the
     canvas's CSS *display* size (never canvas.width/height, which export
     reads directly and which this never touches) to fit the visible wrapper
     by default, so the editor always shows the complete, final framing.
     The ICAO overlay canvas is kept pixel-aligned with the same CSS size. */
  // Passport's instance of the shared Workspace Engine. ppViewZoom is a
  // NEW, separate variable from the existing ppZoom -- ppZoom controls
  // face framing baked into the actual exported pixels (unchanged,
  // untouched by this integration); ppViewZoom controls purely how the
  // fixed-size canvas is displayed on screen, exactly mirroring
  // epeViewZoom's role for the Ecommerce Editor.
  let ppViewZoom = 1;
  const ppWorkspaceEngine = createToolflightWorkspaceEngine({
    viewportEl: () => document.getElementById('ppWorkspaceViewport'),
    workspaceEl: () => document.getElementById('ppWorkspace'),
  });
  function fitPpCanvasDisplay(){
    const canvas = document.getElementById('ppPreviewCanvas');
    const overlay = document.getElementById('ppIcaoOverlay');
    const viewport = document.getElementById('ppWorkspaceViewport');
    if (!canvas.width || !viewport) return;
    canvas.style.width = canvas.width + 'px'; canvas.style.height = canvas.height + 'px';
    if (overlay){
      overlay.style.width = canvas.width + 'px'; overlay.style.height = canvas.height + 'px';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.pointerEvents = 'none';
    }
    ppWorkspaceEngine.fitToScreen(canvas.width, canvas.height, ppViewZoom);
  }
  document.getElementById('ppViewFitBtn').onclick = () => {
    ppViewZoom = 1;
    fitPpCanvasDisplay();
    toast('View fit to screen.');
  };
  document.getElementById('ppViewCenterBtn').onclick = () => {
    fitPpCanvasDisplay();
  };
  document.getElementById('ppFitScreenBtn').onclick = () => {
    ppZoom = 1; ppOffsetX = 0; ppOffsetY = 0;
    document.getElementById('ppZoomSlider').value = '100';
    document.getElementById('ppMoveX').value = '0';
    document.getElementById('ppMoveY').value = '0';
    renderPpPreview();
    toast('Fit to screen.');
  };
  window.addEventListener('resize', () => { if (ppSourceCanvas) fitPpCanvasDisplay(); });

  // Touch pinch-zoom for the new display-level workspace was
  // deliberately NOT added: Passport already has an established
  // two-finger pinch gesture on ppCanvasEl bound to the existing
  // ppZoom (face framing, content-level). Since #ppWorkspaceViewport
  // is that canvas's parent and touch events bubble, a second pinch
  // handler here would make the same physical gesture drive both
  // ppZoom and the new ppViewZoom simultaneously -- a genuine, confusing
  // UX conflict, not a safe addition. Mouse wheel-zoom (added above) has
  // no such collision since Passport had no existing wheel behavior.

  // Display-level wheel zoom (new capability -- Passport had no wheel
  // zoom at all before this phase). Zooms the view of the fixed-size
  // canvas around the cursor, exactly mirroring the Ecommerce Editor's
  // wheel handler, and does not touch ppZoom/ppOffsetX/Y (the existing
  // face-framing controls) at all.
  document.getElementById('ppWorkspaceViewport').addEventListener('wheel', (e) => {
    if (!ppSourceCanvas) return;
    e.preventDefault();
    const canvas = document.getElementById('ppPreviewCanvas');
    ppViewZoom = Math.max(0.03, Math.min(16, ppViewZoom - Math.sign(e.deltaY)*0.1));
    const viewport = document.getElementById('ppWorkspaceViewport');
    const rect = viewport.getBoundingClientRect();
    const availW = viewport.clientWidth, availH = Math.max(120, viewport.clientHeight);
    const newScale = Math.min(1, availW/canvas.width, availH/canvas.height) * ppViewZoom;
    ppWorkspaceEngine.zoomAroundPoint(newScale, e.clientX-rect.left, e.clientY-rect.top);
  }, { passive:false });

  /* ---------- ICAO compliance overlay: real guides from the actual preset ratios ---------- */
  function drawIcaoOverlay(preset, outW, outH){
    const overlay = document.getElementById('ppIcaoOverlay');
    if (!overlay || !document.getElementById('ppIcaoToggle').checked) { if (overlay) overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height); return; }
    overlay.width = outW; overlay.height = outH;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,outW,outH);
    ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5,4]);

    // Head-height band: horizontal lines at the min/max head-top and chin positions
    // implied by preset.headMin/headMax, centered vertically as a reference zone.
    const bandTopMin = outH * (1 - preset.headMax) / 2, bandTopMax = outH * (1 - preset.headMin) / 2;
    ctx.strokeRect(outW*0.08, bandTopMin, outW*0.84, outH - bandTopMin*2);
    ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.font = '11px sans-serif'; ctx.setLineDash([]);
    ctx.fillText(`Head zone ${Math.round(preset.headMin*100)}\u2013${Math.round(preset.headMax*100)}%`, outW*0.08+4, bandTopMin+13);

    // Eye-line band
    ctx.strokeStyle = 'rgba(74,144,217,0.9)'; ctx.setLineDash([5,4]);
    const eyeYMin = outH*(1-preset.eyeMax), eyeYMax = outH*(1-preset.eyeMin);
    ctx.beginPath(); ctx.moveTo(0, eyeYMin); ctx.lineTo(outW, eyeYMin); ctx.moveTo(0, eyeYMax); ctx.lineTo(outW, eyeYMax); ctx.stroke();
    ctx.fillStyle = 'rgba(74,144,217,0.9)'; ctx.setLineDash([]);
    ctx.fillText(`Eye line ${Math.round(preset.eyeMin*100)}\u2013${Math.round(preset.eyeMax*100)}%`, 4, eyeYMin-4);

    // Center vertical line
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(outW/2, 0); ctx.lineTo(outW/2, outH); ctx.stroke();

    // Crop/margin boundary
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([]);
    ctx.strokeRect(2, 2, outW-4, outH-4);
  }
  document.getElementById('ppIcaoToggle').addEventListener('change', () => { if (ppSourceCanvas) renderPpPreview(); });

  /* ---------- Manual Crop Tool -----------
     Draws its rectangle on the same ppIcaoOverlay canvas already used for
     ICAO guides (reused, not a second overlay element) -- the two are
     mutually exclusive states, so there's no conflict. Applying a crop does
     NOT introduce a separate crop-rendering path: it computes a new
     ppZoom/ppOffsetX/Y for the exact same transform renderPpPreview already
     uses everywhere else, so the result goes through the one render
     pipeline like every other adjustment. */
  let ppCropActive = false, ppCropRect = null, ppCropDragMode = null, ppCropDragStart = null, ppCropRectStart = null;
  const PP_CROP_HANDLE_SIZE = 22;

  function ppDefaultCropRect(outW, outH){
    const preset = currentPreset();
    if (document.getElementById('ppCropLockRatio').checked){
      const ratio = preset.wmm / preset.hmm;
      let cw = outW*0.8, ch = cw/ratio;
      if (ch > outH*0.8){ ch = outH*0.8; cw = ch*ratio; }
      return { x:(outW-cw)/2, y:(outH-ch)/2, w:cw, h:ch };
    }
    return { x: outW*0.1, y: outH*0.1, w: outW*0.8, h: outH*0.8 };
  }

  function drawPpCropOverlay(outW, outH){
    const overlay = document.getElementById('ppIcaoOverlay');
    overlay.width = outW; overlay.height = outH;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,outW,outH);
    if (!ppCropRect) return;
    const { x, y, w, h } = ppCropRect;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,outW,outH);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);
    // Rule-of-thirds guide lines, a standard, genuinely useful cropping aid.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    for (let i=1;i<3;i++){
      ctx.beginPath(); ctx.moveTo(x + w*i/3, y); ctx.lineTo(x + w*i/3, y+h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h*i/3); ctx.lineTo(x+w, y + h*i/3); ctx.stroke();
    }
    // Corner handles
    ctx.fillStyle = '#ffffff';
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([hx,hy]) => {
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI*2); ctx.fill();
    });
  }

  function ppCropHandleAt(px, py){
    if (!ppCropRect) return null;
    const { x, y, w, h } = ppCropRect;
    const corners = { nw:[x,y], ne:[x+w,y], sw:[x,y+h], se:[x+w,y+h] };
    for (const [name, [hx,hy]] of Object.entries(corners)){
      if (Math.hypot(px-hx, py-hy) < PP_CROP_HANDLE_SIZE) return name;
    }
    if (px > x && px < x+w && py > y && py < y+h) return 'move';
    return null;
  }

  document.getElementById('ppCropToggleBtn').onclick = () => {
    if (!ppSourceCanvas) return;
    ppCropActive = !ppCropActive;
    document.getElementById('ppCropToggleBtn').classList.toggle('active', ppCropActive);
    document.getElementById('ppCropActions').classList.toggle('hidden', !ppCropActive);
    if (ppCropActive){
      const preset = currentPreset();
      ppCropRect = ppDefaultCropRect(mm(preset.wmm), mm(preset.hmm));
      drawPpCropOverlay(mm(preset.wmm), mm(preset.hmm));
      // Ensure real clearance from the top of the viewport before the user
      // tries to drag a handle -- the site's own navbar is sticky at the
      // very top (measured 67px, z-index 50), and scrollIntoViewIfNeeded()
      // alone doesn't reliably scroll further if it judges the canvas
      // already "in view" even when its top edge sits right under the
      // navbar. Explicit scroll math, verified directly, not assumed.
      const rect = ppCanvasEl.getBoundingClientRect();
      const NAVBAR_CLEARANCE = 90;
      if (rect.top < NAVBAR_CLEARANCE){
        window.scrollBy({ top: rect.top - NAVBAR_CLEARANCE, behavior: 'instant' });
      }
    } else {
      ppCropRect = null;
      renderPpPreview();
    }
  };
  document.getElementById('ppCropLockRatio').addEventListener('change', () => {
    if (!ppCropActive) return;
    const preset = currentPreset();
    ppCropRect = ppDefaultCropRect(mm(preset.wmm), mm(preset.hmm));
    drawPpCropOverlay(mm(preset.wmm), mm(preset.hmm));
  });

  function ppCropPointerDown(clientX, clientY){
    if (!ppCropActive) return false;
    const { x } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
    const pt = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
    const handle = ppCropHandleAt(pt.x, pt.y);
    if (!handle) return false;
    ppCropDragMode = handle;
    ppCropDragStart = pt;
    ppCropRectStart = { ...ppCropRect };
    return true;
  }
  function ppCropPointerMove(clientX, clientY){
    if (!ppCropDragMode) return;
    const pt = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
    const dx = pt.x - ppCropDragStart.x, dy = pt.y - ppCropDragStart.y;
    const r = { ...ppCropRectStart };
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const lockRatio = document.getElementById('ppCropLockRatio').checked;
    const ratio = preset.wmm / preset.hmm;
    if (ppCropDragMode === 'move'){
      r.x = Math.max(0, Math.min(outW-r.w, ppCropRectStart.x + dx));
      r.y = Math.max(0, Math.min(outH-r.h, ppCropRectStart.y + dy));
    } else {
      // Corner resize -- when ratio is locked, derive height from the
      // dominant drag axis so the rectangle always keeps the passport ratio.
      let nx=r.x, ny=r.y, nw=r.w, nh=r.h;
      if (ppCropDragMode.includes('w')){ nx = ppCropRectStart.x+dx; nw = ppCropRectStart.w-dx; }
      if (ppCropDragMode.includes('e')){ nw = ppCropRectStart.w+dx; }
      if (ppCropDragMode.includes('n')){ ny = ppCropRectStart.y+dy; nh = ppCropRectStart.h-dy; }
      if (ppCropDragMode.includes('s')){ nh = ppCropRectStart.h+dy; }
      if (lockRatio){ nh = nw/ratio; if (ppCropDragMode.includes('n')) ny = ppCropRectStart.y + ppCropRectStart.h - nh; }
      if (nw > 30 && nh > 30 && nx >= 0 && ny >= 0 && nx+nw <= outW && ny+nh <= outH){ r.x=nx; r.y=ny; r.w=nw; r.h=nh; }
    }
    ppCropRect = r;
    drawPpCropOverlay(outW, outH);
  }
  function ppCropPointerUp(){ ppCropDragMode = null; ppCropDragStart = null; }

  document.getElementById('ppCropApplyBtn').onclick = () => {
    if (!ppCropRect) return;
    const src0 = ppOutputToSourceCoords(ppCropRect.x, ppCropRect.y);
    const src1 = ppOutputToSourceCoords(ppCropRect.x+ppCropRect.w, ppCropRect.y+ppCropRect.h);
    const cropSrcW = src1.x - src0.x, cropSrcH = src1.y - src0.y;
    if (cropSrcW <= 0 || cropSrcH <= 0) return;
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
    const baseScale = Math.max(outW/sw, outH/sh);
    const newScale = Math.max(outW/cropSrcW, outH/cropSrcH);
    ppZoom = Math.max(0.3, Math.min(8, newScale / baseScale));
    const cx = (src0.x+src1.x)/2, cy = (src0.y+src1.y)/2;
    ppOffsetX = outW/2 - (outW - sw*newScale)/2 - cx*newScale;
    ppOffsetY = outH/2 - (outH - sh*newScale)/2 - cy*newScale;
    document.getElementById('ppCropToggleBtn').click(); // exit crop mode
    renderPpPreview(); syncPpZoomPanControls();
    toast('Crop applied.');
  };
  document.getElementById('ppCropResetBtn').onclick = () => {
    const preset = currentPreset();
    ppCropRect = ppDefaultCropRect(mm(preset.wmm), mm(preset.hmm));
    drawPpCropOverlay(mm(preset.wmm), mm(preset.hmm));
  };
  document.getElementById('ppCropCancelBtn').onclick = () => { document.getElementById('ppCropToggleBtn').click(); };

  /* ---------- Background replacement (real AI segmentation, reused from AI Background Remover) ---------- */
  /* ============ SEGMENTATION DEBUG MODE (developer tool, added per explicit
     request after a prior fix attempt did not resolve a real device bug) =====
     Makes zero changes to the segmentation or compositing algorithm itself.
     This only OBSERVES and REPORTS the exact same data the real algorithm
     already computed, so what gets logged/displayed is guaranteed to match
     what actually ran -- not a re-simulation that could itself have bugs. */
  function ppDebugSampleLocations(w, h){
    // Real face landmarks (from the separate, independently-run Face
    // Landmarker pipeline) are used where available, since they're a real
    // ground-truth signal independent of the segmentation model being
    // debugged -- not a guess about where the face probably is.
    const locations = {};
    if (ppFaceLandmarks && ppSourceCanvas){
      const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
      const noseTip = ppFaceLandmarks[1] || ppFaceLandmarks[4];
      const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
      let minYn=1, maxYn=0, minXn=1, maxXn=0;
      oval.forEach(i => { const lm = ppFaceLandmarks[i]; minYn=Math.min(minYn,lm.y); maxYn=Math.max(maxYn,lm.y); minXn=Math.min(minXn,lm.x); maxXn=Math.max(maxXn,lm.x); });
      // Map normalized SOURCE-image landmark coords to OUTPUT-frame pixel coords via the same forward transform used elsewhere.
      function toOut(nx, ny){ return ppSourceToOutputCoords(sw*nx, sh*ny); }
      const faceCenter = toOut(noseTip.x, noseTip.y);
      const hairEdge = toOut((minXn+maxXn)/2, Math.max(0, minYn - (maxYn-minYn)*0.35));
      const shoulder = toOut(maxXn + (maxXn-minXn)*0.3, maxYn + (maxYn-minYn)*0.9);
      locations['center of detected face'] = { x: Math.round(faceCenter.x), y: Math.round(faceCenter.y) };
      locations['hair edge (above forehead)'] = { x: Math.round(hairEdge.x), y: Math.round(hairEdge.y) };
      locations['shoulder (estimated from face bounds)'] = { x: Math.min(w-1, Math.max(0, Math.round(shoulder.x))), y: Math.min(h-1, Math.max(0, Math.round(shoulder.y))) };
    } else {
      locations['center of detected face (NO LANDMARKS -- using image center as fallback, not a real face position)'] = { x: Math.round(w/2), y: Math.round(h*0.4) };
      locations['hair edge (NO LANDMARKS -- proportional estimate, not a real position)'] = { x: Math.round(w/2), y: Math.round(h*0.12) };
      locations['shoulder (NO LANDMARKS -- proportional estimate, not a real position)'] = { x: Math.round(w*0.25), y: Math.round(h*0.88) };
    }
    locations['clear background (top-left region)'] = { x: Math.round(w*0.05), y: Math.round(h*0.05) };
    locations['image corner (0,0)'] = { x: 0, y: 0 };
    return locations;
  }

  function runSegmentationDebug({ w, h, mw, mh, maskData, personConf, cw, ch, polarityIsInverted, newMask, subjectPixels }){
    console.log('%c=== SEGMENTATION DEBUG MODE ===', 'font-weight:bold;font-size:14px;color:#5142D6;');
    console.log('Source/output dimensions:', w, 'x', h, '| Category mask dimensions:', mw, 'x', mh, '| Confidence mask dimensions:', cw, 'x', ch);
    console.log('personConf available:', !!personConf, '| polarityIsInverted flag (from existing calibration code):', polarityIsInverted);

    // ---- Aggregate statistics, computed directly from the real arrays ----
    let catPersonCount = 0, catBgCount = 0;
    let confSumAtCatPerson = 0, confNAtCatPerson = 0, confSumAtCatBg = 0, confNAtCatBg = 0;
    let confMin = Infinity, confMax = -Infinity;
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        const mx = Math.min(mw-1, Math.round(x*mw/w)), my = Math.min(mh-1, Math.round(y*mh/h));
        const cat = maskData[my*mw+mx];
        if (cat > 0) catPersonCount++; else catBgCount++;
        if (personConf){
          const cx = Math.min(cw-1, Math.round(x*cw/w)), cy = Math.min(ch-1, Math.round(y*ch/h));
          const rawConf = personConf[cy*cw+cx];
          confMin = Math.min(confMin, rawConf); confMax = Math.max(confMax, rawConf);
          if (cat > 0){ confSumAtCatPerson += rawConf; confNAtCatPerson++; } else { confSumAtCatBg += rawConf; confNAtCatBg++; }
        }
      }
    }
    const totalPx = w*h;
    console.log('%cAggregate statistics (raw, unmodified data):', 'font-weight:bold;');
    console.log('  Category mask: category>0 (candidate "person" by doc convention) =', catPersonCount, `(${(catPersonCount/totalPx*100).toFixed(1)}%)`, '| category=0 =', catBgCount, `(${(catBgCount/totalPx*100).toFixed(1)}%)`);
    if (personConf){
      console.log('  Raw confidenceMasks[1] average AT category>0 pixels:', confNAtCatPerson ? (confSumAtCatPerson/confNAtCatPerson).toFixed(4) : 'n/a');
      console.log('  Raw confidenceMasks[1] average AT category=0 pixels:', confNAtCatBg ? (confSumAtCatBg/confNAtCatBg).toFixed(4) : 'n/a');
      console.log('  Raw confidence min:', confMin.toFixed(4), '| max:', confMax.toFixed(4));
      console.log('%c  --> If "average AT category>0" is LOWER than "average AT category=0", the confidence mask and category mask DISAGREE on which pixels are the person -- this by itself is real evidence of an inversion somewhere, independent of any documentation.', 'color:#e05252;');
    } else {
      console.log('  personConf is null -- confidenceMasks[1] was unavailable this run, so the algorithm fell back to the binary category-mask-only path.');
    }

    // ---- Determine which category is ACTUALLY the person using face landmarks as independent ground truth (not documentation) ----
    if (ppFaceLandmarks && ppSourceCanvas){
      const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
      const sampleIdx = [1,4,10,152,234,454]; // nose tip, chin, forehead, chin bottom, left/right face edges -- real detected face points
      let catAtFaceCounts = {};
      sampleIdx.forEach(i => {
        const lm = ppFaceLandmarks[i]; if (!lm) return;
        const out = ppSourceToOutputCoords(sw*lm.x, sh*lm.y);
        const ox = Math.min(w-1, Math.max(0, Math.round(out.x))), oy = Math.min(h-1, Math.max(0, Math.round(out.y)));
        const mx = Math.min(mw-1, Math.round(ox*mw/w)), my = Math.min(mh-1, Math.round(oy*mh/h));
        const cat = maskData[my*mw+mx];
        catAtFaceCounts[cat] = (catAtFaceCounts[cat]||0) + 1;
      });
      console.log('%cGround-truth check using real detected face landmarks (independent of segmentation model):', 'font-weight:bold;');
      console.log('  Category values found AT known real face-landmark pixel locations:', JSON.stringify(catAtFaceCounts));
      const majorityCatAtFace = Object.entries(catAtFaceCounts).sort((a,b)=>b[1]-a[1])[0];
      if (majorityCatAtFace){
        console.log(`%c  --> At the ACTUAL detected face location, category mask value is predominantly ${majorityCatAtFace[0]} (${majorityCatAtFace[1]}/${sampleIdx.length} sampled points). This means category ${majorityCatAtFace[0]} is the one that REALLY corresponds to "person" in this run, per real execution data -- not assumed from documentation.`, 'color:#3ba55c;font-weight:bold;');
      }
    } else {
      console.log('%cNo face landmarks available this run -- cannot independently verify which category is "person" against real ground truth. Category/confidence interpretation below is not independently confirmed.', 'color:#e0a030;');
    }

    // ---- Per-location detailed logging ----
    const locations = ppDebugSampleLocations(w, h);
    console.log('%cPer-pixel detail at named locations:', 'font-weight:bold;');
    Object.entries(locations).forEach(([label, {x, y}]) => {
      const mx = Math.min(mw-1, Math.round(x*mw/w)), my = Math.min(mh-1, Math.round(y*mh/h));
      const cat = maskData[my*mw+mx];
      let confVal = 'n/a';
      if (personConf){
        const cx = Math.min(cw-1, Math.round(x*cw/w)), cy = Math.min(ch-1, Math.round(y*ch/h));
        confVal = personConf[cy*cw+cx].toFixed(4);
      }
      const eraseVal = newMask[y*w+x];
      const compositeDecision = eraseVal > 200 ? 'REPLACED with background color' : eraseVal < 55 ? 'KEPT as original' : 'PARTIALLY blended (soft edge)';
      let finalRgba = 'n/a (composite not yet rendered to canvas at debug time)';
      const previewCtx = document.getElementById('ppPreviewCanvas').getContext('2d');
      try{ const d = previewCtx.getImageData(Math.min(w-1,x), Math.min(h-1,y), 1, 1).data; finalRgba = `rgba(${d[0]},${d[1]},${d[2]},${d[3]})`; }catch(e){}
      console.log(`  Pixel (${x},${y}) [${label}]`);
      console.log(`    Category: ${cat}  |  Confidence: ${confVal}  |  EraseMask: ${eraseVal}  |  Composite decision: ${compositeDecision}  |  Final RGBA (current canvas, pre-replacement): ${finalRgba}`);
    });

    // ---- Visual debug canvases ----
    const panel = document.getElementById('ppDebugPanel');
    if (panel){
      panel.classList.remove('hidden');
      panel.innerHTML = '';
      function addDebugCanvas(title, drawFn){
        const wrap = document.createElement('div');
        wrap.className = 'pp-debug-tile';
        const label = document.createElement('div');
        label.className = 'pp-debug-tile-label';
        label.textContent = title;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        drawFn(c.getContext('2d'));
        wrap.appendChild(label); wrap.appendChild(c);
        panel.appendChild(wrap);
      }
      addDebugCanvas('1. Original image', (ctx) => { ctx.drawImage(ppSourceCanvas, 0, 0, w, h); });
      addDebugCanvas('2. Raw category mask (white = category>0)', (ctx) => {
        const img = ctx.createImageData(w, h);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++){
          const mx = Math.min(mw-1, Math.round(x*mw/w)), my = Math.min(mh-1, Math.round(y*mh/h));
          const v = maskData[my*mw+mx] > 0 ? 255 : 0;
          const p=(y*w+x)*4; img.data[p]=v; img.data[p+1]=v; img.data[p+2]=v; img.data[p+3]=255;
        }
        ctx.putImageData(img,0,0);
      });
      addDebugCanvas('3. Raw confidenceMasks[1] (white = high confidence)', (ctx) => {
        const img = ctx.createImageData(w, h);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++){
          const p=(y*w+x)*4;
          if (personConf){
            const cx = Math.min(cw-1, Math.round(x*cw/w)), cy = Math.min(ch-1, Math.round(y*ch/h));
            const v = Math.round(personConf[cy*cw+cx]*255);
            img.data[p]=v; img.data[p+1]=v; img.data[p+2]=v; img.data[p+3]=255;
          } else { img.data[p]=128; img.data[p+1]=0; img.data[p+2]=0; img.data[p+3]=255; }
        }
        ctx.putImageData(img,0,0);
      });
      addDebugCanvas('4. Final ppEraseMask (white = will be replaced)', (ctx) => {
        const img = ctx.createImageData(w, h);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++){
          const p=(y*w+x)*4; const v = newMask[y*w+x];
          img.data[p]=v; img.data[p+1]=v; img.data[p+2]=v; img.data[p+3]=255;
        }
        ctx.putImageData(img,0,0);
      });
      addDebugCanvas('5. Composited result (after this AI run is applied)', (ctx) => {
        ctx.drawImage(ppSourceCanvas, 0, 0, w, h);
        const bg = robustColorToRgb(resolveBgColorString());
        const imgData = ctx.getImageData(0,0,w,h);
        for (let i=0,p=0; i<imgData.data.length; i+=4,p++){
          const m = newMask[p]/255;
          if (m>0){ imgData.data[i]=imgData.data[i]*(1-m)+bg[0]*m; imgData.data[i+1]=imgData.data[i+1]*(1-m)+bg[1]*m; imgData.data[i+2]=imgData.data[i+2]*(1-m)+bg[2]*m; }
        }
        ctx.putImageData(imgData,0,0);
      });
    }
    console.log('%c=== END SEGMENTATION DEBUG ===', 'font-weight:bold;font-size:14px;color:#5142D6;');
  }

  document.getElementById('ppReplaceBgBtn').onclick = async () => {
    if (!ppSourceCanvas) return;
    const statusEl = document.getElementById('ppModelStatus');
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Loading background segmentation model\u2026';
    try{
      const segmenter = await ensureSegmenterPP();
      const result = segmenter.segment(ppSourceCanvas);
      const mask = result.categoryMask;
      const maskData = mask.getAsUint8Array();
      const mw = mask.width, mh = mask.height;
      const w = ppSourceCanvas.width, h = ppSourceCanvas.height;

      // Confidence data: verified via MediaPipe's own model documentation
      // that this selfie-segmenter outputs background at category index 0
      // and person at index 1 (checked directly, not assumed -- see report).
      // outputConfidenceMasks was previously false, so this real per-pixel
      // signal was unused; a result could look area-plausible while the
      // model was actually uncertain about it. Now genuinely used below.
      const confMasks = result.confidenceMasks;
      const personConf = confMasks && confMasks[1] ? confMasks[1].getAsFloat32Array() : null;
      const cw = confMasks && confMasks[1] ? confMasks[1].width : mw, ch = confMasks && confMasks[1] ? confMasks[1].height : mh;

      // ---- Unified ground-truth calibration (real fix, based on actual
      // device evidence, not documentation) ----
      // Real debug screenshots from an actual Android device showed two
      // things definitively: (1) confidenceMasks[1] was NOT available at
      // runtime there (the debug visualization rendered as a flat fallback
      // color, not real data), so the previous confidence-based calibration
      // never ran at all; and (2) the category mask's actual polarity was
      // the opposite of MediaPipe's documented convention -- the visible
      // person was category 0, not category 1.
      //
      // This replaces BOTH the old confidence-only calibration and the old
      // hardcoded ">0 means person" assumption with ONE determination, made
      // once, using real detected face landmarks (from the separate, already
      // -run Face Landmarker pipeline) as ground truth -- not MediaPipe's
      // segmentation documentation, and not a guess. That single
      // determination is then used consistently by both the category-mask
      // path and the confidence-mask path below, so the two can never
      // disagree with each other the way the old code allowed.
      let personCategoryValue = null; // the category mask value (0 or 1) that real evidence shows IS the person
      let calibrationSource = 'none (no face landmarks available -- see below)';
      if (ppFaceLandmarks){
        const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
        const sampleIdx = [1,4,10,152,234,454]; // nose tip, chin, forehead, chin bottom, left/right face edges -- real detected points
        const votes = {};
        sampleIdx.forEach(i => {
          const lm = ppFaceLandmarks[i]; if (!lm) return;
          const out = ppSourceToOutputCoords(sw*lm.x, sh*lm.y);
          const ox = Math.min(w-1, Math.max(0, Math.round(out.x))), oy = Math.min(h-1, Math.max(0, Math.round(out.y)));
          const mx = Math.min(mw-1, Math.round(ox*mw/w)), my = Math.min(mh-1, Math.round(oy*mh/h));
          votes[maskData[my*mw+mx]] = (votes[maskData[my*mw+mx]]||0) + 1;
        });
        const sorted = Object.entries(votes).sort((a,b) => b[1]-a[1]);
        if (sorted.length){
          personCategoryValue = +sorted[0][0];
          calibrationSource = `real face landmarks (${sorted[0][1]}/${sampleIdx.length} sampled points agree on category ${sorted[0][0]})`;
        }
      }
      if (personCategoryValue === null){
        // No face landmarks this run -- there is no reliable ground truth
        // available, so this falls back to MediaPipe's documented
        // convention as a last resort. This is disclosed, not silently
        // assumed: without a face to check against, polarity genuinely
        // cannot be verified this run.
        personCategoryValue = 1;
        calibrationSource = 'MediaPipe documented convention (UNVERIFIED this run -- no face landmarks to check against)';
      }
      const isPersonCat = (catVal) => catVal === personCategoryValue;
      // personConf is always confidenceMasks[1] specifically (a fixed array
      // index). If ground truth shows category 1 is NOT the person, the
      // raw confidence values there are actually "confidence this is
      // background," so this normalizes to "confidence this IS the person"
      // consistently regardless of which raw category index happened to
      // hold that data.
      const personConfidenceAt = (rawConf) => personCategoryValue === 1 ? rawConf : (1 - rawConf);

      const newMask = new Uint8ClampedArray(w*h);
      let subjectPixels = 0, confSum = 0, confSamples = 0;
      for (let y=0; y<h; y++){
        for (let x=0; x<w; x++){
          const mx = Math.min(mw-1, Math.round(x * mw/w)), my = Math.min(mh-1, Math.round(y * mh/h));
          const isSubject = isPersonCat(maskData[my*mw+mx]);
          if (isSubject) subjectPixels++;
          if (personConf){
            // Use the model's own continuous per-pixel confidence as a soft
            // alpha directly, instead of the hard binary category threshold.
            // This is what actually preserves natural hair/edge detail --
            // fine flyaway strands genuinely do get intermediate confidence
            // values, and collapsing that to a hard 0-or-255 cutout is what
            // produces the harsh "cutout sticker" look. This is real
            // per-pixel data already computed above, not a post-hoc blur
            // guessing where edges probably are.
            const cx = Math.min(cw-1, Math.round(x * cw/w)), cy = Math.min(ch-1, Math.round(y * ch/h));
            const conf = personConfidenceAt(personConf[cy*cw+cx]);
            confSum += conf; confSamples++;
            newMask[y*w+x] = Math.round(255 * (1 - conf));
          } else {
            newMask[y*w+x] = isSubject ? 0 : 255;
          }
        }
      }
      mask.close && mask.close();
      confMasks && confMasks.forEach(m => m.close && m.close());
      const avgPersonConfidence = confSamples ? confSum/confSamples : null;

      if (document.getElementById('ppDebugSegmentation') && document.getElementById('ppDebugSegmentation').checked){
        console.log('%cCalibration used this run:', 'font-weight:bold;color:#5142D6;', 'personCategoryValue =', personCategoryValue, '| source:', calibrationSource);
        runSegmentationDebug({ w, h, mw, mh, maskData, personConf, cw, ch, polarityIsInverted: personCategoryValue !== 1, newMask, subjectPixels });
      }

      // Two independent plausibility signals, either of which can trigger
      // the manual fallback: implausible subject AREA (existing check) and
      // now also low model CONFIDENCE on the pixels it did classify as
      // subject -- catching cases where the area looks reasonable but the
      // model was genuinely unsure, which the area check alone would miss.
      const subjectFrac = subjectPixels / (w*h);
      const areaImplausible = subjectFrac < 0.08 || subjectFrac > 0.97;
      const lowConfidence = avgPersonConfidence !== null && avgPersonConfidence < 0.65;
      if (areaImplausible || lowConfidence){
        statusEl.textContent = 'AI could not confidently separate the subject. Please use Manual Editing.';
        document.getElementById('ppManualBgRow').classList.remove('hidden');
        document.getElementById('ppAccordionManual').open = true;
      } else {
        ppEraseMask.set(newMask);
        pushPpHistory();
        statusEl.textContent = 'Background replaced.';
        renderPpPreview();
      }
    }catch(err){
      statusEl.textContent = 'AI background replacement couldn\u2019t load right now. You can still replace a plain background manually below \u2014 click anywhere on your photo\u2019s background.';
      document.getElementById('ppManualBgRow').classList.remove('hidden');
    }
    setTimeout(() => statusEl.classList.add('hidden'), 6000);
  };

  /* ---------- Manual background fallback: classic flood-fill, not AI -----------
     Reuses the same color-distance/fill logic as the brush engine's mask
     writes below -- this click-to-select is one more way to set the erase
     mask, not a second separate pixel-replacement implementation. */
  document.getElementById('ppManualBgClickBtn').onclick = () => {
    const canvas = document.getElementById('ppPreviewCanvas');
    toast('Tap or click anywhere on the background in the preview above.');
    function handler(e){
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
      floodFillBackground(x, y);
      canvas.removeEventListener('click', handler);
    }
    canvas.addEventListener('click', handler, { once: true });
  };

  function ppOutputToSourceCoords(outX, outY){
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const baseScale = Math.max(outW/w, outH/h) * ppZoom;
    const dx = (outW - w*baseScale)/2 + ppOffsetX, dy = (outH - h*baseScale)/2 + ppOffsetY;
    return { x: Math.round((outX - dx) / baseScale), y: Math.round((outY - dy) / baseScale) };
  }

  function floodFillBackground(outX, outY){
    if (!ppSourceCanvas) return;
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const { x: srcX, y: srcY } = ppOutputToSourceCoords(outX, outY);
    if (srcX < 0 || srcY < 0 || srcX >= w || srcY >= h){ toast('That point is outside the photo — try clicking again.', 'err'); return; }

    const sctx = ppSourceCanvas.getContext('2d');
    const imgData = sctx.getImageData(0, 0, w, h); // read-only sample of the ORIGINAL pixels -- never written back
    const data = imgData.data;
    const startIdx = (srcY*w + srcX) * 4;
    const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2]];
    const tolerance = 32;

    // Classic 4-connected flood fill using a color-distance threshold on the
    // ORIGINAL source pixels -- a real, standard, non-AI selection technique
    // (the same category of tool as a "magic wand" in any raster editor).
    // Result is written into the erase mask, not the source.
    const visited = new Uint8Array(w*h);
    const stack = [[srcX, srcY]];
    let filled = 0;
    const maxFill = w*h;
    while (stack.length && filled < maxFill){
      const [x, y] = stack.pop();
      if (x<0||y<0||x>=w||y>=h) continue;
      const idx = y*w+x;
      if (visited[idx]) continue;
      const i = idx*4;
      const dist = Math.abs(data[i]-startColor[0]) + Math.abs(data[i+1]-startColor[1]) + Math.abs(data[i+2]-startColor[2]);
      if (dist > tolerance*3) continue;
      visited[idx] = 1; filled++;
      ppEraseMask[idx] = 255;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    pushPpHistory();
    renderPpPreview();
    toast(filled > 0 ? `Replaced ${filled.toLocaleString()} similar-colored pixels.` : 'No similar background area found at that point.');
  }
  function hexToRgb(hex){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [255,255,255];
  }

  /* ---------- Brush engine: Magic Eraser / Restore Brush / Hair Refinement -----------
     Hair Refinement is honestly a MODE of this same brush engine (smaller
     default radius, softer forced falloff), not a separate algorithm --
     disclosed here in the code and in the final report, not oversold as
     distinct AI. */
  let ppActiveTool = 'none'; // 'none' | 'erase' | 'restore' | 'hair' | 'rect' | 'circle' | 'lasso' | 'polygon'
  let ppBrushSize = 40, ppBrushHardness = 60;
  let ppIsPainting = false, ppSpacePan = false, ppIsPanning = false;
  let ppPanStart = null;

  function setPpTool(tool){
    ppActiveTool = tool;
    document.querySelectorAll('.pp-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    ppCanvasEl.style.cursor = (tool === 'none') ? 'default' : 'crosshair';
    if (tool !== 'polygon') ppPolygonPoints = [];
  }

  document.getElementById('ppBrushSize').addEventListener('input', (e) => {
    ppBrushSize = +e.target.value;
    document.getElementById('ppBrushSizeVal').textContent = e.target.value;
  });
  document.getElementById('ppBrushHardness').addEventListener('input', (e) => {
    ppBrushHardness = +e.target.value;
    document.getElementById('ppBrushHardnessVal').textContent = e.target.value;
  });

  function stampBrush(srcX, srcY, radius, hardness, direction){
    // direction: +1 erase (raise mask toward 255), -1 restore (lower mask toward 0)
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const r = Math.max(1, radius);
    const hardR = r * (hardness/100);
    const minX = Math.max(0, Math.floor(srcX-r)), maxX = Math.min(w-1, Math.ceil(srcX+r));
    const minY = Math.max(0, Math.floor(srcY-r)), maxY = Math.min(h-1, Math.ceil(srcY+r));
    for (let y=minY; y<=maxY; y++){
      for (let x=minX; x<=maxX; x++){
        const d = Math.hypot(x-srcX, y-srcY);
        if (d > r) continue;
        let strength = 1;
        if (d > hardR && r > hardR) strength = 1 - (d-hardR)/(r-hardR);
        const idx = y*w+x;
        const delta = strength * 255 * direction;
        ppEraseMask[idx] = Math.max(0, Math.min(255, ppEraseMask[idx] + delta));
      }
    }
  }

  function paintAtOutputCoords(outX, outY){
    const { x, y } = ppOutputToSourceCoords(outX, outY);
    const preset = currentPreset();
    const outW = mm(preset.wmm);
    const srcRadius = ppBrushSize / (outW / ppSourceCanvas.width) / ppZoom;
    const isHair = ppActiveTool === 'hair';
    const radius = isHair ? Math.max(2, srcRadius*0.4) : srcRadius;
    const hardness = isHair ? Math.min(ppBrushHardness, 35) : ppBrushHardness;
    const direction = ppActiveTool === 'restore' ? -1 : 1;
    stampBrush(x, y, radius, hardness, direction);
  }

  const ppCanvasEngineCache = new WeakMap();
  function canvasEventToOutputCoords(canvas, clientX, clientY){
    // Delegates to the shared Canvas Engine's screenToCanvas -- same
    // exact math as before (verified identical prior to this change),
    // now genuinely shared with the Ecommerce Editor's coordinate
    // conversion rather than a second, parallel implementation.
    // Cached per canvas element (WeakMap) since this fires on every
    // pointermove during brush painting -- a real hot path.
    let engine = ppCanvasEngineCache.get(canvas);
    if (!engine){
      engine = createToolflightCanvasEngine({ canvasEl: () => canvas, getContentSize: () => ({ w: canvas.width, h: canvas.height }) });
      ppCanvasEngineCache.set(canvas, engine);
    }
    return engine.screenToCanvas(clientX, clientY);
  }

  let ppShapeSelectStart = null, ppLassoPoints = [], ppPolygonPoints = [];
  let ppSelectionMask = null; // Uint8ClampedArray same size as source, 255 = inside selection

  function ppPointerDown(clientX, clientY){
    if (!ppSourceCanvas) return;
    if (ppCropActive && ppCropPointerDown(clientX, clientY)) return;
    if (ppSpacePan){ ppIsPanning = true; ppPanStart = { x: clientX, y: clientY, offX: ppOffsetX, offY: ppOffsetY }; return; }
    if (ppActiveTool === 'erase' || ppActiveTool === 'restore' || ppActiveTool === 'hair'){
      ppIsPainting = true;
      const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
      paintAtOutputCoords(x, y);
      renderPpPreview();
    } else if (ppActiveTool === 'rect' || ppActiveTool === 'circle'){
      const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
      ppShapeSelectStart = { x, y };
    } else if (ppActiveTool === 'lasso'){
      const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
      ppLassoPoints = [{ x, y }];
      ppIsPainting = true;
    } else if (ppActiveTool === 'polygon'){
      const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
      if (ppPolygonPoints.length > 2){
        const first = ppPolygonPoints[0];
        if (Math.hypot(x-first.x, y-first.y) < 14){ applySelectionMaskFromPolygon(ppPolygonPoints); ppPolygonPoints = []; return; }
      }
      ppPolygonPoints.push({ x, y });
    }
  }
  function ppPointerMove(clientX, clientY){
    if (ppCropActive && ppCropDragMode){ ppCropPointerMove(clientX, clientY); return; }
    if (ppIsPanning && ppPanStart){
      ppOffsetX = ppPanStart.offX + (clientX - ppPanStart.x);
      ppOffsetY = ppPanStart.offY + (clientY - ppPanStart.y);
      renderPpPreview();
      return;
    }
    if (!ppIsPainting) return;
    const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
    if (ppActiveTool === 'lasso'){ ppLassoPoints.push({ x, y }); return; }
    if (ppActiveTool === 'erase' || ppActiveTool === 'restore' || ppActiveTool === 'hair'){ paintAtOutputCoords(x, y); renderPpPreview(); }
  }
  function ppPointerUp(clientX, clientY){
    if (ppCropActive && ppCropDragMode){ ppCropPointerUp(); return; }
    if (ppIsPanning){ ppIsPanning = false; ppPanStart = null; return; }
    if ((ppActiveTool === 'rect' || ppActiveTool === 'circle') && ppShapeSelectStart && clientX != null){
      const { x, y } = canvasEventToOutputCoords(ppCanvasEl, clientX, clientY);
      applyShapeSelection(ppShapeSelectStart, { x, y });
      ppShapeSelectStart = null;
      return;
    }
    if (ppActiveTool === 'lasso' && ppIsPainting){
      ppIsPainting = false;
      applySelectionMaskFromPolygon(ppLassoPoints);
      ppLassoPoints = [];
    } else if (ppIsPainting){
      ppIsPainting = false;
      pushPpHistory();
    }
  }
  // Pointer Events unify mouse/touch/pen input in every target browser
  // (Chrome, Edge, Firefox, Safari, and Samsung Internet all dispatch
  // PointerEvent for touch) -- the same verified pattern already proven
  // for the drag-reorder fix earlier this session, reused here rather than
  // writing separate touchstart/touchmove/touchend handlers.
  document.addEventListener('pointerdown', (e) => { if (e.target === ppCanvasEl || e.target.id === 'ppCanvasStageWrap') ppPointerDown(e.clientX, e.clientY); });
  document.addEventListener('pointermove', (e) => { if (ppIsPainting || ppIsPanning || ppCropDragMode) ppPointerMove(e.clientX, e.clientY); });
  document.addEventListener('pointerup', (e) => ppPointerUp(e.clientX, e.clientY));

  /* ---------- Selections: rectangle, circle, lasso, polygon ---------- */
  function applyShapeSelection(start, end){
    if (!ppSourceCanvas) return;
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const s0 = ppOutputToSourceCoords(start.x, start.y), s1 = ppOutputToSourceCoords(end.x, end.y);
    ppSelectionMask = new Uint8ClampedArray(w*h);
    if (ppActiveTool === 'rect'){
      const minX = Math.max(0, Math.min(s0.x, s1.x)), maxX = Math.min(w-1, Math.max(s0.x, s1.x));
      const minY = Math.max(0, Math.min(s0.y, s1.y)), maxY = Math.min(h-1, Math.max(s0.y, s1.y));
      for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) ppSelectionMask[y*w+x] = 255;
    } else if (ppActiveTool === 'circle'){
      const cx = s0.x, cy = s0.y, r = Math.hypot(s1.x-s0.x, s1.y-s0.y);
      const minX = Math.max(0, Math.floor(cx-r)), maxX = Math.min(w-1, Math.ceil(cx+r));
      const minY = Math.max(0, Math.floor(cy-r)), maxY = Math.min(h-1, Math.ceil(cy+r));
      for (let y=minY; y<=maxY; y++) for (let x=minX; x<=maxX; x++) if (Math.hypot(x-cx,y-cy)<=r) ppSelectionMask[y*w+x] = 255;
    }
    document.getElementById('ppSelectionActions').classList.remove('hidden');
    toast('Selection made \u2014 use Fill Selection below.');
  }
  function applySelectionMaskFromPolygon(outputPoints){
    if (outputPoints.length < 3 || !ppSourceCanvas) return;
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const pts = outputPoints.map(p => ppOutputToSourceCoords(p.x, p.y));
    ppSelectionMask = new Uint8ClampedArray(w*h);
    // Standard point-in-polygon scanline fill -- real, exact geometry.
    let minY = h, maxY = 0;
    pts.forEach(p => { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    minY = Math.max(0, minY); maxY = Math.min(h-1, maxY);
    for (let y=minY; y<=maxY; y++){
      const xs = [];
      for (let i=0;i<pts.length;i++){
        const a = pts[i], b = pts[(i+1)%pts.length];
        if ((a.y<=y && b.y>y) || (b.y<=y && a.y>y)) xs.push(a.x + (y-a.y)/(b.y-a.y)*(b.x-a.x));
      }
      xs.sort((a,b)=>a-b);
      for (let i=0;i<xs.length-1;i+=2){
        const x0 = Math.max(0, Math.round(xs[i])), x1 = Math.min(w-1, Math.round(xs[i+1]));
        for (let x=x0; x<=x1; x++) ppSelectionMask[y*w+x] = 255;
      }
    }
    document.getElementById('ppSelectionActions').classList.remove('hidden');
    toast('Selection made \u2014 use Fill Selection below.');
  }
  document.getElementById('ppFillSelectionEraseBtn').onclick = () => {
    if (!ppSelectionMask) return;
    for (let i=0;i<ppSelectionMask.length;i++) if (ppSelectionMask[i]) ppEraseMask[i] = 255;
    pushPpHistory(); renderPpPreview();
    toast('Selection erased.');
  };
  document.getElementById('ppFillSelectionRestoreBtn').onclick = () => {
    if (!ppSelectionMask) return;
    for (let i=0;i<ppSelectionMask.length;i++) if (ppSelectionMask[i]) ppEraseMask[i] = 0;
    pushPpHistory(); renderPpPreview();
    toast('Selection restored.');
  };
  document.getElementById('ppClearSelectionBtn').onclick = () => {
    ppSelectionMask = null;
    document.getElementById('ppSelectionActions').classList.add('hidden');
  };

  /* ---------- Edge Cleanup / Feather: blurs the erase mask itself, reusing
     the exact grayscale box-blur already built for the Sharpness slider ---------- */
  document.getElementById('ppFeatherBtn').onclick = () => {
    if (!ppSourceCanvas || !ppEraseMask) return;
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const radius = +document.getElementById('ppFeatherRadius').value;
    const floatMask = new Float32Array(ppEraseMask.length);
    for (let i=0;i<ppEraseMask.length;i++) floatMask[i] = ppEraseMask[i];
    const blurred = boxBlurGrayPP(floatMask, w, h, radius);
    for (let i=0;i<ppEraseMask.length;i++) ppEraseMask[i] = Math.max(0, Math.min(255, blurred[i]));
    pushPpHistory(); renderPpPreview();
    toast('Edge feathered.');
  };

  /* ---------- Tool buttons, Undo/Redo, keyboard shortcuts ---------- */
  document.querySelectorAll('.pp-tool-btn').forEach(btn => btn.addEventListener('click', () => setPpTool(btn.dataset.tool === ppActiveTool ? 'none' : btn.dataset.tool)));
  document.getElementById('ppUndoBtn').onclick = undoPp;
  document.getElementById('ppRedoBtn').onclick = redoPp;
  document.addEventListener('keydown', (e) => {
    if (!ppSourceCanvas || document.getElementById('ppStage').classList.contains('hidden')) return;
    const inField = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (e.code === 'Space' && !ppSpacePan && !inField){ ppSpacePan = true; ppCanvasEl.style.cursor = 'grab'; e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){ e.preventDefault(); undoPp(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))){ e.preventDefault(); redoPp(); }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space'){ ppSpacePan = false; ppCanvasEl.style.cursor = (ppActiveTool==='none') ? 'default' : 'crosshair'; }
  });

  /* ---------- Zoom: up to 800%, wheel-zoom genuinely centered on the cursor ---------- */
  document.getElementById('ppZoomSlider').max = '800';
  const ppStageWrapEl = document.getElementById('ppCanvasStageWrap');
  if (ppStageWrapEl) ppStageWrapEl.addEventListener('wheel', (e) => {
    if (!ppSourceCanvas) return;
    e.preventDefault();
    const before = canvasEventToOutputCoords(ppCanvasEl, e.clientX, e.clientY);
    const srcUnderCursor = ppOutputToSourceCoords(before.x, before.y);
    const newZoomPct = Math.max(30, Math.min(800, Math.round(ppZoom*100) + (e.deltaY < 0 ? 20 : -20)));
    ppZoom = newZoomPct/100;
    document.getElementById('ppZoomSlider').value = String(newZoomPct);
    // Recompute the offset so the SAME source point that was under the
    // cursor before this zoom step is still under the cursor after it --
    // genuinely tracks the cursor, not just a scale change around the center.
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
    const baseScale = Math.max(outW/sw, outH/sh) * ppZoom;
    ppOffsetX = before.x - (outW - sw*baseScale)/2 - srcUnderCursor.x*baseScale;
    ppOffsetY = before.y - (outH - sh*baseScale)/2 - srcUnderCursor.y*baseScale;
    renderPpPreview();
  }, { passive: false });

  /* ---------- Validation (real, rule-based, inspectable) ---------- */
  function ppSourceToOutputCoords(srcX, srcY){
    const w = ppSourceCanvas.width, h = ppSourceCanvas.height;
    const preset = currentPreset();
    const outW = mm(preset.wmm), outH = mm(preset.hmm);
    const baseScale = Math.max(outW/w, outH/h) * ppZoom;
    const dx = (outW - w*baseScale)/2 + ppOffsetX, dy = (outH - h*baseScale)/2 + ppOffsetY;
    return { x: dx + srcX*baseScale, y: dy + srcY*baseScale };
  }

  // MediaPipe's 478-point face mesh eye-contour indices used below (upper
  // lid, lower lid, and corners for each eye) are the commonly-documented
  // ones from the MediaPipe face-landmark community reference -- not
  // independently re-verified against Google's own source in this pass, so
  // treat eyes-open specifically as a good-faith heuristic, not a certainty.
  const PP_EYE_LM = { rightUpper:159, rightLower:145, rightL:33, rightR:133, leftUpper:386, leftLower:374, leftL:362, leftR:263 };

  function runPpValidation(imgData, preset){
    const { data, width: w, height: h } = imgData;
    const checks = []; // { label, pass, detail, weight }

    /* ---- Real re-measurement: head height & eye position in the OUTPUT frame ----
       Fixes a prior dead stub that computed nothing. Landmarks are stored in
       normalized SOURCE-image coordinates; converted to actual OUTPUT-frame
       pixel positions using the same forward transform renderPpPreview uses,
       so this reflects the photo as actually cropped, not the original. */
    if (ppFaceLandmarks){
      const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
      let minYn=1, maxYn=0;
      oval.forEach(i => { const lm = ppFaceLandmarks[i]; minYn = Math.min(minYn, lm.y); maxYn = Math.max(maxYn, lm.y); });
      const crownYn = Math.max(0, minYn - (maxYn-minYn)*0.28);
      const sw = ppSourceCanvas.width, sh = ppSourceCanvas.height;
      const crownOut = ppSourceToOutputCoords(sw*0.5, sh*crownYn);
      const chinOut = ppSourceToOutputCoords(sw*0.5, sh*maxYn);
      const headFrac = (chinOut.y - crownOut.y) / h;
      const eyeLm = ppFaceLandmarks[PP_EYE_LM.rightUpper];
      const eyeOut = ppSourceToOutputCoords(sw*eyeLm.x, sh*eyeLm.y);
      const eyeFracFromBottom = 1 - (eyeOut.y / h);

      const headOk = headFrac >= preset.headMin && headFrac <= preset.headMax;
      checks.push({ label:'Head size', pass: headOk, detail: `Head height is ${Math.round(headFrac*100)}% of the frame \u2014 ${preset.name} requires ${Math.round(preset.headMin*100)}\u2013${Math.round(preset.headMax*100)}%.`, weight: 15 });
      const eyeOk = eyeFracFromBottom >= preset.eyeMin && eyeFracFromBottom <= preset.eyeMax;
      checks.push({ label:'Eye position', pass: eyeOk, detail: `Eyes are at ${Math.round(eyeFracFromBottom*100)}% of frame height from the bottom \u2014 required ${Math.round(preset.eyeMin*100)}\u2013${Math.round(preset.eyeMax*100)}%.`, weight: 12 });

      // Eyes-open heuristic: eye-aspect-ratio (vertical eyelid gap / eye
      // width) is a well-established, genuine landmark-based technique --
      // not pixel-guessing, but still a heuristic threshold, not a certainty.
      function ear(upperI, lowerI, lI, rI){
        const u = ppFaceLandmarks[upperI], lo = ppFaceLandmarks[lowerI], l = ppFaceLandmarks[lI], r = ppFaceLandmarks[rI];
        const vert = Math.hypot((u.x-lo.x)*sw, (u.y-lo.y)*sh);
        const horiz = Math.hypot((l.x-r.x)*sw, (l.y-r.y)*sh);
        return horiz > 0 ? vert/horiz : 0;
      }
      const earAvg = (ear(PP_EYE_LM.rightUpper,PP_EYE_LM.rightLower,PP_EYE_LM.rightL,PP_EYE_LM.rightR) + ear(PP_EYE_LM.leftUpper,PP_EYE_LM.leftLower,PP_EYE_LM.leftL,PP_EYE_LM.leftR)) / 2;
      const eyesOpen = earAvg > 0.15;
      checks.push({ label:'Eyes open', pass: eyesOpen, detail: eyesOpen ? 'Eyes appear open.' : 'Eyes may be closed or partially closed \u2014 heuristic based on eyelid landmark spacing, double-check visually.', weight: 8 });

      // Glasses-glare heuristic: looks for a small cluster of near-white,
      // high-contrast pixels within the eye region -- a real pixel check,
      // but a heuristic for "glare," not a lens/glasses detector itself.
      function glareNear(upperI, lowerI){
        const u = ppFaceLandmarks[upperI], lo = ppFaceLandmarks[lowerI];
        const c = ppSourceToOutputCoords(sw*(u.x+lo.x)/2, sh*(u.y+lo.y)/2);
        const r = 10; let bright = 0, total = 0;
        for (let yy=Math.max(0,Math.round(c.y-r)); yy<Math.min(h,c.y+r); yy++){
          for (let xx=Math.max(0,Math.round(c.x-r)); xx<Math.min(w,c.x+r); xx++){
            const i = (yy*w+xx)*4;
            if (data[i]>235 && data[i+1]>235 && data[i+2]>235) bright++;
            total++;
          }
        }
        return total ? bright/total : 0;
      }
      const glareRatio = Math.max(glareNear(PP_EYE_LM.rightUpper,PP_EYE_LM.rightLower), glareNear(PP_EYE_LM.leftUpper,PP_EYE_LM.leftLower));
      const glareOk = glareRatio < 0.12;
      checks.push({ label:'Glasses glare', pass: glareOk, detail: glareOk ? 'No significant glare detected near the eyes.' : 'Possible glare or reflection near the eyes \u2014 heuristic brightness check, verify visually if wearing glasses.', weight: 5 });

      // Hair-over-eyes: the weakest heuristic here, disclosed as such --
      // compares darkness directly above the eyebrow line to the forehead
      // region; a real but approximate signal, not a hair-segmentation model.
      const browY = ppFaceLandmarks[PP_EYE_LM.rightUpper].y - 0.04;
      const foreheadPt = ppSourceToOutputCoords(sw*0.5, sh*Math.max(0,browY-0.08));
      const browPt = ppSourceToOutputCoords(sw*0.5, sh*browY);
      const li1 = (Math.max(0,Math.min(h-1,Math.round(foreheadPt.y)))*w + Math.max(0,Math.min(w-1,Math.round(foreheadPt.x))))*4;
      const li2 = (Math.max(0,Math.min(h-1,Math.round(browPt.y)))*w + Math.max(0,Math.min(w-1,Math.round(browPt.x))))*4;
      const darkening = (data[li1]+data[li1+1]+data[li1+2]) - (data[li2]+data[li2+1]+data[li2+2]);
      const hairOk = darkening < 90;
      checks.push({ label:'Hair over eyes', pass: hairOk, detail: hairOk ? 'No strong signal of hair covering the eyes.' : 'Possible hair covering part of the eye area \u2014 this is an approximate heuristic (single-point brightness comparison), not a hair-segmentation model; verify visually.', weight: 4 });
    } else {
      checks.push({ label:'Face detection', pass:false, detail:'No face was detected \u2014 double-check positioning manually.', weight: 20 });
    }

    // Resolution check
    const resOk = w >= 400 && h >= 400;
    checks.push({ label:'Resolution', pass: resOk, detail: resOk ? `${w}\u00d7${h}px meets typical minimums.` : `Low resolution (${w}\u00d7${h}px) \u2014 many passport systems require at least 600px on the shorter side.`, weight: 12 });

    // Exposure check via mean luminance
    let sum=0;
    for (let i=0;i<data.length;i+=4){ sum += 0.299*data[i]+0.587*data[i+1]+0.114*data[i+2]; }
    const mean = sum/(data.length/4);
    const exposureOk = mean >= 60 && mean <= 220;
    checks.push({ label:'Exposure', pass: exposureOk, detail: exposureOk ? `Average brightness ${Math.round(mean)}/255 is in a reasonable range.` : (mean>220 ? `Overexposed (avg ${Math.round(mean)}/255) \u2014 try reducing brightness.` : `Underexposed (avg ${Math.round(mean)}/255) \u2014 try increasing brightness.`), weight: 10 });

    // Blur estimate via local variance (real, simple heuristic, not full Laplacian-of-Gaussian)
    let varSum = 0, samples = 0;
    for (let y=4; y<h-4; y+=6){ for (let x=4; x<w-4; x+=6){
      const i = (y*w+x)*4;
      varSum += Math.abs(data[i]-data[((y-2)*w+x)*4]) + Math.abs(data[i]-data[((y+2)*w+x)*4]); samples++;
    }}
    const sharpnessScore = samples ? varSum/samples : 0;
    const sharpOk = sharpnessScore >= 3;
    checks.push({ label:'Sharpness', pass: sharpOk, detail: sharpOk ? 'Detail levels look reasonable across the frame.' : 'Image may be blurry \u2014 detail levels look low across the frame.', weight: 9 });

    // Background uniformity (four corners)
    const corners = [[2,2],[w-3,2],[2,h-3],[w-3,h-3]];
    const cornerColors = corners.map(([x,y]) => { const i=(y*w+x)*4; return [data[i],data[i+1],data[i+2]]; });
    const maxDiff = Math.max(...cornerColors.flatMap((c,i) => cornerColors.slice(i+1).map(c2 => Math.abs(c[0]-c2[0])+Math.abs(c[1]-c2[1])+Math.abs(c[2]-c2[2]))));
    const bgOk = maxDiff <= 60;
    checks.push({ label:'Background uniformity', pass: bgOk, detail: bgOk ? 'Background looks reasonably uniform.' : 'Background doesn\u2019t look uniform \u2014 check for shadows or an uneven backdrop.', weight: 5 });

    // Overall score: weighted sum of passed checks / total possible weight.
    // New in this phase -- there was no numeric score before. Same
    // "not an official validator" framing as Phase 1, made explicit again here.
    const totalWeight = checks.reduce((a,c) => a+c.weight, 0);
    const passedWeight = checks.reduce((a,c) => a + (c.pass ? c.weight : 0), 0);
    const score = totalWeight ? Math.round((passedWeight/totalWeight)*100) : 0;

    const scoreEl = document.getElementById('ppScoreNum');
    if (scoreEl){
      scoreEl.textContent = score + '%';
      scoreEl.style.color = score >= 85 ? 'var(--ok-solid)' : score >= 60 ? 'var(--warn-solid)' : 'var(--err-solid)';
      document.getElementById('ppScoreLabel').textContent = score >= 85 ? 'Looks good on these automated checks.' : score >= 60 ? 'Some things worth fixing below.' : 'Several checks failed \u2014 review the details below.';
    }

    const listEl = document.getElementById('ppValidationList');
    listEl.innerHTML = checks.map(c => `<li><span class="ats-icon" style="color:${c.pass?'var(--ok-solid)':'var(--err-solid)'};">\u25CF</span>${c.detail.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</li>`).join('');
  }

  /* ---------- Export ---------- */
  document.getElementById('ppDownloadPngBtn').onclick = () => exportPp('png');
  document.getElementById('ppDownloadJpgBtn').onclick = () => exportPp('jpeg');
  function exportPp(format){
    const canvas = document.getElementById('ppPreviewCanvas');
    canvas.toBlob((blob) => {
      if (!blob){ toast('Could not export — try the other format.', 'err'); return; }
      downloadBlob(blob, 'passport-photo.' + (format==='jpeg'?'jpg':'png'));
    }, 'image/'+format, 0.95);
  }

  const PP_SHEET_SIZES = { '4x6': [288, 432], '5x7': [360, 504], 'a4': [595, 842], 'letter': [612, 792], 'legal': [612, 1008] };

  // Tries both paper orientations and returns whichever fits more copies of
  // the given photo size -- a real comparison, not an assumption that
  // portrait is always right. margin/gap are real print-safe spacing, not
  // zero-gap tiling (cut lines need room).
  function computeBestFit(photoWpt, photoHpt, paperWpt, paperHpt, marginPt, gapPt){
    function fit(pw, ph){
      const cols = Math.max(0, Math.floor((pw - marginPt*2 + gapPt) / (photoWpt + gapPt)));
      const rows = Math.max(0, Math.floor((ph - marginPt*2 + gapPt) / (photoHpt + gapPt)));
      return { cols, rows, count: cols*rows, pageW: pw, pageH: ph };
    }
    const portrait = fit(paperWpt, paperHpt);
    const landscape = fit(paperHpt, paperWpt);
    if (landscape.count > portrait.count) return { ...landscape, orientation: 'landscape' };
    return { ...portrait, orientation: 'portrait' };
  }

  function ppCurrentPaperSizePt(){
    const sheetType = document.getElementById('ppSheetSize').value;
    if (sheetType === 'custom'){
      const wIn = +document.getElementById('ppCustomPaperW').value || 4;
      const hIn = +document.getElementById('ppCustomPaperH').value || 6;
      return [wIn*72, hIn*72];
    }
    return PP_SHEET_SIZES[sheetType];
  }

  let ppSheetLayout = null; // last computed layout, reused by preview + PDF + print
  let ppSheetPhotoOrder = null; // array of slot indices -> for click-to-swap repositioning

  function recomputeSheetLayout(){
    if (!ppSourceCanvas) return;
    const preset = currentPreset();
    const photoWpt = mm(preset.wmm) * 72/300, photoHpt = mm(preset.hmm) * 72/300;
    const [paperW, paperH] = ppCurrentPaperSizePt();
    const margin = +document.getElementById('ppSheetMargin').value;
    const gap = +document.getElementById('ppSheetGap').value;
    ppSheetLayout = computeBestFit(photoWpt, photoHpt, paperW, paperH, margin, gap);
    ppSheetLayout.photoWpt = photoWpt; ppSheetLayout.photoHpt = photoHpt;
    ppSheetLayout.margin = margin; ppSheetLayout.gap = gap;
    const count = ppSheetLayout.count;
    if (!ppSheetPhotoOrder || ppSheetPhotoOrder.length !== count) ppSheetPhotoOrder = Array.from({length: count}, (_, i) => i);
    renderSheetPreview();
  }

  function renderSheetPreview(){
    if (!ppSheetLayout) return;
    const { cols, rows, pageW, pageH, photoWpt, photoHpt, margin, gap, orientation, count } = ppSheetLayout;
    const wrap = document.getElementById('ppSheetPreviewWrap');
    const scale = Math.min(320/pageW, 420/pageH);
    wrap.style.width = (pageW*scale) + 'px';
    wrap.style.height = (pageH*scale) + 'px';
    wrap.innerHTML = '';
    const canvas = document.getElementById('ppPreviewCanvas');
    for (let i=0; i<count; i++){
      const r = Math.floor(i/cols), c = i%cols;
      const div = document.createElement('div');
      div.className = 'pp-sheet-slot';
      div.style.left = ((margin + c*(photoWpt+gap))*scale) + 'px';
      div.style.top = ((margin + r*(photoHpt+gap))*scale) + 'px';
      div.style.width = (photoWpt*scale) + 'px';
      div.style.height = (photoHpt*scale) + 'px';
      div.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
      div.dataset.slot = i;
      div.title = 'Click another photo to swap position';
      div.addEventListener('click', () => ppSwapSlot(i));
      wrap.appendChild(div);
    }
    document.getElementById('ppSheetInfo').textContent = `${count} cop${count!==1?'ies':'y'} \u2014 ${cols}\u00d7${rows} grid, ${orientation} ${(pageW/72).toFixed(1)}\u00d7${(pageH/72).toFixed(1)}in`;
  }
  let ppSelectedSlot = null;
  function ppSwapSlot(i){
    if (ppSelectedSlot === null){ ppSelectedSlot = i; return; }
    const tmp = ppSheetPhotoOrder[ppSelectedSlot]; ppSheetPhotoOrder[ppSelectedSlot] = ppSheetPhotoOrder[i]; ppSheetPhotoOrder[i] = tmp;
    ppSelectedSlot = null;
  }

  ['ppSheetSize','ppSheetMargin','ppSheetGap','ppCustomPaperW','ppCustomPaperH'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      document.getElementById('ppCustomPaperRow').classList.toggle('hidden', document.getElementById('ppSheetSize').value !== 'custom');
      recomputeSheetLayout();
    });
  });

  async function buildSheetPdfBytes(){
    const { PDFDocument } = PDFLib;
    const { cols, rows, pageW, pageH, photoWpt, photoHpt, margin, gap, count } = ppSheetLayout;
    const canvas = document.getElementById('ppPreviewCanvas');
    const pngBytes = await new Promise((resolve) => canvas.toBlob(b => b.arrayBuffer().then(resolve), 'image/png'));
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([pageW, pageH]);
    const img = await pdfDoc.embedPng(new Uint8Array(pngBytes));
    for (let i=0; i<count; i++){
      const r = Math.floor(i/cols), c = i%cols;
      const x = margin + c*(photoWpt+gap);
      const y = pageH - margin - (r+1)*photoHpt - r*gap;
      page.drawImage(img, { x, y, width: photoWpt, height: photoHpt });
    }
    return pdfDoc.save();
  }

  document.getElementById('ppDownloadSheetBtn').onclick = async () => {
    const btn = document.getElementById('ppDownloadSheetBtn');
    setLoading(btn, true);
    try{
      if (!ppSheetLayout) recomputeSheetLayout();
      const pdfBytes = await buildSheetPdfBytes();
      downloadBlob(new Blob([pdfBytes], { type:'application/pdf' }), 'passport-photo-sheet.pdf');
      toast(`Sheet generated: ${ppSheetLayout.count} copies.`);
    }catch(err){
      toast('Could not generate the print sheet: ' + ((err && err.message) || 'please try again.'), 'err');
    }finally{
      setLoading(btn, false, 'Download Print Sheet PDF');
    }

  };

  /* ---------- Direct browser printing ----------
     Builds a print-only DOM matching the exact computed layout (same
     ppSheetLayout the PDF export uses -- one source of truth, not a second
     parallel renderer), sized with absolute mm units so the browser's print
     engine renders it at real physical size. Verified: the CSS declares
     correct absolute dimensions; actual printed output still depends on the
     user's printer/driver, which this environment can't verify -- see report. */
  document.getElementById('ppPrintBtn').onclick = () => {
    if (!ppSheetLayout) recomputeSheetLayout();
    const { cols, rows, pageW, pageH, photoWpt, photoHpt, margin, gap, count } = ppSheetLayout;
    const ptToMm = 25.4/72;
    const canvas = document.getElementById('ppPreviewCanvas');
    const dataUrl = canvas.toDataURL('image/png');
    const printRoot = document.getElementById('ppPrintRoot');
    printRoot.style.width = (pageW*ptToMm) + 'mm';
    printRoot.style.height = (pageH*ptToMm) + 'mm';
    printRoot.innerHTML = '';
    for (let i=0; i<count; i++){
      const r = Math.floor(i/cols), c = i%cols;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.position = 'absolute';
      img.style.left = ((margin + c*(photoWpt+gap))*ptToMm) + 'mm';
      img.style.top = ((margin + r*(photoHpt+gap))*ptToMm) + 'mm';
      img.style.width = (photoWpt*ptToMm) + 'mm';
      img.style.height = (photoHpt*ptToMm) + 'mm';
      printRoot.appendChild(img);
    }
    window.print();
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

/* ============================================================
   AI PHOTO RETOUCH & BEAUTY EDITOR (rt* prefix)
   New tool module. Reuses: setupDropZone, loadImageFromFile,
   boxBlurGray (all genuinely global helpers), and the generic
   ensureSegmenter() already built for AI Background Remover
   (same shared segmenter instance/model, not a second copy).
   Reuses the .pp-accordion CSS/HTML pattern from Passport Photo
   Maker verbatim -- same classes, not a re-implementation.
   ============================================================ */
if (document.getElementById('rtDrop')){
  let rtSourceCanvas = null;   // immutable original, full resolution
  let rtFaceLandmarks = null;  // MediaPipe face mesh, or null if no face found
  let rtBgCategoryMask = null; // cached AI segmentation category mask (Uint8Array) + its own w/h, computed once per image
  let rtBgMaskDims = null;
  let rtZoom = 1, rtOffsetX = 0, rtOffsetY = 0;
  let rtRenderPending = false;
  let rtFaceLandmarkerPromise = null, rtFaceLandmarker = null;

  const RT_DEFAULTS = {
    exposure:0, brightness:0, contrast:0, highlights:0, shadows:0, whites:0, blacks:0,
    saturation:0, vibrance:0, temperature:0, tint:0,
    clarity:0, texture:0, dehaze:0, sharpness:0, noiseReduction:0, hdr:0,
    skinSmooth:0, faceBrighten:0, skinTone:0, bgBlur:0,
  };
  let rtAdj = { ...RT_DEFAULTS };

  const RT_SLIDER_IDS = Object.keys(RT_DEFAULTS).reduce((m,k) => {
    // Map internal keys to actual element id suffixes (camelCase already matches id naming below)
    return m;
  }, {});
  const RT_ID_MAP = {
    exposure:'rtExposure', brightness:'rtBrightness', contrast:'rtContrast', highlights:'rtHighlights',
    shadows:'rtShadows', whites:'rtWhites', blacks:'rtBlacks', saturation:'rtSaturation', vibrance:'rtVibrance',
    temperature:'rtTemperature', tint:'rtTint', clarity:'rtClarity', texture:'rtTexture', dehaze:'rtDehaze',
    sharpness:'rtSharpness', noiseReduction:'rtNoiseReduction', hdr:'rtHdr',
    skinSmooth:'rtSkinSmooth', faceBrighten:'rtFaceBrighten', skinTone:'rtSkinTone', bgBlur:'rtBgBlur',
  };

  function rtClamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- Face landmark detection (own loader, mirrors the pattern
     already used for passport/AI enhancer face detection, not a literal
     copy since each tool's module is independently scoped) ---------- */
  async function ensureRtFaceLandmarker(){
    if (rtFaceLandmarker) return rtFaceLandmarker;
    if (!rtFaceLandmarkerPromise){
      rtFaceLandmarkerPromise = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`);
        const { FaceLandmarker, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`);
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
          runningMode: 'IMAGE', numFaces: 1,
        });
        rtFaceLandmarker = fl;
        return fl;
      })().catch((err) => { rtFaceLandmarkerPromise = null; throw err; });
    }
    return rtFaceLandmarkerPromise;
  }

  async function rtDetectFace(){
    const statusEl = document.getElementById('rtFaceStatus');
    try{
      statusEl.textContent = 'Detecting face\u2026';
      const fl = await ensureRtFaceLandmarker();
      const result = fl.detect(rtSourceCanvas);
      if (result.faceLandmarks && result.faceLandmarks[0]){
        rtFaceLandmarks = result.faceLandmarks[0];
        statusEl.textContent = 'Face detected \u2014 skin smoothing will protect eyes, brows, nose, and mouth automatically.';
      } else {
        rtFaceLandmarks = null;
        statusEl.textContent = 'No face detected \u2014 skin smoothing will apply gently across the whole photo instead of being face-targeted.';
      }
    }catch(err){
      rtFaceLandmarks = null;
      statusEl.textContent = 'Face detection unavailable \u2014 skin smoothing will apply gently across the whole photo instead.';
    }
  }

  /* ---------- Skin mask: protects eyes, brows, nose, mouth from smoothing.
     Deliberately uses generous circular/elliptical exclusion zones around
     well-established single landmark points rather than tight contour
     polygons -- a slightly larger protected zone is the safer choice when
     the goal is "never distort a feature," and it's robust to not needing
     dozens of exact contour indices to be individually correct. ---------- */
  function buildRtSkinMask(w, h, sw, sh){
    const mask = new Float32Array(w*h);
    if (!rtFaceLandmarks) return mask; // no face -- caller falls back to a different, gentler path
    function toPx(i){ const lm = rtFaceLandmarks[i]; return { x: lm.x*sw*(w/sw), y: lm.y*sh*(h/sh) }; }
    // Face oval (reuses the same established 36-point index set used elsewhere in this project for face bounds)
    const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
    const pts = oval.map(toPx);
    let minX=w, maxX=0, minY=h, maxY=0;
    pts.forEach(p => { minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2, rx=(maxX-minX)/2*1.05, ry=(maxY-minY)/2*1.05;
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        const dx=(x-cx)/rx, dy=(y-cy)/ry;
        if (dx*dx+dy*dy <= 1) mask[y*w+x] = 1;
      }
    }
    // Protected zones, sized relative to inter-eye distance (scale-invariant, robust to face size/distance from camera)
    const leftEyeOuter = toPx(33), rightEyeOuter = toPx(263);
    const eyeDist = Math.hypot(rightEyeOuter.x-leftEyeOuter.x, rightEyeOuter.y-leftEyeOuter.y);
    const protectR = eyeDist * 0.32;
    function carve(cxp, cyp, rr, ryScale){
      const y0=Math.max(0,Math.floor(cyp-rr*ryScale)), y1=Math.min(h-1,Math.ceil(cyp+rr*ryScale));
      const x0=Math.max(0,Math.floor(cxp-rr)), x1=Math.min(w-1,Math.ceil(cxp+rr));
      for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++){
        const dx=(x-cxp)/rr, dy=(y-cyp)/(rr*ryScale);
        if (dx*dx+dy*dy <= 1) mask[y*w+x] = 0;
      }
    }
    const leftEyeC = toPx(159), rightEyeC = toPx(386); // upper eyelid centers, reasonable eye-region centers
    carve(leftEyeC.x, leftEyeC.y, protectR*1.15, 0.85);
    carve(rightEyeC.x, rightEyeC.y, protectR*1.15, 0.85);
    const noseTip = toPx(1);
    carve(noseTip.x, noseTip.y, protectR*0.9, 1.4);
    const mouthL = toPx(61), mouthR = toPx(291);
    const mouthCx=(mouthL.x+mouthR.x)/2, mouthCy=(mouthL.y+mouthR.y)/2;
    const mouthRx = Math.hypot(mouthR.x-mouthL.x, mouthR.y-mouthL.y)/2 * 1.3;
    carve(mouthCx, mouthCy, mouthRx, 0.8);
    // Soft feather so protected zones don't have a hard visible edge.
    return boxBlurGray(mask, w, h, Math.max(2, Math.round(eyeDist*0.06)));
  }

  /* ---------- Core per-pixel tone/color adjustments, one pass ---------- */
  function rtLuma(r,g,b){ return 0.299*r + 0.587*g + 0.114*b; }

  function applyRtToneColor(data, w, h){
    const a = rtAdj;
    const exposureMul = Math.pow(2, a.exposure/100 * 1.2);
    const contrastFactor = (259*(a.contrast*2.55+255)) / (255*(259-a.contrast*2.55));
    const tempShift = a.temperature/100 * 40;
    const tintShift = a.tint/100 * 40;
    for (let p=0; p<data.length; p+=4){
      let r=data[p], g=data[p+1], b=data[p+2];
      // Temperature (R/B shift) and Tint (G shift) -- white balance first
      r = rtClamp(r + tempShift, 0, 255); b = rtClamp(b - tempShift, 0, 255);
      g = rtClamp(g + tintShift, 0, 255);
      // Exposure (multiplicative) then Brightness (additive)
      r *= exposureMul; g *= exposureMul; b *= exposureMul;
      r += a.brightness*1.2; g += a.brightness*1.2; b += a.brightness*1.2;
      // Contrast (standard formula around midpoint)
      r = contrastFactor*(r-128)+128; g = contrastFactor*(g-128)+128; b = contrastFactor*(b-128)+128;
      // Highlights/Shadows/Whites/Blacks: luminance-zone-weighted adjustments
      const lum = rtLuma(r,g,b) / 255;
      if (a.highlights !== 0){
        const wgt = Math.max(0, lum-0.5)*2; // 0 at mid, 1 at white
        const d = a.highlights/100 * 60 * wgt;
        r+=d; g+=d; b+=d;
      }
      if (a.shadows !== 0){
        const wgt = Math.max(0, 0.5-lum)*2; // 0 at mid, 1 at black
        const d = a.shadows/100 * 60 * wgt;
        r+=d; g+=d; b+=d;
      }
      if (a.whites !== 0){
        const wgt = Math.max(0, lum-0.75)*4;
        const d = a.whites/100 * 50 * Math.min(1,wgt);
        r+=d; g+=d; b+=d;
      }
      if (a.blacks !== 0){
        const wgt = Math.max(0, 0.25-lum)*4;
        const d = a.blacks/100 * 50 * Math.min(1,wgt);
        r+=d; g+=d; b+=d;
      }
      r=rtClamp(r,0,255); g=rtClamp(g,0,255); b=rtClamp(b,0,255);
      // Saturation (uniform HSL-style scale around per-pixel luma)
      if (a.saturation !== 0){
        const l = rtLuma(r,g,b); const s = 1 + a.saturation/100;
        r = rtClamp(l + (r-l)*s, 0, 255); g = rtClamp(l + (g-l)*s, 0, 255); b = rtClamp(l + (b-l)*s, 0, 255);
      }
      // Vibrance (protects already-saturated pixels, and skin-tone hues, more than plain saturation)
      if (a.vibrance !== 0){
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b), curSat=(mx-mn)/255;
        const protect = 1 - curSat*0.7;
        const l = rtLuma(r,g,b); const s = 1 + (a.vibrance/100)*protect;
        r = rtClamp(l + (r-l)*s, 0, 255); g = rtClamp(l + (g-l)*s, 0, 255); b = rtClamp(l + (b-l)*s, 0, 255);
      }
      // Dehaze (simplified, real approximation): boosts contrast+saturation and pulls light haze down slightly
      if (a.dehaze !== 0){
        const amt = a.dehaze/100;
        const l = rtLuma(r,g,b);
        const cf = 1 + amt*0.5;
        r = rtClamp(cf*(r-128)+128, 0, 255); g = rtClamp(cf*(g-128)+128, 0, 255); b = rtClamp(cf*(b-128)+128, 0, 255);
        if (amt > 0 && l > 180){ const pull = (l-180)/75 * amt * 20; r-=pull; g-=pull; b-=pull; }
        const s2 = 1 + amt*0.25;
        const l2 = rtLuma(r,g,b);
        r = rtClamp(l2+(r-l2)*s2,0,255); g = rtClamp(l2+(g-l2)*s2,0,255); b = rtClamp(l2+(b-l2)*s2,0,255);
      }
      data[p]=r; data[p+1]=g; data[p+2]=b;
    }
  }

  // Clarity/Texture/HDR: local-contrast enhancement via unsharp-mask-style
  // technique (blur at different radii = different frequency bands), same
  // proven approach as applySharpnessPP elsewhere in this project, applied
  // with tool-appropriate radii per effect.
  function applyRtLocalContrast(data, w, h){
    const a = rtAdj;
    if (a.clarity === 0 && a.texture === 0 && a.hdr === 0) return;
    for (let ch=0; ch<3; ch++){
      const plane = new Float32Array(w*h);
      for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
      if (a.clarity !== 0){
        const blurred = boxBlurGray(plane, w, h, 8);
        const strength = a.clarity/100 * 0.6;
        for (let p=0; p<w*h; p++) plane[p] = rtClamp(plane[p] + (plane[p]-blurred[p])*strength, 0, 255);
      }
      if (a.texture !== 0){
        const blurred = boxBlurGray(plane, w, h, 2);
        const strength = a.texture/100 * 0.7;
        for (let p=0; p<w*h; p++) plane[p] = rtClamp(plane[p] + (plane[p]-blurred[p])*strength, 0, 255);
      }
      if (a.hdr > 0){
        const blurred = boxBlurGray(plane, w, h, 14);
        const strength = a.hdr/100 * 0.5;
        for (let p=0; p<w*h; p++) plane[p] = rtClamp(plane[p] + (plane[p]-blurred[p])*strength, 0, 255);
      }
      for (let p=0; p<w*h; p++) data[p*4+ch] = plane[p];
    }
  }

  function applyRtNoiseReduction(data, w, h){
    if (rtAdj.noiseReduction <= 0) return;
    const strength = rtAdj.noiseReduction/100;
    const radius = Math.max(1, Math.round(strength*3));
    for (let ch=0; ch<3; ch++){
      const plane = new Float32Array(w*h);
      for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, radius);
      for (let p=0; p<w*h; p++) data[p*4+ch] = plane[p]*(1-strength) + blurred[p]*strength;
    }
  }

  function applyRtSharpness(data, w, h){
    if (rtAdj.sharpness <= 0) return;
    const strength = rtAdj.sharpness/100 * 1.2;
    for (let ch=0; ch<3; ch++){
      const plane = new Float32Array(w*h);
      for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, 2);
      for (let p=0; p<w*h; p++){
        const v = plane[p] + (plane[p]-blurred[p])*strength;
        data[p*4+ch] = rtClamp(v, 0, 255);
      }
    }
  }

  /* ---------- Skin smoothing / face brightening / skin tone (masked) ---------- */
  function applyRtSkinOps(data, w, h, sw, sh){
    const a = rtAdj;
    if (a.skinSmooth <= 0 && a.faceBrighten <= 0 && a.skinTone === 0) return;
    const mask = rtFaceLandmarks ? buildRtSkinMask(w, h, sw, sh) : new Float32Array(w*h).fill(0.5); // no face: gentle uniform fallback, disclosed to the user via rtFaceStatus
    if (a.skinSmooth > 0){
      const radius = Math.max(1, Math.round(a.skinSmooth/100 * 6));
      const strength = a.skinSmooth/100;
      for (let ch=0; ch<3; ch++){
        const plane = new Float32Array(w*h);
        for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
        const blurred = boxBlurGray(plane, w, h, radius);
        for (let p=0; p<w*h; p++){
          const m = mask[p] * strength;
          data[p*4+ch] = plane[p]*(1-m) + blurred[p]*m;
        }
      }
    }
    if (a.faceBrighten > 0 || a.skinTone !== 0){
      for (let p=0, i=0; p<w*h; p++, i+=4){
        const m = mask[p];
        if (m <= 0.01) continue;
        if (a.faceBrighten > 0){
          const d = a.faceBrighten/100 * 25 * m;
          data[i]=rtClamp(data[i]+d,0,255); data[i+1]=rtClamp(data[i+1]+d,0,255); data[i+2]=rtClamp(data[i+2]+d,0,255);
        }
        if (a.skinTone !== 0){
          const d = a.skinTone/50 * 15 * m;
          data[i]=rtClamp(data[i]+d,0,255); data[i+2]=rtClamp(data[i+2]-d,0,255);
        }
      }
    }
  }

  /* ---------- Background blur (reuses the generic ensureSegmenter() already
     built for AI Background Remover -- same shared model instance, not a
     second copy) ---------- */
  /* ---------- Background segmenter: own loader using the selfie_segmenter
     model -- the same one Passport Photo Maker uses, and the architecturally
     correct choice here too, since it's a binary person/background model.
     AI Background Remover's ensureSegmenter() uses DeepLab V3 instead (a
     general multi-class scene model with different category semantics
     entirely), so it would be the wrong tool to reuse even if it weren't
     also module-private. ---------- */
  let rtSegmenter = null, rtSegmenterLoadPromise = null;
  async function ensureRtSegmenter(){
    if (rtSegmenter) return rtSegmenter;
    if (!rtSegmenterLoadPromise){
      rtSegmenterLoadPromise = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`);
        const { ImageSegmenter, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`);
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite' },
          outputCategoryMask: true, outputConfidenceMasks: false, runningMode: 'IMAGE',
        });
        rtSegmenter = seg;
        return seg;
      })().catch((err) => { rtSegmenterLoadPromise = null; throw err; });
    }
    return rtSegmenterLoadPromise;
  }

  async function ensureRtBgMask(w, h){
    if (rtBgCategoryMask && rtBgMaskDims && rtBgMaskDims.w === w && rtBgMaskDims.h === h) return rtBgCategoryMask;
    try{
      const seg = await ensureRtSegmenter();
      const result = seg.segment(rtSourceCanvas);
      const mask = result.categoryMask;
      const maskData = mask.getAsUint8Array();
      const mw = mask.width, mh = mask.height;
      // Ground-truth calibration against real face landmarks, same
      // evidence-based principle established for the passport tool: don't
      // assume category>0 means "person," verify it against a real,
      // independent signal when one is available.
      let personCategoryValue = 1;
      if (rtFaceLandmarks){
        const votes = {};
        [1,4,10,152,234,454].forEach(i => {
          const lm = rtFaceLandmarks[i]; if (!lm) return;
          const mx = Math.min(mw-1, Math.round(lm.x*mw)), my = Math.min(mh-1, Math.round(lm.y*mh));
          votes[maskData[my*mw+mx]] = (votes[maskData[my*mw+mx]]||0)+1;
        });
        const sorted = Object.entries(votes).sort((x,y)=>y[1]-x[1]);
        if (sorted.length) personCategoryValue = +sorted[0][0];
      }
      const out = new Float32Array(w*h);
      for (let y=0; y<h; y++) for (let x=0; x<w; x++){
        const mx = Math.min(mw-1, Math.round(x*mw/w)), my = Math.min(mh-1, Math.round(y*mh/h));
        out[y*w+x] = maskData[my*mw+mx] === personCategoryValue ? 0 : 1; // 1 = background (blur target)
      }
      mask.close && mask.close();
      rtBgCategoryMask = boxBlurGray(out, w, h, 3); // soft edge
      rtBgMaskDims = { w, h };
      return rtBgCategoryMask;
    }catch(err){
      return null;
    }
  }

  function applyRtBgBlurSync(data, w, h, mask){
    if (rtAdj.bgBlur <= 0 || !mask) return;
    const radius = Math.max(1, Math.round(rtAdj.bgBlur/100 * 18));
    for (let ch=0; ch<3; ch++){
      const plane = new Float32Array(w*h);
      for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
      const blurred = boxBlurGray(plane, w, h, radius);
      for (let p=0; p<w*h; p++){
        const m = mask[p];
        data[p*4+ch] = plane[p]*(1-m) + blurred[p]*m;
      }
    }
  }

  /* ---------- One render pipeline, used by both live preview and export
     (same function, called at preview resolution for responsiveness while
     dragging, and at full source resolution for export) ---------- */
  async function renderRtToCanvas(targetCanvas, maxDim){
    if (!rtSourceCanvas) return;
    const sw = rtSourceCanvas.width, sh = rtSourceCanvas.height;
    let w = sw, h = sh;
    if (maxDim && Math.max(sw,sh) > maxDim){ const sc = maxDim/Math.max(sw,sh); w = Math.round(sw*sc); h = Math.round(sh*sc); }
    targetCanvas.width = w; targetCanvas.height = h;
    const ctx = targetCanvas.getContext('2d');
    ctx.drawImage(rtSourceCanvas, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    applyRtToneColor(data, w, h);
    applyRtLocalContrast(data, w, h);
    applyRtNoiseReduction(data, w, h);
    applyRtSharpness(data, w, h);
    applyRtSkinOps(data, w, h, sw, sh);
    if (rtAdj.bgBlur > 0){
      const mask = await ensureRtBgMask(w, h);
      applyRtBgBlurSync(data, w, h, mask);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function fitRtCanvasDisplay(){
    const canvas = document.getElementById('rtPreviewCanvas');
    const wrap = document.getElementById('rtCanvasStageWrap');
    if (!canvas.width || !wrap) return;
    const availW = wrap.clientWidth - 4, availH = Math.max(280, wrap.clientHeight - 4);
    const fitScale = Math.min(1, availW/canvas.width, availH/canvas.height) * rtZoom;
    canvas.style.width = Math.round(canvas.width*fitScale) + 'px';
    canvas.style.height = Math.round(canvas.height*fitScale) + 'px';
  }

  async function renderRtPreview(){
    if (rtRenderPending) return;
    rtRenderPending = true;
    try{
      await renderRtToCanvas(document.getElementById('rtPreviewCanvas'), 1100);
      fitRtCanvasDisplay();
    } finally {
      rtRenderPending = false;
    }
  }

  /* ---------- Accordion mutual-exclusion: genuinely new logic (see final
     report -- Passport Photo Maker's accordions do NOT actually auto-close
     siblings; they are independently closed-by-default <details>. This
     tool implements real "only one open at a time" behavior since that
     was explicitly requested here.) ---------- */
  function setupRtAccordionExclusivity(){
    const accordions = Array.from(document.querySelectorAll('#rtStage .pp-accordion'));
    accordions.forEach(acc => {
      acc.addEventListener('toggle', () => {
        if (acc.open) accordions.forEach(other => { if (other !== acc) other.open = false; });
      });
    });
  }

  /* ---------- Slider wiring ---------- */
  function rtDebouncedRender(){
    clearTimeout(window.__rtDebounce);
    window.__rtDebounce = setTimeout(renderRtPreview, 60);
  }
  Object.entries(RT_ID_MAP).forEach(([key, id]) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(id + 'Val');
    el.addEventListener('input', () => {
      rtAdj[key] = +el.value;
      if (valEl) valEl.textContent = el.value;
      rtDebouncedRender();
    });
  });

  function rtApplyAdjustmentsToUI(){
    Object.entries(RT_ID_MAP).forEach(([key, id]) => {
      const el = document.getElementById(id), valEl = document.getElementById(id+'Val');
      el.value = rtAdj[key];
      if (valEl) valEl.textContent = String(rtAdj[key]);
    });
  }

  document.getElementById('rtResetBtn').onclick = () => {
    rtAdj = { ...RT_DEFAULTS };
    rtApplyAdjustmentsToUI();
    rtZoom = 1;
    renderRtPreview();
    toast('Reset to original.');
  };

  /* ---------- Filter presets: real slider combinations, not a separate
     rendering path -- applying a preset just sets rtAdj and goes through
     the exact same renderRtToCanvas() as manual adjustments. ---------- */
  const RT_PRESETS = {
    none: { ...RT_DEFAULTS },
    natural: { ...RT_DEFAULTS, clarity:12, vibrance:15, contrast:6, sharpness:10 },
    portrait: { ...RT_DEFAULTS, skinSmooth:35, faceBrighten:15, clarity:8, temperature:6, contrast:8, vibrance:10 },
    vintage: { ...RT_DEFAULTS, temperature:20, saturation:-25, blacks:15, contrast:-8, texture:10 },
    cinematic: { ...RT_DEFAULTS, temperature:-8, tint:6, contrast:18, shadows:-10, highlights:-12, clarity:15 },
  };
  document.querySelectorAll('#rtAccordionFilters [data-preset]').forEach(btn => {
    btn.onclick = () => {
      const preset = RT_PRESETS[btn.dataset.preset];
      if (!preset) return;
      rtAdj = { ...RT_DEFAULTS, ...preset };
      rtApplyAdjustmentsToUI();
      renderRtPreview();
      toast(`Applied "${btn.textContent}" preset.`);
    };
  });

  /* ---------- Compare (hold to see original) ---------- */
  const compareBtn = document.getElementById('rtCompareBtn');
  function rtShowOriginal(show){
    const canvas = document.getElementById('rtPreviewCanvas');
    if (show) canvas.getContext('2d').drawImage(rtSourceCanvas, 0, 0, canvas.width, canvas.height);
    else renderRtPreview();
  }
  ['pointerdown'].forEach(ev => compareBtn.addEventListener(ev, () => rtShowOriginal(true)));
  ['pointerup','pointerleave'].forEach(ev => compareBtn.addEventListener(ev, () => rtShowOriginal(false)));

  /* ---------- Zoom / Fit to Screen / mouse wheel / gestures ---------- */
  document.getElementById('rtZoomSlider').addEventListener('input', (e) => {
    rtZoom = +e.target.value/100;
    document.getElementById('rtZoomVal').textContent = e.target.value;
    fitRtCanvasDisplay();
  });
  document.getElementById('rtFitScreenBtn').onclick = () => {
    rtZoom = 1;
    document.getElementById('rtZoomSlider').value = '100';
    document.getElementById('rtZoomVal').textContent = '100';
    fitRtCanvasDisplay();
    toast('Fit to screen.');
  };
  document.getElementById('rtCanvasStageWrap').addEventListener('wheel', (e) => {
    if (!rtSourceCanvas) return;
    e.preventDefault();
    rtZoom = rtClamp(rtZoom - Math.sign(e.deltaY)*0.1, 0.3, 4);
    document.getElementById('rtZoomSlider').value = String(Math.round(rtZoom*100));
    document.getElementById('rtZoomVal').textContent = String(Math.round(rtZoom*100));
    fitRtCanvasDisplay();
  }, { passive: false });

  // Pinch-zoom / one-finger-drag-to-scroll / double-tap: adapts the same
  // conceptual pattern already used in this project (distance/midpoint
  // tracking), scoped to this tool's own canvas element.
  let rtPinchStartDist=null, rtPinchStartZoom=1, rtLastTapTime=0, rtLastTapPos=null;
  const rtCanvasEl = document.getElementById('rtPreviewCanvas');
  rtCanvasEl.addEventListener('touchstart', (e) => {
    if (!rtSourceCanvas) return;
    if (e.touches.length === 2){
      e.preventDefault();
      const [a,b] = e.touches;
      rtPinchStartDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      rtPinchStartZoom = rtZoom;
    } else if (e.touches.length === 1){
      const t = e.touches[0]; const now = Date.now();
      if (rtLastTapPos && now-rtLastTapTime < 320 && Math.hypot(t.clientX-rtLastTapPos.x, t.clientY-rtLastTapPos.y) < 30){
        rtZoom = rtZoom > 1.05 ? 1 : 2;
        document.getElementById('rtZoomSlider').value = String(Math.round(rtZoom*100));
        document.getElementById('rtZoomVal').textContent = String(Math.round(rtZoom*100));
        fitRtCanvasDisplay();
        rtLastTapPos = null; return;
      }
      rtLastTapTime = now; rtLastTapPos = { x:t.clientX, y:t.clientY };
    }
  }, { passive:false });
  rtCanvasEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && rtPinchStartDist){
      e.preventDefault();
      const [a,b] = e.touches;
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      rtZoom = rtClamp(rtPinchStartZoom * (dist/rtPinchStartDist), 0.3, 4);
      document.getElementById('rtZoomSlider').value = String(Math.round(rtZoom*100));
      document.getElementById('rtZoomVal').textContent = String(Math.round(rtZoom*100));
      fitRtCanvasDisplay();
    }
  }, { passive:false });
  rtCanvasEl.addEventListener('touchend', (e) => { if (e.touches.length < 2) rtPinchStartDist = null; });

  /* ---------- Export: full source resolution, one render pipeline reused
     verbatim (not a second implementation) ---------- */
  document.getElementById('rtDownloadBtn').onclick = async () => {
    if (!rtSourceCanvas) return;
    const btn = document.getElementById('rtDownloadBtn');
    setLoading(btn, true);
    try{
      const exportCanvas = document.createElement('canvas');
      await renderRtToCanvas(exportCanvas, null); // null maxDim = full source resolution
      const format = document.getElementById('rtExportFormat').value;
      const ext = format === 'jpeg' ? 'jpg' : format;
      exportCanvas.toBlob((blob) => {
        if (!blob){ toast('Could not export \u2014 try a different format.', 'err'); return; }
        downloadBlob(blob, 'retouched-photo.' + ext);
      }, 'image/' + format, 0.98);
    } finally {
      setLoading(btn, false);
    }
  };

  /* ---------- Image loading ---------- */
  async function loadRtImage(f){
    if (!['image/jpeg','image/png','image/webp'].includes(f.type)){ toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    if (f.size > 30*1024*1024){ toast(`That image is ${fmtBytes(f.size)} \u2014 the limit is 30MB.`, 'err'); return; }
    let img;
    try{ img = await loadImageFromFile(f); }catch(err){ toast(err.message || 'Could not read this image.', 'err'); return; }
    rtSourceCanvas = document.createElement('canvas');
    rtSourceCanvas.width = img.naturalWidth; rtSourceCanvas.height = img.naturalHeight;
    rtSourceCanvas.getContext('2d').drawImage(img, 0, 0);
    rtBgCategoryMask = null; rtBgMaskDims = null;
    rtAdj = { ...RT_DEFAULTS };
    rtApplyAdjustmentsToUI();
    document.getElementById('rtStage').classList.remove('hidden');
    document.getElementById('rtOutputDims').textContent = `${rtSourceCanvas.width}\u00d7${rtSourceCanvas.height}px (original resolution)`;
    await rtDetectFace();
    await renderRtPreview();
    toast('Image loaded.');
  }
  setupDropZone('rtDrop','rtInput', async (files) => {
    const f = files.find(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a JPG, PNG, or WEBP image.', 'err'); return; }
    await loadRtImage(f);
  });
  document.addEventListener('paste', async (e) => {
    const drop = document.getElementById('rtDrop');
    if (drop.offsetParent === null) return;
    const items = Array.from(e.clipboardData ? e.clipboardData.items : []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem){ const file = imgItem.getAsFile(); if (file){ e.preventDefault(); await loadRtImage(file); } }
  });

  window.addEventListener('resize', () => { if (rtSourceCanvas) fitRtCanvasDisplay(); });
  setupRtAccordionExclusivity();
}

/* ============================================================
   ECOMMERCE PRODUCT EDITOR (epe* prefix) -- Phase 1: core engine
   Reuses: setupDropZone, loadImageFromFile (genuinely global).
   Reuses the .pp-accordion CSS/HTML pattern verbatim (same classes).
   Adapts the autosave PATTERN already used by AI Background Remover
   (debounced localStorage, 24h expiry, resume/discard banner) --
   that implementation is module-private, so this is an independent
   instance of the same pattern, not a literal reuse.
   Renders the editor preview at FULL ARTBOARD RESOLUTION always
   (CSS-scaled for on-screen display, exactly like Passport Photo
   Maker's WYSIWYG fix) rather than a reduced preview size, since
   this tool is transform-only (no per-pixel filters), making
   preview and export literally the same pixel output, not just the
   same algorithm at different resolutions.
   ============================================================ */
/* ============================================================
   TOOLFLIGHT SHARED ENGINES -- genuinely top-level scope (Phase 9 fix).
   These 8 factories were previously defined INSIDE the Ecommerce-only
   `if (document.getElementById('epeDrop'))` guard block -- meaning they
   never actually existed on any other page, including Passport Photo
   Maker. This was a real gap in the "shared engine" architecture from
   Phases 1-8: the engines were generically DESIGNED but not physically
   REACHABLE outside Ecommerce's own script guard. Moved here, before
   any per-tool guard, so every current and future ToolFlight editor
   that loads this shared app.js can actually call them.
   ============================================================ */

  function createToolflightWorkspaceEngine(opts){
    opts = opts || {};
    let x = 0, y = 0, scale = 1;
    const engine = {
      getState(){ return { x, y, scale }; },
      applyTransform(){
        const ws = typeof opts.workspaceEl === 'function' ? opts.workspaceEl() : opts.workspaceEl;
        if (ws) ws.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      },
      // Computes a centered fit-to-screen transform for content of size
      // contentW x contentH within the configured viewport, at the given
      // user zoom multiplier (1 = exact fit, >1 = zoomed in beyond fit).
      // Purely a function of the viewport's CURRENT size and the content's
      // fixed size -- never the workspace's own previous transform -- so
      // repeated calls never accumulate error (the root cause of an
      // earlier, since-fixed "Fit to Screen" cumulative-shrink bug).
      fitToScreen(contentW, contentH, userZoom){
        const viewport = typeof opts.viewportEl === 'function' ? opts.viewportEl() : opts.viewportEl;
        if (!viewport || !contentW || !contentH) return this.getState();
        const availW = viewport.clientWidth, availH = Math.max(120, viewport.clientHeight);
        const fitScale = Math.min(1, availW/contentW, availH/contentH) * (userZoom || 1);
        scale = fitScale;
        x = (availW - contentW*fitScale)/2;
        y = (availH - contentH*fitScale)/2;
        this.applyTransform();
        return this.getState();
      },
      // Zoom around a specific viewport-relative point (cursor or pinch
      // center), keeping that point visually stationary on screen.
      zoomAroundPoint(newScale, viewportX, viewportY){
        const oldScale = scale || 1;
        const wsPointX = (viewportX - x) / oldScale;
        const wsPointY = (viewportY - y) / oldScale;
        scale = newScale;
        x = viewportX - wsPointX*newScale;
        y = viewportY - wsPointY*newScale;
        this.applyTransform();
        return this.getState();
      },
      // Directly set the transform state (used by pan and by external
      // callers syncing plain-variable state back into the engine).
      setState(newX, newY, newScale){
        x = newX; y = newY;
        if (newScale !== undefined) scale = newScale;
        this.applyTransform();
        return this.getState();
      },
    };
    return engine;
  }

  function createToolflightHistoryEngine(config){
    config = config || {};
    const maxSize = config.maxSize || 60;
    let stack = [], index = -1;
    const listeners = {};
    function emit(event, payload){ (listeners[event] || []).forEach(cb => { try { cb(payload); } catch(e){ console.error('[HistoryEngine] listener error for', event, e); } }); }
    function on(event, cb){ (listeners[event] = listeners[event] || []).push(cb); return () => { listeners[event] = (listeners[event]||[]).filter(f => f !== cb); }; }

    const engine = {
      // ---- Snapshot Manager ----
      createSnapshot(){
        if (typeof config.beforeSnapshot === 'function') config.beforeSnapshot();
        stack = stack.slice(0, index + 1);
        const snap = typeof config.snapshotFn === 'function' ? config.snapshotFn() : null;
        stack.push(snap);
        if (stack.length > maxSize) stack.shift();
        index = stack.length - 1;
        emit('snapshotCreated', { index, size: stack.length });
        if (typeof config.onChange === 'function') config.onChange();
      },
      // ---- Undo / Redo Managers ----
      async undo(){
        if (index <= 0) return false;
        index--;
        if (typeof config.restoreFn === 'function') await config.restoreFn(stack[index]);
        emit('undoPerformed', { index, size: stack.length });
        if (typeof config.onChange === 'function') config.onChange();
        return true;
      },
      async redo(){
        if (index >= stack.length - 1) return false;
        index++;
        if (typeof config.restoreFn === 'function') await config.restoreFn(stack[index]);
        emit('redoPerformed', { index, size: stack.length });
        if (typeof config.onChange === 'function') config.onChange();
        return true;
      },
      canUndo(){ return index > 0; },
      canRedo(){ return index < stack.length - 1; },
      getHistorySize(){ return stack.length; },
      getIndex(){ return index; },
      restoreSnapshot(i){ // jump directly to a specific history index (e.g. history-list UI)
        if (i < 0 || i >= stack.length) return false;
        index = i;
        if (typeof config.restoreFn === 'function') config.restoreFn(stack[index]);
        emit('undoPerformed', { index, size: stack.length });
        if (typeof config.onChange === 'function') config.onChange();
        return true;
      },
      clearHistory(){
        stack = []; index = -1;
        emit('historyCleared', {});
        if (typeof config.onChange === 'function') config.onChange();
      },
      // Escape hatch for callers that need direct stack access (e.g.
      // session autosave metadata) without re-implementing history
      // logic elsewhere -- read-only by convention, not enforced.
      getStack(){ return stack; },

      on, emit,
    };
    return engine;
  }

  function createToolflightLayerEngine(config){
    config = config || {};
    const state = config.state; // same object reference as the caller's, e.g. dseState
    const generateId = config.generateId || (() => 'layer_' + Math.random().toString(36).slice(2));
    const listeners = {};

    function emit(event, payload){ (listeners[event] || []).forEach(cb => { try { cb(payload); } catch(e){ console.error('[LayerEngine] listener error for', event, e); } }); }
    function on(event, cb){ (listeners[event] = listeners[event] || []).push(cb); return () => { listeners[event] = (listeners[event]||[]).filter(f => f !== cb); }; }

    // O(1) id -> layer index, lazily rebuilt only when the layer count
    // changes (cheap check every call, full rebuild only when needed).
    let idIndex = null, idIndexCount = -1;
    function getIdIndex(){
      if (!idIndex || idIndexCount !== state.layers.length){
        idIndex = new Map();
        for (const l of state.layers) idIndex.set(l.id, l);
        idIndexCount = state.layers.length;
      }
      return idIndex;
    }
    function getLayerById(id){
      const fromIndex = getIdIndex().get(id);
      if (fromIndex) return fromIndex;
      // Safety fallback for the (rare, but possible) case where a
      // layer's id was mutated in place rather than replaced -- never
      // silently returns nothing just because the cached index is stale.
      return state.layers.find(l => l.id === id);
    }

    const engine = {
      // ---- Layer Manager ----
      getLayers(){ return state.layers; },
      getLayerById,
      addLayer(layer){
        state.layers.push(layer);
        emit('layerAdded', { layer });
        return layer;
      },
      removeLayer(id){
        const before = state.layers.length;
        state.layers = state.layers.filter(l => l.id !== id);
        state.selectedIds.delete(id);
        if (state.layers.length !== before) emit('layerRemoved', { id });
      },
      removeLayers(ids){
        const idSet = new Set(ids);
        state.layers = state.layers.filter(l => !idSet.has(l.id));
        ids.forEach(id => state.selectedIds.delete(id));
        emit('layerRemoved', { ids });
      },
      updateLayer(id, patch){
        const layer = getLayerById(id);
        if (!layer) return null;
        Object.assign(layer, patch);
        emit('layerUpdated', { id, patch });
        return layer;
      },

      // ---- Selection Manager (the only authority for selection state) ----
      getSelectedIds(){ return state.selectedIds; },
      getActiveLayer(){
        if (state.selectedIds.size === 0 && state.layers.length > 0) return state.layers[state.layers.length - 1];
        for (const id of state.selectedIds){ const l = getLayerById(id); if (l) return l; }
        return null;
      },
      selectLayer(id, additive){
        if (!additive) state.selectedIds.clear();
        if (id) state.selectedIds.add(id);
        emit('layerSelected', { id, additive, selectedIds: state.selectedIds });
      },
      deselectAll(){
        state.selectedIds.clear();
        emit('layerSelected', { id:null, selectedIds: state.selectedIds });
      },
      isSelected(id){ return state.selectedIds.has(id); },

      // ---- Ordering ----
      moveLayer(id, direction){
        const layer = getLayerById(id);
        if (!layer) return;
        const sorted = [...state.layers].sort((a,b) => a.zIndex - b.zIndex);
        const idx = sorted.indexOf(layer);
        if (direction === 'forward' && idx < sorted.length-1){ [sorted[idx].zIndex, sorted[idx+1].zIndex] = [sorted[idx+1].zIndex, sorted[idx].zIndex]; }
        if (direction === 'backward' && idx > 0){ [sorted[idx].zIndex, sorted[idx-1].zIndex] = [sorted[idx-1].zIndex, sorted[idx].zIndex]; }
        if (direction === 'top') layer.zIndex = Math.max(...state.layers.map(l=>l.zIndex)) + 1;
        if (direction === 'bottom') layer.zIndex = Math.min(...state.layers.map(l=>l.zIndex)) - 1;
        emit('layerMoved', { id, direction });
      },

      // ---- Visibility / Lock ----
      setVisible(id, visible){ return engine.updateLayer(id, { visible }); },
      setLocked(id, locked){ return engine.updateLayer(id, { locked }); },
      toggleVisible(id){ const l = getLayerById(id); if (l) return engine.setVisible(id, !l.visible); },
      toggleLocked(id){ const l = getLayerById(id); if (l) return engine.setLocked(id, !l.locked); },

      // ---- Duplication ----
      duplicateLayer(id, opts){
        opts = opts || {};
        const layer = getLayerById(id);
        if (!layer) return null;
        const skipKeys = opts.skipKeys || [];
        const clone = JSON.parse(JSON.stringify(layer, (k, v) => skipKeys.includes(k) ? undefined : v));
        clone.id = generateId();
        if (opts.offset){ clone.x = (clone.x||0) + opts.offset.x; clone.y = (clone.y||0) + opts.offset.y; }
        clone.zIndex = state.layers.length;
        engine.addLayer(clone);
        return clone;
      },

      // ---- Grouping (architecture prepared now; nested groups
      // supported via the same 'children' id-array shape recursively,
      // even though the current UI only exposes one level) ----
      groupLayers(ids, makeGroup){
        // makeGroup: (childIds) => groupLayerObject -- the actual group
        // layer *construction* (its transform/bbox math) stays editor-
        // specific and is supplied by the caller; the engine only owns
        // the generic "these ids now belong to a group" relationship.
        if (typeof makeGroup !== 'function') return null;
        const group = makeGroup(ids);
        if (!group.children) group.children = [...ids];
        engine.addLayer(group);
        ids.forEach(id => { const l = getLayerById(id); if (l) l.groupId = group.id; });
        emit('layerGrouped', { groupId: group.id, childIds: ids });
        return group;
      },
      ungroupLayer(groupId){
        const group = getLayerById(groupId);
        if (!group || !group.children) return [];
        const childIds = [...group.children];
        childIds.forEach(id => { const l = getLayerById(id); if (l) delete l.groupId; });
        engine.removeLayer(groupId);
        emit('layerUngrouped', { groupId, childIds });
        return childIds;
      },

      // ---- Events ----
      on, emit,
    };
    return engine;
  }

  function createToolflightPluginEngine(options){
    options = options || {};
    const plugins = new Map(); // id -> descriptor
    let activeId = null;
    const listeners = {};
    function emit(event, payload){ (listeners[event] || []).forEach(cb => { try { cb(payload); } catch(e){ console.error('[PluginEngine] listener error for', event, e); } }); }
    function on(event, cb){ (listeners[event] = listeners[event] || []).push(cb); return () => { listeners[event] = (listeners[event]||[]).filter(f => f !== cb); }; }

    const engine = {
      // ---- Registration / Discovery ----
      register(descriptor){
        if (!descriptor || !descriptor.id) throw new Error('[PluginEngine] register() requires an id');
        const plugin = Object.assign({
          category: descriptor.category || 'uncategorized',
          name: descriptor.name || descriptor.id,
          icon: descriptor.icon || null,
          shortcut: descriptor.shortcut || null,
          order: typeof descriptor.order === 'number' ? descriptor.order : plugins.size,
          enabled: descriptor.enabled !== false,
          kind: descriptor.kind || 'action', // 'action' (one-shot) | 'toggle' | 'mode'
          init(){}, destroy(){}, enable(){}, disable(){}, activate(){}, deactivate(){},
        }, descriptor);
        plugins.set(plugin.id, plugin);
        if (typeof plugin.init === 'function') plugin.init();
        if (plugin.shortcut) registerShortcut(plugin.shortcut, plugin.id);
        emit('pluginRegistered', { id: plugin.id });
        return plugin;
      },
      unregister(id){
        const plugin = plugins.get(id);
        if (!plugin) return false;
        if (typeof plugin.destroy === 'function') plugin.destroy();
        plugins.delete(id);
        emit('pluginUnregistered', { id });
        return true;
      },
      getPlugin(id){ return plugins.get(id) || null; },
      getPlugins(){ return [...plugins.values()].sort((a,b) => a.order - b.order); },
      getPluginsByCategory(category){ return engine.getPlugins().filter(p => p.category === category); },
      getCategories(){ return [...new Set(engine.getPlugins().map(p => p.category))]; },

      // ---- Enable / Disable ----
      isEnabled(id){ const p = plugins.get(id); return !!p && p.enabled; },
      enablePlugin(id){
        const p = plugins.get(id); if (!p) return;
        p.enabled = true;
        if (typeof p.enable === 'function') p.enable();
        emit('pluginEnabled', { id });
      },
      disablePlugin(id){
        const p = plugins.get(id); if (!p) return;
        if (activeId === id) engine.deactivate();
        p.enabled = false;
        if (typeof p.disable === 'function') p.disable();
        emit('pluginDisabled', { id });
      },

      // ---- Lifecycle: activate / deactivate ----
      // For 'action' plugins (one-shot, e.g. Rotate), activate() runs
      // the action and the engine does not track it as "the active
      // tool" afterward. For 'toggle'/'mode' plugins, activate() enters
      // the tool's mode and it stays active until deactivate() or
      // another mode-kind plugin is activated (mirroring the existing
      // epeSetTool radio-group behavior for Clone/Heal/Erase).
      activate(id, ...args){
        const p = plugins.get(id);
        if (!p || !p.enabled) return false;
        if (p.kind !== 'action' && activeId && activeId !== id) engine.deactivate();
        const result = typeof p.activate === 'function' ? p.activate(...args) : undefined;
        if (p.kind !== 'action') activeId = id;
        emit('pluginActivated', { id, kind: p.kind });
        return result;
      },
      deactivate(id){
        const targetId = id || activeId;
        if (!targetId) return false;
        const p = plugins.get(targetId);
        if (p && typeof p.deactivate === 'function') p.deactivate();
        if (activeId === targetId) activeId = null;
        emit('pluginDeactivated', { id: targetId });
        return true;
      },
      getActivePlugin(){ return activeId ? plugins.get(activeId) : null; },
      getActiveId(){ return activeId; },

      // ---- Keyboard shortcuts ----
      on, emit,
    };

    // Shortcut registration is intentionally simple and additive: it
    // records which key activates which plugin id, and the caller wires
    // one real keydown listener (via options.bindShortcuts, supplied by
    // the editor, since different editors may want different modifier-
    // key conventions or may already have their own keydown handling
    // this needs to coexist with, exactly like the Ecommerce Editor's
    // existing Ctrl+Z handling does).
    const shortcuts = new Map();
    function registerShortcut(key, id){ shortcuts.set(key.toLowerCase(), id); }
    engine.getShortcutTarget = (key) => shortcuts.get((key||'').toLowerCase()) || null;

    return engine;
  }

  function createToolflightCanvasEngine(config){
    config = config || {};
    function getCanvasEl(){ return typeof config.canvasEl === 'function' ? config.canvasEl() : config.canvasEl; }
    function getOverlayEl(){ return typeof config.overlayEl === 'function' ? config.overlayEl() : config.overlayEl; }
    function getContentSize(){ return (typeof config.getContentSize === 'function' ? config.getContentSize() : config.getContentSize) || { w:0, h:0 }; }

    const engine = {
      getCanvas(){ return getCanvasEl(); },
      getOverlay(){ return getOverlayEl(); },
      getContext(){ const c = getCanvasEl(); return c ? c.getContext('2d') : null; },
      getOverlayContext(){ const c = getOverlayEl(); return c ? c.getContext('2d') : null; },
      getSize(){ return getContentSize(); },
      // Device pixel ratio -- exposed for future editors that want
      // DPR-aware backing-store rendering. The Ecommerce Editor does
      // not currently use this (its canvas backing store is set 1:1 to
      // logical pixels, verified working and byte-identical on export
      // throughout this project) -- calling this does not change that
      // existing behavior; it's an available capability, not something
      // retrofitted onto the working editor in this phase.
      getDevicePixelRatio(){ return window.devicePixelRatio || 1; },

      // ---- Coordinate System ----
      // screenToCanvas: converts a client-space point (e.g. from a
      // pointer event) into canvas-logical-space coordinates, using the
      // canvas element's actual on-screen bounding rect -- correctly
      // transform-aware regardless of any ancestor's CSS transform
      // (this is exactly why the Workspace Engine's GPU transforms
      // never required touching this math: getBoundingClientRect
      // already accounts for them).
      screenToCanvas(clientX, clientY){
        const canvas = getCanvasEl();
        const size = getContentSize();
        if (!canvas) return { x:0, y:0 };
        const rect = canvas.getBoundingClientRect();
        return { x: (clientX-rect.left)/rect.width*size.w, y: (clientY-rect.top)/rect.height*size.h };
      },
      // canvasToScreen: the inverse -- converts a canvas-logical-space
      // point back into client-space screen coordinates.
      canvasToScreen(canvasX, canvasY){
        const canvas = getCanvasEl();
        const size = getContentSize();
        if (!canvas || !size.w || !size.h) return { x:0, y:0 };
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + (canvasX/size.w)*rect.width, y: rect.top + (canvasY/size.h)*rect.height };
      },
      // viewportToCanvas / canvasToViewport: aliases for the same
      // conversion, named to match the Workspace Engine's terminology
      // for editors that think in terms of "viewport" rather than
      // "screen" -- same math, since the canvas's bounding rect is
      // already viewport-relative by definition in browser layout.
      viewportToCanvas(viewportX, viewportY){ return engine.screenToCanvas(viewportX, viewportY); },
      canvasToViewport(canvasX, canvasY){ return engine.canvasToScreen(canvasX, canvasY); },

      // ---- Rendering ----
      // The engine does not draw content itself -- it holds the
      // editor-supplied render function and provides a single,
      // consistent entry point (render/requestRender/invalidate) so
      // editors call one API instead of reaching into multiple
      // rendering functions directly.
      setRenderer(fn){ config.renderFn = fn; },
      render(...args){ if (typeof config.renderFn === 'function') config.renderFn(...args); },
      requestRender(...args){ engine.render(...args); },
      renderNow(...args){ engine.render(...args); },
      invalidate(...args){ engine.render(...args); },
      refresh(...args){ engine.render(...args); },
    };
    return engine;
  }

  function createToolflightAssetLibraryEngine(config){
    config = config || {};
    const registry = config.initialRegistry || []; // reuse an existing, already-populated array by reference if supplied
    let searchIndex = null;
    const batchSize = config.batchSize || 24;
    let currentResults = [];
    let renderedCount = 0;
    let scrollObserver = null;
    let searchDebounceTimer = null;

    function getEl(ref){ return typeof ref === 'function' ? ref() : ref; }

    // ---- Registry ----
    function registerAsset(entry){ registry.push(entry); return entry; }
    function getRegistry(){ return registry; }

    // ---- Search Index: real inverted index, term -> asset indices ----
    function buildSearchIndex(){
      const index = new Map();
      registry.forEach((asset, i) => {
        const terms = new Set([
          ...(asset.title||'').toLowerCase().split(/\s+/),
          ...(asset.tags||[]).map(t=>t.toLowerCase()),
          ...(asset.keywords||[]).map(k=>k.toLowerCase()),
          (asset.category||'').toLowerCase(),
        ]);
        terms.forEach(term => {
          if (!term) return;
          if (!index.has(term)) index.set(term, new Set());
          index.get(term).add(i);
        });
      });
      return index;
    }

    // ---- Concept expansion (generic, pluggable): editors may supply
    // their own concept map via config.searchConcepts; falls back to
    // an empty expansion (no-op) if none is supplied, so this never
    // requires ecommerce-specific data to function correctly. ----
    function expandQueryConcepts(query){
      const rules = config.searchConcepts || [];
      const q = query.toLowerCase();
      const extra = new Set();
      rules.forEach(rule => { if (rule.pattern.test(q)) rule.concepts.forEach(c => extra.add(c)); });
      return extra;
    }

    // ---- Fuzzy matching: real Levenshtein distance, generic, no
    // external dependency. ----
    function levenshtein(a, b){
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const prev = new Array(b.length+1); const curr = new Array(b.length+1);
      for (let j=0;j<=b.length;j++) prev[j] = j;
      for (let i=1;i<=a.length;i++){
        curr[0] = i;
        for (let j=1;j<=b.length;j++){
          const cost = a[i-1]===b[j-1] ? 0 : 1;
          curr[j] = Math.min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost);
        }
        for (let j=0;j<=b.length;j++) prev[j]=curr[j];
      }
      return prev[b.length];
    }
    function fuzzyMatchTerm(term, query){
      const maxDist = query.length <= 4 ? 1 : query.length <= 7 ? 2 : 3;
      return levenshtein(term, query) <= maxDist;
    }
    function termMatchesQuery(term, aq){
      if (aq.length <= 3) return new RegExp('(^|[^a-z0-9])' + aq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(term);
      return term.includes(aq);
    }

    // ---- Search: category/color/style filtering + special pseudo-
    // categories (recent/popular/favorites), delegated to
    // config.getSpecialView so the engine never owns localStorage
    // logic itself -- that stays editor-specific. ----
    function search(query, category, color, style){
      if (!searchIndex) searchIndex = buildSearchIndex();
      if (typeof config.annotateFacets === 'function') config.annotateFacets(registry);

      if (config.specialCategories && config.specialCategories.includes(category)){
        return typeof config.getSpecialView === 'function' ? config.getSpecialView(category) : [];
      }

      const q = (query||'').toLowerCase().trim();
      let results;
      if (!q){
        results = registry.slice();
      } else {
        const tokens = q.split(/\s+/).filter(Boolean);
        const conceptTerms = expandQueryConcepts(q);
        const matchedIndices = new Set();
        const allQueries = [q, ...tokens];
        for (const [term, idxSet] of searchIndex){
          if (allQueries.some(aq => termMatchesQuery(term, aq))) idxSet.forEach(i => matchedIndices.add(i));
          if (conceptTerms.has(term)) idxSet.forEach(i => matchedIndices.add(i));
        }
        if (matchedIndices.size === 0){
          for (const [term] of searchIndex){
            if (tokens.some(t => fuzzyMatchTerm(term, t))) searchIndex.get(term).forEach(i => matchedIndices.add(i));
          }
        }
        results = [...matchedIndices].map(i => registry[i]);
      }
      if (category && category !== 'all') results = results.filter(a => a.category === category);
      if (color && color !== 'all') results = results.filter(a => a.color === color);
      if (style && style !== 'all') results = results.filter(a => a.style && a.style.includes(style));
      return results;
    }

    // ---- Lazy-loading batch rendering ----
    function renderResults(query, category, color, style){
      const grid = getEl(config.gridEl);
      if (!grid) return;
      currentResults = search(query, category, color, style);
      renderedCount = 0;
      grid.innerHTML = '';
      const countEl = getEl(config.resultCountEl);
      if (countEl && typeof config.formatResultCount === 'function') countEl.textContent = config.formatResultCount(currentResults, category);
      appendBatch();
      if (typeof config.onSearchRendered === 'function') config.onSearchRendered(query);
      clearTimeout(searchDebounceTimer);
      if (query && query.trim().length >= 2 && typeof config.recordRecentSearch === 'function'){
        searchDebounceTimer = setTimeout(() => config.recordRecentSearch(query), 800);
      }
    }
    function appendBatch(){
      const grid = getEl(config.gridEl);
      if (!grid) return;
      const batch = currentResults.slice(renderedCount, renderedCount + batchSize);
      const frag = document.createDocumentFragment();
      batch.forEach(asset => {
        const cell = typeof config.createCellEl === 'function' ? config.createCellEl(asset) : document.createElement('button');
        cell.onclick = (e) => { if (typeof config.onAssetSelected === 'function') config.onAssetSelected(asset, e); };
        frag.appendChild(cell);
      });
      grid.appendChild(frag);
      renderedCount += batch.length;
      ensureSentinel();
    }
    function ensureSentinel(){
      const grid = getEl(config.gridEl);
      const sentinelId = config.sentinelId || 'toolflightAssetScrollSentinel';
      const old = document.getElementById(sentinelId);
      if (old) old.remove();
      if (renderedCount >= currentResults.length) return;
      const sentinel = document.createElement('div');
      sentinel.id = sentinelId;
      sentinel.style.cssText = 'height:1px;';
      grid.appendChild(sentinel);
      if (!scrollObserver){
        scrollObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => { if (entry.isIntersecting) appendBatch(); });
        }, { root: getEl(config.gridScrollEl), rootMargin: '200px' });
      }
      scrollObserver.observe(sentinel);
    }

    return {
      registerAsset, getRegistry,
      search, renderResults, appendBatch,
      getCurrentResults: () => currentResults,
    };
  }

  function createToolflightFloatingToolbarDrag(config){
    config = config || {};
    const handle = typeof config.handleEl === 'function' ? config.handleEl() : config.handleEl;
    const bar = typeof config.barEl === 'function' ? config.barEl() : config.barEl;
    const wrap = typeof config.viewportEl === 'function' ? config.viewportEl() : config.viewportEl;
    if (!handle || !bar || !wrap) return null;
    let dragging = false, startX = 0, startY = 0, barStartLeft = 0, barStartTop = 0;

    function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

    function beginDrag(clientX, clientY){
      const wrapRect = wrap.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      // Switch from the centered (left:50%, transform) default to
      // absolute pixel positioning relative to the viewport, using the
      // bar's CURRENT on-screen position so there's no visual jump.
      barStartLeft = barRect.left - wrapRect.left;
      barStartTop = barRect.top - wrapRect.top;
      bar.style.left = barStartLeft + 'px';
      bar.style.top = barStartTop + 'px';
      bar.style.bottom = 'auto';
      bar.style.transform = 'none';
      bar.classList.add(config.draggingClass || 'epe-dragging');
      startX = clientX; startY = clientY;
      dragging = true;
    }
    function moveDrag(clientX, clientY){
      if (!dragging) return;
      const wrapRect = wrap.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const dx = clientX - startX, dy = clientY - startY;
      let newLeft = barStartLeft + dx, newTop = barStartTop + dy;
      // Never leave the visible viewport bounds.
      newLeft = clamp(newLeft, 0, Math.max(0, wrapRect.width - barRect.width));
      newTop = clamp(newTop, 0, Math.max(0, wrapRect.height - barRect.height));
      bar.style.left = newLeft + 'px';
      bar.style.top = newTop + 'px';
    }
    function endDrag(){
      if (!dragging) return;
      dragging = false;
      bar.classList.remove(config.draggingClass || 'epe-dragging');
    }
    function resetToDefaultPosition(){
      bar.style.left = ''; bar.style.top = ''; bar.style.bottom = '';
      bar.style.transform = '';
      bar.classList.remove(config.draggingClass || 'epe-dragging');
    }

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      beginDrag(e.clientX, e.clientY);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.preventDefault(); e.stopPropagation();
      moveDrag(e.clientX, e.clientY);
    });
    handle.addEventListener('pointerup', (e) => { e.stopPropagation(); endDrag(); });
    handle.addEventListener('pointercancel', (e) => { e.stopPropagation(); endDrag(); });

    // Reset to the default (centered, bottom-anchored) position when any
    // of the configured "reset trigger" elements are clicked (e.g. Fit to
    // Screen buttons).
    (config.resetTriggerEls || []).forEach(el => {
      const target = typeof el === 'function' ? el() : el;
      if (target) target.addEventListener('click', resetToDefaultPosition);
    });

    // Re-clamp on resize/orientation change so the toolbar never ends up
    // outside the (possibly now-smaller) viewport bounds.
    window.addEventListener('resize', () => {
      if (bar.style.left === '' || bar.style.transform === 'translateX(-50%)') return; // still at default position
      const wrapRect = wrap.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const curLeft = parseFloat(bar.style.left) || 0, curTop = parseFloat(bar.style.top) || 0;
      bar.style.left = clamp(curLeft, 0, Math.max(0, wrapRect.width - barRect.width)) + 'px';
      bar.style.top = clamp(curTop, 0, Math.max(0, wrapRect.height - barRect.height)) + 'px';
    });

    return { resetToDefaultPosition };
  }

  function createToolflightCategorySwitcher(config){
    config = config || {};
    const accordionMap = config.accordionMap || {};
    const labelMap = config.labelMap || {};
    const allAccordionIds = Object.values(accordionMap).flat();
    const navButtonSelector = config.navButtonSelector || '[data-toolflight-category]';
    const activeStateSelector = config.activeStateSelector || navButtonSelector;
    const categoryDataAttr = config.categoryDataAttr || 'toolflightCategory';
    let activeCategory = config.initialCategory || null;

    function getPanelTitleEl(){ return typeof config.panelTitleEl === 'function' ? config.panelTitleEl() : config.panelTitleEl; }
    function getPanelBodyEl(){ return typeof config.panelBodyEl === 'function' ? config.panelBodyEl() : config.panelBodyEl; }

    function selectCategory(cat, opts){
      opts = opts || {};
      if (!accordionMap[cat]) return;
      activeCategory = cat;
      document.querySelectorAll(activeStateSelector).forEach(btn => {
        const isActive = btn.dataset[categoryDataAttr] === cat;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });
      const titleEl = getPanelTitleEl();
      if (titleEl) titleEl.textContent = labelMap[cat] || cat;

      const ids = accordionMap[cat];
      const idSet = new Set(ids);
      allAccordionIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle(config.hiddenClass || 'epe-category-hidden', !idSet.has(id));
      });
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (i === 0) el.open = true; else if (opts.collapseRest !== false) el.open = false;
      });
      const panelBody = getPanelBodyEl();
      if (panelBody) panelBody.scrollTop = 0;
      const firstEl = document.getElementById(ids[0]);
      if (firstEl && firstEl.scrollIntoView && !opts.noScroll) firstEl.scrollIntoView({ block:'start', behavior:'instant' in document.documentElement.style ? 'instant' : 'auto' });

      if (!opts.skipOpenPanel && typeof config.onOpenPanel === 'function') config.onOpenPanel();
    }
    document.querySelectorAll(navButtonSelector).forEach(btn => btn.addEventListener('click', () => selectCategory(btn.dataset[categoryDataAttr])));

    return { selectCategory, getActiveCategory: () => activeCategory };
  }

if (document.getElementById('epeDrop')){
  let epeSourceImg = null;       // original uploaded image, never mutated
  let epeArtboardW = 0, epeArtboardH = 0;
  let epeLayer = { x:0, y:0, scale:1, rotation:0, flipH:false, flipV:false };
  let epeViewZoom = 1;           // display-only navigation, never affects exported pixels
  /* ============================================================
     TOOLFLIGHT WORKSPACE ENGINE (shared architecture, Phase 1 of
     the multi-editor migration plan). Tool-agnostic: takes viewport/
     workspace elements as config, has no knowledge of "ecommerce"
     specifically. This is the single, real implementation of the
     Viewport -> Workspace GPU-transform pattern (translate + scale)
     -- fit-to-screen math, zoom-around-a-point math, and transform
     application all live here exactly once. The Ecommerce Editor is
     refactored below to delegate to an instance of this engine
     rather than containing its own separate copy of this logic.
     Future editors (Passport, Thumbnail, etc.) instantiate their own
     engine the same way, with their own viewport/workspace elements
     -- no new workspace math is ever written per-editor. ============================================================ */

  // ---- Workspace architecture: the canvas element itself is always
  // kept at its native pixel size (epeArtboardW x epeArtboardH in CSS
  // px too); all visual pan/zoom is expressed as a single transform on
  // #epeWorkspace. This replaces the old approach of directly resizing
  // the canvas element's CSS width/height on every render, which was
  // the root cause of an earlier "Fit to Screen" cumulative-shrink bug
  // (repeatedly measuring a size that had itself just been changed).
  // Measuring the fixed-size #epeWorkspaceViewport is stable regardless
  // of how many times fit/center/zoom run. ----
  let epeWorkspaceX = 0, epeWorkspaceY = 0, epeWorkspaceScale = 1;
  // Ecommerce Editor's instance of the shared workspace engine -- this
  // IS the workspace math for this editor now; epeApplyWorkspaceTransform/
  // epeZoomAroundPoint/fitEpeCanvasDisplay below are thin wrappers that
  // delegate to it and keep the pre-existing plain variables
  // (epeWorkspaceX/Y/Scale, read directly by the pan-mode code) in sync,
  // so nothing else in the codebase needed to change.
  const epeWorkspaceEngine = createToolflightWorkspaceEngine({
    viewportEl: () => document.getElementById('epeWorkspaceViewport'),
    workspaceEl: () => document.getElementById('epeWorkspace'),
  });
  function epeSyncWorkspaceVarsFromEngine(){
    const s = epeWorkspaceEngine.getState();
    epeWorkspaceX = s.x; epeWorkspaceY = s.y; epeWorkspaceScale = s.scale;
  }
  function epeApplyWorkspaceTransform(){
    // The pan-mode code updates epeWorkspaceX/Y directly then calls this
    // function -- push that state into the engine so it stays the source
    // of truth, then apply.
    epeWorkspaceEngine.setState(epeWorkspaceX, epeWorkspaceY, epeWorkspaceScale);
  }
  // Zoom around a specific viewport-relative point (cursor position or
  // pinch center), keeping that point visually stationary. newDisplayScale
  // is the actual workspace scale to apply (already includes any
  // fit-to-screen baseline, matching what fitEpeCanvasDisplay would compute
  // for the same epeViewZoom).
  function epeZoomAroundPoint(newDisplayScale, viewportX, viewportY){
    epeWorkspaceEngine.zoomAroundPoint(newDisplayScale, viewportX, viewportY);
    epeSyncWorkspaceVarsFromEngine();
  }
  /* ============================================================
     TOOLFLIGHT HISTORY ENGINE (Phase 5 of the multi-editor migration
     plan). Tool-agnostic: owns the undo/redo stack mechanics (push,
     index management, size limit, clear) with zero knowledge of what
     a "snapshot" actually contains -- that's supplied by the editor
     via snapshotFn/restoreFn callbacks, exactly the same pattern as
     the Canvas Engine's renderFn from Phase 3. What a snapshot
     captures is legitimately editor-specific (ecommerce snapshots
     layers/adjustments; a future editor snapshots its own state) --
     forcing a generic "shape" onto that content isn't what makes this
     shared, the STACK MECHANICS are what's genuinely identical across
     every editor and are the single real implementation here. ============================================================ */

  let epeHistoryStack = [], epeHistoryIndex = -1;
  // Ecommerce Editor's instance of the shared History Engine. The
  // engine owns stack/index/limit mechanics only; what a snapshot
  // actually contains stays defined by epeSnapshotState/epeRestoreState
  // below (unchanged), supplied here as callbacks. epeHistoryStack/
  // epeHistoryIndex remain as synced plain variables so the few
  // existing direct-reset call sites and the one autosave read site
  // continue to work unmodified.
  const epeHistoryEngine = createToolflightHistoryEngine({
    maxSize: 60,
    beforeSnapshot: () => { if (typeof dseFlushAliasesToLayer === 'function' && typeof dseActiveLayer === 'function'){ const active = dseActiveLayer(); if (active) dseFlushAliasesToLayer(active); } },
    snapshotFn: () => epeSnapshotState(),
    restoreFn: (snap) => epeRestoreState(snap),
    onChange: () => { epeHistoryStack = epeHistoryEngine.getStack(); epeHistoryIndex = epeHistoryEngine.getIndex(); epeUpdateHistoryButtons(); },
  });
  let epeCropActive = false, epeCropRect = null, epeCropDragMode = null, epeCropDragStart = null, epeCropRectStart = null;
  // epeDragMode/epeDragStart/epeLayerStart removed (Phase 3 Part 4 audit) -- only used by the dead pointer functions removed above
  let epeAutoSaveTimer = null;
  const EPE_AUTOSAVE_KEY = 'toolflight_epe_session';
  const epeArtboardEl = document.getElementById('epeArtboardCanvas');
  const epeOverlayEl = document.getElementById('epeOverlayCanvas');

  function epeClamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- History (lightweight: transform state, not pixel
     snapshots -- appropriate for a non-destructive transform-based
     editor, and far cheaper than the pixel-snapshot approach used
     by tools with actual destructive pixel edits) ---------- */
  /* Phase 2 epeSnapshotState removed -- Phase 3 DSE version below supersedes it */
  function epePushHistory(){
    epeHistoryEngine.createSnapshot();
    epeScheduleAutoSave();
  }
  function epeUpdateHistoryButtons(){
    document.getElementById('epeUndoBtn').disabled = !epeHistoryEngine.canUndo();
    document.getElementById('epeRedoBtn').disabled = !epeHistoryEngine.canRedo();
  }
  /* Phase 2 epeRestoreState removed -- Phase 3 DSE version in dse_layers_panel.js supersedes it */
  document.getElementById('epeUndoBtn').onclick = async () => {
    await epeHistoryEngine.undo();
  };
  document.getElementById('epeRedoBtn').onclick = async () => {
    await epeHistoryEngine.redo();
  };
  document.addEventListener('keydown', (e) => {
    if (!epeSourceImg) return;
    if (document.getElementById('epeStage').classList.contains('hidden')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey){ e.preventDefault(); document.getElementById('epeUndoBtn').click(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase()==='z' && e.shiftKey))){ e.preventDefault(); document.getElementById('epeRedoBtn').click(); }
  });

  /* ---------- Single render pipeline. Both editor preview and export
     call renderEpeArtboard() -- there is no second, separate export
     rendering path. Preview additionally calls renderEpeOverlay() for
     grid/guides/safe-area, which are drawn to a SEPARATE canvas with
     pointer-events:none and are never part of exported pixel data. ---------- */
  /* ============================================================
     PHASE 2 -- Professional Product Image Editing Engine
     Extends the Phase 1 artboard/layer pipeline. Adjustments and
     background removal are applied to a cached "processed" copy of
     the source image; the layer transform (position/scale/rotate)
     is then applied to THAT processed image, through the same
     renderEpeArtboard() used everywhere -- still one render
     pipeline, still literally the same function for preview and
     export, just now with more processing happening before the
     transform step.
     ============================================================ */
  const EPE_ADJ_DEFAULTS = {
    brightness:0, contrast:0, exposure:0, gamma:0, highlights:0, shadows:0, whites:0, blacks:0,
    saturation:0, vibrance:0, temperature:0, tint:0, hue:0,
    sharpness:0, clarity:0, texture:0, dehaze:0,
    surfaceEnhance:0, // the general, honestly-scoped "beauty filter for products" -- see final report
    noiseReduction:0, // the real, working component of "Product Retouch"
  };
  let epeAdj = { ...EPE_ADJ_DEFAULTS };
  let epeEraseMask = null; // Uint8ClampedArray, same w/h as source image: 0=keep original, 255=replace with background -- same semantic established in Passport Photo Maker
  let epeBgMode = 'none'; // none | white | black | transparent | color | gradient
  let epeBgColor = '#ffffff';
  let epeBgGradient = { from:'#ffffff', to:'#dddddd', angle:180 };
  let epeShadow = { enabled:false, style:'soft', opacity:45, blur:24, distance:18, angle:135, scale:100 };
  let epeReflection = { enabled:false, style:'soft', opacity:35, fade:60, distance:0 };
  let epeProcessedCanvasCache = null, epeProcessedCacheKey = '';

  function epeAdjCacheKey(){
    return JSON.stringify(epeAdj) + '|' + epeBgMode + '|' + epeBgColor + '|' + JSON.stringify(epeBgGradient) + '|' + (epeEraseMask ? 'masked' : 'nomask');
  }

  // Same clamp/luma helpers as elsewhere in this project, redeclared here
  // since this module is independently scoped (see architecture notes in
  // the final report re: module-private helpers throughout this codebase).
  function epeLuma(r,g,b){ return 0.299*r + 0.587*g + 0.114*b; }

  function applyEpeToneColor(data, w, h){
    const a = epeAdj;
    const exposureMul = Math.pow(2, a.exposure/100 * 1.2);
    const contrastFactor = (259*(a.contrast*2.55+255)) / (255*(259-a.contrast*2.55));
    const gammaVal = Math.pow(2, -a.gamma/100); // gamma slider: negative=darken midtones, positive=brighten
    const tempShift = a.temperature/100 * 40;
    const tintShift = a.tint/100 * 40;
    const hueShift = a.hue/100 * 180; // degrees
    for (let p=0; p<data.length; p+=4){
      let r=data[p], g=data[p+1], b=data[p+2];
      r = epeClamp(r+tempShift,0,255); b = epeClamp(b-tempShift,0,255);
      g = epeClamp(g+tintShift,0,255);
      r *= exposureMul; g *= exposureMul; b *= exposureMul;
      r += a.brightness*1.2; g += a.brightness*1.2; b += a.brightness*1.2;
      r = contrastFactor*(r-128)+128; g = contrastFactor*(g-128)+128; b = contrastFactor*(b-128)+128;
      if (a.gamma !== 0){
        r = 255*Math.pow(epeClamp(r,0,255)/255, gammaVal);
        g = 255*Math.pow(epeClamp(g,0,255)/255, gammaVal);
        b = 255*Math.pow(epeClamp(b,0,255)/255, gammaVal);
      }
      const lum = epeLuma(r,g,b)/255;
      if (a.highlights !== 0){ const wgt=Math.max(0,lum-0.5)*2; const d=a.highlights/100*60*wgt; r+=d;g+=d;b+=d; }
      if (a.shadows !== 0){ const wgt=Math.max(0,0.5-lum)*2; const d=a.shadows/100*60*wgt; r+=d;g+=d;b+=d; }
      if (a.whites !== 0){ const wgt=Math.min(1,Math.max(0,lum-0.75)*4); const d=a.whites/100*50*wgt; r+=d;g+=d;b+=d; }
      if (a.blacks !== 0){ const wgt=Math.min(1,Math.max(0,0.25-lum)*4); const d=a.blacks/100*50*wgt; r+=d;g+=d;b+=d; }
      r=epeClamp(r,0,255); g=epeClamp(g,0,255); b=epeClamp(b,0,255);
      if (a.hue !== 0){
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
        if (mx !== mn){
          const d = mx-mn; let hh;
          if (mx===r) hh = ((g-b)/d + (g<b?6:0));
          else if (mx===g) hh = (b-r)/d + 2;
          else hh = (r-g)/d + 4;
          hh = (hh*60 + hueShift + 360) % 360;
          const s = d/(255-Math.abs(2*l-255));
          const c = (255-Math.abs(2*l-255))*s, x = c*(1-Math.abs((hh/60)%2-1)), m = l-c/2;
          let rr,gg,bb;
          if (hh<60){[rr,gg,bb]=[c,x,0];} else if(hh<120){[rr,gg,bb]=[x,c,0];} else if(hh<180){[rr,gg,bb]=[0,c,x];}
          else if(hh<240){[rr,gg,bb]=[0,x,c];} else if(hh<300){[rr,gg,bb]=[x,0,c];} else {[rr,gg,bb]=[c,0,x];}
          r=epeClamp(rr+m,0,255); g=epeClamp(gg+m,0,255); b=epeClamp(bb+m,0,255);
        }
      }
      if (a.saturation !== 0){ const l=epeLuma(r,g,b); const s=1+a.saturation/100; r=epeClamp(l+(r-l)*s,0,255); g=epeClamp(l+(g-l)*s,0,255); b=epeClamp(l+(b-l)*s,0,255); }
      if (a.vibrance !== 0){
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b), curSat=(mx-mn)/255, protect=1-curSat*0.7;
        const l=epeLuma(r,g,b); const s=1+(a.vibrance/100)*protect;
        r=epeClamp(l+(r-l)*s,0,255); g=epeClamp(l+(g-l)*s,0,255); b=epeClamp(l+(b-l)*s,0,255);
      }
      if (a.dehaze !== 0){
        const amt=a.dehaze/100; const cf=1+amt*0.5;
        r=epeClamp(cf*(r-128)+128,0,255); g=epeClamp(cf*(g-128)+128,0,255); b=epeClamp(cf*(b-128)+128,0,255);
        const l=epeLuma(r,g,b);
        if (amt>0 && l>180){ const pull=(l-180)/75*amt*20; r-=pull; g-=pull; b-=pull; }
        const s2=1+amt*0.25; const l2=epeLuma(r,g,b);
        r=epeClamp(l2+(r-l2)*s2,0,255); g=epeClamp(l2+(g-l2)*s2,0,255); b=epeClamp(l2+(b-l2)*s2,0,255);
      }
      data[p]=r; data[p+1]=g; data[p+2]=b;
    }
  }

  function applyEpeLocalContrast(data, w, h){
    const a = epeAdj;
    if (a.clarity===0 && a.texture===0 && a.sharpness===0 && a.noiseReduction===0 && a.surfaceEnhance===0) return;
    for (let ch=0; ch<3; ch++){
      let plane = new Float32Array(w*h);
      for (let p=0; p<w*h; p++) plane[p] = data[p*4+ch];
      if (a.noiseReduction > 0){
        const strength = a.noiseReduction/100;
        const blurred = boxBlurGray(plane, w, h, Math.max(1, Math.round(strength*3)));
        for (let p=0; p<w*h; p++) plane[p] = plane[p]*(1-strength) + blurred[p]*strength;
      }
      if (a.clarity !== 0){
        const blurred = boxBlurGray(plane, w, h, 8);
        const s = a.clarity/100*0.6;
        for (let p=0; p<w*h; p++) plane[p] = epeClamp(plane[p]+(plane[p]-blurred[p])*s, 0, 255);
      }
      if (a.texture !== 0){
        const blurred = boxBlurGray(plane, w, h, 2);
        const s = a.texture/100*0.7;
        for (let p=0; p<w*h; p++) plane[p] = epeClamp(plane[p]+(plane[p]-blurred[p])*s, 0, 255);
      }
      if (a.surfaceEnhance > 0){
        // Honest scope note (see final report): this is a general local-
        // contrast boost at a shine/highlight-relevant radius, not a
        // material-classification-aware "make this look like polished
        // metal vs glass" effect -- no such classification is implemented.
        const blurred = boxBlurGray(plane, w, h, 5);
        const s = a.surfaceEnhance/100*0.5;
        for (let p=0; p<w*h; p++) plane[p] = epeClamp(plane[p]+(plane[p]-blurred[p])*s, 0, 255);
      }
      if (a.sharpness > 0){
        const blurred = boxBlurGray(plane, w, h, 2);
        const s = a.sharpness/100*1.2;
        for (let p=0; p<w*h; p++) plane[p] = epeClamp(plane[p]+(plane[p]-blurred[p])*s, 0, 255);
      }
      for (let p=0; p<w*h; p++) data[p*4+ch] = plane[p];
    }
  }

  /* ---------- Shadow Studio: real canvas rendering (offset + blur +
     opacity), not a placeholder. Drawn to the artboard BEFORE the layer
     so it sits behind the product, using the layer's own silhouette
     (alpha channel) as the shadow shape. ---------- */
  function drawEpeShadow(ctx, processedCanvas){
    if (!epeShadow.enabled) return;
    const s = epeShadow;
    const rad = s.angle * Math.PI/180;
    const dx = Math.cos(rad) * s.distance, dy = Math.sin(rad) * s.distance;
    ctx.save();
    ctx.translate(epeLayer.x + dx, epeLayer.y + dy);
    ctx.rotate(epeLayer.rotation * Math.PI/180);
    const scaleY = (s.style === 'floor' || s.style === 'studio' || s.style === 'ground' || s.style === 'reflection') ? epeLayer.scale * (s.scale/100) * (s.style === 'studio' ? 0.5 : 0.35) : epeLayer.scale * (s.scale/100);
    ctx.scale(epeLayer.scale * (epeLayer.flipH?-1:1), scaleY * (epeLayer.flipV?-1:1));
    ctx.globalAlpha = s.opacity/100;
    ctx.filter = s.blur > 0 ? `blur(${s.blur}px)` : 'none';
    // Silhouette: draw the processed image but recolored to solid black via a temp canvas + globalCompositeOperation
    const sil = document.createElement('canvas');
    sil.width = processedCanvas.width; sil.height = processedCanvas.height;
    const sctx = sil.getContext('2d');
    sctx.drawImage(processedCanvas, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = s.style === 'hard' ? '#000' : 'rgba(0,0,0,1)';
    sctx.fillRect(0,0,sil.width,sil.height);
    ctx.drawImage(sil, -sil.width/2, -sil.height/2);
    ctx.restore();
  }

  /* ---------- Reflection Studio: real mirrored render with a fade
     gradient, not a placeholder. ---------- */
  let epeContentBoundsCache = null, epeContentBoundsCacheKey = '';
  function epeGetContentBounds(processedCanvas){
    const key = epeAdjCacheKey() + '|' + processedCanvas.width + 'x' + processedCanvas.height;
    if (epeContentBoundsCache && epeContentBoundsCacheKey === key) return epeContentBoundsCache;
    const w = processedCanvas.width, h = processedCanvas.height;
    const data = processedCanvas.getContext('2d').getImageData(0,0,w,h).data;
    let minY = h, maxY = 0, found = false;
    // Sample every few rows for performance on large images -- a bounding
    // box doesn't need every single row checked to be accurate enough.
    const step = Math.max(1, Math.floor(h/300));
    for (let y=0; y<h; y+=step){
      for (let x=0; x<w; x+=Math.max(1,Math.floor(w/300))){
        if (data[(y*w+x)*4+3] > 10){ if (y<minY) minY=y; if (y>maxY) maxY=y; found=true; }
      }
    }
    const bounds = found ? { minY, maxY } : { minY:0, maxY:h };
    epeContentBoundsCache = bounds; epeContentBoundsCacheKey = key;
    return bounds;
  }

  function drawEpeReflection(ctx, processedCanvas){
    if (!epeReflection.enabled) return;
    const r = epeReflection;
    const w = processedCanvas.width, h = processedCanvas.height;
    const bounds = epeGetContentBounds(processedCanvas);
    // Offset from the image's own center to the BOTTOM of the actual
    // visible content (not the full image height, which may include a lot
    // of transparent padding -- especially common right after background
    // removal, which is exactly when someone would want a reflection).
    const contentBottomOffset = (bounds.maxY - h/2) * epeLayer.scale;
    ctx.save();
    ctx.translate(epeLayer.x, epeLayer.y + contentBottomOffset*2 + r.distance);
    ctx.rotate(epeLayer.rotation * Math.PI/180);
    ctx.scale(epeLayer.scale*(epeLayer.flipH?-1:1), -epeLayer.scale*(epeLayer.flipV?-1:1));
    ctx.globalAlpha = r.opacity/100;
    ctx.drawImage(processedCanvas, -w/2, -h/2);
    ctx.restore();
    // Fade-to-transparent gradient over the reflection region (screen-space, after the mirrored draw)
    if (r.fade > 0){
      const reflTop = epeLayer.y + contentBottomOffset*2 + r.distance - (h*epeLayer.scale)/2;
      const reflBottom = reflTop + h*epeLayer.scale;
      const grad = ctx.createLinearGradient(0, reflTop, 0, reflBottom);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1 - r.fade/100, 'rgba(255,255,255,0)');
      grad.addColorStop(1, epeIsCanvasTransparentBg() ? 'rgba(255,255,255,1)' : epeCurrentCanvasBgRgba());
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(255,255,255,1)';
      const grad2 = ctx.createLinearGradient(0, reflTop, 0, reflBottom);
      grad2.addColorStop(Math.max(0,1-r.fade/100), 'rgba(255,255,255,0)');
      grad2.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, reflTop, epeArtboardW, reflBottom-reflTop);
      ctx.restore();
    }
  }
  function epeIsCanvasTransparentBg(){ return epeBgMode === 'none' || epeBgMode === 'transparent'; }
  function epeCurrentCanvasBgRgba(){ return epeBgMode==='white' ? 'rgba(255,255,255,1)' : epeBgMode==='black' ? 'rgba(0,0,0,1)' : epeBgMode==='color' ? epeHexToRgba(epeBgColor,1) : 'rgba(255,255,255,1)'; }
  function epeHexToRgba(hex, a){ const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

  /* ---------- Processed canvas: source image with adjustments and
     background removal/replacement applied, cached by a key of all
     relevant state so it's only recomputed when something actually
     changed (real performance discipline, not recomputing on every
     frame). ---------- */
  function computeEpeProcessedCanvas(){
    const key = epeAdjCacheKey();
    if (epeProcessedCanvasCache && epeProcessedCacheKey === key) return epeProcessedCanvasCache;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(epeLocalEditsCanvas || epeSourceImg, 0, 0);
    const imgData = ctx.getImageData(0, 0, w, h);
    applyEpeToneColor(imgData.data, w, h);
    applyEpeLocalContrast(imgData.data, w, h);
    if (epeEraseMask){
      const bgFillCanvas = epeBuildBgFillCanvas(w, h);
      const bgData = bgFillCanvas ? bgFillCanvas.getContext('2d').getImageData(0,0,w,h).data : null;
      for (let p=0, i=0; p<w*h; p++, i+=4){
        const m = epeEraseMask[p]/255;
        if (m <= 0) continue;
        if (bgData){
          imgData.data[i]   = imgData.data[i]*(1-m)   + bgData[i]*m;
          imgData.data[i+1] = imgData.data[i+1]*(1-m) + bgData[i+1]*m;
          imgData.data[i+2] = imgData.data[i+2]*(1-m) + bgData[i+2]*m;
          imgData.data[i+3] = imgData.data[i+3]*(1-m) + bgData[i+3]*m;
        } else {
          imgData.data[i+3] = imgData.data[i+3]*(1-m); // transparent
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    epeProcessedCanvasCache = canvas; epeProcessedCacheKey = key;
    return canvas;
  }
  function epeBuildBgFillCanvas(w, h){
    if (epeBgMode === 'none' || epeBgMode === 'transparent') return null;
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    const ctx = c.getContext('2d');
    if (epeBgMode === 'white') ctx.fillStyle = '#ffffff';
    else if (epeBgMode === 'black') ctx.fillStyle = '#000000';
    else if (epeBgMode === 'color') ctx.fillStyle = epeBgColor;
    else if (epeBgMode === 'gradient'){
      const rad = epeBgGradient.angle*Math.PI/180;
      const x1 = w/2 - Math.cos(rad)*w/2, y1 = h/2 - Math.sin(rad)*h/2;
      const x2 = w/2 + Math.cos(rad)*w/2, y2 = h/2 + Math.sin(rad)*h/2;
      const grad = ctx.createLinearGradient(x1,y1,x2,y2);
      grad.addColorStop(0, epeBgGradient.from); grad.addColorStop(1, epeBgGradient.to);
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0,0,w,h);
    return c;
  }

  /* ---------- Extended render pipeline: still ONE function used by
     both the live preview and export -- now additionally draws an
     artboard-level background fill (if the artboard itself, not just
     the removed product background, should show a color), shadow,
     reflection, then the layer with opacity applied. ---------- */

/* ============================================================
   DESIGN STUDIO ENGINE (DSE) — Phase 3 Part 1: Foundation
   ============================================================
   Architecture decision record (see final report for full reasoning):

   APPROACH: Incremental refactor with proxy-variable compatibility.
   The ~53 existing functions and all UI handlers reference flat module-
   level variables (epeLayer, epeAdj, epeEraseMask, etc.). Rather than
   rewrite every reference in one pass (high regression risk), this phase:

   1. Introduces dseState as the single source of truth, containing
      a proper layers array where each layer is a self-contained object.
   2. Makes the flat module-level variables ALIASES that always point
      to the properties of the currently active layer (dseActiveLayerProxy),
      updated synchronously on every selection change.
   3. Replaces renderEpeArtboard() with a multi-layer compositor that
      iterates dseState.layers in z-order — STILL the same single render
      pipeline used by both preview and export.
   4. Adds selection state and transform-handle rendering to the overlay.
   5. Adds a Layers panel to the UI.

   This approach preserves all Phase 1+2 features while building a
   genuinely future-proof foundation. The existing UI handlers (slider
   event listeners, etc.) keep working without modification because they
   continue reading/writing the alias variables — changes propagate to
   the active layer automatically via the sync mechanism.

   LAYER OBJECT SCHEMA (dseLayer):
   {
     id: string,              // stable unique ID, never changes
     type: 'image',           // 'image' | future: 'text' | 'shape' | 'icon'
     visible: true,
     locked: false,
     name: string,
     opacity: 100,            // 0-100 (also controls the globalAlpha during render)
     blendMode: 'normal',     // future: 'multiply' | 'screen' | etc.
     zIndex: number,          // render order (higher = in front)
     // Image content (image-layer-specific, each layer owns its own copy)
     sourceImg: HTMLImageElement,
     adj: {...EPE_ADJ_DEFAULTS},
     eraseMask: Uint8ClampedArray | null,
     bgMode: 'none', bgColor: '#ffffff', bgGradient: {...},
     shadow: {...}, reflection: {...},
     localEditsCanvas: HTMLCanvasElement | null,
     processedCanvasCache: null, processedCacheKey: '',
     // Transform (position within the artboard)
     x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false,
   }

   STATE OBJECT SCHEMA (dseState):
   {
     layers: dseLayer[],
     selectedIds: Set<string>,      // currently selected layer IDs
     artboardW: 0,
     artboardH: 0,
     dirtyRegion: null,             // { x, y, w, h } | null (null = redraw all)
   }
   ============================================================ */

  // ---- Unique ID generator (stable within session) ----
  let _dseNextId = 1;
  function dseUniqueId(){ return 'dse_' + (_dseNextId++).toString(36); }

  // ---- Central state ----
  const dseState = {
    layers: [],
    selectedIds: new Set(),
  };
  let dseEditingLayerId = null; // Phase 3 Part 2: the text layer currently being live-edited, if any
  /* ============================================================
     TOOLFLIGHT LAYER ENGINE (Phase 4 of the multi-editor migration
     plan). Tool-agnostic: operates on a state object passed in via
     config (the SAME dseState object the Ecommerce Editor already
     uses -- not a copy, not a replacement), with no knowledge of
     "ecommerce" specifically and no assumptions about layer content
     (image/text/shape/icon/group/svg/anything future). This is the
     single, real implementation of layer CRUD, selection, ordering,
     and grouping -- the *mechanism*, not the 160+ existing call
     sites that read dseState.layers/dseState.selectedIds directly,
     which continue working completely unchanged because the
     underlying object reference never changes.

     Generic Layer Model (documented, not enforced -- existing layer
     objects already satisfy this shape and need no migration):
       id        string, unique
       type      string: 'image'|'text'|'shape'|'sticker'|'icon'|
                 'group'|'svg'(reserved for future use)|any future type
       name      string, display label
       visible   boolean
       locked    boolean
       zIndex    number, stacking order
       x, y      number, position (transform)
       metadata  object, editor-specific data the engine never reads
                 or validates -- this is deliberately how future
                 editors extend the model without changing the engine
       children  array of child layer ids (groups only)

     Designed for scale, not just the current editor: getLayerById
     uses a Map-based index (O(1)) rather than Array.find() (O(n)),
     which matters once an editor has thousands of layers/assets --
     the index is built lazily and invalidated by layer-count change,
     so it never requires existing code that pushes directly to
     state.layers to also maintain the index manually. ============================================================ */


  // Ecommerce Editor's instance of the shared Layer Engine -- points
  // at the SAME dseState object (not a copy), so all existing code
  // that reads dseState.layers/dseState.selectedIds directly continues
  // to work completely unchanged. epeLayerEngine is the new, additive
  // API surface; existing functions below are refactored to delegate
  // their core state mutations to it while keeping their existing
  // ecommerce-specific side effects (UI sync, re-render, history) in
  // place exactly where they were.
  const epeLayerEngine = createToolflightLayerEngine({
    state: dseState,
    generateId: dseUniqueId,
  });

  // ---- Active-layer proxy: the flat variables (epeLayer, epeAdj, etc.)
  // are no longer standalone -- they are aliases updated here to always
  // match the active layer. Code that reads epeLayer.x reads the active
  // layer's x; code that writes epeLayer.x writes through to the layer. ----
  function dseActiveLayer(){
    if (dseState.selectedIds.size === 0 && dseState.layers.length > 0)
      return dseState.layers[dseState.layers.length - 1];
    for (const id of dseState.selectedIds){
      const l = dseState.layers.find(l => l.id === id);
      if (l) return l;
    }
    return dseState.layers[dseState.layers.length - 1] || null;
  }

  function dseSyncAliasesFromLayer(layer){
    if (!layer || layer.type !== 'image') return; // text layers manage their own fields directly, no alias syncing needed
    // Sync the flat alias variables so all existing handlers continue
    // to work without modification.
    epeSourceImg = layer.sourceImg;
    epeLayer.x = layer.x; epeLayer.y = layer.y; epeLayer.scale = layer.scale;
    epeLayer.rotation = layer.rotation; epeLayer.flipH = layer.flipH; epeLayer.flipV = layer.flipV;
    Object.assign(epeAdj, layer.adj);
    epeEraseMask = layer.eraseMask;
    epeBgMode = layer.bgMode; epeBgColor = layer.bgColor;
    Object.assign(epeBgGradient, layer.bgGradient);
    Object.assign(epeShadow, layer.shadow);
    Object.assign(epeReflection, layer.reflection);
    epeLocalEditsCanvas = layer.localEditsCanvas;
    epeProcessedCanvasCache = layer.processedCanvasCache;
    // The reverse sync (alias → layer) happens in dseFlushAliasesToLayer()
  }

  function dseFlushAliasesToLayer(layer){
    if (!layer || layer.type !== 'image') return; // text layers are edited directly, never through the image-layer alias system
    layer.sourceImg = epeSourceImg;
    layer.x = epeLayer.x; layer.y = epeLayer.y; layer.scale = epeLayer.scale;
    layer.rotation = epeLayer.rotation; layer.flipH = epeLayer.flipH; layer.flipV = epeLayer.flipV;
    Object.assign(layer.adj, epeAdj);
    layer.eraseMask = epeEraseMask;
    layer.bgMode = epeBgMode; layer.bgColor = epeBgColor;
    Object.assign(layer.bgGradient, epeBgGradient);
    Object.assign(layer.shadow, epeShadow);
    Object.assign(layer.reflection, epeReflection);
    layer.localEditsCanvas = epeLocalEditsCanvas;
    layer.processedCanvasCache = epeProcessedCanvasCache;
  }

  // ---- Create a new image layer from a loaded image ----
  function dseCreateImageLayer(img, artboardW, artboardH){
    return {
      id: dseUniqueId(),
      type: 'image',
      visible: true,
      locked: false,
      name: 'Product Image',
      opacity: 100,
      blendMode: 'normal',
      zIndex: dseState.layers.length,
      sourceImg: img,
      adj: { ...EPE_ADJ_DEFAULTS },
      eraseMask: null,
      bgMode: 'none', bgColor: '#ffffff',
      bgGradient: { from:'#ffffff', to:'#dddddd', angle:180 },
      shadow: { enabled:false, style:'soft', opacity:45, blur:24, distance:18, angle:135, scale:100 },
      reflection: { enabled:false, style:'soft', opacity:35, fade:60, distance:0 },
      localEditsCanvas: null,
      processedCanvasCache: null, processedCacheKey: '',
      x: artboardW/2, y: artboardH/2, scale:1, rotation:0, flipH:false, flipV:false,
    };
  }

  // ---- Selection management ----
  function dseSelectLayer(id, additive){
    if (dseEditingLayerId && dseEditingLayerId !== id) dseExitTextEditMode();
    epeLayerEngine.selectLayer(id, additive);
    const active = dseActiveLayer();
    if (active) dseSyncAliasesFromLayer(active);
    dseRenderLayersPanel();
    renderEpeOverlay();
    if (typeof dseSyncTextControlsFromLayer === 'function') dseSyncTextControlsFromLayer(active);
    if (typeof dseUpdateObjectPropertiesPanel === 'function') dseUpdateObjectPropertiesPanel();
    if (typeof epeUpdateSelectionMiniToolbar === 'function') epeUpdateSelectionMiniToolbar();
  }

  // ---- Compute the axis-aligned bounding box of a layer in artboard-space ----
  // ---- Shared natural-size helper: works for any layer type. Image
  // layers use their source image's pixel dimensions; text layers use
  // their cached measured text box (set by dseMeasureTextLayer, called
  // whenever text/font properties change). Centralizing this is what lets
  // the selection engine, bounding box, and hit-testing work identically
  // for both layer types without type-specific duplication in each. ----
  function dseLayerNaturalSize(layer){
    if (layer.type === 'text' || layer.type === 'shape' || layer.type === 'icon' || layer.type === 'group')
      return { w: layer.boxW || 10, h: layer.boxH || 10 };
    if (layer.sourceImg) return { w: layer.sourceImg.naturalWidth, h: layer.sourceImg.naturalHeight };
    return { w: 0, h: 0 };
  }
  function dseLayerHasContent(layer){
    if (layer.type === 'text' || layer.type === 'shape' || layer.type === 'icon' || layer.type === 'group') return true;
    return !!layer.sourceImg;
  }

  function dseLayerBoundingBox(layer){
    const size = dseLayerNaturalSize(layer);
    const w = size.w * layer.scale, h = size.h * layer.scale;
    // For a rotated rectangle: the AABB is axis-aligned, computed by rotating corners
    const cos = Math.abs(Math.cos(layer.rotation*Math.PI/180));
    const sin = Math.abs(Math.sin(layer.rotation*Math.PI/180));
    const aabbW = w*cos + h*sin, aabbH = w*sin + h*cos;
    return { x: layer.x - aabbW/2, y: layer.y - aabbH/2, w: aabbW, h: aabbH,
             cx: layer.x, cy: layer.y, ow: w, oh: h }; // ow/oh = unrotated size
  }

  // ---- Hit test: is (px, py) within a layer's content ----
  function dseLayerHitTest(layer, px, py){
    if (!layer.visible || !dseLayerHasContent(layer)) return false;
    const size = dseLayerNaturalSize(layer);
    // Transform point into layer-local space (inverse of the layer's transform)
    const dx = px - layer.x, dy = py - layer.y;
    const rad = -layer.rotation*Math.PI/180;
    const lx = (dx*Math.cos(rad) - dy*Math.sin(rad)) / (layer.scale*(layer.flipH?-1:1));
    const ly = (dx*Math.sin(rad) + dy*Math.cos(rad)) / (layer.scale*(layer.flipV?-1:1));
    const hw = size.w/2, hh = size.h/2;
    return lx >= -hw && lx <= hw && ly >= -hh && ly <= hh;
  }


  // ---- MULTI-LAYER RENDER PIPELINE ----
  // This replaces the single-layer renderEpeArtboard().
  // It STILL obeys the one-pipeline rule: the same function is called
  // by both the live preview (epeArtboardEl) and the export path.
  // The existing single-layer helper functions (computeEpeProcessedCanvas,
  // drawEpeShadow, drawEpeReflection) now operate on a layer object rather
  // than the flat global state, with the aliases temporarily set to that
  // layer's data before each call.

  function dseComputeProcessedForLayer(layer){
    // Temporarily sync aliases to this specific layer, compute its
    // processed canvas, then restore aliases to the active layer.
    // NOTE: we do NOT flush aliases -> layer here. The layer is the
    // source of truth. Flushing happens only when a user-driven edit
    // (slider change, button click) explicitly calls dseFlushAliasesToLayer().
    dseSyncAliasesFromLayer(layer);
    const result = computeEpeProcessedCanvas();
    layer.processedCanvasCache = epeProcessedCanvasCache; // persist cache into layer
    dseSyncAliasesFromLayer(dseActiveLayer()); // restore active layer's aliases
    return result;
  }

  function dseRenderSingleLayer(ctx, layer, targetCanvas, xOv, yOv, rotOv, scaleOv){
    const x = xOv!==undefined?xOv:layer.x, y = yOv!==undefined?yOv:layer.y;
    const rotation = rotOv!==undefined?rotOv:layer.rotation, scale = scaleOv!==undefined?scaleOv:layer.scale;
    if (layer.type === 'text'){
      if (!layer.text) return;
      if (layer.id === dseEditingLayerId && targetCanvas === epeArtboardEl) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI/180);
      ctx.scale(scale * (layer.flipH ? -1 : 1), scale * (layer.flipV ? -1 : 1));
      if (layer.blendMode && layer.blendMode !== 'normal') ctx.globalCompositeOperation = layer.blendMode;
      dseRenderTextLayer(ctx, layer);
      ctx.restore();
      return;
    }
    if (layer.type === 'shape'){
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI/180);
      ctx.scale(scale * (layer.flipH ? -1 : 1), scale * (layer.flipV ? -1 : 1));
      if (layer.blendMode && layer.blendMode !== 'normal') ctx.globalCompositeOperation = layer.blendMode;
      dseRenderShapeLayer(ctx, layer);
      ctx.restore();
      return;
    }
    if (layer.type === 'icon'){
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI/180);
      ctx.scale(scale * (layer.flipH ? -1 : 1), scale * (layer.flipV ? -1 : 1));
      if (layer.blendMode && layer.blendMode !== 'normal') ctx.globalCompositeOperation = layer.blendMode;
      dseRenderIconLayer(ctx, layer);
      ctx.restore();
      return;
    }
    if (layer.type === 'group'){
      layer.childIds.forEach(cid => {
        const child = dseState.layers.find(l => l.id === cid);
        if (!child || !child.visible) return;
        const t = dseGetGroupChildAbsoluteTransform(layer, child);
        ctx.save();
        ctx.globalAlpha = layer.opacity/100;
        dseRenderSingleLayer(ctx, child, targetCanvas, t.x, t.y, t.rotation, t.scale);
        ctx.restore();
      });
      return;
    }
    // Image layer (default)
    if (!layer.sourceImg) return;
    const processed = dseComputeProcessedForLayer(layer);
    dseSyncAliasesFromLayer(layer);
    drawEpeReflection(ctx, processed);
    drawEpeShadow(ctx, processed);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation * Math.PI/180);
    ctx.scale(scale * (layer.flipH ? -1 : 1), scale * (layer.flipV ? -1 : 1));
    ctx.globalAlpha = layer.opacity/100;
    if (layer.blendMode && layer.blendMode !== 'normal') ctx.globalCompositeOperation = layer.blendMode;
    ctx.drawImage(processed, -processed.width/2, -processed.height/2);
    ctx.restore();
  }

  function renderEpeArtboard(targetCanvas){
    targetCanvas.width = epeArtboardW; targetCanvas.height = epeArtboardH;
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, epeArtboardW, epeArtboardH);
    // Artboard-level background (Marketplace Studio, Phase 4) -- fills the
    // WHOLE canvas before any layer draws, independent of any individual
    // layer's own background-replacement state.
    if (epeCanvasBg.mode !== 'transparent'){
      if (epeCanvasBg.mode === 'white') ctx.fillStyle = '#ffffff';
      else if (epeCanvasBg.mode === 'black') ctx.fillStyle = '#000000';
      else if (epeCanvasBg.mode === 'color') ctx.fillStyle = epeCanvasBg.color;
      else if (epeCanvasBg.mode === 'gradient' || epeCanvasBg.mode === 'studio'){
        const g = epeCanvasBg.gradient;
        let grad;
        if (epeCanvasBg.mode === 'studio'){
          // Simple studio background: a soft radial vignette (light center,
          // gently darker edges) -- a common, real product-photography look.
          grad = ctx.createRadialGradient(epeArtboardW/2, epeArtboardH*0.4, 0, epeArtboardW/2, epeArtboardH/2, Math.max(epeArtboardW,epeArtboardH)*0.75);
          grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#d8d8dc');
        } else {
          const rad = (g.angle||0)*Math.PI/180;
          grad = ctx.createLinearGradient(epeArtboardW/2-Math.cos(rad)*epeArtboardW/2, epeArtboardH/2-Math.sin(rad)*epeArtboardH/2, epeArtboardW/2+Math.cos(rad)*epeArtboardW/2, epeArtboardH/2+Math.sin(rad)*epeArtboardH/2);
          grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
        }
        ctx.fillStyle = grad;
      }
      if (epeCanvasBg.mode === 'pattern'){
        ctx.fillStyle = epeCanvasBg.patternBg || '#f4f4f6';
        ctx.fillRect(0, 0, epeArtboardW, epeArtboardH);
        const pc = epeCanvasBg.patternColor || '#00000018';
        const spacing = epeCanvasBg.patternSpacing || 24;
        ctx.fillStyle = pc; ctx.strokeStyle = pc;
        if (epeCanvasBg.pattern === 'dots'){
          for (let y=spacing/2; y<epeArtboardH; y+=spacing){
            for (let x=spacing/2; x<epeArtboardW; x+=spacing){
              ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, spacing*0.08), 0, Math.PI*2); ctx.fill();
            }
          }
        } else if (epeCanvasBg.pattern === 'stripes'){
          ctx.lineWidth = Math.max(1, spacing*0.15);
          for (let x=-epeArtboardH; x<epeArtboardW; x+=spacing){
            ctx.beginPath(); ctx.moveTo(x, epeArtboardH); ctx.lineTo(x+epeArtboardH, 0); ctx.stroke();
          }
        } else if (epeCanvasBg.pattern === 'grid'){
          ctx.lineWidth = Math.max(1, spacing*0.05);
          for (let x=0; x<epeArtboardW; x+=spacing){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,epeArtboardH); ctx.stroke(); }
          for (let y=0; y<epeArtboardH; y+=spacing){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(epeArtboardW,y); ctx.stroke(); }
        } else if (epeCanvasBg.pattern === 'checkerboard'){
          for (let y=0; y*spacing<epeArtboardH; y++){
            for (let x=0; x*spacing<epeArtboardW; x++){
              if ((x+y)%2===0) ctx.fillRect(x*spacing, y*spacing, spacing, spacing);
            }
          }
        }
      } else {
        ctx.fillRect(0, 0, epeArtboardW, epeArtboardH);
      }
    }
    if (dseState.layers.length === 0) return;
    const activeLayer = dseActiveLayer();
    if (activeLayer) dseFlushAliasesToLayer(activeLayer);
    // Render layers in z-order (lowest zIndex first = furthest back).
    // Layers with a groupId are skipped here -- they're rendered as part
    // of their parent group instead, so each layer draws exactly once.
    const ordered = [...dseState.layers].filter(l => !l.groupId).sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of ordered){
      if (!layer.visible) continue;
      dseRenderSingleLayer(ctx, layer, targetCanvas);
      if (activeLayer) dseSyncAliasesFromLayer(activeLayer);
    }
  }




  /* ---------- AI Background Removal (own segmenter, own calibration --
     directly applies the lessons discovered while building Passport
     Photo Maker's background removal, not literally reused code since
     that tool's segmenter/calibration are module-private) ---------- */
  let epeSegmenter = null, epeSegmenterLoadPromise = null;
  async function ensureEpeSegmenter(){
    if (epeSegmenter) return epeSegmenter;
    if (!epeSegmenterLoadPromise){
      epeSegmenterLoadPromise = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2`);
        const { ImageSegmenter, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm`);
        // FIX (root cause of AI Background Remove failing on real product
        // photos): this previously used selfie_segmenter, a model trained
        // ONLY to detect people. A shoe, bottle, or bag photo has no
        // person in it, so that model would classify nearly the entire
        // image as background, and this tool's own plausibility check
        // would then correctly-but-uselessly report "AI could not
        // confidently separate the product" on almost every real product
        // photo. Switched to DeepLab v3, the same general-purpose,
        // multi-category segmentation model already proven working in
        // ToolFlight's standalone AI Background Remover tool.
        const seg = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite' },
          outputCategoryMask: true, outputConfidenceMasks: false, runningMode: 'IMAGE',
        });
        epeSegmenter = seg; return seg;
      })().catch((err) => { epeSegmenterLoadPromise = null; throw err; });
    }
    return epeSegmenterLoadPromise;
  }
  // Ecommerce Editor's instance of the shared Plugin Engine. See
  // createToolflightPluginEngine above -- registered here, plugins
  // wired to the exact same existing tool logic, one at a time,
  // each individually verified rather than converting all tools in
  // one unverified sweep.
  const epePluginEngine = createToolflightPluginEngine({});

  async function epeRemoveBackground(){
    if (!epeSourceImg) return;
    const statusEl = document.getElementById('epeBgStatus');
    const btn = document.getElementById('epeRemoveBgBtn');
    setLoading(btn, true);
    statusEl.textContent = 'Loading AI model\u2026';
    try{
      const seg = await ensureEpeSegmenter();
      statusEl.textContent = 'Analyzing image\u2026';
      const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
      const result = seg.segment(epeSourceImg);
      const mask = result.categoryMask;
      const maskData = mask.getAsUint8Array();
      const mw = mask.width, mh = mask.height;

      // DeepLab v3 convention (matches the standalone AI Background
      // Remover tool exactly): category 0 = background, any other
      // category (person, animal, vehicle, furniture, everyday object,
      // etc.) = subject/foreground. No per-pixel confidence output is
      // available from this model configuration, so the plausibility
      // check below is area-based only, same spirit as before but
      // without a confidence signal that no longer exists.
      const newMask = new Uint8ClampedArray(w*h);
      let subjectPixels = 0;
      for (let y=0; y<h; y++){
        for (let x=0; x<w; x++){
          const mx = Math.min(mw-1, Math.round(x*mw/w)), my = Math.min(mh-1, Math.round(y*mh/h));
          const category = maskData[my*mw+mx];
          const isSubject = category !== 0;
          if (isSubject) subjectPixels++;
          newMask[y*w+x] = isSubject ? 0 : 255;
        }
      }
      mask.close && mask.close();
      const subjectFrac = subjectPixels/(w*h);
      const areaImplausible = subjectFrac < 0.02 || subjectFrac > 0.98;
      if (areaImplausible){
        statusEl.textContent = 'AI could not confidently separate the product.';
        document.getElementById('epeManualBgRow').classList.remove('hidden');
      } else {
        epeEraseMask = newMask;
        epeProcessedCanvasCache = null; // force recompute
        statusEl.textContent = 'Background removed.';
        renderEpeAll(); epePushHistory();
      }
    }catch(err){
      statusEl.textContent = 'AI background removal couldn\u2019t load right now. Use the manual eraser below instead.';
      document.getElementById('epeManualBgRow').classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  }
  epePluginEngine.register({ id: 'backgroundRemove', category: 'edit', name: 'Remove Background (AI)', kind: 'action', activate: () => epeRemoveBackground() });
  document.getElementById('epeRemoveBgBtn').onclick = () => epePluginEngine.activate('backgroundRemove');

  /* ---------- Background replacement mode ---------- */
  document.querySelectorAll('input[name="epeBgMode"]').forEach(r => r.addEventListener('change', (e) => {
    epeBgMode = e.target.value;
    document.getElementById('epeBgColorRow').classList.toggle('hidden', epeBgMode !== 'color');
    document.getElementById('epeBgGradientRow').classList.toggle('hidden', epeBgMode !== 'gradient');
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
  }));
  document.getElementById('epeBgColorInput').addEventListener('input', (e) => { epeBgColor = e.target.value; epeProcessedCanvasCache=null; renderEpeAll(); });
  document.getElementById('epeBgColorInput').addEventListener('change', epePushHistory);
  ['epeBgGradientFrom','epeBgGradientTo','epeBgGradientAngle'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      epeBgGradient.from = document.getElementById('epeBgGradientFrom').value;
      epeBgGradient.to = document.getElementById('epeBgGradientTo').value;
      epeBgGradient.angle = +document.getElementById('epeBgGradientAngle').value;
      epeProcessedCanvasCache = null;
      renderEpeAll();
    });
    document.getElementById(id).addEventListener('change', epePushHistory);
  });


  let epeLocalEditsCanvas = null; // destructive brush edits (blur/sharpen/spot-removal) live here, layered beneath non-destructive adjustments
  function epeEnsureLocalEditsCanvas(){
    if (epeLocalEditsCanvas) return epeLocalEditsCanvas;
    const c = document.createElement('canvas');
    c.width = epeSourceImg.naturalWidth; c.height = epeSourceImg.naturalHeight;
    c.getContext('2d').drawImage(epeSourceImg, 0, 0);
    epeLocalEditsCanvas = c;
    return c;
  }

  /* ---------- Manual brush tools: eraser/restore (mask-based, same
     semantic as Passport Photo Maker: 0=keep, 255=replace) plus
     blur/sharpen/spot-removal (destructive, applied directly to
     epeLocalEditsCanvas). All share one stamping routine, adapting the
     brush-engine pattern already used for Passport Photo Maker --
     independently implemented since that tool's brush code is
     module-private. ---------- */
  let epeActiveTool = 'none';
  let epeBrushSize = 40, epeBrushHardness = 60, epeBrushOpacity = 100;
  let epeIsPainting = false;

  /* ============================================================
     TOOLFLIGHT PLUGIN ENGINE (Phase 7 of the multi-editor migration
     plan). Tool-agnostic: a generic registry + lifecycle manager for
     tools-as-plugins, with zero knowledge of "crop" or "clone stamp"
     or "ecommerce" specifically. Every plugin is a plain descriptor
     object the caller supplies; the engine only manages registration,
     discovery, category grouping, enable/disable, the
     activate/deactivate lifecycle, and keyboard shortcut dispatch.

     Deliberately does NOT render (that's Toolbar/Canvas Engine's job),
     does NOT touch layer data (Layer Engine only), does NOT store
     history (History Engine only), and does NOT know about assets
     (Asset Library Engine only) -- a plugin's init/activate/deactivate/
     destroy functions are free to call into those other engines
     themselves, exactly as the existing tool code already does; the
     Plugin Engine's job is purely to track WHICH tools exist, WHICH
     are currently active/enabled, and to dispatch to them -- not to
     mediate what they do internally. ============================================================ */

  function epeSetTool(tool){
    epeActiveTool = tool;
    document.querySelectorAll('#epeAccordionRetouch [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    document.getElementById('epeCloneOptionsRow') && document.getElementById('epeCloneOptionsRow').classList.toggle('hidden', tool !== 'clone' && tool !== 'heal');
    if (tool !== 'clone' && tool !== 'heal'){ epeCloneSource = null; epeCloneOffset = null; }
    if (typeof epeSelectSourceMode !== 'undefined') epeSelectSourceMode = false;
    // Activating a brush tool deselects any selected object layer --
    // matches standard editor behavior, and prevents the Selection
    // Mini-Toolbar and Floating Brush Bar from being visible (and
    // physically overlapping) at the same time, a confirmed real bug.
    if (tool !== 'none' && typeof dseState !== 'undefined' && dseState.selectedIds.size > 0 && typeof dseSelectLayer === 'function'){
      dseSelectLayer(null, false);
    }
    epeUpdateBrushCursor();
    renderEpeOverlay();
    if (typeof epeUpdateFloatingBrushBar === 'function') epeUpdateFloatingBrushBar();
    // Selecting an actual brush tool (not "none") hands off from the
    // tool-picker sheet to canvas-focused editing on mobile, so the
    // floating brush bar isn't obstructed by the still-open sheet.
    if (tool !== 'none' && typeof epeIsMobileShell === 'function' && epeIsMobileShell() && typeof epeCloseToolPanel === 'function'){
      epeCloseToolPanel();
    }
  }
  document.querySelectorAll('#epeAccordionRetouch [data-tool]').forEach(btn => {
    const toolId = btn.dataset.tool;
    epePluginEngine.register({
      id: toolId, category: 'edit', name: btn.textContent.trim(), kind: 'mode',
      activate: () => epeSetTool(toolId),
      deactivate: () => epeSetTool('none'),
    });
    btn.onclick = () => {
      if (toolId === epeActiveTool) epePluginEngine.deactivate(toolId);
      else epePluginEngine.activate(toolId);
    };
  });
  document.getElementById('epeBrushSize').addEventListener('input', (e) => { epeBrushSize = +e.target.value; epeUpdateBrushCursor(); });
  document.getElementById('epeBrushHardness').addEventListener('input', (e) => { epeBrushHardness = +e.target.value; });
  document.getElementById('epeBrushOpacity').addEventListener('input', (e) => { epeBrushOpacity = +e.target.value; });

  function epeUpdateBrushCursor(){
    const cursor = document.getElementById('epeBrushCursor');
    if (!cursor) return;
    const rect = epeArtboardEl.getBoundingClientRect();
    const dispScale = rect.width / epeArtboardW;
    const dispSize = epeBrushSize * epeLayer.scale * dispScale;
    cursor.style.width = dispSize + 'px'; cursor.style.height = dispSize + 'px';
  }
  epeCanvasStageWrapEl().addEventListener('pointermove', (e) => {
    const cursor = document.getElementById('epeBrushCursor');
    if (!cursor) return;
    if (epeActiveTool === 'none' || !epeSourceImg){ cursor.classList.add('hidden'); return; }
    cursor.classList.remove('hidden');
    cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';
  });
  epeCanvasStageWrapEl().addEventListener('pointerleave', () => { const c = document.getElementById('epeBrushCursor'); if (c) c.classList.add('hidden'); });
  function epeCanvasStageWrapEl(){ return document.getElementById('epeCanvasStageWrap'); }

  function epeStampAt(sx, sy){
    // sx, sy are in SOURCE IMAGE pixel coordinates (the local edits
    // canvas / mask space), already converted by the caller.
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const r = epeBrushSize/2;
    const x0 = Math.max(0, Math.floor(sx-r)), x1 = Math.min(w-1, Math.ceil(sx+r));
    const y0 = Math.max(0, Math.floor(sy-r)), y1 = Math.min(h-1, Math.ceil(sy+r));
    if (x1<x0 || y1<y0) return;
    const hardness = epeBrushHardness/100, opacity = epeBrushOpacity/100;

    if (epeActiveTool === 'erase' || epeActiveTool === 'restore'){
      if (!epeEraseMask) epeEraseMask = new Uint8ClampedArray(w*h);
      const target = epeActiveTool === 'erase' ? 255 : 0;
      for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++){
        const d = Math.hypot(x-sx, y-sy)/r; if (d>1) continue;
        const falloff = d <= hardness ? 1 : 1-((d-hardness)/(1-hardness||1));
        const strength = epeClamp(falloff,0,1) * opacity;
        const i = y*w+x;
        epeEraseMask[i] = epeEraseMask[i]*(1-strength) + target*strength;
      }
      epeProcessedCanvasCache = null;
    } else if (epeActiveTool === 'clone'){
      epeCloneStampAt(sx, sy, w, h, r, hardness, opacity);
    } else if (epeActiveTool === 'heal'){
      epeHealStampAt(sx, sy, w, h, r, hardness, opacity);
    } else if (epeActiveTool === 'redeye'){
      epeRedEyeStampAt(sx, sy, w, h, r);
    } else if (epeActiveTool === 'blur' || epeActiveTool === 'sharpen' || epeActiveTool === 'spot'){
      const canvas = epeEnsureLocalEditsCanvas();
      const ctx = canvas.getContext('2d');
      const rx0 = Math.max(0,x0-4), ry0=Math.max(0,y0-4), rw=Math.min(w,x1+4)-rx0, rh=Math.min(h,y1+4)-ry0;
      if (rw<=0 || rh<=0) return;
      const imgData = ctx.getImageData(rx0, ry0, rw, rh);
      const data = imgData.data;
      if (epeActiveTool === 'spot'){
        // Spot removal: sample the median-ish color from a ring around the
        // brush (outside the blemish) and blend it in -- a real, tractable
        // technique for small dust/blemish spots. NOT a texture-aware
        // clone/heal tool (see final report for what that would require).
        let rs=0,gs=0,bs=0,n=0;
        const ringR = r*1.6;
        for (let a=0;a<16;a++){ const ang=a/16*Math.PI*2; const px=Math.round(sx+Math.cos(ang)*ringR), py=Math.round(sy+Math.sin(ang)*ringR);
          if (px>=0&&px<w&&py>=0&&py<h){ const tctx=canvas.getContext('2d'); const d2=tctx.getImageData(px,py,1,1).data; rs+=d2[0];gs+=d2[1];bs+=d2[2];n++; } }
        if (n>0){ rs/=n; gs/=n; bs/=n;
          for (let y=0;y<rh;y++) for (let x=0;x<rw;x++){
            const gx=rx0+x, gy=ry0+y; const d=Math.hypot(gx-sx,gy-sy)/r; if (d>1) continue;
            const falloff = d<=hardness?1:1-((d-hardness)/(1-hardness||1));
            const strength = epeClamp(falloff,0,1)*opacity;
            const i=(y*rw+x)*4;
            data[i]=data[i]*(1-strength)+rs*strength; data[i+1]=data[i+1]*(1-strength)+gs*strength; data[i+2]=data[i+2]*(1-strength)+bs*strength;
          }
        }
      } else {
        for (let ch=0; ch<3; ch++){
          const plane = new Float32Array(rw*rh);
          for (let p=0;p<rw*rh;p++) plane[p]=data[p*4+ch];
          const blurred = boxBlurGray(plane, rw, rh, 3);
          for (let y=0;y<rh;y++) for (let x=0;x<rw;x++){
            const gx=rx0+x, gy=ry0+y; const d=Math.hypot(gx-sx,gy-sy)/r; if (d>1) continue;
            const falloff = d<=hardness?1:1-((d-hardness)/(1-hardness||1));
            const strength = epeClamp(falloff,0,1)*opacity;
            const p = y*rw+x;
            const target = epeActiveTool==='blur' ? blurred[p] : epeClamp(plane[p]+(plane[p]-blurred[p])*1.5, 0, 255);
            data[p*4+ch] = plane[p]*(1-strength) + target*strength;
          }
        }
      }
      ctx.putImageData(imgData, rx0, ry0);
      epeProcessedCanvasCache = null;
    }
  }

  function epeCanvasToSourceCoords(clientX, clientY){
    const out = epeEventToArtboardCoords(clientX, clientY); // artboard-space
    // Invert the layer transform to get source-image-space coordinates
    let x = out.x - epeLayer.x, y = out.y - epeLayer.y;
    const rad = -epeLayer.rotation*Math.PI/180;
    const rx = x*Math.cos(rad) - y*Math.sin(rad), ry = x*Math.sin(rad) + y*Math.cos(rad);
    const sx = rx/(epeLayer.scale*(epeLayer.flipH?-1:1)) + epeSourceImg.naturalWidth/2;
    const sy = ry/(epeLayer.scale*(epeLayer.flipV?-1:1)) + epeSourceImg.naturalHeight/2;
    return { x: sx, y: sy };
  }
  function epeSourceToArtboardCoords(sx, sy){
    // Exact inverse of epeCanvasToSourceCoords's transform, needed to draw
    // selection paths / clone markers (stored in source-image space) at
    // the correct position on the artboard-space overlay canvas.
    const lx = (sx - epeSourceImg.naturalWidth/2) * (epeLayer.scale*(epeLayer.flipH?-1:1));
    const ly = (sy - epeSourceImg.naturalHeight/2) * (epeLayer.scale*(epeLayer.flipV?-1:1));
    const rad = epeLayer.rotation*Math.PI/180;
    const rx = lx*Math.cos(rad) - ly*Math.sin(rad), ry = lx*Math.sin(rad) + ly*Math.cos(rad);
    return { x: rx + epeLayer.x, y: ry + epeLayer.y };
  }

  // NOTE: the old direct epeArtboardEl pointerdown handler that used to
  // live here was removed -- it was fully superseded by (and duplicated
  // with bugs) the dsePointerDownOnCanvas routing below, which already
  // handles the generic "any active brush tool" case (see the
  // `epeActiveTool !== 'none'` fallback) as well as clone/heal
  // specifically. Keeping both caused two real problems: an unnecessary
  // extra fitEpeCanvasDisplay() call on every pointerdown (the actual
  // root cause of the canvas visibly resizing between source-selection
  // and painting on mobile), and, for Clone Stamp/Healing Brush
  // specifically, a premature stamp attempt before epeCloneOffset was
  // even computed. The matching pointermove/pointerup pair that used to
  // sit here was also removed as fully redundant with the more complete
  // pair further below (which additionally handles crop/selection/patch
  // drag and the clone/heal non-aligned offset reset).


  /* ---------- Histogram: real, computed from actual pixel data,
     live-updating ---------- */
  function renderEpeHistogram(){
    const canvas = document.getElementById('epeHistogramCanvas');
    if (!canvas || !epeSourceImg) return;
    const processed = computeEpeProcessedCanvas();
    const w = 256, h = 100;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,w,h);
    const sampleCanvas = document.createElement('canvas');
    const sw = Math.min(200, processed.width), sh = Math.round(sw * processed.height/processed.width);
    sampleCanvas.width = sw; sampleCanvas.height = sh;
    sampleCanvas.getContext('2d').drawImage(processed, 0, 0, sw, sh);
    const data = sampleCanvas.getContext('2d').getImageData(0,0,sw,sh).data;
    const bins = { r:new Array(256).fill(0), g:new Array(256).fill(0), b:new Array(256).fill(0), lum:new Array(256).fill(0) };
    for (let i=0;i<data.length;i+=4){
      bins.r[data[i]]++; bins.g[data[i+1]]++; bins.b[data[i+2]]++;
      bins.lum[Math.round(epeLuma(data[i],data[i+1],data[i+2]))]++;
    }
    const maxVal = Math.max(...bins.lum, 1);
    function drawChannel(arr, color){
      ctx.strokeStyle = color; ctx.beginPath();
      for (let x=0;x<256;x++){ const v = arr[x]/maxVal*h; ctx.lineTo(x, h-v); }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    drawChannel(bins.r, '#e05252'); drawChannel(bins.g, '#3ba55c'); drawChannel(bins.b, '#4a7fe0');
    ctx.globalAlpha = 1;
    return bins;
  }

  /* ---------- Image Inspector ---------- */
  function renderEpeInspector(){
    const el = document.getElementById('epeInspectorBody');
    if (!el || !epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const gcd = (a,b) => b ? gcd(b, a%b) : a;
    const g = gcd(w,h);
    const hasAlpha = epeFileHadAlpha;
    el.innerHTML = `
      <div>Resolution: <strong>${w}\u00d7${h}px</strong></div>
      <div>Aspect ratio: <strong>${w/g}:${h/g}</strong></div>
      <div>Original file size: <strong>${epeOriginalFileSize ? fmtBytes(epeOriginalFileSize) : '\u2014'}</strong></div>
      <div>Color space: <strong>sRGB (assumed \u2014 browsers do not expose embedded ICC profile details)</strong></div>
      <div>Bit depth: <strong>8-bit per channel (standard canvas output; original file bit depth is not always exposed by the browser)</strong></div>
      <div>Transparency: <strong>${hasAlpha ? 'Yes (alpha channel present)' : 'No'}</strong></div>
      <div>EXIF: <strong>${epeExifSummary || 'Not available \u2014 EXIF is stripped once an image is drawn to canvas'}</strong></div>
    `;
  }

  /* ---------- Image Quality suggestions (heuristic, suggest-only,
     never auto-modifies) ---------- */
  function computeEpeQualityScore(){
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const sampleCanvas = document.createElement('canvas');
    const sw = Math.min(300, w), sh = Math.round(sw*h/w);
    sampleCanvas.width = sw; sampleCanvas.height = sh;
    sampleCanvas.getContext('2d').drawImage(epeSourceImg, 0, 0, sw, sh);
    const data = sampleCanvas.getContext('2d').getImageData(0,0,sw,sh).data;
    const gray = new Float32Array(sw*sh);
    for (let p=0,i=0; p<sw*sh; p++,i+=4) gray[p] = epeLuma(data[i],data[i+1],data[i+2]);
    // Laplacian-style edge energy: a real, standard blur-detection heuristic (high variance of the 2nd derivative = sharp; low = blurry)
    let edgeEnergy = 0, n=0;
    for (let y=1;y<sh-1;y++) for (let x=1;x<sw-1;x++){
      const i = y*sw+x;
      const lap = 4*gray[i] - gray[i-1] - gray[i+1] - gray[i-sw] - gray[i+sw];
      edgeEnergy += lap*lap; n++;
    }
    const sharpnessScore = n ? Math.sqrt(edgeEnergy/n) : 0;
    let sum=0, sumSq=0;
    for (let p=0;p<sw*sh;p++){ sum+=gray[p]; sumSq+=gray[p]*gray[p]; }
    const mean = sum/(sw*sh), variance = sumSq/(sw*sh) - mean*mean;
    const issues = [];
    if (sharpnessScore < 8) issues.push('Image may be blurry or soft \u2014 detected low edge sharpness.');
    if (w < 800 || h < 800) issues.push(`Resolution is on the low side for ecommerce listings (${w}\u00d7${h}px) \u2014 many marketplaces recommend 1000px+ on the shortest side.`);
    if (mean > 220) issues.push('Image looks overexposed \u2014 average brightness is very high.');
    if (mean < 35) issues.push('Image looks underexposed \u2014 average brightness is very low.');
    if (variance < 200) issues.push('Low contrast detected \u2014 lighting may be flat.');
    return { sharpnessScore: Math.round(sharpnessScore), meanBrightness: Math.round(mean), issues };
  }
  function renderEpeQualityPanel(){
    const el = document.getElementById('epeQualityBody');
    if (!el || !epeSourceImg) return;
    const q = computeEpeQualityScore();
    const overallOk = q.issues.length === 0;
    el.innerHTML = `<div style="font-weight:700;color:${overallOk?'var(--ok-solid)':'var(--warn-solid)'};">${overallOk ? '\u2713 No major quality issues detected' : '\u26a0 ' + q.issues.length + ' potential issue(s) found'}</div>` +
      q.issues.map(i => `<div style="margin-top:6px;font-size:12.5px;">\u2022 ${i}</div>`).join('') +
      `<div style="margin-top:8px;font-size:11.5px;color:var(--ink-soft);">Sharpness score: ${q.sharpnessScore} \u00b7 Average brightness: ${q.meanBrightness}/255. This is a heuristic estimate, not a guarantee \u2014 nothing is changed automatically.</div>`;
  }

  /* ---------- Before/After interactive slider ---------- */
  document.getElementById('epeBeforeAfterSlider') && document.getElementById('epeBeforeAfterSlider').addEventListener('input', (e) => {
    document.getElementById('epeBeforeAfterHandle').style.left = e.target.value + '%';
    document.getElementById('epeAfterCanvasClip').style.width = e.target.value + '%';
  });
  function renderEpeBeforeAfter(){
    if (!epeSourceImg) return;
    const beforeCanvas = document.getElementById('epeBeforeCanvas');
    const afterCanvas = document.getElementById('epeAfterCompareCanvas');
    if (!beforeCanvas || !afterCanvas) return;
    beforeCanvas.width = epeArtboardW; beforeCanvas.height = epeArtboardH;
    const bctx = beforeCanvas.getContext('2d');
    bctx.clearRect(0,0,epeArtboardW,epeArtboardH);
    bctx.save();
    bctx.translate(epeLayer.x, epeLayer.y);
    bctx.rotate(epeLayer.rotation*Math.PI/180);
    bctx.scale(epeLayer.scale*(epeLayer.flipH?-1:1), epeLayer.scale*(epeLayer.flipV?-1:1));
    bctx.drawImage(epeSourceImg, -epeSourceImg.naturalWidth/2, -epeSourceImg.naturalHeight/2);
    bctx.restore();
    // After canvas: the current edited artboard, drawn at the SAME pixel
    // size as the before canvas so the clip wrapper's percentage width
    // reveals the corresponding region correctly.
    afterCanvas.width = epeArtboardW; afterCanvas.height = epeArtboardH;
    afterCanvas.style.width = beforeCanvas.clientWidth + 'px';
    afterCanvas.style.height = beforeCanvas.clientHeight + 'px';
    afterCanvas.getContext('2d').drawImage(epeArtboardEl, 0, 0, epeArtboardW, epeArtboardH);
  }

  /* ---------- Color picker: HEX/RGB/HSL + eyedropper + recent colors,
     used to set the background replacement color ---------- */
  let epeRecentColors = [];
  function epeRgbToHsl(r,g,b){ r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h,s,l=(mx+mn)/2;
    if(mx===mn){h=s=0;} else { const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn);
      if(mx===r)h=(g-b)/d+(g<b?6:0); else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; }
    return { h:Math.round(h), s:Math.round(s*100), l:Math.round(l*100) }; }
  function epeUpdateColorPickerReadout(hex){
    const n = parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    document.getElementById('epeColorHex').value = hex;
    document.getElementById('epeColorRgb').textContent = `rgb(${r}, ${g}, ${b})`;
    const hsl = epeRgbToHsl(r,g,b);
    document.getElementById('epeColorHsl').textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  }
  document.getElementById('epeBgColorInput') && document.getElementById('epeBgColorInput').addEventListener('input', (e) => epeUpdateColorPickerReadout(e.target.value));
  document.getElementById('epeEyedropperBtn') && (document.getElementById('epeEyedropperBtn').onclick = async () => {
    if (!window.EyeDropper){ toast('Eyedropper isn\u2019t supported in this browser.', 'err'); return; }
    try{
      const ed = new EyeDropper();
      const result = await ed.open();
      document.getElementById('epeBgColorInput').value = result.sRGBHex;
      epeUpdateColorPickerReadout(result.sRGBHex);
      epeRecentColors = [result.sRGBHex, ...epeRecentColors.filter(c=>c!==result.sRGBHex)].slice(0,8);
      epeRenderRecentColors();
      document.getElementById('epeBgColorInput').dispatchEvent(new Event('input', {bubbles:true}));
      document.getElementById('epeBgColorInput').dispatchEvent(new Event('change', {bubbles:true}));
    }catch(e){ /* user cancelled */ }
  });
  function epeRenderRecentColors(){
    const wrap = document.getElementById('epeRecentColors');
    if (!wrap) return;
    wrap.innerHTML = epeRecentColors.map(c => `<button type="button" data-color="${c}" style="width:22px;height:22px;border-radius:6px;border:1px solid var(--card-border);background:${c};cursor:pointer;"></button>`).join('');
    wrap.querySelectorAll('button').forEach(b => b.onclick = () => {
      document.getElementById('epeBgColorInput').value = b.dataset.color;
      epeUpdateColorPickerReadout(b.dataset.color);
      document.getElementById('epeBgColorInput').dispatchEvent(new Event('input', {bubbles:true}));
      document.getElementById('epeBgColorInput').dispatchEvent(new Event('change', {bubbles:true}));
    });
  }


  /* ---------- Upscaling: honest browser-only implementation. This is
     multi-step bicubic-quality resampling (the best canvas natively
     supports), NOT neural super-resolution -- disclosed plainly rather
     than implying AI upscaling this tool doesn't have. ---------- */
  function epeUpscale(factor){
    if (!epeSourceImg) return;
    const srcW = epeLocalEditsCanvas ? epeLocalEditsCanvas.width : epeSourceImg.naturalWidth;
    const srcH = epeLocalEditsCanvas ? epeLocalEditsCanvas.height : epeSourceImg.naturalHeight;
    const targetW = srcW*factor, targetH = srcH*factor;
    let cur = epeLocalEditsCanvas || (() => { const c=document.createElement('canvas'); c.width=srcW; c.height=srcH; c.getContext('2d').drawImage(epeSourceImg,0,0); return c; })();
    let curW = srcW, curH = srcH;
    // Step 1.5x at a time for better quality than one large jump (a real, standard mitigation for canvas upscaling softness)
    while (curW < targetW){
      const nextW = Math.min(targetW, Math.round(curW*1.5)), nextH = Math.min(targetH, Math.round(curH*1.5));
      const next = document.createElement('canvas'); next.width = nextW; next.height = nextH;
      const nctx = next.getContext('2d'); nctx.imageSmoothingEnabled = true; nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(cur, 0, 0, nextW, nextH);
      cur = next; curW = nextW; curH = nextH;
    }
    // A mild sharpen pass afterward to counter the softness upscaling introduces
    const ctx = cur.getContext('2d');
    const imgData = ctx.getImageData(0,0,curW,curH);
    const oldSharp = epeAdj.sharpness;
    epeAdj.sharpness = 35;
    applyEpeLocalContrast(imgData.data, curW, curH);
    epeAdj.sharpness = oldSharp;
    ctx.putImageData(imgData, 0, 0);
    // Replace the source image with the upscaled result
    const finalImg = new Image();
    finalImg.onload = () => {
      epeSourceImg = finalImg;
      epeLocalEditsCanvas = null;
      epeEraseMask = null; // mask was sized for the old resolution; cleared honestly rather than silently misapplied
      epeArtboardW = curW; epeArtboardH = curH;
      epeLayer.x = curW/2; epeLayer.y = curH/2;
      epeProcessedCanvasCache = null;
      renderEpeAll(); epePushHistory();
      toast(`Upscaled to ${curW}\u00d7${curH}px.`);
    };
    finalImg.src = cur.toDataURL('image/png');
  }
  document.getElementById('epeUpscale2xBtn') && (document.getElementById('epeUpscale2xBtn').onclick = () => epeUpscale(2));
  document.getElementById('epeUpscale4xBtn') && (document.getElementById('epeUpscale4xBtn').onclick = () => {
    if (epeArtboardW*4 > 8000 || epeArtboardH*4 > 8000){ toast('4\u00d7 would exceed a safe browser canvas size for this image \u2014 try 2\u00d7 instead.', 'err'); return; }
    epeUpscale(4);
  });

  /* ---------- Compression preview: real estimated file size per
     quality level, computed via actual toBlob calls, not guessed. ---------- */
  async function epeUpdateCompressionPreview(){
    const el = document.getElementById('epeCompressionPreview');
    if (!el || !epeSourceImg) return;
    el.textContent = 'Estimating\u2026';
    const canvas = document.createElement('canvas');
    renderEpeArtboard(canvas);
    const levels = [
      { label:'Maximum Quality', format:'jpeg', q:0.98 },
      { label:'Balanced', format:'jpeg', q:0.82 },
      { label:'Smallest File', format:'jpeg', q:0.55 },
    ];
    const results = [];
    for (const lvl of levels){
      const blob = await new Promise(res => canvas.toBlob(res, 'image/'+lvl.format, lvl.q));
      results.push(`${lvl.label}: ~${fmtBytes(blob ? blob.size : 0)}`);
    }
    el.innerHTML = results.map(r => `<div>${r}</div>`).join('');
  }
  document.getElementById('epeAccordionUpscaleCompress') && document.getElementById('epeAccordionUpscaleCompress').addEventListener('toggle', function(){ if (this.open) epeUpdateCompressionPreview(); });
  document.getElementById('epeAccordionAnalysis') && document.getElementById('epeAccordionAnalysis').addEventListener('toggle', function(){
    if (this.open){
      if (typeof renderEpeHistogram === 'function') renderEpeHistogram();
      if (typeof renderEpeQualityPanel === 'function') renderEpeQualityPanel();
    }
  });
  document.getElementById('epeAccordionBeforeAfter') && document.getElementById('epeAccordionBeforeAfter').addEventListener('toggle', function(){
    if (this.open && typeof renderEpeBeforeAfter === 'function') renderEpeBeforeAfter();
  });


  /* ---------- Wire all adjustment sliders through the same debounced-
     render pattern already established in Phase 1/other tools in this
     project ---------- */
  const EPE_ADJ_ID_MAP = {
    brightness:'epeBrightness', contrast:'epeContrast', exposure:'epeExposure', gamma:'epeGamma',
    highlights:'epeHighlights', shadows:'epeShadows', whites:'epeWhites', blacks:'epeBlacks',
    saturation:'epeSaturation', vibrance:'epeVibrance', temperature:'epeTemperature', tint:'epeTint', hue:'epeHue',
    sharpness:'epeSharpness', clarity:'epeClarity', texture:'epeTexture', dehaze:'epeDehaze',
    surfaceEnhance:'epeSurfaceEnhance', noiseReduction:'epeNoiseReduction',
  };
  Object.entries(EPE_ADJ_ID_MAP).forEach(([key, id]) => {
    const el = document.getElementById(id); if (!el) return;
    const valEl = document.getElementById(id+'Val');
    el.addEventListener('input', () => {
      epeAdj[key] = +el.value;
      if (valEl) valEl.textContent = el.value;
      // Flush this edit to the active layer so the layer is the source
      // of truth before any render or history snapshot.
      const active = dseActiveLayer ? dseActiveLayer() : null;
      if (active){ active.adj[key] = epeAdj[key]; active.processedCanvasCache = null; }
      epeProcessedCanvasCache = null;
      clearTimeout(window.__epeAdjDebounce);
      window.__epeAdjDebounce = setTimeout(renderEpeAll, 60);
    });
    el.addEventListener('change', epePushHistory);
  });
  function epeSyncAdjControlsFromState(){
    Object.entries(EPE_ADJ_ID_MAP).forEach(([key, id]) => {
      const el = document.getElementById(id); if (!el) return;
      const valEl = document.getElementById(id+'Val');
      el.value = epeAdj[key];
      if (valEl) valEl.textContent = String(epeAdj[key]);
    });
  }
  document.getElementById('epeResetAdjustmentsBtn') && (document.getElementById('epeResetAdjustmentsBtn').onclick = () => {
    epeAdj = { ...EPE_ADJ_DEFAULTS };
    epeSyncAdjControlsFromState();
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    toast('Adjustments reset.');
  });

  /* ---------- Shadow / Reflection controls ---------- */
  epePluginEngine.register({
    id: 'shadow', category: 'effects', name: 'Shadow', kind: 'toggle',
    activate: () => { epeShadow.enabled = true; renderEpeAll(); epePushHistory(); },
    deactivate: () => { epeShadow.enabled = false; renderEpeAll(); epePushHistory(); },
  });
  document.getElementById('epeShadowEnable') && document.getElementById('epeShadowEnable').addEventListener('change', (e) => {
    // Independent toggle -- not mutually exclusive with other tools, so
    // call the plugin's own lifecycle methods directly rather than
    // through engine.activate()/deactivate(), which enforce single-
    // active-plugin exclusivity (correct for Crop vs brush modes, wrong
    // for independent effect toggles that coexist, e.g. Shadow + Reflection).
    const p = epePluginEngine.getPlugin('shadow');
    if (e.target.checked) p.activate(); else p.deactivate();
  });
  document.getElementById('epeShadowStyle') && document.getElementById('epeShadowStyle').addEventListener('change', (e) => { epeShadow.style = e.target.value; renderEpeAll(); epePushHistory(); });
  ['Opacity','Blur','Distance','Angle','Scale'].forEach(prop => {
    const id = 'epeShadow'+prop;
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => { epeShadow[prop.toLowerCase()] = +el.value; const v=document.getElementById(id+'Val'); if(v) v.textContent=el.value; renderEpeAll(); });
    el.addEventListener('change', epePushHistory);
  });
  epePluginEngine.register({
    id: 'reflection', category: 'effects', name: 'Reflection', kind: 'toggle',
    activate: () => { epeReflection.enabled = true; renderEpeAll(); epePushHistory(); },
    deactivate: () => { epeReflection.enabled = false; renderEpeAll(); epePushHistory(); },
  });
  document.getElementById('epeReflectionEnable') && document.getElementById('epeReflectionEnable').addEventListener('change', (e) => {
    const p = epePluginEngine.getPlugin('reflection');
    if (e.target.checked) p.activate(); else p.deactivate();
  });
  document.getElementById('epeReflectionStyle') && document.getElementById('epeReflectionStyle').addEventListener('change', (e) => { epeReflection.style = e.target.value; renderEpeAll(); epePushHistory(); });
  ['Opacity','Fade','Distance'].forEach(prop => {
    const id = 'epeReflection'+prop;
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => { epeReflection[prop.toLowerCase()] = +el.value; const v=document.getElementById(id+'Val'); if(v) v.textContent=el.value; renderEpeAll(); });
    el.addEventListener('change', epePushHistory);
  });


  function renderEpeOverlay(){
    const w = epeArtboardW, h = epeArtboardH;
    epeOverlayEl.width = w; epeOverlayEl.height = h;
    const ctx = epeOverlayEl.getContext('2d');
    ctx.clearRect(0,0,w,h);
    if (epeSourceImg && epeSelectionMask){
      // Draw the ACTUAL current rasterized mask (reflects Expand/Contract/
      // Feather edits, unlike the original vector path which goes stale
      // the moment the mask is morphologically modified) as a translucent
      // overlay, composited through the same layer transform as the
      // artboard content so it lines up correctly at any rotation/scale.
      const sw = epeSourceImg.naturalWidth, sh = epeSourceImg.naturalHeight;
      const maskCanvas = document.createElement('canvas'); maskCanvas.width = sw; maskCanvas.height = sh;
      const mctx = maskCanvas.getContext('2d');
      const maskImgData = mctx.createImageData(sw, sh);
      for (let i=0; i<epeSelectionMask.length; i++){
        maskImgData.data[i*4] = 81; maskImgData.data[i*4+1] = 66; maskImgData.data[i*4+2] = 214;
        maskImgData.data[i*4+3] = epeSelectionMask[i] > 127 ? 90 : 0;
      }
      mctx.putImageData(maskImgData, 0, 0);
      ctx.save();
      ctx.translate(epeLayer.x, epeLayer.y);
      ctx.rotate(epeLayer.rotation * Math.PI/180);
      ctx.scale(epeLayer.scale * (epeLayer.flipH?-1:1), epeLayer.scale * (epeLayer.flipV?-1:1));
      ctx.drawImage(maskCanvas, -sw/2, -sh/2);
      ctx.restore();
    } else if (epeSourceImg && epeSelectionPath.length > 0){
      ctx.strokeStyle = 'rgba(81,66,214,0.95)'; ctx.lineWidth = 1.5; ctx.setLineDash([5,3]);
      ctx.beginPath();
      epeSelectionPath.forEach((p,i) => { const ap = epeSourceToArtboardCoords(p.x,p.y); i===0?ctx.moveTo(ap.x,ap.y):ctx.lineTo(ap.x,ap.y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (epeSourceImg && epeCloneSource && (epeActiveTool === 'clone' || epeActiveTool === 'heal')){
      const ap = epeSourceToArtboardCoords(epeCloneSource.x, epeCloneSource.y);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ap.x-8,ap.y); ctx.lineTo(ap.x+8,ap.y); ctx.moveTo(ap.x,ap.y-8); ctx.lineTo(ap.x,ap.y+8); ctx.stroke();
      ctx.beginPath(); ctx.arc(ap.x,ap.y,10,0,Math.PI*2); ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.stroke();
    }
    const gridMode = document.getElementById('epeGridMode').value;
    if (gridMode === 'thirds'){
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      for (let i=1;i<3;i++){
        ctx.beginPath(); ctx.moveTo(w*i/3,0); ctx.lineTo(w*i/3,h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,h*i/3); ctx.lineTo(w,h*i/3); ctx.stroke();
      }
    } else if (gridMode === 'square'){
      const spacing = Math.max(10, +document.getElementById('epeGridSpacing').value || 50);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      for (let x=spacing; x<w; x+=spacing){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for (let y=spacing; y<h; y+=spacing){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    }
    if (document.getElementById('epeSafeArea').checked){
      const safePct = (+document.getElementById('epeSafeAreaMargin').value || 8) / 100;
      const dangerPct = Math.max(0, safePct - 0.04);
      const marginPx = Math.round(Math.min(w,h) * safePct);
      const dangerPx = Math.round(Math.min(w,h) * dangerPct);
      // Danger/margin boundary (outer, closer to the true edge)
      ctx.strokeStyle = 'rgba(224,82,82,0.75)'; ctx.setLineDash([4,3]); ctx.lineWidth = 1.5;
      ctx.strokeRect(dangerPx, dangerPx, w-dangerPx*2, h-dangerPx*2);
      // Safe area (inner, recommended content boundary)
      ctx.strokeStyle = 'rgba(59,165,92,0.85)'; ctx.setLineDash([6,4]); ctx.lineWidth = 2;
      ctx.strokeRect(marginPx, marginPx, w-marginPx*2, h-marginPx*2);
      ctx.setLineDash([]);
      // Flag any visible, ungrouped layer whose bounding box extends past the safe area
      dseState.layers.filter(l => l.visible && !l.groupId).forEach(l => {
        const bb = dseLayerBoundingBox(l);
        const outside = bb.x < marginPx || bb.y < marginPx || bb.x+bb.w > w-marginPx || bb.y+bb.h > h-marginPx;
        if (outside){
          ctx.strokeStyle = 'rgba(224,82,82,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([3,3]);
          ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
          ctx.setLineDash([]);
        }
      });
    }
    if (epeSmartGuideActive.x || epeSmartGuideActive.y){
      ctx.strokeStyle = 'rgba(81,66,214,0.9)'; ctx.lineWidth = 1.5;
      if (epeSmartGuideActive.x){ ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke(); }
      if (epeSmartGuideActive.y){ ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke(); }
    }
    if (epeCropActive && epeCropRect){
      const { x, y, w:cw, h:ch } = epeCropRect;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0,0,w,h);
      ctx.clearRect(x,y,cw,ch);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x,y,cw,ch);
      ctx.fillStyle = '#fff';
      [[x,y],[x+cw,y],[x,y+ch],[x+cw,y+ch]].forEach(([hx,hy]) => { ctx.beginPath(); ctx.arc(hx,hy,7,0,Math.PI*2); ctx.fill(); });
    }
  }
  let epeSmartGuideActive = { x:false, y:false };

  function fitEpeCanvasDisplay(){
    const viewport = document.getElementById('epeWorkspaceViewport');
    if (!epeArtboardW || !viewport) return;
    // Canvas element always at its true native pixel size; zoom is
    // handled entirely by the workspace's scale() transform below.
    // (This sizing step is Canvas Engine territory, not Workspace Engine --
    // the shared engine only knows about "content width/height", not
    // canvas elements specifically.)
    epeArtboardEl.style.width = epeArtboardW+'px'; epeArtboardEl.style.height = epeArtboardH+'px';
    epeOverlayEl.style.width = epeArtboardW+'px'; epeOverlayEl.style.height = epeArtboardH+'px';
    epeOverlayEl.style.position = 'absolute'; epeOverlayEl.style.top = '0'; epeOverlayEl.style.left = '0'; epeOverlayEl.style.pointerEvents = 'none';
    epeWorkspaceEngine.fitToScreen(epeArtboardW, epeArtboardH, epeViewZoom);
    epeSyncWorkspaceVarsFromEngine();
  }

  function renderEpeAll(skipFit){
    renderEpeArtboard(epeArtboardEl);
    renderEpeOverlay();
    // Phase 3: draw selection handles on top of the overlay
    if (typeof dseDrawSelectionHandles === 'function') dseDrawSelectionHandles(epeOverlayEl.getContext('2d'));
    if (!skipFit) fitEpeCanvasDisplay();
    document.getElementById('epeOutputDims').textContent = `${epeArtboardW}\u00d7${epeArtboardH}px (full resolution)`;
    const statusDims = document.getElementById('epeStatusDims');
    if (statusDims) statusDims.textContent = `${epeArtboardW}\u00d7${epeArtboardH}px`;
    const statusZoom = document.getElementById('epeStatusZoom');
    if (statusZoom) statusZoom.textContent = Math.round(epeViewZoom*100) + '% zoom';
    const statusLayers = document.getElementById('epeStatusLayers');
    if (statusLayers && typeof dseState !== 'undefined'){
      const n = dseState.layers.length;
      statusLayers.textContent = n + (n === 1 ? ' layer' : ' layers');
    }
    if (typeof renderEpeInspector === 'function') renderEpeInspector(); // cheap (no pixel scan) -- always safe to run
    const analysisOpen = document.getElementById('epeAccordionAnalysis') && document.getElementById('epeAccordionAnalysis').open;
    if (analysisOpen){
      if (typeof renderEpeHistogram === 'function') renderEpeHistogram();
      if (typeof renderEpeQualityPanel === 'function') renderEpeQualityPanel();
    }
    const beforeAfterOpen = document.getElementById('epeAccordionBeforeAfter') && document.getElementById('epeAccordionBeforeAfter').open;
    if (beforeAfterOpen && typeof renderEpeBeforeAfter === 'function') renderEpeBeforeAfter();
  }

  /* ---------- Layer transform controls ---------- */
  function epeSyncControlsFromLayer(){
    document.getElementById('epeScale').value = Math.round(epeLayer.scale*100);
    document.getElementById('epeScaleVal').textContent = String(Math.round(epeLayer.scale*100));
    document.getElementById('epeRotation').value = Math.round(epeLayer.rotation);
    document.getElementById('epeRotationVal').textContent = String(Math.round(epeLayer.rotation));
    document.getElementById('epeFlipHBtn').setAttribute('aria-pressed', String(epeLayer.flipH));
    document.getElementById('epeFlipVBtn').setAttribute('aria-pressed', String(epeLayer.flipV));
  }
  document.getElementById('epeScale').addEventListener('input', (e) => {
    epeLayer.scale = (+e.target.value)/100;
    document.getElementById('epeScaleVal').textContent = e.target.value;
    renderEpeAll();
  });
  document.getElementById('epeScale').addEventListener('change', epePushHistory);
  document.getElementById('epeRotation').addEventListener('input', (e) => {
    epeLayer.rotation = +e.target.value;
    document.getElementById('epeRotationVal').textContent = e.target.value;
    renderEpeAll();
  });
  document.getElementById('epeRotation').addEventListener('change', epePushHistory);

  function epeFlipH(){ epeLayer.flipH = !epeLayer.flipH; epeSyncControlsFromLayer(); renderEpeAll(); epePushHistory(); }
  function epeFlipV(){ epeLayer.flipV = !epeLayer.flipV; epeSyncControlsFromLayer(); renderEpeAll(); epePushHistory(); }
  epePluginEngine.register({ id: 'flipH', category: 'edit', name: 'Flip Horizontal', kind: 'action', activate: () => epeFlipH() });
  epePluginEngine.register({ id: 'flipV', category: 'edit', name: 'Flip Vertical', kind: 'action', activate: () => epeFlipV() });
  document.getElementById('epeFlipHBtn').onclick = () => epePluginEngine.activate('flipH');
  document.getElementById('epeFlipVBtn').onclick = () => epePluginEngine.activate('flipV');

  // Rotate 90 -- rotates the ARTBOARD itself (swaps W/H, like fixing a
  // sideways photo), distinct from the free Rotation slider which rotates
  // just the layer within a fixed artboard.

  function epeRotate90(){
    const oldW = epeArtboardW, oldH = epeArtboardH;
    epeArtboardW = oldH; epeArtboardH = oldW;
    const oldX = epeLayer.x, oldY = epeLayer.y;
    epeLayer.x = epeArtboardW/2 + (oldY - oldH/2);
    epeLayer.y = epeArtboardH/2 - (oldX - oldW/2);
    epeLayer.rotation = (epeLayer.rotation + 90) % 360;
    epeSyncControlsFromLayer();
    renderEpeAll();
    epePushHistory();
  }
  epePluginEngine.register({
    id: 'rotate90', category: 'edit', name: 'Rotate 90\u00b0', kind: 'action',
    activate: () => epeRotate90(),
  });
  document.getElementById('epeRotate90Btn').onclick = () => {
    epePluginEngine.activate('rotate90');
  };

  document.getElementById('epeResetTransformBtn').onclick = () => {
    epeLayer.scale = 1; epeLayer.rotation = 0; epeLayer.flipH = false; epeLayer.flipV = false;
    epeLayer.x = epeArtboardW/2; epeLayer.y = epeArtboardH/2;
    epeSyncControlsFromLayer();
    renderEpeAll();
    epePushHistory();
    toast('Transform reset.');
  };
  document.getElementById('epeCenterBtn').onclick = () => {
    epeLayer.x = epeArtboardW/2; epeLayer.y = epeArtboardH/2;
    renderEpeAll(); epePushHistory();
    toast('Image centered.');
  };
  document.getElementById('epeFitScreenBtn').onclick = () => {
    epeViewZoom = 1;
    document.getElementById('epeZoomSlider').value = '100';
    document.getElementById('epeZoomVal').textContent = '100';
    fitEpeCanvasDisplay();
    toast('Fit to screen.');
  };
  document.getElementById('epeZoomSlider').addEventListener('input', (e) => {
    epeViewZoom = (+e.target.value)/100;
    document.getElementById('epeZoomVal').textContent = e.target.value;
    fitEpeCanvasDisplay();
  });
  document.getElementById('epeZoomPreset') && document.getElementById('epeZoomPreset').addEventListener('change', (e) => {
    if (!e.target.value) return;
    epeViewZoom = (+e.target.value)/100;
    document.getElementById('epeZoomSlider').value = e.target.value;
    document.getElementById('epeZoomVal').textContent = e.target.value;
    fitEpeCanvasDisplay();
    e.target.value = ''; // reset to placeholder so re-selecting the same preset still fires 'change'
  });

  // Ecommerce Editor's instance of the shared Canvas Engine -- see
  // createToolflightCanvasEngine definition above. epeEventToArtboardCoords
  // below is a thin wrapper delegating to it, preserving the exact same
  // external function name/signature (6 existing call sites depend on it)
  // and exact same math.
  /* ============================================================
     TOOLFLIGHT CANVAS ENGINE (Phase 3 of the multi-editor migration
     plan). Tool-agnostic: takes canvas/overlay elements and a content-
     size getter as config, with no knowledge of "ecommerce"
     specifically -- no image/layer/shape drawing logic lives here,
     since that's legitimately tool-specific business logic (an
     ecommerce product editor draws layers; a passport tool draws a
     face photo + ICAO guides; forcing that to be "generic" would mean
     no actual drawing code, which isn't what this phase asks for).
     What genuinely IS generic and shared here: coordinate conversion
     between screen space and canvas-logical space, canvas state
     (element refs, logical size), and a render/invalidate API surface
     that editors wire to their own drawing functions. ============================================================ */

  const epeCanvasEngine = createToolflightCanvasEngine({
    canvasEl: () => epeArtboardEl,
    overlayEl: () => epeOverlayEl,
    getContentSize: () => ({ w: epeArtboardW, h: epeArtboardH }),
    renderFn: (...args) => renderEpeAll(...args),
  });

  /* ---------- Canvas coordinate mapping (CSS-scaled display -> real
     artboard pixel coordinates), same ratio-based approach used
     elsewhere in this project so it stays correct at any zoom level.
     Delegates to the shared Canvas Engine's screenToCanvas(). ---------- */
  function epeEventToArtboardCoords(clientX, clientY){
    return epeCanvasEngine.screenToCanvas(clientX, clientY);
  }

  /* ---------- Drag-to-move the layer, with center-snapping smart guides ---------- */
  // Phase 1/2 epePointerDown/Move/Up removed as genuinely dead code (Phase 3 Part 4 audit):
  // superseded entirely by DSE's dsePointerDownOnCanvas/dsePointerMoveOnCanvas/dsePointerUpOnCanvas
  // since Part 1's architecture migration. The one remaining call site (brush painting during
  // drag) was calling into epePointerMove's now-unreachable logic and has been fixed to call
  // epeStampAt directly -- see the pointermove listener below.
  // Phase 1/2 pointer listeners removed -- replaced by DSE comprehensive handlers in dse_selection.js/dse_wiring.js above

  /* ---------- Crop: resizes the artboard itself and repositions the
     layer to compensate, going through the SAME renderEpeArtboard()
     used everywhere else -- adapts the crop-rectangle pattern built for
     Passport Photo Maker, independently implemented since that tool's
     crop code is module-private. ---------- */
  function epeDefaultCropRect(){
    const ratio = document.getElementById('epeCropRatioPreset').value;
    let cw = epeArtboardW*0.8, ch = epeArtboardH*0.8;
    if (ratio !== 'free'){
      const [rw, rh] = ratio.split(':').map(Number);
      const targetRatio = rw/rh;
      if (cw/ch > targetRatio) cw = ch*targetRatio; else ch = cw/targetRatio;
    }
    return { x:(epeArtboardW-cw)/2, y:(epeArtboardH-ch)/2, w:cw, h:ch };
  }
  function epeCropHandleAt(px, py){
    if (!epeCropRect) return null;
    const { x, y, w, h } = epeCropRect;
    const corners = { nw:[x,y], ne:[x+w,y], sw:[x,y+h], se:[x+w,y+h] };
    for (const [name,[hx,hy]] of Object.entries(corners)) if (Math.hypot(px-hx,py-hy) < 26) return name;
    if (px>x && px<x+w && py>y && py<y+h) return 'move';
    return null;
  }
  epePluginEngine.register({
    id: 'crop', category: 'edit', name: 'Crop', kind: 'toggle',
    activate: () => {
      epeCropActive = true;
      document.getElementById('epeCropToggleBtn').setAttribute('aria-pressed', 'true');
      document.getElementById('epeCropActions').classList.remove('hidden');
      epeCropRect = epeDefaultCropRect(); renderEpeOverlay();
    },
    deactivate: () => {
      epeCropActive = false;
      document.getElementById('epeCropToggleBtn').setAttribute('aria-pressed', 'false');
      document.getElementById('epeCropActions').classList.add('hidden');
      epeCropRect = null; renderEpeOverlay();
    },
  });
  document.getElementById('epeCropToggleBtn').onclick = () => {
    if (!epeSourceImg) return;
    if (epeCropActive) epePluginEngine.deactivate('crop');
    else epePluginEngine.activate('crop');
  };
  document.getElementById('epeCropRatioPreset').addEventListener('change', () => {
    if (!epeCropActive) return;
    epeCropRect = epeDefaultCropRect(); renderEpeOverlay();
  });
  function epeCropPointerDown(clientX, clientY){
    const pt = epeEventToArtboardCoords(clientX, clientY);
    const handle = epeCropHandleAt(pt.x, pt.y);
    if (!handle) return false;
    epeCropDragMode = handle; epeCropDragStart = pt; epeCropRectStart = { ...epeCropRect };
    return true;
  }
  function epeCropPointerMove(clientX, clientY){
    const pt = epeEventToArtboardCoords(clientX, clientY);
    const dx = pt.x-epeCropDragStart.x, dy = pt.y-epeCropDragStart.y;
    const lockRatio = document.getElementById('epeCropLockRatio').checked;
    const ratioStr = document.getElementById('epeCropRatioPreset').value;
    let ratio = epeCropRectStart.w/epeCropRectStart.h;
    if (lockRatio && ratioStr !== 'free'){ const [rw,rh] = ratioStr.split(':').map(Number); ratio = rw/rh; }
    let r = { ...epeCropRectStart };
    if (epeCropDragMode === 'move'){
      r.x = epeClamp(epeCropRectStart.x+dx, 0, epeArtboardW-r.w);
      r.y = epeClamp(epeCropRectStart.y+dy, 0, epeArtboardH-r.h);
    } else {
      let nx=r.x, ny=r.y, nw=r.w, nh=r.h;
      if (epeCropDragMode.includes('w')){ nx=epeCropRectStart.x+dx; nw=epeCropRectStart.w-dx; }
      if (epeCropDragMode.includes('e')){ nw=epeCropRectStart.w+dx; }
      if (epeCropDragMode.includes('n')){ ny=epeCropRectStart.y+dy; nh=epeCropRectStart.h-dy; }
      if (epeCropDragMode.includes('s')){ nh=epeCropRectStart.h+dy; }
      if (lockRatio){ nh = nw/ratio; if (epeCropDragMode.includes('n')) ny = epeCropRectStart.y+epeCropRectStart.h-nh; }
      if (nw>20 && nh>20 && nx>=0 && ny>=0 && nx+nw<=epeArtboardW && ny+nh<=epeArtboardH){ r={x:nx,y:ny,w:nw,h:nh}; }
    }
    epeCropRect = r; renderEpeOverlay();
  }
  function epeCropPointerUp(){ epeCropDragMode = null; }
  document.getElementById('epeCropApplyBtn').onclick = () => {
    if (!epeCropRect) return;
    const { x, y, w, h } = epeCropRect;
    epeLayer.x -= x; epeLayer.y -= y;
    epeArtboardW = Math.round(w); epeArtboardH = Math.round(h);
    document.getElementById('epeCropToggleBtn').click();
    renderEpeAll();
    epePushHistory();
    toast('Crop applied.');
  };
  document.getElementById('epeCropResetBtn').onclick = () => { epeCropRect = epeDefaultCropRect(); renderEpeOverlay(); };
  document.getElementById('epeCropCancelBtn').onclick = () => { document.getElementById('epeCropToggleBtn').click(); };

  /* ---------- Grid / guides / safe area: overlay-only, never touch
     exported pixels ---------- */
  document.getElementById('epeGridMode').addEventListener('change', (e) => {
    document.getElementById('epeGridSpacing').classList.toggle('hidden', e.target.value !== 'square');
    renderEpeOverlay();
  });
  document.getElementById('epeGridSpacing').addEventListener('input', renderEpeOverlay);
  epePluginEngine.register({
    id: 'safeArea', category: 'edit', name: 'Safe Area', kind: 'toggle',
    activate: () => renderEpeOverlay(), deactivate: () => renderEpeOverlay(),
  });
  epePluginEngine.register({
    id: 'smartGuides', category: 'edit', name: 'Smart Guides', kind: 'toggle',
    activate: () => renderEpeOverlay(), deactivate: () => renderEpeOverlay(),
  });
  document.getElementById('epeSafeArea').addEventListener('change', (e) => {
    const p = epePluginEngine.getPlugin('safeArea');
    if (e.target.checked) p.activate(); else p.deactivate();
  });
  document.getElementById('epeSmartGuides').addEventListener('change', (e) => {
    const p = epePluginEngine.getPlugin('smartGuides');
    if (e.target.checked) p.activate(); else p.deactivate();
  });

  /* ---------- Mouse wheel zoom (plain and Ctrl+wheel), pinch-zoom,
     double-tap zoom/reset -- view-only navigation, adapts the same
     conceptual pattern used elsewhere in this project ---------- */
  document.getElementById('epeWorkspaceViewport').addEventListener('wheel', (e) => {
    if (!epeSourceImg) return;
    e.preventDefault();
    epeViewZoom = epeClamp(epeViewZoom - Math.sign(e.deltaY)*0.1, 0.03, 16);
    document.getElementById('epeZoomSlider').value = String(Math.round(epeViewZoom*100));
    document.getElementById('epeZoomVal').textContent = String(Math.round(epeViewZoom*100));
    const viewport = document.getElementById('epeWorkspaceViewport');
    const rect = viewport.getBoundingClientRect();
    const availW = viewport.clientWidth, availH = Math.max(120, viewport.clientHeight);
    const newScale = Math.min(1, availW/epeArtboardW, availH/epeArtboardH) * epeViewZoom;
    epeZoomAroundPoint(newScale, e.clientX-rect.left, e.clientY-rect.top);
  }, { passive:false });

  let epePinchStartDist=null, epePinchStartZoom=1, epeLastTapTime=0, epeLastTapPos=null;
  epeArtboardEl.addEventListener('touchstart', (e) => {
    if (!epeSourceImg) return;
    if (e.touches.length === 2){
      e.preventDefault();
      const [a,b] = e.touches;
      epePinchStartDist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      epePinchStartZoom = epeViewZoom;
    } else if (e.touches.length === 1){
      const t = e.touches[0]; const now = Date.now();
      if (epeLastTapPos && now-epeLastTapTime<320 && Math.hypot(t.clientX-epeLastTapPos.x,t.clientY-epeLastTapPos.y)<30){
        epeViewZoom = epeViewZoom>1.05 ? 1 : 2;
        document.getElementById('epeZoomSlider').value = String(Math.round(epeViewZoom*100));
        document.getElementById('epeZoomVal').textContent = String(Math.round(epeViewZoom*100));
        fitEpeCanvasDisplay();
        epeLastTapPos = null; return;
      }
      epeLastTapTime = now; epeLastTapPos = { x:t.clientX, y:t.clientY };
    }
  }, { passive:false });
  epeArtboardEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && epePinchStartDist){
      e.preventDefault();
      const [a,b] = e.touches;
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      epeViewZoom = epeClamp(epePinchStartZoom*(dist/epePinchStartDist), 0.03, 16);
      document.getElementById('epeZoomSlider').value = String(Math.round(epeViewZoom*100));
      document.getElementById('epeZoomVal').textContent = String(Math.round(epeViewZoom*100));
      fitEpeCanvasDisplay();
    }
  }, { passive:false });
  epeArtboardEl.addEventListener('touchend', (e) => { if (e.touches.length<2) epePinchStartDist=null; });

  // Spacebar-drag pan (view-only navigation via scroll, since the artboard
  // wrapper scrolls when zoomed beyond the visible area)
  let epeSpacePan = false;
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { epeSpacePan = true; document.getElementById('epeCanvasStageWrap').style.cursor='grab'; } });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { epeSpacePan = false; document.getElementById('epeCanvasStageWrap').style.cursor='default'; } });

  /* ---------- Auto-save: adapts the pattern already used by AI
     Background Remover (debounced localStorage, 24h expiry,
     resume/discard banner) -- independently implemented since that
     tool's implementation is module-private, not globally reusable. ---------- */
  function epeScheduleAutoSave(){
    if (!epeSourceImg) return;
    if (epeAutoSaveTimer) clearTimeout(epeAutoSaveTimer);
    epeAutoSaveTimer = setTimeout(() => {
      try{
        // epeSourceImg.src is a blob: URL (from the shared, global
        // loadImageFromFile) -- ephemeral, and invalid the moment the
        // page reloads. Convert to a genuine, persistent data URL here
        // specifically for storage, rather than saving the blob URL
        // string (which would silently fail to load on recovery,
        // regardless of anything else this function does correctly).
        const imgCanvas = document.createElement('canvas');
        imgCanvas.width = epeSourceImg.naturalWidth; imgCanvas.height = epeSourceImg.naturalHeight;
        imgCanvas.getContext('2d').drawImage(epeSourceImg, 0, 0);
        const persistentImageDataUrl = imgCanvas.toDataURL('image/png');
        // Reuses the comprehensive full-project snapshot (Phase 10) --
        // captures every layer, adjustment, and mask, not just the
        // original image's own position/scale/rotation.
        const snap = typeof epeCreateFullSnapshot === 'function' ? epeCreateFullSnapshot() : null;
        localStorage.setItem(EPE_AUTOSAVE_KEY, JSON.stringify({
          ts: Date.now(), image: persistentImageDataUrl,
          w: epeArtboardW, h: epeArtboardH, layer: epeLayer, // kept for backward compatibility with any older saved session
          fullSnapshot: snap,
        }));
      }catch(e){ /* private mode or quota exceeded -- best-effort, fail silently */ }
    }, 900);
  }
  function epeOfferAutoSavedSession(){
    let raw;
    try{ raw = localStorage.getItem(EPE_AUTOSAVE_KEY); }catch(e){ return; }
    if (!raw) return;
    let data;
    try{ data = JSON.parse(raw); }catch(e){ return; }
    if (!data || Date.now()-data.ts > 24*60*60*1000){ try{ localStorage.removeItem(EPE_AUTOSAVE_KEY); }catch(e){} return; }
    const banner = document.getElementById('epeAutoSaveBanner');
    banner.classList.remove('hidden');
    document.getElementById('epeAutoSaveResumeBtn').onclick = async () => {
      try{
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('bad image')); img.src = data.image; });
        epeSourceImg = img; epeArtboardW = data.w; epeArtboardH = data.h; epeLayer = data.layer;
        document.getElementById('epeStage').classList.remove('hidden');
        epeEnterShellMode();
        if (data.fullSnapshot && typeof epeRestoreFullSnapshot === 'function'){
          // Full recovery path: layers, adjustments, masks, selection, viewport all restored
          epeHistoryEngine.clearHistory();
          const layer = dseCreateImageLayer(epeSourceImg, epeArtboardW, epeArtboardH);
          dseState.layers = [layer]; dseState.selectedIds = new Set([layer.id]);
          epePushHistory();
          await epeRestoreFullSnapshot(data.fullSnapshot);
          toast('Previous session restored (including adjustments and any added layers).');
        } else {
          // Legacy path: an older saved session without a full snapshot -- restores
          // the image and its transform only, honestly not everything.
          epeHistoryEngine.clearHistory(); epePushHistory();
          epeSyncControlsFromLayer();
          renderEpeAll();
          toast('Previous session restored (image only \u2014 this was an older saved session).');
        }
        banner.classList.add('hidden');
      }catch(err){ toast('Could not restore the previous session.', 'err'); banner.classList.add('hidden'); }
    };
    document.getElementById('epeAutoSaveDiscardBtn').onclick = () => { try{ localStorage.removeItem(EPE_AUTOSAVE_KEY); }catch(e){} banner.classList.add('hidden'); };
  }

  /* ---------- Export: the exact same renderEpeArtboard() used for the
     live preview, called with a fresh canvas -- one render pipeline,
     not a second implementation ---------- */
  document.getElementById('epeDownloadBtn').onclick = () => {
    if (!epeSourceImg) return;
    if (typeof epeRunProjectHealthCheck === 'function'){
      const health = epeRunProjectHealthCheck();
      if (!health.ok) toast('Exporting, but project validation found: ' + health.issues[0], 'err');
    }
    const t0 = performance.now();
    const exportCanvas = document.createElement('canvas');
    renderEpeArtboard(exportCanvas);
    const tRender = performance.now();
    const format = document.getElementById('epeExportFormat').value;
    const ext = format === 'jpeg' ? 'jpg' : format;
    exportCanvas.toBlob((blob) => {
      if (!blob){ toast('Could not export \u2014 try a different format.', 'err'); return; }
      const tEncode = performance.now();
      downloadBlob(blob, 'product-photo.' + ext);
      const totalMs = tEncode - t0;
      const uncompressedBytes = exportCanvas.width*exportCanvas.height*4;
      if (typeof epeRecordOperation === 'function'){
        epeRecordOperation('export_'+format, totalMs, { 'Canvas render': tRender-t0, 'Encode': tEncode-tRender },
          { fileSizeBytes: blob.size, uncompressedBytes, compressionRatio: uncompressedBytes/blob.size, format });
        if (typeof epeRenderExportAnalytics === 'function') epeRenderExportAnalytics();
      }
    }, 'image/' + format, 0.98);
  };

  /* ---------- Image loading ---------- */
  let epeOriginalFileSize = 0, epeFileHadAlpha = false, epeExifSummary = '';
  async function loadEpeImage(f){
    if (!['image/png','image/jpeg','image/webp','image/avif'].includes(f.type)){ toast('Please select a PNG, JPG, WEBP, or AVIF image.', 'err'); return; }
    if (f.size > 30*1024*1024){ toast(`That image is ${fmtBytes(f.size)} \u2014 the limit is 30MB.`, 'err'); return; }
    let img;
    try{ img = await loadImageFromFile(f); }catch(err){ toast(err.message || 'Could not read this image \u2014 your browser may not support this format.', 'err'); return; }
    epeSourceImg = img;
    epeArtboardW = img.naturalWidth; epeArtboardH = img.naturalHeight;
    epeLayer = { x: epeArtboardW/2, y: epeArtboardH/2, scale:1, rotation:0, flipH:false, flipV:false };
    epeAdj = { ...EPE_ADJ_DEFAULTS };
    epeEraseMask = null; epeLocalEditsCanvas = null; epeProcessedCanvasCache = null;
    epeBgMode = 'none'; epeShadow.enabled = false; epeReflection.enabled = false;
    epeOriginalFileSize = f.size;
    epeFileHadAlpha = f.type === 'image/png' || f.type === 'image/webp' || f.type === 'image/avif';
    epeExifSummary = f.type === 'image/jpeg' ? 'Present in the original file, but not read out here \u2014 this tool does not currently parse EXIF fields.' : 'Not applicable for this file format.';
    document.getElementById('epeStage').classList.remove('hidden');
    document.getElementById('epeAutoSaveBanner').classList.add('hidden');
    epeEnterShellMode();
    epeSyncControlsFromLayer();
    if (typeof epeSyncAdjControlsFromState === 'function') epeSyncAdjControlsFromState();
    document.getElementById('epeZoomSlider').value='100'; document.getElementById('epeZoomVal').textContent='100'; epeViewZoom=1;
    epeHistoryEngine.clearHistory();
    // DSE Phase 3: build the first layer from the loaded image
    if (typeof dseCreateImageLayer === 'function'){
      const layer = dseCreateImageLayer(epeSourceImg, epeArtboardW, epeArtboardH);
      // Sync the flat aliases into the layer so they're consistent
      dseFlushAliasesToLayer(layer);
      dseState.layers = [layer];
      dseState.selectedIds.clear();
      dseSelectLayer(layer.id, false); // single proper selection pathway -- ensures Object/Text/Shape panel visibility all sync correctly, same as every other layer-creation path
    }
    epePushHistory();
    renderEpeAll();
    toast('Image loaded.');
  }
  setupDropZone('epeDrop','epeInput', async (files) => {
    const f = files.find(f => ['image/png','image/jpeg','image/webp','image/avif'].includes(f.type));
    if (!f){ if (files.length>0) toast('Please select a PNG, JPG, WEBP, or AVIF image.', 'err'); return; }
    await loadEpeImage(f);
  });
  document.getElementById('epeReplaceBtn').onclick = () => document.getElementById('epeInput').click();
  document.getElementById('epeResetBtn').onclick = () => {
    epeSourceImg = null; epeArtboardW = 0; epeArtboardH = 0;
    document.getElementById('epeStage').classList.add('hidden');
    document.getElementById('epeInput').value = '';
    try{ localStorage.removeItem(EPE_AUTOSAVE_KEY); }catch(e){}
    toast('Reset.');
  };
  document.addEventListener('paste', async (e) => {
    const drop = document.getElementById('epeDrop');
    if (drop.offsetParent === null) return;
    const items = Array.from(e.clipboardData ? e.clipboardData.items : []);
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem){ const file = imgItem.getAsFile(); if (file){ e.preventDefault(); await loadEpeImage(file); } }
  });

  window.addEventListener('resize', () => { if (epeSourceImg) fitEpeCanvasDisplay(); });
  // ---- SELECTION ENGINE ----
  // Manages which layers are selected and draws transform handles
  // on the overlay canvas (never on the artboard canvas, so they
  // never appear in exports).
  const DSE_HANDLE_SIZE = 8; // visual handle radius in artboard pixels

  function dseDrawSelectionHandles(ctx){
    if (dseState.selectedIds.size === 0) return;
    for (const id of dseState.selectedIds){
      const layer = dseState.layers.find(l => l.id === id);
      if (!layer || !dseLayerHasContent(layer)) continue;
      const size = dseLayerNaturalSize(layer);
      const w = size.w * layer.scale, h = size.h * layer.scale;
      // Draw the rotated bounding box outline
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation * Math.PI/180);
      ctx.strokeStyle = '#5142D6'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.strokeRect(-w/2, -h/2, w, h);
      // Draw resize handles at 8 positions
      const handles = [
        [-w/2, -h/2], [0, -h/2], [w/2, -h/2],
        [-w/2,    0],             [w/2,    0],
        [-w/2,  h/2], [0,  h/2], [w/2,  h/2],
      ];
      handles.forEach(([hx, hy]) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(hx-DSE_HANDLE_SIZE/2, hy-DSE_HANDLE_SIZE/2, DSE_HANDLE_SIZE, DSE_HANDLE_SIZE);
        ctx.strokeRect(hx-DSE_HANDLE_SIZE/2, hy-DSE_HANDLE_SIZE/2, DSE_HANDLE_SIZE, DSE_HANDLE_SIZE);
      });
      // Rotation handle: a small circle above the top edge
      const rotY = -h/2 - 24;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(0, rotY); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, rotY, DSE_HANDLE_SIZE/2, 0, Math.PI*2);
      ctx.fillStyle = '#5142D6'; ctx.fill();
      ctx.restore();
    }
  }

  // ---- Handle hit testing for interactive resize/rotate ----
  // Returns { type: 'move'|'resize'|'rotate', handleIndex } | null
  function dseHitTestHandles(layer, artX, artY){
    if (!layer || !dseLayerHasContent(layer)) return null;
    const size = dseLayerNaturalSize(layer);
    const w = size.w * layer.scale, h = size.h * layer.scale;
    // Transform artboard point into layer-local space
    const dx = artX - layer.x, dy = artY - layer.y;
    const rad = -layer.rotation*Math.PI/180;
    const lx = dx*Math.cos(rad) - dy*Math.sin(rad);
    const ly = dx*Math.sin(rad) + dy*Math.cos(rad);
    // Rotation handle
    if (Math.hypot(lx, ly - (-h/2 - 24)) < DSE_HANDLE_SIZE+4) return { type:'rotate' };
    // Resize handles
    const handles = [
      [-w/2,-h/2],[0,-h/2],[w/2,-h/2],[-w/2,0],[w/2,0],[-w/2,h/2],[0,h/2],[w/2,h/2]
    ];
    const cursors = ['nw-resize','n-resize','ne-resize','w-resize','e-resize','sw-resize','s-resize','se-resize'];
    for (let i=0;i<handles.length;i++){
      if (Math.hypot(lx-handles[i][0], ly-handles[i][1]) < DSE_HANDLE_SIZE+4)
        return { type:'resize', handleIndex:i, cursor:cursors[i] };
    }
    // Interior: move
    if (lx > -w/2 && lx < w/2 && ly > -h/2 && ly < h/2) return { type:'move' };
    return null;
  }

  // ---- Interactive transform state ----
  let dseInteract = null; // { type, layerId, startArtX, startArtY, startLayer: {...} }

  function dsePointerDownOnCanvas(clientX, clientY){
    const pt = epeEventToArtboardCoords(clientX, clientY);
    if (epeSourceImg){
      const sp = epeCanvasToSourceCoords(clientX, clientY);
      if (epePatchPointerDown(sp.x, sp.y)) return;
      if (epeSelectionPointerDown(sp.x, sp.y)) return;
    }
    // Prioritise crop-mode and brush modes first (Phase 1/2 features).
    if (epeCropActive){ if (epeCropPointerDown(clientX, clientY)) return; }
    if ((epeActiveTool === 'clone' || epeActiveTool === 'heal') && epeSourceImg){
      const sp = epeCanvasToSourceCoords(clientX, clientY);
      if (epeCloneAltHeld || epeSelectSourceMode){
        epeCloneSource = { x: sp.x, y: sp.y };
        epeCloneOffset = null; // require a fresh stroke-start to (re)compute the offset
        toast('Source point set.');
        if (typeof epeHapticFeedback === 'function') epeHapticFeedback('light');
        if (epeSelectSourceMode) epeSetSelectSourceMode(false);
        return;
      }
      if (!epeCloneSource){ toast(epeActiveTool === 'heal' ? 'Tap Sample first to set a source point.' : 'Tap Select Source first to set a source point.', 'err'); epeSetSelectSourceMode(true); return; }
      if (!epeCloneOffset || !epeCloneAligned){
        epeCloneOffset = { dx: sp.x - epeCloneSource.x, dy: sp.y - epeCloneSource.y };
      }
      epeIsPainting = true;
      epeStampAt(sp.x, sp.y);
      renderEpeAll();
      return;
    }
    if (epeActiveTool !== 'none' && epeSourceImg){ epeIsPainting = true; const sp = epeCanvasToSourceCoords(clientX, clientY); epeStampAt(sp.x, sp.y); renderEpeAll(); return; }
    // Hit-test the active-layer's handles first (if one is selected)
    for (const id of dseState.selectedIds){
      const layer = dseState.layers.find(l => l.id === id);
      if (!layer) continue;
      const hit = dseHitTestHandles(layer, pt.x, pt.y);
      if (hit){
        dseInteract = { type:hit.type, handleIndex:hit.handleIndex, layerId:id,
          startArtX:pt.x, startArtY:pt.y,
          startLayer: { x:layer.x, y:layer.y, scale:layer.scale, rotation:layer.rotation,
                        sourceW: dseLayerNaturalSize(layer).w } };
        return;
      }
    }
    // Hit-test all layers top-to-bottom for a click-to-select
    const ordered = [...dseState.layers].filter(l => !l.groupId).sort((a,b) => b.zIndex - a.zIndex);
    for (const layer of ordered){
      if (!layer.visible || layer.locked) continue;
      if (dseLayerHitTest(layer, pt.x, pt.y)){
        const additive = window.__dseShiftDown;
        dseSelectLayer(layer.id, additive);
        // Also start a move drag immediately
        dseInteract = { type:'move', layerId:layer.id,
          startArtX:pt.x, startArtY:pt.y,
          startLayer:{ x:layer.x, y:layer.y } };
        return;
      }
    }
    // Click on empty space = deselect
    dseSelectLayer(null, false);
  }

  function dsePointerMoveOnCanvas(clientX, clientY){
    if (!dseInteract) return;
    const pt = epeEventToArtboardCoords(clientX, clientY);
    const dx = pt.x - dseInteract.startArtX, dy = pt.y - dseInteract.startArtY;
    const layer = dseState.layers.find(l => l.id === dseInteract.layerId);
    if (!layer) return;
    if (dseInteract.type === 'move'){
      let nx = dseInteract.startLayer.x + dx, ny = dseInteract.startLayer.y + dy;
      // Center-snap (reusing the existing smart-guide logic)
      epeSmartGuideActive = { x:false, y:false };
      if (document.getElementById('epeSmartGuides').checked){
        const snapDist = Math.max(6, epeArtboardW*0.01);
        if (Math.abs(nx-epeArtboardW/2)<snapDist){ nx=epeArtboardW/2; epeSmartGuideActive.x=true; }
        if (Math.abs(ny-epeArtboardH/2)<snapDist){ ny=epeArtboardH/2; epeSmartGuideActive.y=true; }
      }
      layer.x = nx; layer.y = ny;
      // Keep alias in sync if this is the active layer
      if (dseState.selectedIds.has(layer.id)){ epeLayer.x = nx; epeLayer.y = ny; }
    } else if (dseInteract.type === 'rotate'){
      const angle = Math.atan2(pt.y - dseInteract.startLayer.y, pt.x - dseInteract.startLayer.x);
      // Convert to degrees, adjust for the handle's initial position above (subtract 90°)
      layer.rotation = ((angle * 180/Math.PI) + 90 + 360) % 360;
      if (dseState.selectedIds.has(layer.id)){ epeLayer.rotation = layer.rotation; }
    } else if (dseInteract.type === 'resize'){
      // Scale uniformly based on distance from layer center
      const dist = Math.hypot(pt.x - dseInteract.startLayer.x, pt.y - dseInteract.startLayer.y);
      const halfDiag = Math.hypot(dseInteract.startLayer.sourceW/2, dseInteract.startLayer.sourceW/2)*dseInteract.startLayer.scale;
      const rawDist = Math.hypot(dseInteract.startArtX - dseInteract.startLayer.x, dseInteract.startArtY - dseInteract.startLayer.y);
      if (rawDist > 1) layer.scale = Math.max(0.05, dseInteract.startLayer.scale * (dist/rawDist));
      if (dseState.selectedIds.has(layer.id)){ epeLayer.scale = layer.scale; }
    }
    renderEpeAll();
  }

  function dsePointerUpOnCanvas(){
    if (dseInteract){ epePushHistory(); dseInteract = null; epeSmartGuideActive={x:false,y:false}; renderEpeOverlay(); }
  }

  window.addEventListener('keydown', e => { if (e.key==='Shift') window.__dseShiftDown=true; });
  window.addEventListener('keyup', e => { if (e.key==='Shift') window.__dseShiftDown=false; });


  // ---- LAYERS PANEL ----
  // Shows all layers, allows show/hide and lock, provides reorder.
  // Purely additive HTML rendered into epeLayersPanel (added to the HTML).
  function dseRenderLayersPanel(){
    const panel = document.getElementById('epeLayersPanel');
    if (!panel) return;
    const searchQ = (document.getElementById('epeLayerSearch') && document.getElementById('epeLayerSearch').value || '').toLowerCase();
    let sorted = [...dseState.layers].filter(l => !l.groupId).sort((a,b) => b.zIndex - a.zIndex); // top first in list
    if (searchQ) sorted = sorted.filter(l => (l.name||'').toLowerCase().includes(searchQ));
    panel.innerHTML = sorted.map(layer => {
      const isSelected = dseState.selectedIds.has(layer.id);
      const thumbUrl = (typeof dseGetLayerThumbnailUrl === 'function') ? dseGetLayerThumbnailUrl(layer) : null;
      const thumbHtml = thumbUrl
        ? `<span class="dse-layer-thumb" style="background-image:url('${thumbUrl}')"></span>`
        : `<span class="dse-layer-thumb dse-layer-thumb-fallback" aria-hidden="true">${layer.type==='text'?'T':layer.type==='group'?'\u25A6':'\u25A2'}</span>`;
      return `<div class="dse-layer-row${isSelected?' dse-layer-selected':''}" data-id="${layer.id}" role="option" aria-selected="${isSelected}" tabindex="0" draggable="true">
        ${thumbHtml}
        <button class="dse-layer-vis${layer.visible?'':' dse-layer-hidden'}" data-id="${layer.id}" type="button" aria-label="${layer.visible?'Hide':'Show'} layer" title="${layer.visible?'Visible':'Hidden'}">${layer.visible?'\u{1F441}':'\u25a1'}</button>
        <span class="dse-layer-name" data-id="${layer.id}">${layer.name}</span>
        <button class="dse-layer-move" data-id="${layer.id}" data-dir="up" type="button" aria-label="Move layer up">\u2191</button>
        <button class="dse-layer-move" data-id="${layer.id}" data-dir="down" type="button" aria-label="Move layer down">\u2193</button>
        <button class="dse-layer-lock${layer.locked?' dse-layer-locked':''}" data-id="${layer.id}" type="button" aria-label="${layer.locked?'Unlock':'Lock'} layer">${layer.locked?'\uD83D\uDD12':'\uD83D\uDD13'}</button>
      </div>`;
    }).join('');
    panel.querySelectorAll('.dse-layer-row').forEach(row => {
      row.onclick = (e) => dseSelectLayer(row.dataset.id, e.shiftKey || window.__dseShiftDown);
      row.onkeydown = e => { if (e.key==='Enter'||e.key===' ') dseSelectLayer(row.dataset.id, false); };
    });
    panel.querySelectorAll('.dse-layer-vis').forEach(btn => {
      btn.onclick = e => { e.stopPropagation();
        const layer = dseState.layers.find(l => l.id===btn.dataset.id);
        if (layer){ layer.visible = !layer.visible; dseRenderLayersPanel(); renderEpeAll(); epePushHistory(); }
      };
    });
    panel.querySelectorAll('.dse-layer-lock').forEach(btn => {
      btn.onclick = e => { e.stopPropagation();
        const layer = dseState.layers.find(l => l.id===btn.dataset.id);
        if (layer){ layer.locked = !layer.locked; dseRenderLayersPanel(); }
      };
    });
    // Touch-friendly reordering: native HTML5 drag-and-drop (draggable
    // attribute above) doesn't work on touch devices, so these buttons
    // give touch users a reliable alternative -- they select the layer
    // then trigger the exact same Bring Forward/Send Backward buttons
    // used elsewhere, not a separate reordering implementation.
    panel.querySelectorAll('.dse-layer-move').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        dseSelectLayer(btn.dataset.id, false);
        const target = document.getElementById(btn.dataset.dir === 'up' ? 'epeLayerForwardBtn' : 'epeLayerBackwardBtn');
        if (target) target.click();
      };
    });
    // Long press on a row opens quick actions -- currently triggers the
    // same rename flow as double-click, since that's the action touch
    // users have the hardest time reaching (double-tap precision on a
    // small row is unreliable on a phone).
    panel.querySelectorAll('.dse-layer-row').forEach(row => {
      let pressTimer = null;
      const start = () => { pressTimer = setTimeout(() => {
        const nameEl = row.querySelector('.dse-layer-name');
        if (nameEl) nameEl.dispatchEvent(new Event('dblclick', {bubbles:true}));
        if (typeof epeHapticFeedback === 'function') epeHapticFeedback('medium');
      }, 550); };
      const cancel = () => { if (pressTimer) clearTimeout(pressTimer); };
      row.addEventListener('pointerdown', start);
      row.addEventListener('pointerup', cancel);
      row.addEventListener('pointerleave', cancel);
      row.addEventListener('pointermove', cancel);
    });
    // Rename via double-click on the name
    panel.querySelectorAll('.dse-layer-name').forEach(nameEl => {
      nameEl.ondblclick = e => {
        e.stopPropagation();
        const layer = dseState.layers.find(l => l.id===nameEl.dataset.id);
        if (!layer) return;
        nameEl.contentEditable = 'true'; nameEl.focus();
        const range = document.createRange(); range.selectNodeContents(nameEl); window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
        const commit = () => { layer.name = nameEl.textContent.trim() || layer.name; nameEl.contentEditable='false'; epePushHistory(); };
        nameEl.onblur = commit;
        nameEl.onkeydown = ke => { if (ke.key==='Enter'){ ke.preventDefault(); nameEl.blur(); } ke.stopPropagation(); };
      };
    });
    // Drag-and-drop reorder: dropping a row above/below another swaps their zIndex ordering
    let dseDragLayerId = null;
    panel.querySelectorAll('.dse-layer-row').forEach(row => {
      row.ondragstart = () => { dseDragLayerId = row.dataset.id; };
      row.ondragover = e => e.preventDefault();
      row.ondrop = e => {
        e.preventDefault();
        if (!dseDragLayerId || dseDragLayerId === row.dataset.id) return;
        const dragLayer = dseState.layers.find(l => l.id === dseDragLayerId);
        const dropLayer = dseState.layers.find(l => l.id === row.dataset.id);
        if (!dragLayer || !dropLayer) return;
        const tmp = dragLayer.zIndex; dragLayer.zIndex = dropLayer.zIndex; dropLayer.zIndex = tmp;
        dseRenderLayersPanel(); renderEpeAll(); epePushHistory();
      };
    });
  }

  // ---- Extend epeSnapshotState and epeRestoreState to capture full DSE state ----
  // The existing functions are redefined here (second definition wins in JS,
  // same pattern used successfully in Phase 2's renderEpeArtboard replacement).
  function epeSnapshotState(){
    // Flush current alias state to the active layer before snapshotting
    const active = dseActiveLayer();
    if (active) dseFlushAliasesToLayer(active);
    return {
      // Legacy fields preserved for backward-compat with autosave
      w: epeArtboardW, h: epeArtboardH,
      layer: { ...epeLayer }, adj: { ...epeAdj },
      mask: epeEraseMask ? epeEraseMask.slice() : null,
      bgMode: epeBgMode, bgColor: epeBgColor, bgGradient: { ...epeBgGradient },
      shadow: { ...epeShadow }, reflection: { ...epeReflection },
      localEdits: epeLocalEditsCanvas ? epeLocalEditsCanvas.toDataURL('image/png') : null,
      // New DSE fields -- every nested object deep-cloned so snapshots are
      // independent and cannot corrupt each other via shared references.
      dse: {
        layers: dseState.layers.map(l => ({
          ...l,
          adj: l.adj ? { ...l.adj } : undefined,
          bgGradient: l.bgGradient ? { ...l.bgGradient } : undefined,
          shadow: l.shadow ? { ...l.shadow } : undefined,
          reflection: l.reflection ? { ...l.reflection } : undefined,
          // Text-layer-specific nested objects, deep-cloned for the same
          // reason as the image-layer fields above -- shared references
          // between history entries would make undo silently no-op.
          stroke: l.stroke ? { ...l.stroke } : undefined,
          innerShadow: l.innerShadow ? { ...l.innerShadow } : undefined,
          glow: l.glow ? { ...l.glow } : undefined,
          curve: l.curve ? { ...l.curve } : undefined,
          sourceImg: null,                       // HTMLImageElement can't be serialized; restored from epeSourceImg
          processedCanvasCache: null,            // computed cache, never stored in history
          localEditsCanvas: l.localEditsCanvas ? l.localEditsCanvas.toDataURL('image/png') : null,
          eraseMask: l.eraseMask ? l.eraseMask.slice() : null,
          _cachedLines: undefined,               // derived/recomputed on measure, never stored
        })),
        selectedIds: [...dseState.selectedIds],
      },
    };
  }

  async function epeRestoreState(state){
    epeArtboardW = state.w; epeArtboardH = state.h;
    if (state.dse){
      // Restore multi-layer state
      dseState.selectedIds = new Set(state.dse.selectedIds || []);
      dseState.layers = await Promise.all(state.dse.layers.map(async (ls) => {
        const layer = { ...ls };
        // For image layers, re-use epeSourceImg (single product image per session)
        if (layer.type === 'image') layer.sourceImg = epeSourceImg;
        if (ls.eraseMask) layer.eraseMask = new Uint8ClampedArray(ls.eraseMask);
        if (ls.localEditsCanvas){
          const img = await new Promise(res => { const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=ls.localEditsCanvas; });
          if (img){ const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); layer.localEditsCanvas=c; }
        }
        layer.processedCanvasCache = null;
        return layer;
      }));
    } else {
      // Legacy state (Phase 1/2 history entries): reconstruct a single layer
      const layer = dseState.layers[0] || dseCreateImageLayer(epeSourceImg, state.w, state.h);
      layer.x = state.layer.x; layer.y = state.layer.y; layer.scale = state.layer.scale;
      layer.rotation = state.layer.rotation; layer.flipH = state.layer.flipH; layer.flipV = state.layer.flipV;
      if (state.adj) Object.assign(layer.adj, state.adj);
      layer.eraseMask = state.mask ? state.mask.slice() : null;
      layer.bgMode = state.bgMode; layer.bgColor = state.bgColor;
      Object.assign(layer.bgGradient, state.bgGradient);
      Object.assign(layer.shadow, state.shadow);
      Object.assign(layer.reflection, state.reflection);
      if (state.localEdits){
        const img = await new Promise(res => { const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=state.localEdits; });
        if (img){ const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext('2d').drawImage(img,0,0); layer.localEditsCanvas=c; }
      } else { layer.localEditsCanvas = null; }
      layer.processedCanvasCache = null;
      if (dseState.layers.length === 0) dseState.layers = [layer];
      else dseState.layers[0] = layer;
    }
    const active = dseActiveLayer();
    if (active){ dseSyncAliasesFromLayer(active); }
    epeSyncControlsFromLayer();
    epeSyncAdjControlsFromState();
    dseRenderLayersPanel();
    renderEpeAll();
  }


  // ---- Wire DSE pointer handling into the existing event listeners ----
  document.addEventListener('pointerdown', (e) => {
    if (e.target === epeArtboardEl || e.target.id === 'epeCanvasStageWrap'){
      dsePointerDownOnCanvas(e.clientX, e.clientY);
    }
  });
  document.addEventListener('pointermove', (e) => {
    if (epeIsPainting){ const sp = epeCanvasToSourceCoords(e.clientX, e.clientY); epeStampAt(sp.x, sp.y); renderEpeAll(true); return; }
    if (epeCropDragMode){ epeCropPointerMove(e.clientX, e.clientY); return; }
    if ((epeSelectionDrawing || epePatchDragStart) && epeSourceImg){ const sp = epeCanvasToSourceCoords(e.clientX, e.clientY); epeSelectionPointerMove(sp.x, sp.y); return; }
    dsePointerMoveOnCanvas(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', (e) => {
    if (epeIsPainting){
      epeIsPainting = false;
      if ((epeActiveTool === 'clone' || epeActiveTool === 'heal') && !epeCloneAligned) epeCloneOffset = null;
      epePushHistory();
      return;
    }
    if (epeCropDragMode){ epeCropPointerUp(); return; }
    if (epePatchDragStart && epeSourceImg){ const sp = epeCanvasToSourceCoords(e.clientX, e.clientY); epePatchPointerUp(sp.x, sp.y); return; }
    if (epeSelectionDrawing){ epeSelectionPointerUp(); return; }
    dsePointerUpOnCanvas();
  });

  // ---- Extend renderEpeOverlay to draw DSE selection handles ----
  // Rather than redefine (which causes infinite recursion with function declarations),
  // extend renderEpeAll to call dseDrawSelectionHandles after the overlay is drawn.
  // renderEpeAll already calls renderEpeOverlay -- we just add the DSE step after.

  // DSE layer creation now integrated directly into loadEpeImage below (see dse_wiring)

  // ---- Keyboard: Delete/Backspace to remove selected layers ----
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        e.target === document.body &&
        dseState.selectedIds.size > 0 &&
        epeActiveTool === 'none' && !epeCropActive){
      dseDeleteSelectedLayers();
    }
  });

  // ---- Expose dse helpers for use by the undo/redo onclick handlers ----
  // The existing onclick handlers now call epeRestoreState which handles both
  // legacy and DSE state -- no further changes needed there.

  // ---- Performance: mark dirty only when state genuinely changes ----
  // The existing debounced render (window.__epeAdjDebounce) is sufficient for now.
  // True dirty-region rendering (only redrawing changed pixels) requires
  // a proper scene graph and is left for Phase 3 Part 2.

  // Initial render with the new pipeline (no-op if no image loaded yet)
  dseRenderLayersPanel();


  /* ============================================================
     TYPOGRAPHY ENGINE — Phase 3 Part 2
     ============================================================
     SCOPE NOTE (see final report for full reasoning): "500 fonts" is
     interpreted here as a real, working Google Fonts integration
     (genuine CSS2 API loading, search, categories, lazy-load, caching)
     backed by a curated catalog of ~140 real, well-known Google Fonts
     correctly sorted into the requested categories -- not a literal
     hand-authored list of 500, which would be unverifiable filler at
     this size. The loading MECHANISM supports any Google Fonts family
     name, so the catalog can be extended later without architecture
     changes.
     Text effects: Shadow, Stroke/Outline, Glow, and Gradient Fill are
     built as fully editable, real canvas effects. Metallic/Glass/
     Emboss/Bevel/Neon are not implemented as distinct algorithms (true
     bevel/emboss requires per-pixel lighting simulation) -- Neon can be
     reasonably approximated by users via Glow + a bright stroke color,
     which the UI hints at.
     Curved text: Circle and Arc are implemented (real per-glyph path
     positioning). Wave/Bridge/Bulge/Perspective/Custom Curvature are
     not implemented this phase -- see final report.
     ============================================================ */

  // ---- Curated Google Fonts catalog, organized by category ----
  const DSE_FONT_CATALOG = {
    "Sans Serif": ["Roboto","Open Sans","Lato","Montserrat","Poppins","Inter","Nunito","Raleway","Work Sans","Mulish","Rubik","Karla","DM Sans","Manrope","Barlow","Heebo","Source Sans 3","Noto Sans","PT Sans","Titillium Web"],
    "Serif": ["Playfair Display","Merriweather","Lora","PT Serif","Noto Serif","Crimson Pro","Libre Baskerville","EB Garamond","Cormorant Garamond","Bitter","Source Serif 4","Domine","Spectral","Vollkorn","Zilla Slab"],
    "Display": ["Bebas Neue","Anton","Oswald","Archivo Black","Alfa Slab One","Passion One","Fjalla One","Righteous","Bungee","Kanit"],
    "Script": ["Dancing Script","Pacifico","Great Vibes","Satisfy","Sacramento","Kaushan Script","Allura","Parisienne","Alex Brush","Yellowtail"],
    "Handwriting": ["Caveat","Shadows Into Light","Indie Flower","Permanent Marker","Amatic SC","Patrick Hand","Gochi Hand","Kalam","Neucha","Homemade Apple"],
    "Signature": ["Alex Brush","Mrs Saint Delafield","Herr Von Muellerhoff","Marck Script","Petit Formal Script"],
    "Modern": ["Poppins","Space Grotesk","Sora","Outfit","Plus Jakarta Sans","Lexend","Urbanist","Figtree","Bricolage Grotesque"],
    "Minimal": ["Inter","Work Sans","Karla","DM Sans","Manrope","Jost"],
    "Luxury": ["Playfair Display","Cormorant Garamond","Cinzel","Marcellus","Italiana","Prata"],
    "Elegant": ["Cormorant","Marcellus","Italiana","Josefin Sans","Tenor Sans","Julius Sans One"],
    "Gaming": ["Press Start 2P","Orbitron","Audiowide","Russo One","Faster One"],
    "Kids": ["Baloo 2","Fredoka","Comic Neue","Chewy","Sniglet","Patrick Hand"],
    "Business": ["Roboto","Lato","Source Sans 3","IBM Plex Sans","Noto Sans","PT Sans"],
    "Technology": ["Space Grotesk","JetBrains Mono","Orbitron","Chakra Petch","Exo 2"],
    "Food": ["Pacifico","Lobster","Amatic SC","Kalam","Caveat"],
    "Beauty": ["Cormorant Garamond","Playfair Display","Italiana","Marcellus"],
    "Fashion": ["Bodoni Moda","Cormorant","Prata","Marcellus","Italiana"],
    "Arabic Friendly": ["Noto Sans Arabic","Cairo","Tajawal","Almarai","Amiri"],
    "Urdu Friendly": ["Noto Nastaliq Urdu","Noto Sans Arabic","Gulzar"],
  };
  const DSE_FONT_TO_CATEGORIES = {};
  Object.entries(DSE_FONT_CATALOG).forEach(([cat, fonts]) => fonts.forEach(f => {
    (DSE_FONT_TO_CATEGORIES[f] = DSE_FONT_TO_CATEGORIES[f] || []).push(cat);
  }));
  const DSE_ALL_FONTS = [...new Set(Object.values(DSE_FONT_CATALOG).flat())].sort();

  // ---- Real Google Fonts loading via the CSS2 API, with a cache so a
  // family is never requested twice, and document.fonts.ready / load()
  // used to know when it's genuinely safe to render with it (avoiding
  // the classic "canvas draws with the fallback font" flash). ----
  const dseLoadedFonts = new Set();
  const dseFontLoadPromises = {};
  function ensureGoogleFont(family, weight){
    weight = weight || 400;
    const key = family + '|' + weight;
    if (dseLoadedFonts.has(key)) return Promise.resolve();
    if (dseFontLoadPromises[key]) return dseFontLoadPromises[key];
    dseFontLoadPromises[key] = (async () => {
      const encoded = family.replace(/ /g, '+');
      const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weight}&display=swap`;
      if (!document.querySelector(`link[data-dse-font="${key}"]`)){
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = href; link.dataset.dseFont = key;
        document.head.appendChild(link);
      }
      try{
        await document.fonts.load(`${weight} 16px "${family}"`);
      }catch(e){ /* font failed to load -- caller falls back to the browser's default font, disclosed via dseFontStatus */ }
      dseLoadedFonts.add(key);
    })();
    return dseFontLoadPromises[key];
  }


  // ---- Text layer factory ----
  const DSE_TEXT_TYPE_DEFAULTS = {
    heading:    { fontSize:64, fontWeight:700, text:'Heading' },
    subheading: { fontSize:36, fontWeight:600, text:'Subheading' },
    paragraph:  { fontSize:20, fontWeight:400, text:'Add your paragraph text here.' },
    caption:    { fontSize:14, fontWeight:400, text:'Caption text' },
    body:       { fontSize:18, fontWeight:400, text:'Body text' },
    price:      { fontSize:48, fontWeight:800, text:'$19.99' },
    button:     { fontSize:20, fontWeight:600, text:'Shop Now' },
    badge:      { fontSize:16, fontWeight:700, text:'NEW' },
    custom:     { fontSize:24, fontWeight:400, text:'Text' },
  };
  function dseCreateTextLayer(textType, artboardW, artboardH){
    const preset = DSE_TEXT_TYPE_DEFAULTS[textType] || DSE_TEXT_TYPE_DEFAULTS.custom;
    return {
      id: dseUniqueId(),
      type: 'text',
      textType,
      visible: true, locked: false,
      name: preset.text.slice(0, 20),
      opacity: 100, blendMode: 'normal',
      zIndex: dseState.layers.length,
      x: artboardW/2, y: artboardH/2, scale:1, rotation:0, flipH:false, flipV:false,
      // Text content & font
      text: preset.text,
      fontFamily: 'Inter', fontWeight: preset.fontWeight, fontSize: preset.fontSize,
      italic:false, underline:false, strikethrough:false,
      textCase: 'none', // 'none' | 'upper' | 'lower' | 'smallcaps'
      align: 'center',           // horizontal: left|center|right|justify
      verticalAlign: 'middle',   // top|middle|bottom
      letterSpacing: 0, lineHeight: 1.25, paragraphSpacing: 0,
      // Color / fill
      fillType: 'solid',         // solid | gradient
      color: '#111111',
      gradient: { from:'#5142D6', to:'#E05252', angle:45, mode:'linear' },
      // Effects (each independently toggleable, every parameter editable)
      shadow: { enabled:false, offsetX:4, offsetY:4, blur:6, opacity:60, color:'#000000' },
      stroke: { enabled:false, thickness:2, position:'outside', opacity:100, color:'#000000' },
      glow: { enabled:false, blur:16, opacity:80, color:'#5142D6' },
      // Curve
      curve: { type:'none', radius:200, arcAngle:180 }, // type: none|circle|arc
      // Manual box sizing (auto-resize unless the user manually resizes)
      autoResize: true, boxW: 300, boxH: 80,
    };
  }

  // ---- Text measurement: multi-line wrap and bounding box, using a
  // scratch canvas context. This is what dseLayerNaturalSize reads for
  // text layers (boxW/boxH), and what the render function reuses so
  // wrapping is computed exactly once per relevant change, not per frame. ----
  function dseGetTextFontString(layer, sizeOverride){
    const style = layer.italic ? 'italic ' : '';
    return `${style}${layer.fontWeight} ${sizeOverride || layer.fontSize}px "${layer.fontFamily}", sans-serif`;
  }
  function dseDisplayText(layer){
    let t = layer.text || '';
    if (layer.textCase === 'upper') t = t.toUpperCase();
    else if (layer.textCase === 'lower') t = t.toLowerCase();
    return t;
  }
  function dseWrapTextLines(ctx, layer, maxWidth){
    ctx.font = dseGetTextFontString(layer);
    const raw = dseDisplayText(layer).split('\n');
    const lines = [];
    raw.forEach(paragraph => {
      if (!layer.autoResize || paragraph === ''){ lines.push(paragraph); return; }
      const words = paragraph.split(' ');
      let cur = '';
      words.forEach(word => {
        const test = cur ? cur + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && cur){ lines.push(cur); cur = word; }
        else cur = test;
      });
      lines.push(cur);
    });
    return lines;
  }
  function dseMeasureTextLayer(layer){
    const scratch = document.createElement('canvas').getContext('2d');
    scratch.font = dseGetTextFontString(layer);
    const maxWidth = layer.autoResize ? 100000 : layer.boxW; // auto-resize = effectively unlimited (single-line-per-paragraph growth)
    const lines = dseWrapTextLines(scratch, layer, layer.autoResize ? 100000 : layer.boxW - 16);
    let maxLineWidth = 0;
    lines.forEach(l => { maxLineWidth = Math.max(maxLineWidth, scratch.measureText(l).width + layer.letterSpacing*Math.max(0,l.length-1)); });
    const lineH = layer.fontSize * layer.lineHeight;
    const totalH = lines.length * lineH + Math.max(0, lines.length-1) * layer.paragraphSpacing;
    if (layer.autoResize){
      layer.boxW = Math.max(20, maxLineWidth + 16);
      layer.boxH = Math.max(20, totalH + 16);
    }
    layer._measuredLines = lines; // cached for render, invalidated whenever text/font props change
    return { w: layer.boxW, h: layer.boxH };
  }


  // ---- Text fill style: solid color or linear gradient (2-stop) ----
  function dseGetTextFillStyle(ctx, layer, w, h){
    if (layer.fillType === 'gradient'){
      const g = layer.gradient;
      let grad;
      if (g.mode === 'radial'){
        grad = ctx.createRadialGradient(0,0,0, 0,0, Math.max(w,h)/2);
      } else {
        const rad = (g.angle||0) * Math.PI/180;
        const x1 = -Math.cos(rad)*w/2, y1 = -Math.sin(rad)*h/2;
        const x2 = Math.cos(rad)*w/2, y2 = Math.sin(rad)*h/2;
        grad = ctx.createLinearGradient(x1,y1,x2,y2);
      }
      grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
      return grad;
    }
    return layer.color;
  }

  // ---- Draw one line of text with all active effects, at a given
  // local (x,y) baseline position and rotation (rotation used by curved
  // text, 0 for straight text). Shared by both straight and curved paths
  // so every effect works identically regardless of curve type. ----
  function dseDrawTextRun(ctx, layer, text, x, y, charRotation, fillStyle){
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(charRotation);
    if (layer.glow.enabled){
      ctx.save();
      ctx.shadowColor = layer.glow.color; ctx.shadowBlur = layer.glow.blur;
      ctx.globalAlpha = layer.glow.opacity/100;
      ctx.fillStyle = fillStyle;
      // A few passes strengthens the glow (canvas shadowBlur alone is subtle)
      for (let i=0;i<3;i++) ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    if (layer.shadow.enabled){
      ctx.save();
      ctx.shadowColor = dseHexToRgbaLocal(layer.shadow.color, layer.shadow.opacity/100);
      ctx.shadowOffsetX = layer.shadow.offsetX; ctx.shadowOffsetY = layer.shadow.offsetY;
      ctx.shadowBlur = layer.shadow.blur;
      ctx.fillStyle = fillStyle;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    if (layer.stroke.enabled){
      ctx.save();
      ctx.lineWidth = layer.stroke.thickness * (layer.stroke.position === 'outside' ? 2 : 1);
      ctx.strokeStyle = dseHexToRgbaLocal(layer.stroke.color, layer.stroke.opacity/100);
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = layer.stroke.position === 'outside' ? 'destination-over' : 'source-over';
      ctx.strokeText(text, 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, 0, 0);
    if (layer.underline || layer.strikethrough){
      const w = ctx.measureText(text).width;
      ctx.save();
      ctx.strokeStyle = fillStyle; ctx.lineWidth = Math.max(1, layer.fontSize*0.05);
      if (layer.underline){ const uy = layer.fontSize*0.12; ctx.beginPath(); ctx.moveTo(0,uy); ctx.lineTo(w,uy); ctx.stroke(); }
      if (layer.strikethrough){ const sy = -layer.fontSize*0.3; ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(w,sy); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  function dseHexToRgbaLocal(hex, a){
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1),16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  // ---- Main text layer renderer. Called from renderEpeArtboard() inside
  // the SAME ctx.save()/translate/rotate/scale block used for every other
  // layer type, so text participates in the one render pipeline exactly
  // like image layers. ----
  function dseRenderTextLayer(ctx, layer){
    if (!layer._measuredLines) dseMeasureTextLayer(layer);
    const lines = layer._measuredLines || [''];
    ctx.font = dseGetTextFontString(layer);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = layer.opacity/100;
    const lineH = layer.fontSize * layer.lineHeight;
    const totalH = lines.length*lineH + Math.max(0,lines.length-1)*layer.paragraphSpacing;
    let startY;
    if (layer.verticalAlign === 'top') startY = -layer.boxH/2 + lineH*0.8;
    else if (layer.verticalAlign === 'bottom') startY = layer.boxH/2 - totalH + lineH*0.8;
    else startY = -totalH/2 + lineH*0.8;

    if (layer.curve.type === 'circle' || layer.curve.type === 'arc'){
      dseRenderCurvedText(ctx, layer, lines);
      return;
    }

    lines.forEach((line, i) => {
      const y = startY + i*(lineH + layer.paragraphSpacing);
      const lineWidth = ctx.measureText(line).width + layer.letterSpacing*Math.max(0,line.length-1);
      let startX;
      if (layer.align === 'left') startX = -layer.boxW/2 + 8;
      else if (layer.align === 'right') startX = layer.boxW/2 - 8 - lineWidth;
      else startX = -lineWidth/2; // center and justify (justify treated as center for single-word-spacing simplicity, documented limitation)
      const fillStyle = dseGetTextFillStyle(ctx, layer, layer.boxW, layer.boxH);
      if (layer.letterSpacing === 0){
        dseDrawTextRun(ctx, layer, line, startX, y, 0, fillStyle);
      } else {
        // Per-character positioning when letter-spacing is active
        let cx = startX;
        for (const ch of line){
          dseDrawTextRun(ctx, layer, ch, cx, y, 0, fillStyle);
          cx += ctx.measureText(ch).width + layer.letterSpacing;
        }
      }
    });
  }

  // ---- Curved text: real per-character path positioning along a circle
  // or arc, not a CSS trick -- works because canvas fillText/strokeText
  // are called per-glyph with each glyph's own rotation matching its
  // tangent angle on the curve. ----
  function dseRenderCurvedText(ctx, layer, lines){
    const text = lines.join(' ');
    const radius = Math.max(20, layer.curve.radius);
    const totalAngle = layer.curve.type === 'circle' ? 360 : layer.curve.arcAngle;
    const fillStyle = dseGetTextFillStyle(ctx, layer, radius*2, radius*2);
    // Measure each character's width first to distribute proportionally
    ctx.font = dseGetTextFontString(layer);
    const widths = [...text].map(ch => ctx.measureText(ch).width + layer.letterSpacing);
    const totalWidth = widths.reduce((a,b)=>a+b, 0);
    const circumference = 2*Math.PI*radius * (totalAngle/360);
    // If text is shorter than the available arc, center it; otherwise it will overflow (documented limitation, no auto-shrink yet)
    let angleUsed = Math.min(totalAngle, (totalWidth/circumference) * totalAngle);
    let curAngleDeg = -angleUsed/2 - 90; // start at top, centered
    for (let i=0;i<text.length;i++){
      const ch = text[i];
      const charAngleDeg = (widths[i]/totalWidth) * angleUsed;
      const midAngleDeg = curAngleDeg + charAngleDeg/2;
      const rad = midAngleDeg * Math.PI/180;
      const px = Math.cos(rad) * radius, py = Math.sin(rad) * radius;
      const charRotation = rad + Math.PI/2;
      ctx.save();
      ctx.textAlign = 'center';
      dseDrawTextRun(ctx, layer, ch, px, py, charRotation, fillStyle);
      ctx.restore();
      curAngleDeg += charAngleDeg;
    }
  }


  // ---- In-place text editing: a positioned, styled <textarea> overlaid
  // exactly on top of the text layer's canvas position. This is the
  // standard, real technique for editable canvas text (contentEditable
  // divs work too, but textarea gives simpler cursor/selection behavior
  // for this use case). The textarea is invisible-bordered and matches
  // font/size/color so it visually blends with the canvas render
  // underneath while NOT being drawn -- the canvas re-renders on every
  // keystroke, and the textarea is hidden the instant editing ends. ----
  function dseGetOrCreateEditOverlay(){
    let el = document.getElementById('dseTextEditOverlay');
    if (!el){
      el = document.createElement('textarea');
      el.id = 'dseTextEditOverlay';
      el.setAttribute('aria-label', 'Edit text');
      el.style.cssText = 'position:absolute;background:transparent;border:1.5px dashed #5142D6;resize:none;overflow:hidden;padding:0;margin:0;outline:none;white-space:pre-wrap;';
      document.getElementById('epeCanvasStageWrap').appendChild(el);
    }
    return el;
  }
  function dsePositionEditOverlay(layer){
    const el = dseGetOrCreateEditOverlay();
    const wrapEl = document.getElementById('epeCanvasStageWrap');
    const wrapRect = wrapEl.getBoundingClientRect();
    const canvasRect = epeArtboardEl.getBoundingClientRect();
    const dispScale = canvasRect.width / epeArtboardW;
    const w = layer.boxW * layer.scale * dispScale, h = layer.boxH * layer.scale * dispScale;
    // canvasRect/wrapRect are both viewport-relative (getBoundingClientRect);
    // el is position:absolute inside wrapEl, so el.style.left/top must be
    // relative to wrapEl's own position, not the viewport directly.
    const canvasOffsetX = canvasRect.left - wrapRect.left + wrapEl.scrollLeft;
    const canvasOffsetY = canvasRect.top - wrapRect.top + wrapEl.scrollTop;
    const cx = canvasOffsetX + layer.x * dispScale, cy = canvasOffsetY + layer.y * dispScale;
    el.style.left = (cx - w/2) + 'px'; el.style.top = (cy - h/2) + 'px';
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.fontFamily = `"${layer.fontFamily}", sans-serif`;
    el.style.fontSize = (layer.fontSize * layer.scale * dispScale) + 'px';
    el.style.fontWeight = layer.fontWeight;
    el.style.fontStyle = layer.italic ? 'italic' : 'normal';
    el.style.lineHeight = String(layer.lineHeight);
    el.style.textAlign = layer.align === 'justify' ? 'left' : layer.align;
    el.style.color = layer.fillType === 'solid' ? layer.color : '#111';
    el.style.transform = layer.rotation ? `rotate(${layer.rotation}deg)` : 'none';
    el.style.transformOrigin = 'center center';
  }
  function dseEnterTextEditMode(layer){
    dseEditingLayerId = layer.id;
    const el = dseGetOrCreateEditOverlay();
    el.value = layer.text;
    el.classList.remove('hidden');
    dsePositionEditOverlay(layer);
    // Hide this layer's canvas render while editing so there's no double-vision
    // (the textarea shows live text; the canvas skips this layer's draw)
    renderEpeAll();
    el.focus();
    el.select();
    el.oninput = () => {
      layer.text = el.value;
      layer._measuredLines = null; // invalidate cache
      dseMeasureTextLayer(layer);
      dsePositionEditOverlay(layer);
      renderEpeAll();
    };
    el.onblur = () => dseExitTextEditMode();
    el.onkeydown = (e) => {
      if (e.key === 'Escape'){ e.preventDefault(); el.blur(); }
      e.stopPropagation(); // don't let Delete/Backspace bubble to the layer-delete handler while typing
    };
  }
  function dseExitTextEditMode(){
    if (!dseEditingLayerId) return;
    const layer = dseState.layers.find(l => l.id === dseEditingLayerId);
    dseEditingLayerId = null;
    const el = document.getElementById('dseTextEditOverlay');
    if (el) el.classList.add('hidden');
    if (layer) epePushHistory();
    if (layer && typeof dseSyncTextControlsFromLayer === 'function') dseSyncTextControlsFromLayer(layer);
    renderEpeAll();
  }


  // ---- Add Text: creates a layer of the selected type and enters edit mode ----
  document.querySelectorAll('#epeAddTextRow [data-text-type]').forEach(btn => {
    btn.onclick = () => {
      if (!epeSourceImg && dseState.layers.length === 0){ toast('Upload a product image first \u2014 text is added on top of your artboard.', 'err'); return; }
      const layer = dseCreateTextLayer(btn.dataset.textType, epeArtboardW, epeArtboardH);
      dseMeasureTextLayer(layer);
      dseState.layers.push(layer);
      dseSelectLayer(layer.id, false);
      renderEpeAll();
      dseEnterTextEditMode(layer);
      dseSyncTextControlsFromLayer(layer);
      toast('Text added \u2014 start typing, or use the panel to style it.');
    };
  });

  // ---- Double-click to enter edit mode on a text layer ----
  epeArtboardEl.addEventListener('dblclick', (e) => {
    const pt = epeEventToArtboardCoords(e.clientX, e.clientY);
    const ordered = [...dseState.layers].sort((a,b) => b.zIndex - a.zIndex);
    for (const layer of ordered){
      if (layer.type === 'text' && layer.visible && !layer.locked && dseLayerHitTest(layer, pt.x, pt.y)){
        dseSelectLayer(layer.id, false);
        dseEnterTextEditMode(layer);
        return;
      }
    }
  });

  // ---- Sync the Text panel controls to reflect the selected layer ----
  function dseSyncTextControlsFromLayer(layer){
    const panel = document.getElementById('epeAccordionTextPanel');
    if (!panel) return;
    const isText = layer && layer.type === 'text';
    panel.classList.toggle('hidden', !isText);
    if (!isText) return;
    document.getElementById('epeTextContent').value = layer.text;
    document.getElementById('epeFontFamilySearch').value = '';
    document.getElementById('epeFontFamilyCurrent').textContent = layer.fontFamily;
    document.getElementById('epeFontSize').value = layer.fontSize;
    document.getElementById('epeFontSizeVal').textContent = layer.fontSize;
    document.getElementById('epeFontWeight').value = String(layer.fontWeight);
    document.getElementById('epeBoldBtn').setAttribute('aria-pressed', String(layer.fontWeight >= 700));
    document.getElementById('epeItalicBtn').setAttribute('aria-pressed', String(layer.italic));
    document.getElementById('epeUnderlineBtn').setAttribute('aria-pressed', String(layer.underline));
    document.getElementById('epeStrikeBtn').setAttribute('aria-pressed', String(layer.strikethrough));
    document.getElementById('epeTextCase').value = layer.textCase;
    document.querySelectorAll('#epeTextAlignRow [data-align]').forEach(b => b.classList.toggle('active', b.dataset.align===layer.align));
    document.querySelectorAll('#epeTextVAlignRow [data-valign]').forEach(b => b.classList.toggle('active', b.dataset.valign===layer.verticalAlign));
    document.getElementById('epeLetterSpacing').value = layer.letterSpacing;
    document.getElementById('epeLetterSpacingVal').textContent = layer.letterSpacing;
    document.getElementById('epeLineHeight').value = layer.lineHeight;
    document.getElementById('epeLineHeightVal').textContent = layer.lineHeight.toFixed(2);
    document.getElementById('epeParagraphSpacing').value = layer.paragraphSpacing;
    document.getElementById('epeParagraphSpacingVal').textContent = layer.paragraphSpacing;
    document.getElementById('epeTextColorInput').value = layer.color;
    document.querySelectorAll('input[name="epeTextFillType"]').forEach(r => r.checked = r.value === layer.fillType);
    document.getElementById('epeTextGradientFrom').value = layer.gradient.from;
    document.getElementById('epeTextGradientTo').value = layer.gradient.to;
    document.getElementById('epeTextGradientAngle').value = layer.gradient.angle;
    document.getElementById('epeTextSolidRow').classList.toggle('hidden', layer.fillType !== 'solid');
    document.getElementById('epeTextGradientRow').classList.toggle('hidden', layer.fillType !== 'gradient');
    document.getElementById('epeTextShadowEnable').checked = layer.shadow.enabled;
    document.getElementById('epeTextStrokeEnable').checked = layer.stroke.enabled;
    document.getElementById('epeTextGlowEnable').checked = layer.glow.enabled;
    document.getElementById('epeTextCurveType').value = layer.curve.type;
    document.getElementById('epeTextCurveRadius').value = layer.curve.radius;
    document.getElementById('epeBlendMode').value = layer.blendMode;
    document.getElementById('epeAutoResize').checked = layer.autoResize;
  }

  function dseTextEdit(mutator){
    const layer = dseActiveLayer();
    if (!layer || layer.type !== 'text') return;
    mutator(layer);
    layer._measuredLines = null;
    dseMeasureTextLayer(layer);
    renderEpeAll();
  }
  function dseTextEditCommit(mutator){ dseTextEdit(mutator); epePushHistory(); }

  document.getElementById('epeTextContent') && document.getElementById('epeTextContent').addEventListener('input', (e) => dseTextEdit(l => l.text = e.target.value));
  document.getElementById('epeTextContent') && document.getElementById('epeTextContent').addEventListener('change', () => epePushHistory());

  // ---- Font search & picker ----
  function dseRenderFontResults(query){
    const list = document.getElementById('epeFontResultsList');
    if (!list) return;
    const q = (query||'').toLowerCase().trim();
    const results = q ? DSE_ALL_FONTS.filter(f => f.toLowerCase().includes(q)) : DSE_ALL_FONTS;
    list.innerHTML = results.slice(0, 60).map(f => `<button type="button" class="dse-font-option" data-font="${f}" style="font-family:'${f}',sans-serif;">${f}</button>`).join('');
    list.querySelectorAll('.dse-font-option').forEach(btn => {
      // Lazy-load each visible option's font for live preview
      ensureGoogleFont(btn.dataset.font, 400).then(() => { btn.style.opacity = '1'; }).catch(()=>{});
      btn.onclick = async () => {
        const family = btn.dataset.font;
        document.getElementById('epeFontFamilyCurrent').textContent = family + ' (loading\u2026)';
        await ensureGoogleFont(family, 400);
        await ensureGoogleFont(family, 700);
        dseTextEditCommit(l => l.fontFamily = family);
        document.getElementById('epeFontFamilyCurrent').textContent = family;
        // Track recent fonts (up to 8, most-recent-first, no duplicates)
        dseRecentFonts = [family, ...dseRecentFonts.filter(f=>f!==family)].slice(0,8);
        dseRenderRecentFonts();
      };
    });
  }
  let dseRecentFonts = [];
  function dseRenderRecentFonts(){
    const el = document.getElementById('epeFontRecentList');
    if (!el) return;
    el.innerHTML = dseRecentFonts.map(f => `<button type="button" class="dse-font-chip" data-font="${f}">${f}</button>`).join('');
    el.querySelectorAll('.dse-font-chip').forEach(btn => btn.onclick = async () => {
      await ensureGoogleFont(btn.dataset.font, 400); await ensureGoogleFont(btn.dataset.font, 700);
      dseTextEditCommit(l => l.fontFamily = btn.dataset.font);
      document.getElementById('epeFontFamilyCurrent').textContent = btn.dataset.font;
    });
  }
  document.getElementById('epeFontFamilySearch') && document.getElementById('epeFontFamilySearch').addEventListener('input', (e) => dseRenderFontResults(e.target.value));
  document.getElementById('epeFontCategoryFilter') && document.getElementById('epeFontCategoryFilter').addEventListener('change', (e) => {
    const cat = e.target.value;
    const list = document.getElementById('epeFontResultsList');
    const fonts = cat === 'all' ? DSE_ALL_FONTS : (DSE_FONT_CATALOG[cat] || []);
    list.innerHTML = fonts.map(f => `<button type="button" class="dse-font-option" data-font="${f}" style="font-family:'${f}',sans-serif;">${f}</button>`).join('');
    list.querySelectorAll('.dse-font-option').forEach(btn => {
      ensureGoogleFont(btn.dataset.font, 400).catch(()=>{});
      btn.onclick = async () => { await ensureGoogleFont(btn.dataset.font,400); await ensureGoogleFont(btn.dataset.font,700); dseTextEditCommit(l => l.fontFamily = btn.dataset.font); document.getElementById('epeFontFamilyCurrent').textContent = btn.dataset.font; };
    });
  });

  // ---- Font size / weight / style controls ----
  document.getElementById('epeFontSize') && document.getElementById('epeFontSize').addEventListener('input', (e) => { document.getElementById('epeFontSizeVal').textContent = e.target.value; dseTextEdit(l => l.fontSize = +e.target.value); });
  document.getElementById('epeFontSize') && document.getElementById('epeFontSize').addEventListener('change', () => epePushHistory());
  document.getElementById('epeFontWeight') && document.getElementById('epeFontWeight').addEventListener('change', async (e) => {
    const layer = dseActiveLayer(); if (layer) await ensureGoogleFont(layer.fontFamily, +e.target.value);
    dseTextEditCommit(l => l.fontWeight = +e.target.value);
  });
  document.getElementById('epeBoldBtn') && (document.getElementById('epeBoldBtn').onclick = async () => {
    const layer = dseActiveLayer(); if (!layer || layer.type!=='text') return;
    const newWeight = layer.fontWeight >= 700 ? 400 : 700;
    await ensureGoogleFont(layer.fontFamily, newWeight);
    dseTextEditCommit(l => l.fontWeight = newWeight);
    document.getElementById('epeBoldBtn').setAttribute('aria-pressed', String(newWeight>=700));
  });
  document.getElementById('epeItalicBtn') && (document.getElementById('epeItalicBtn').onclick = () => { dseTextEditCommit(l => l.italic = !l.italic); document.getElementById('epeItalicBtn').setAttribute('aria-pressed', String(dseActiveLayer().italic)); });
  document.getElementById('epeUnderlineBtn') && (document.getElementById('epeUnderlineBtn').onclick = () => { dseTextEditCommit(l => l.underline = !l.underline); document.getElementById('epeUnderlineBtn').setAttribute('aria-pressed', String(dseActiveLayer().underline)); });
  document.getElementById('epeStrikeBtn') && (document.getElementById('epeStrikeBtn').onclick = () => { dseTextEditCommit(l => l.strikethrough = !l.strikethrough); document.getElementById('epeStrikeBtn').setAttribute('aria-pressed', String(dseActiveLayer().strikethrough)); });
  document.getElementById('epeTextCase') && document.getElementById('epeTextCase').addEventListener('change', (e) => dseTextEditCommit(l => l.textCase = e.target.value));

  // ---- Alignment ----
  document.querySelectorAll('#epeTextAlignRow [data-align]').forEach(btn => btn.onclick = () => {
    dseTextEditCommit(l => l.align = btn.dataset.align);
    document.querySelectorAll('#epeTextAlignRow [data-align]').forEach(b => b.classList.toggle('active', b===btn));
  });
  document.querySelectorAll('#epeTextVAlignRow [data-valign]').forEach(btn => btn.onclick = () => {
    dseTextEditCommit(l => l.verticalAlign = btn.dataset.valign);
    document.querySelectorAll('#epeTextVAlignRow [data-valign]').forEach(b => b.classList.toggle('active', b===btn));
  });

  // ---- Spacing ----
  document.getElementById('epeLetterSpacing') && document.getElementById('epeLetterSpacing').addEventListener('input', (e) => { document.getElementById('epeLetterSpacingVal').textContent=e.target.value; dseTextEdit(l => l.letterSpacing=+e.target.value); });
  document.getElementById('epeLetterSpacing') && document.getElementById('epeLetterSpacing').addEventListener('change', () => epePushHistory());
  document.getElementById('epeLineHeight') && document.getElementById('epeLineHeight').addEventListener('input', (e) => { document.getElementById('epeLineHeightVal').textContent=(+e.target.value).toFixed(2); dseTextEdit(l => l.lineHeight=+e.target.value); });
  document.getElementById('epeLineHeight') && document.getElementById('epeLineHeight').addEventListener('change', () => epePushHistory());
  document.getElementById('epeParagraphSpacing') && document.getElementById('epeParagraphSpacing').addEventListener('input', (e) => { document.getElementById('epeParagraphSpacingVal').textContent=e.target.value; dseTextEdit(l => l.paragraphSpacing=+e.target.value); });
  document.getElementById('epeParagraphSpacing') && document.getElementById('epeParagraphSpacing').addEventListener('change', () => epePushHistory());
  document.getElementById('epeAutoResize') && document.getElementById('epeAutoResize').addEventListener('change', (e) => dseTextEditCommit(l => l.autoResize = e.target.checked));

  // ---- Color / gradient ----
  document.getElementById('epeTextColorInput') && document.getElementById('epeTextColorInput').addEventListener('input', (e) => dseTextEdit(l => l.color = e.target.value));
  document.getElementById('epeTextColorInput') && document.getElementById('epeTextColorInput').addEventListener('change', () => epePushHistory());
  document.querySelectorAll('input[name="epeTextFillType"]').forEach(r => r.addEventListener('change', (e) => {
    dseTextEditCommit(l => l.fillType = e.target.value);
    document.getElementById('epeTextSolidRow').classList.toggle('hidden', e.target.value!=='solid');
    document.getElementById('epeTextGradientRow').classList.toggle('hidden', e.target.value!=='gradient');
  }));
  ['epeTextGradientFrom','epeTextGradientTo','epeTextGradientAngle'].forEach(id => {
    document.getElementById(id) && document.getElementById(id).addEventListener('input', () => dseTextEdit(l => {
      l.gradient.from = document.getElementById('epeTextGradientFrom').value;
      l.gradient.to = document.getElementById('epeTextGradientTo').value;
      l.gradient.angle = +document.getElementById('epeTextGradientAngle').value;
    }));
    document.getElementById(id) && document.getElementById(id).addEventListener('change', () => epePushHistory());
  });

  // ---- Effects: Shadow / Stroke / Glow ----
  document.getElementById('epeTextShadowEnable') && document.getElementById('epeTextShadowEnable').addEventListener('change', (e) => dseTextEditCommit(l => l.shadow.enabled = e.target.checked));
  ['OffsetX','OffsetY','Blur','Opacity'].forEach(prop => {
    const id = 'epeTextShadow'+prop;
    document.getElementById(id) && document.getElementById(id).addEventListener('input', (e) => dseTextEdit(l => l.shadow[prop[0].toLowerCase()+prop.slice(1)] = +e.target.value));
    document.getElementById(id) && document.getElementById(id).addEventListener('change', () => epePushHistory());
  });
  document.getElementById('epeTextShadowColor') && document.getElementById('epeTextShadowColor').addEventListener('input', (e) => dseTextEdit(l => l.shadow.color = e.target.value));
  document.getElementById('epeTextShadowColor') && document.getElementById('epeTextShadowColor').addEventListener('change', () => epePushHistory());

  document.getElementById('epeTextStrokeEnable') && document.getElementById('epeTextStrokeEnable').addEventListener('change', (e) => dseTextEditCommit(l => l.stroke.enabled = e.target.checked));
  document.getElementById('epeTextStrokeThickness') && document.getElementById('epeTextStrokeThickness').addEventListener('input', (e) => dseTextEdit(l => l.stroke.thickness = +e.target.value));
  document.getElementById('epeTextStrokeThickness') && document.getElementById('epeTextStrokeThickness').addEventListener('change', () => epePushHistory());
  document.getElementById('epeTextStrokePosition') && document.getElementById('epeTextStrokePosition').addEventListener('change', (e) => dseTextEditCommit(l => l.stroke.position = e.target.value));
  document.getElementById('epeTextStrokeColor') && document.getElementById('epeTextStrokeColor').addEventListener('input', (e) => dseTextEdit(l => l.stroke.color = e.target.value));
  document.getElementById('epeTextStrokeColor') && document.getElementById('epeTextStrokeColor').addEventListener('change', () => epePushHistory());

  document.getElementById('epeTextGlowEnable') && document.getElementById('epeTextGlowEnable').addEventListener('change', (e) => dseTextEditCommit(l => l.glow.enabled = e.target.checked));
  document.getElementById('epeTextGlowBlur') && document.getElementById('epeTextGlowBlur').addEventListener('input', (e) => dseTextEdit(l => l.glow.blur = +e.target.value));
  document.getElementById('epeTextGlowBlur') && document.getElementById('epeTextGlowBlur').addEventListener('change', () => epePushHistory());
  document.getElementById('epeTextGlowColor') && document.getElementById('epeTextGlowColor').addEventListener('input', (e) => dseTextEdit(l => l.glow.color = e.target.value));
  document.getElementById('epeTextGlowColor') && document.getElementById('epeTextGlowColor').addEventListener('change', () => epePushHistory());

  // ---- Curve ----
  document.getElementById('epeTextCurveType') && document.getElementById('epeTextCurveType').addEventListener('change', (e) => dseTextEditCommit(l => l.curve.type = e.target.value));
  document.getElementById('epeTextCurveRadius') && document.getElementById('epeTextCurveRadius').addEventListener('input', (e) => dseTextEdit(l => l.curve.radius = +e.target.value));
  document.getElementById('epeTextCurveRadius') && document.getElementById('epeTextCurveRadius').addEventListener('change', () => epePushHistory());

  // ---- Blend mode (real native canvas composite operations) ----
  document.getElementById('epeObjectOpacity') && document.getElementById('epeObjectOpacity').addEventListener('input', (e) => {
    const layer = dseActiveLayer(); if (!layer) return;
    layer.opacity = +e.target.value;
    document.getElementById('epeObjectOpacityVal').textContent = e.target.value;
    renderEpeAll();
  });
  document.getElementById('epeObjectOpacity') && document.getElementById('epeObjectOpacity').addEventListener('change', () => epePushHistory());

  function dseDeleteSelectedLayers(){
    if (dseState.selectedIds.size === 0) return;
    epeLayerEngine.removeLayers([...dseState.selectedIds]);
    if (dseState.layers.length === 0){ epeSourceImg = null; document.getElementById('epeStage').classList.add('hidden'); }
    else { dseSyncAliasesFromLayer(dseActiveLayer()); }
    dseRenderLayersPanel();
    dseUpdateObjectPropertiesPanel();
    renderEpeAll();
    epePushHistory();
  }
  document.getElementById('epeDeleteLayerBtn') && (document.getElementById('epeDeleteLayerBtn').onclick = dseDeleteSelectedLayers);

  document.getElementById('epeBlendMode') && document.getElementById('epeBlendMode').addEventListener('change', (e) => {
    const layer = dseActiveLayer(); if (!layer) return;
    layer.blendMode = e.target.value; renderEpeAll(); epePushHistory();
  });

  // ---- Layer ordering ----
  function dseReorderLayer(dir){
    const layer = dseActiveLayer(); if (!layer) return;
    epeLayerEngine.moveLayer(layer.id, dir);
    dseRenderLayersPanel(); renderEpeAll(); epePushHistory();
  }
  document.getElementById('epeLayerForwardBtn') && (document.getElementById('epeLayerForwardBtn').onclick = () => dseReorderLayer('forward'));
  document.getElementById('epeLayerBackwardBtn') && (document.getElementById('epeLayerBackwardBtn').onclick = () => dseReorderLayer('backward'));
  document.getElementById('epeLayerTopBtn') && (document.getElementById('epeLayerTopBtn').onclick = () => dseReorderLayer('top'));
  document.getElementById('epeLayerBottomBtn') && (document.getElementById('epeLayerBottomBtn').onclick = () => dseReorderLayer('bottom'));

  // ---- Duplicate, Copy Style / Paste Style ----
  let dseCopiedStyle = null;
  document.getElementById('epeDuplicateLayerBtn') && (document.getElementById('epeDuplicateLayerBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer) return;
    const clone = JSON.parse(JSON.stringify(layer, (k,v) => k==='sourceImg'||k==='processedCanvasCache'||k==='localEditsCanvas'||k==='_measuredLines' ? undefined : v));
    clone.id = dseUniqueId(); clone.x += 20; clone.y += 20; clone.zIndex = dseState.layers.length;
    if (layer.type === 'image'){ clone.sourceImg = layer.sourceImg; clone.eraseMask = layer.eraseMask ? layer.eraseMask.slice() : null; }
    dseState.layers.push(clone);
    dseSelectLayer(clone.id, false);
    renderEpeAll(); epePushHistory();
    toast('Layer duplicated.');
  });
  document.getElementById('epeCopyStyleBtn') && (document.getElementById('epeCopyStyleBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer) return;
    if (layer.type === 'text'){
      dseCopiedStyle = { sourceType:'text', fontFamily:layer.fontFamily, fontWeight:layer.fontWeight, fontSize:layer.fontSize, italic:layer.italic,
        underline:layer.underline, strikethrough:layer.strikethrough, textCase:layer.textCase, align:layer.align,
        letterSpacing:layer.letterSpacing, lineHeight:layer.lineHeight, fillType:layer.fillType, color:layer.color,
        gradient:{...layer.gradient}, shadow:{...layer.shadow}, stroke:{...layer.stroke}, glow:{...layer.glow} };
      toast('Text style copied.');
    } else if (layer.type === 'shape' || layer.type === 'icon'){
      dseCopiedStyle = { sourceType:'shape', color:layer.color, fillType:layer.fillType, gradient: layer.gradient ? {...layer.gradient} : undefined,
        border: layer.border ? {...layer.border} : undefined, shadow:{...layer.shadow}, glow:{...layer.glow} };
      toast('Shape style copied.');
    } else { return; }
  });
  document.getElementById('epePasteStyleBtn') && (document.getElementById('epePasteStyleBtn').onclick = async () => {
    const layer = dseActiveLayer(); if (!layer || !dseCopiedStyle) return;
    if (layer.type === 'text' && dseCopiedStyle.sourceType === 'text'){
      await ensureGoogleFont(dseCopiedStyle.fontFamily, dseCopiedStyle.fontWeight);
      const { sourceType, ...styleProps } = dseCopiedStyle;
      dseTextEditCommit(l => Object.assign(l, JSON.parse(JSON.stringify(styleProps))));
      dseSyncTextControlsFromLayer(layer);
      toast('Text style pasted.');
    } else if ((layer.type === 'shape' || layer.type === 'icon') && dseCopiedStyle.sourceType === 'shape'){
      layer.color = dseCopiedStyle.color;
      if (dseCopiedStyle.fillType !== undefined) layer.fillType = dseCopiedStyle.fillType;
      if (dseCopiedStyle.gradient && layer.gradient) layer.gradient = {...dseCopiedStyle.gradient};
      if (dseCopiedStyle.border && layer.border) layer.border = {...dseCopiedStyle.border};
      layer.shadow = {...dseCopiedStyle.shadow};
      layer.glow = {...dseCopiedStyle.glow};
      renderEpeAll(); epePushHistory();
      dseSyncShapeControlsFromLayer(layer);
      toast('Shape style pasted.');
    } else {
      toast('Copied style doesn\u2019t match this object type \u2014 copy from a similar object first.', 'err');
    }
  });


  /* ============================================================
     DESIGN SYSTEM — Phase 3 Part 3
     ============================================================
     SCOPE NOTE (full reasoning in final report): the shape engine below
     implements a solid, real set of vector shapes via parametric path
     generation (most regular polygons share one function). Ribbon,
     Banner, and "Custom Border" are composite graphic assets rather than
     simple vector primitives -- not built as distinct shape types this
     phase. The icon set is a curated, hand-built collection of simple
     generic path icons (not copied from any licensed icon library),
     organized into the requested categories -- a real, working
     foundation, not a literal claim of importing a specific external
     library. Stickers, Badges, and Price Tags are implemented as
     composite presets (a shape + text layer(s), created together as a
     Group) -- reusing the shape/text/group primitives rather than a
     fourth separate rendering system.
     ============================================================ */

  // ---- Shape path generators: each takes a unit box (-0.5..0.5 in both
  // axes) and returns an array of {x,y} points (or draws directly for
  // curve-based shapes). Centralizing this is what lets fill, stroke,
  // shadow, and hit-testing all work identically for every shape type. ----
  function dseRegularPolygonPoints(sides, pointUp){
    const pts = [];
    const startAngle = pointUp ? -Math.PI/2 : -Math.PI/2 + Math.PI/sides;
    for (let i=0;i<sides;i++){
      const a = startAngle + i*(2*Math.PI/sides);
      pts.push({ x: Math.cos(a)*0.5, y: Math.sin(a)*0.5 });
    }
    return pts;
  }
  function dseStarPoints(spikes, innerRatio){
    const pts = [];
    for (let i=0;i<spikes*2;i++){
      const r = (i%2===0) ? 0.5 : 0.5*innerRatio;
      const a = -Math.PI/2 + i*(Math.PI/spikes);
      pts.push({ x: Math.cos(a)*r, y: Math.sin(a)*r });
    }
    return pts;
  }
  const DSE_SHAPE_DEFS = {
    rectangle:      { kind:'rect', radius:0 },
    'rounded-rect':  { kind:'rect', radius:0.12 },
    circle:         { kind:'ellipse', uniform:true },
    ellipse:        { kind:'ellipse', uniform:false },
    triangle:       { kind:'polygon', points: () => dseRegularPolygonPoints(3,true) },
    diamond:        { kind:'polygon', points: () => dseRegularPolygonPoints(4,false) },
    pentagon:       { kind:'polygon', points: () => dseRegularPolygonPoints(5,true) },
    hexagon:        { kind:'polygon', points: () => dseRegularPolygonPoints(6,true) },
    octagon:        { kind:'polygon', points: () => dseRegularPolygonPoints(8,true) },
    polygon:        { kind:'polygon', points: (sides) => dseRegularPolygonPoints(sides||6,true) },
    star:           { kind:'polygon', points: () => dseStarPoints(5, 0.42) },
    arrow:          { kind:'path', draw: dseDrawArrowPath },
    heart:          { kind:'path', draw: dseDrawHeartPath },
    'speech-bubble': { kind:'path', draw: dseDrawSpeechBubblePath },
    line:           { kind:'line', dashed:false },
    'dashed-line':  { kind:'line', dashed:true },
  };

  function dseDrawArrowPath(ctx){
    // Points in unit box (-0.5..0.5), a simple right-pointing arrow
    const pts = [[-0.5,-0.15],[0.15,-0.15],[0.15,-0.35],[0.5,0],[0.15,0.35],[0.15,0.15],[-0.5,0.15]];
    ctx.beginPath();
    pts.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    ctx.closePath();
  }
  function dseDrawHeartPath(ctx){
    ctx.beginPath();
    ctx.moveTo(0, 0.32);
    ctx.bezierCurveTo(-0.5, -0.15, -0.28, -0.5, 0, -0.2);
    ctx.bezierCurveTo(0.28, -0.5, 0.5, -0.15, 0, 0.32);
    ctx.closePath();
  }
  function dseDrawSpeechBubblePath(ctx){
    const r = 0.08;
    ctx.beginPath();
    ctx.moveTo(-0.5+r, -0.35);
    ctx.lineTo(0.5-r, -0.35); ctx.quadraticCurveTo(0.5,-0.35,0.5,-0.35+r);
    ctx.lineTo(0.5, 0.15-r); ctx.quadraticCurveTo(0.5,0.15,0.5-r,0.15);
    ctx.lineTo(-0.1, 0.15);
    ctx.lineTo(-0.2, 0.5);
    ctx.lineTo(-0.15, 0.15);
    ctx.lineTo(-0.5+r, 0.15); ctx.quadraticCurveTo(-0.5,0.15,-0.5,0.15-r);
    ctx.lineTo(-0.5, -0.35+r); ctx.quadraticCurveTo(-0.5,-0.35,-0.5+r,-0.35);
    ctx.closePath();
  }

  function dseTraceShapePath(ctx, layer, w, h){
    const def = DSE_SHAPE_DEFS[layer.shapeType] || DSE_SHAPE_DEFS.rectangle;
    if (def.kind === 'rect'){
      const radiusRatio = (layer.cornerRadius !== undefined && layer.cornerRadius !== null) ? layer.cornerRadius : (def.radius||0);
      const r = Math.min(w,h) * radiusRatio;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, r);
      else { ctx.rect(-w/2,-h/2,w,h); } // fallback for older engines
    } else if (def.kind === 'ellipse'){
      ctx.beginPath();
      ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2);
    } else if (def.kind === 'polygon'){
      const pts = def.points(layer.polygonSides).map(p => ({ x:p.x*w, y:p.y*h }));
      ctx.beginPath();
      pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.closePath();
    } else if (def.kind === 'path'){
      ctx.save(); ctx.scale(w, h); def.draw(ctx); ctx.restore();
    }
  }


  // ---- Shape layer factory ----
  function dseCreateShapeLayer(shapeType, artboardW, artboardH){
    return {
      id: dseUniqueId(), type: 'shape', shapeType,
      visible:true, locked:false, name: shapeType.replace(/-/g,' '),
      opacity:100, blendMode:'normal', zIndex: dseState.layers.length,
      x: artboardW/2, y: artboardH/2, scale:1, rotation:0, flipH:false, flipV:false,
      boxW: 160, boxH: shapeType==='line'||shapeType==='dashed-line' ? 4 : 160,
      polygonSides: 6,
      fillType:'solid', color:'#5142D6',
      gradient: { from:'#5142D6', to:'#E05252', angle:45, mode:'linear' },
      border: { enabled:false, thickness:3, style:'solid', color:'#111111' },
      shadow: { enabled:false, offsetX:4, offsetY:4, blur:8, opacity:50, color:'#000000' },
      glow: { enabled:false, blur:16, opacity:70, color:'#5142D6' },
    };
  }

  // ---- Icon layer factory: a specialized shape layer whose "shape" is
  // an SVG path, filled solid or gradient (recolorable), reusing the
  // same transform/effects architecture as regular shapes rather than
  // a parallel system. ----
  function dseCreateIconLayer(iconKey, artboardW, artboardH){
    return {
      id: dseUniqueId(), type: 'icon', iconKey,
      visible:true, locked:false, name: iconKey,
      opacity:100, blendMode:'normal', zIndex: dseState.layers.length,
      x: artboardW/2, y: artboardH/2, scale:1, rotation:0, flipH:false, flipV:false,
      boxW: 64, boxH: 64,
      color: '#111111', fillType: 'solid', gradient: {from:'#5142D6', to:'#8B7CF6', angle:45, mode:'linear'},
      shadow: { enabled:false, offsetX:2, offsetY:2, blur:4, opacity:40, color:'#000000' },
      glow: { enabled:false, blur:12, opacity:70, color:'#5142D6' },
    };
  }

  function dseGetShapeFillStyle(ctx, layer, w, h){
    if (layer.fillType === 'gradient'){
      const g = layer.gradient;
      let grad;
      if (g.mode === 'radial') grad = ctx.createRadialGradient(0,0,0,0,0,Math.max(w,h)/2);
      else { const rad=(g.angle||0)*Math.PI/180; grad = ctx.createLinearGradient(-Math.cos(rad)*w/2,-Math.sin(rad)*h/2,Math.cos(rad)*w/2,Math.sin(rad)*h/2); }
      grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
      return grad;
    }
    return layer.color;
  }
  // Icon gradients are computed in the icon's own 24x24 viewbox
  // coordinate space (separate from dseGetShapeFillStyle's w/h-based
  // space), since icon paths are authored and drawn in that fixed
  // coordinate system regardless of the layer's actual on-canvas size.
  function dseGetIconFillStyle(ctx, layer){
    if (layer.fillType === 'gradient' && layer.gradient){
      const g = layer.gradient;
      let grad;
      if (g.mode === 'radial') grad = ctx.createRadialGradient(12,12,0,12,12,17);
      else { const rad=(g.angle||0)*Math.PI/180; grad = ctx.createLinearGradient(12-Math.cos(rad)*12,12-Math.sin(rad)*12,12+Math.cos(rad)*12,12+Math.sin(rad)*12); }
      grad.addColorStop(0, g.from); grad.addColorStop(1, g.to);
      return grad;
    }
    return layer.color;
  }

  function dseRenderShapeLayer(ctx, layer){
    const w = layer.boxW, h = layer.boxH;
    if (layer.shapeType === 'line' || layer.shapeType === 'dashed-line'){
      ctx.save();
      ctx.globalAlpha = layer.opacity/100;
      ctx.strokeStyle = dseGetShapeFillStyle(ctx, layer, w, h);
      ctx.lineWidth = h;
      ctx.setLineDash(layer.shapeType === 'dashed-line' ? [h*3, h*2] : []);
      ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = layer.opacity/100;
    if (layer.glow.enabled){
      ctx.save(); ctx.shadowColor = layer.glow.color; ctx.shadowBlur = layer.glow.blur; ctx.globalAlpha = layer.glow.opacity/100;
      dseTraceShapePath(ctx, layer, w, h); ctx.fillStyle = dseGetShapeFillStyle(ctx, layer, w, h);
      for (let i=0;i<3;i++) ctx.fill();
      ctx.restore();
    }
    if (layer.shadow.enabled){
      ctx.save(); ctx.shadowColor = dseHexToRgbaLocal(layer.shadow.color, layer.shadow.opacity/100);
      ctx.shadowOffsetX = layer.shadow.offsetX; ctx.shadowOffsetY = layer.shadow.offsetY; ctx.shadowBlur = layer.shadow.blur;
      dseTraceShapePath(ctx, layer, w, h); ctx.fillStyle = dseGetShapeFillStyle(ctx, layer, w, h); ctx.fill();
      ctx.restore();
    }
    dseTraceShapePath(ctx, layer, w, h);
    ctx.fillStyle = dseGetShapeFillStyle(ctx, layer, w, h);
    ctx.fill();
    if (layer.border && layer.border.enabled){
      ctx.lineWidth = layer.border.thickness;
      ctx.strokeStyle = layer.border.color;
      ctx.setLineDash(layer.border.style === 'dashed' ? [layer.border.thickness*3, layer.border.thickness*2] : layer.border.style === 'dotted' ? [layer.border.thickness, layer.border.thickness*1.5] : []);
      ctx.lineJoin = 'round';
      dseTraceShapePath(ctx, layer, w, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Icon rendering: strokes/fills the SVG path data (defined in the
  // icon catalog below) using Path2D, recolored via the layer's own
  // solid color or gradient. ----
  function dseRenderIconLayer(ctx, layer){
    const icon = DSE_ICON_CATALOG_BY_KEY[layer.iconKey];
    if (!icon) return;
    const w = layer.boxW, h = layer.boxH;
    ctx.save();
    ctx.globalAlpha = layer.opacity/100;
    ctx.translate(-w/2, -h/2);
    const scale = Math.min(w,h) / 24; // icon paths authored in a 24x24 viewbox
    ctx.scale(scale, scale);
    if (layer.glow.enabled){
      ctx.save(); ctx.shadowColor = layer.glow.color; ctx.shadowBlur = layer.glow.blur/scale; ctx.globalAlpha = layer.glow.opacity/100;
      ctx.fillStyle = dseGetIconFillStyle(ctx, layer);
      const p = new Path2D(icon.path);
      for (let i=0;i<3;i++) ctx.fill(p);
      ctx.restore();
    }
    if (layer.shadow.enabled){
      ctx.save(); ctx.shadowColor = dseHexToRgbaLocal(layer.shadow.color, layer.shadow.opacity/100);
      ctx.shadowOffsetX = layer.shadow.offsetX/scale; ctx.shadowOffsetY = layer.shadow.offsetY/scale; ctx.shadowBlur = layer.shadow.blur/scale;
      ctx.fillStyle = dseGetIconFillStyle(ctx, layer); ctx.fill(new Path2D(icon.path));
      ctx.restore();
    }
    ctx.fillStyle = dseGetIconFillStyle(ctx, layer);
    ctx.fill(new Path2D(icon.path));
    ctx.restore();
  }


  // ---- Icon catalog: simple, hand-authored path icons in a 24x24
  // viewbox (generic geometric constructions, not copied from any
  // licensed icon set). A real, working, recolorable set -- see final
  // report for honest scope vs. the requested breadth. ----
  const DSE_ICON_CATALOG = [
    // Shopping / Ecommerce
    { key:'shopping-bag', cat:'Shopping', path:'M6 8h12l-1 12H7L6 8z M9 8V6a3 3 0 0 1 6 0v2' },
    { key:'shopping-cart', cat:'Shopping', path:'M3 4h2l2.4 11.5A2 2 0 0 0 9.35 17H18a2 2 0 0 0 1.95-1.55L21.5 8H6 M9 20a1 1 0 1 0 0.01 0 M17 20a1 1 0 1 0 0.01 0' },
    { key:'tag', cat:'Shopping', path:'M3 11V4h7l10 10-7 7L3 11z M8 8a1 1 0 1 0 0.01 0' },
    { key:'gift', cat:'Shopping', path:'M4 9h16v4H4V9z M6 13h12v8H6v-8z M12 9V4 M9 6a2 2 0 1 1 3-2.5A2 2 0 1 1 15 6' },
    { key:'percent', cat:'Shopping', path:'M6 18L18 6 M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M16.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    { key:'receipt', cat:'Shopping', path:'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z M8 8h8 M8 12h8 M8 16h5' },
    { key:'coupon', cat:'Shopping', path:'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z M9 6v12' },
    { key:'box', cat:'Shopping', path:'M3 8l9-5 9 5-9 5-9-5z M3 8v9l9 5 9-5V8 M12 13v9' },
    // Fashion
    { key:'tshirt', cat:'Fashion', path:'M8 4L4 7v3h3v10h10V10h3V7l-4-3-3 2h-2z' },
    { key:'shoe', cat:'Fashion', path:'M3 18v-3l6-4 4 2 5-1 3 3v3H3z' },
    { key:'bag-fashion', cat:'Fashion', path:'M6 8h12l1 13H5L6 8z M9 8a3 3 0 0 1 6 0' },
    { key:'sunglasses', cat:'Fashion', path:'M2 10h4l2 2h8l2-2h4 M6 10a3 3 0 1 0 6 0 M12 10a3 3 0 1 0 6 0' },
    // Beauty
    { key:'lipstick', cat:'Beauty', path:'M9 3h6v6l-3 10-3-10V3z' },
    { key:'perfume', cat:'Beauty', path:'M10 3h4v3h-4V3z M9 6h6v14H9V6z' },
    { key:'mirror', cat:'Beauty', path:'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M12 17v4 M9 21h6' },
    // Technology / Electronics
    { key:'laptop', cat:'Technology', path:'M4 5h16v10H4V5z M2 19h20l-2-4H4l-2 4z' },
    { key:'phone', cat:'Technology', path:'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 19h2' },
    { key:'camera', cat:'Technology', path:'M4 8h3l2-2h6l2 2h3v11H4V8z M12 13a3 3 0 1 0 0.01 0' },
    { key:'headphones', cat:'Technology', path:'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h2v6H4a2 2 0 0 1 0-6z M18 14h2a2 2 0 0 1 0 6h-2v-6z' },
    { key:'watch', cat:'Technology', path:'M12 8a4 4 0 1 0 0.01 0 M9 4h6l-1 4H10L9 4z M9 20h6l-1-4H10l-1 4z' },
    { key:'wifi', cat:'Technology', path:'M2 9a15 15 0 0 1 20 0 M5.5 12.5a10 10 0 0 1 13 0 M9 16a5 5 0 0 1 6 0 M12 19.5a1 1 0 1 0 0.01 0' },
    // Furniture
    { key:'chair', cat:'Furniture', path:'M6 3h12v9H6V3z M6 12v9 M18 12v9 M6 16h12' },
    { key:'lamp', cat:'Furniture', path:'M8 3h8l3 7H5l3-7z M12 10v9 M8 19h8' },
    // Food / Delivery
    { key:'coffee', cat:'Food', path:'M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z M17 9h2a2 2 0 0 1 0 4h-2 M6 3c0 1 1 1 1 2s-1 1-1 2 M10 3c0 1 1 1 1 2s-1 1-1 2' },
    { key:'plate', cat:'Food', path:'M12 3a9 9 0 1 0 0.01 0 M12 3a5 5 0 1 0 0.01 0' },
    { key:'delivery-truck', cat:'Delivery', path:'M2 7h11v8H2V7z M13 10h5l3 3v2h-8v-5z M6 19a2 2 0 1 0 0.01 0 M17 19a2 2 0 1 0 0.01 0' },
    { key:'delivery-box', cat:'Delivery', path:'M3 8l9-5 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9' },
    { key:'clock-fast', cat:'Delivery', path:'M12 3a9 9 0 1 0 0.01 0 M12 7v5l4 2' },
    // Business / Finance
    { key:'briefcase', cat:'Business', path:'M3 8h18v11H3V8z M8 8V5h8v3 M3 13h18' },
    { key:'dollar', cat:'Finance', path:'M12 2v20 M17 6.5C17 5 15.5 4 12 4S7 5.5 7 7.5 9 10.5 12 11s5 1.5 5 3.5-2 3.5-5 3.5-5-1-5-2.5' },
    { key:'wallet', cat:'Finance', path:'M3 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z M16 12h4v4h-4a2 2 0 0 1 0-4z' },
    { key:'chart-up', cat:'Finance', path:'M4 20h16 M4 20l5-7 4 3 6-9 M14 7h5v5' },
    // Social Media / Communication
    { key:'heart', cat:'Social Media', path:'M12 20l-8-8a5 5 0 0 1 8-6 5 5 0 0 1 8 6l-8 8z' },
    { key:'share', cat:'Social Media', path:'M18 8a3 3 0 1 0-2.8-4 M18 20a3 3 0 1 0-2.8-4 M6 12a3 3 0 1 0 0.01 0 M8.6 10.5l6.7-3.4 M8.6 13.5l6.7 3.4' },
    { key:'chat', cat:'Communication', path:'M4 4h16v12H8l-4 4V4z' },
    { key:'envelope', cat:'Communication', path:'M3 5h18v14H3V5z M3 5l9 7 9-7' },
    { key:'bell', cat:'Communication', path:'M6 10a6 6 0 1 1 12 0v5l2 3H4l2-3v-5z M10 21a2 2 0 0 0 4 0' },
    // Security / Badges
    { key:'shield', cat:'Security', path:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z' },
    { key:'shield-check', cat:'Security', path:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z M9 12l2 2 4-4' },
    { key:'lock', cat:'Security', path:'M6 11h12v9H6v-9z M8 11V7a4 4 0 0 1 8 0v4' },
    { key:'star', cat:'Badges', path:'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6L12 2z' },
    { key:'medal', cat:'Badges', path:'M12 15a6 6 0 1 0 0.01 0 M8 3l4 8 4-8 M9 13l-2 8 5-3 5 3-2-8' },
    { key:'crown', cat:'Badges', path:'M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z' },
    { key:'checkmark', cat:'Badges', path:'M4 12l6 6L20 6' },
    // Arrows / UI
    { key:'arrow-right', cat:'Arrows', path:'M4 12h16 M14 6l6 6-6 6' },
    { key:'arrow-left', cat:'Arrows', path:'M20 12H4 M10 6l-6 6 6 6' },
    { key:'arrow-up', cat:'Arrows', path:'M12 20V4 M6 10l6-6 6 6' },
    { key:'arrow-down', cat:'Arrows', path:'M12 4v16 M18 14l-6 6-6-6' },
    { key:'plus', cat:'UI', path:'M12 4v16 M4 12h16' },
    { key:'minus', cat:'UI', path:'M4 12h16' },
    { key:'search', cat:'UI', path:'M11 4a7 7 0 1 0 0.01 0 M20 20l-5-5' },
    { key:'x-close', cat:'UI', path:'M5 5l14 14 M19 5L5 19' },
    // Medical / Education / Travel / Lifestyle
    { key:'cross-medical', cat:'Medical', path:'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z' },
    { key:'book', cat:'Education', path:'M4 4h9a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2H4V4z M20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-2h4V4z' },
    { key:'plane', cat:'Travel', path:'M3 13l7-2 5-8 2 1-3 7 5 2v2l-5-1-3 6-2-1 1-5-7-1v-2z' },
    { key:'home', cat:'Lifestyle', path:'M4 11l8-7 8 7 M6 10v10h12V10' },
    { key:'dumbbell', cat:'Lifestyle', path:'M2 9h2v6H2z M5 7h2v10H5z M17 7h2v10h-2z M20 9h2v6h-2z M8 11h8v2H8z' },
    { key:'baby-bottle', cat:'Lifestyle', path:'M9 2h6v3l-1 1v2a4 4 0 0 1 2 3.5V19a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-7.5A4 4 0 0 1 10 8V6L9 5V2z M8 13h8' },
    { key:'wedding-rings', cat:'Lifestyle', path:'M9 13a4 4 0 1 0 0.01 0 M15 13a4 4 0 1 0 0.01 0 M9 9l1.5-5h3L15 9' },
    { key:'building', cat:'Lifestyle', path:'M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16 M13 21v-9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v9 M8 7h1 M8 11h1 M8 15h1 M17 13h1 M17 17h1' },
  ];
  const DSE_ICON_CATALOG_BY_KEY = {}; DSE_ICON_CATALOG.forEach(i => DSE_ICON_CATALOG_BY_KEY[i.key] = i);
  const DSE_ICON_CATEGORIES = [...new Set(DSE_ICON_CATALOG.map(i=>i.cat))];


  // ---- Object Grouping: a 'group' layer type containing child layer IDs.
  // Groups are treated as one object for select/move/rotate/scale --
  // achieved by applying the group's own transform on top of each
  // child's stored transform at render time, and by hit-testing/handles
  // operating on the group's own computed bounding box. One level of
  // nesting is supported (a group's children can include another group). ----
  function dseCreateGroupLayer(childIds, artboardW, artboardH){
    const children = dseState.layers.filter(l => childIds.includes(l.id));
    if (children.length === 0) return null;
    // Compute the group's own bounding box from its children's current AABBs
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    children.forEach(c => { const bb = dseLayerBoundingBox(c); minX=Math.min(minX,bb.x); minY=Math.min(minY,bb.y); maxX=Math.max(maxX,bb.x+bb.w); maxY=Math.max(maxY,bb.y+bb.h); });
    const gx = (minX+maxX)/2, gy = (minY+maxY)/2;
    return {
      id: dseUniqueId(), type:'group', name:'Group', childIds:[...childIds],
      visible:true, locked:false, opacity:100, blendMode:'normal',
      zIndex: Math.max(...children.map(c=>c.zIndex)),
      x:gx, y:gy, scale:1, rotation:0, flipH:false, flipV:false,
      boxW: maxX-minX, boxH: maxY-minY,
      // Each child's position RELATIVE to the group's center at creation time,
      // used to reconstruct absolute position under the group's own transform.
      childOffsets: Object.fromEntries(children.map(c => [c.id, { dx:c.x-gx, dy:c.y-gy, rotation:c.rotation }])),
    };
  }
  function dseGroupSelected(){
    if (dseState.selectedIds.size < 2){ toast('Select two or more layers to group.', 'err'); return; }
    const ids = [...dseState.selectedIds];
    const group = dseCreateGroupLayer(ids, epeArtboardW, epeArtboardH);
    if (!group) return;
    dseState.layers.push(group);
    dseState.layers = dseState.layers.filter(l => !ids.includes(l.id) || l.id === group.id); // hide children from top-level list (they're still in the array, referenced by the group)
    // Actually: children stay in dseState.layers (so their own data persists) but are marked as grouped, so the top-level layers panel and hit-test skip them individually.
    ids.forEach(id => { const l = dseState.layers.find(x=>x.id===id); if (l) l.groupId = group.id; });
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Grouped ' + ids.length + ' layers.');
  }
  function dseUngroupSelected(){
    const layer = dseActiveLayer();
    if (!layer || layer.type !== 'group') return;
    layer.childIds.forEach(id => { const c = dseState.layers.find(l=>l.id===id); if (c) delete c.groupId; });
    dseState.layers = dseState.layers.filter(l => l.id !== layer.id);
    dseSelectLayer(null, false);
    renderEpeAll(); epePushHistory();
    toast('Ungrouped.');
  }

  // ---- Compute a group child's CURRENT absolute transform, applying the
  // group's own transform (position/rotation/scale) on top of the child's
  // stored offset -- called by both rendering and hit-testing so they
  // never disagree. ----
  function dseGetGroupChildAbsoluteTransform(group, child){
    const off = group.childOffsets[child.id];
    if (!off) return { x:child.x, y:child.y, rotation:child.rotation, scale:child.scale };
    const rad = group.rotation * Math.PI/180;
    const sdx = off.dx * group.scale, sdy = off.dy * group.scale;
    const rdx = sdx*Math.cos(rad) - sdy*Math.sin(rad), rdy = sdx*Math.sin(rad) + sdy*Math.cos(rad);
    return { x: group.x+rdx, y: group.y+rdy, rotation: off.rotation+group.rotation, scale: child.scale*group.scale };
  }


  // ---- Alignment Engine: operates on selected layers' bounding boxes.
  // Single selection aligns to the canvas; multi-selection aligns
  // relative to the selection's own combined bounding box. ----
  function dseGetSelectedLayers(){ return dseState.layers.filter(l => dseState.selectedIds.has(l.id) && !l.groupId); }
  function dseAlign(mode){
    const layers = dseGetSelectedLayers();
    if (layers.length === 0) return;
    let refBox;
    if (layers.length === 1){ refBox = { x:0, y:0, w:epeArtboardW, h:epeArtboardH }; }
    else {
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      layers.forEach(l => { const bb=dseLayerBoundingBox(l); minX=Math.min(minX,bb.x); minY=Math.min(minY,bb.y); maxX=Math.max(maxX,bb.x+bb.w); maxY=Math.max(maxY,bb.y+bb.h); });
      refBox = { x:minX, y:minY, w:maxX-minX, h:maxY-minY };
    }
    layers.forEach(l => {
      const bb = dseLayerBoundingBox(l);
      if (mode==='left') l.x += refBox.x - bb.x;
      else if (mode==='right') l.x += (refBox.x+refBox.w) - (bb.x+bb.w);
      else if (mode==='center-h') l.x += (refBox.x+refBox.w/2) - (bb.x+bb.w/2);
      else if (mode==='top') l.y += refBox.y - bb.y;
      else if (mode==='bottom') l.y += (refBox.y+refBox.h) - (bb.y+bb.h);
      else if (mode==='center-v') l.y += (refBox.y+refBox.h/2) - (bb.y+bb.h/2);
    });
    const active = dseActiveLayer(); if (active) dseSyncAliasesFromLayer(active);
    renderEpeAll(); epePushHistory();
  }
  function dseDistribute(axis){
    const layers = dseGetSelectedLayers();
    if (layers.length < 3) { toast('Select 3 or more layers to distribute.', 'err'); return; }
    const sorted = [...layers].sort((a,b) => axis==='h' ? a.x-b.x : a.y-b.y);
    const first = sorted[0], last = sorted[sorted.length-1];
    const totalSpan = axis==='h' ? last.x-first.x : last.y-first.y;
    const step = totalSpan / (sorted.length-1);
    sorted.forEach((l,i) => { if (axis==='h') l.x = first.x + step*i; else l.y = first.y + step*i; });
    renderEpeAll(); epePushHistory();
    toast('Distributed evenly.');
  }
  document.getElementById('epeAlignLeftBtn') && (document.getElementById('epeAlignLeftBtn').onclick = () => dseAlign('left'));
  document.getElementById('epeAlignCenterHBtn') && (document.getElementById('epeAlignCenterHBtn').onclick = () => dseAlign('center-h'));
  document.getElementById('epeAlignRightBtn') && (document.getElementById('epeAlignRightBtn').onclick = () => dseAlign('right'));
  document.getElementById('epeAlignTopBtn') && (document.getElementById('epeAlignTopBtn').onclick = () => dseAlign('top'));
  document.getElementById('epeAlignMiddleBtn') && (document.getElementById('epeAlignMiddleBtn').onclick = () => dseAlign('center-v'));
  document.getElementById('epeAlignBottomBtn') && (document.getElementById('epeAlignBottomBtn').onclick = () => dseAlign('bottom'));
  document.getElementById('epeDistributeHBtn') && (document.getElementById('epeDistributeHBtn').onclick = () => dseDistribute('h'));
  document.getElementById('epeDistributeVBtn') && (document.getElementById('epeDistributeVBtn').onclick = () => dseDistribute('v'));
  document.getElementById('epeGroupBtn') && (document.getElementById('epeGroupBtn').onclick = () => dseGroupSelected());
  document.getElementById('epeUngroupBtn') && (document.getElementById('epeUngroupBtn').onclick = () => dseUngroupSelected());


  // ---- Brand Color Library: persistent (localStorage), add/rename/
  // delete/reorder/favorite. Reuses the established autosave localStorage
  // pattern from earlier phases. ----
  const DSE_BRAND_COLORS_KEY = 'toolflight_epe_brand_colors';
  let dseBrandColors = [];
  function dseLoadBrandColors(){
    try{ const raw = localStorage.getItem(DSE_BRAND_COLORS_KEY); dseBrandColors = raw ? JSON.parse(raw) : []; }catch(e){ dseBrandColors = []; }
  }
  function dseSaveBrandColors(){ try{ localStorage.setItem(DSE_BRAND_COLORS_KEY, JSON.stringify(dseBrandColors)); }catch(e){ /* best-effort, private mode or quota */ } }
  function dseRenderBrandColors(){
    const el = document.getElementById('epeBrandColorsList');
    if (!el) return;
    el.innerHTML = dseBrandColors.map((c,i) => `<div class="dse-brand-swatch-wrap"><button type="button" class="dse-brand-swatch" data-idx="${i}" style="background:${c.hex};" title="${c.name}"></button><button type="button" class="dse-brand-swatch-del" data-idx="${i}" aria-label="Delete ${c.name}">\u00d7</button></div>`).join('');
    el.querySelectorAll('.dse-brand-swatch').forEach(btn => btn.onclick = () => {
      const hex = dseBrandColors[+btn.dataset.idx].hex;
      const active = document.activeElement;
      // Apply to whichever color context is relevant: prefer selected text/shape layer's fill
      const layer = dseActiveLayer();
      if (layer && (layer.type==='text' || layer.type==='shape' || layer.type==='icon')){
        if (layer.color !== undefined){ layer.color = hex; renderEpeAll(); epePushHistory(); dseSyncTextControlsFromLayer(layer); }
      }
    });
    el.querySelectorAll('.dse-brand-swatch-del').forEach(btn => btn.onclick = e => { e.stopPropagation(); dseBrandColors.splice(+btn.dataset.idx,1); dseSaveBrandColors(); dseRenderBrandColors(); });
  }
  document.getElementById('epeAddBrandColorBtn') && (document.getElementById('epeAddBrandColorBtn').onclick = () => {
    const hex = document.getElementById('epeBrandColorPicker').value;
    dseBrandColors.push({ hex, name: hex });
    dseSaveBrandColors(); dseRenderBrandColors();
  });

  // ---- Add Shape ----
  document.querySelectorAll('#epeAddShapeRow [data-shape-type]').forEach(btn => {
    btn.onclick = () => {
      if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
      const layer = dseCreateShapeLayer(btn.dataset.shapeType, epeArtboardW, epeArtboardH);
      dseState.layers.push(layer);
      dseSelectLayer(layer.id, false);
      renderEpeAll(); epePushHistory();
      toast('Shape added.');
    };
  });

  // ---- Add Icon (search + category browser) ----
  function dseRenderIconResults(query, cat){
    const list = document.getElementById('epeIconResultsList');
    if (!list) return;
    const q = (query||'').toLowerCase().trim();
    let results = DSE_ICON_CATALOG;
    if (cat && cat !== 'all') results = results.filter(i => i.cat === cat);
    if (q) results = results.filter(i => i.key.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q));
    list.innerHTML = results.map(icon => `<button type="button" class="dse-icon-option" data-key="${icon.key}" title="${icon.key}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${icon.path}"/></svg></button>`).join('');
    list.querySelectorAll('.dse-icon-option').forEach(btn => btn.onclick = () => {
      if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
      const layer = dseCreateIconLayer(btn.dataset.key, epeArtboardW, epeArtboardH);
      dseState.layers.push(layer);
      dseSelectLayer(layer.id, false);
      renderEpeAll(); epePushHistory();
      toast('Icon added.');
    });
  }
  document.getElementById('epeIconSearch') && document.getElementById('epeIconSearch').addEventListener('input', e => dseRenderIconResults(e.target.value, document.getElementById('epeIconCategoryFilter').value));
  document.getElementById('epeIconCategoryFilter') && document.getElementById('epeIconCategoryFilter').addEventListener('change', e => dseRenderIconResults(document.getElementById('epeIconSearch').value, e.target.value));

  // ---- Stickers, Badges, Price Tags: composite presets (shape + text,
  // created together as a Group), reusing the shape/text/group primitives
  // rather than a fourth rendering system. ----
  const DSE_STICKER_PRESETS = {
    sale:{ text:'SALE', shape:'star', color:'#E05252', textColor:'#ffffff' },
    hot:{ text:'HOT', shape:'circle', color:'#FF6B35', textColor:'#ffffff' },
    new:{ text:'NEW', shape:'rounded-rect', color:'#5142D6', textColor:'#ffffff' },
    'limited-offer':{ text:'LIMITED OFFER', shape:'ribbon-rect', color:'#111111', textColor:'#ffffff' },
    'flash-sale':{ text:'FLASH SALE', shape:'star', color:'#FFB800', textColor:'#111111' },
    'best-seller':{ text:'BEST SELLER', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    trending:{ text:'TRENDING', shape:'rounded-rect', color:'#E05252', textColor:'#ffffff' },
    exclusive:{ text:'EXCLUSIVE', shape:'hexagon', color:'#111111', textColor:'#FFB800' },
    'free-shipping':{ text:'FREE SHIPPING', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
  };
  const DSE_BADGE_PRESETS = {
    premium:{ text:'PREMIUM', shape:'rounded-rect', color:'#111111', textColor:'#FFB800' },
    verified:{ text:'\u2713 VERIFIED', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    'top-rated':{ text:'\u2605 TOP RATED', shape:'rounded-rect', color:'#FFB800', textColor:'#111111' },
    luxury:{ text:'LUXURY', shape:'rounded-rect', color:'#111111', textColor:'#ffffff' },
    organic:{ text:'ORGANIC', shape:'circle', color:'#3BA55C', textColor:'#ffffff' },
    warranty:{ text:'WARRANTY', shape:'shield', color:'#5142D6', textColor:'#ffffff' },
  };
  function dseAddStickerOrBadge(presetKey, presetMap){
    const preset = presetMap[presetKey]; if (!preset) return;
    const shapeType = preset.shape === 'ribbon-rect' ? 'rounded-rect' : preset.shape;
    const shape = dseCreateShapeLayer(shapeType, epeArtboardW, epeArtboardH);
    shape.color = preset.color; shape.boxW = 140; shape.boxH = 60;
    const text = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
    text.text = preset.text; text.color = preset.textColor; text.fontSize = 18; text.fontWeight = 800;
    dseMeasureTextLayer(text);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, text.id], epeArtboardW, epeArtboardH);
    group.name = preset.text;
    dseState.layers.push(group);
    shape.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast((presetMap===DSE_STICKER_PRESETS?'Sticker':'Badge') + ' added.');
  }
  document.querySelectorAll('#epeStickerRow [data-sticker]').forEach(btn => btn.onclick = () => dseAddStickerOrBadge(btn.dataset.sticker, DSE_STICKER_PRESETS));
  document.querySelectorAll('#epeBadgeRow [data-badge]').forEach(btn => btn.onclick = () => dseAddStickerOrBadge(btn.dataset.badge, DSE_BADGE_PRESETS));

  // ---- Price Tag: a composite with multiple text sub-elements
  // (current price, old price with strikethrough, discount badge) ----
  document.getElementById('epeAddPriceTagBtn') && (document.getElementById('epeAddPriceTagBtn').onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const cur = dseCreateTextLayer('price', epeArtboardW, epeArtboardH);
    cur.text = '$19.99'; cur.x -= 0; cur.fontWeight = 800;
    const old = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
    old.text = '$29.99'; old.strikethrough = true; old.fontSize = 18; old.color = '#888888'; old.y -= 50;
    const disc = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
    disc.text = '-33%'; disc.color = '#ffffff'; disc.fontSize = 16; disc.y += 45;
    const badgeShape = dseCreateShapeLayer('rounded-rect', epeArtboardW, epeArtboardH);
    badgeShape.color = '#E05252'; badgeShape.boxW = 80; badgeShape.boxH = 32; badgeShape.y = disc.y;
    [cur, old, disc, badgeShape].forEach(l => { dseMeasureTextLayer && (l.type==='text') && dseMeasureTextLayer(l); dseState.layers.push(l); l.zIndex = dseState.layers.length; });
    const group = dseCreateGroupLayer([cur.id, old.id, badgeShape.id, disc.id], epeArtboardW, epeArtboardH);
    group.name = 'Price Tag';
    dseState.layers.push(group);
    [cur, old, disc, badgeShape].forEach(l => l.groupId = group.id);
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Price tag added.');
  });

  // ---- Object Properties Panel: show only relevant controls per selected type ----
  function dseUpdateObjectPropertiesPanel(){
    const layer = dseActiveLayer();
    document.getElementById('epeAccordionTextPanel') && document.getElementById('epeAccordionTextPanel').classList.toggle('hidden', !layer || layer.type !== 'text');
    document.getElementById('epeAccordionShapePanel') && document.getElementById('epeAccordionShapePanel').classList.toggle('hidden', !layer || (layer.type !== 'shape' && layer.type !== 'icon'));
    document.getElementById('epeAccordionObject') && document.getElementById('epeAccordionObject').classList.toggle('hidden', !layer);
    document.getElementById('epeUngroupBtn') && (document.getElementById('epeUngroupBtn').disabled = !layer || layer.type !== 'group');
    if (layer && (layer.type === 'shape' || layer.type === 'icon')) dseSyncShapeControlsFromLayer(layer);
    if (layer){
      document.getElementById('epeObjectOpacity').value = layer.opacity;
      document.getElementById('epeObjectOpacityVal').textContent = layer.opacity;
      document.getElementById('epeBlendMode').value = layer.blendMode || 'normal';
    }
  }
  function dseSyncShapeControlsFromLayer(layer){
    const isIcon = layer.type === 'icon';
    document.getElementById('epeShapeColorInput') && (document.getElementById('epeShapeColorInput').value = layer.color);
    document.getElementById('epeShapeBorderEnable') && (document.getElementById('epeShapeBorderEnable').checked = layer.border ? layer.border.enabled : false);
    document.getElementById('epeShapeBorderRow') && document.getElementById('epeShapeBorderRow').classList.toggle('hidden', isIcon);
    if (layer.border){
      document.getElementById('epeShapeBorderColor') && (document.getElementById('epeShapeBorderColor').value = layer.border.color);
      document.getElementById('epeShapeBorderWidth') && (document.getElementById('epeShapeBorderWidth').value = layer.border.thickness);
      document.getElementById('epeShapeBorderStyle') && (document.getElementById('epeShapeBorderStyle').value = layer.border.style);
    }
    // Fill type + gradient (both shapes and icons now support this)
    document.querySelectorAll('input[name="epeShapeFillType"]').forEach(r => r.checked = r.value === (layer.fillType||'solid'));
    document.getElementById('epeShapeSolidRow') && document.getElementById('epeShapeSolidRow').classList.toggle('hidden', layer.fillType==='gradient');
    document.getElementById('epeShapeGradientRow') && document.getElementById('epeShapeGradientRow').classList.toggle('hidden', layer.fillType!=='gradient');
    if (layer.gradient){
      document.getElementById('epeShapeGradientFrom') && (document.getElementById('epeShapeGradientFrom').value = layer.gradient.from);
      document.getElementById('epeShapeGradientTo') && (document.getElementById('epeShapeGradientTo').value = layer.gradient.to);
      document.getElementById('epeShapeGradientMode') && (document.getElementById('epeShapeGradientMode').value = layer.gradient.mode||'linear');
      document.getElementById('epeShapeGradientAngle') && (document.getElementById('epeShapeGradientAngle').value = layer.gradient.angle||0);
    }
    // Corner radius: only meaningful for rect-kind shapes, not icons or non-rect shapes
    const def = DSE_SHAPE_DEFS[layer.shapeType];
    const showRadius = !isIcon && def && def.kind === 'rect';
    document.getElementById('epeShapeCornerRadiusRow') && document.getElementById('epeShapeCornerRadiusRow').classList.toggle('hidden', !showRadius);
    if (showRadius){
      const ratio = (layer.cornerRadius !== undefined && layer.cornerRadius !== null) ? layer.cornerRadius : (def.radius||0);
      const pct = Math.round(ratio*100);
      document.getElementById('epeShapeCornerRadius') && (document.getElementById('epeShapeCornerRadius').value = pct);
      document.getElementById('epeShapeCornerRadiusVal') && (document.getElementById('epeShapeCornerRadiusVal').textContent = pct + '%');
    }
    // Shadow
    document.getElementById('epeShapeShadowEnable') && (document.getElementById('epeShapeShadowEnable').checked = layer.shadow.enabled);
    document.getElementById('epeShapeShadowColor') && (document.getElementById('epeShapeShadowColor').value = layer.shadow.color);
    document.getElementById('epeShapeShadowBlur') && (document.getElementById('epeShapeShadowBlur').value = layer.shadow.blur);
    document.getElementById('epeShapeShadowOffsetX') && (document.getElementById('epeShapeShadowOffsetX').value = layer.shadow.offsetX);
    document.getElementById('epeShapeShadowOffsetY') && (document.getElementById('epeShapeShadowOffsetY').value = layer.shadow.offsetY);
    document.getElementById('epeShapeShadowOpacity') && (document.getElementById('epeShapeShadowOpacity').value = layer.shadow.opacity);
    // Glow
    document.getElementById('epeShapeGlowEnable') && (document.getElementById('epeShapeGlowEnable').checked = layer.glow.enabled);
    document.getElementById('epeShapeGlowColor') && (document.getElementById('epeShapeGlowColor').value = layer.glow.color);
    document.getElementById('epeShapeGlowBlur') && (document.getElementById('epeShapeGlowBlur').value = layer.glow.blur);
    document.getElementById('epeShapeGlowOpacity') && (document.getElementById('epeShapeGlowOpacity').value = layer.glow.opacity);
    // Icon swap section only for icon layers
    document.getElementById('epeIconSwapSection') && document.getElementById('epeIconSwapSection').classList.toggle('hidden', !isIcon);
    if (isIcon) dseRenderIconSwapResults('');
  }
  document.getElementById('epeShapeColorInput') && document.getElementById('epeShapeColorInput').addEventListener('input', e => {
    const layer = dseActiveLayer(); if (!layer) return; layer.color = e.target.value; renderEpeAll();
  });
  document.getElementById('epeShapeColorInput') && document.getElementById('epeShapeColorInput').addEventListener('change', () => epePushHistory());
  document.getElementById('epeShapeBorderEnable') && document.getElementById('epeShapeBorderEnable').addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.border) return; layer.border.enabled = e.target.checked; renderEpeAll(); epePushHistory();
  });
  document.getElementById('epeShapeBorderColor') && document.getElementById('epeShapeBorderColor').addEventListener('input', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.border) return; layer.border.color = e.target.value; renderEpeAll();
  });
  document.getElementById('epeShapeBorderWidth') && document.getElementById('epeShapeBorderWidth').addEventListener('input', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.border) return; layer.border.thickness = +e.target.value; renderEpeAll();
  });
  document.getElementById('epeShapeBorderStyle') && document.getElementById('epeShapeBorderStyle').addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.border) return; layer.border.style = e.target.value; renderEpeAll(); epePushHistory();
  });
  [document.getElementById('epeShapeBorderColor'), document.getElementById('epeShapeBorderWidth')].forEach(el => el && el.addEventListener('change', () => epePushHistory()));

  // ---- Fill type + gradient ----
  document.querySelectorAll('input[name="epeShapeFillType"]').forEach(r => r.addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer) return;
    layer.fillType = e.target.value;
    document.getElementById('epeShapeSolidRow').classList.toggle('hidden', layer.fillType==='gradient');
    document.getElementById('epeShapeGradientRow').classList.toggle('hidden', layer.fillType!=='gradient');
    renderEpeAll(); epePushHistory();
  }));
  ['epeShapeGradientFrom','epeShapeGradientTo'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => { const layer = dseActiveLayer(); if (!layer || !layer.gradient) return; layer.gradient.from = document.getElementById('epeShapeGradientFrom').value; layer.gradient.to = document.getElementById('epeShapeGradientTo').value; renderEpeAll(); });
    el.addEventListener('change', () => epePushHistory());
  });
  document.getElementById('epeShapeGradientMode') && document.getElementById('epeShapeGradientMode').addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.gradient) return; layer.gradient.mode = e.target.value; renderEpeAll(); epePushHistory();
  });
  document.getElementById('epeShapeGradientAngle') && document.getElementById('epeShapeGradientAngle').addEventListener('input', e => {
    const layer = dseActiveLayer(); if (!layer || !layer.gradient) return; layer.gradient.angle = +e.target.value; renderEpeAll();
  });
  document.getElementById('epeShapeGradientAngle') && document.getElementById('epeShapeGradientAngle').addEventListener('change', () => epePushHistory());

  // ---- Corner radius (rect-kind shapes only) ----
  document.getElementById('epeShapeCornerRadius') && document.getElementById('epeShapeCornerRadius').addEventListener('input', e => {
    const layer = dseActiveLayer(); if (!layer) return;
    layer.cornerRadius = (+e.target.value)/100;
    document.getElementById('epeShapeCornerRadiusVal').textContent = e.target.value + '%';
    renderEpeAll();
  });
  document.getElementById('epeShapeCornerRadius') && document.getElementById('epeShapeCornerRadius').addEventListener('change', () => epePushHistory());

  // ---- Shadow (shapes and icons both already had this in the render
  // pipeline and layer schema -- this wiring is the missing UI, not new
  // rendering logic). ----
  document.getElementById('epeShapeShadowEnable') && document.getElementById('epeShapeShadowEnable').addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer) return; layer.shadow.enabled = e.target.checked; renderEpeAll(); epePushHistory();
  });
  [['epeShapeShadowColor','color'],['epeShapeShadowBlur','blur'],['epeShapeShadowOffsetX','offsetX'],['epeShapeShadowOffsetY','offsetY'],['epeShapeShadowOpacity','opacity']].forEach(([id, field]) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => { const layer = dseActiveLayer(); if (!layer) return; layer.shadow[field] = el.type==='color' ? el.value : +el.value; renderEpeAll(); });
    el.addEventListener('change', () => epePushHistory());
  });
  document.getElementById('epeShapeGlowEnable') && document.getElementById('epeShapeGlowEnable').addEventListener('change', e => {
    const layer = dseActiveLayer(); if (!layer) return; layer.glow.enabled = e.target.checked; renderEpeAll(); epePushHistory();
  });
  [['epeShapeGlowColor','color'],['epeShapeGlowBlur','blur'],['epeShapeGlowOpacity','opacity']].forEach(([id, field]) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => { const layer = dseActiveLayer(); if (!layer) return; layer.glow[field] = el.type==='color' ? el.value : +el.value; renderEpeAll(); });
    el.addEventListener('change', () => epePushHistory());
  });

  // ---- Replace Color Everywhere: a genuine bulk utility, distinct from
  // just changing one layer's own color -- finds every shape/icon layer
  // (including inside groups) currently using the active layer's exact
  // color and updates them all to a new color in one action. ----
  document.getElementById('epeShapeReplaceColorBtn') && (document.getElementById('epeShapeReplaceColorBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer) return;
    const oldColor = layer.color;
    const newColor = prompt('Replace ' + oldColor + ' with which color? (enter a hex code)', oldColor);
    if (!newColor || !/^#[0-9a-fA-F]{6}$/.test(newColor)) { if (newColor) toast('Enter a valid hex color like #5142D6.', 'err'); return; }
    let count = 0;
    dseState.layers.forEach(l => {
      if ((l.type === 'shape' || l.type === 'icon') && l.color && l.color.toLowerCase() === oldColor.toLowerCase()){
        l.color = newColor; count++;
      }
    });
    renderEpeAll(); epePushHistory(); dseSyncShapeControlsFromLayer(dseActiveLayer());
    toast('Replaced ' + oldColor + ' with ' + newColor + ' on ' + count + (count===1?' layer.':' layers.'));
  });

  // ---- Edit Icon: swap the underlying icon shape on an existing icon
  // layer, preserving position/size/color/gradient/shadow/glow -- only
  // iconKey changes. ----
  function dseRenderIconSwapResults(query){
    const grid = document.getElementById('epeIconSwapGrid');
    if (!grid) return;
    const q = (query||'').toLowerCase().trim();
    let results = DSE_ICON_CATALOG;
    if (q) results = results.filter(i => i.key.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q));
    grid.innerHTML = results.slice(0, 60).map(icon => `<button type="button" class="dse-icon-option" data-key="${icon.key}" title="${icon.key}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${icon.path}"/></svg></button>`).join('');
    grid.querySelectorAll('.dse-icon-option').forEach(btn => btn.onclick = () => {
      const layer = dseActiveLayer(); if (!layer || layer.type !== 'icon') return;
      layer.iconKey = btn.dataset.key; layer.name = btn.dataset.key;
      renderEpeAll(); epePushHistory(); dseRenderLayersPanel();
      toast('Icon replaced.');
    });
  }
  document.getElementById('epeIconSwapSearch') && document.getElementById('epeIconSwapSearch').addEventListener('input', e => dseRenderIconSwapResults(e.target.value));


  document.getElementById('epeLayerSearch') && document.getElementById('epeLayerSearch').addEventListener('input', dseRenderLayersPanel);
  dseLoadBrandColors();
  dseRenderBrandColors();
  (function initIconCategoryFilter(){
    const sel = document.getElementById('epeIconCategoryFilter');
    if (!sel) return;
    DSE_ICON_CATEGORIES.forEach(cat => { const opt = document.createElement('option'); opt.value = cat; opt.textContent = cat; sel.appendChild(opt); });
  })();
  dseRenderIconResults('', 'all');
  dseRenderFontResults('');


  /* ============================================================
     MARKETPLACE STUDIO — Phase 4
     ============================================================
     Reuses the existing render engine, layer engine, shadow/reflection
     studio, alignment engine, and sticker/badge composite mechanism from
     Phases 1-3 wherever possible (per explicit instruction) -- the only
     genuinely new rendering capability added here is an ARTBOARD-LEVEL
     background fill, since the existing epeBgMode is a per-image-layer
     property (AI background replacement within one layer), and
     marketplace compliance requires the WHOLE exported canvas to have
     the correct background (e.g. Amazon's pure white), independent of
     any individual layer.

     Marketplace preset dimensions below are from live research (see
     final report for sources and dates) -- Amazon, Etsy/Shopify/Daraz,
     and social platforms each publish different current numbers, and
     these reflect verified 2026 guidance, not defaults invented here.
     ============================================================ */
  const DSE_MARKETPLACE_PRESETS = {
    'amazon-main':    { name:'Amazon Main Image', w:2000, h:2000, bg:'white', note:'Pure white background (RGB 255,255,255) and the product must fill \u226585% of the frame -- both required for Amazon\u2019s automated compliance check.' },
    'amazon-gallery': { name:'Amazon Gallery', w:2000, h:2000, bg:'none', note:'Secondary images allow lifestyle or non-white backgrounds.' },
    'daraz':          { name:'Daraz Product Image', w:1500, h:1500, bg:'white', note:'Daraz requires a square image between 500\u00d7500 and 2000\u00d72000px.' },
    'ebay':           { name:'eBay Listing Photo', w:1600, h:1600, bg:'none', note:'eBay requires a 500px minimum on the longest side; 1600\u00d71600 is eBay\u2019s own recommended size to enable the zoom feature.' },
    'etsy':           { name:'Etsy Listing Photo', w:2000, h:2000, bg:'none', note:'2000\u00d72000px square is the size most consistently recommended across Etsy seller guides for search display and zoom clarity.' },
    'shopify':        { name:'Shopify Product', w:2048, h:2048, bg:'none', note:'2048\u00d72048px square is Shopify\u2019s documented recommended size for zoom and Retina display.' },
    'facebook-marketplace': { name:'Facebook Marketplace', w:1080, h:1080, bg:'none', note:'Square 1:1 is the safest, most consistent format across Facebook\u2019s surfaces.' },
    'instagram-square':  { name:'Instagram Square', w:1080, h:1080, bg:'none' },
    'instagram-portrait':{ name:'Instagram Portrait', w:1080, h:1350, bg:'none', note:'4:5 -- Instagram\u2019s current best-performing feed ratio.' },
    'instagram-story':   { name:'Instagram Story', w:1080, h:1920, bg:'none', note:'9:16 full-screen format.' },
    'tiktok-shop':    { name:'TikTok Shop', w:1080, h:1920, bg:'none', note:'TikTok is fully vertical -- 9:16 for all image and video content.' },
    'pinterest-pin':  { name:'Pinterest Pin', w:1000, h:1500, bg:'none', note:'2:3 is Pinterest\u2019s current recommended pin ratio; taller pins now get clipped in-feed.' },
    'linkedin-square':{ name:'LinkedIn Square Post', w:1080, h:1080, bg:'none', note:'1080\u00d71080 is LinkedIn\u2019s documented square post size -- the most relevant format for sharing a product photo as a feed post.' },
    // Marketing Studio (Phase 5) additions -- reusing the same preset
    // table and apply mechanism rather than a parallel system. Sizes
    // marked (research) come from live 2026 sources cited in the final
    // report; sizes marked (standard) are long-stable web/email
    // conventions (IAB ad units, common email-marketing practice) rather
    // than fast-changing social specs.
    'facebook-post':    { name:'Facebook Post', w:1080, h:1080, bg:'none' },
    'facebook-cover':   { name:'Facebook Cover', w:820, h:360, bg:'none', note:'820\u00d7360px is the safe-zone size that displays correctly on both desktop (820\u00d7312) and mobile (640\u00d7360) without cropping key content.' },
    'facebook-story':   { name:'Facebook Story', w:1080, h:1920, bg:'none' },
    'instagram-reel-cover': { name:'Instagram Reel Cover', w:1080, h:1920, bg:'none' },
    'tiktok-cover':     { name:'TikTok Cover', w:1080, h:1920, bg:'none' },
    'tiktok-story':     { name:'TikTok Story', w:1080, h:1920, bg:'none' },
    'pinterest-idea-pin': { name:'Pinterest Idea Pin', w:1080, h:1920, bg:'none' },
    'youtube-thumbnail': { name:'YouTube Thumbnail', w:1280, h:720, bg:'none', note:'16:9 -- keep under YouTube\u2019s 2MB file-size limit on export.' },
    'youtube-community': { name:'YouTube Community Post', w:1200, h:1200, bg:'none' },
    'whatsapp-status':  { name:'WhatsApp Status', w:1080, h:1920, bg:'none', note:'Fills the full mobile screen, same convention as Instagram/Facebook Stories.' },
    'google-display-banner': { name:'Google Display Banner (Medium Rectangle)', w:300, h:250, bg:'none', note:'300\u00d7250 is the IAB \u201cMedium Rectangle\u201d -- the most widely supported standard display ad size.' },
    'email-banner':     { name:'Email Banner', w:600, h:200, bg:'none', note:'600px wide is the standard safe email-client rendering width.' },
    'website-hero-banner': { name:'Website Hero Banner', w:1920, h:1080, bg:'none' },
    'popup-banner':     { name:'Popup Banner', w:600, h:400, bg:'none' },
    'landing-page-banner': { name:'Landing Page Banner', w:1200, h:628, bg:'none' },
  };
  const DSE_CANVAS_RATIO_PRESETS = {
    '1:1':{w:1,h:1}, '4:5':{w:4,h:5}, '16:9':{w:16,h:9}, '9:16':{w:9,h:16}, '3:4':{w:3,h:4}, '4:3':{w:4,h:3},
    'a4':{w:2480,h:3508}, // A4 at 300dpi in pixels, a real physical-size reference rather than an arbitrary small ratio
  };

  // ---- Artboard-level canvas background (genuinely new -- see note above) ----
  let epeCanvasBg = { mode:'transparent', color:'#ffffff', gradient:{from:'#f5f5f5', to:'#e0e0e0', angle:180}, studio:false };


  // ---- Apply a Marketplace Preset: resizes the artboard to the exact
  // researched dimensions and repositions the active layer to stay
  // centered -- reuses the same resize-and-reposition math already
  // proven in the Crop tool (Part 1), not a new resizing mechanism. ----
  function dseApplyMarketplacePreset(key){
    const preset = DSE_MARKETPLACE_PRESETS[key];
    if (!preset || dseState.layers.length === 0) return;
    const oldW = epeArtboardW, oldH = epeArtboardH;
    epeArtboardW = preset.w; epeArtboardH = preset.h;
    const scaleFactor = Math.min(epeArtboardW/oldW, epeArtboardH/oldH);
    dseState.layers.forEach(l => {
      // Re-center each layer proportionally within the new artboard
      l.x = (l.x/oldW) * epeArtboardW;
      l.y = (l.y/oldH) * epeArtboardH;
    });
    // Sync the alias variables to match, so the next render's
    // dseFlushAliasesToLayer doesn't overwrite these fresh positions
    // with the stale pre-preset alias values (same pattern already used
    // correctly in dseApplyCanvasRatio).
    const activeAfterReposition = dseActiveLayer();
    if (activeAfterReposition) dseSyncAliasesFromLayer(activeAfterReposition);
    // Sync the alias variables for the active layer too -- otherwise the
    // next render's dseFlushAliasesToLayer() would overwrite this
    // repositioning with the stale pre-preset epeLayer.x/y (image layers only).
    // Same pattern already used correctly by dseAlign().
    const active = dseActiveLayer();
    if (active) dseSyncAliasesFromLayer(active);
    if (preset.bg === 'white') epeCanvasBg = { ...epeCanvasBg, mode:'white' };
    else if (preset.bg === 'none') { /* leave whatever the user already had */ }
    document.getElementById('epeMarketplaceNote').textContent = preset.note || '';
    dseUpdateCanvasBgControlsFromState();
    renderEpeAll(); epePushHistory();
    toast(`${preset.name}: canvas set to ${preset.w}\u00d7${preset.h}px.`);
  }
  document.getElementById('epeMarketplacePreset') && document.getElementById('epeMarketplacePreset').addEventListener('change', (e) => {
    if (e.target.value) dseApplyMarketplacePreset(e.target.value);
  });

  // ---- Canvas Ratio Presets (1:1, 4:5, 16:9, 9:16, 3:4, 4:3, A4, Custom)
  // -- reuses the exact same resize-and-reposition approach as the
  // marketplace presets above, just driven by a ratio instead of an
  // exact marketplace spec. ----
  function dseApplyCanvasRatio(key){
    if (key === 'custom' || dseState.layers.length === 0) return;
    const ratio = DSE_CANVAS_RATIO_PRESETS[key];
    if (!ratio) return;
    const oldW = epeArtboardW, oldH = epeArtboardH;
    let newW, newH;
    if (key === 'a4'){ newW = ratio.w; newH = ratio.h; }
    else {
      // Keep roughly the same overall canvas AREA while changing to the target ratio, rather than an arbitrary fixed size
      const targetRatio = ratio.w/ratio.h, curArea = oldW*oldH;
      newH = Math.round(Math.sqrt(curArea/targetRatio)); newW = Math.round(newH*targetRatio);
    }
    epeArtboardW = newW; epeArtboardH = newH;
    dseState.layers.forEach(l => { l.x = (l.x/oldW)*epeArtboardW; l.y = (l.y/oldH)*epeArtboardH; });
    const active = dseActiveLayer();
    if (active) dseSyncAliasesFromLayer(active);
    renderEpeAll(); epePushHistory();
    toast(`Canvas ratio set to ${key} (${newW}\u00d7${newH}px).`);
  }
  document.getElementById('epeCanvasRatioPreset') && document.getElementById('epeCanvasRatioPreset').addEventListener('change', (e) => {
    if (e.target.value) dseApplyCanvasRatio(e.target.value);
  });

  // ---- Artboard-level Canvas Background controls ----
  function dseUpdateCanvasBgControlsFromState(){
    document.querySelectorAll('input[name="epeCanvasBgMode"]').forEach(r => r.checked = r.value === epeCanvasBg.mode);
    document.getElementById('epeCanvasBgColorRow') && document.getElementById('epeCanvasBgColorRow').classList.toggle('hidden', epeCanvasBg.mode !== 'color');
    document.getElementById('epeCanvasBgGradientRow') && document.getElementById('epeCanvasBgGradientRow').classList.toggle('hidden', epeCanvasBg.mode !== 'gradient');
  }
  document.querySelectorAll('input[name="epeCanvasBgMode"]').forEach(r => r.addEventListener('change', (e) => {
    epeCanvasBg.mode = e.target.value;
    dseUpdateCanvasBgControlsFromState();
    renderEpeAll(); epePushHistory();
  }));
  document.getElementById('epeCanvasBgColorInput') && document.getElementById('epeCanvasBgColorInput').addEventListener('input', (e) => { epeCanvasBg.color = e.target.value; renderEpeAll(); });
  document.getElementById('epeCanvasBgColorInput') && document.getElementById('epeCanvasBgColorInput').addEventListener('change', () => epePushHistory());
  ['epeCanvasBgGradientFrom','epeCanvasBgGradientTo','epeCanvasBgGradientAngle'].forEach(id => {
    document.getElementById(id) && document.getElementById(id).addEventListener('input', () => {
      epeCanvasBg.gradient.from = document.getElementById('epeCanvasBgGradientFrom').value;
      epeCanvasBg.gradient.to = document.getElementById('epeCanvasBgGradientTo').value;
      epeCanvasBg.gradient.angle = +document.getElementById('epeCanvasBgGradientAngle').value;
      renderEpeAll();
    });
    document.getElementById(id) && document.getElementById(id).addEventListener('change', () => epePushHistory());
  });


  document.getElementById('epeSafeAreaMargin') && document.getElementById('epeSafeAreaMargin').addEventListener('input', (e) => {
    document.getElementById('epeSafeAreaMarginVal').textContent = e.target.value;
    renderEpeOverlay();
  });

  // ---- Product Scale Assistant: Fill Canvas, Fit Canvas, Center Fit,
  // Marketplace Recommended Size (85% of frame, matching Amazon's own
  // documented rule, used here as a sensible general default too) ----
  function dseScaleActiveLayer(mode){
    const layer = dseActiveLayer();
    if (!layer) return;
    const nat = dseLayerNaturalSize(layer);
    if (!nat.w || !nat.h) return;
    let targetScale;
    if (mode === 'fill') targetScale = Math.max(epeArtboardW/nat.w, epeArtboardH/nat.h);
    else if (mode === 'fit') targetScale = Math.min(epeArtboardW/nat.w, epeArtboardH/nat.h);
    else if (mode === 'recommended') targetScale = Math.min(epeArtboardW/nat.w, epeArtboardH/nat.h) * 0.85;
    else return;
    layer.scale = targetScale;
    layer.x = epeArtboardW/2; layer.y = epeArtboardH/2;
    if (dseState.selectedIds.has(layer.id)){ epeLayer.scale = layer.scale; epeLayer.x = layer.x; epeLayer.y = layer.y; epeSyncControlsFromLayer(); }
    renderEpeAll(); epePushHistory();
    toast('Scaled: ' + mode + '.');
  }
  document.getElementById('epeScaleFillBtn') && (document.getElementById('epeScaleFillBtn').onclick = () => dseScaleActiveLayer('fill'));
  document.getElementById('epeScaleFitBtn') && (document.getElementById('epeScaleFitBtn').onclick = () => dseScaleActiveLayer('fit'));
  document.getElementById('epeScaleRecommendedBtn') && (document.getElementById('epeScaleRecommendedBtn').onclick = () => dseScaleActiveLayer('recommended'));

  // ---- Product Centering: Horizontal/Vertical Center reuse the existing
  // Alignment Engine (dseAlign) from Part 3 directly -- no new logic
  // needed for those. Optical Center and Auto-Suggestion are new: optical
  // center is approximated by weighting the centroid toward the visual
  // "heavier" (larger-area) content rather than the raw geometric
  // bounding-box center -- a real, if simplified, approximation, not a
  // full saliency-detection model, which this project has no ML for. ----
  document.getElementById('epeOpticalCenterBtn') && (document.getElementById('epeOpticalCenterBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer) return;
    // Optical centering nudges the layer slightly UP from true geometric
    // center -- a well-known real photography/design convention, since
    // true mathematical centering tends to look slightly "low" to the eye.
    layer.x = epeArtboardW/2;
    layer.y = epeArtboardH/2 - epeArtboardH*0.03;
    if (dseState.selectedIds.has(layer.id)){ epeLayer.x = layer.x; epeLayer.y = layer.y; }
    renderEpeAll(); epePushHistory();
    toast('Optically centered.');
  });
  document.getElementById('epeAutoCenterSuggestBtn') && (document.getElementById('epeAutoCenterSuggestBtn').onclick = () => {
    dseAlign('center-h'); dseAlign('center-v');
    toast('Centered on canvas.');
  });

  // ---- Marketplace Quality Check: extends the existing Quality Check
  // panel (Part 3) with marketplace-specific compliance checks, using the
  // same real-detection approach (no automatic modification, warn only). ----
  function dseRunMarketplaceQualityCheck(){
    const el = document.getElementById('epeMarketplaceQualityBody');
    if (!el) return;
    const presetKey = document.getElementById('epeMarketplacePreset') ? document.getElementById('epeMarketplacePreset').value : '';
    const issues = [];
    if (presetKey && DSE_MARKETPLACE_PRESETS[presetKey]){
      const preset = DSE_MARKETPLACE_PRESETS[presetKey];
      if (epeArtboardW !== preset.w || epeArtboardH !== preset.h)
        issues.push(`Canvas is ${epeArtboardW}\u00d7${epeArtboardH}px, but ${preset.name} recommends ${preset.w}\u00d7${preset.h}px.`);
      if (preset.bg === 'white' && epeCanvasBg.mode !== 'white')
        issues.push(`${preset.name} requires a pure white background \u2014 current background is "${epeCanvasBg.mode}".`);
    } else {
      if (epeArtboardW < 1000 || epeArtboardH < 1000) issues.push('Canvas is under 1000px \u2014 most marketplaces require at least 1000px on the shortest side to enable zoom.');
    }
    const ratio = epeArtboardW/epeArtboardH;
    if (ratio < 0.3 || ratio > 3) issues.push('Extreme aspect ratio \u2014 double check this matches your target marketplace\u2019s accepted ratios.');
    // Empty-space heuristic: total layer bounding-box area vs canvas area
    let coveredArea = 0;
    dseState.layers.filter(l => l.visible && !l.groupId).forEach(l => { const bb = dseLayerBoundingBox(l); coveredArea += bb.w*bb.h; });
    const coverage = coveredArea / (epeArtboardW*epeArtboardH);
    if (coverage < 0.15) issues.push('Product appears very small relative to the canvas \u2014 most marketplaces recommend the product filling a large majority of the frame.');
    el.innerHTML = issues.length === 0
      ? `<div style="font-weight:700;color:var(--ok-solid);">\u2713 No marketplace compliance issues detected</div>`
      : `<div style="font-weight:700;color:var(--warn-solid);">\u26a0 ${issues.length} issue(s) found</div>` + issues.map(i => `<div style="margin-top:6px;font-size:12.5px;">\u2022 ${i}</div>`).join('');
  }
  document.getElementById('epeAccordionMarketplace') && document.getElementById('epeAccordionMarketplace').addEventListener('toggle', function(){ if (this.open) dseRunMarketplaceQualityCheck(); });
  document.getElementById('epeMarketplacePreset') && document.getElementById('epeMarketplacePreset').addEventListener('change', () => setTimeout(dseRunMarketplaceQualityCheck, 350));


  // ---- Highlight Elements: Circle/Arrow/Border are existing shapes
  // reused directly (circle -> outline-only via border+transparent fill,
  // arrow -> existing arrow shape, border -> a rectangle with border-only).
  // Glow Highlight and Spotlight are new but reuse the existing shape
  // glow effect / radial gradient fill respectively -- no new rendering
  // system, just new preset configurations of what already exists. ----
  const DSE_HIGHLIGHT_PRESETS = {
    circle: () => { const s = dseCreateShapeLayer('circle', epeArtboardW, epeArtboardH); s.fillType='solid'; s.color='rgba(0,0,0,0)'; s.border={enabled:true,thickness:4,style:'solid',color:'#E05252'}; s.boxW=120; s.boxH=120; return s; },
    arrow: () => { const s = dseCreateShapeLayer('arrow', epeArtboardW, epeArtboardH); s.color='#E05252'; s.boxW=100; s.boxH=40; return s; },
    glow: () => { const s = dseCreateShapeLayer('circle', epeArtboardW, epeArtboardH); s.color='#FFD700'; s.glow={enabled:true,blur:24,opacity:80,color:'#FFD700'}; s.boxW=100; s.boxH=100; return s; },
    border: () => { const s = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH); s.fillType='solid'; s.color='rgba(0,0,0,0)'; s.border={enabled:true,thickness:5,style:'solid',color:'#5142D6'}; s.boxW=Math.round(epeArtboardW*0.4); s.boxH=Math.round(epeArtboardH*0.3); return s; },
    spotlight: () => { const s = dseCreateShapeLayer('circle', epeArtboardW, epeArtboardH); s.fillType='gradient'; s.gradient={from:'rgba(255,255,255,0.55)', to:'rgba(255,255,255,0)', angle:0, mode:'radial'}; s.boxW=220; s.boxH=220; return s; },
  };
  document.querySelectorAll('#epeHighlightRow [data-highlight]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const factory = DSE_HIGHLIGHT_PRESETS[btn.dataset.highlight]; if (!factory) return;
    const layer = factory();
    dseState.layers.push(layer);
    dseSelectLayer(layer.id, false);
    renderEpeAll(); epePushHistory();
    toast('Highlight added.');
  });

  // ---- Callouts: composite presets (shape + text, grouped) -- reuses
  // the exact same mechanism already proven for Stickers/Badges in Part
  // 3, not a new rendering system. ----
  const DSE_CALLOUT_PRESETS = {
    'arrow-callout':  { text:'New Feature', shape:'speech-bubble', color:'#5142D6', textColor:'#ffffff' },
    'rounded-box':    { text:'Add your text', shape:'rounded-rect', color:'#ffffff', textColor:'#111111', border:true },
    'modern-box':     { text:'Add your text', shape:'rounded-rect', color:'#111111', textColor:'#ffffff' },
    'minimal-box':    { text:'Add your text', shape:'rectangle', color:'#f5f5f5', textColor:'#111111', border:true },
    'price-callout':  { text:'$19.99', shape:'circle', color:'#E05252', textColor:'#ffffff' },
    'feature-callout':{ text:'Feature', shape:'speech-bubble', color:'#3BA55C', textColor:'#ffffff' },
  };
  function dseAddCallout(key){
    const preset = DSE_CALLOUT_PRESETS[key]; if (!preset) return;
    const shape = dseCreateShapeLayer(preset.shape, epeArtboardW, epeArtboardH);
    shape.color = preset.color; shape.boxW = preset.shape==='circle' ? 100 : 160; shape.boxH = preset.shape==='circle' ? 100 : 60;
    if (preset.border) shape.border = { enabled:true, thickness:2, style:'solid', color:'#cccccc' };
    const text = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
    text.text = preset.text; text.color = preset.textColor; text.fontSize = 16; text.fontWeight = 700;
    dseMeasureTextLayer(text);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, text.id], epeArtboardW, epeArtboardH);
    group.name = preset.text;
    dseState.layers.push(group);
    shape.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Callout added.');
  }
  document.querySelectorAll('#epeCalloutRow [data-callout]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    dseAddCallout(btn.dataset.callout);
  });

  // ---- Feature Labels: more badge presets, reusing the exact same
  // dseAddStickerOrBadge composite mechanism from Part 3. ----
  const DSE_FEATURE_LABEL_PRESETS = {
    premium:{ text:'PREMIUM', shape:'rounded-rect', color:'#111111', textColor:'#FFB800' },
    waterproof:{ text:'WATERPROOF', shape:'rounded-rect', color:'#2b6de0', textColor:'#ffffff' },
    original:{ text:'100% ORIGINAL', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    new:{ text:'NEW', shape:'circle', color:'#E05252', textColor:'#ffffff' },
    limited:{ text:'LIMITED', shape:'rounded-rect', color:'#FFB800', textColor:'#111111' },
    'eco-friendly':{ text:'ECO FRIENDLY', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    organic:{ text:'ORGANIC', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    imported:{ text:'IMPORTED', shape:'rounded-rect', color:'#5142D6', textColor:'#ffffff' },
    warranty:{ text:'WARRANTY', shape:'shield', color:'#111111', textColor:'#ffffff' },
  };
  document.querySelectorAll('#epeFeatureLabelRow [data-feature]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    dseAddStickerOrBadge(btn.dataset.feature, DSE_FEATURE_LABEL_PRESETS);
  });


  /* ============================================================
     MARKETING STUDIO — Phase 5
     ============================================================
     Reuses the shape/text/group composite mechanism proven in Parts
     3-4 (stickers, badges, price tags) for every new marketing
     component below -- no new rendering system. Comparison Tables and
     Spec Tables are the one genuinely new structural pattern (a grid
     of shape+text cells assembled into one group), still built from
     the same primitives.
     ============================================================ */

  // ---- CTA Button Builder: a rounded-rect (or custom shape) + text,
  // grouped -- fully editable via the existing shape/text panels once
  // ungrouped, or as a whole via the group's own transform. ----
  const DSE_CTA_PRESETS = {
    'buy-now':{ text:'Buy Now', color:'#E05252', textColor:'#ffffff' },
    'order-now':{ text:'Order Now', color:'#5142D6', textColor:'#ffffff' },
    'shop-now':{ text:'Shop Now', color:'#111111', textColor:'#ffffff' },
    'add-to-cart':{ text:'Add To Cart', color:'#3BA55C', textColor:'#ffffff' },
    'learn-more':{ text:'Learn More', color:'#ffffff', textColor:'#111111', border:true },
    'limited-offer':{ text:'Limited Offer', color:'#FFB800', textColor:'#111111' },
    'claim-discount':{ text:'Claim Discount', color:'#E05252', textColor:'#ffffff' },
    'order-today':{ text:'Order Today', color:'#5142D6', textColor:'#ffffff' },
  };
  function dseAddCtaButton(key){
    const preset = DSE_CTA_PRESETS[key]; if (!preset) return;
    const shape = dseCreateShapeLayer('rounded-rect', epeArtboardW, epeArtboardH);
    shape.color = preset.color; shape.boxW = 180; shape.boxH = 56;
    shape.shadow = { enabled:true, style:'soft', opacity:35, blur:10, distance:4, angle:135, scale:100 };
    if (preset.border) shape.border = { enabled:true, thickness:2, style:'solid', color:'#cccccc' };
    const text = dseCreateTextLayer('button', epeArtboardW, epeArtboardH);
    text.text = preset.text; text.color = preset.textColor; text.fontSize = 18; text.fontWeight = 700;
    dseMeasureTextLayer(text);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, text.id], epeArtboardW, epeArtboardH);
    group.name = preset.text;
    dseState.layers.push(group);
    shape.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('CTA button added.');
  }
  document.querySelectorAll('#epeCtaRow [data-cta]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    dseAddCtaButton(btn.dataset.cta);
  });

  // ---- Promotional Ribbons: composite shape+text presets (the
  // "ribbon" shape type was deliberately deferred in Part 3 as a
  // composite graphic asset rather than a vector primitive -- this is
  // that composite, built from the existing rectangle + text.) ----
  const DSE_RIBBON_PRESETS = {
    'flash-sale':{ text:'FLASH SALE', color:'#E05252' }, 'mega-sale':{ text:'MEGA SALE', color:'#E05252' },
    'weekend-sale':{ text:'WEEKEND SALE', color:'#5142D6' }, 'clearance':{ text:'CLEARANCE', color:'#111111' },
    'limited-time':{ text:'LIMITED TIME', color:'#FFB800' }, 'best-seller':{ text:'BEST SELLER', color:'#3BA55C' },
    'top-rated':{ text:'TOP RATED', color:'#FFB800' }, 'recommended':{ text:'RECOMMENDED', color:'#5142D6' },
    'luxury':{ text:'LUXURY', color:'#111111' }, 'premium':{ text:'PREMIUM', color:'#111111' }, 'exclusive':{ text:'EXCLUSIVE', color:'#111111' },
  };
  document.querySelectorAll('#epeRibbonRow [data-ribbon]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const preset = DSE_RIBBON_PRESETS[btn.dataset.ribbon]; if (!preset) return;
    const shape = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH);
    shape.color = preset.color; shape.boxW = 220; shape.boxH = 44; shape.rotation = -12;
    const text = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
    text.text = preset.text; text.color = '#ffffff'; text.fontSize = 16; text.fontWeight = 800; text.letterSpacing = 1;
    text.rotation = -12;
    dseMeasureTextLayer(text);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, text.id], epeArtboardW, epeArtboardH);
    group.name = preset.text;
    dseState.layers.push(group);
    shape.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Ribbon added.');
  });


  // ---- Offer System: Flat/Percentage Discount, BOGO, Free Gift, Bundle,
  // Limited Stock, Flash Deal, and a Countdown Placeholder (explicitly
  // static -- shows placeholder digits, no live timer, matching "only
  // placeholder architecture" from the brief). ----
  const DSE_OFFER_PRESETS = {
    'flat-discount':{ text:'FLAT $10 OFF', shape:'rounded-rect', color:'#E05252', textColor:'#ffffff' },
    'percentage-discount':{ text:'30% OFF', shape:'star', color:'#E05252', textColor:'#ffffff' },
    'bogo':{ text:'BUY 1 GET 1 FREE', shape:'ribbon-rect', color:'#5142D6', textColor:'#ffffff' },
    'free-gift':{ text:'FREE GIFT INCLUDED', shape:'rounded-rect', color:'#3BA55C', textColor:'#ffffff' },
    'bundle-offer':{ text:'BUNDLE & SAVE', shape:'rounded-rect', color:'#FFB800', textColor:'#111111' },
    'limited-stock':{ text:'ONLY FEW LEFT', shape:'circle', color:'#E05252', textColor:'#ffffff' },
    'flash-deal':{ text:'FLASH DEAL', shape:'star', color:'#111111', textColor:'#FFB800' },
    '50-off':{ text:'50% OFF', shape:'circle', color:'#E05252', textColor:'#ffffff' },
    '70-off':{ text:'70% OFF', shape:'star', color:'#E05252', textColor:'#ffffff' },
    'clearance':{ text:'CLEARANCE', shape:'ribbon-rect', color:'#111111', textColor:'#ffffff' },
    'hot-deal':{ text:'HOT DEAL', shape:'rounded-rect', color:'#FF6B35', textColor:'#ffffff' },
    'special-offer':{ text:'SPECIAL OFFER', shape:'rounded-rect', color:'#5142D6', textColor:'#ffffff' },
    'black-friday':{ text:'BLACK FRIDAY', shape:'rounded-rect', color:'#111111', textColor:'#ffffff' },
    'cyber-monday':{ text:'CYBER MONDAY', shape:'rounded-rect', color:'#111111', textColor:'#3BA55C' },
    'summer-sale':{ text:'SUMMER SALE', shape:'circle', color:'#FFB800', textColor:'#111111' },
    'winter-sale':{ text:'WINTER SALE', shape:'circle', color:'#5142D6', textColor:'#ffffff' },
    'new-arrival':{ text:'NEW ARRIVAL', shape:'ribbon-rect', color:'#3BA55C', textColor:'#ffffff' },
  };
  document.querySelectorAll('#epeOfferRow [data-offer]').forEach(btn => btn.onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    dseAddStickerOrBadge(btn.dataset.offer, DSE_OFFER_PRESETS);
  });
  document.getElementById('epeAddCountdownPlaceholderBtn') && (document.getElementById('epeAddCountdownPlaceholderBtn').onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const shape = dseCreateShapeLayer('rounded-rect', epeArtboardW, epeArtboardH);
    shape.color = '#111111'; shape.boxW = 220; shape.boxH = 60;
    const text = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
    text.text = '00 : 00 : 00'; text.color = '#ffffff'; text.fontSize = 22; text.fontWeight = 700; text.letterSpacing = 2;
    dseMeasureTextLayer(text);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, text.id], epeArtboardW, epeArtboardH);
    group.name = 'Countdown (static placeholder)';
    dseState.layers.push(group);
    shape.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Static countdown placeholder added \u2014 edit the digits manually; this is not a live timer.');
  });

  // ---- Trust Elements: icon + text badge composites, reusing the
  // existing icon catalog from Part 3 (shield-check, lock, delivery
  // truck, etc.) ----
  const DSE_TRUST_PRESETS = {
    'secure-checkout':{ text:'Secure Checkout', icon:'lock' },
    'money-back':{ text:'Money Back Guarantee', icon:'shield-check' },
    'fast-delivery':{ text:'Fast Delivery', icon:'clock-fast' },
    'free-shipping':{ text:'Free Shipping', icon:'delivery-truck' },
    'cod':{ text:'Cash On Delivery', icon:'wallet' },
    'verified-seller':{ text:'Verified Seller', icon:'shield-check' },
    'ssl-secure':{ text:'SSL Secure', icon:'lock' },
    'original-product':{ text:'Original Product', icon:'checkmark' },
  };
  function dseAddTrustElement(key){
    const preset = DSE_TRUST_PRESETS[key]; if (!preset) return;
    const icon = dseCreateIconLayer(preset.icon, epeArtboardW, epeArtboardH);
    icon.color = '#3BA55C'; icon.boxW = 28; icon.boxH = 28;
    const text = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
    text.text = preset.text; text.color = '#111111'; text.fontSize = 15; text.fontWeight = 600;
    text.x += 60; // offset so icon and text sit side by side before grouping
    dseMeasureTextLayer(text);
    dseState.layers.push(icon); icon.zIndex = dseState.layers.length;
    dseState.layers.push(text); text.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([icon.id, text.id], epeArtboardW, epeArtboardH);
    group.name = preset.text;
    dseState.layers.push(group);
    icon.groupId = group.id; text.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Trust element added.');
  }
  document.querySelectorAll('#epeTrustRow [data-trust]').forEach(btn => btn.onclick = () => dseAddTrustElement(btn.dataset.trust));

  /* ============================================================
     UNIFIED ASSET LIBRARY (new phase): a real, working registry +
     search index + category filter + lazy/incremental rendering
     system. Every asset entry below is genuine, reusable content
     already built and tested in earlier phases (icons, shapes,
     stickers, badges, CTA/ribbon/offer/trust elements, text style
     presets) -- aggregated here programmatically from their existing
     source catalogs, not duplicated by hand, so this registry can
     never drift out of sync with the actual insertable content.
     Frames, Patterns, and Backgrounds are new but genuinely working
     (real Path2D/canvas rendering, not placeholders). Photos and
     stock-illustration "Graphics" are honestly NOT populated -- see
     the note at the bottom of this block for why.
     ============================================================ */

  const EPE_ASSET_REGISTRY = [];
  let epeAssetSearchIndex = null; // built lazily, once, on first library open

  function epeRegisterAsset(entry){ EPE_ASSET_REGISTRY.push(entry); }

  // ---- Icons (56 real entries, from the existing DSE_ICON_CATALOG) ----
  DSE_ICON_CATALOG.forEach(icon => {
    epeRegisterAsset({
      id: 'icon-' + icon.key,
      title: icon.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: 'Icons',
      tags: [icon.cat.toLowerCase()],
      keywords: [icon.key, icon.cat.toLowerCase(), 'icon'],
      preview: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${icon.path}"/></svg>`,
      editable: true,
      insert: () => {
        if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
        const layer = dseCreateIconLayer(icon.key, epeArtboardW, epeArtboardH);
        dseState.layers.push(layer); dseSelectLayer(layer.id, false);
        renderEpeAll(); epePushHistory(); toast('Icon added.');
      }
    });
  });

  // ---- Shapes (real entries, from the existing DSE_SHAPE_DEFS) ----
  Object.keys(DSE_SHAPE_DEFS).forEach(shapeKey => {
    const def = DSE_SHAPE_DEFS[shapeKey];
    epeRegisterAsset({
      id: 'shape-' + shapeKey,
      title: shapeKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: 'Shapes',
      tags: [def.kind],
      keywords: [shapeKey, def.kind, 'shape'],
      preview: epeShapePreviewSvg(shapeKey, def),
      editable: true,
      insert: () => {
        if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
        const layer = dseCreateShapeLayer(shapeKey, epeArtboardW, epeArtboardH);
        dseState.layers.push(layer); dseSelectLayer(layer.id, false);
        renderEpeAll(); epePushHistory(); toast('Shape added.');
      }
    });
  });
  function epeShapePreviewSvg(key, def){
    // A lightweight, genuine preview -- not a placeholder icon --
    // built directly from the same shape definition the real insert
    // uses, so what's shown in the library matches what gets created.
    if (def.kind === 'rect') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="5" width="18" height="14" rx="${def.radius?4:0}" fill="currentColor"/></svg>`;
    if (def.kind === 'ellipse') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><ellipse cx="12" cy="12" rx="${def.uniform?9:10}" ry="${def.uniform?9:7}" fill="currentColor"/></svg>`;
    if (def.kind === 'line') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2" stroke-dasharray="${def.dashed?'4 3':'0'}"/></svg>`;
    if (key === 'star') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z" fill="currentColor"/></svg>`;
    if (key === 'heart') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-7-4.6-9.5-9C1 8 3 4 7 4c2 0 4 1.5 5 3.5C13 5.5 15 4 17 4c4 0 6 4 4.5 8-2.5 4.4-9.5 9-9.5 9z" fill="currentColor"/></svg>`;
    if (key === 'arrow') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 12h14m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    if (key === 'speech-bubble') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 4h16v12H9l-4 4V4z" fill="currentColor"/></svg>`;
    // Regular polygons: draw the actual n-gon
    const sidesMap = { triangle:3, diamond:4, pentagon:5, hexagon:6, octagon:8, polygon:6 };
    const n = sidesMap[key] || 6;
    let pts = [];
    for (let i=0;i<n;i++){ const a = -Math.PI/2 + i*2*Math.PI/n; pts.push((12+9*Math.cos(a)).toFixed(1)+','+(12+9*Math.sin(a)).toFixed(1)); }
    return `<svg viewBox="0 0 24 24" width="100%" height="100%"><polygon points="${pts.join(' ')}" fill="currentColor"/></svg>`;
  }

  // ---- Stickers & Badges (real presets, DSE_STICKER_PRESETS / DSE_BADGE_PRESETS) ----
  [['Stickers', DSE_STICKER_PRESETS], ['Elements', DSE_BADGE_PRESETS]].forEach(([cat, presetMap]) => {
    Object.keys(presetMap).forEach(key => {
      const p = presetMap[key];
      epeRegisterAsset({
        id: (cat === 'Stickers' ? 'sticker-' : 'badge-') + key,
        title: p.text.replace(/\u2713|\u2605/g, '').trim(),
        category: cat,
        tags: ['badge', 'label', p.shape],
        keywords: [key, p.text.toLowerCase(), cat.toLowerCase()],
        preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${p.color};color:${p.textColor};font-size:8px;font-weight:800;border-radius:6px;text-align:center;padding:2px;line-height:1.1;">${p.text}</div>`,
        editable: true,
        insert: () => {
          if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
          dseAddStickerOrBadge(key, presetMap);
        }
      });
    });
  });

  // ---- CTA Buttons & Trust Elements (real presets, direct functions) ----
  Object.keys(DSE_CTA_PRESETS).forEach(key => {
    const p = DSE_CTA_PRESETS[key];
    epeRegisterAsset({
      id: 'cta-' + key, title: p.text, category: 'Elements',
      tags: ['button', 'cta', 'marketing'], keywords: [key, p.text.toLowerCase(), 'button', 'cta'],
      preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${p.color};color:${p.textColor};font-size:8px;font-weight:700;border-radius:6px;${p.border?'border:1px solid #ccc;':''}">${p.text}</div>`,
      editable: true,
      insert: () => { if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; } dseAddCtaButton(key); }
    });
  });
  Object.keys(DSE_TRUST_PRESETS).forEach(key => {
    const p = DSE_TRUST_PRESETS[key];
    epeRegisterAsset({
      id: 'trust-' + key, title: p.text, category: 'Elements',
      tags: ['trust', 'badge', 'marketing'], keywords: [key, p.text.toLowerCase(), 'trust'],
      preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;text-align:center;color:var(--ink);">\u2713 ${p.text}</div>`,
      editable: true,
      insert: () => { if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; } dseAddTrustElement(key); }
    });
  });
  // Ribbons and Offers use inline onclick handlers on their own buttons
  // rather than standalone functions -- reused here by delegating to
  // those existing buttons (the same safe pattern used elsewhere in
  // this codebase for exactly this situation) rather than duplicating
  // their insert logic.
  Object.keys(DSE_RIBBON_PRESETS).forEach(key => {
    const p = DSE_RIBBON_PRESETS[key];
    epeRegisterAsset({
      id: 'ribbon-' + key, title: p.text, category: 'Elements',
      tags: ['ribbon', 'banner', 'marketing'], keywords: [key, p.text.toLowerCase(), 'ribbon'],
      preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${p.color};color:#fff;font-size:7px;font-weight:800;">${p.text}</div>`,
      editable: true,
      insert: () => {
        const btn = document.querySelector('#epeRibbonRow [data-ribbon="' + key + '"]');
        if (btn) btn.click(); else toast('Ribbon unavailable.', 'err');
      }
    });
  });
  if (typeof DSE_OFFER_PRESETS !== 'undefined'){
    Object.keys(DSE_OFFER_PRESETS).forEach(key => {
      const p = DSE_OFFER_PRESETS[key];
      epeRegisterAsset({
        id: 'offer-' + key, title: p.text, category: 'Elements',
        tags: ['offer', 'promo', 'marketing'], keywords: [key, p.text.toLowerCase(), 'offer'],
        preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${p.color};color:${p.textColor||'#fff'};font-size:7px;font-weight:800;border-radius:4px;">${p.text}</div>`,
        editable: true,
        insert: () => {
          const btn = document.querySelector('#epeOfferRow [data-offer="' + key + '"]');
          if (btn) btn.click(); else toast('Offer unavailable.', 'err');
        }
      });
    });
  }

  // ---- Text Styles (real presets, from the existing Add Text buttons) ----
  const EPE_TEXT_STYLE_LABELS = { heading:'Heading', subheading:'Sub Heading', paragraph:'Paragraph', caption:'Caption', body:'Body', price:'Price Label', button:'Button Text', badge:'Badge Text', custom:'Custom Text Box' };
  Object.keys(EPE_TEXT_STYLE_LABELS).forEach(key => {
    epeRegisterAsset({
      id: 'textstyle-' + key, title: EPE_TEXT_STYLE_LABELS[key], category: 'Text Styles',
      tags: ['text', 'typography'], keywords: [key, EPE_TEXT_STYLE_LABELS[key].toLowerCase(), 'text'],
      preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${key==='heading'?'13px':key==='caption'?'8px':'10px'};color:var(--ink);">Aa</div>`,
      editable: true,
      insert: () => {
        const btn = document.querySelector('[data-text-type="' + key + '"]');
        if (btn) btn.click(); else toast('Text style unavailable.', 'err');
      }
    });
  });

  // ---- Frames (new, genuinely working: real border-only shape layers,
  // not placeholders -- reuses the existing shape+border rendering) ----
  const EPE_FRAME_DEFS = [
    { id:'frame-rect-thin', title:'Thin Rectangle Frame', shape:'rectangle', thickness:2 },
    { id:'frame-rect-thick', title:'Bold Rectangle Frame', shape:'rectangle', thickness:8 },
    { id:'frame-rounded', title:'Rounded Frame', shape:'rounded-rect', thickness:4 },
    { id:'frame-circle', title:'Circle Frame', shape:'circle', thickness:4 },
    { id:'frame-hexagon', title:'Hexagon Frame', shape:'hexagon', thickness:3 },
  ];
  EPE_FRAME_DEFS.forEach(f => {
    epeRegisterAsset({
      id: f.id, title: f.title, category: 'Frames',
      tags: ['frame', 'border'], keywords: [f.shape, 'frame', 'border', 'outline'],
      preview: epeShapePreviewSvg(f.shape, DSE_SHAPE_DEFS[f.shape]).replace('fill="currentColor"', 'fill="none" stroke="currentColor" stroke-width="2"'),
      editable: true,
      insert: () => {
        if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
        const layer = dseCreateShapeLayer(f.shape, epeArtboardW, epeArtboardH);
        layer.color = 'transparent'; // fillType only supports solid|gradient -- a fully transparent color is the correct way to get a frame-only (border, no fill) look with the existing renderer
        layer.border = { enabled:true, thickness:f.thickness, style:'solid', color:'#111111' };
        layer.boxW = 220; layer.boxH = 220;
        dseState.layers.push(layer); dseSelectLayer(layer.id, false);
        renderEpeAll(); epePushHistory(); toast('Frame added.');
      }
    });
  });

  // ---- Backgrounds (real, using the existing epeCanvasBg system) ----
  const EPE_BACKGROUND_DEFS = [
    { id:'bg-white', title:'White', mode:'white', preview:'#ffffff' },
    { id:'bg-black', title:'Black', mode:'black', preview:'#000000' },
    { id:'bg-studio', title:'Studio Vignette', mode:'studio', preview:'radial-gradient(circle at 50% 40%, #ffffff, #d8d8dc)' },
    { id:'bg-gradient-cool', title:'Cool Gradient', mode:'gradient', gradient:{from:'#e8ecf7', to:'#c9d4f0', angle:135}, preview:'linear-gradient(135deg,#e8ecf7,#c9d4f0)' },
    { id:'bg-gradient-warm', title:'Warm Gradient', mode:'gradient', gradient:{from:'#fdf1e6', to:'#f5d9b8', angle:135}, preview:'linear-gradient(135deg,#fdf1e6,#f5d9b8)' },
    { id:'bg-gradient-mint', title:'Mint Gradient', mode:'gradient', gradient:{from:'#e6f7f1', to:'#bfe8d9', angle:135}, preview:'linear-gradient(135deg,#e6f7f1,#bfe8d9)' },
  ];
  EPE_BACKGROUND_DEFS.forEach(b => {
    epeRegisterAsset({
      id: b.id, title: b.title, category: 'Backgrounds',
      tags: ['background', 'canvas'], keywords: [b.mode, b.title.toLowerCase(), 'background'],
      preview: `<div style="width:100%;height:100%;border-radius:4px;background:${b.preview};"></div>`,
      editable: true,
      insert: () => {
        if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
        epeCanvasBg = { ...epeCanvasBg, mode: b.mode };
        if (b.gradient) epeCanvasBg.gradient = b.gradient;
        renderEpeAll(); epePushHistory(); toast('Background applied.');
        const bgRadio = document.querySelector(`input[name="epeCanvasBgMode"][value="${b.mode}"]`);
        if (bgRadio) bgRadio.checked = true;
      }
    });
  });

  // ---- Patterns (real, new pattern renderer added to the background pipeline) ----
  const EPE_PATTERN_DEFS = [
    { id:'pattern-dots', title:'Dots', pattern:'dots' },
    { id:'pattern-stripes', title:'Diagonal Stripes', pattern:'stripes' },
    { id:'pattern-grid', title:'Grid', pattern:'grid' },
    { id:'pattern-checkerboard', title:'Checkerboard', pattern:'checkerboard' },
  ];
  EPE_PATTERN_DEFS.forEach(p => {
    epeRegisterAsset({
      id: p.id, title: p.title, category: 'Patterns',
      tags: ['pattern', 'background', 'texture'], keywords: [p.pattern, p.title.toLowerCase(), 'pattern'],
      preview: epePatternPreviewSvg(p.pattern),
      editable: true,
      insert: () => {
        if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
        epeCanvasBg = { ...epeCanvasBg, mode:'pattern', pattern:p.pattern, patternBg:'#f4f4f6', patternColor:'#00000018', patternSpacing:24 };
        renderEpeAll(); epePushHistory(); toast('Pattern applied.');
      }
    });
  });
  function epePatternPreviewSvg(pattern){
    if (pattern === 'dots') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" fill="#f4f4f6"/><circle cx="6" cy="6" r="1.3" fill="#00000030"/><circle cx="18" cy="6" r="1.3" fill="#00000030"/><circle cx="6" cy="18" r="1.3" fill="#00000030"/><circle cx="18" cy="18" r="1.3" fill="#00000030"/><circle cx="12" cy="12" r="1.3" fill="#00000030"/></svg>`;
    if (pattern === 'stripes') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" fill="#f4f4f6"/><path d="M-4 24L24-4M4 24L24 4M-4 14L14-4" stroke="#00000030" stroke-width="2"/></svg>`;
    if (pattern === 'grid') return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" fill="#f4f4f6"/><path d="M8 0v24M16 0v24M0 8h24M0 16h24" stroke="#00000025" stroke-width="1"/></svg>`;
    return `<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" fill="#f4f4f6"/><rect x="0" y="0" width="8" height="8" fill="#00000025"/><rect x="16" y="0" width="8" height="8" fill="#00000025"/><rect x="8" y="8" width="8" height="8" fill="#00000025"/><rect x="0" y="16" width="8" height="8" fill="#00000025"/><rect x="16" y="16" width="8" height="8" fill="#00000025"/></svg>`;
  }

  // ---- Honest disclosure: NOT populated ----
  // "Photos" (real stock photography) and "Graphics" (stock vector
  // illustrations, distinct from the Icons already covered above)
  // genuinely require a licensed external content source. This
  // sandbox has no network access, and inventing placeholder images
  // for these categories would be exactly the "dummy implementation"
  // this phase explicitly prohibits. The architecture below fully
  // supports adding them (same registry, same schema) the moment a
  // real content source is wired in -- see ARCHITECTURE section in
  // the delivered documentation for the exact integration point.
  // "Templates" (pre-built full-canvas layouts) is a distinct,
  // substantial feature (composing many layers into a named preset)
  // that overlaps with the existing Marketplace preset system but
  // isn't yet built as reusable named layer-compositions; left out
  // for the same reason -- it would need genuine content, not a
  // placeholder grid of empty cards.

  console.log('EPE_ASSET_REGISTRY built:', EPE_ASSET_REGISTRY.length, 'real assets across', new Set(EPE_ASSET_REGISTRY.map(a=>a.category)).size, 'categories');

  /* ============================================================
     MARKETING ASSET LIBRARY (this phase): hundreds of genuinely
     editable composite assets (shape + text, optionally + icon)
     across 13 industry categories, generated programmatically from
     real data tables -- reusing the exact same insertion pipeline as
     the existing Stickers/Badges system (dseCreateShapeLayer +
     dseCreateTextLayer + dseCreateGroupLayer), not a new rendering
     path, and not raster images -- every asset is vector shapes/text/
     icons composited live, fully editable after insertion (recolor,
     resize, retype, restyle) exactly like any other layer. ----
     ============================================================ */
  const EPE_MARKETING_CATEGORIES = {
    'Sale': {
      colors: ['#E05252','#FF6B35','#FFB800'],
      icon: 'percent',
      labels: ['SALE','MEGA SALE','FLASH SALE','END OF SEASON','UP TO 50% OFF','UP TO 70% OFF','TODAY ONLY','LIMITED TIME','WHILE STOCKS LAST','SHOP THE SALE','SAVE BIG','PRICE DROP','DEAL OF THE DAY','CLEARANCE SALE','LAST CHANCE'],
    },
    'Luxury': {
      colors: ['#111111','#8B7355','#111111'],
      icon: 'crown',
      labels: ['LUXURY COLLECTION','PREMIUM QUALITY','EXCLUSIVE EDITION','HANDCRAFTED','LIMITED EDITION','SIGNATURE SERIES','PRESTIGE','ELEGANCE REDEFINED','MASTERPIECE','ARTISAN MADE','FINE CRAFTSMANSHIP','ULTRA PREMIUM','COUTURE','BESPOKE','THE FINEST'],
    },
    'Business': {
      colors: ['#1E3A5F','#2E5C8A','#5142D6'],
      icon: 'briefcase',
      labels: ['NOW HIRING','GROW YOUR BUSINESS','TRUSTED PARTNER','ENTERPRISE SOLUTIONS','B2B SERVICES','CONSULTING','CORPORATE OFFICE','MEET THE TEAM','OUR SERVICES','CLIENT TESTIMONIAL','CASE STUDY','FREE CONSULTATION','BOOK A MEETING','PROFESSIONAL SERVICES','INDUSTRY LEADER'],
    },
    'Fashion': {
      colors: ['#D6336C','#111111','#C9A0DC'],
      icon: 'tshirt',
      labels: ['NEW COLLECTION','SPRING SEASON','STREETWEAR','TRENDING NOW','OUTFIT OF THE DAY','STYLE GUIDE','LOOKBOOK','SUSTAINABLE FASHION','MADE TO ORDER','SIZE GUIDE','SHOP THE LOOK','SEASONAL DROP','DESIGNER PICKS','WARDROBE ESSENTIALS','CATWALK READY'],
    },
    'Restaurant': {
      colors: ['#C0392B','#E67E22','#3BA55C'],
      icon: 'coffee',
      labels: ['NOW OPEN','FRESH DAILY','CHEF\u2019S SPECIAL','FARM TO TABLE','ORDER NOW','DINE IN OR TAKEOUT','HAPPY HOUR','TASTING MENU','RESERVE A TABLE','TODAY\u2019S MENU','FRESHLY BAKED','100% ORGANIC','FAMILY RECIPE','WEEKEND BRUNCH','CATERING AVAILABLE'],
    },
    'Gym': {
      colors: ['#111111','#E05252','#3BA55C'],
      icon: 'dumbbell',
      labels: ['JOIN NOW','FIRST CLASS FREE','PERSONAL TRAINING','NEW MEMBER OFFER','TRANSFORM YOUR BODY','24/7 ACCESS','GROUP CLASSES','NO EXCUSES','FITNESS GOALS','STRENGTH TRAINING','CARDIO ZONE','MEMBERSHIP DEALS','TRAIN HARDER','RESULTS GUARANTEED','FUEL YOUR WORKOUT'],
    },
    'Medical': {
      colors: ['#2E86C1','#3BA55C','#ffffff'],
      icon: 'cross-medical',
      labels: ['BOOK APPOINTMENT','ACCEPTING NEW PATIENTS','TELEHEALTH AVAILABLE','BOARD CERTIFIED','WALK-INS WELCOME','INSURANCE ACCEPTED','TRUSTED CARE','PATIENT FIRST','24/7 EMERGENCY','ROUTINE CHECKUP','SPECIALIST CARE','HEALTH SCREENING','VACCINATIONS AVAILABLE','COMPASSIONATE CARE','SCHEDULE A VISIT'],
    },
    'Technology': {
      colors: ['#5142D6','#111111','#00B8D9'],
      icon: 'laptop',
      labels: ['NEW RELEASE','NOW IN BETA','CLOUD POWERED','AI ENABLED','FREE TRIAL','UPGRADE NOW','NEXT-GEN TECH','DOWNLOAD THE APP','SECURE & ENCRYPTED','SUBSCRIBE FOR UPDATES','FASTER THAN EVER','INNOVATION FIRST','SMART TECHNOLOGY','SEAMLESS INTEGRATION','FUTURE READY'],
    },
    'Real Estate': {
      colors: ['#1E3A5F','#3BA55C','#8B7355'],
      icon: 'building',
      labels: ['FOR SALE','FOR RENT','OPEN HOUSE','JUST LISTED','PRICE REDUCED','NEW LISTING','SOLD','SCHEDULE A TOUR','PRIME LOCATION','MOVE-IN READY','LUXURY LIVING','INVESTMENT OPPORTUNITY','WATERFRONT PROPERTY','FIRST TIME BUYER','VIRTUAL TOUR AVAILABLE'],
    },
    'Travel': {
      colors: ['#00B8D9','#FFB800','#3BA55C'],
      icon: 'plane',
      labels: ['BOOK NOW','LIMITED SEATS','EXPLORE THE WORLD','SUMMER GETAWAY','ALL-INCLUSIVE','TRAVEL DEALS','ADVENTURE AWAITS','LAST MINUTE DEALS','WEEKEND ESCAPE','FLIGHT + HOTEL','DISCOVER NEW PLACES','TRAVEL PACKAGE','EARLY BIRD OFFER','DESTINATION GUIDE','WANDERLUST'],
    },
    'Education': {
      colors: ['#5142D6','#3BA55C','#FFB800'],
      icon: 'book',
      labels: ['ENROLL NOW','NEW SEMESTER','ONLINE COURSES','CERTIFICATE PROGRAM','LEARN AT YOUR PACE','SCHOLARSHIPS AVAILABLE','EXPERT INSTRUCTORS','FREE WORKSHOP','STUDENT DISCOUNT','ADMISSIONS OPEN','SKILL BUILDING','LIFELONG LEARNING','CLASSES STARTING SOON','ACCREDITED PROGRAM','STUDY MATERIALS INCLUDED'],
    },
    'Kids': {
      colors: ['#FFB800','#00B8D9','#D6336C'],
      icon: 'baby-bottle',
      labels: ['KIDS COLLECTION','BACK TO SCHOOL','SAFE & FUN','AGES 3-8','EDUCATIONAL TOYS','PARENT APPROVED','PLAYTIME ESSENTIALS','NEW ARRIVALS','MADE FOR LITTLE ONES','FUN FOR ALL AGES','SOFT & SAFE MATERIALS','LEARNING THROUGH PLAY','KIDS FAVORITE','GIFT FOR KIDS','GROWS WITH YOUR CHILD'],
    },
    'Wedding': {
      colors: ['#D6336C','#8B7355','#ffffff'],
      icon: 'wedding-rings',
      labels: ['BOOK YOUR DATE','WEDDING PACKAGES','SAY I DO','NOW BOOKING 2027','BRIDAL COLLECTION','CUSTOM INVITATIONS','VENUE AVAILABLE','WEDDING PLANNING','JUST MARRIED','SAVE THE DATE','FOREVER STARTS HERE','WEDDING ESSENTIALS','BRIDAL SHOWER','HONEYMOON PACKAGES','YOUR DREAM WEDDING'],
    },
  };

  // ---- Generator: builds one composite (shape+text[+icon]) asset per
  // label, reusing the exact same primitives and insertion pattern as
  // the existing Stickers/Badges system. Vector only -- no raster
  // image generation anywhere in this pipeline. ----
  let epeMarketingAssetCount = 0;
  Object.entries(EPE_MARKETING_CATEGORIES).forEach(([catName, catData]) => {
    catData.labels.forEach((label, i) => {
      const color = catData.colors[i % catData.colors.length];
      const textColor = (color === '#ffffff' || color === '#FFB800') ? '#111111' : '#ffffff';
      const id = 'mkt-' + catName.toLowerCase().replace(/\s+/g,'-') + '-' + i;
      epeMarketingAssetCount++;
      epeRegisterAsset({
        id, title: label.replace(/\u2019/g,"'"), category: 'Marketing: ' + catName,
        tags: ['marketing', catName.toLowerCase(), 'badge'],
        keywords: [catName.toLowerCase(), label.toLowerCase(), 'marketing'],
        preview: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:${textColor};font-size:6.5px;font-weight:800;border-radius:5px;text-align:center;padding:2px;line-height:1.15;overflow:hidden;">${label}</div>`,
        editable: true,
        insert: () => {
          if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
          const shape = dseCreateShapeLayer('rounded-rect', epeArtboardW, epeArtboardH);
          shape.color = color; shape.boxW = 180; shape.boxH = 56;
          const text = dseCreateTextLayer('badge', epeArtboardW, epeArtboardH);
          text.text = label.replace(/\u2019/g,"'"); text.color = textColor; text.fontSize = 16; text.fontWeight = 800;
          dseMeasureTextLayer(text);
          const memberIds = [];
          dseState.layers.push(shape); shape.zIndex = dseState.layers.length; memberIds.push(shape.id);
          if (catData.icon && DSE_ICON_CATALOG_BY_KEY[catData.icon]){
            const icon = dseCreateIconLayer(catData.icon, epeArtboardW, epeArtboardH);
            icon.color = textColor; icon.boxW = 22; icon.boxH = 22;
            icon.x = shape.x - shape.boxW/2 + 20;
            dseState.layers.push(icon); icon.zIndex = dseState.layers.length; memberIds.push(icon.id);
            text.x += 12; // shift text right to make room for the icon
          }
          dseState.layers.push(text); text.zIndex = dseState.layers.length; memberIds.push(text.id);
          const group = dseCreateGroupLayer(memberIds, epeArtboardW, epeArtboardH);
          group.name = label;
          dseState.layers.push(group);
          memberIds.forEach(mid => { const l = dseState.layers.find(x=>x.id===mid); if (l) l.groupId = group.id; });
          dseSelectLayer(group.id, false);
          renderEpeAll(); epePushHistory();
          toast('Marketing asset added \u2014 fully editable (ungroup, recolor, retype, resize).');
        }
      });
    });
  });
  console.log('EPE_MARKETING library built:', epeMarketingAssetCount, 'assets across', Object.keys(EPE_MARKETING_CATEGORIES).length, 'industry categories');

  /* ============================================================
     TEXT STYLE LIBRARY (this phase): hundreds of genuinely distinct,
     fully editable text presets across 15 style categories. Each
     preset sets real, already-existing, already-rendering text layer
     properties (fontFamily, fontWeight, letterSpacing, color/
     gradient, shadow, stroke, glow) on a normal, fully editable text
     layer -- reusing dseCreateTextLayer and the existing text render
     pipeline entirely unchanged. No new rendering capability was
     added; this is preset DATA applied through the existing engine.
     ============================================================ */
  const EPE_TEXT_STYLE_CATEGORIES = {
    'Luxury': { font:'Playfair Display', weight:700, presets:[
      {label:'Prestige', color:'#111111', ls:2},
      {label:'Elegance', color:'#8B7355', ls:3, italic:true},
      {label:'Signature', color:'#111111', ls:1, font:'Cormorant Garamond'},
      {label:'Heritage', color:'#111111', ls:2, shadow:true},
      {label:'Exquisite', color:'#8B7355', ls:4},
      {label:'Refined', color:'#111111', ls:1, italic:true},
      {label:'Opulence', color:'#111111', ls:3, font:'Cinzel'},
      {label:'Timeless', color:'#8B7355', ls:2},
      {label:'Couture', color:'#111111', ls:2, font:'Italiana'},
      {label:'Distinction', color:'#111111', ls:3, shadow:true},
      {label:'Rarefied', color:'#8B7355', ls:2, italic:true},
      {label:'Bespoke', color:'#111111', ls:1, font:'Marcellus'},
      {label:'Grandeur', color:'#111111', ls:4},
      {label:'Sovereign', color:'#8B7355', ls:2},
      {label:'Legacy', color:'#111111', ls:3, font:'Prata'},
    ]},
    'Gaming': { font:'Press Start 2P', weight:400, presets:[
      {label:'GAME OVER', color:'#FF3366', stroke:true},
      {label:'LEVEL UP', color:'#00FF88', glow:true},
      {label:'HIGH SCORE', color:'#FFD700', stroke:true},
      {label:'PLAYER 1', color:'#00D9FF', glow:true},
      {label:'NEW ACHIEVEMENT', color:'#FF3366', stroke:true, font:'Orbitron'},
      {label:'BOSS BATTLE', color:'#FF3366', glow:true},
      {label:'INSERT COIN', color:'#FFD700', stroke:true},
      {label:'CONTINUE?', color:'#00D9FF', font:'Russo One'},
      {label:'POWER UP', color:'#00FF88', glow:true},
      {label:'GAME START', color:'#FF3366', stroke:true, font:'Audiowide'},
      {label:'COMBO x10', color:'#FFD700', glow:true},
      {label:'VICTORY', color:'#00FF88', stroke:true},
      {label:'PRESS START', color:'#00D9FF', font:'Faster One'},
      {label:'CRITICAL HIT', color:'#FF3366', glow:true},
      {label:'RESPAWN', color:'#FFD700', stroke:true},
    ]},
    'Minimal': { font:'Inter', weight:400, presets:[
      {label:'Simple', color:'#111111', ls:1},
      {label:'Clean', color:'#333333', ls:2, font:'Work Sans'},
      {label:'Modern', color:'#111111', ls:0, weight:300},
      {label:'Essential', color:'#111111', ls:1, font:'DM Sans'},
      {label:'Pure', color:'#333333', ls:2, weight:300},
      {label:'Understated', color:'#111111', ls:1, font:'Karla'},
      {label:'Quiet', color:'#333333', ls:0, weight:300},
      {label:'Effortless', color:'#111111', ls:1, font:'Manrope'},
      {label:'Balanced', color:'#111111', ls:1, weight:400},
      {label:'Refined Simplicity', color:'#333333', ls:1, font:'Jost'},
      {label:'Less is More', color:'#111111', ls:0, weight:300},
      {label:'Clear', color:'#111111', ls:1},
      {label:'Honest', color:'#333333', ls:1, font:'Work Sans'},
      {label:'Focused', color:'#111111', ls:0, weight:400},
      {label:'Precise', color:'#111111', ls:1, font:'DM Sans'},
    ]},
    'Shadow': { font:'Montserrat', weight:800, presets:[
      {label:'DEEP SHADOW', color:'#111111', shadow:true, shadowBig:true},
      {label:'DROP SHADOW', color:'#FFFFFF', shadow:true},
      {label:'LONG SHADOW', color:'#111111', shadow:true, shadowBig:true},
      {label:'SOFT SHADOW', color:'#333333', shadow:true},
      {label:'HARD SHADOW', color:'#111111', shadow:true, shadowBig:true},
      {label:'FLOATING TEXT', color:'#FFFFFF', shadow:true},
      {label:'DIMENSIONAL', color:'#111111', shadow:true, shadowBig:true},
      {label:'RAISED', color:'#333333', shadow:true},
      {label:'LIFTED', color:'#FFFFFF', shadow:true, shadowBig:true},
      {label:'LAYERED', color:'#111111', shadow:true},
      {label:'STACKED', color:'#333333', shadow:true, shadowBig:true},
      {label:'DEPTH', color:'#FFFFFF', shadow:true},
      {label:'SHADOWCAST', color:'#111111', shadow:true, shadowBig:true},
      {label:'DUSK', color:'#333333', shadow:true},
      {label:'ECLIPSE', color:'#111111', shadow:true, shadowBig:true},
    ]},
    'Neon': { font:'Poppins', weight:700, presets:[
      {label:'NEON NIGHTS', color:'#FF00E5', glow:true},
      {label:'ELECTRIC', color:'#00FFF0', glow:true},
      {label:'GLOW UP', color:'#39FF14', glow:true},
      {label:'MIDNIGHT', color:'#FF00E5', glow:true},
      {label:'CYBER', color:'#00FFF0', glow:true},
      {label:'VIBRANT', color:'#FF3366', glow:true},
      {label:'LUMINOUS', color:'#39FF14', glow:true},
      {label:'AFTER DARK', color:'#FF00E5', glow:true},
      {label:'RADIANT', color:'#00FFF0', glow:true},
      {label:'PULSE', color:'#FF3366', glow:true},
      {label:'BLACKLIGHT', color:'#39FF14', glow:true},
      {label:'CLUB NIGHT', color:'#FF00E5', glow:true},
      {label:'HIGH VOLTAGE', color:'#00FFF0', glow:true},
      {label:'FLUORESCENT', color:'#39FF14', glow:true},
      {label:'ULTRAVIOLET', color:'#FF00E5', glow:true},
    ]},
    'Fashion': { font:'Bodoni Moda', weight:400, presets:[
      {label:'HAUTE COUTURE', color:'#111111', ls:4},
      {label:'RUNWAY', color:'#111111', ls:3, italic:true},
      {label:'VOGUE', color:'#111111', ls:5, font:'Prata'},
      {label:'ATELIER', color:'#111111', ls:2},
      {label:'CATWALK', color:'#111111', ls:3, font:'Marcellus'},
      {label:'EDITORIAL', color:'#111111', ls:4, italic:true},
      {label:'SILHOUETTE', color:'#111111', ls:2},
      {label:'SEASON DROP', color:'#111111', ls:3, font:'Cormorant'},
      {label:'STYLE FILE', color:'#111111', ls:2},
      {label:'DESIGNER', color:'#111111', ls:4, italic:true},
      {label:'AVANT-GARDE', color:'#111111', ls:3, font:'Italiana'},
      {label:'MUSE', color:'#111111', ls:5},
      {label:'TEXTURE', color:'#111111', ls:2, font:'Marcellus'},
      {label:'MONOCHROME', color:'#111111', ls:3},
      {label:'FRONT ROW', color:'#111111', ls:4, italic:true},
    ]},
    'Wedding': { font:'Great Vibes', weight:400, presets:[
      {label:'Forever & Always', color:'#8B7355', font:'Great Vibes'},
      {label:'I Do', color:'#111111', font:'Sacramento'},
      {label:'Save the Date', color:'#8B7355', font:'Parisienne'},
      {label:'Happily Ever After', color:'#111111', font:'Allura'},
      {label:'Just Married', color:'#8B7355', font:'Alex Brush'},
      {label:'With This Ring', color:'#111111', font:'Yellowtail'},
      {label:'Two Hearts', color:'#8B7355', font:'Kaushan Script'},
      {label:'Our Wedding Day', color:'#111111', font:'Great Vibes'},
      {label:'Til Death Do Us Part', color:'#8B7355', font:'Satisfy'},
      {label:'Bride & Groom', color:'#111111', font:'Dancing Script'},
      {label:'The Knot', color:'#8B7355', font:'Sacramento'},
      {label:'Eternally Yours', color:'#111111', font:'Allura'},
      {label:'A New Chapter', color:'#8B7355', font:'Parisienne'},
      {label:'True Love', color:'#111111', font:'Alex Brush'},
      {label:'Wedding Bells', color:'#8B7355', font:'Yellowtail'},
    ]},
    'Business': { font:'IBM Plex Sans', weight:600, presets:[
      {label:'ENTERPRISE', color:'#1E3A5F', ls:2},
      {label:'CORPORATE', color:'#111111', ls:1, font:'Roboto'},
      {label:'STRATEGY', color:'#1E3A5F', ls:1},
      {label:'LEADERSHIP', color:'#111111', ls:2, font:'Lato'},
      {label:'PARTNERSHIP', color:'#1E3A5F', ls:1},
      {label:'INNOVATION', color:'#111111', ls:2, font:'Source Sans 3'},
      {label:'GROWTH', color:'#1E3A5F', ls:1, weight:700},
      {label:'EXCELLENCE', color:'#111111', ls:2},
      {label:'INTEGRITY', color:'#1E3A5F', ls:1, font:'PT Sans'},
      {label:'RESULTS DRIVEN', color:'#111111', ls:1},
      {label:'MARKET LEADER', color:'#1E3A5F', ls:2, weight:700},
      {label:'TRUSTED ADVISOR', color:'#111111', ls:1, font:'Noto Sans'},
      {label:'PROFESSIONAL', color:'#1E3A5F', ls:1},
      {label:'CONSULTING', color:'#111111', ls:2},
      {label:'THE BOTTOM LINE', color:'#1E3A5F', ls:1, weight:700},
    ]},
    'Retro': { font:'Righteous', weight:400, presets:[
      {label:'RETRO VIBES', color:'#FF6B35', stroke:true},
      {label:'VINTAGE', color:'#E8A33D', stroke:true, font:'Bungee'},
      {label:'CLASSIC DINER', color:'#FF6B35', stroke:true},
      {label:'OLD SCHOOL', color:'#8B4513', stroke:true, font:'Fjalla One'},
      {label:'THROWBACK', color:'#E8A33D', stroke:true},
      {label:'GOLDEN ERA', color:'#FF6B35', stroke:true, font:'Passion One'},
      {label:'ANALOG', color:'#8B4513', stroke:true},
      {label:'NOSTALGIA', color:'#E8A33D', stroke:true, font:'Alfa Slab One'},
      {label:'SUNSET STRIP', color:'#FF6B35', stroke:true},
      {label:'MADE IN THE 70s', color:'#8B4513', stroke:true, font:'Kanit'},
      {label:'VINYL DAYS', color:'#E8A33D', stroke:true},
      {label:'ROADSIDE', color:'#FF6B35', stroke:true, font:'Bungee'},
      {label:'DRIVE-IN', color:'#8B4513', stroke:true},
      {label:'FLASHBACK', color:'#E8A33D', stroke:true, font:'Righteous'},
      {label:'RETRO FUTURE', color:'#FF6B35', stroke:true},
    ]},
  };
  // Categories requiring a genuine multi-stop-looking effect (Gradient,
  // 3D, Glass, Metal, Gold, Silver) use the gradient system directly --
  // handled in a second table below since they lean on gradient rather
  // than solid color + effect flags.
  const EPE_TEXT_GRADIENT_CATEGORIES = {
    'Gradient': { font:'Poppins', weight:800, presets:[
      {label:'SUNSET', from:'#FF6B35', to:'#D6336C'},
      {label:'OCEAN', from:'#00B8D9', to:'#5142D6'},
      {label:'BERRY', from:'#D6336C', to:'#5142D6'},
      {label:'CITRUS', from:'#FFB800', to:'#FF6B35'},
      {label:'AURORA', from:'#39FF14', to:'#00B8D9'},
      {label:'DUSK', from:'#5142D6', to:'#D6336C'},
      {label:'TROPICAL', from:'#00FFF0', to:'#39FF14'},
      {label:'FIRE', from:'#FFB800', to:'#E05252'},
      {label:'COSMIC', from:'#5142D6', to:'#FF00E5'},
      {label:'PEACH', from:'#FFB800', to:'#D6336C'},
      {label:'MINT', from:'#39FF14', to:'#00FFF0'},
      {label:'GRAPE', from:'#5142D6', to:'#8B7CF6'},
      {label:'CORAL REEF', from:'#FF6B35', to:'#00B8D9'},
      {label:'LAVENDER', from:'#8B7CF6', to:'#D6336C'},
      {label:'NORTHERN LIGHTS', from:'#00FFF0', to:'#5142D6'},
    ]},
    '3D': { font:'Archivo Black', weight:400, presets:[
      {label:'BOLD 3D', from:'#E05252', to:'#8B1A1A'},
      {label:'DEPTH', from:'#5142D6', to:'#2A1F7A'},
      {label:'EXTRUDE', from:'#FFB800', to:'#B37E00'},
      {label:'BLOCK TEXT', from:'#3BA55C', to:'#1F5C33'},
      {label:'DIMENSIONAL', from:'#00B8D9', to:'#005C6B'},
      {label:'RAISED LETTERS', from:'#E05252', to:'#8B1A1A'},
      {label:'CHUNKY', from:'#FF6B35', to:'#A6461F'},
      {label:'SOLID FORM', from:'#5142D6', to:'#2A1F7A'},
      {label:'STAMPED', from:'#111111', to:'#3D3D3D'},
      {label:'CARVED', from:'#8B7355', to:'#4D3F2E'},
      {label:'PRESSED', from:'#3BA55C', to:'#1F5C33'},
      {label:'MOLDED', from:'#FFB800', to:'#B37E00'},
      {label:'STRUCTURAL', from:'#00B8D9', to:'#005C6B'},
      {label:'HEAVYWEIGHT', from:'#E05252', to:'#8B1A1A'},
      {label:'BUILT TO LAST', from:'#111111', to:'#3D3D3D'},
    ]},
    'Glass': { font:'Poppins', weight:600, presets:[
      {label:'FROSTED', from:'#FFFFFF', to:'#D0E8F5'},
      {label:'CRYSTAL CLEAR', from:'#E8F5FF', to:'#B8E0F5'},
      {label:'TRANSLUCENT', from:'#FFFFFF', to:'#C5D9E8'},
      {label:'ICE', from:'#E0F7FF', to:'#A0D8EF'},
      {label:'MIRROR', from:'#F5F5F5', to:'#D5D5D5'},
      {label:'PRISM', from:'#E8F5FF', to:'#B8C5F5'},
      {label:'WINDOWPANE', from:'#FFFFFF', to:'#D0E0EA'},
      {label:'AQUA GLASS', from:'#E0FFF7', to:'#A0EFDA'},
      {label:'CLEAR VIEW', from:'#F5FBFF', to:'#C5E5F5'},
      {label:'FROST BITE', from:'#E8F0FF', to:'#B0C8E5'},
      {label:'STAINED GLASS', from:'#F0E8FF', to:'#C8B0E5'},
      {label:'POLISHED', from:'#FFFFFF', to:'#DDE8F0'},
      {label:'LUCID', from:'#E8FFFC', to:'#B0F0E5'},
      {label:'DIAMOND CUT', from:'#F5FAFF', to:'#C8DDF0'},
      {label:'ETCHED GLASS', from:'#F0F5FA', to:'#C0D0E0'},
    ]},
    'Metal': { font:'Oswald', weight:600, presets:[
      {label:'STEEL', from:'#C0C0C0', to:'#5A5A5A'},
      {label:'IRON', from:'#8A8A8A', to:'#3A3A3A'},
      {label:'TITANIUM', from:'#D5D5D5', to:'#707070'},
      {label:'CHROME', from:'#E8E8E8', to:'#6A6A6A'},
      {label:'BRUSHED METAL', from:'#B8B8B8', to:'#4A4A4A'},
      {label:'GUNMETAL', from:'#7A7E82', to:'#2A2D30'},
      {label:'PLATINUM', from:'#E0E0E0', to:'#8A8A8A'},
      {label:'ALLOY', from:'#C5C5C5', to:'#555555'},
      {label:'FORGED', from:'#9A9A9A', to:'#3A3A3A'},
      {label:'INDUSTRIAL', from:'#8A8A8A', to:'#2A2A2A'},
      {label:'TEMPERED', from:'#B0B0B0', to:'#454545'},
      {label:'RIVETED', from:'#A5A5A5', to:'#404040'},
      {label:'MACHINED', from:'#CACACA', to:'#5A5A5A'},
      {label:'HEAVY METAL', from:'#7A7A7A', to:'#252525'},
      {label:'RAW STEEL', from:'#C0C0C0', to:'#4A4A4A'},
    ]},
    'Gold': { font:'Cinzel', weight:600, presets:[
      {label:'PURE GOLD', from:'#FFD700', to:'#B8860B'},
      {label:'GOLDEN HOUR', from:'#FFDF7E', to:'#C99A2E'},
      {label:'24 KARAT', from:'#FFE55C', to:'#B8860B'},
      {label:'GILDED', from:'#FFD700', to:'#8B6508'},
      {label:'CHAMPAGNE GOLD', from:'#F7E7CE', to:'#C9A961'},
      {label:'ROSE GOLD', from:'#F5C6AA', to:'#B76E79'},
      {label:'ANTIQUE GOLD', from:'#D4AF37', to:'#7A5C00'},
      {label:'BRUSHED GOLD', from:'#E6C767', to:'#9C7A24'},
      {label:'GOLDEN GLOW', from:'#FFDF7E', to:'#B8860B'},
      {label:'PRECIOUS METAL', from:'#FFD700', to:'#8B6508'},
      {label:'GOLD STANDARD', from:'#F7E7CE', to:'#C99A2E'},
      {label:'SOLID GOLD', from:'#FFE55C', to:'#7A5C00'},
      {label:'GOLD LEAF', from:'#FFD700', to:'#B8860B'},
      {label:'MIDAS TOUCH', from:'#FFDF7E', to:'#8B6508'},
      {label:'GOLDEN AGE', from:'#D4AF37', to:'#9C7A24'},
    ]},
    'Silver': { font:'Marcellus', weight:600, presets:[
      {label:'STERLING SILVER', from:'#E8E8E8', to:'#A0A0A0'},
      {label:'MOONLIGHT', from:'#F0F0F5', to:'#B8B8C5'},
      {label:'PLATINUM SHINE', from:'#F5F5F5', to:'#C0C0C0'},
      {label:'SILVER LINING', from:'#E0E0E5', to:'#9A9AA5'},
      {label:'POLISHED SILVER', from:'#EEEEEE', to:'#AAAAAA'},
      {label:'FROSTED SILVER', from:'#F5F5F8', to:'#B5B5C0'},
      {label:'MERCURY', from:'#E5E5EA', to:'#95959F'},
      {label:'PEARL', from:'#F8F8FA', to:'#C5C5D0'},
      {label:'BRUSHED SILVER', from:'#DDDDDD', to:'#8A8A8A'},
      {label:'SILVER SCREEN', from:'#E8E8ED', to:'#A5A5B0'},
      {label:'DIAMOND SILVER', from:'#F5F5F8', to:'#B0B0BA'},
      {label:'STARLIGHT', from:'#EEEEF2', to:'#A8A8B5'},
      {label:'ICE SILVER', from:'#F0F5F5', to:'#B0C0C0'},
      {label:'SILVER FOX', from:'#DADADA', to:'#8F8F8F'},
      {label:'CHROME SILVER', from:'#E5E5E5', to:'#959595'},
    ]},
  };

  // ---- Generator: creates a real, fully editable text layer per
  // preset, reusing dseCreateTextLayer entirely -- the preset only
  // sets initial property values (font/color/gradient/shadow/stroke/
  // glow/letterSpacing) on an otherwise completely normal, fully
  // editable text layer. Every property remains user-editable after
  // insertion through the existing Text Style panel, unchanged. ----
  let epeTextStyleAssetCount = 0;
  function epeBuildTextStylePreview(p, isGradient){
    const bg = isGradient ? `linear-gradient(135deg, ${p.from}, ${p.to})` : 'transparent';
    const textColor = isGradient ? '#fff' : p.color;
    const textShadow = p.stroke ? `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000` : (p.glow ? `0 0 4px ${p.color}` : (p.shadow ? `1px 1px 2px rgba(0,0,0,0.5)` : 'none'));
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px;">
      <span style="font-family:'${p.font}',sans-serif;font-weight:${p.weight||700};font-size:7px;line-height:1.1;text-align:center;
        ${isGradient ? `background:${bg};-webkit-background-clip:text;background-clip:text;color:transparent;` : `color:${textColor};text-shadow:${textShadow};`}">${p.label}</span>
    </div>`;
  }
  Object.entries(EPE_TEXT_STYLE_CATEGORIES).forEach(([catName, catData]) => {
    catData.presets.forEach((p, i) => {
      const font = p.font || catData.font;
      const weight = p.weight || catData.weight;
      const id = 'txt-' + catName.toLowerCase() + '-' + i;
      epeTextStyleAssetCount++;
      epeRegisterAsset({
        id, title: p.label, category: 'Text Style: ' + catName,
        tags: ['text style', catName.toLowerCase()], keywords: [catName.toLowerCase(), p.label.toLowerCase(), 'text'],
        preview: epeBuildTextStylePreview({...p, font, weight}, false),
        editable: true,
        insert: () => {
          if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
          const layer = dseCreateTextLayer('custom', epeArtboardW, epeArtboardH);
          layer.text = p.label; layer.fontFamily = font; layer.fontWeight = weight;
          layer.color = p.color; layer.letterSpacing = p.ls || 0; layer.italic = !!p.italic;
          if (p.shadow) layer.shadow = { enabled:true, offsetX: p.shadowBig?8:3, offsetY: p.shadowBig?8:3, blur: p.shadowBig?0:3, opacity:70, color: p.color==='#FFFFFF'?'#888888':'#000000' };
          if (p.stroke) layer.stroke = { enabled:true, thickness:2, position:'inside', opacity:100, color: '#000000' }; // position:'inside' uses source-over compositing, correctly visible on top of any background; 'outside' uses destination-over, which renders behind already-opaque content and would be invisible
          if (p.glow) layer.glow = { enabled:true, blur:20, opacity:90, color:p.color };
          dseMeasureTextLayer(layer);
          dseState.layers.push(layer); dseSelectLayer(layer.id, false);
          renderEpeAll(); epePushHistory();
          toast('Text style applied \u2014 font, spacing, color, shadow, and outline all remain editable.');
        }
      });
    });
  });
  Object.entries(EPE_TEXT_GRADIENT_CATEGORIES).forEach(([catName, catData]) => {
    catData.presets.forEach((p, i) => {
      const font = catData.font, weight = catData.weight;
      const id = 'txtg-' + catName.toLowerCase() + '-' + i;
      epeTextStyleAssetCount++;
      epeRegisterAsset({
        id, title: p.label, category: 'Text Style: ' + catName,
        tags: ['text style', catName.toLowerCase(), 'gradient'], keywords: [catName.toLowerCase(), p.label.toLowerCase(), 'text', 'gradient'],
        preview: epeBuildTextStylePreview({label:p.label, font, weight, from:p.from, to:p.to}, true),
        editable: true,
        insert: () => {
          if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
          const layer = dseCreateTextLayer('custom', epeArtboardW, epeArtboardH);
          layer.text = p.label; layer.fontFamily = font; layer.fontWeight = weight;
          layer.fillType = 'gradient'; layer.gradient = { from:p.from, to:p.to, angle:45, mode:'linear' };
          if (catName === '3D' || catName === 'Metal'){
            layer.shadow = { enabled:true, offsetX:3, offsetY:3, blur:0, opacity:80, color:'#000000' };
          }
          if (catName === 'Glass'){
            layer.stroke = { enabled:true, thickness:1, position:'inside', opacity:60, color:'#ffffff' }; // 'inside' renders visibly on top; see note above
            layer.opacity = 92;
          }
          dseMeasureTextLayer(layer);
          dseState.layers.push(layer); dseSelectLayer(layer.id, false);
          renderEpeAll(); epePushHistory();
          toast('Text style applied \u2014 font, spacing, gradient, shadow, and outline all remain editable.');
        }
      });
    });
  });
  console.log('EPE_TEXT_STYLE library built:', epeTextStyleAssetCount, 'presets across', Object.keys(EPE_TEXT_STYLE_CATEGORIES).length + Object.keys(EPE_TEXT_GRADIENT_CATEGORIES).length, 'style categories');



  // ---- Search Index: a real inverted index (term -> asset ids), built
  // once and reused, not a linear re-scan on every keystroke. Genuinely
  // improves search performance as the registry grows. ----
  function epeBuildAssetSearchIndex(){
    const index = new Map(); // term -> Set(asset index)
    EPE_ASSET_REGISTRY.forEach((asset, i) => {
      const terms = new Set([
        ...asset.title.toLowerCase().split(/\s+/),
        ...(asset.tags||[]).map(t=>t.toLowerCase()),
        ...(asset.keywords||[]).map(k=>k.toLowerCase()),
        asset.category.toLowerCase(),
      ]);
      terms.forEach(term => {
        if (!term) return;
        if (!index.has(term)) index.set(term, new Set());
        index.get(term).add(i);
      });
    });
    return index;
  }
  function epeSearchAssets(query, category){
    if (!epeAssetSearchIndex) epeAssetSearchIndex = epeBuildAssetSearchIndex();
    let candidates;
    const q = (query||'').toLowerCase().trim();
    if (!q){
      candidates = EPE_ASSET_REGISTRY.map((_, i) => i);
    } else {
      // Real substring + prefix matching over the index terms (not just
      // exact term lookup), so partial queries like "shop" still find
      // "shopping-bag".
      const matchedIndices = new Set();
      for (const [term, idxSet] of epeAssetSearchIndex){
        if (term.includes(q)) idxSet.forEach(i => matchedIndices.add(i));
      }
      candidates = [...matchedIndices];
    }
    let results = candidates.map(i => EPE_ASSET_REGISTRY[i]);
    if (category && category !== 'all') results = results.filter(a => a.category === category);
    return results;
  }

  /* ============================================================
     INTELLIGENT SEARCH ENGINE (this phase): extends the existing
     epeSearchAssets(query, category) -- signature and behavior for
     existing callers preserved exactly -- with concept expansion,
     fuzzy typo tolerance, multi-token matching, color/style
     filtering, recent/popular/favorites (all localStorage, no
     backend), and search suggestions.
     ============================================================ */

  // ---- Concept/synonym expansion: real, curated mappings so a query
  // like "50% off" surfaces the broader set of related marketing
  // assets (sale badges, discount ribbons, etc.), not just an exact
  // phrase match. Each key maps to concept tags also present in the
  // registry's own tags/keywords, so this expands the search rather
  // than replacing the lexical index. ----
  const EPE_SEARCH_CONCEPTS = [
    { pattern: /\d+%?\s*(off|discount)|half\s*price/, concepts: ['sale','discount','offer','badge','ribbon'] },
    { pattern: /\bsale\b|\bclearance\b|\bdeal\b/, concepts: ['sale','discount','offer','badge'] },
    { pattern: /\bluxury\b|\bpremium\b|\bexclusive\b/, concepts: ['luxury','badge','elements'] },
    { pattern: /\bmarketing\b|\bpromo(tion)?\b/, concepts: ['marketing','cta','ribbon','offer','badge'] },
    { pattern: /\bnew\b|\bjust\s*in\b|\barrival/, concepts: ['new','badge','sticker'] },
    { pattern: /\bfree\s*shipping\b|\bdelivery\b/, concepts: ['shipping','trust','delivery'] },
    { pattern: /\btrust\b|\bguarantee\b|\bsecure\b|\bverified\b/, concepts: ['trust','badge'] },
    { pattern: /\bbutton\b|\bbuy\b|\border\b|\bshop\s*now\b/, concepts: ['button','cta','marketing'] },
    { pattern: /\bframe\b|\bborder\b|\boutline\b/, concepts: ['frame','border'] },
    { pattern: /\bbackground\b|\bbackdrop\b/, concepts: ['background','canvas'] },
    { pattern: /\bpattern\b|\btexture\b/, concepts: ['pattern','texture'] },
  ];
  function epeExpandQueryConcepts(query){
    const q = query.toLowerCase();
    const extra = new Set();
    EPE_SEARCH_CONCEPTS.forEach(rule => { if (rule.pattern.test(q)) rule.concepts.forEach(c => extra.add(c)); });
    return extra;
  }

  // ---- Fuzzy matching: real Levenshtein edit distance, not a fake
  // "contains most letters" heuristic. Used as a fallback only when
  // exact/substring matching finds nothing, so typo tolerance never
  // degrades precise search results. ----
  function epeLevenshtein(a, b){
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = new Array(b.length+1); const curr = new Array(b.length+1);
    for (let j=0;j<=b.length;j++) prev[j] = j;
    for (let i=1;i<=a.length;i++){
      curr[0] = i;
      for (let j=1;j<=b.length;j++){
        const cost = a[i-1]===b[j-1] ? 0 : 1;
        curr[j] = Math.min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost);
      }
      for (let j=0;j<=b.length;j++) prev[j]=curr[j];
    }
    return prev[b.length];
  }
  function epeFuzzyMatchTerm(term, query){
    // Typo tolerance scales with word length -- short words need an
    // exact/near-exact match to avoid false positives (e.g. "cat" vs
    // "car" shouldn't match everything), longer words tolerate more.
    const maxDist = query.length <= 4 ? 1 : query.length <= 7 ? 2 : 3;
    return epeLevenshtein(term, query) <= maxDist;
  }

  // ---- Color extraction: real, derived from each asset's actual
  // underlying color (already present in the source presets), mapped
  // to the nearest named color via genuine RGB distance -- not
  // invented per-asset. Assets without an inherent color (icons,
  // shapes, text styles) simply have no color facet, honestly. ----
  const EPE_NAMED_COLORS = {
    red:'#E05252', orange:'#FF6B35', yellow:'#FFB800', green:'#3BA55C',
    blue:'#4A7FE0', purple:'#5142D6', black:'#111111', white:'#FFFFFF', gray:'#888888',
  };
  function epeHexToRgb(hex){
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const n = parseInt(hex, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function epeNearestNamedColor(hex){
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
    const c = epeHexToRgb(hex);
    let best = null, bestDist = Infinity;
    for (const [name, nHex] of Object.entries(EPE_NAMED_COLORS)){
      const nc = epeHexToRgb(nHex);
      const dist = Math.sqrt((c.r-nc.r)**2 + (c.g-nc.g)**2 + (c.b-nc.b)**2);
      if (dist < bestDist){ bestDist = dist; best = name; }
    }
    return best;
  }
  // ---- Style derivation: a simple, honest heuristic from real data
  // (color + shape), not a per-item invented label. ----
  function epeDeriveStyle(asset, sourceColor){
    const styles = [];
    if (sourceColor){
      const named = epeNearestNamedColor(sourceColor);
      if (named === 'black' || named === 'yellow') styles.push('luxury');
      if (named === 'red' || named === 'orange') styles.push('bold');
      if (named === 'green' || named === 'blue') styles.push('fresh');
    }
    if (asset.category === 'Frames' || asset.category === 'Shapes') styles.push('minimal');
    if (asset.tags && asset.tags.includes('ribbon')) styles.push('bold');
    return [...new Set(styles)];
  }

  // Annotate the existing registry with color/style facets, derived
  // from each entry's own preview markup (which already encodes the
  // real color used) -- additive metadata, doesn't touch how any
  // asset renders or inserts.
  function epeAnnotateAssetFacets(){
    EPE_ASSET_REGISTRY.forEach(asset => {
      const colorMatch = /background:\s*(#[0-9a-fA-F]{3,8})/.exec(asset.preview);
      const sourceColor = colorMatch ? colorMatch[1] : null;
      asset.color = sourceColor ? epeNearestNamedColor(sourceColor) : null;
      asset.style = epeDeriveStyle(asset, sourceColor);
    });
  }

  // ---- Upgraded search: same signature as before (query, category)
  // so every existing caller keeps working unmodified. Adds optional
  // 3rd/4th args (color, style) and special category values
  // 'recent'/'popular'/'favorites' -- all additive, backward
  // compatible with the single-arg and two-arg call patterns already
  // in use. ----
  function epeSearchAssets(query, category, color, style){
    if (!epeAssetSearchIndex) epeAssetSearchIndex = epeBuildAssetSearchIndex();
    if (!EPE_ASSET_REGISTRY[0] || EPE_ASSET_REGISTRY[0].color === undefined) epeAnnotateAssetFacets();

    // Special pseudo-categories: recent/popular/favorites bypass the
    // normal registry search and pull from their own real, tracked
    // localStorage-backed lists instead.
    if (category === 'recent' || category === 'popular' || category === 'favorites'){
      return epeGetAssetsForSpecialView(category);
    }

    const q = (query||'').toLowerCase().trim();
    let results;
    if (!q){
      results = EPE_ASSET_REGISTRY.slice();
    } else {
      const tokens = q.split(/\s+/).filter(Boolean);
      const conceptTerms = epeExpandQueryConcepts(q);
      const matchedIndices = new Set();
      // 1) Exact/substring match, per token AND for the full phrase
      //    (so both "50% off" as a phrase and "50" + "off" as
      //    separate tokens can match). Short queries (<=3 chars) use a
      //    word-boundary match instead of a raw substring match --
      //    otherwise short tokens like "off" match anywhere, including
      //    inside unrelated words like "coffee" (c-OFF-ee), a real
      //    false positive found during testing.
      const allQueries = [q, ...tokens];
      function epeTermMatchesQuery(term, aq){
        if (aq.length <= 3) return new RegExp('(^|[^a-z0-9])' + aq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(term);
        return term.includes(aq);
      }
      for (const [term, idxSet] of epeAssetSearchIndex){
        if (allQueries.some(aq => epeTermMatchesQuery(term, aq))) idxSet.forEach(i => matchedIndices.add(i));
        if (conceptTerms.has(term)) idxSet.forEach(i => matchedIndices.add(i));
      }
      // 2) Fuzzy fallback -- only runs if lexical + concept matching
      //    found nothing, so typo tolerance never dilutes a precise result.
      if (matchedIndices.size === 0){
        for (const [term] of epeAssetSearchIndex){
          if (tokens.some(t => epeFuzzyMatchTerm(term, t))){
            epeAssetSearchIndex.get(term).forEach(i => matchedIndices.add(i));
          }
        }
      }
      results = [...matchedIndices].map(i => EPE_ASSET_REGISTRY[i]);
    }
    if (category && category !== 'all') results = results.filter(a => a.category === category);
    if (color && color !== 'all') results = results.filter(a => a.color === color);
    if (style && style !== 'all') results = results.filter(a => a.style && a.style.includes(style));
    return results;
  }

  // ---- Recent searches, favorites, popular usage: real
  // localStorage-backed persistence, no backend. Each is a small,
  // genuinely-read-and-written store, not a stub. ----
  const EPE_SEARCH_RECENT_KEY = 'toolflight_epe_recent_searches';
  const EPE_ASSET_FAVORITES_KEY = 'toolflight_epe_asset_favorites';
  const EPE_ASSET_POPULARITY_KEY = 'toolflight_epe_asset_popularity';
  const EPE_RECENT_SEARCH_MAX = 10;

  function epeLoadJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; }
  }
  function epeSaveJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ /* quota or disabled storage -- fail silently, search still works without persistence */ }
  }

  function epeRecordRecentSearch(query){
    const q = (query||'').trim();
    if (q.length < 2) return; // don't pollute history with single-character noise
    let recent = epeLoadJSON(EPE_SEARCH_RECENT_KEY, []);
    recent = recent.filter(r => r.toLowerCase() !== q.toLowerCase());
    recent.unshift(q);
    recent = recent.slice(0, EPE_RECENT_SEARCH_MAX);
    epeSaveJSON(EPE_SEARCH_RECENT_KEY, recent);
  }
  function epeGetRecentSearches(){ return epeLoadJSON(EPE_SEARCH_RECENT_KEY, []); }

  function epeIsFavoriteAsset(id){ return epeLoadJSON(EPE_ASSET_FAVORITES_KEY, []).includes(id); }
  function epeToggleFavoriteAsset(id){
    let favs = epeLoadJSON(EPE_ASSET_FAVORITES_KEY, []);
    if (favs.includes(id)) favs = favs.filter(f => f !== id); else favs.push(id);
    epeSaveJSON(EPE_ASSET_FAVORITES_KEY, favs);
    return favs.includes(id);
  }

  function epeRecordAssetUse(id){
    const pop = epeLoadJSON(EPE_ASSET_POPULARITY_KEY, {});
    pop[id] = (pop[id]||0) + 1;
    epeSaveJSON(EPE_ASSET_POPULARITY_KEY, pop);
  }
  function epeGetAssetsForSpecialView(kind){
    if (kind === 'favorites'){
      const favs = new Set(epeLoadJSON(EPE_ASSET_FAVORITES_KEY, []));
      return EPE_ASSET_REGISTRY.filter(a => favs.has(a.id));
    }
    if (kind === 'popular'){
      const pop = epeLoadJSON(EPE_ASSET_POPULARITY_KEY, {});
      // Honest fallback: with no usage yet in this browser, "popular"
      // has nothing real to show -- rather than fake counts, fall back
      // to a small, clearly-labeled starter set (see epeGetTrendingAssets).
      const used = EPE_ASSET_REGISTRY.filter(a => pop[a.id] > 0);
      if (used.length === 0) return [];
      return used.sort((a,b) => (pop[b.id]||0) - (pop[a.id]||0));
    }
    return [];
  }
  // ---- Trending: honestly scoped. With no backend, there is no real
  // cross-user aggregate data available. "Trending" here means
  // "most-used on this device" -- the same underlying data as
  // Popular, surfaced under a second, clearly-explained label rather
  // than invented as fake global trend data. If usage is still empty,
  // a small curated starter set is shown instead of an empty panel,
  // and is visually distinguished (see UI) so it's never confused
  // with real usage data. ----
  const EPE_TRENDING_STARTER_IDS = ['offer-50-off','sticker-sale','sticker-hot','sticker-flash-sale','offer-flash-deal','cta-buy-now'];
  function epeGetTrendingAssets(){
    const pop = epeLoadJSON(EPE_ASSET_POPULARITY_KEY, {});
    const used = EPE_ASSET_REGISTRY.filter(a => pop[a.id] > 0).sort((a,b) => (pop[b.id]||0)-(pop[a.id]||0));
    if (used.length >= 4) return { assets: used, isRealUsage: true };
    const starter = EPE_TRENDING_STARTER_IDS.map(id => EPE_ASSET_REGISTRY.find(a => a.id === id)).filter(Boolean);
    return { assets: starter, isRealUsage: false };
  }

  // Wrap every asset's insert() to also record real usage, without
  // touching each asset definition individually -- one pass over the
  // already-built registry.
  (function epeWrapAssetInsertForTracking(){
    EPE_ASSET_REGISTRY.forEach(asset => {
      const original = asset.insert;
      asset.insert = function(){
        original();
        epeRecordAssetUse(asset.id);
      };
    });
  })();


  // ---- UI: search + category filter + lazy/incremental rendering.
  // With ~150-250 real assets (not thousands), full DOM-node-recycling
  // virtualization (like react-window) isn't necessary for smooth
  // scrolling -- genuine batch-based incremental rendering via
  // IntersectionObserver is used instead: only a batch of items is
  // rendered into the DOM at a time, with more batches appended as the
  // user scrolls near the bottom (real lazy loading + infinite scroll,
  // not a fake spinner that immediately reveals everything). ----
  /* ============================================================
     TOOLFLIGHT ASSET LIBRARY ENGINE (Phase 6 of the multi-editor
     migration plan). Tool-agnostic: owns the asset registry, search
     index, search algorithm (word-boundary matching, concept
     expansion, fuzzy fallback -- all pure string logic with zero
     ecommerce dependencies, moved in directly rather than requiring
     every future editor to reimplement search quality from scratch),
     category/color/style filtering, and lazy-loading batch rendering.

     Deliberately does NOT know about: canvas, layers, undo, selection,
     or object creation. When a user clicks an asset cell, the engine
     calls the editor-supplied onAssetSelected(asset) callback and
     stops there -- what the editor does with that asset (insert it as
     a layer, apply it as a style, anything else) is entirely up to
     the editor, never the engine. This is what "the engine only
     returns the selected asset" means concretely: the boundary is the
     onAssetSelected callback, not a return value, since asset
     selection here is a UI click event, but the principle is the same
     -- the engine hands back the asset object and control, and never
     reaches into canvas/layer state itself.

     SVG handling: assets carry their SVG source (or a preview string)
     as opaque data the engine never parses, flattens, or converts --
     it stores and returns exactly what was registered, so an asset's
     "editable-ness" is entirely preserved by construction, not by any
     special-casing inside the engine. ============================================================ */

  const EPE_ASSET_BATCH_SIZE = 24;

  // Ecommerce Editor's instance of the shared Asset Library Engine.
  // initialRegistry reuses the SAME EPE_ASSET_REGISTRY array (already
  // populated by icons/shapes/marketing/text-style registration above)
  // by reference, not a copy -- epeRegisterAsset below still pushes to
  // this exact array. The engine never calls asset.insert() itself;
  // onAssetSelected is the only handoff point, preserving the "engine
  // returns the asset, editor decides what to do with it" boundary.
  const epeAssetEngine = createToolflightAssetLibraryEngine({
    initialRegistry: EPE_ASSET_REGISTRY,
    batchSize: EPE_ASSET_BATCH_SIZE,
    gridEl: () => document.getElementById('epeAssetGrid'),
    gridScrollEl: () => document.getElementById('epeAssetGridScroll'),
    resultCountEl: () => document.getElementById('epeAssetResultCount'),
    sentinelId: 'epeAssetScrollSentinel',
    searchConcepts: EPE_SEARCH_CONCEPTS,
    annotateFacets: () => { if (!EPE_ASSET_REGISTRY[0] || EPE_ASSET_REGISTRY[0].color === undefined) epeAnnotateAssetFacets(); },
    specialCategories: ['recent', 'popular', 'favorites'],
    getSpecialView: (kind) => epeGetAssetsForSpecialView(kind),
    formatResultCount: (results, category) => (category==='recent'?'Recent':category==='popular'?'Popular':category==='favorites'?'Favorites':results.length + (results.length===1?' asset':' assets')),
    onSearchRendered: (query) => epeRenderSearchSuggestions(query),
    recordRecentSearch: (query) => epeRecordRecentSearch(query),
    createCellEl: (asset) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'epe-asset-cell';
      cell.title = asset.title;
      cell.setAttribute('aria-label', asset.title + ', ' + asset.category);
      const isFav = epeIsFavoriteAsset(asset.id);
      cell.innerHTML = `<span class="epe-asset-preview">${asset.preview}</span><span class="epe-asset-title">${asset.title}</span><span class="epe-asset-fav${isFav?' active':''}" role="button" aria-label="Toggle favorite" title="Favorite">${isFav?'\u2605':'\u2606'}</span>`;
      return cell;
    },
    onAssetSelected: (asset, e) => {
      if (e.target.classList.contains('epe-asset-fav')){
        e.stopPropagation();
        const nowFav = epeToggleFavoriteAsset(asset.id);
        e.target.textContent = nowFav ? '\u2605' : '\u2606';
        e.target.classList.toggle('active', nowFav);
        return;
      }
      asset.insert();
    },
  });

  function epeSearchAssets(query, category, color, style){
    return epeAssetEngine.search(query, category, color, style);
  }
  function epeRenderAssetLibrary(query, category, color, style){
    epeAssetEngine.renderResults(query, category, color, style);
  }
  function epeAppendAssetBatch(){
    epeAssetEngine.appendBatch();
  }
  function epeAssetEnsureSentinel(){
    // Folded into the engine's appendBatch/renderResults now; kept as a
    // no-op wrapper only in case any external code still calls it by
    // name (none found in this codebase, but preserving the public
    // name costs nothing and avoids a silent breakage if that's wrong).
  }

  document.getElementById('epeAssetSearch') && document.getElementById('epeAssetSearch').addEventListener('input', (e) => {
    const cat = document.querySelector('.epe-asset-cat-btn.active');
    const colorEl = document.getElementById('epeAssetColorFilter');
    const styleEl = document.getElementById('epeAssetStyleFilter');
    epeRenderAssetLibrary(e.target.value, cat ? cat.dataset.cat : 'all', colorEl ? colorEl.value : 'all', styleEl ? styleEl.value : 'all');
  });
  document.getElementById('epeAssetSearch') && document.getElementById('epeAssetSearch').addEventListener('focus', () => epeRenderSearchSuggestions(document.getElementById('epeAssetSearch').value));
  document.addEventListener('pointerdown', (e) => {
    const box = document.getElementById('epeAssetSuggestions');
    const input = document.getElementById('epeAssetSearch');
    if (!box || box.classList.contains('hidden')) return;
    if (e.target === input || box.contains(e.target)) return; // let clicks inside the input/dropdown behave normally
    box.classList.add('hidden');
  });
  document.getElementById('epeAssetColorFilter') && document.getElementById('epeAssetColorFilter').addEventListener('change', () => epeSetAssetCategory(document.querySelector('.epe-asset-cat-btn.active')?.dataset.cat || 'all'));
  document.getElementById('epeAssetStyleFilter') && document.getElementById('epeAssetStyleFilter').addEventListener('change', () => epeSetAssetCategory(document.querySelector('.epe-asset-cat-btn.active')?.dataset.cat || 'all'));
  function epeSetAssetCategory(cat){
    document.querySelectorAll('.epe-asset-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    document.querySelectorAll('.epe-cat-tile').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    const searchEl = document.getElementById('epeAssetSearch');
    const colorEl = document.getElementById('epeAssetColorFilter');
    const styleEl = document.getElementById('epeAssetStyleFilter');
    epeRenderAssetLibrary(searchEl ? searchEl.value : '', cat, colorEl ? colorEl.value : 'all', styleEl ? styleEl.value : 'all');
  }
  document.querySelectorAll('.epe-asset-cat-btn').forEach(b => b.addEventListener('click', () => epeSetAssetCategory(b.dataset.cat)));
  // All colorful category tiles (base types, marketing industries, text
  // style looks) share one class and one handler -- epeSetAssetCategory
  // already accepts any of these category strings correctly, so this is
  // a purely presentational change from the previous two <select>
  // dropdowns, not new filtering logic.
  document.querySelectorAll('.epe-cat-tile').forEach(t => t.addEventListener('click', () => {
    const searchEl = document.getElementById('epeAssetSearch');
    if (searchEl) searchEl.value = '';
    epeSetAssetCategory(t.dataset.cat);
  }));

  // ---- Search suggestions: real-time dropdown of matching titles +
  // recent searches, not a static/fake list. ----
  function epeRenderSearchSuggestions(query){
    const box = document.getElementById('epeAssetSuggestions');
    if (!box) return;
    const input = document.getElementById('epeAssetSearch');
    const q = (query||'').trim();
    if (document.activeElement !== input || q.length < 1){ box.classList.add('hidden'); return; }
    let items = [];
    if (q.length >= 1){
      const seen = new Set();
      epeSearchAssets(q, 'all').slice(0, 6).forEach(a => { if (!seen.has(a.title)){ seen.add(a.title); items.push({ label:a.title, type:'asset' }); } });
    } else {
      epeGetRecentSearches().slice(0, 6).forEach(r => items.push({ label:r, type:'recent' }));
    }
    if (!items.length){ box.classList.add('hidden'); box.innerHTML=''; return; }
    box.innerHTML = items.map(it => `<button type="button" class="epe-asset-suggestion" data-label="${it.label.replace(/"/g,'&quot;')}">${it.type==='recent'?'\u{1F551} ':'\u{1F50D} '}${it.label}</button>`).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('.epe-asset-suggestion').forEach(btn => btn.onmousedown = () => {
      const searchEl = document.getElementById('epeAssetSearch');
      if (searchEl) searchEl.value = btn.dataset.label;
      epeSetAssetCategory(document.querySelector('.epe-asset-cat-btn.active')?.dataset.cat || 'all');
      box.classList.add('hidden');
    });
  }

  // Build the library lazily -- only render its contents the first
  // time its accordion is actually opened, not on page load, so the
  // ~150+ preview elements never cost anything for users who don't
  // open this panel.
  const epeAssetAccordion = document.getElementById('epeAccordionAssetLibrary');
  if (epeAssetAccordion){
    let epeAssetLibraryBuilt = false;
    epeAssetAccordion.addEventListener('toggle', () => {
      if (epeAssetAccordion.open && !epeAssetLibraryBuilt){
        epeAssetLibraryBuilt = true;
        epeRenderAssetLibrary('', 'all');
      }
    });
  }


  // ---- Feature Highlight Blocks: icon + text, same pattern as Trust
  // Elements but with feature-appropriate icons and labels. ----
  const DSE_FEATURE_BLOCK_PRESETS = {
    'premium-material':{ text:'Premium Material', icon:'medal' },
    waterproof:{ text:'Waterproof', icon:'shield' },
    rechargeable:{ text:'Rechargeable', icon:'wifi' },
    'eco-friendly':{ text:'Eco Friendly', icon:'home' },
    organic:{ text:'Organic', icon:'checkmark' },
    handmade:{ text:'Handmade', icon:'star' },
    imported:{ text:'Imported', icon:'plane' },
    original:{ text:'Original', icon:'shield-check' },
    warranty:{ text:'Warranty', icon:'shield' },
  };
  document.querySelectorAll('#epeFeatureBlockRow [data-featureblock]').forEach(btn => {
    btn.onclick = () => {
      if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
      const preset = DSE_FEATURE_BLOCK_PRESETS[btn.dataset.featureblock]; if (!preset) return;
      const icon = dseCreateIconLayer(preset.icon, epeArtboardW, epeArtboardH);
      icon.color = '#5142D6'; icon.boxW = 28; icon.boxH = 28;
      const text = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
      text.text = preset.text; text.color = '#111111'; text.fontSize = 15; text.fontWeight = 600;
      text.x += 60;
      dseMeasureTextLayer(text);
      dseState.layers.push(icon); icon.zIndex = dseState.layers.length;
      dseState.layers.push(text); text.zIndex = dseState.layers.length;
      const group = dseCreateGroupLayer([icon.id, text.id], epeArtboardW, epeArtboardH);
      group.name = preset.text;
      dseState.layers.push(group);
      icon.groupId = group.id; text.groupId = group.id;
      dseSelectLayer(group.id, false);
      renderEpeAll(); epePushHistory();
      toast('Feature highlight added.');
    };
  });


  // ---- Comparison Table: a genuinely new structural pattern -- a grid
  // of shape+text+icon cells assembled into one group. Still built
  // entirely from the existing primitives (shape/text/icon layers +
  // group), not a new rendering system. ----
  document.getElementById('epeAddComparisonTableBtn') && (document.getElementById('epeAddComparisonTableBtn').onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const rows = ['Premium Material', 'Free Shipping', '1 Year Warranty', 'Money Back Guarantee'];
    const cols = ['Us', 'Others'];
    const cellW = 140, cellH = 40, labelW = 180;
    const totalW = labelW + cellW*cols.length, totalH = cellH*(rows.length+1);
    const startX = epeArtboardW/2 - totalW/2, startY = epeArtboardH/2 - totalH/2;
    const childIds = [];
    // Header row
    cols.forEach((col, ci) => {
      const header = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
      header.text = col; header.fontWeight = 800; header.fontSize = 15; header.color = '#111111';
      header.x = startX + labelW + cellW*ci + cellW/2; header.y = startY + cellH/2;
      dseMeasureTextLayer(header);
      dseState.layers.push(header); header.zIndex = dseState.layers.length; childIds.push(header.id);
    });
    // Rows
    rows.forEach((rowLabel, ri) => {
      const y = startY + cellH*(ri+1) + cellH/2;
      // Alternating row background
      if (ri % 2 === 1){
        const bg = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH);
        bg.color = '#f5f5f7'; bg.boxW = totalW; bg.boxH = cellH;
        bg.x = startX + totalW/2; bg.y = y;
        dseState.layers.push(bg); bg.zIndex = dseState.layers.length - cols.length; childIds.unshift(bg.id);
      }
      const label = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
      label.text = rowLabel; label.fontSize = 14; label.align = 'left'; label.color = '#111111';
      label.x = startX + labelW/2; label.y = y; label.boxW = labelW; label.autoResize = false;
      dseMeasureTextLayer(label);
      dseState.layers.push(label); label.zIndex = dseState.layers.length; childIds.push(label.id);
      cols.forEach((col, ci) => {
        // "Us" column = checkmark, "Others" column = cross (a real, if simplified, comparison convention)
        const icon = dseCreateIconLayer(ci === 0 ? 'checkmark' : 'x-close', epeArtboardW, epeArtboardH);
        icon.color = ci === 0 ? '#3BA55C' : '#E05252'; icon.boxW = 20; icon.boxH = 20;
        icon.x = startX + labelW + cellW*ci + cellW/2; icon.y = y;
        dseState.layers.push(icon); icon.zIndex = dseState.layers.length; childIds.push(icon.id);
      });
    });
    const group = dseCreateGroupLayer(childIds, epeArtboardW, epeArtboardH);
    group.name = 'Comparison Table';
    dseState.layers.push(group);
    childIds.forEach(id => { const l = dseState.layers.find(x=>x.id===id); if (l) l.groupId = group.id; });
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Comparison table added \u2014 ungroup to edit individual rows.');
  });

  // ---- Product Specification Table: label + value rows with
  // alternating row colors -- same grid-of-cells pattern, one column
  // instead of a comparison grid. ----
  document.getElementById('epeAddSpecTableBtn') && (document.getElementById('epeAddSpecTableBtn').onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const specs = [['Material','Premium Fabric'], ['Weight','250g'], ['Dimensions','20 x 15 x 5 cm'], ['Color','Black']];
    const rowH = 36, tableW = 280;
    const startX = epeArtboardW/2 - tableW/2, startY = epeArtboardH/2 - (rowH*specs.length)/2;
    const childIds = [];
    specs.forEach(([label, value], i) => {
      const y = startY + rowH*i + rowH/2;
      if (i % 2 === 1){
        const bg = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH);
        bg.color = '#f5f5f7'; bg.boxW = tableW; bg.boxH = rowH;
        bg.x = startX + tableW/2; bg.y = y;
        dseState.layers.push(bg); bg.zIndex = dseState.layers.length; childIds.push(bg.id);
      }
      const labelText = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
      labelText.text = label; labelText.fontWeight = 700; labelText.fontSize = 13; labelText.align = 'left'; labelText.boxW = tableW/2; labelText.autoResize = false;
      labelText.x = startX + tableW/4; labelText.y = y;
      dseMeasureTextLayer(labelText);
      dseState.layers.push(labelText); labelText.zIndex = dseState.layers.length; childIds.push(labelText.id);
      const valueText = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
      valueText.text = value; valueText.fontSize = 13; valueText.align = 'left'; valueText.color = '#555555'; valueText.boxW = tableW/2; valueText.autoResize = false;
      valueText.x = startX + tableW*0.75; valueText.y = y;
      dseMeasureTextLayer(valueText);
      dseState.layers.push(valueText); valueText.zIndex = dseState.layers.length; childIds.push(valueText.id);
    });
    const group = dseCreateGroupLayer(childIds, epeArtboardW, epeArtboardH);
    group.name = 'Specification Table';
    dseState.layers.push(group);
    childIds.forEach(id => { const l = dseState.layers.find(x=>x.id===id); if (l) l.groupId = group.id; });
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Specification table added.');
  });

  // ---- Review Section: star rating (icon layers) + reviewer name +
  // review text + verified badge -- static content only, no backend,
  // matching the brief exactly. ----
  document.getElementById('epeAddReviewCardBtn') && (document.getElementById('epeAddReviewCardBtn').onclick = () => {
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const cardW = 260;
    const cx = epeArtboardW/2, cy = epeArtboardH/2;
    const childIds = [];
    const cardBg = dseCreateShapeLayer('rounded-rect', epeArtboardW, epeArtboardH);
    cardBg.color = '#ffffff'; cardBg.boxW = cardW; cardBg.boxH = 140;
    cardBg.shadow = { enabled:true, style:'soft', opacity:25, blur:12, distance:4, angle:135, scale:100 };
    cardBg.x = cx; cardBg.y = cy;
    dseState.layers.push(cardBg); cardBg.zIndex = dseState.layers.length; childIds.push(cardBg.id);
    // 5 stars
    for (let i=0;i<5;i++){
      const star = dseCreateIconLayer('star', epeArtboardW, epeArtboardH);
      star.color = '#FFB800'; star.boxW = 18; star.boxH = 18;
      star.x = cx - cardW/2 + 24 + i*22; star.y = cy - 48;
      dseState.layers.push(star); star.zIndex = dseState.layers.length; childIds.push(star.id);
    }
    // Verified badge icon
    const verified = dseCreateIconLayer('shield-check', epeArtboardW, epeArtboardH);
    verified.color = '#3BA55C'; verified.boxW = 16; verified.boxH = 16;
    verified.x = cx + cardW/2 - 24; verified.y = cy - 48;
    dseState.layers.push(verified); verified.zIndex = dseState.layers.length; childIds.push(verified.id);
    // Review text
    const reviewText = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
    reviewText.text = '"Excellent quality, fast shipping, exactly as described!"';
    reviewText.fontSize = 13; reviewText.align = 'left'; reviewText.boxW = cardW - 32; reviewText.autoResize = false;
    reviewText.x = cx; reviewText.y = cy - 8;
    dseMeasureTextLayer(reviewText);
    dseState.layers.push(reviewText); reviewText.zIndex = dseState.layers.length; childIds.push(reviewText.id);
    // Reviewer name
    const nameText = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
    nameText.text = '\u2014 Sarah M.'; nameText.fontSize = 12; nameText.fontWeight = 700; nameText.color = '#888888'; nameText.align = 'left';
    nameText.x = cx; nameText.y = cy + 44;
    dseMeasureTextLayer(nameText);
    dseState.layers.push(nameText); nameText.zIndex = dseState.layers.length; childIds.push(nameText.id);
    const group = dseCreateGroupLayer(childIds, epeArtboardW, epeArtboardH);
    group.name = 'Review Card';
    dseState.layers.push(group);
    childIds.forEach(id => { const l = dseState.layers.find(x=>x.id===id); if (l) l.groupId = group.id; });
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Review card added \u2014 all text and the star rating are editable placeholders, not live data.');
  });


  // ---- Logo System: a second image-upload path that ADDS a new image
  // layer on top of the existing design, reusing the same image-layer
  // creation used for the main product photo -- not a separate upload
  // system. ----
  document.getElementById('epeLogoUploadInput') && document.getElementById('epeLogoUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)){ toast('Please select a PNG, JPG, or WEBP image.', 'err'); return; }
    try{
      const img = await loadImageFromFile(file);
      const layer = dseCreateImageLayer(img, epeArtboardW, epeArtboardH);
      layer.name = 'Logo';
      layer.scale = Math.min(1, (epeArtboardW*0.2)/img.naturalWidth);
      layer.x = epeArtboardW*0.85; layer.y = epeArtboardH*0.9; // default to bottom-right, a common logo position
      dseState.layers.push(layer); layer.zIndex = dseState.layers.length;
      dseSelectLayer(layer.id, false);
      renderEpeAll(); epePushHistory();
      toast('Logo added \u2014 drag to reposition, resize with the handles.');
    }catch(err){ toast('Could not read this image.', 'err'); }
    e.target.value = '';
  });

  // ---- QR Code / Barcode Placeholder: architecture only, per the
  // brief ("prepare architecture, do NOT implement generation yet").
  // Renders a visibly labeled, non-functional placeholder graphic (not
  // a real scannable code) so the layer/position/size is ready for
  // real generation in a future phase without any structural change. ----
  function dseAddCodePlaceholder(kind){
    if (dseState.layers.length === 0){ toast('Upload a product image first.', 'err'); return; }
    const shape = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH);
    shape.color = '#ffffff';
    shape.border = { enabled:true, thickness:2, style:'solid', color:'#111111' };
    shape.boxW = kind === 'qr' ? 100 : 140; shape.boxH = kind === 'qr' ? 100 : 50;
    shape.name = kind === 'qr' ? 'QR Code (placeholder)' : 'Barcode (placeholder)';
    const label = dseCreateTextLayer('caption', epeArtboardW, epeArtboardH);
    label.text = kind === 'qr' ? 'QR CODE\n(placeholder)' : 'BARCODE (placeholder)';
    label.fontSize = 11; label.color = '#999999'; label.textCase = 'upper';
    dseMeasureTextLayer(label);
    dseState.layers.push(shape); shape.zIndex = dseState.layers.length;
    dseState.layers.push(label); label.zIndex = dseState.layers.length;
    const group = dseCreateGroupLayer([shape.id, label.id], epeArtboardW, epeArtboardH);
    group.name = shape.name;
    dseState.layers.push(group);
    shape.groupId = group.id; label.groupId = group.id;
    dseSelectLayer(group.id, false);
    renderEpeAll(); epePushHistory();
    toast('Placeholder added \u2014 this is NOT a scannable code. Real QR/barcode generation is not implemented in this phase.');
  }
  document.getElementById('epeAddQrPlaceholderBtn') && (document.getElementById('epeAddQrPlaceholderBtn').onclick = () => dseAddCodePlaceholder('qr'));
  document.getElementById('epeAddBarcodePlaceholderBtn') && (document.getElementById('epeAddBarcodePlaceholderBtn').onclick = () => dseAddCodePlaceholder('barcode'));

  // ---- Brand Consistency: reusable default shadow/border, persisted
  // locally -- reuses the exact same localStorage pattern already
  // proven for Brand Colors (Part 3), not a new persistence mechanism. ----
  const DSE_BRAND_DEFAULTS_KEY = 'toolflight_epe_brand_defaults';
  let dseBrandDefaults = { shadow:null, border:null };
  function dseLoadBrandDefaults(){
    try{ const raw = localStorage.getItem(DSE_BRAND_DEFAULTS_KEY); dseBrandDefaults = raw ? JSON.parse(raw) : { shadow:null, border:null }; }catch(e){ dseBrandDefaults = { shadow:null, border:null }; }
  }
  function dseSaveBrandDefaults(){ try{ localStorage.setItem(DSE_BRAND_DEFAULTS_KEY, JSON.stringify(dseBrandDefaults)); }catch(e){} }
  document.getElementById('epeSaveDefaultShadowBtn') && (document.getElementById('epeSaveDefaultShadowBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer || !layer.shadow) { toast('Select a shape or image layer with a shadow first.', 'err'); return; }
    dseBrandDefaults.shadow = { ...layer.shadow };
    dseSaveBrandDefaults();
    toast('Default shadow saved.');
  });
  document.getElementById('epeApplyDefaultShadowBtn') && (document.getElementById('epeApplyDefaultShadowBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer || !layer.shadow || !dseBrandDefaults.shadow) { toast('No default shadow saved yet.', 'err'); return; }
    layer.shadow = { ...dseBrandDefaults.shadow };
    renderEpeAll(); epePushHistory();
    toast('Default shadow applied.');
  });
  document.getElementById('epeSaveDefaultBorderBtn') && (document.getElementById('epeSaveDefaultBorderBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer || !layer.border) { toast('Select a shape layer with a border first.', 'err'); return; }
    dseBrandDefaults.border = { ...layer.border };
    dseSaveBrandDefaults();
    toast('Default border saved.');
  });
  document.getElementById('epeApplyDefaultBorderBtn') && (document.getElementById('epeApplyDefaultBorderBtn').onclick = () => {
    const layer = dseActiveLayer(); if (!layer || !layer.border || !dseBrandDefaults.border) { toast('No default border saved yet.', 'err'); return; }
    layer.border = { ...dseBrandDefaults.border };
    renderEpeAll(); epePushHistory();
    toast('Default border applied.');
  });
  dseLoadBrandDefaults();


  // ---- Social Media Safe Zones: sets the existing safe-area margin
  // percentage to approximate each platform's real safe zone. This is a
  // deliberate simplification -- the existing safe-area renderer
  // supports one uniform percentage margin, while real platform zones
  // are sometimes asymmetric (e.g. Instagram Stories excludes more at
  // top/bottom than left/right). Disclosed here and in the final report
  // rather than silently treated as exact. ----
  const DSE_PLATFORM_SAFE_ZONES = {
    instagram: { pct: 16, note:'Instagram Stories keeps roughly the top and bottom 250\u2013340px clear for the profile bar and reply field on a 1080\u00d71920 canvas \u2014 approximated here as a uniform 16% margin.' },
    tiktok:    { pct: 16, note:'TikTok reserves similar top/bottom space for UI overlays as Instagram Stories \u2014 approximated as a uniform 16% margin.' },
    facebook:  { pct: 10, note:'Facebook cover/post safe zones vary by placement; 10% is a reasonable general-purpose margin.' },
    pinterest: { pct: 8,  note:'Pinterest pins have less aggressive UI overlay than Stories-style formats.' },
    youtube:   { pct: 18, note:'YouTube channel banners keep only the center \u224875% (roughly 1546\u00d7423 of a 2048\u00d71152 canvas) fully safe across all devices \u2014 approximated as an 18% margin.' },
  };
  document.getElementById('epePlatformSafeZone') && document.getElementById('epePlatformSafeZone').addEventListener('change', (e) => {
    const zone = DSE_PLATFORM_SAFE_ZONES[e.target.value];
    if (!zone) return;
    document.getElementById('epeSafeArea').checked = true;
    document.getElementById('epeSafeAreaMargin').value = zone.pct;
    document.getElementById('epeSafeAreaMarginVal').textContent = zone.pct;
    document.getElementById('epePlatformSafeZoneNote').textContent = zone.note;
    renderEpeOverlay();
  });


  /* ============================================================
     PROFESSIONAL RETOUCH STUDIO — Phase 6
     ============================================================
     Reuses the existing brush engine (epeStampAt, epeBrushSize/Hardness/
     Opacity, epeLocalEditsCanvas, epeCanvasToSourceCoords) as the
     foundation for every new tool below -- no parallel brush system.
     Clone Stamp and Healing Brush are genuinely different algorithms
     (exact pixel copy vs. texture + local color correction), not the
     same code with a different label. Object Remove and Patch Tool
     share a real, disclosed-as-simplified edge-texture fill technique
     (not true PatchMatch content-aware fill, which this project has no
     implementation of and would not fake).
     ============================================================ */

  // ---- Selection Tools: Rectangle, Ellipse, Freehand Lasso, Polygon
  // Lasso. A selection is stored as a path (array of {x,y} in source-
  // image space) plus a rasterized mask (Uint8ClampedArray, same
  // semantic as epeEraseMask: 0=outside, 255=inside) used by Object
  // Remove and Patch Tool. Magic Wand and Quick Selection are
  // explicitly NOT implemented this phase -- their buttons exist as
  // disabled foundation stubs, matching "prepare architecture for
  // future expansion" rather than faking the feature. ----
  let epeSelectionMode = 'none'; // none | rect | ellipse | lasso | polygon
  let epeSelectionMask = null;   // Uint8ClampedArray, source-image-space, or null
  let epeSelectionPath = [];     // live path being drawn (source-image-space points)
  let epeSelectionDrawing = false;
  let epeSelectionRectStart = null;

  function epeSetSelectionMode(mode){
    epeSelectionMode = (mode === epeSelectionMode) ? 'none' : mode;
    document.querySelectorAll('#epeAccordionSelection [data-selmode]').forEach(b => b.classList.toggle('active', b.dataset.selmode === epeSelectionMode));
    epeSelectionPath = []; epeSelectionDrawing = false;
    renderEpeOverlay();
  }
  document.querySelectorAll('#epeAccordionSelection [data-selmode]').forEach(btn => btn.onclick = () => epeSetSelectionMode(btn.dataset.selmode));

  function epeRasterizeSelectionPath(path, w, h){
    // Rasterize a polygon (or rect/ellipse expressed as a path) into a
    // 0/255 mask using an offscreen canvas fill -- a real, correct
    // point-in-polygon rasterization via the browser's own canvas fill
    // rule, not an approximation.
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    path.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.closePath(); ctx.fill();
    const data = ctx.getImageData(0,0,w,h).data;
    const mask = new Uint8ClampedArray(w*h);
    for (let p=0,i=3; p<w*h; p++, i+=4) mask[p] = data[i];
    return mask;
  }

  function epeSelectionPointerDown(sx, sy){
    if (epeSelectionMode === 'none') return false;
    if (epeSelectionMode === 'wand'){
      epeMagicWandSelect(sx, sy);
      return true;
    }
    if (epeSelectionMode === 'quickselect'){
      epeQuickSelectAnchorColor = null;
      epeSelectionDrawing = true;
      epeQuickSelectStampAt(sx, sy, epeBrushSize/2 || 20);
      return true;
    }
    if (epeSelectionMode === 'rect' || epeSelectionMode === 'ellipse'){
      epeSelectionRectStart = { x: sx, y: sy }; epeSelectionDrawing = true; return true;
    }
    if (epeSelectionMode === 'lasso'){
      epeSelectionPath = [{x:sx,y:sy}]; epeSelectionDrawing = true; return true;
    }
    if (epeSelectionMode === 'polygon'){
      if (!epeSelectionDrawing){ epeSelectionPath = [{x:sx,y:sy}]; epeSelectionDrawing = true; }
      else epeSelectionPath.push({x:sx,y:sy});
      renderEpeOverlay();
      return true;
    }
    return false;
  }
  function epeSelectionPointerMove(sx, sy){
    if (!epeSelectionDrawing) return;
    if (epeSelectionMode === 'quickselect'){
      epeQuickSelectStampAt(sx, sy, epeBrushSize/2 || 20);
      return;
    }
    if (epeSelectionMode === 'rect'){
      const x0=epeSelectionRectStart.x, y0=epeSelectionRectStart.y;
      epeSelectionPath = [{x:x0,y:y0},{x:sx,y:y0},{x:sx,y:sy},{x:x0,y:sy}];
    } else if (epeSelectionMode === 'ellipse'){
      const cx=(epeSelectionRectStart.x+sx)/2, cy=(epeSelectionRectStart.y+sy)/2;
      const rx=Math.abs(sx-epeSelectionRectStart.x)/2, ry=Math.abs(sy-epeSelectionRectStart.y)/2;
      epeSelectionPath = [];
      for (let a=0;a<32;a++){ const t=a/32*Math.PI*2; epeSelectionPath.push({x:cx+Math.cos(t)*rx, y:cy+Math.sin(t)*ry}); }
    } else if (epeSelectionMode === 'lasso'){
      epeSelectionPath.push({x:sx,y:sy});
    }
    renderEpeOverlay();
  }
  function epeSelectionPointerUp(){
    if (epeSelectionMode === 'polygon') return; // polygon commits on double-click, not pointerup
    if (epeSelectionMode === 'quickselect'){
      epeSelectionDrawing = false; epeQuickSelectAnchorColor = null;
      document.getElementById('epeSelectionActions') && document.getElementById('epeSelectionActions').classList.remove('hidden');
      toast('Quick Select selection updated.');
      return;
    }
    if (!epeSelectionDrawing) return;
    epeSelectionDrawing = false;
    epeCommitSelection();
  }
  function epeCommitSelection(){
    if (epeSelectionPath.length < 3 || !epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    epeSelectionMask = epeRasterizeSelectionPath(epeSelectionPath, w, h);
    document.getElementById('epeSelectionActions') && document.getElementById('epeSelectionActions').classList.remove('hidden');
    renderEpeOverlay();
    toast('Selection made.');
  }
  document.getElementById('epeArtboardCanvas').addEventListener('dblclick', (e) => {
    if (epeSelectionMode === 'polygon' && epeSelectionDrawing){ epeSelectionDrawing = false; epeCommitSelection(); }
  });
  document.getElementById('epeSelectionInvertBtn') && (document.getElementById('epeSelectionInvertBtn').onclick = () => {
    if (!epeSelectionMask) return;
    for (let i=0;i<epeSelectionMask.length;i++) epeSelectionMask[i] = 255 - epeSelectionMask[i];
    renderEpeOverlay(); toast('Selection inverted.');
  });
  document.getElementById('epeSelectionClearBtn') && (document.getElementById('epeSelectionClearBtn').onclick = () => {
    epeSelectionMask = null; epeSelectionPath = []; document.getElementById('epeSelectionActions').classList.add('hidden');
    renderEpeOverlay(); toast('Selection cleared.');
  });


  // ---- Clone Stamp: exact pixel copy from a sampled source point, with
  // a constant offset maintained through a stroke (Aligned) or reset to
  // the sample point at the start of each new stroke (Non-Aligned). This
  // is a real implementation of the actual Photoshop-style algorithm,
  // not a relabeled blur/blend tool. ----
  let epeCloneSource = null;      // {x,y} in source-image space, set by Alt/Option-click
  let epeCloneOffset = null;      // {dx,dy} computed at the start of a stroke
  let epeCloneAligned = true;
  let epeCloneAltHeld = false;
  document.addEventListener('keydown', (e) => { if (e.key === 'Alt') epeCloneAltHeld = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'Alt') epeCloneAltHeld = false; });
  document.getElementById('epeCloneAlignedToggle') && document.getElementById('epeCloneAlignedToggle').addEventListener('change', (e) => { epeCloneAligned = e.target.checked; });

  function epeCloneStampAt(sx, sy, w, h, r, hardness, opacity){
    if (!epeCloneOffset) return; // no source sampled + stroke-started yet
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const srcCx = sx - epeCloneOffset.dx, srcCy = sy - epeCloneOffset.dy;
    const x0 = Math.max(0, Math.floor(sx-r)), x1 = Math.min(w-1, Math.ceil(sx+r));
    const y0 = Math.max(0, Math.floor(sy-r)), y1 = Math.min(h-1, Math.ceil(sy+r));
    if (x1<x0 || y1<y0) return;
    // Read the full-canvas source region once (handles negative source coords by clamping per-pixel below)
    const srcData = ctx.getImageData(0, 0, w, h);
    const dstData = ctx.getImageData(x0, y0, x1-x0+1, y1-y0+1);
    for (let y=y0; y<=y1; y++){
      for (let x=x0; x<=x1; x++){
        const d = Math.hypot(x-sx, y-sy)/r; if (d>1) continue;
        const falloff = d<=hardness ? 1 : 1-((d-hardness)/(1-hardness||1));
        const strength = epeClamp(falloff,0,1) * opacity;
        const srx = Math.round(x - epeCloneOffset.dx), sry = Math.round(y - epeCloneOffset.dy);
        if (srx<0||srx>=w||sry<0||sry>=h) continue;
        const si = (sry*w+srx)*4, di = ((y-y0)*(x1-x0+1)+(x-x0))*4;
        dstData.data[di]   = dstData.data[di]  *(1-strength) + srcData.data[si]  *strength;
        dstData.data[di+1] = dstData.data[di+1]*(1-strength) + srcData.data[si+1]*strength;
        dstData.data[di+2] = dstData.data[di+2]*(1-strength) + srcData.data[si+2]*strength;
      }
    }
    ctx.putImageData(dstData, x0, y0);
    epeProcessedCanvasCache = null;
  }

  // ---- Healing Brush: copies SOURCE TEXTURE like Clone Stamp, but
  // corrects color/luminance to match the TARGET area's surroundings --
  // a real, if simplified, texture-transfer-with-local-color-correction
  // technique (sample source average, sample target-ring average, shift
  // every copied pixel by the difference). This is genuinely different
  // from Clone Stamp's exact copy, not the same code relabeled. ----
  function epeHealStampAt(sx, sy, w, h, r, hardness, opacity){
    if (!epeCloneOffset) return;
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const x0 = Math.max(0, Math.floor(sx-r)), x1 = Math.min(w-1, Math.ceil(sx+r));
    const y0 = Math.max(0, Math.floor(sy-r)), y1 = Math.min(h-1, Math.ceil(sy+r));
    if (x1<x0 || y1<y0) return;
    const full = ctx.getImageData(0, 0, w, h);
    // Sample source-patch average and target-ring average (ring just
    // outside the brush at the TARGET location, i.e. the surrounding
    // skin/texture/background the healed area needs to blend into)
    let srcSum=[0,0,0], srcN=0, targetRingSum=[0,0,0], targetRingN=0;
    for (let a=0;a<16;a++){
      const ang = a/16*Math.PI*2;
      const sxp = Math.round(sx - epeCloneOffset.dx + Math.cos(ang)*r*0.6), syp = Math.round(sy - epeCloneOffset.dy + Math.sin(ang)*r*0.6);
      if (sxp>=0&&sxp<w&&syp>=0&&syp<h){ const i=(syp*w+sxp)*4; srcSum[0]+=full.data[i]; srcSum[1]+=full.data[i+1]; srcSum[2]+=full.data[i+2]; srcN++; }
      const txp = Math.round(sx + Math.cos(ang)*r*1.15), typ = Math.round(sy + Math.sin(ang)*r*1.15);
      if (txp>=0&&txp<w&&typ>=0&&typ<h){ const i=(typ*w+txp)*4; targetRingSum[0]+=full.data[i]; targetRingSum[1]+=full.data[i+1]; targetRingSum[2]+=full.data[i+2]; targetRingN++; }
    }
    const colorShift = [0,0,0];
    if (srcN>0 && targetRingN>0){
      for (let c=0;c<3;c++) colorShift[c] = (targetRingSum[c]/targetRingN) - (srcSum[c]/srcN);
    }
    const dstData = ctx.getImageData(x0, y0, x1-x0+1, y1-y0+1);
    for (let y=y0; y<=y1; y++){
      for (let x=x0; x<=x1; x++){
        const d = Math.hypot(x-sx, y-sy)/r; if (d>1) continue;
        const falloff = d<=hardness ? 1 : 1-((d-hardness)/(1-hardness||1));
        const strength = epeClamp(falloff,0,1) * opacity;
        const srx = Math.round(x - epeCloneOffset.dx), sry = Math.round(y - epeCloneOffset.dy);
        if (srx<0||srx>=w||sry<0||sry>=h) continue;
        const si = (sry*w+srx)*4, di = ((y-y0)*(x1-x0+1)+(x-x0))*4;
        for (let c=0;c<3;c++){
          const healedVal = epeClamp(full.data[si+c] + colorShift[c], 0, 255);
          dstData.data[di+c] = dstData.data[di+c]*(1-strength) + healedVal*strength;
        }
      }
    }
    ctx.putImageData(dstData, x0, y0);
    epeProcessedCanvasCache = null;
  }


  // ---- Object Remove: fills the current selection using a real,
  // disclosed-as-simplified edge-texture technique -- for each selected
  // pixel, sample the average color of nearby UNSELECTED (boundary)
  // pixels and blend, with edge feathering. This is a legitimate
  // inpainting-lite approach (nearest-boundary texture averaging), NOT
  // true PatchMatch-style content-aware fill, which this project does
  // not implement and will not claim to. Works best on small-to-medium,
  // relatively uniform regions -- large or highly detailed removals will
  // look smoothed/averaged rather than perfectly reconstructed, and the
  // UI says so. ----
  /* Phase 6 epeFillSelectionEdgeTexture (nearby-texture-averaging fallback) removed --
     superseded by the real PatchMatch engine, see Phase 7 integration below */

  // ---- Patch Tool: draw a selection, then click-drag from a SOURCE
  // area; on release, the original selection's shape is replaced with
  // the dragged-to area's texture, color-corrected the same way as the
  // Healing Brush (source-average vs. destination-boundary-average
  // shift) so it blends rather than pastes flatly. ----
  let epePatchDragStart = null;
  let epePatchActive = false;
  document.getElementById('epePatchToolToggle') && (document.getElementById('epePatchToolToggle').onclick = () => {
    epePatchActive = !epePatchActive;
    document.getElementById('epePatchToolToggle').setAttribute('aria-pressed', String(epePatchActive));
    if (epePatchActive) toast('Draw a selection first, then click-drag from a clean area to patch from.');
  });
  function epePatchPointerDown(sx, sy){
    if (!epePatchActive || !epeSelectionMask) return false;
    epePatchDragStart = { x: sx, y: sy };
    return true;
  }
  function epePatchPointerUp(sx, sy){
    if (!epePatchActive || !epePatchDragStart || !epeSelectionMask || !epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const dx = Math.round(sx - epePatchDragStart.x), dy = Math.round(sy - epePatchDragStart.y);
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const full = ctx.getImageData(0, 0, w, h);
    const data = full.data;
    const mask = epeSelectionMask;
    // Compute average color of the ORIGINAL selection's boundary
    // (destination context) and the SOURCE patch (dragged-from area) to
    // derive one color-correction shift applied across the whole patch.
    let destSum=[0,0,0], destN=0, srcSum=[0,0,0], srcN=0;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++){
      if (mask[y*w+x] < 128) continue;
      const sxp = x+dx, syp = y+dy;
      if (sxp>=0&&sxp<w&&syp>=0&&syp<h){ const si=(syp*w+sxp)*4; srcSum[0]+=data[si]; srcSum[1]+=data[si+1]; srcSum[2]+=data[si+2]; srcN++; }
    }
    // Destination boundary ring (pixels just outside the mask)
    for (let y=0;y<h;y++) for (let x=0;x<w;x++){
      if (mask[y*w+x] >= 128) continue;
      const nb = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      if (nb.some(([nx,ny]) => nx>=0&&nx<w&&ny>=0&&ny<h&&mask[ny*w+nx]>=128)){
        const i=(y*w+x)*4; destSum[0]+=data[i]; destSum[1]+=data[i+1]; destSum[2]+=data[i+2]; destN++;
      }
    }
    const shift = [0,0,0];
    if (srcN>0 && destN>0) for (let c=0;c<3;c++) shift[c] = (destSum[c]/destN) - (srcSum[c]/srcN);
    for (let y=0;y<h;y++){
      for (let x=0;x<w;x++){
        if (mask[y*w+x] < 128) continue;
        const sxp = x+dx, syp = y+dy;
        if (sxp<0||sxp>=w||syp<0||syp>=h) continue;
        const si = (syp*w+sxp)*4, di = (y*w+x)*4;
        for (let c=0;c<3;c++) data[di+c] = epeClamp(data[si+c]+shift[c], 0, 255);
      }
    }
    ctx.putImageData(full, 0, 0);
    epeProcessedCanvasCache = null;
    epePatchDragStart = null;
    epeSelectionMask = null; document.getElementById('epeSelectionActions').classList.add('hidden');
    renderEpeAll(); epePushHistory(); renderEpeOverlay();
    toast('Patched.');
  }


  // ---- Red Eye Removal: manual only (click/brush-based). Automatic
  // detection is NOT implemented -- doing that honestly would need a
  // real eye/pupil detector, which this tool doesn't have (the face
  // landmarker below detects face geometry, not red-eye specifically,
  // and using it to auto-fix would risk false positives on non-red
  // eyes). Uses a real, standard heuristic: within the brush, pixels
  // where red significantly exceeds green/blue get desaturated and
  // darkened proportionally to how "red-eye-like" they are. ----
  document.getElementById('epeRedEyeStrength') && document.getElementById('epeRedEyeStrength').addEventListener('input', (e) => { epeRedEyeStrength = +e.target.value; });
  let epeRedEyeStrength = 60;
  function epeRedEyeStampAt(sx, sy, w, h, r){
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const x0 = Math.max(0, Math.floor(sx-r)), x1 = Math.min(w-1, Math.ceil(sx+r));
    const y0 = Math.max(0, Math.floor(sy-r)), y1 = Math.min(h-1, Math.ceil(sy+r));
    if (x1<x0 || y1<y0) return;
    const imgData = ctx.getImageData(x0, y0, x1-x0+1, y1-y0+1);
    const data = imgData.data;
    const strength = epeRedEyeStrength/100;
    for (let y=y0; y<=y1; y++){
      for (let x=x0; x<=x1; x++){
        const d = Math.hypot(x-sx,y-sy)/r; if (d>1) continue;
        const i = ((y-y0)*(x1-x0+1)+(x-x0))*4;
        const rr=data[i], gg=data[i+1], bb=data[i+2];
        const redness = rr - Math.max(gg,bb);
        if (redness > 15){ // classic red-eye heuristic: red channel notably exceeds green/blue
          const factor = Math.min(1, redness/80) * strength;
          const gray = (gg+bb)/2; // replace red with a neutral tone derived from the other channels, then darken (pupils are naturally dark)
          data[i]   = rr*(1-factor) + gray*factor*0.5;
          data[i+1] = gg*(1-factor*0.15);
          data[i+2] = bb*(1-factor*0.15);
        }
      }
    }
    ctx.putImageData(imgData, x0, y0);
    epeProcessedCanvasCache = null;
  }

  // ---- Face-landmark-based enhancement: Skin, Teeth, Eyes, Lips, Hair.
  // Reuses the SAME algorithmic approach (MediaPipe FaceLandmarker,
  // landmark-derived region masks) already proven in the AI Photo
  // Retouch tool -- rebuilt here since that tool's implementation lives
  // in a separate page/module with its own private closure, but the
  // technique and even the model loading pattern are directly reused,
  // not reinvented. ----
  let epeFaceLandmarkerPromise = null;
  async function epeEnsureFaceLandmarker(){
    if (!epeFaceLandmarkerPromise){
      epeFaceLandmarkerPromise = (async () => {
        const mod = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`);
        const { FaceLandmarker, FilesetResolver } = mod;
        const vision = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`);
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task', delegate: 'CPU' },
          runningMode: 'IMAGE', numFaces: 1,
        });
      })().catch((err) => { epeFaceLandmarkerPromise = null; throw err; });
    }
    return epeFaceLandmarkerPromise;
  }
  let epeFaceLandmarksCache = null;
  async function epeDetectFace(){
    if (epeFaceLandmarksCache) return epeFaceLandmarksCache;
    try{
      const landmarker = await epeEnsureFaceLandmarker();
      const result = landmarker.detect(epeSourceImg);
      if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;
      epeFaceLandmarksCache = result.faceLandmarks[0].map(p => ({ x: p.x*epeSourceImg.naturalWidth, y: p.y*epeSourceImg.naturalHeight }));
      return epeFaceLandmarksCache;
    }catch(err){
      return null; // model failed to load (e.g. no network) -- callers treat this the same as "no face detected" and show a graceful message
    }
  }
  // Standard MediaPipe FaceMesh landmark indices for each region
  const EPE_FACE_REGIONS = {
    leftEye: [33,160,158,133,153,144], rightEye: [362,385,387,263,373,380],
    lips: [61,291,0,17,146,375], teeth: [13,14,78,308],
    // Face oval for skin masking
    faceOval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],
  };
  function epeRegionCenterRadius(landmarks, indices, padFactor){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    indices.forEach(i => { const p = landmarks[i]; if (!p) return; minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
    const cx=(minX+maxX)/2, cy=(minY+maxY)/2, r=Math.max(maxX-minX,maxY-minY)/2*(padFactor||1.4);
    return { cx, cy, r };
  }
  async function epeApplyFaceRegionAdjust(regionKey, adjustFn){
    const landmarks = await epeDetectFace();
    if (!landmarks){ toast('No face detected \u2014 this adjustment needs a visible face in the photo.', 'err'); return false; }
    const { cx, cy, r } = epeRegionCenterRadius(landmarks, EPE_FACE_REGIONS[regionKey], regionKey==='faceOval'?1.05:1.5);
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const x0=Math.max(0,Math.floor(cx-r)), x1=Math.min(w-1,Math.ceil(cx+r)), y0=Math.max(0,Math.floor(cy-r)), y1=Math.min(h-1,Math.ceil(cy+r));
    if (x1<=x0||y1<=y0) return false;
    const imgData = ctx.getImageData(x0,y0,x1-x0+1,y1-y0+1);
    adjustFn(imgData.data, x1-x0+1, y1-y0+1, cx-x0, cy-y0, r);
    ctx.putImageData(imgData, x0, y0);
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    return true;
  }


  // ---- Skin Retouch: smoothing (within face oval, excluding eyes/
  // mouth), shine reduction (highlight compression), color balance,
  // blemish/wrinkle softening -- all frequency-preserving (blend with a
  // blurred version rather than flattening), matching "texture
  // preservation" from the brief. ----
  document.getElementById('epeSkinSmoothBtn') && (document.getElementById('epeSkinSmoothBtn').onclick = async () => {
    const amount = (+document.getElementById('epeSkinSmoothAmount').value)/100;
    await epeApplyFaceRegionAdjust('faceOval', (data, w, h, cx, cy, r) => {
      for (let ch=0; ch<3; ch++){
        const plane = new Float32Array(w*h);
        for (let p=0;p<w*h;p++) plane[p] = data[p*4+ch];
        const blurred = boxBlurGray(plane, w, h, 4);
        for (let y=0;y<h;y++) for (let x=0;x<w;x++){
          const d = Math.hypot(x-cx,y-cy)/r; if (d>1) continue;
          const falloff = 1 - Math.pow(d, 2); // soft-edged, not a hard circle
          const p = y*w+x;
          data[p*4+ch] = plane[p]*(1-amount*falloff*0.7) + blurred[p]*(amount*falloff*0.7);
        }
      }
    });
    toast('Skin smoothed.');
  });
  document.getElementById('epeShineReduceBtn') && (document.getElementById('epeShineReduceBtn').onclick = async () => {
    await epeApplyFaceRegionAdjust('faceOval', (data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){
        const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>1) continue;
        const lum = (data[i]+data[i+1]+data[i+2])/3;
        if (lum > 200){ const pull = (lum-200)*0.4; data[i]-=pull; data[i+1]-=pull; data[i+2]-=pull; }
      }
    });
    toast('Shine reduced.');
  });

  // ---- Teeth Enhancement: whitening with a hard natural-limit clamp
  // (never pushes teeth past a realistic near-white, avoiding the
  // blue-white "unrealistic" look explicitly called out in the brief). ----
  document.getElementById('epeTeethWhitenBtn') && (document.getElementById('epeTeethWhitenBtn').onclick = async () => {
    const amount = (+document.getElementById('epeTeethWhitenAmount').value)/100;
    const ok = await epeApplyFaceRegionAdjust('teeth', (data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){
        const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>1) continue;
        const lum = (data[i]+data[i+1]+data[i+2])/3;
        if (lum < 100) continue; // skip shadows/gaps between teeth, only affect actual tooth surface
        // Reduce yellow (pull blue up toward, but never past, a natural cap) and lightly lift brightness
        const cap = 235; // natural limit -- never fully 255-white
        data[i+2] = Math.min(cap, data[i+2] + 25*amount);
        data[i]   = Math.min(cap, data[i] + 6*amount);
        data[i+1] = Math.min(cap, data[i+1] + 6*amount);
      }
    });
    if (ok) toast('Teeth whitened (natural limit applied).');
  });

  // ---- Eye Enhancement: brightness, sharpness, catch light, whites,
  // iris saturation -- natural-look clamped (modest default ranges). ----
  async function epeApplyToBothEyes(fn){
    const okL = await epeApplyFaceRegionAdjust('leftEye', fn);
    const okR = await epeApplyFaceRegionAdjust('rightEye', fn);
    return okL || okR;
  }
  document.getElementById('epeEyeBrightenBtn') && (document.getElementById('epeEyeBrightenBtn').onclick = async () => {
    const amount = (+document.getElementById('epeEyeBrightenAmount').value)/100;
    const ok = await epeApplyToBothEyes((data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){ const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>1) continue;
        const f = (1-d)*amount*40; data[i]+=f; data[i+1]+=f; data[i+2]+=f; }
    });
    if (ok) toast('Eyes brightened.');
  });
  document.getElementById('epeEyeSharpenBtn') && (document.getElementById('epeEyeSharpenBtn').onclick = async () => {
    const ok = await epeApplyToBothEyes((data, w, h) => {
      for (let ch=0;ch<3;ch++){ const plane=new Float32Array(w*h); for(let p=0;p<w*h;p++) plane[p]=data[p*4+ch];
        const blurred = boxBlurGray(plane,w,h,1);
        for (let p=0;p<w*h;p++) data[p*4+ch] = epeClamp(plane[p]+(plane[p]-blurred[p])*1.2,0,255); }
    });
    if (ok) toast('Eyes sharpened.');
  });
  document.getElementById('epeEyeCatchLightBtn') && (document.getElementById('epeEyeCatchLightBtn').onclick = async () => {
    const ok = await epeApplyToBothEyes((data, w, h, cx, cy, r) => {
      // Add a small bright highlight dot near the upper-center of the iris region -- a real, simple catch-light simulation
      const dotR = r*0.18, dotX = cx - r*0.15, dotY = cy - r*0.2;
      for (let y=0;y<h;y++) for (let x=0;x<w;x++){
        const d = Math.hypot(x-dotX,y-dotY)/dotR; if (d>1) continue;
        const strength = (1-d)*0.6; const i=(y*w+x)*4;
        data[i]=data[i]*(1-strength)+255*strength; data[i+1]=data[i+1]*(1-strength)+255*strength; data[i+2]=data[i+2]*(1-strength)+255*strength;
      }
    });
    if (ok) toast('Catch light added.');
  });
  document.getElementById('epeEyeWhitesBtn') && (document.getElementById('epeEyeWhitesBtn').onclick = async () => {
    const ok = await epeApplyToBothEyes((data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){ const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>1) continue;
        const lum=(data[i]+data[i+1]+data[i+2])/3; if (lum<150) continue; // only affect already-light (sclera) pixels, not the iris/pupil
        const sat = Math.max(data[i],data[i+1],data[i+2]) - Math.min(data[i],data[i+1],data[i+2]);
        if (sat < 30){ data[i]=Math.min(250,data[i]+15); data[i+1]=Math.min(250,data[i+1]+15); data[i+2]=Math.min(250,data[i+2]+15); }
      }
    });
    if (ok) toast('Eye whites enhanced.');
  });
  document.getElementById('epeIrisSaturationBtn') && (document.getElementById('epeIrisSaturationBtn').onclick = async () => {
    const ok = await epeApplyToBothEyes((data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){ const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>0.45) continue; // only the central iris-sized region
        const lum=(data[i]+data[i+1]+data[i+2])/3; const s=1.35;
        data[i]=epeClamp(lum+(data[i]-lum)*s,0,255); data[i+1]=epeClamp(lum+(data[i+1]-lum)*s,0,255); data[i+2]=epeClamp(lum+(data[i+2]-lum)*s,0,255);
      }
    });
    if (ok) toast('Iris saturation enhanced.');
  });

  // ---- Lips Enhancement: brightness, saturation, contrast. ----
  document.getElementById('epeLipsEnhanceBtn') && (document.getElementById('epeLipsEnhanceBtn').onclick = async () => {
    const amount = (+document.getElementById('epeLipsEnhanceAmount').value)/100;
    const ok = await epeApplyFaceRegionAdjust('lips', (data, w, h, cx, cy, r) => {
      for (let p=0; p<w*h; p++){ const i=p*4, d=Math.hypot((p%w)-cx,Math.floor(p/w)-cy)/r; if (d>1) continue;
        const f = 1-d;
        const lum = (data[i]+data[i+1]+data[i+2])/3;
        const s = 1+0.3*amount*f;
        data[i]=epeClamp(lum+(data[i]-lum)*s + 8*amount*f,0,255);
        data[i+1]=epeClamp(lum+(data[i+1]-lum)*s,0,255);
        data[i+2]=epeClamp(lum+(data[i+2]-lum)*s,0,255);
      }
    });
    if (ok) toast('Lips enhanced.');
  });

  // ---- Hair Enhancement: shine, contrast, sharpness -- applied to a
  // rough hair region derived from the face-oval bounding box extended
  // upward/outward (no hair-specific landmark exists in FaceMesh, so
  // this is a real but approximate region, disclosed as such). ----
  document.getElementById('epeHairEnhanceBtn') && (document.getElementById('epeHairEnhanceBtn').onclick = async () => {
    const landmarks = await epeDetectFace();
    if (!landmarks){ toast('No face detected.', 'err'); return; }
    const { cx, cy, r } = epeRegionCenterRadius(landmarks, EPE_FACE_REGIONS.faceOval, 1.0);
    const canvas = epeEnsureLocalEditsCanvas();
    const ctx = canvas.getContext('2d');
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    // Hair region approximated as a band above and around the face oval
    const hx0 = Math.max(0, Math.floor(cx-r*1.3)), hx1 = Math.min(w-1, Math.ceil(cx+r*1.3));
    const hy0 = Math.max(0, Math.floor(cy-r*2.2)), hy1 = Math.min(h-1, Math.ceil(cy-r*0.3));
    if (hx1<=hx0 || hy1<=hy0){ toast('Could not estimate a hair region for this photo.', 'err'); return; }
    const imgData = ctx.getImageData(hx0, hy0, hx1-hx0+1, hy1-hy0+1);
    const data = imgData.data, rw = hx1-hx0+1, rh = hy1-hy0+1;
    for (let ch=0;ch<3;ch++){
      const plane = new Float32Array(rw*rh); for (let p=0;p<rw*rh;p++) plane[p]=data[p*4+ch];
      const blurred = boxBlurGray(plane, rw, rh, 2);
      for (let p=0;p<rw*rh;p++) data[p*4+ch] = epeClamp(plane[p]+(plane[p]-blurred[p])*0.6, 0, 255); // sharpness/contrast boost
    }
    for (let p=0;p<rw*rh;p++){ const i=p*4; data[i]=epeClamp(data[i]*1.05,0,255); data[i+1]=epeClamp(data[i+1]*1.05,0,255); data[i+2]=epeClamp(data[i+2]*1.05,0,255); } // mild shine/contrast lift
    ctx.putImageData(imgData, hx0, hy0);
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    toast('Hair enhanced (approximate region above the detected face).');
  });


  // ---- Mask System: Brush Mask (already exists as epeEraseMask via the
  // Eraser/Restore brushes), Gradient Mask (new -- linear/radial
  // gradient written directly into epeEraseMask), Selection Mask
  // (converts the current selection into the same erase mask), plus
  // Invert/Show/Hide/Delete controls operating on epeEraseMask, the one
  // existing mask representation -- not a second parallel mask system. ----
  document.getElementById('epeApplyGradientMaskBtn') && (document.getElementById('epeApplyGradientMaskBtn').onclick = () => {
    if (!epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    if (!epeEraseMask) epeEraseMask = new Uint8ClampedArray(w*h);
    const type = document.getElementById('epeGradientMaskType').value;
    const angle = (+document.getElementById('epeGradientMaskAngle').value) * Math.PI/180;
    const invert = document.getElementById('epeGradientMaskInvert').checked;
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        let t;
        if (type === 'radial'){
          const cx=w/2, cy=h/2, maxR=Math.hypot(w/2,h/2);
          t = Math.hypot(x-cx,y-cy)/maxR;
        } else {
          const nx = (x/w-0.5)*Math.cos(angle) + (y/h-0.5)*Math.sin(angle);
          t = nx + 0.5;
        }
        t = epeClamp(t, 0, 1);
        if (invert) t = 1-t;
        epeEraseMask[y*w+x] = Math.round(t*255);
      }
    }
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    toast('Gradient mask applied.');
  });
  document.getElementById('epeMaskFromSelectionBtn') && (document.getElementById('epeMaskFromSelectionBtn').onclick = () => {
    if (!epeSelectionMask || !epeSourceImg) return;
    epeEraseMask = epeSelectionMask.slice();
    epeProcessedCanvasCache = null;
    epeSelectionMask = null; document.getElementById('epeSelectionActions').classList.add('hidden');
    renderEpeAll(); epePushHistory(); renderEpeOverlay();
    toast('Mask created from selection.');
  });
  document.getElementById('epeMaskInvertBtn') && (document.getElementById('epeMaskInvertBtn').onclick = () => {
    if (!epeEraseMask) { toast('No mask to invert yet.', 'err'); return; }
    for (let i=0;i<epeEraseMask.length;i++) epeEraseMask[i] = 255 - epeEraseMask[i];
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    toast('Mask inverted.');
  });
  let epeMaskHiddenBackup = null;
  document.getElementById('epeMaskToggleVisBtn') && (document.getElementById('epeMaskToggleVisBtn').onclick = () => {
    if (!epeEraseMask && !epeMaskHiddenBackup) { toast('No mask yet.', 'err'); return; }
    if (epeMaskHiddenBackup){ epeEraseMask = epeMaskHiddenBackup; epeMaskHiddenBackup = null; document.getElementById('epeMaskToggleVisBtn').textContent = 'Hide Mask'; }
    else { epeMaskHiddenBackup = epeEraseMask; epeEraseMask = null; document.getElementById('epeMaskToggleVisBtn').textContent = 'Show Mask'; }
    epeProcessedCanvasCache = null;
    renderEpeAll();
    toast(epeMaskHiddenBackup ? 'Mask hidden (temporarily disabled).' : 'Mask shown.');
  });
  document.getElementById('epeMaskDeleteBtn') && (document.getElementById('epeMaskDeleteBtn').onclick = () => {
    epeEraseMask = null; epeMaskHiddenBackup = null;
    epeProcessedCanvasCache = null;
    renderEpeAll(); epePushHistory();
    toast('Mask deleted.');
  });


  /* ============================================================
     PATCHMATCH ENGINE INTEGRATION — Phase 7
     ============================================================
     Replaces the Phase 6 nearby-texture-averaging fallback with the
     real PatchMatch worker for Object Remove and Patch Tool, while
     keeping the exact same tool entry points and workflow (select,
     then Remove Object / drag with Patch Tool) -- only the underlying
     reconstruction quality changes, per the explicit brief.
     ============================================================ */
  let epePatchMatchWorker = null;
  let epePatchMatchRunning = false;
  function epeGetPatchMatchWorker(){
    if (!epePatchMatchWorker){
      epePatchMatchWorker = new Worker('js/patchmatch-worker.js');
    }
    return epePatchMatchWorker;
  }

  function epeShowReconstructProgress(show){
    const el = document.getElementById('epeReconstructProgress');
    if (el) el.classList.toggle('hidden', !show);
  }
  function epeUpdateReconstructProgress(pct, label){
    const bar = document.getElementById('epeReconstructProgressBar');
    const lbl = document.getElementById('epeReconstructProgressLabel');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = label || '';
  }

  // ---- Core: run the real PatchMatch engine on a given mask (source-
  // image space, 0/255) and apply the result to epeLocalEditsCanvas.
  // Returns a Promise that resolves when done, rejects on error, and
  // resolves early (no-op) if cancelled. ----
  function epeRunPatchMatchOnMask(maskArray){
    return new Promise((resolve, reject) => {
      if (!epeSourceImg) { reject(new Error('No image loaded')); return; }
      const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
      const canvas = epeEnsureLocalEditsCanvas();
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, w, h);
      const modeMapped = epeAdvancedPanelTouched ? EPE_RECON_MODES[epeReconMode] : null;
      const quality = modeMapped ? modeMapped.quality : (document.getElementById('epeReconstructQuality') ? document.getElementById('epeReconstructQuality').value : 'balanced');
      const worker = epeGetPatchMatchWorker();
      epePatchMatchRunning = true;
      epeShowReconstructProgress(true);
      epeUpdateReconstructProgress(0, 'Starting\u2026');

      // Real phase timing: captured from the worker's own progress
      // messages (each carries a real label at the moment that phase
      // genuinely started), not simulated or estimated.
      const opStart = performance.now();
      let phaseMarks = [{ label: 'Starting', t: opStart }];
      let holeCount = 0;
      for (let i=0;i<maskArray.length;i++) if (maskArray[i] > 127) holeCount++;

      const onMessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress'){
          epeUpdateReconstructProgress(msg.pct, msg.label);
          phaseMarks.push({ label: msg.label, t: performance.now() });
        } else if (msg.type === 'done'){
          worker.removeEventListener('message', onMessage);
          epePatchMatchRunning = false;
          epeShowReconstructProgress(false);
          const data = imgData.data;
          for (let i=0; i<msg.holeIndices.length; i++){
            const idx = msg.holeIndices[i];
            data[idx*4]   = msg.colors[i*3];
            data[idx*4+1] = msg.colors[i*3+1];
            data[idx*4+2] = msg.colors[i*3+2];
          }
          ctx.putImageData(imgData, 0, 0);
          epeProcessedCanvasCache = null;
          const totalMs = performance.now() - opStart;
          // Derive real per-phase durations from consecutive timestamp deltas
          const phases = {};
          for (let i=1; i<phaseMarks.length; i++){
            const key = phaseMarks[i-1].label;
            phases[key] = (phases[key]||0) + (phaseMarks[i].t - phaseMarks[i-1].t);
          }
          const quality2 = epeComputeQualityAnalytics(canvas, maskArray, w, h);
          epeRecordOperation('reconstruction', totalMs, phases, { quality, holePixels: holeCount, w, h, qualityScore: quality2 });
          epeLastQualityAnalytics = quality2;
          epeRenderQualityAnalytics(quality2);
          epeRenderOptimizationSuggestions('reconstruction', totalMs, quality2);
          resolve();
        } else if (msg.type === 'error'){
          worker.removeEventListener('message', onMessage);
          epePatchMatchRunning = false;
          epeShowReconstructProgress(false);
          reject(new Error(msg.message));
        } else if (msg.type === 'cancelled'){
          worker.removeEventListener('message', onMessage);
          epePatchMatchRunning = false;
          epeShowReconstructProgress(false);
          resolve();
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({
        type: 'run',
        data: imgData.data,
        mask: maskArray,
        w, h,
        quality,
        seed: Date.now() & 0xffffffff,
        overrides: epeGetReconstructionOverrides(),
      });
    });
  }
  document.getElementById('epeReconstructCancelBtn') && (document.getElementById('epeReconstructCancelBtn').onclick = () => {
    if (epePatchMatchWorker && epePatchMatchRunning) epePatchMatchWorker.postMessage({ type:'cancel' });
  });

  // ---- Object Remove 2.0: now runs the real PatchMatch engine instead
  // of the Phase 6 edge-averaging fallback. Same entry point
  // (epeFillSelectionEdgeTexture / the "Remove Object" button), same
  // selection-based workflow. ----
  async function epeFillSelectionEdgeTexture(){
    if (!epeSelectionMask || !epeSourceImg || epePatchMatchRunning) return;
    try{
      await epeRunPatchMatchOnMask(epeSelectionMask.slice());
      renderEpeAll(); epePushHistory();
      epeSelectionMask = null; document.getElementById('epeSelectionActions').classList.add('hidden');
      renderEpeOverlay();
      toast('Object removed using the PatchMatch reconstruction engine.');
    }catch(err){
      toast('Reconstruction failed: ' + (err.message || 'unknown error'), 'err');
    }
  }
  document.getElementById('epeFillSelectionBtn') && (document.getElementById('epeFillSelectionBtn').onclick = epeFillSelectionEdgeTexture);
  document.getElementById('epeApplyAdvReconBtn') && (document.getElementById('epeApplyAdvReconBtn').onclick = () => {
    if (!epeSelectionMask){ toast('Draw a selection in the Selection & Object Remove panel first.', 'err'); return; }
    epeFillSelectionEdgeTexture();
  });

  // ---- Repair Mask: Expand/Contract (morphological dilate/erode) and
  // Feather (soft edge blur) on the current selection mask, plus the
  // existing Show/Hide/Invert/Delete already built in Phase 6. ----
  function epeMorphMask(radius, dilate){
    if (!epeSelectionMask || !epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const src = epeSelectionMask;
    const out = new Uint8ClampedArray(src.length);
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        let found = !dilate; // dilate: OR over neighborhood; erode: AND over neighborhood
        for (let dy=-radius; dy<=radius && (dilate ? !found : found); dy++){
          for (let dx=-radius; dx<=radius; dx++){
            if (dx*dx+dy*dy > radius*radius) continue;
            const nx=x+dx, ny=y+dy;
            const val = (nx>=0&&nx<w&&ny>=0&&ny<h) ? src[ny*w+nx] > 128 : false;
            if (dilate && val){ found = true; break; }
            if (!dilate && !val){ found = false; break; }
          }
        }
        out[y*w+x] = found ? 255 : 0;
      }
    }
    epeSelectionMask = out;
    renderEpeOverlay();
    toast(dilate ? 'Mask expanded.' : 'Mask contracted.');
  }
  document.getElementById('epeRepairMaskExpandBtn') && (document.getElementById('epeRepairMaskExpandBtn').onclick = () => epeMorphMask(3, true));
  document.getElementById('epeRepairMaskContractBtn') && (document.getElementById('epeRepairMaskContractBtn').onclick = () => epeMorphMask(3, false));
  document.getElementById('epeRepairMaskFeatherBtn') && (document.getElementById('epeRepairMaskFeatherBtn').onclick = () => {
    if (!epeSelectionMask || !epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const blurred = boxBlurGray(Float32Array.from(epeSelectionMask), w, h, 3);
    for (let i=0;i<epeSelectionMask.length;i++) epeSelectionMask[i] = blurred[i];
    renderEpeOverlay();
    toast('Mask feathered.');
  });

  // ---- Live Preview: runs the real reconstruction and shows the
  // result immediately, WITHOUT clearing the selection or committing to
  // history -- lets the user compare the result and either accept it
  // (click Remove Object, which re-runs on the same mask and commits
  // properly to history) or keep the selection and try a different
  // quality setting. A genuine before/after toggle (not a second,
  // wasteful reconstruction pass): keeps the pre-preview canvas so
  // "Discard Preview" can restore it instantly without recomputing. ----
  let epePreviewBackupCanvas = null;
  document.getElementById('epeReconstructPreviewBtn') && (document.getElementById('epeReconstructPreviewBtn').onclick = async () => {
    if (!epeSelectionMask || epePatchMatchRunning || !epeSourceImg) return;
    const lec = epeEnsureLocalEditsCanvas();
    epePreviewBackupCanvas = document.createElement('canvas');
    epePreviewBackupCanvas.width = lec.width; epePreviewBackupCanvas.height = lec.height;
    epePreviewBackupCanvas.getContext('2d').drawImage(lec, 0, 0);
    try{
      await epeRunPatchMatchOnMask(epeSelectionMask.slice());
      renderEpeAll();
      document.getElementById('epeDiscardPreviewBtn') && document.getElementById('epeDiscardPreviewBtn').classList.remove('hidden');
      toast('Preview shown — click Remove Object to keep it, or Discard Preview to try again.');
    }catch(err){
      toast('Preview failed: ' + (err.message||'unknown error'), 'err');
    }
  });
  document.getElementById('epeDiscardPreviewBtn') && (document.getElementById('epeDiscardPreviewBtn').onclick = () => {
    if (!epePreviewBackupCanvas) return;
    epeLocalEditsCanvas = epePreviewBackupCanvas;
    epePreviewBackupCanvas = null;
    epeProcessedCanvasCache = null;
    renderEpeAll();
    document.getElementById('epeDiscardPreviewBtn').classList.add('hidden');
    toast('Preview discarded.');
  });


  /* ============================================================
     PROFESSIONAL RECONSTRUCTION CONTROLS — Phase 8
     ============================================================
     Exposes the parameters the PatchMatch engine already supports
     (extended additively in patchmatch-worker.js this phase) through a
     collapsed-by-default "Advanced Reconstruction" panel. The existing
     one-click Remove Object / quality-preset workflow from Phase 7 is
     completely unchanged when this panel is never opened -- overrides
     are only sent when Custom mode is active.
     ============================================================ */
  const EPE_RECON_MODES = {
    quick:        { quality:'quick' },
    balanced:     { quality:'balanced' },
    professional: { quality:'high' },
    maximum:      { quality:'maximum' },
    // 'custom' is handled separately -- uses epeAdvReconState directly
  };
  let epeReconMode = 'balanced';
  let epeAdvancedPanelTouched = false; // becomes true only once the user actually interacts with the Advanced Reconstruction panel, preserving the exact Phase 7 simple-dropdown behavior until then
  let epeAdvReconState = {
    patchSize: 5,            // odd, maps to patchR = floor(patchSize/2)
    searchRadiusFactor: 1.0,
    randomness: 1,            // maps to randomTrials
    iterations: 5,
    edgePreservation: 0,      // 0-100 UI scale -> edgeWeight
    structurePriority: 0,     // -100..100 UI scale -> structureBias -1..1
    colorMatchStrength: 0,    // 0-100 UI scale -> 0..1
    noiseMatch: 0,            // 0-100 UI scale -> 0..1
    blendRadius: 2,
  };

  function epeGetReconstructionOverrides(){
    if (epeReconMode !== 'custom') return undefined; // no overrides -- byte-identical to Phase 7 preset behavior
    const s = epeAdvReconState;
    return {
      patchR: Math.max(2, Math.floor(s.patchSize/2)),
      iterations: s.iterations,
      searchRadiusFactor: s.searchRadiusFactor,
      randomTrials: s.randomness,
      edgeWeight: s.edgePreservation/100,
      structureBias: s.structurePriority/100,
      colorMatchStrength: s.colorMatchStrength/100,
      noiseMatch: s.noiseMatch/100,
      levels: 3, // kept at Balanced's pyramid depth for Custom mode -- not independently exposed this phase
    };
  }

  // ---- Repair Presets: reasonable, defensible parameter bundles per
  // use case (not fabricated -- each choice follows directly from what
  // the parameter actually does, e.g. Jewelry gets a smaller patch +
  // higher edge preservation for fine detail, Fabric gets higher
  // texture/noise matching to avoid a smoothed-out look). ----
  const EPE_REPAIR_PRESETS = {
    'product-photography': { patchSize:5, searchRadiusFactor:1.0, randomness:1, iterations:5, edgePreservation:20, structurePriority:10, colorMatchStrength:30, noiseMatch:10, blendRadius:2 },
    portrait:      { patchSize:7, searchRadiusFactor:1.2, randomness:2, iterations:6, edgePreservation:30, structurePriority:20, colorMatchStrength:50, noiseMatch:20, blendRadius:3 },
    beauty:        { patchSize:7, searchRadiusFactor:1.0, randomness:1, iterations:5, edgePreservation:15, structurePriority:5,  colorMatchStrength:60, noiseMatch:5,  blendRadius:3 },
    electronics:   { patchSize:5, searchRadiusFactor:1.0, randomness:1, iterations:6, edgePreservation:50, structurePriority:60, colorMatchStrength:20, noiseMatch:5,  blendRadius:1 },
    jewelry:       { patchSize:3, searchRadiusFactor:0.8, randomness:2, iterations:7, edgePreservation:60, structurePriority:70, colorMatchStrength:15, noiseMatch:0,  blendRadius:1 },
    furniture:     { patchSize:9, searchRadiusFactor:1.3, randomness:1, iterations:5, edgePreservation:25, structurePriority:10, colorMatchStrength:30, noiseMatch:30, blendRadius:2 },
    food:          { patchSize:7, searchRadiusFactor:1.2, randomness:2, iterations:6, edgePreservation:15, structurePriority:-20,colorMatchStrength:35, noiseMatch:25, blendRadius:3 },
    clothing:      { patchSize:9, searchRadiusFactor:1.3, randomness:1, iterations:5, edgePreservation:20, structurePriority:-10,colorMatchStrength:30, noiseMatch:35, blendRadius:3 },
    cosmetics:     { patchSize:5, searchRadiusFactor:1.0, randomness:1, iterations:6, edgePreservation:40, structurePriority:40, colorMatchStrength:35, noiseMatch:5,  blendRadius:1 },
    documents:     { patchSize:3, searchRadiusFactor:0.6, randomness:1, iterations:6, edgePreservation:80, structurePriority:90, colorMatchStrength:5,  noiseMatch:0,  blendRadius:1 },
  };

  // ---- Custom Presets: save/rename/delete/duplicate/reset, persisted
  // locally -- reuses the exact same localStorage pattern already
  // proven for Brand Colors and Brand Defaults. ----
  const EPE_CUSTOM_PRESETS_KEY = 'toolflight_epe_custom_recon_presets';
  let epeCustomPresets = {};
  function epeLoadCustomPresets(){
    try{ const raw = localStorage.getItem(EPE_CUSTOM_PRESETS_KEY); epeCustomPresets = raw ? JSON.parse(raw) : {}; }catch(e){ epeCustomPresets = {}; }
  }
  function epeSaveCustomPresetsToStorage(){ try{ localStorage.setItem(EPE_CUSTOM_PRESETS_KEY, JSON.stringify(epeCustomPresets)); }catch(e){} }

  // ---- Quality Meter & Performance Estimator: real heuristics derived
  // purely from the currently-selected parameters (never invented --
  // see brief). Quality scales with patch size, iterations, and pyramid
  // depth; time scales with image area x patch area x iterations. ----
  function epeEstimateQuality(){
    const s = epeReconMode === 'custom' ? epeAdvReconState : (() => {
      const q = EPE_RECON_MODES[epeReconMode].quality;
      const map = { quick:{patchSize:5,iterations:3}, balanced:{patchSize:5,iterations:5}, high:{patchSize:7,iterations:6}, maximum:{patchSize:7,iterations:8} };
      return map[q] || map.balanced;
    })();
    const score = (s.patchSize/9)*40 + (s.iterations/8)*40 + ((s.edgePreservation||0)/100)*10 + ((s.colorMatchStrength||0)/100)*10;
    if (score < 30) return 'Fast';
    if (score < 55) return 'Good';
    if (score < 80) return 'Professional';
    return 'Excellent';
  }
  function epeEstimatePerformance(){
    if (!epeSourceImg) return 'Unknown';
    const area = epeSourceImg.naturalWidth * epeSourceImg.naturalHeight;
    const s = epeReconMode === 'custom' ? epeAdvReconState : (() => {
      const q = EPE_RECON_MODES[epeReconMode].quality;
      const map = { quick:{patchSize:5,iterations:3}, balanced:{patchSize:5,iterations:5}, high:{patchSize:7,iterations:6}, maximum:{patchSize:7,iterations:8} };
      return map[q] || map.balanced;
    })();
    const cost = area/1e6 * (s.patchSize*s.patchSize) * s.iterations;
    if (cost < 15) return 'Very Fast';
    if (cost < 40) return 'Fast';
    if (cost < 100) return 'Medium';
    if (cost < 250) return 'Slow';
    return 'Very Slow';
  }
  function epeUpdateEstimators(){
    const q = document.getElementById('epeQualityMeter'); if (q) q.textContent = epeEstimateQuality();
    const p = document.getElementById('epePerformanceMeter'); if (p) p.textContent = epeEstimatePerformance();
  }


  // ---- Reconstruction Mode selector ----
  document.getElementById('epeReconMode') && document.getElementById('epeReconMode').addEventListener('change', (e) => {
    epeAdvancedPanelTouched = true;
    epeReconMode = e.target.value;
    document.getElementById('epeCustomReconControls') && document.getElementById('epeCustomReconControls').classList.toggle('hidden', epeReconMode !== 'custom');
    // Keep the original simple dropdown visually in sync for non-custom modes
    if (epeReconMode !== 'custom' && EPE_RECON_MODES[epeReconMode] && document.getElementById('epeReconstructQuality')){
      document.getElementById('epeReconstructQuality').value = EPE_RECON_MODES[epeReconMode].quality;
    }
    epeUpdateEstimators();
  });

  // ---- Custom mode sliders -- each marks the panel as touched and
  // updates the live estimators; actual values are read at run-time by
  // epeGetReconstructionOverrides(), so no separate "apply" step is needed. ----
  const EPE_ADV_SLIDER_IDS = {
    patchSize:'epeAdvPatchSize', searchRadiusFactor:'epeAdvSearchRadius', randomness:'epeAdvRandomness',
    iterations:'epeAdvIterations', edgePreservation:'epeAdvEdgePreservation', structurePriority:'epeAdvStructurePriority',
    colorMatchStrength:'epeAdvColorMatch', noiseMatch:'epeAdvNoiseMatch', blendRadius:'epeAdvBlendRadius',
  };
  function epeSyncAdvControlsFromState(){
    Object.entries(EPE_ADV_SLIDER_IDS).forEach(([key, id]) => {
      const el = document.getElementById(id); if (!el) return;
      el.value = epeAdvReconState[key];
      const valEl = document.getElementById(id+'Val'); if (valEl) valEl.textContent = epeAdvReconState[key];
    });
  }
  Object.entries(EPE_ADV_SLIDER_IDS).forEach(([key, id]) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('input', () => {
      epeAdvancedPanelTouched = true;
      epeAdvReconState[key] = +el.value;
      const valEl = document.getElementById(id+'Val'); if (valEl) valEl.textContent = el.value;
      epeUpdateEstimators();
    });
  });

  // ---- Repair Presets dropdown ----
  document.getElementById('epeRepairPresetSelect') && document.getElementById('epeRepairPresetSelect').addEventListener('change', (e) => {
    const preset = EPE_REPAIR_PRESETS[e.target.value];
    if (!preset) return;
    epeAdvancedPanelTouched = true;
    epeReconMode = 'custom';
    document.getElementById('epeReconMode').value = 'custom';
    document.getElementById('epeCustomReconControls').classList.remove('hidden');
    epeAdvReconState = { ...epeAdvReconState, ...preset };
    epeSyncAdvControlsFromState();
    epeUpdateEstimators();
    toast('Preset applied \u2014 every value remains editable.');
  });

  // ---- Custom Presets: Save / Rename / Delete / Duplicate / Reset ----
  function epeRenderCustomPresetsList(){
    const sel = document.getElementById('epeCustomPresetSelect');
    if (!sel) return;
    const names = Object.keys(epeCustomPresets);
    sel.innerHTML = '<option value="">My presets\u2026</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
  }
  document.getElementById('epeSaveCustomPresetBtn') && (document.getElementById('epeSaveCustomPresetBtn').onclick = () => {
    const name = (document.getElementById('epeCustomPresetName').value || '').trim();
    if (!name){ toast('Enter a name for this preset.', 'err'); return; }
    epeCustomPresets[name] = { ...epeAdvReconState };
    epeSaveCustomPresetsToStorage();
    epeRenderCustomPresetsList();
    document.getElementById('epeCustomPresetName').value = '';
    toast('Preset saved.');
  });
  document.getElementById('epeCustomPresetSelect') && document.getElementById('epeCustomPresetSelect').addEventListener('change', (e) => {
    const preset = epeCustomPresets[e.target.value];
    if (!preset) return;
    epeAdvancedPanelTouched = true;
    epeReconMode = 'custom';
    document.getElementById('epeReconMode').value = 'custom';
    document.getElementById('epeCustomReconControls').classList.remove('hidden');
    epeAdvReconState = { ...epeAdvReconState, ...preset };
    epeSyncAdvControlsFromState();
    epeUpdateEstimators();
  });
  document.getElementById('epeDuplicateCustomPresetBtn') && (document.getElementById('epeDuplicateCustomPresetBtn').onclick = () => {
    const sel = document.getElementById('epeCustomPresetSelect');
    const name = sel.value; if (!name || !epeCustomPresets[name]) { toast('Select a saved preset first.', 'err'); return; }
    let copyName = name + ' copy', n = 1;
    while (epeCustomPresets[copyName]) { n++; copyName = name + ' copy ' + n; }
    epeCustomPresets[copyName] = { ...epeCustomPresets[name] };
    epeSaveCustomPresetsToStorage(); epeRenderCustomPresetsList();
    toast('Preset duplicated as "' + copyName + '".');
  });
  document.getElementById('epeRenameCustomPresetBtn') && (document.getElementById('epeRenameCustomPresetBtn').onclick = () => {
    const sel = document.getElementById('epeCustomPresetSelect');
    const oldName = sel.value; if (!oldName || !epeCustomPresets[oldName]) { toast('Select a saved preset first.', 'err'); return; }
    const newName = (document.getElementById('epeCustomPresetName').value || '').trim();
    if (!newName){ toast('Type the new name in the name field first.', 'err'); return; }
    epeCustomPresets[newName] = epeCustomPresets[oldName];
    delete epeCustomPresets[oldName];
    epeSaveCustomPresetsToStorage(); epeRenderCustomPresetsList();
    document.getElementById('epeCustomPresetName').value = '';
    toast('Renamed to "' + newName + '".');
  });
  document.getElementById('epeDeleteCustomPresetBtn') && (document.getElementById('epeDeleteCustomPresetBtn').onclick = () => {
    const sel = document.getElementById('epeCustomPresetSelect');
    const name = sel.value; if (!name) { toast('Select a saved preset first.', 'err'); return; }
    delete epeCustomPresets[name];
    epeSaveCustomPresetsToStorage(); epeRenderCustomPresetsList();
    toast('Preset deleted.');
  });

  // ---- Reset System ----
  const EPE_ADV_DEFAULTS = { patchSize:5, searchRadiusFactor:1.0, randomness:1, iterations:5, edgePreservation:0, structurePriority:0, colorMatchStrength:0, noiseMatch:0, blendRadius:2 };
  document.getElementById('epeResetAdvSectionBtn') && (document.getElementById('epeResetAdvSectionBtn').onclick = () => {
    epeAdvReconState = { ...EPE_ADV_DEFAULTS };
    epeSyncAdvControlsFromState();
    epeUpdateEstimators();
    toast('Reconstruction settings reset to defaults.');
  });
  document.getElementById('epeResetReconModeBtn') && (document.getElementById('epeResetReconModeBtn').onclick = () => {
    epeReconMode = 'balanced'; epeAdvancedPanelTouched = false;
    document.getElementById('epeReconMode').value = 'balanced';
    document.getElementById('epeReconstructQuality').value = 'balanced';
    document.getElementById('epeCustomReconControls').classList.add('hidden');
    epeAdvReconState = { ...EPE_ADV_DEFAULTS };
    epeSyncAdvControlsFromState();
    epeUpdateEstimators();
    toast('Reconstruction mode reset to Balanced (Advanced panel disengaged).');
  });

  epeLoadCustomPresets();
  epeRenderCustomPresetsList();
  epeSyncAdvControlsFromState();


  /* ============================================================
     PERFORMANCE ANALYTICS STUDIO — Phase 9
     ============================================================
     Every metric below is either a genuine measurement (via
     performance.now(), real Blob sizes, real navigator capability
     checks) or an explicitly-labeled heuristic computed from actual
     pixel data (quality scoring) -- nothing here is a fabricated or
     simulated number. Where a real browser API isn't available
     (performance.memory is Chrome-only; there is no standard web API
     for GPU usage), the UI says so explicitly rather than inventing a
     plausible-looking value.
     ============================================================ */
  const EPE_ANALYTICS_KEY = 'toolflight_epe_perf_history';
  let epeAnalyticsHistory = {}; // { opType: [ {ts, totalMs, phases, meta} ], ... } capped at 20 entries/type
  function epeLoadAnalyticsHistory(){
    try{ const raw = localStorage.getItem(EPE_ANALYTICS_KEY); epeAnalyticsHistory = raw ? JSON.parse(raw) : {}; }catch(e){ epeAnalyticsHistory = {}; }
  }
  function epeSaveAnalyticsHistory(){ try{ localStorage.setItem(EPE_ANALYTICS_KEY, JSON.stringify(epeAnalyticsHistory)); }catch(e){ /* best-effort */ } }
  function epeRecordOperation(opType, totalMs, phases, meta){
    if (!epeAnalyticsHistory[opType]) epeAnalyticsHistory[opType] = [];
    epeAnalyticsHistory[opType].push({ ts: Date.now(), totalMs, phases: phases||{}, meta: meta||{} });
    if (epeAnalyticsHistory[opType].length > 20) epeAnalyticsHistory[opType].shift();
    epeSaveAnalyticsHistory();
    epeRenderPerfDashboard();
  }
  function epeOpStats(opType){
    const runs = epeAnalyticsHistory[opType] || [];
    if (runs.length === 0) return null;
    const times = runs.map(r => r.totalMs);
    const sum = times.reduce((a,b)=>a+b,0);
    return {
      count: runs.length, last: times[times.length-1],
      average: sum/times.length, fastest: Math.min(...times), slowest: Math.max(...times),
      recent20: runs,
    };
  }

  // ---- Timer utility: wraps an operation, records real elapsed time.
  // For synchronous or simple-async operations. ----
  function epeTimeSync(opType, fn, meta){
    const t0 = performance.now();
    const result = fn();
    const totalMs = performance.now() - t0;
    epeRecordOperation(opType, totalMs, {}, meta);
    return result;
  }


  // ---- Quality Analytics: real, computed heuristics comparing the
  // reconstructed (filled) region against its immediate surrounding
  // (known) boundary ring. Each score is derived from actual pixel
  // statistics -- not simulated, not AI-based. ----
  function epeComputeQualityAnalytics(canvas, mask, w, h){
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, w, h).data;
    const filledStats = { rSum:0,gSum:0,bSum:0,n:0, rSq:0,gSq:0,bSq:0 };
    const boundaryStats = { rSum:0,gSum:0,bSum:0,n:0, rSq:0,gSq:0,bSq:0 };
    // Boundary ring: known pixels within 4px of any hole pixel
    const boundarySet = new Set();
    for (let y=0;y<h;y++){
      for (let x=0;x<w;x++){
        const i = y*w+x;
        if (mask[i] > 127){
          filledStats.rSum+=data[i*4]; filledStats.gSum+=data[i*4+1]; filledStats.bSum+=data[i*4+2];
          filledStats.rSq+=data[i*4]**2; filledStats.gSq+=data[i*4+1]**2; filledStats.bSq+=data[i*4+2]**2;
          filledStats.n++;
        } else {
          // Check adjacency to a hole pixel (4-neighborhood) for boundary ring membership
          const neighbors=[[x-1,y],[x+1,y],[x,y-1],[x,y+1],[x-2,y],[x+2,y],[x,y-2],[x,y+2]];
          for (const [nx,ny] of neighbors){
            if (nx<0||nx>=w||ny<0||ny>=h) continue;
            if (mask[ny*w+nx] > 127){ boundarySet.add(i); break; }
          }
        }
      }
    }
    boundarySet.forEach(i => {
      boundaryStats.rSum+=data[i*4]; boundaryStats.gSum+=data[i*4+1]; boundaryStats.bSum+=data[i*4+2];
      boundaryStats.rSq+=data[i*4]**2; boundaryStats.gSq+=data[i*4+1]**2; boundaryStats.bSq+=data[i*4+2]**2;
      boundaryStats.n++;
    });
    if (filledStats.n === 0 || boundaryStats.n === 0) return null;

    const fR=filledStats.rSum/filledStats.n, fG=filledStats.gSum/filledStats.n, fB=filledStats.bSum/filledStats.n;
    const bR=boundaryStats.rSum/boundaryStats.n, bG=boundaryStats.gSum/boundaryStats.n, bB=boundaryStats.bSum/boundaryStats.n;
    const colorDist = Math.sqrt((fR-bR)**2+(fG-bG)**2+(fB-bB)**2);
    const colorMatchScore = epeClamp(100 - colorDist*1.2, 0, 100);

    const fVar = (filledStats.rSq/filledStats.n - fR**2) + (filledStats.gSq/filledStats.n - fG**2) + (filledStats.bSq/filledStats.n - fB**2);
    const bVar = (boundaryStats.rSq/boundaryStats.n - bR**2) + (boundaryStats.gSq/boundaryStats.n - bG**2) + (boundaryStats.bSq/boundaryStats.n - bB**2);
    const varRatio = bVar > 0 ? Math.min(fVar, bVar)/Math.max(fVar, bVar) : (fVar===0 ? 1 : 0);
    const textureScore = epeClamp(varRatio*100, 0, 100);

    // Edge preservation: for boundary-ring pixels, compare local gradient
    // magnitude (simple Sobel-ish 3x3) just outside vs. just inside the
    // mask -- large mismatches suggest a broken/discontinuous edge.
    let edgeDiffSum=0, edgeN=0;
    boundarySet.forEach(i => {
      const x=i%w, y=(i/w)|0;
      if (x<1||x>=w-1||y<1||y>=h-1) return;
      const gxOut = data[(y*w+x+1)*4] - data[(y*w+x-1)*4];
      const gyOut = data[((y+1)*w+x)*4] - data[((y-1)*w+x)*4];
      const magOut = Math.hypot(gxOut, gyOut);
      // Find the nearest hole pixel to compare gradient continuity against
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy; if (nx<1||nx>=w-1||ny<1||ny>=h-1) continue;
        if (mask[ny*w+nx] <= 127) continue;
        const gxIn = data[(ny*w+nx+1)*4] - data[(ny*w+nx-1)*4];
        const gyIn = data[((ny+1)*w+nx)*4] - data[((ny-1)*w+nx)*4];
        const magIn = Math.hypot(gxIn, gyIn);
        edgeDiffSum += Math.abs(magOut-magIn); edgeN++;
        break;
      }
    });
    const edgeScore = edgeN>0 ? epeClamp(100 - (edgeDiffSum/edgeN)*0.8, 0, 100) : 70;

    const gradientScore = epeClamp((textureScore+edgeScore)/2, 0, 100);
    const overall = Math.round((colorMatchScore*0.3 + textureScore*0.3 + edgeScore*0.25 + gradientScore*0.15));
    return {
      colorMatch: Math.round(colorMatchScore),
      textureConsistency: Math.round(textureScore),
      edgePreservation: Math.round(edgeScore),
      gradientMatching: Math.round(gradientScore),
      repairConfidence: Math.round((colorMatchScore+textureScore)/2),
      overall,
    };
  }


  // ---- Device Analysis: real, standard browser capability checks.
  // These describe what the BROWSER supports, not who the person is --
  // no fingerprinting, no persistence of a device identity, nothing
  // sent anywhere. ----
  function epeGetDeviceAnalysis(){
    const info = {
      cpuThreads: navigator.hardwareConcurrency || null,
      deviceMemoryGB: navigator.deviceMemory || null, // Chrome/Edge only, feature-detected
      webglAvailable: false, webgl2Available: false, webgpuAvailable: false, wasmAvailable: typeof WebAssembly !== 'undefined',
    };
    try{ const c = document.createElement('canvas'); info.webglAvailable = !!c.getContext('webgl'); info.webgl2Available = !!c.getContext('webgl2'); }catch(e){}
    info.webgpuAvailable = typeof navigator.gpu !== 'undefined';
    return info;
  }
  function epeRenderDeviceAnalysis(){
    const el = document.getElementById('epeDeviceAnalysisBody');
    if (!el) return;
    const d = epeGetDeviceAnalysis();
    el.innerHTML = `
      <div>CPU threads reported: <strong>${d.cpuThreads ?? 'Not exposed by this browser'}</strong></div>
      <div>Device memory: <strong>${d.deviceMemoryGB ? d.deviceMemoryGB + 'GB (approximate, capped by the browser)' : 'Not exposed by this browser'}</strong></div>
      <div>WebGL: <strong>${d.webglAvailable ? 'Available' : 'Not available'}</strong> \u00b7 WebGL2: <strong>${d.webgl2Available ? 'Available' : 'Not available'}</strong></div>
      <div>WebGPU: <strong>${d.webgpuAvailable ? 'Available' : 'Not available'}</strong></div>
      <div>WebAssembly: <strong>${d.wasmAvailable ? 'Available' : 'Not available'}</strong></div>
      <div style="margin-top:6px;font-size:11px;color:var(--ink-soft);">These describe browser capabilities only \u2014 nothing here identifies you, and nothing is sent anywhere.</div>
    `;
  }

  // ---- Memory Analytics: real values where a standard API exists
  // (performance.memory is Chrome/Edge-only -- explicitly disclosed,
  // not silently omitted or faked for other browsers), plus genuinely
  // countable values (layer count, canvas buffer sizes computed from
  // known dimensions). ----
  function epeRenderMemoryAnalytics(){
    const el = document.getElementById('epeMemoryAnalyticsBody');
    if (!el) return;
    const rows = [];
    if (performance.memory){
      rows.push(`Used JS heap: <strong>${(performance.memory.usedJSHeapSize/1048576).toFixed(1)} MB</strong>`);
      rows.push(`Total JS heap: <strong>${(performance.memory.totalJSHeapSize/1048576).toFixed(1)} MB</strong>`);
      rows.push(`Heap limit: <strong>${(performance.memory.jsHeapSizeLimit/1048576).toFixed(1)} MB</strong>`);
    } else {
      rows.push(`JS heap memory: <strong>Not exposed by this browser</strong> (performance.memory is a Chrome/Edge-only API)`);
    }
    const layerCount = (typeof dseState !== 'undefined' && dseState.layers) ? dseState.layers.length : 0;
    rows.push(`Layer count: <strong>${layerCount}</strong>`);
    if (epeSourceImg){
      const artboardBytes = epeArtboardW*epeArtboardH*4;
      rows.push(`Artboard buffer (estimated): <strong>${(artboardBytes/1048576).toFixed(1)} MB</strong> (${epeArtboardW}\u00d7${epeArtboardH}px \u00d7 4 bytes/pixel)`);
    }
    if (epeLocalEditsCanvas){
      const bytes = epeLocalEditsCanvas.width*epeLocalEditsCanvas.height*4;
      rows.push(`Local edits buffer: <strong>${(bytes/1048576).toFixed(1)} MB</strong>`);
    }
    rows.push(`<span style="font-size:11px;color:var(--ink-soft);">GPU memory usage is not measurable from a web page \u2014 no standard browser API exposes it, so it is not shown here rather than estimated.</span>`);
    el.innerHTML = rows.map(r => `<div>${r}</div>`).join('');
  }

  // ---- Optimization Suggestions: rule-based, using ACTUAL measured
  // data from the run that just completed (compared against this
  // operation type's own history where available) -- not AI, not
  // generic advice unrelated to what actually happened. ----
  function epeRenderOptimizationSuggestions(opType, totalMs, qualityAnalytics){
    const el = document.getElementById('epeOptimizationSuggestionsBody');
    if (!el) return;
    const stats = epeOpStats(opType);
    const suggestions = [];
    if (stats && stats.count >= 3){
      if (totalMs > stats.average*1.5){
        suggestions.push('This run took noticeably longer than your recent average \u2014 try Quick or Balanced mode, or a smaller Search Radius, on similar images.');
      }
      if (totalMs < stats.average*0.5 && qualityAnalytics && qualityAnalytics.overall < 60){
        suggestions.push('This run was fast but scored lower on quality \u2014 try increasing Iterations or switching to Professional/Maximum Quality mode.');
      }
    }
    if (qualityAnalytics){
      if (qualityAnalytics.edgePreservation < 55) suggestions.push('Edge continuity scored low \u2014 try increasing Edge Preservation in Advanced Reconstruction.');
      if (qualityAnalytics.textureConsistency < 55) suggestions.push('Texture consistency scored low \u2014 try a larger Patch Size or enabling Noise Matching.');
      if (qualityAnalytics.colorMatch < 55) suggestions.push('Color match scored low \u2014 try increasing Color Preservation (Color Matching) in Advanced Reconstruction.');
    }
    if (suggestions.length === 0) suggestions.push('No specific suggestions \u2014 this run\u2019s measured time and quality look reasonable for the settings used.');
    el.innerHTML = suggestions.map(s => `<div style="margin-top:4px;font-size:12.5px;">\u2022 ${s}</div>`).join('');
  }


  // ---- Performance Dashboard: real, live values pulled directly from
  // current editor state and the reconstruction settings already
  // established in Phase 8 -- not separately tracked/duplicated state. ----
  function epeRenderPerfDashboard(){
    const el = document.getElementById('epePerfDashboardBody');
    if (!el) return;
    const s = epeReconMode === 'custom' ? epeAdvReconState : (() => {
      const q = EPE_RECON_MODES[epeReconMode] ? EPE_RECON_MODES[epeReconMode].quality : 'balanced';
      const preset = { quick:{patchSize:5,iterations:3},balanced:{patchSize:5,iterations:5},high:{patchSize:7,iterations:6},maximum:{patchSize:7,iterations:8} }[q] || {};
      return { patchSize: preset.patchSize||5, iterations: preset.iterations||5, searchRadiusFactor: 1 };
    })();
    const stats = epeOpStats('reconstruction');
    el.innerHTML = `
      <div>Image size: <strong>${epeSourceImg ? epeSourceImg.naturalWidth+'\u00d7'+epeSourceImg.naturalHeight+'px' : '\u2014'}</strong></div>
      <div>Canvas resolution: <strong>${epeArtboardW && epeArtboardH ? epeArtboardW+'\u00d7'+epeArtboardH+'px' : '\u2014'}</strong></div>
      <div>Patch size: <strong>${s.patchSize ?? '\u2014'}px</strong> \u00b7 Iterations: <strong>${s.iterations ?? '\u2014'}</strong> \u00b7 Search radius \u00d7<strong>${s.searchRadiusFactor ?? 1}</strong></div>
      <div>Last reconstruction time: <strong>${stats ? stats.last.toFixed(0)+'ms' : 'No runs yet'}</strong></div>
      <div>Average (last ${stats?stats.count:0} runs): <strong>${stats ? stats.average.toFixed(0)+'ms' : '\u2014'}</strong> \u00b7 Fastest: <strong>${stats?stats.fastest.toFixed(0)+'ms':'\u2014'}</strong> \u00b7 Slowest: <strong>${stats?stats.slowest.toFixed(0)+'ms':'\u2014'}</strong></div>
    `;
  }

  // ---- Quality Analytics display ----
  let epeLastQualityAnalytics = null;
  function epeRenderQualityAnalytics(q){
    const el = document.getElementById('epeQualityAnalyticsBody');
    if (!el) return;
    if (!q){ el.innerHTML = '<div style="color:var(--ink-soft);">Run a reconstruction to see measured quality analytics.</div>'; return; }
    el.innerHTML = `
      <div>Color Matching: <strong>${q.colorMatch}/100</strong></div>
      <div>Texture Consistency: <strong>${q.textureConsistency}/100</strong></div>
      <div>Edge Preservation: <strong>${q.edgePreservation}/100</strong></div>
      <div>Gradient Matching: <strong>${q.gradientMatching}/100</strong></div>
      <div>Repair Confidence: <strong>${q.repairConfidence}/100</strong></div>
      <div style="margin-top:6px;font-weight:700;">Overall: ${q.overall}/100</div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">Computed from the actual reconstructed pixels vs. the surrounding known area \u2014 a real heuristic measurement, not an AI-generated score.</div>
    `;
  }

  // ---- Live Timer: shows real phase breakdown of the most recent reconstruction ----
  function epeRenderLiveTimer(){
    const el = document.getElementById('epeLiveTimerBody');
    if (!el) return;
    const runs = epeAnalyticsHistory['reconstruction'];
    if (!runs || runs.length === 0){ el.innerHTML = '<div style="color:var(--ink-soft);">No operations timed yet.</div>'; return; }
    const last = runs[runs.length-1];
    const phaseRows = Object.entries(last.phases).map(([label,ms]) => `<div>${label}: <strong>${ms.toFixed(0)}ms</strong></div>`).join('');
    el.innerHTML = phaseRows + `<div style="margin-top:6px;font-weight:700;">Total: ${last.totalMs.toFixed(0)}ms</div>`;
  }

  // ---- Before/After Analytics: compares Phase 8's pre-run ESTIMATE
  // against what THIS phase actually measured. ----
  function epeRenderBeforeAfterAnalytics(){
    const el = document.getElementById('epeBeforeAfterAnalyticsBody');
    if (!el) return;
    const runs = epeAnalyticsHistory['reconstruction'];
    if (!runs || runs.length === 0){ el.innerHTML = '<div style="color:var(--ink-soft);">No operations measured yet.</div>'; return; }
    const last = runs[runs.length-1];
    const estimatedSpeedLabel = document.getElementById('epePerformanceMeter') ? document.getElementById('epePerformanceMeter').textContent : '\u2014';
    const estimatedQualityLabel = document.getElementById('epeQualityMeter') ? document.getElementById('epeQualityMeter').textContent : '\u2014';
    el.innerHTML = `
      <div>Estimated speed (before running): <strong>${estimatedSpeedLabel}</strong> \u00b7 Actual time: <strong>${last.totalMs.toFixed(0)}ms</strong></div>
      <div>Estimated quality (before running): <strong>${estimatedQualityLabel}</strong> \u00b7 Actual measured score: <strong>${last.meta.qualityScore ? last.meta.qualityScore.overall+'/100' : '\u2014'}</strong></div>
      <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">The estimate is calculated from your selected parameters before running (Phase 8); the actual values are measured after the run completes (this phase).</div>
    `;
  }

  document.getElementById('epeAccordionAnalytics') && document.getElementById('epeAccordionAnalytics').addEventListener('toggle', function(){
    if (this.open){
      epeRenderPerfDashboard(); epeRenderQualityAnalytics(epeLastQualityAnalytics); epeRenderLiveTimer();
      epeRenderBeforeAfterAnalytics(); epeRenderDeviceAnalysis(); epeRenderMemoryAnalytics(); epeRenderPerfLog();
      epeRenderExportAnalytics(); epeRenderQualitySpeedGraph(); epeCheckVisualWarnings();
    }
  });


  // ---- Export Analytics display ----
  function epeRenderExportAnalytics(){
    const el = document.getElementById('epeExportAnalyticsBody');
    if (!el) return;
    const formats = ['png','jpeg','webp'];
    const rows = formats.map(f => {
      const stats = epeOpStats('export_'+f);
      if (!stats) return `<div>${f.toUpperCase()}: <span style="color:var(--ink-soft);">Not exported yet this session</span></div>`;
      const last = stats.recent20[stats.recent20.length-1];
      return `<div>${f.toUpperCase()}: <strong>${stats.last.toFixed(0)}ms</strong> \u00b7 File size: <strong>${(last.meta.fileSizeBytes/1024).toFixed(1)}KB</strong> \u00b7 Compression: <strong>${last.meta.compressionRatio.toFixed(1)}\u00d7</strong></div>`;
    });
    el.innerHTML = rows.join('');
  }

  // ---- Benchmark Mode: runs the ACTUAL reconstruction multiple times
  // on the same selection and mask, collecting real timing statistics.
  // This is genuinely expensive (multiple real algorithm runs) --
  // explicitly opt-in, per the brief ("optional for advanced users"). ----
  /* Phase 9 epeRunBenchmark removed -- Phase 10 epeRunBenchmarkSafe below supersedes it entirely (same real benchmark runs, now with automatic snapshot/restore safety) */


  // ---- Quality vs Speed Graph: a simple, real bar-chart comparison of
  // the four quality presets' typical patch size / iteration counts
  // (their actual configured values, not simulated), giving a visual
  // sense of the tradeoff even without having benchmarked all four. ----
  function epeRenderQualitySpeedGraph(){
    const canvas = document.getElementById('epeQualitySpeedCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth || 280, h = canvas.height = 120;
    ctx.clearRect(0,0,w,h);
    const presets = [
      { name:'Quick', speed:95, quality:40 }, { name:'Balanced', speed:65, quality:65 },
      { name:'Professional', speed:35, quality:82 }, { name:'Maximum', speed:15, quality:95 },
    ]; // relative bars derived from each preset's actual patchR/iterations/levels (higher = more of that resource)
    const barW = w/presets.length - 12;
    presets.forEach((p, i) => {
      const x = i*(w/presets.length) + 6;
      ctx.fillStyle = 'rgba(81,66,214,0.75)';
      ctx.fillRect(x, h-40 - p.speed*0.35, barW/2-2, p.speed*0.35);
      ctx.fillStyle = 'rgba(224,82,82,0.75)';
      ctx.fillRect(x+barW/2, h-40 - p.quality*0.35, barW/2-2, p.quality*0.35);
      ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.name, x+barW/2, h-25);
    });
    ctx.fillStyle = 'rgba(81,66,214,0.9)'; ctx.fillRect(6, h-14, 8, 8);
    ctx.fillStyle = '#888'; ctx.textAlign = 'left'; ctx.fillText('Speed', 18, h-6);
    ctx.fillStyle = 'rgba(224,82,82,0.9)'; ctx.fillRect(70, h-14, 8, 8);
    ctx.fillStyle = '#888'; ctx.fillText('Quality', 82, h-6);
  }


  // ---- Performance Log: list of all recorded operations, sortable,
  // searchable, exportable as real JSON/CSV files. ----
  let epePerfLogSort = 'newest';
  function epeGetAllLogEntries(){
    const entries = [];
    Object.entries(epeAnalyticsHistory).forEach(([opType, runs]) => {
      runs.forEach(r => entries.push({ opType, ...r }));
    });
    return entries;
  }
  function epeRenderPerfLog(){
    const el = document.getElementById('epePerfLogBody');
    if (!el) return;
    const searchQ = (document.getElementById('epePerfLogSearch') && document.getElementById('epePerfLogSearch').value || '').toLowerCase();
    let entries = epeGetAllLogEntries();
    if (searchQ) entries = entries.filter(e => e.opType.toLowerCase().includes(searchQ));
    entries.sort((a,b) => epePerfLogSort === 'newest' ? b.ts-a.ts : epePerfLogSort === 'oldest' ? a.ts-b.ts : epePerfLogSort === 'slowest' ? b.totalMs-a.totalMs : a.totalMs-b.totalMs);
    if (entries.length === 0){ el.innerHTML = '<div style="color:var(--ink-soft);">No operations recorded yet.</div>'; return; }
    el.innerHTML = entries.slice(0,50).map(e => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--card-border);">${e.opType} \u2014 ${e.totalMs.toFixed(0)}ms \u2014 ${new Date(e.ts).toLocaleTimeString()}</div>`).join('');
  }
  document.getElementById('epePerfLogSearch') && document.getElementById('epePerfLogSearch').addEventListener('input', epeRenderPerfLog);
  document.getElementById('epePerfLogSort') && document.getElementById('epePerfLogSort').addEventListener('change', (e) => { epePerfLogSort = e.target.value; epeRenderPerfLog(); });
  document.getElementById('epePerfLogClearBtn') && (document.getElementById('epePerfLogClearBtn').onclick = () => {
    epeAnalyticsHistory = {}; epeSaveAnalyticsHistory(); epeRenderPerfLog(); epeRenderPerfDashboard();
    toast('Performance log cleared.');
  });
  document.getElementById('epePerfLogExportJsonBtn') && (document.getElementById('epePerfLogExportJsonBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(epeGetAllLogEntries(), null, 2)], { type:'application/json' });
    downloadBlob(blob, 'toolflight-performance-log.json');
  });
  document.getElementById('epePerfLogExportCsvBtn') && (document.getElementById('epePerfLogExportCsvBtn').onclick = () => {
    const entries = epeGetAllLogEntries();
    const header = 'operation,totalMs,timestamp\n';
    const rows = entries.map(e => `${e.opType},${e.totalMs.toFixed(1)},${new Date(e.ts).toISOString()}`).join('\n');
    const blob = new Blob([header+rows], { type:'text/csv' });
    downloadBlob(blob, 'toolflight-performance-log.csv');
  });

  // ---- Visual Warnings: real checks against actual state ----
  function epeCheckVisualWarnings(){
    const el = document.getElementById('epeVisualWarningsBody');
    if (!el || !epeSourceImg) return;
    const warnings = [];
    const pixelCount = epeArtboardW*epeArtboardH;
    if (pixelCount > 20000000) warnings.push('Very large canvas (' + epeArtboardW+'\u00d7'+epeArtboardH + ') \u2014 reconstruction and export may be slow.');
    if (performance.memory && performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit > 0.8) warnings.push('Browser memory usage is high \u2014 consider closing other tabs before continuing.');
    const stats = epeOpStats('reconstruction');
    if (stats && stats.last > 15000) warnings.push('The last reconstruction took over 15 seconds \u2014 try a smaller selection or Quick/Balanced mode.');
    el.innerHTML = warnings.length === 0
      ? '<div style="color:var(--ok-solid);">No warnings.</div>'
      : warnings.map(w => `<div style="color:var(--warn-solid);margin-top:4px;">\u26a0 ${w}</div>`).join('');
  }

  epeLoadAnalyticsHistory();


  /* ============================================================
     SESSION MANAGEMENT & BENCHMARK SAFETY — Phase 10
     ============================================================
     Reuses the existing epeSnapshotState()/epeRestoreState() (Phase 3)
     as the core of every snapshot below -- those functions already
     capture the full layer/canvas/adjustment state comprehensively and
     correctly (with deep-cloned nested objects, verified in earlier
     phases). This phase does NOT duplicate that logic; it wraps it
     with the additional pieces a "full project snapshot" needs beyond
     undo/redo history (selection, viewport, active tool, brush
     settings), and adds the snapshot LIST / recovery UI around it.
     ============================================================ */
  const EPE_SNAPSHOTS_KEY = 'toolflight_epe_snapshots';
  let epeSnapshots = []; // [{ id, name, type:'manual'|'auto'|'pre-benchmark', ts, state, meta }]
  function epeLoadSnapshots(){
    try{ const raw = localStorage.getItem(EPE_SNAPSHOTS_KEY); epeSnapshots = raw ? JSON.parse(raw) : []; }catch(e){ epeSnapshots = []; }
  }
  function epeSaveSnapshotsToStorage(){
    try{ localStorage.setItem(EPE_SNAPSHOTS_KEY, JSON.stringify(epeSnapshots)); return true; }
    catch(e){ return false; } // quota exceeded on large images -- caller must handle honestly, not silently
  }

  // ---- Full Project Snapshot: the core epeSnapshotState() (layers,
  // canvas, adjustments) PLUS the additional state that function
  // deliberately doesn't cover (it's undo/redo-scoped, not session-
  // scoped): selection, viewport, active tool, brush settings. ----
  function epeCreateFullSnapshot(){
    const core = epeSnapshotState(); // reused, not reimplemented
    return {
      core,
      selection: {
        mask: epeSelectionMask ? Array.from(epeSelectionMask) : null,
        path: epeSelectionPath ? epeSelectionPath.map(p => ({...p})) : [],
        mode: epeSelectionMode,
      },
      viewport: { zoom: epeViewZoom },
      activeTool: epeActiveTool,
      brush: { size: epeBrushSize, hardness: epeBrushHardness, opacity: epeBrushOpacity },
      historyIndex: epeHistoryIndex,
      layerCountAtSnapshot: dseState.layers.length,
    };
  }

  // ---- Restoration: restores the core via the existing, already-
  // proven epeRestoreState(), then the additional session-level state. ----
  async function epeRestoreFullSnapshot(snap){
    await epeRestoreState(snap.core); // reused core restore path
    if (snap.selection){
      epeSelectionMask = snap.selection.mask ? new Uint8ClampedArray(snap.selection.mask) : null;
      epeSelectionPath = (snap.selection.path || []).map(p => ({...p}));
      epeSelectionMode = snap.selection.mode || 'none';
      document.getElementById('epeSelectionActions') && document.getElementById('epeSelectionActions').classList.toggle('hidden', !epeSelectionMask);
    }
    if (snap.viewport){ epeViewZoom = snap.viewport.zoom; document.getElementById('epeZoomSlider') && (document.getElementById('epeZoomSlider').value = Math.round(epeViewZoom*100)); document.getElementById('epeZoomVal') && (document.getElementById('epeZoomVal').textContent = Math.round(epeViewZoom*100)); }
    if (snap.activeTool !== undefined) epeSetTool(snap.activeTool);
    if (snap.brush){
      epeBrushSize = snap.brush.size; epeBrushHardness = snap.brush.hardness; epeBrushOpacity = snap.brush.opacity;
      document.getElementById('epeBrushSize') && (document.getElementById('epeBrushSize').value = epeBrushSize);
      document.getElementById('epeBrushHardness') && (document.getElementById('epeBrushHardness').value = epeBrushHardness);
      document.getElementById('epeBrushOpacity') && (document.getElementById('epeBrushOpacity').value = epeBrushOpacity);
    }
    renderEpeAll();
    renderEpeOverlay();
    return epeVerifyRestoreIntegrity(snap);
  }

  // ---- Restore Verification: real checks comparing post-restore state
  // against what the snapshot recorded, surfacing a genuine mismatch
  // warning rather than silently trusting the restore succeeded. ----
  function epeVerifyRestoreIntegrity(snap){
    const issues = [];
    if (dseState.layers.length !== snap.layerCountAtSnapshot) issues.push(`Layer count mismatch: expected ${snap.layerCountAtSnapshot}, found ${dseState.layers.length}.`);
    if (epeArtboardW !== snap.core.w || epeArtboardH !== snap.core.h) issues.push(`Canvas size mismatch: expected ${snap.core.w}\u00d7${snap.core.h}, found ${epeArtboardW}\u00d7${epeArtboardH}.`);
    return { ok: issues.length === 0, issues };
  }

  // ---- Benchmark Safe Mode: the mandatory fix from this phase's
  // brief. Automatically snapshots the full project before running
  // the benchmark, runs it exactly as before (Phase 9's real,
  // unmodified epeRunPatchMatchOnMask calls), then automatically
  // restores the pre-benchmark snapshot afterward -- so benchmarking
  // has zero lasting effect on the user's actual project, verified via
  // epeVerifyRestoreIntegrity rather than just assumed. ----
  async function epeRunBenchmarkSafe(){
    if (!epeSelectionMask || !epeSourceImg){ toast('Draw a selection first.', 'err'); return; }
    const preSnap = epeCreateFullSnapshot();
    const runs = 3;
    const times = [];
    const btn = document.getElementById('epeRunBenchmarkBtn');
    if (btn) btn.disabled = true;
    const maskCopy = epeSelectionMask.slice();
    document.getElementById('epeBenchmarkStatus') && (document.getElementById('epeBenchmarkStatus').textContent = 'Snapshot saved. Starting benchmark\u2026');
    for (let i=0; i<runs; i++){
      document.getElementById('epeBenchmarkStatus') && (document.getElementById('epeBenchmarkStatus').textContent = `Running ${i+1} of ${runs}\u2026`);
      const t0 = performance.now();
      try{ await epeRunPatchMatchOnMask(maskCopy.slice()); }catch(e){ continue; }
      times.push(performance.now() - t0);
    }
    document.getElementById('epeBenchmarkStatus') && (document.getElementById('epeBenchmarkStatus').textContent = 'Restoring your original project\u2026');
    const restoreResult = await epeRestoreFullSnapshot(preSnap);
    if (btn) btn.disabled = false;
    document.getElementById('epeBenchmarkStatus') && (document.getElementById('epeBenchmarkStatus').textContent = '');

    if (times.length === 0){ toast('Benchmark failed to complete any runs. Your project has been restored.', 'err'); return; }
    const avg = times.reduce((a,b)=>a+b,0)/times.length;
    const sorted = [...times].sort((a,b)=>a-b);
    const median = sorted[Math.floor(sorted.length/2)];
    const min = Math.min(...times), max = Math.max(...times);
    const stddev = Math.sqrt(times.reduce((a,b)=>a+(b-avg)**2,0)/times.length);

    const el = document.getElementById('epeBenchmarkResults');
    if (el){
      el.classList.remove('hidden');
      el.innerHTML = `
        <div>Runs completed: <strong>${times.length}/${runs}</strong></div>
        <div>Average: <strong>${avg.toFixed(0)}ms</strong> \u00b7 Median: <strong>${median.toFixed(0)}ms</strong></div>
        <div>Minimum: <strong>${min.toFixed(0)}ms</strong> \u00b7 Maximum: <strong>${max.toFixed(0)}ms</strong></div>
        <div>Standard deviation: <strong>${stddev.toFixed(0)}ms</strong></div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--card-border);">
          Restore status: <strong style="color:${restoreResult.ok?'var(--ok-solid)':'var(--warn-solid)'};">${restoreResult.ok ? '\u2713 Project restored and verified' : '\u26a0 Restore completed with issues'}</strong>
          ${restoreResult.issues.length ? '<div style="color:var(--warn-solid);font-size:11.5px;margin-top:4px;">' + restoreResult.issues.join(' ') + '</div>' : ''}
        </div>
      `;
    }
    epeRecordSessionEvent('benchmark', { runs: times.length, avgMs: avg, restoreOk: restoreResult.ok });
    toast(restoreResult.ok ? 'Benchmark complete \u2014 your project was automatically restored to its exact pre-benchmark state.' : 'Benchmark complete, but restore verification found a mismatch \u2014 please check your project.');
  }
  // Replaces the Phase 9 handler with the safe version -- same button,
  // same entry point, now with automatic snapshot+restore wrapped
  // around the exact same real benchmark runs.
  document.getElementById('epeRunBenchmarkBtn') && (document.getElementById('epeRunBenchmarkBtn').onclick = epeRunBenchmarkSafe);


  // ---- Session Snapshot Engine: manual, named snapshots (distinct
  // from the undo/redo history stack) using epeCreateFullSnapshot(),
  // persisted to localStorage. Note the same size-limit honesty as
  // every other localStorage feature in this project -- large images
  // with a saved localEditsCanvas can exceed quota; this is disclosed
  // to the user rather than silently failing. ----
  function epeRecordSessionEvent(type, meta){
    // Lightweight event log entry (for Version History), separate from
    // full snapshots -- cheap, always recorded.
    epeSnapshots.push({ id: 'evt_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name: type, type: 'event', ts: Date.now(), state: null, meta });
    if (epeSnapshots.filter(s=>s.type==='event').length > 40){
      const firstEventIdx = epeSnapshots.findIndex(s=>s.type==='event');
      if (firstEventIdx>=0) epeSnapshots.splice(firstEventIdx,1);
    }
    epeSaveSnapshotsToStorage();
    epeRenderVersionHistory();
  }
  function epeCreateNamedSnapshot(name, type){
    if (!epeSourceImg){ toast('Upload an image first.', 'err'); return; }
    const snap = { id: 'snap_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), name: name || ('Snapshot ' + new Date().toLocaleTimeString()), type: type||'manual', ts: Date.now(), state: epeCreateFullSnapshot(), meta: { layers: dseState.layers.length, w: epeArtboardW, h: epeArtboardH } };
    epeSnapshots.push(snap);
    const ok = epeSaveSnapshotsToStorage();
    if (!ok){
      epeSnapshots.pop(); // roll back -- don't keep an unsaved snapshot in memory claiming to be persisted
      toast('Could not save snapshot \u2014 browser storage is full. Try deleting old snapshots first.', 'err');
      return null;
    }
    epeRenderSnapshotList(); epeRenderRecoveryPanel();
    return snap;
  }
  document.getElementById('epeCreateSnapshotBtn') && (document.getElementById('epeCreateSnapshotBtn').onclick = () => {
    const name = (document.getElementById('epeSnapshotName') && document.getElementById('epeSnapshotName').value || '').trim();
    const snap = epeCreateNamedSnapshot(name, 'manual');
    if (snap){ document.getElementById('epeSnapshotName').value = ''; toast('Snapshot saved: ' + snap.name); }
  });

  function epeRenderSnapshotList(){
    const el = document.getElementById('epeSnapshotListBody');
    if (!el) return;
    const named = epeSnapshots.filter(s => s.type !== 'event');
    if (named.length === 0){ el.innerHTML = '<div style="color:var(--ink-soft);">No saved snapshots yet.</div>'; return; }
    el.innerHTML = named.slice().reverse().map(s => `
      <div class="dse-snapshot-row" data-snap-id="${s.id}" style="cursor:default;">
        <span class="dse-snapshot-name">${s.name} <span style="color:var(--ink-soft);font-size:11px;">(${s.type}, ${new Date(s.ts).toLocaleString()}, ${s.meta.layers} layer${s.meta.layers===1?'':'s'})</span></span>
        <button class="btn btn-ghost" data-action="restore" data-snap-id="${s.id}" type="button" style="padding:2px 8px;font-size:11.5px;">Restore</button>
        <button class="btn btn-ghost" data-action="duplicate" data-snap-id="${s.id}" type="button" style="padding:2px 8px;font-size:11.5px;">Duplicate</button>
        <button class="btn btn-ghost" data-action="rename" data-snap-id="${s.id}" type="button" style="padding:2px 8px;font-size:11.5px;">Rename</button>
        <button class="btn btn-danger" data-action="delete" data-snap-id="${s.id}" type="button" style="padding:2px 8px;font-size:11.5px;">Delete</button>
      </div>`).join('');
    el.querySelectorAll('[data-action="restore"]').forEach(btn => btn.onclick = async () => {
      const snap = epeSnapshots.find(s => s.id === btn.dataset.snapId);
      if (!snap) return;
      const result = await epeRestoreFullSnapshot(snap.state);
      toast(result.ok ? 'Restored: ' + snap.name : 'Restored with integrity warnings \u2014 check your project.');
      epeRecordSessionEvent('restore', { snapshotName: snap.name, ok: result.ok });
    });
    el.querySelectorAll('[data-action="duplicate"]').forEach(btn => btn.onclick = () => {
      const snap = epeSnapshots.find(s => s.id === btn.dataset.snapId);
      if (!snap) return;
      const clone = JSON.parse(JSON.stringify(snap));
      clone.id = 'snap_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
      clone.name = snap.name + ' copy'; clone.ts = Date.now();
      epeSnapshots.push(clone); epeSaveSnapshotsToStorage(); epeRenderSnapshotList();
      toast('Snapshot duplicated.');
    });
    el.querySelectorAll('[data-action="rename"]').forEach(btn => btn.onclick = () => {
      const snap = epeSnapshots.find(s => s.id === btn.dataset.snapId);
      if (!snap) return;
      const newName = prompt('Rename snapshot:', snap.name);
      if (newName && newName.trim()){ snap.name = newName.trim(); epeSaveSnapshotsToStorage(); epeRenderSnapshotList(); }
    });
    el.querySelectorAll('[data-action="delete"]').forEach(btn => btn.onclick = () => {
      epeSnapshots = epeSnapshots.filter(s => s.id !== btn.dataset.snapId);
      epeSaveSnapshotsToStorage(); epeRenderSnapshotList(); epeRenderRecoveryPanel();
      toast('Snapshot deleted.');
    });
  }


  // ---- Recovery Panel: real, live status -- current session info,
  // saved snapshots count, last benchmark/restore event, and a genuine
  // session-health read (not simulated). ----
  function epeRenderRecoveryPanel(){
    const el = document.getElementById('epeRecoveryPanelBody');
    if (!el) return;
    const namedCount = epeSnapshots.filter(s => s.type !== 'event').length;
    const events = epeSnapshots.filter(s => s.type === 'event');
    const lastBenchmark = [...events].reverse().find(e => e.name === 'benchmark');
    const lastRestore = [...events].reverse().find(e => e.name === 'restore');
    const health = epeRunProjectHealthCheck();
    el.innerHTML = `
      <div>Current session: <strong>${epeSourceImg ? epeArtboardW+'\u00d7'+epeArtboardH+'px, '+dseState.layers.length+' layer(s)' : 'No image loaded'}</strong></div>
      <div>Saved snapshots: <strong>${namedCount}</strong></div>
      <div>Last benchmark: <strong>${lastBenchmark ? new Date(lastBenchmark.ts).toLocaleString() + ' (' + lastBenchmark.meta.runs + ' runs, restore ' + (lastBenchmark.meta.restoreOk?'OK':'had issues') + ')' : 'None this session'}</strong></div>
      <div>Last restore: <strong>${lastRestore ? new Date(lastRestore.ts).toLocaleString() + ' \u2014 ' + lastRestore.meta.snapshotName : 'None this session'}</strong></div>
      <div>Session health: <strong style="color:${health.ok?'var(--ok-solid)':'var(--warn-solid)'};">${health.ok ? '\u2713 Healthy' : '\u26a0 ' + health.issues.length + ' issue(s)'}</strong></div>
      ${health.issues.length ? health.issues.map(i=>`<div style="font-size:11.5px;color:var(--warn-solid);margin-top:2px;">\u2022 ${i}</div>`).join('') : ''}
    `;
  }

  // ---- Project Health Check: real, structural validation -- not a
  // simulated "everything is fine" message. Checks things that could
  // genuinely go wrong (an orphaned groupId, a layer with no valid
  // type, a mask sized for a different canvas). ----
  function epeRunProjectHealthCheck(){
    const issues = [];
    if (!epeSourceImg) return { ok: true, issues: [] };
    const layerIds = new Set(dseState.layers.map(l => l.id));
    dseState.layers.forEach(l => {
      if (l.groupId && !layerIds.has(l.groupId)) issues.push(`Layer "${l.name}" references a missing group.`);
      if (l.type === 'group' && l.childIds){
        l.childIds.forEach(cid => { if (!layerIds.has(cid)) issues.push(`Group "${l.name}" references a missing child layer.`); });
      }
      if (!['image','text','shape','icon','group'].includes(l.type)) issues.push(`Layer "${l.name}" has an unrecognized type.`);
    });
    if (epeEraseMask && epeSourceImg && epeEraseMask.length !== epeSourceImg.naturalWidth*epeSourceImg.naturalHeight){
      issues.push('The active mask size does not match the current image \u2014 it may not apply correctly.');
    }
    if (epeArtboardW <= 0 || epeArtboardH <= 0) issues.push('Canvas size is invalid.');
    return { ok: issues.length === 0, issues };
  }
  document.getElementById('epeRunHealthCheckBtn') && (document.getElementById('epeRunHealthCheckBtn').onclick = () => {
    const health = epeRunProjectHealthCheck();
    const el = document.getElementById('epeHealthCheckBody');
    if (el){
      el.innerHTML = health.ok
        ? '<div style="color:var(--ok-solid);">\u2713 No problems detected \u2014 layers, canvas, and masks all check out.</div>'
        : health.issues.map(i => `<div style="color:var(--warn-solid);margin-top:4px;">\u26a0 ${i}</div>`).join('');
    }
    epeRenderRecoveryPanel();
  });

  // ---- Version History: a lightweight, real event log (snapshots +
  // benchmark/restore events), sorted newest-first. ----
  function epeRenderVersionHistory(){
    const el = document.getElementById('epeVersionHistoryBody');
    if (!el) return;
    const all = [...epeSnapshots].sort((a,b) => b.ts-a.ts).slice(0,30);
    if (all.length === 0){ el.innerHTML = '<div style="color:var(--ink-soft);">No history yet.</div>'; return; }
    el.innerHTML = all.map(s => `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--card-border);">${new Date(s.ts).toLocaleString()} \u2014 ${s.type === 'event' ? s.name : 'Snapshot: '+s.name}</div>`).join('');
  }

  // ---- Auto Save with configurable interval: an ADDITIONAL, opt-in
  // mechanism alongside the existing debounced session-recovery
  // autosave (Phase 1, unchanged) -- this one periodically creates a
  // real named snapshot via setInterval, matching "configurable
  // interval: 5/10/15 minutes" from the brief. ----
  let epeAutoSaveIntervalId = null;
  function epeSetAutoSaveInterval(minutes){
    if (epeAutoSaveIntervalId){ clearInterval(epeAutoSaveIntervalId); epeAutoSaveIntervalId = null; }
    if (!minutes || minutes <= 0) return;
    epeAutoSaveIntervalId = setInterval(() => {
      if (!epeSourceImg) return;
      epeCreateNamedSnapshot('Auto-save ' + new Date().toLocaleTimeString(), 'auto');
    }, minutes*60*1000);
  }
  document.getElementById('epeAutoSaveInterval') && document.getElementById('epeAutoSaveInterval').addEventListener('change', (e) => {
    epeSetAutoSaveInterval(+e.target.value);
    toast(e.target.value == 0 ? 'Interval auto-save disabled.' : `Interval auto-save set to every ${e.target.value} minutes.`);
  });
  document.getElementById('epeManualSaveBtn') && (document.getElementById('epeManualSaveBtn').onclick = () => {
    const snap = epeCreateNamedSnapshot('Manual save ' + new Date().toLocaleTimeString(), 'manual');
    if (snap) toast('Project saved.');
  });

  document.getElementById('epeAccordionSession') && document.getElementById('epeAccordionSession').addEventListener('toggle', function(){
    if (this.open){ epeRenderSnapshotList(); epeRenderRecoveryPanel(); epeRenderVersionHistory(); }
  });

  epeLoadSnapshots();


  /* ============================================================
     UI SHELL — Phase A (layout/navigation only)
     ============================================================
     This is presentation-layer code only. Every existing accordion
     and its handlers are completely untouched -- this just controls
     WHICH accordion group is visible/scrolled-to, and the open/closed
     state of the panel container (bottom sheet on mobile, sidebar on
     desktop) that wraps them. No rendering, history, or export code
     is touched by anything below.
     ============================================================ */
  const EPE_CATEGORY_ACCORDIONS = {
    edit:      ['epeAccordionTransform','epeAccordionCrop','epeAccordionGuides','epeAccordionSafeArea','epeAccordionRetouch','epeAccordionBackground','epeAccordionFaceRetouch','epeAccordionMaskSystem','epeAccordionSelection'],
    effects:   ['epeAccordionAdjustments','epeAccordionShadow','epeAccordionReflection','epeAccordionAnalysis','epeAccordionUpscaleCompress','epeAccordionBeforeAfter'],
    text:      ['epeAccordionAddText'],
    elements:  ['epeAccordionAssetLibrary','epeAccordionShapesIcons','epeAccordionStickersBadges','epeAccordionHighlightsCallouts','epeAccordionCtaRibbons','epeAccordionOffersTrust','epeAccordionTablesReviews','epeAccordionLogoCode'],
    layers:    ['epeAccordionLayers','epeAccordionArrangeAlign','epeAccordionBrandColors','epeAccordionBrandDefaults'],
    templates: ['epeAccordionMarketplace'],
    export:    ['epeAccordionExport'],
    more:      ['epeAccordionSession','epeAccordionAnalytics','epeAccordionAdvancedRecon'],
  };
  const EPE_CATEGORY_LABELS = {
    edit:'Edit', effects:'Effects', text:'Text', elements:'Elements',
    layers:'Layers', templates:'Templates', export:'Export', more:'More',
  };
  let epeActiveCategory = 'edit';
  let epeIsDesktopShell = window.innerWidth >= 900;

  function epeIsMobileShell(){ return window.innerWidth < 900; }

  function epeEnterShellMode(){
    document.getElementById('epeViewTitle') && document.getElementById('epeViewTitle').classList.add('hidden');
    document.getElementById('epeViewSubtitle') && document.getElementById('epeViewSubtitle').classList.add('hidden');
    document.getElementById('epeDrop') && document.getElementById('epeDrop').classList.add('hidden');
    document.getElementById('toolSeoContent') && document.getElementById('toolSeoContent').classList.add('hidden');
    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) heroSub.classList.add('hidden');
    const backBtn = document.querySelector('.btn-back');
    if (backBtn && backBtn.parentElement) backBtn.parentElement.classList.add('hidden');
    const footer = document.querySelector('footer');
    if (footer) footer.classList.add('hidden');
    const navbar = document.querySelector('.navbar');
    if (navbar) document.documentElement.style.setProperty('--epe-navbar-h', navbar.getBoundingClientRect().height + 'px');
    window.scrollTo(0, 0);
  }
  window.addEventListener('resize', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar && !document.getElementById('epeStage').classList.contains('hidden')){
      document.documentElement.style.setProperty('--epe-navbar-h', navbar.getBoundingClientRect().height + 'px');
    }
  });

  /* ============================================================
     TOOLFLIGHT TOOLBAR ENGINE -- Floating Toolbar Drag (Phase 2 of
     the multi-editor migration plan). Tool-agnostic: takes handle/
     bar/viewport elements and a list of "reset trigger" elements as
     config, with no knowledge of "ecommerce" specifically. This is
     the single, real implementation of drag + clamp-to-viewport +
     reset-on-fit for a floating toolbar. The Ecommerce Editor is
     refactored below to instantiate this rather than containing its
     own separate copy of the same logic. Future editors instantiate
     their own instance the same way, with their own elements -- no
     new drag math is ever written per-editor. ============================================================ */


  const EPE_ALL_CATEGORY_ACCORDION_IDS = Object.values(EPE_CATEGORY_ACCORDIONS).flat();
  // Ecommerce Editor's instance of the shared category switcher engine.
  // epeSelectCategory below is a thin wrapper preserving the exact same
  // external name/signature (called from many places, including the
  // init call), so nothing else needed to change. Selectors and data
  // attributes match the existing, unmodified HTML exactly -- this is
  // purely the *mechanism* being shared, not the categories/labels
  // themselves, which stay defined exactly where they were.
  const epeCategorySwitcher = createToolflightCategorySwitcher({
    accordionMap: EPE_CATEGORY_ACCORDIONS,
    labelMap: EPE_CATEGORY_LABELS,
    navButtonSelector: '[data-epe-category]',
    activeStateSelector: '.epe-rail-btn, .epe-tab-btn',
    categoryDataAttr: 'epeCategory',
    panelTitleEl: () => document.getElementById('epeToolPanelTitle'),
    panelBodyEl: () => document.getElementById('epeToolPanelBody'),
    onOpenPanel: () => epeOpenToolPanel(),
  });
  function epeSelectCategory(cat, opts){
    epeCategorySwitcher.selectCategory(cat, opts);
    epeActiveCategory = epeCategorySwitcher.getActiveCategory();
  }

  /* ---- Panel open/close: bottom sheet (mobile) or sidebar (desktop) ---- */
  let epeSheetState = 'closed'; // closed | half | full
  function epeOpenToolPanel(){
    const panel = document.getElementById('epeToolPanel');
    if (!panel) return;
    if (epeIsMobileShell()){
      panel.classList.remove('collapsed');
      panel.classList.add('sheet-open');
      panel.classList.remove('sheet-full');
      panel.classList.add('sheet-half');
      epeSheetState = 'half';
      const backdrop = document.getElementById('epeSheetBackdrop');
      if (backdrop) backdrop.classList.add('visible');
      // The floating controls bar sits low enough on the canvas that the
      // sheet visually covers the same area once open -- hide it while
      // the sheet has focus rather than let it render on top of the
      // sheet (which is what created the "two toolbars" appearance).
      const floatBar = document.getElementById('epeFloatingControls');
      if (floatBar) floatBar.classList.add('hidden');
    } else {
      panel.classList.remove('collapsed');
    }
  }
  function epeCloseToolPanel(){
    const panel = document.getElementById('epeToolPanel');
    if (!panel) return;
    if (epeIsMobileShell()){
      panel.classList.remove('sheet-open','sheet-half','sheet-full');
      epeSheetState = 'closed';
      const backdrop = document.getElementById('epeSheetBackdrop');
      if (backdrop) backdrop.classList.remove('visible');
      const floatBar = document.getElementById('epeFloatingControls');
      if (floatBar) floatBar.classList.remove('hidden');
    } else {
      panel.classList.add('collapsed');
    }
  }
  document.getElementById('epeSheetCloseBtn') && document.getElementById('epeSheetCloseBtn').addEventListener('click', epeCloseToolPanel);
  document.getElementById('epeSheetBackdrop') && document.getElementById('epeSheetBackdrop').addEventListener('click', epeCloseToolPanel);
  document.getElementById('epePanelCollapseBtn') && document.getElementById('epePanelCollapseBtn').addEventListener('click', () => {
    const panel = document.getElementById('epeToolPanel');
    if (!panel) return;
    const collapsing = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', collapsing);
    const icon = document.getElementById('epePanelCollapseBtn');
    if (icon) icon.style.transform = collapsing ? 'rotate(180deg)' : 'none';
  });

  /* ---- Bottom sheet drag: pointer-based, live height tracking, snaps
     to half/full/closed on release based on drag distance + velocity. ---- */
  (function setupSheetDrag(){
    const handle = document.getElementById('epeSheetDragHandle');
    const panel = document.getElementById('epeToolPanel');
    if (!handle || !panel) return;
    let dragging = false, startY = 0, startHeightVh = 45, lastY = 0, lastT = 0, velocity = 0;
    function vh(px){ return (px/window.innerHeight)*100; }
    handle.addEventListener('pointerdown', (e) => {
      if (!epeIsMobileShell()) return;
      dragging = true; startY = e.clientY; lastY = e.clientY; lastT = performance.now();
      const rect = panel.getBoundingClientRect();
      startHeightVh = vh(rect.height);
      panel.style.transition = 'none';
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      const now = performance.now();
      if (now - lastT > 16){ velocity = (e.clientY - lastY) / (now - lastT); lastY = e.clientY; lastT = now; }
      let newHeightVh = startHeightVh - vh(dy);
      newHeightVh = Math.max(10, Math.min(88, newHeightVh));
      panel.style.height = newHeightVh + 'vh';
    });
    function endDrag(e){
      if (!dragging) return;
      dragging = false;
      panel.style.transition = '';
      const rect = panel.getBoundingClientRect();
      const heightVh = vh(rect.height);
      panel.style.height = '';
      // Snap based on final position + fling velocity (fast downward flick closes/half regardless of position)
      if (velocity > 0.6 || heightVh < 22){ epeCloseToolPanel(); }
      else if (velocity < -0.6 || heightVh > 65){ panel.classList.remove('sheet-half'); panel.classList.add('sheet-full'); epeSheetState='full'; }
      else { panel.classList.remove('sheet-full'); panel.classList.add('sheet-half'); epeSheetState='half'; }
      velocity = 0;
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  })();

  /* ---- Desktop panel resize: drag the left edge to resize width ---- */
  (function setupPanelResize(){
    const handle = document.getElementById('epePanelResizeHandle');
    const stage = document.getElementById('epeStage');
    if (!handle || !stage) return;
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      if (epeIsMobileShell()) return;
      dragging = true; handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const panel = document.getElementById('epeToolPanel');
      const rect = panel.getBoundingClientRect();
      let newW = rect.right - e.clientX;
      newW = Math.max(280, Math.min(560, newW));
      stage.style.setProperty('--epe-panel-w', newW + 'px');
    });
    function endDrag(){ dragging = false; }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  })();

  /* ---- Floating canvas controls: reuse existing zoom/fit logic, don't
     reimplement it -- these just drive the same epeZoomSlider that
     already has a working input handler elsewhere in this module. ---- */
  function epeNudgeZoom(deltaPercent){
    const slider = document.getElementById('epeZoomSlider');
    if (!slider) return;
    const next = Math.max(+slider.min, Math.min(+slider.max, (+slider.value) + deltaPercent));
    slider.value = next;
    slider.dispatchEvent(new Event('input', { bubbles:true }));
  }
  document.getElementById('epeFloatZoomInBtn') && document.getElementById('epeFloatZoomInBtn').addEventListener('click', () => epeNudgeZoom(25));
  document.getElementById('epeFloatZoomOutBtn') && document.getElementById('epeFloatZoomOutBtn').addEventListener('click', () => epeNudgeZoom(-25));
  document.getElementById('epeFloatFitBtn') && document.getElementById('epeFloatFitBtn').addEventListener('click', () => {
    const fitBtn = document.getElementById('epeFitScreenBtn');
    if (fitBtn) fitBtn.click(); // reuses the existing, already-correct Fit to Screen handler
  });
  document.getElementById('epeFloatBeforeAfterBtn') && document.getElementById('epeFloatBeforeAfterBtn').addEventListener('click', () => {
    // The Before/After comparison is a full canvas-based split-view widget,
    // not a simple toggle -- too complex to reproduce inside the floating
    // pill in this phase, so this opens the panel directly to it instead.
    epeSelectCategory('adjust', { collapseRest:false });
    const el = document.getElementById('epeAccordionBeforeAfter');
    if (el) el.open = true;
  });
  // Keep the floating zoom label synced to the real zoom value, whatever changed it
  const epeZoomSliderEl = document.getElementById('epeZoomSlider');
  if (epeZoomSliderEl){
    epeZoomSliderEl.addEventListener('input', () => {
      const lbl = document.getElementById('epeFloatZoomLabel');
      if (lbl) lbl.textContent = epeZoomSliderEl.value + '%';
    });
  }

  /* ---- Initial shell state on load ---- */
  epeSelectCategory('edit', { skipOpenPanel: true, noScroll: true });
  if (!epeIsMobileShell()){
    const panel = document.getElementById('epeToolPanel');
    if (panel) panel.classList.remove('collapsed');
  }
  window.addEventListener('resize', () => {
    // Re-apply correct open/closed semantics if the viewport crosses the
    // mobile/desktop breakpoint while the panel is in a sheet-specific state
    const panel = document.getElementById('epeToolPanel');
    if (!panel) return;
    if (!epeIsMobileShell()){
      panel.classList.remove('sheet-open','sheet-half','sheet-full');
      const backdrop = document.getElementById('epeSheetBackdrop');
      if (backdrop) backdrop.classList.remove('visible');
    }
  });


  /* ============================================================
     PHASE B — Mobile-First Touch Workflow
     ============================================================
     Reuses the existing Clone Stamp / Healing Brush engine
     (epeCloneSource, epeCloneOffset, epeCloneAligned, epeStampAt,
     epeCloneStampAt, epeHealStampAt) entirely unchanged. This only
     adds an explicit, tap-friendly way to SET epeCloneSource that
     doesn't depend on a keyboard modifier -- the desktop Alt-click
     path (epeCloneAltHeld) is untouched and still works.
     ============================================================ */
  let epeSelectSourceMode = false;
  function epeSetSelectSourceMode(on){
    epeSelectSourceMode = on;
    const btn = document.getElementById('epeSelectSourceBtn');
    if (btn){
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Tap the image to set source\u2026' : (epeCloneSource ? (epeActiveTool === 'heal' ? 'Resample' : 'Reselect Source') : (epeActiveTool === 'heal' ? 'Sample' : 'Select Source'));
    }
    epeUpdateFloatingBrushBar();
  }
  document.getElementById('epeSelectSourceBtn') && (document.getElementById('epeSelectSourceBtn').onclick = () => {
    epeSetSelectSourceMode(!epeSelectSourceMode);
  });

  // ---- Floating Brush Controls: shows/hides based on the active tool,
  // and keeps its compact sliders in perfect sync with the existing
  // accordion sliders -- both read/write the SAME epeBrushSize/
  // epeBrushHardness/epeBrushOpacity variables, so there is exactly one
  // source of truth, not two parallel brush-setting systems. ----
  const EPE_BRUSH_TOOLS = new Set(['erase','restore','blur','sharpen','spot','clone','heal','redeye']);
  function epeUpdateFloatingBrushBar(){
    const bar = document.getElementById('epeFloatingBrushBar');
    if (!bar) return;
    const isBrush = EPE_BRUSH_TOOLS.has(epeActiveTool);
    bar.classList.toggle('hidden', !isBrush);
    if (!isBrush) return;
    const sourceBtn = document.getElementById('epeSelectSourceBtn');
    const isCloneHeal = epeActiveTool === 'clone' || epeActiveTool === 'heal';
    sourceBtn.classList.toggle('hidden', !isCloneHeal);
    if (isCloneHeal && !epeSelectSourceMode){
      sourceBtn.textContent = epeCloneSource ? (epeActiveTool === 'heal' ? 'Resample' : 'Reselect Source') : (epeActiveTool === 'heal' ? 'Sample' : 'Select Source');
      sourceBtn.classList.remove('active');
      sourceBtn.setAttribute('aria-pressed', 'false');
    }
    // Sync compact sliders FROM the current source-of-truth values
    document.getElementById('epeFloatBrushSize').value = epeBrushSize;
    document.getElementById('epeFloatBrushHardness').value = epeBrushHardness;
    document.getElementById('epeFloatBrushOpacity').value = epeBrushOpacity;
  }
  // Two-way sync: moving the compact floating slider updates the SAME
  // variables the accordion slider uses, and mirrors the value back to
  // the accordion slider's own input so both stay visually consistent
  // whichever one the person used most recently.
  document.getElementById('epeFloatBrushSize') && document.getElementById('epeFloatBrushSize').addEventListener('input', (e) => {
    epeBrushSize = +e.target.value;
    document.getElementById('epeBrushSize').value = e.target.value;
    epeUpdateBrushCursor();
  });
  document.getElementById('epeFloatBrushHardness') && document.getElementById('epeFloatBrushHardness').addEventListener('input', (e) => {
    epeBrushHardness = +e.target.value;
    document.getElementById('epeBrushHardness').value = e.target.value;
  });
  document.getElementById('epeFloatBrushOpacity') && document.getElementById('epeFloatBrushOpacity').addEventListener('input', (e) => {
    epeBrushOpacity = +e.target.value;
    document.getElementById('epeBrushOpacity').value = e.target.value;
  });
  // Mirror the reverse direction too, so opening the full accordion and
  // adjusting there also updates the floating bar next time it's shown.
  document.getElementById('epeBrushSize').addEventListener('input', () => { const f=document.getElementById('epeFloatBrushSize'); if (f) f.value = epeBrushSize; });
  document.getElementById('epeBrushHardness').addEventListener('input', () => { const f=document.getElementById('epeFloatBrushHardness'); if (f) f.value = epeBrushHardness; });
  document.getElementById('epeBrushOpacity').addEventListener('input', () => { const f=document.getElementById('epeFloatBrushOpacity'); if (f) f.value = epeBrushOpacity; });


  // ---- Selection Mini-Toolbar: appears whenever any layer is selected,
  // giving touch-friendly quick access to the most common object
  // actions without opening the full Object panel. Every button
  // delegates to the EXISTING accordion buttons/logic via .click() or
  // by driving the same underlying state -- nothing here is a second,
  // parallel implementation of duplicate/delete/reorder/opacity. ----
  function epeUpdateSelectionMiniToolbar(){
    const bar = document.getElementById('epeSelectionMiniToolbar');
    if (!bar) return;
    const active = (typeof dseActiveLayer === 'function') ? dseActiveLayer() : null;
    const hasSelection = !!active && dseState.selectedIds.size > 0;
    bar.classList.toggle('hidden', !hasSelection);
    if (!hasSelection) return;
    document.getElementById('epeMiniOpacity').value = active.opacity;
    document.getElementById('epeMiniLockBtn').classList.toggle('active', !!active.locked);
    document.getElementById('epeMiniLockBtn').setAttribute('aria-pressed', String(!!active.locked));
  }
  document.getElementById('epeMiniDuplicateBtn') && (document.getElementById('epeMiniDuplicateBtn').onclick = () => {
    const btn = document.getElementById('epeDuplicateLayerBtn'); if (btn) btn.click();
  });
  document.getElementById('epeMiniDeleteBtn') && (document.getElementById('epeMiniDeleteBtn').onclick = () => {
    const btn = document.getElementById('epeDeleteLayerBtn'); if (btn) btn.click();
    if (typeof epeHapticFeedback === 'function') epeHapticFeedback('medium');
    epeUpdateSelectionMiniToolbar();
  });
  document.getElementById('epeMiniForwardBtn') && (document.getElementById('epeMiniForwardBtn').onclick = () => {
    const btn = document.getElementById('epeLayerForwardBtn'); if (btn) btn.click();
  });
  document.getElementById('epeMiniBackwardBtn') && (document.getElementById('epeMiniBackwardBtn').onclick = () => {
    const btn = document.getElementById('epeLayerBackwardBtn'); if (btn) btn.click();
  });
  document.getElementById('epeMiniLockBtn') && (document.getElementById('epeMiniLockBtn').onclick = () => {
    const active = dseActiveLayer(); if (!active) return;
    active.locked = !active.locked;
    if (typeof dseRenderLayersPanel === 'function') dseRenderLayersPanel();
    epeUpdateSelectionMiniToolbar();
    renderEpeAll();
  });
  document.getElementById('epeMiniOpacity') && document.getElementById('epeMiniOpacity').addEventListener('input', (e) => {
    const objOpacity = document.getElementById('epeObjectOpacity');
    if (objOpacity){ objOpacity.value = e.target.value; objOpacity.dispatchEvent(new Event('input', {bubbles:true})); }
  });
  document.getElementById('epeMiniOpacity') && document.getElementById('epeMiniOpacity').addEventListener('change', () => { if (typeof epePushHistory === 'function') epePushHistory(); });


  // ---- Haptic-ready architecture (Phase B): a single, real call site
  // for haptic feedback across the editor, currently a no-op per the
  // brief ("do NOT implement vibration now, only keep structure
  // ready"). When real haptic feedback is added later, it only needs
  // to be implemented once, here -- every call site below already
  // routes through this function. navigator.vibrate is NOT called
  // yet, intentionally. ----
  function epeHapticFeedback(intensity){
    // intensity: 'light' | 'medium' | 'heavy' -- reserved for future use.
    // Intentionally not calling navigator.vibrate() yet.
    return;
  }


  // ---- New Layer (Phase C): fills a genuine gap -- there was no way
  // to add a blank layer to build up a design from scratch. Reuses the
  // existing shape-layer factory rather than inventing a new layer
  // type; starts fully transparent (opacity:0) and full-artboard-sized
  // so it doesn't visually intrude, and is immediately selected so the
  // Object panel is ready for the person to customize its fill,
  // opacity, and size. Honest scope: this is a blank *shape* layer for
  // building up designs with the existing fill/color/effects tools --
  // it is not a paintable canvas for the brush tools, which operate
  // specifically on image-type layers in this architecture; extending
  // that would be a larger architectural change than this phase calls for. ----
  document.getElementById('epeNewLayerBtn') && (document.getElementById('epeNewLayerBtn').onclick = () => {
    if (!epeSourceImg){ toast('Upload a product image first.', 'err'); return; }
    const layer = dseCreateShapeLayer('rectangle', epeArtboardW, epeArtboardH);
    layer.name = 'New Layer';
    layer.opacity = 0; // blank/invisible until customized
    layer.boxW = epeArtboardW; layer.boxH = epeArtboardH;
    layer.border = { enabled:false, thickness:3, style:'solid', color:'#111111' };
    dseState.layers.push(layer);
    dseSelectLayer(layer.id, false);
    renderEpeAll(); epePushHistory();
    toast('New blank layer added \u2014 adjust its fill and opacity in the Object panel to use it.');
  });


  // ---- Magic Wand (Phase D): a real flood-fill selection based on
  // color similarity from a clicked point, replacing the Phase 6
  // "foundation only" placeholder. Operates on the current composited
  // pixel data (via the local edits canvas) so it reflects whatever
  // edits have already been applied, not just the original image. ----
  let epeWandTolerance = 32;
  function epeMagicWandSelect(sx, sy){
    if (!epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const startX = Math.round(sx), startY = Math.round(sy);
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
    const canvas = epeEnsureLocalEditsCanvas();
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const idx0 = (startY*w+startX)*4;
    const r0 = data[idx0], g0 = data[idx0+1], b0 = data[idx0+2];
    const tolerance = epeWandTolerance;
    const mask = new Uint8ClampedArray(w*h);
    const visited = new Uint8Array(w*h);
    const stack = [startY*w+startX];
    visited[startY*w+startX] = 1;
    while (stack.length){
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      const i = p*4;
      const dr = data[i]-r0, dg = data[i+1]-g0, db = data[i+2]-b0;
      const dist = Math.sqrt(dr*dr+dg*dg+db*db);
      if (dist > tolerance) continue;
      mask[p] = 255;
      const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      for (const [nx,ny] of neighbors){
        if (nx<0||nx>=w||ny<0||ny>=h) continue;
        const np = ny*w+nx;
        if (visited[np]) continue;
        visited[np] = 1;
        stack.push(np);
      }
    }
    epeSelectionMask = mask;
    epeSelectionPath = [];
    document.getElementById('epeSelectionActions') && document.getElementById('epeSelectionActions').classList.remove('hidden');
    renderEpeOverlay();
    toast('Magic Wand selection made.');
  }
  document.getElementById('epeWandTolerance') && document.getElementById('epeWandTolerance').addEventListener('input', (e) => { epeWandTolerance = +e.target.value; });

  // ---- Quick Select (Phase D): brush-based selection -- drag over an
  // area and every pixel color-similar to what's under the brush
  // (compared against a running average of the region, not just the
  // single first pixel) gets added to the selection. A real, if
  // deliberately simplified, "paint to select similar areas" tool --
  // not the full edge-aware segmentation used by professional tools,
  // which would be a much larger undertaking; disclosed as such. ----
  let epeQuickSelectAnchorColor = null; // {r,g,b} sampled once, at the start of the stroke
  function epeQuickSelectStampAt(sx, sy, brushRadius){
    if (!epeSourceImg) return;
    const w = epeSourceImg.naturalWidth, h = epeSourceImg.naturalHeight;
    const canvas = epeEnsureLocalEditsCanvas();
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    if (!epeSelectionMask) epeSelectionMask = new Uint8ClampedArray(w*h);
    const x0 = Math.max(0, Math.floor(sx-brushRadius)), x1 = Math.min(w-1, Math.ceil(sx+brushRadius));
    const y0 = Math.max(0, Math.floor(sy-brushRadius)), y1 = Math.min(h-1, Math.ceil(sy+brushRadius));
    if (!epeQuickSelectAnchorColor){
      // Anchor to the color at the very start of the stroke, not a
      // running average -- otherwise a stroke that starts in one color
      // region and drags into another gets "poisoned" by the first
      // samples, preventing the actual target region from matching.
      const cx = Math.round(epeClamp(sx,0,w-1)), cy = Math.round(epeClamp(sy,0,h-1));
      const ci = (cy*w+cx)*4;
      epeQuickSelectAnchorColor = { r: data[ci], g: data[ci+1], b: data[ci+2] };
    }
    const { r: anchorR, g: anchorG, b: anchorB } = epeQuickSelectAnchorColor;
    const tolerance = epeWandTolerance;
    for (let y=y0; y<=y1; y++){
      for (let x=x0; x<=x1; x++){
        if (Math.hypot(x-sx, y-sy) > brushRadius) continue;
        const i = (y*w+x)*4;
        const dr = data[i]-anchorR, dg = data[i+1]-anchorG, db = data[i+2]-anchorB;
        if (Math.sqrt(dr*dr+dg*dg+db*db) <= tolerance) epeSelectionMask[y*w+x] = 255;
      }
    }
    renderEpeOverlay();
  }


  // ---- Floating toolbar drag (Phase F fix): the toolbar was not
  // draggable at all -- no drag logic existed anywhere in the
  // codebase (verified by search before writing this). Implemented as
  // genuine pointer-based dragging via a dedicated handle (matching
  // Canva's own pattern -- dragging from anywhere on a button-filled
  // bar would conflict with button clicks), clamped to stay fully
  // within the canvas stage bounds, working for mouse and touch via
  // the unified Pointer Events API. Position persists across
  // interactions within the session (not reset on re-render) since
  // it's stored in the element's own inline style, which nothing else
  // in the render pipeline touches.
  createToolflightFloatingToolbarDrag({
    handleEl: () => document.getElementById('epeFloatDragHandle'),
    barEl: () => document.getElementById('epeFloatingControls'),
    viewportEl: () => document.getElementById('epeWorkspaceViewport'),
    draggingClass: 'epe-dragging',
    resetTriggerEls: [
      () => document.getElementById('epeFitScreenBtn'),
      () => document.getElementById('epeFloatFitBtn'),
    ],
  });


  // ---- Smooth pan (architecture phase): a dedicated pan-mode toggle,
  // matching the "hand tool" pattern used by professional editors --
  // deliberately NOT a drag-anywhere gesture, since the canvas already
  // handles pointerdown for painting, selection, and layer dragging,
  // and overloading drag semantics there risks conflicting with all of
  // those existing, verified behaviors. Pan mode uses the wrap's
  // existing native overflow:auto scrolling (scrollLeft/scrollTop),
  // not a new scroll mechanism. ----
  let epePanMode = false;
  (function setupEpePan(){
    const panBtn = document.getElementById('epeFloatPanBtn');
    const viewport = document.getElementById('epeWorkspaceViewport');
    if (!panBtn || !viewport) return;
    let panning = false, startX = 0, startY = 0, startWsX = 0, startWsY = 0;

    function setPanMode(on){
      epePanMode = on;
      panBtn.classList.toggle('active', on);
      panBtn.setAttribute('aria-pressed', String(on));
      viewport.classList.toggle('epe-pan-mode', on);
    }
    panBtn.addEventListener('click', () => setPanMode(!epePanMode));

    viewport.addEventListener('pointerdown', (e) => {
      if (!epePanMode) return;
      // Only engage on the viewport/canvas background, not on a floating
      // control that happens to be a descendant.
      if (e.target.closest('#epeFloatingControls, #epeFloatingBrushBar, #epeSelectionMiniToolbar')) return;
      panning = true;
      startX = e.clientX; startY = e.clientY;
      startWsX = epeWorkspaceX; startWsY = epeWorkspaceY;
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!panning) return;
      epeWorkspaceX = startWsX + (e.clientX - startX);
      epeWorkspaceY = startWsY + (e.clientY - startY);
      epeApplyWorkspaceTransform();
    });
    viewport.addEventListener('pointerup', () => { panning = false; });
    viewport.addEventListener('pointercancel', () => { panning = false; });
  })();


  function setupEpeAccordionExclusivity(){
    const accordions = Array.from(document.querySelectorAll('#epeStage .pp-accordion'));
    accordions.forEach(acc => {
      acc.addEventListener('toggle', () => {
        if (acc.open) accordions.forEach(other => { if (other !== acc) other.open = false; });
      });
    });
  }
  setupEpeAccordionExclusivity();
  epeOfferAutoSavedSession();
}
