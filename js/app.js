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
  function loadImageFromFile(file){
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
      const { img, url } = await loadImageFromFile(compressFile);
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
    navigator.clipboard.writeText(text).then(() => toast('robots.txt copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
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
    navigator.clipboard.writeText(text).then(() => toast('Meta tags copied to clipboard.')).catch(() => toast('Could not copy — try selecting the text manually.', 'err'));
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
    const view = document.getElementById('view-scientific');
    if (!view || !view.classList.contains('active')) return;
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
  let ratesCache = {}; // { BASE: { rates, date } }

  const fromSel = document.getElementById('curFrom');
  const toSel = document.getElementById('curTo');
  fromSel.innerHTML = CURRENCIES.map(c => `<option value="${c}" ${c==='USD'?'selected':''}>${c}</option>`).join('');
  toSel.innerHTML = CURRENCIES.map(c => `<option value="${c}" ${c==='EUR'?'selected':''}>${c}</option>`).join('');

  async function getRates(base){
    if (ratesCache[base]) return ratesCache[base];
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`);
    if (!res.ok) throw new Error('Exchange rate service is unavailable right now.');
    const data = await res.json();
    ratesCache[base] = data;
    return data;
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
      if (!rate){ throw new Error(`No rate available for ${to}.`); }
      const converted = amount * rate;
      document.getElementById('curResult').textContent = converted.toFixed(2);
      document.getElementById('curResultLabel').textContent = `= ${to}`;
      status.textContent = `1 ${from} = ${rate} ${to} · Last updated: ${data.date}`;
    }catch(err){
      status.textContent = 'Could not load exchange rates — check your connection and try again.';
      toast(err.message || 'Could not load exchange rates.', 'err');
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

  function loadImg(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
      img.src = url;
    });
  }

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

  function loadImg2(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
      img.src = url;
    });
  }
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

  function loadImg3(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')); };
      img.src = url;
    });
  }
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
