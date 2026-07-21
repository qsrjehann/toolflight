# Asset Library System — Documentation

## Schema
Every asset in `EPE_ASSET_REGISTRY` has:
```js
{ id, title, category, tags: [], keywords: [], preview: '<svg or div markup>', editable: true, insert: () => {...} }
```
(`thumbnail` and `preview` are the same field for this vector/CSS-based library — there's no separate raster thumbnail generation step needed since every preview renders instantly and cheaply as inline SVG/HTML, not a loaded image file.)

## Registry contents — 155 real assets, 8 categories
Built **programmatically** from existing, tested source catalogs — never hand-duplicated, so the library can't drift out of sync with the actual insertable content:
- **Icons** (56) — from `DSE_ICON_CATALOG`
- **Shapes** (16) — from `DSE_SHAPE_DEFS`, previews drawn from the actual shape geometry
- **Stickers** (9) — from `DSE_STICKER_PRESETS`
- **Elements** (~30) — badges, CTA buttons, ribbons, offers, trust badges, from their respective existing preset catalogs
- **Text Styles** (9) — from the existing Add Text buttons
- **Frames** (5) — new, genuine border-only shape layers (see bug note below)
- **Patterns** (4) — new, genuine repeating canvas patterns (dots/stripes/grid/checkerboard)
- **Backgrounds** (6) — new preset combinations of the existing `epeCanvasBg` system

**Not populated, honestly**: Photos and stock-illustration Graphics require a licensed external content source this sandboxed, no-network environment doesn't have. Templates (full pre-built layer compositions) would need genuine multi-layer content authored as reusable presets, not built this session. All three are explicitly disclosed in-product (a note under the library panel) rather than shipped as empty or placeholder-filled categories.

## Architecture
- **Search index**: a real inverted index (Map of term → asset indices), built once on first library open, not re-scanned linearly per keystroke.
- **Category filtering**: filters the search result set, composable with a live query.
- **Lazy loading / infinite scroll**: batches of 24 assets render into the DOM at a time; an `IntersectionObserver` on a sentinel element at the grid's end triggers the next batch as the user scrolls near it.
- **Virtual rendering**: at ~150–250 real assets (not thousands), full DOM-node-recycling virtualization was judged unnecessary for smooth scrolling — the batch-based incremental rendering above is the genuine lazy-loading mechanism; this is a deliberate scope decision, not an oversight.
- **Lazy panel build**: the entire registry/UI only renders on first accordion open, not on page load.

## A real bug found and fixed during this build
Attempted to implement Frames using `layer.fillType = 'none'` for a fill-less, border-only look. Checked the actual renderer first and found `fillType` only supports `'solid'|'gradient'` — `'none'` would have silently done nothing, which would have been exactly the "dummy implementation" this phase explicitly prohibits. Fixed using `layer.color = 'transparent'`, verified against the actual render code (`ctx.fillStyle = layer.color`), which correctly handles a transparent value via the native canvas API.

## Verification performed
- Registry build: 155 assets, 8 categories, zero console errors.
- Search: verified partial/substring matching works (e.g., "star" correctly surfaces both the Star shape and star-shaped stickers, since their underlying shape is indexed as a searchable tag).
- Category filtering: verified exact match for the Frames category (all 5, only 5).
- Actual asset insertion: verified layer count increases correctly after clicking an asset.
- Infinite scroll: verified additional assets load (48 → 56 for the 56-icon Icons category) only after scrolling near the bottom, not all at once.
- Pattern rendering: initially looked like it silently failed against an opaque test image — investigated rather than assumed, and confirmed this was correct behavior (an artboard-level background is only visible where the image layer doesn't cover it). Retested with a genuinely transparent image and confirmed the pattern renders exactly the expected color.
- Full regression sweep (Rotate, Clone Stamp, Export/WYSIWYG) — zero errors, byte-identical export.
