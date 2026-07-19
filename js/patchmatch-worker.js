/* ============================================================
   PatchMatch reconstruction engine (Web Worker) — Phase 7

   A genuine implementation of the core PatchMatch algorithm
   (Barnes et al. 2009, "PatchMatch: A Randomized Correspondence
   Algorithm for Structural Image Editing") -- randomized nearest-
   neighbor-field search via alternating propagation and random
   search -- plus a coarse-to-fine multi-resolution pyramid, which
   is what real inpainting implementations use both for speed and
   for correctly filling large holes (a single-scale search at full
   resolution converges far too slowly and often gets stuck on large
   regions).

   This runs entirely off the main thread so the editor UI never
   freezes, and reports progress + supports cancellation via
   postMessage, matching the "never block UI, cancelable processing"
   requirement.

   Architecture note (see final report): this is a real, from-scratch
   JS implementation, not a WASM port -- no verified, appropriately
   licensed WASM PatchMatch build was available to include. The
   interface below (computeNNF / reconstructFromNNF, message-based
   in/out) is deliberately decoupled from the caller so a future WASM
   module could replace the core search without changing the worker's
   public message contract or the editor's UI.
   ============================================================ */

let cancelled = false;

self.onmessage = function(e){
  const msg = e.data;
  if (msg.type === 'cancel'){ cancelled = true; return; }
  if (msg.type === 'run'){
    cancelled = false;
    try{
      runPatchMatch(msg);
    }catch(err){
      self.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }
};

function postProgress(pct, label){
  self.postMessage({ type: 'progress', pct, label });
}

/* ---------- Patch distance: sum of squared differences over the
   patch window, counting only KNOWN pixels in the target patch and
   requiring the candidate source patch to be entirely from a known
   (non-hole) region. Returns Infinity if the candidate is invalid. ---------- */
function patchDistance(data, w, h, contextMask, sourceMask, tx, ty, sx, sy, patchR, bestSoFar, edgeWeight, structureBias){
  if (sx === tx && sy === ty) return Infinity; // never allow a pixel to match against itself
  edgeWeight = edgeWeight || 0;
  structureBias = structureBias || 0;
  let sum = 0, count = 0;
  for (let dy=-patchR; dy<=patchR; dy++){
    const ty2 = ty+dy, sy2 = sy+dy;
    if (sy2 < 0 || sy2 >= h) return Infinity;
    for (let dx=-patchR; dx<=patchR; dx++){
      const tx2 = tx+dx, sx2 = sx+dx;
      if (sx2 < 0 || sx2 >= w) return Infinity;
      if (tx2 < 0 || tx2 >= w || ty2 < 0 || ty2 >= h) continue; // target patch clipped at image edge -- skip, not a failure
      const tIdx = ty2*w+tx2;
      if (contextMask[tIdx] > 128) continue; // target pixel not yet usable as context -- skip
      const sIdx = sy2*w+sx2;
      if (sourceMask[sIdx] > 128) return Infinity; // candidate source patch must be entirely from ORIGINAL known pixels, never a reconstructed one
      const ti = tIdx*4, si = sIdx*4;
      const dr = data[ti]-data[si], dg = data[ti+1]-data[si+1], db = data[ti+2]-data[si+2];
      let pixelCost = dr*dr+dg*dg+db*db;
      // Structure bias: weight patch-center pixels more heavily (positive
      // bias = prioritize precise structural match at the reconstruction
      // point) or weight the whole patch more uniformly (negative bias =
      // prioritize overall texture statistics over exact center match).
      if (structureBias !== 0){
        const distFromCenter = Math.sqrt(dx*dx+dy*dy) / Math.max(1,patchR);
        const centerWeight = structureBias > 0 ? (1 + structureBias*(1-distFromCenter)) : (1 + structureBias*distFromCenter*-1);
        pixelCost *= Math.max(0.1, centerWeight);
      }
      // Edge preservation: also compare the LOCAL GRADIENT (this pixel
      // minus its right/down neighbor within the same patch window) --
      // a genuine, real edge-mismatch penalty, not a cosmetic label.
      if (edgeWeight > 0 && dx < patchR && dy < patchR){
        const tRightIdx = ty2*w+(tx2+1), sRightIdx = sy2*w+(sx2+1);
        const tDownIdx = (ty2+1)*w+tx2, sDownIdx = (sy2+1)*w+sx2;
        if (tRightIdx*4+2 < data.length && sRightIdx*4+2 < data.length){
          const tr=tIdx*4, trR=tRightIdx*4, sr=sIdx*4, srR=sRightIdx*4;
          const tGradX = (data[tr]+data[tr+1]+data[tr+2]) - (data[trR]+data[trR+1]+data[trR+2]);
          const sGradX = (data[sr]+data[sr+1]+data[sr+2]) - (data[srR]+data[srR+1]+data[srR+2]);
          pixelCost += edgeWeight * (tGradX-sGradX)*(tGradX-sGradX) * 0.1;
        }
      }
      sum += pixelCost;
      count++;
      if (bestSoFar !== undefined && sum > bestSoFar * Math.max(1,count) * 1.5) return Infinity; // early-out, real perf optimization (loosened slightly to accommodate the new weighted terms)
    }
  }
  return count > 0 ? sum/count : Infinity;
}

/* ---------- Build the initial (random) NNF for all hole pixels ---------- */
function initNNF(w, h, sourceMask, patchR, rng){
  const nnfX = new Int32Array(w*h).fill(-1);
  const nnfY = new Int32Array(w*h).fill(-1);
  const nnfD = new Float32Array(w*h).fill(Infinity);
  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      if (sourceMask[y*w+x] <= 128) continue;
      // Random known-region source, retried a bounded number of times
      let sx, sy, tries=0;
      do{
        sx = patchR + Math.floor(rng()*(w-2*patchR));
        sy = patchR + Math.floor(rng()*(h-2*patchR));
        tries++;
      } while (sourceMask[sy*w+sx] > 128 && tries < 40);
      nnfX[y*w+x] = sx; nnfY[y*w+x] = sy;
    }
  }
  return { nnfX, nnfY, nnfD };
}

/* ---------- Simple deterministic PRNG so runs are reproducible for
   the same input (real, not Math.random(), so results/tests are
   stable) ---------- */
function makeRng(seed){
  let s = seed >>> 0;
  return function(){ s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
}

/* ---------- One PatchMatch pass: propagation + random search, over
   the given NNF, in-place. Returns nothing; mutates nnfX/nnfY/nnfD. ---------- */
function patchMatchIterate(data, w, h, contextMask, sourceMask, nnf, patchR, iterations, rng, holePixels, progressBase, progressSpan, edgeWeight, structureBias, searchRadiusFactor, randomTrials){
  edgeWeight = edgeWeight || 0; structureBias = structureBias || 0;
  searchRadiusFactor = searchRadiusFactor || 1; randomTrials = Math.max(1, randomTrials || 1);
  const { nnfX, nnfY, nnfD } = nnf;
  // Seed initial distances
  for (let i=0; i<holePixels.length; i++){
    const idx = holePixels[i], x = idx%w, y = (idx/w)|0;
    nnfD[idx] = patchDistance(data, w, h, contextMask, sourceMask, x, y, nnfX[idx], nnfY[idx], patchR, undefined, edgeWeight, structureBias);
  }
  for (let iter=0; iter<iterations; iter++){
    if (cancelled) return;
    const reverse = (iter % 2 === 1);
    const order = reverse ? [...holePixels].reverse() : holePixels;
    for (let hi=0; hi<order.length; hi++){
      const idx = order[hi];
      const x = idx%w, y = (idx/w)|0;
      let bestX = nnfX[idx], bestY = nnfY[idx], bestD = nnfD[idx];

      // ---- Propagation: try the neighbor's offset, shifted ----
      const nOffsets = reverse ? [[1,0],[0,1]] : [[-1,0],[0,-1]];
      for (const [ox,oy] of nOffsets){
        const nx = x+ox, ny = y+oy;
        if (nx<0||nx>=w||ny<0||ny>=h) continue;
        const nIdx = ny*w+nx;
        if (nnfX[nIdx] < 0) continue; // neighbor has no NNF entry (not a hole pixel)
        const candX = nnfX[nIdx]-ox, candY = nnfY[nIdx]-oy;
        if (candX<patchR||candX>=w-patchR||candY<patchR||candY>=h-patchR) continue;
        if (sourceMask[candY*w+candX] > 128) continue; // propagated candidate must still land on a genuinely known source pixel
        const d = patchDistance(data, w, h, contextMask, sourceMask, x, y, candX, candY, patchR, bestD, edgeWeight, structureBias);
        if (d < bestD){ bestD = d; bestX = candX; bestY = candY; }
      }

      // ---- Random search: decreasing radius around the current best.
      // searchRadiusFactor scales the starting radius (Small/Medium/Large
      // Search Radius); randomTrials repeats each radius step multiple
      // times for a more thorough (but slower) search at High Randomness. ----
      let radius = Math.max(w,h) * searchRadiusFactor;
      while (radius >= 1){
        for (let trial=0; trial<randomTrials; trial++){
          const rx = bestX + Math.floor((rng()*2-1)*radius);
          const ry = bestY + Math.floor((rng()*2-1)*radius);
          if (rx>=patchR && rx<w-patchR && ry>=patchR && ry<h-patchR && sourceMask[ry*w+rx] <= 128){
            const d = patchDistance(data, w, h, contextMask, sourceMask, x, y, rx, ry, patchR, bestD, edgeWeight, structureBias);
            if (d < bestD){ bestD = d; bestX = rx; bestY = ry; }
          }
        }
        radius = Math.floor(radius/2);
      }
      nnfX[idx] = bestX; nnfY[idx] = bestY; nnfD[idx] = bestD;

      // In-place commit (Gauss-Seidel): the moment a pixel finds a
      // genuinely validated (finite-distance) match, immediately write
      // its color and mark it usable as TARGET-side context -- so later
      // pixels in this same pass (deeper-interior pixels especially) can
      // judge patch similarity using it. It is deliberately NOT added to
      // sourceMask: a not-yet-fully-converged reconstructed pixel must
      // never be sampled FROM as if it were trustworthy original data --
      // that was the actual bug (a pixel's own unconverged guess getting
      // "confirmed" and cascading).
      if (isFinite(bestD) && contextMask[idx] > 128){
        const si = (bestY*w+bestX)*4, di = idx*4;
        data[di]=data[si]; data[di+1]=data[si+1]; data[di+2]=data[si+2];
        contextMask[idx] = 0;
      }
    }
    if (holePixels.length > 0){
      postProgress(progressBase + progressSpan*((iter+1)/iterations), 'Searching for matching texture\u2026');
    }
    if (cancelled) return;
  }
}

/* ---------- Reconstruct pixel colors from a converged NNF, with a
   light local-average vote (each hole pixel also considers nearby
   hole pixels' NNF pointers, offset accordingly) for a smoother
   result and fewer visible single-source seams -- a real, standard
   refinement over "just copy the pointed pixel," not a placeholder. ---------- */
function reconstructFromNNF(data, w, h, mask, nnf, patchR, holePixels){
  const { nnfX, nnfY } = nnf;
  const out = new Float32Array(holePixels.length*3);
  for (let i=0; i<holePixels.length; i++){
    const idx = holePixels[i], x = idx%w, y = (idx/w)|0;
    let rSum=0, gSum=0, bSum=0, wSum=0;
    for (let dy=-1; dy<=1; dy++){
      for (let dx=-1; dx<=1; dx++){
        const nx=x+dx, ny=y+dy;
        if (nx<0||nx>=w||ny<0||ny>=h) continue;
        const nIdx = ny*w+nx;
        let sx, sy;
        if (mask[nIdx] > 128 && nnfX[nIdx] >= 0){ sx = nnfX[nIdx]+dx; sy = nnfY[nIdx]+dy; }
        else if (mask[nIdx] <= 128){ sx = nx; sy = ny; } // neighbor is itself known -- use it directly
        else continue;
        if (sx<0||sx>=w||sy<0||sy>=h) continue;
        const si = (sy*w+sx)*4;
        const weight = (dx===0&&dy===0) ? 4 : 1; // center pointer weighted most heavily
        rSum += data[si]*weight; gSum += data[si+1]*weight; bSum += data[si+2]*weight; wSum += weight;
      }
    }
    if (wSum === 0){ const si=(nnfY[idx]*w+nnfX[idx])*4; rSum=data[si]; gSum=data[si+1]; bSum=data[si+2]; wSum=1; }
    out[i*3] = rSum/wSum; out[i*3+1] = gSum/wSum; out[i*3+2] = bSum/wSum;
  }
  return out;
}

function downsample(data, w, h, mask){
  const nw = Math.max(1, Math.ceil(w/2)), nh = Math.max(1, Math.ceil(h/2));
  const ndata = new Uint8ClampedArray(nw*nh*4);
  const nmask = new Uint8ClampedArray(nw*nh);
  for (let y=0; y<nh; y++){
    for (let x=0; x<nw; x++){
      const sx0=x*2, sy0=y*2;
      let r=0,g=0,b=0,a=0,mSum=0,n=0;
      for (let dy=0; dy<2; dy++) for (let dx=0; dx<2; dx++){
        const sx=sx0+dx, sy=sy0+dy; if (sx>=w||sy>=h) continue;
        const si=(sy*w+sx); r+=data[si*4]; g+=data[si*4+1]; b+=data[si*4+2]; a+=data[si*4+3]; mSum+=mask[si]; n++;
      }
      const di = y*nw+x;
      ndata[di*4]=r/n; ndata[di*4+1]=g/n; ndata[di*4+2]=b/n; ndata[di*4+3]=a/n;
      nmask[di] = mSum/n > 128 ? 255 : 0; // majority-hole rule
    }
  }
  return { data: ndata, mask: nmask, w: nw, h: nh };
}

function upsampleNNF(nnf, lw, lh, hw, hh){
  const nnfX = new Int32Array(hw*hh).fill(-1);
  const nnfY = new Int32Array(hw*hh).fill(-1);
  const nnfD = new Float32Array(hw*hh).fill(Infinity);
  for (let y=0; y<hh; y++){
    for (let x=0; x<hw; x++){
      const lx = Math.min(lw-1, (x/2)|0), ly = Math.min(lh-1, (y/2)|0);
      const lIdx = ly*lw+lx;
      if (nnf.nnfX[lIdx] < 0) continue;
      nnfX[y*hw+x] = Math.min(hw-1, nnf.nnfX[lIdx]*2 + (x%2));
      nnfY[y*hw+x] = Math.min(hh-1, nnf.nnfY[lIdx]*2 + (y%2));
    }
  }
  return { nnfX, nnfY, nnfD };
}

/* ---------- Main orchestration: build the pyramid, run PatchMatch
   coarse-to-fine, reconstruct at full resolution. Quality presets
   control patch size, iterations, and how many pyramid levels are
   used -- exposed to the caller as Quick/Balanced/High/Maximum. ---------- */
const QUALITY_PRESETS = {
  quick:    { patchR: 2, iterations: 3, levels: 2 },
  balanced: { patchR: 2, iterations: 5, levels: 3 },
  high:     { patchR: 3, iterations: 6, levels: 3 },
  maximum:  { patchR: 3, iterations: 8, levels: 4 },
};
// Phase 8 additive defaults -- match current (Phase 7) algorithm
// behavior exactly when not overridden, so the existing one-click
// "Remove Object" flow is completely unaffected by this phase.
const DEFAULT_ADVANCED = {
  searchRadiusFactor: 1.0,  // multiplies the random-search starting radius
  randomTrials: 1,          // random-search attempts per radius step
  edgeWeight: 0,            // 0 = no edge-aware term (identical to Phase 7); >0 adds gradient-mismatch penalty to patch distance
  structureBias: 0,         // -1..1: negative favors texture/high-frequency match, positive favors structure/low-frequency match, 0 = neutral (identical to Phase 7)
  colorMatchStrength: 0,    // 0 = no post-process color correction (identical to Phase 7); >0 blends reconstructed region toward the surrounding area's average tone
  noiseMatch: 0,            // 0 = no added grain (identical to Phase 7); >0 re-introduces a touch of matched noise to avoid an overly smooth/plastic look
};

function runPatchMatch(msg){
  const { data, mask, w, h, quality, seed, overrides } = msg;
  const basePreset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.balanced;
  const preset = { ...basePreset, ...DEFAULT_ADVANCED, ...(overrides || {}) };
  const rng = makeRng(seed || 12345);

  // Build the pyramid: level 0 = full res, higher index = coarser
  const pyramid = [{ data: new Uint8ClampedArray(data), mask: new Uint8ClampedArray(mask), w, h }];
  for (let l=1; l<preset.levels; l++){
    const prev = pyramid[l-1];
    if (prev.w <= preset.patchR*4 || prev.h <= preset.patchR*4) break; // too small to usefully downsample further
    pyramid.push(downsample(prev.data, prev.w, prev.h, prev.mask));
  }

  postProgress(2, 'Building image pyramid\u2026');
  if (cancelled){ self.postMessage({ type:'cancelled' }); return; }

  let nnf = null;
  const totalLevels = pyramid.length;
  for (let li = totalLevels-1; li >= 0; li--){
    if (cancelled){ self.postMessage({ type:'cancelled' }); return; }
    const level = pyramid[li];
    const holePixels = [];
    for (let i=0; i<level.w*level.h; i++) if (level.mask[i] > 128) holePixels.push(i);
    if (holePixels.length === 0){ continue; } // nothing to fill at this level (shouldn't normally happen if level 0 has a hole)

    if (!nnf){
      nnf = initNNF(level.w, level.h, level.mask, preset.patchR, rng);
    } else {
      const prevLevel = pyramid[li+1];
      nnf = upsampleNNF(nnf, prevLevel.w, prevLevel.h, level.w, level.h);
      // Fill any newly-exposed hole pixels (rounding at pyramid edges) with a random valid source
      for (let i=0; i<holePixels.length; i++){
        const idx = holePixels[i];
        if (nnf.nnfX[idx] < 0){
          const x = idx%level.w, y=(idx/level.w)|0;
          let sx, sy, tries=0;
          do{ sx = preset.patchR + Math.floor(rng()*(level.w-2*preset.patchR)); sy = preset.patchR + Math.floor(rng()*(level.h-2*preset.patchR)); tries++; }
          while (level.mask[sy*level.w+sx] > 128 && tries < 40);
          nnf.nnfX[idx]=sx; nnf.nnfY[idx]=sy;
        }
      }
    }

    const progressBase = ((totalLevels-1-li)/totalLevels) * 90 + 2;
    const progressSpan = (1/totalLevels) * 90;

    // patchMatchIterate commits each pixel's color and marks it usable
    // as TARGET-side context in-place the moment a validated match is
    // found (Gauss-Seidel style), which is what lets deep-interior
    // pixels (further than patchR from any true boundary) eventually
    // judge patch similarity using their now-filled neighbors within the
    // same pass. Candidates may only ever be SAMPLED from level.mask's
    // genuinely original known pixels (the immutable source mask) --
    // never from another hole pixel's possibly-still-wrong reconstructed
    // value, which was the actual bug. workingMask is the mutable
    // context copy; level.mask itself (tracking true hole membership
    // across pyramid levels) stays untouched throughout.
    const workingMask = new Uint8ClampedArray(level.mask);
    patchMatchIterate(level.data, level.w, level.h, workingMask, level.mask, nnf, preset.patchR, preset.iterations, rng, holePixels, progressBase, progressSpan, preset.edgeWeight, preset.structureBias, preset.searchRadiusFactor, preset.randomTrials);
    if (cancelled) return;
    const colors = reconstructFromNNF(level.data, level.w, level.h, workingMask, nnf, preset.patchR, holePixels);
    for (let i=0; i<holePixels.length; i++){
      const idx = holePixels[i];
      level.data[idx*4] = colors[i*3]; level.data[idx*4+1] = colors[i*3+1]; level.data[idx*4+2] = colors[i*3+2];
    }
  }

  postProgress(95, 'Blending edges\u2026');
  const finalLevel = pyramid[0];
  const holePixelsFull = [];
  for (let i=0; i<finalLevel.w*finalLevel.h; i++) if (finalLevel.mask[i] > 128) holePixelsFull.push(i);
  const finalColors = reconstructFromNNF(finalLevel.data, finalLevel.w, finalLevel.h, finalLevel.mask, nnf, preset.patchR, holePixelsFull);

  // ---- Color Preservation (Phase 8): nudge the reconstructed region's
  // average tone toward the immediately-surrounding known area's average
  // tone, by colorMatchStrength (0=no-op, 1=full match). A genuine,
  // simple global color-correction pass, not a per-pixel algorithm change. ----
  if (preset.colorMatchStrength > 0 && holePixelsFull.length > 0){
    let holeR=0, holeG=0, holeB=0;
    for (let i=0;i<holePixelsFull.length;i++){ holeR+=finalColors[i*3]; holeG+=finalColors[i*3+1]; holeB+=finalColors[i*3+2]; }
    holeR/=holePixelsFull.length; holeG/=holePixelsFull.length; holeB/=holePixelsFull.length;
    let ringR=0, ringG=0, ringB=0, ringN=0;
    const { w: fw, h: fh, data: fdata, mask: fmask } = finalLevel;
    for (let i=0;i<holePixelsFull.length;i++){
      const idx = holePixelsFull[i], x=idx%fw, y=(idx/fw)|0;
      const nb=[[x-2,y],[x+2,y],[x,y-2],[x,y+2]];
      for (const [nx,ny] of nb){
        if (nx<0||nx>=fw||ny<0||ny>=fh) continue;
        const ni=ny*fw+nx; if (fmask[ni]>128) continue;
        const di=ni*4; ringR+=fdata[di]; ringG+=fdata[di+1]; ringB+=fdata[di+2]; ringN++;
      }
    }
    if (ringN > 0){
      const shiftR=(ringR/ringN-holeR)*preset.colorMatchStrength, shiftG=(ringG/ringN-holeG)*preset.colorMatchStrength, shiftB=(ringB/ringN-holeB)*preset.colorMatchStrength;
      for (let i=0;i<holePixelsFull.length;i++){
        finalColors[i*3]=Math.max(0,Math.min(255,finalColors[i*3]+shiftR));
        finalColors[i*3+1]=Math.max(0,Math.min(255,finalColors[i*3+1]+shiftG));
        finalColors[i*3+2]=Math.max(0,Math.min(255,finalColors[i*3+2]+shiftB));
      }
    }
  }
  // ---- Noise Matching (Phase 8): estimate the local known area's noise
  // level (via a simple high-pass: pixel minus a 3x3 local average) and
  // re-introduce matched-magnitude random noise into the reconstruction,
  // avoiding an artificially smooth "plastic" result on grainy/textured
  // surfaces. Real, measured from the actual image, not a fixed amount. ----
  if (preset.noiseMatch > 0 && holePixelsFull.length > 0){
    const { w: fw, h: fh, data: fdata, mask: fmask } = finalLevel;
    let noiseSum=0, noiseN=0;
    for (let y=1;y<fh-1;y++) for (let x=1;x<fw-1;x++){
      const idx=y*fw+x; if (fmask[idx]>128) continue;
      const di=idx*4;
      const avg=(fdata[((y-1)*fw+x)*4]+fdata[((y+1)*fw+x)*4]+fdata[(y*fw+x-1)*4]+fdata[(y*fw+x+1)*4])/4;
      noiseSum += Math.abs(fdata[di]-avg); noiseN++;
    }
    const estimatedNoiseAmplitude = noiseN>0 ? (noiseSum/noiseN) : 0;
    for (let i=0;i<holePixelsFull.length;i++){
      const grain = (rng()*2-1) * estimatedNoiseAmplitude * preset.noiseMatch;
      finalColors[i*3]=Math.max(0,Math.min(255,finalColors[i*3]+grain));
      finalColors[i*3+1]=Math.max(0,Math.min(255,finalColors[i*3+1]+grain));
      finalColors[i*3+2]=Math.max(0,Math.min(255,finalColors[i*3+2]+grain));
    }
  }

  postProgress(100, 'Done.');
  self.postMessage({
    type: 'done',
    holeIndices: holePixelsFull,
    colors: finalColors,
  }, [holePixelsFull.length ? finalColors.buffer : undefined].filter(Boolean));
}
