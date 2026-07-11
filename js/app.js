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
    if (bmi < 18.5) return { label: 'Underweight', color: 'var(--accent1)' };
    if (bmi < 25) return { label: 'Normal weight', color: 'var(--ok)' };
    if (bmi < 30) return { label: 'Overweight', color: 'var(--warn)' };
    return { label: 'Obesity', color: 'var(--err)' };
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
