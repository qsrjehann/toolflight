# Ecommerce Product Editor — Architecture Notes (Canva-Inspired Shell Phase)

Scope of this phase: architecture only. No tool logic was redesigned or removed.

## What already existed before this phase (not rebuilt, verified intact)
- Left sidebar (desktop): `#epeLeftRail`, 10 category icons
- Center canvas: `#epeCanvasArea` / `#epeCanvasStageWrap`
- Right contextual panel (desktop) / bottom sheet (mobile): `#epeToolPanel`
- Floating toolbar: `#epeFloatingControls` (Undo/Redo/Zoom/Fit/Before-After)
- Bottom navigation (mobile): `.epe-tab-btn` row
- Selection toolbar: `#epeSelectionMiniToolbar`
- Contextual floating brush controls: `#epeFloatingBrushBar`

## New in this phase

### 1. Canvas centering + overlay alignment fix
`#epeCanvasStageWrap` is now a flex container (`align-items:center; justify-content:center`) so the canvas is always centered regardless of its size relative to the available space. This previously did not exist — the canvas was pinned to the top-left corner (verified via measurement: 701px asymmetric gap before the fix).

**Critical structural detail:** the artboard and overlay canvases were moved into a new inner wrapper, `#epeCanvasInner` (`position:relative`), separate from the outer wrap. This was necessary because the overlay canvas depends on `position:absolute; top:0; left:0` being relative to the *artboard canvas's own position*, not the full (now larger, centering) outer wrap. Without this inner wrapper, centering the canvas would have misaligned the overlay from the artboard — breaking selection handles, crop overlay, brush cursor, and text-edit positioning. This was caught and fixed before shipping, verified via exact bounding-box equality between the two canvases and a pixel-exact Clone Stamp coordinate test.

The three floating bars (`epeSelectionMiniToolbar`, `epeFloatingControls`, `epeFloatingBrushBar`) remain direct children of the *outer* wrap, not the inner one — they're meant to float over the full visible stage area, not just the image content.

### 2. Bottom status bar (desktop only)
New: `#epeStatusBar`, shown only at ≥900px width (mobile uses that space for the bottom nav instead). Displays canvas dimensions, zoom %, and layer count, all reusing values already computed in the existing render pipeline — no new computation logic.

### 3. Smooth zoom
Added a 150ms CSS transition on the artboard/overlay canvas width/height. Purely visual — does not touch pixel data, verified export remains byte-identical to the live preview after this change.

### 4. Smooth pan
New "hand tool" style pan-mode toggle (`#epeFloatPanBtn`), using the canvas stage wrap's existing native `overflow:auto` scrolling. Deliberately **not** a drag-anywhere gesture: the canvas already handles pointerdown for painting, selection, and layer dragging, and overloading that would risk conflicting with all of those. Pan only engages when explicitly toggled on. Verified: painting is completely unaffected when pan mode is off.

## What was intentionally not done this phase
- Tool-level UI was not touched, per the explicit instruction to redesign architecture only.
- No JS module system rewrite was performed. "Modular architecture" here refers to the existing separation of self-contained UI components (each floating bar, the sheet, the rail are independently toggleable and don't share internal state) — a full ES-module split of the ~846KB `app.js` was judged out of scope given the explicit "do not rewrite unrelated code" constraint and the risk of introducing regressions across a file this size.
- "Infinite workspace" was interpreted as smooth pan within the existing bounded stage, not an unbounded canvas — the underlying artboard/export pipeline is resolution-based and re-architecting it to be truly infinite would be a rendering-engine change, out of scope for an architecture-only phase.

## Regression testing performed
Rotate, Undo/Redo, Crop, Text, Shapes, Layers, Clone Stamp (pixel-exact), Export (byte-identical WYSIWYG), mobile viewport (exact scroll match), and pan-vs-paint non-conflict — all verified with zero console errors after the full set of changes above.
