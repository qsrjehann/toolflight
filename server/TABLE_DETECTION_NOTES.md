# Table detection: bordered vs. borderless (`extract_stream_table`)

## What changed

`server/app.py`'s `cv.convert(...)` call now passes `extract_stream_table=True`.
This is a built-in `pdf2docx` setting (off by default) that turns on detection
of "stream" tables -- tabular data laid out with plain whitespace/tab
alignment and no drawn border lines. Before this change, only "lattice"
tables (real drawn grid-lines, like the PESCO bill's charges table) were
turned into real Word tables; anything without visible borders -- e.g. a
payroll slip's "Wage type | Amount" columns -- stayed as plain aligned text,
even though the FAQ on pdf-to-word.html already described that exact
limitation.

## Why this, not a custom detector

`server/postprocess_docx.py`'s `extract_pdf_table_col_widths()` already has a
"Method B" fallback (text X-origin clustering) for computing column widths on
borderless regions, but that only *widens an existing DOCX table* -- it can't
create one. Whether a borderless region becomes a real `<w:tbl>` at all is
decided entirely by `pdf2docx`'s own base conversion. Rather than writing a
second, competing table-detection heuristic, this flips the one already-built
switch in the library that governs it.

## Testing performed (2026-09-02)

Ran the *actual* production endpoint (`gunicorn app:app`, unmodified
`postprocess()` pipeline) against 5 PDFs, before/after this flag, and
compared paragraph text + table structure byte-for-byte:

| PDF | Before | After | Notes |
|---|---|---|---|
| `small_text.pdf` (plain prose, bold/italic, no table) | 0 tables | 0 tables | identical output |
| `pesco_style_bill.pdf` (real bordered table + several `Label: value` lines) | 1 table (5x3, bordered) | 1 table (5x3, bordered) | identical output -- `Label: value` lines did **not** become a spurious table |
| `salary_statement_style.pdf` (borderless "Wage type/Amount" columns, reconstructed from the user's real salary-slip screenshot) | table already present in this reconstruction | table present, correctly width-patched by the `cols` fix | see caveat below |
| `bullet_list.pdf` (bulleted list, adversarial case) | 0 tables | 0 tables | `list_not_table` default guard still holds |
| `label_value_only.pdf` (single-column stacked label:value pairs, adversarial case) | 0 tables | 0 tables | no spurious table |

**Caveat, stated plainly:** the synthetic `salary_statement_style.pdf` above
(built with reportlab to mirror the visible structure of the user's real
government salary-slip screenshot) already produced a correct table *even
before* this flag was enabled -- meaning this specific reconstruction did not
reproduce the "table missing" symptom the user reported. The real PDF (a
multi-section government payroll document with several structurally
different tabular blocks stacked on one page: Pay and Allowances, Deductions
-- General, Deductions -- Loans and Advances, Deductions -- Income Tax) was
only ever seen as a screenshot, not the actual file, so its precise internal
text-positioning couldn't be tested directly. `extract_stream_table=True` is
the correct, officially-documented lever for this class of problem and is
confirmed zero-regression against every test file above, but whether it
fully fixes that exact real document is unverified pending the actual PDF.

## Follow-up fix (2026-09-02): row-height overflow was hiding real data

After the `extract_stream_table` change above, the user reported specific
values as "missing" on their real salary-slip PDF (marked with red boxes:
`Pay Scale Type: Civil` and `Domicile: NW - Khyber Pakhtunkhwa`). Direct
inspection of the converted DOCX's XML showed the text was always present
in the file (visible via `python-docx` cell inspection). The actual defect
was visual, not textual: `pdf2docx` gives every table row a fixed height
(`<w:trHeight w:hRule="exact">`) copied from the tight single-line spacing
of the source PDF. When a cell's text that fit on one line in the PDF wraps
to two lines in the DOCX (small font-metric differences between the PDF's
embedded font and the font Word/LibreOffice/WPS substitutes), the `exact`
rule keeps the row pinned at its original height instead of growing, so the
wrapped second line renders on top of the row/paragraph that follows —
visually overlapping and obscuring both values. This was confirmed with a
LibreOffice-rendered screenshot of the actual uploaded PDF: both phrases
were overlapped by adjacent text exactly where the user's red boxes were.

Fix: a new post-processing step, `row_height` (in `postprocess_docx.py`,
`fix_table_row_overflow()`), switches every table row's `hRule` from
`exact` to `atLeast`. Rows whose text already fits on one line are
unaffected (identical rendered height); rows that need to wrap now grow
instead of overlapping. Verified byte-for-byte that this step changes only
the `w:trHeight` height-rule attribute — running it against all 6 test PDFs
(the 5 from the table above, plus the user's real salary-slip PDF) with a
structural diff of the full DOCX body (with `trHeight` stripped out for the
comparison) shows 100% identical text and structure before/after; only the
height rule differs, and only on rows that were previously overflowing.

## Follow-up (2026-09-02, part 2): why the table looked "missing" in WPS
even though it existed and rendered fine in LibreOffice

After confirming the row-height fix worked and the deploy was verified
live (`/api/health` build tag matched), the user tested a *different* real
salary-slip PDF (July-2026) and still reported no table. Direct testing in
this environment against that exact file showed the "Wage type / Amount"
grid **was** a real `<w:tbl>` with real per-cell borders, and LibreOffice's
own PDF export of the DOCX shows it fully gridded -- so the file was not
literally missing a table. The discrepancy pointed at a difference between
how LibreOffice (used to verify) and WPS Office mobile (used by the user,
based on their screenshots) parse the file.

Root cause, found by inspecting the raw OOXML: `pdf2docx`'s own base
conversion writes every table cell's border like this:

```xml
<w:top w:sz="5.599999999999909" w:val="single" w:color="#000000"/>
```

`w:sz` on a border is `ST_EighthPointMeasure` per the OOXML spec (ECMA-376
/ ISO-29500) -- an integer number of eighths-of-a-point. `pdf2docx`
computes it by multiplying a PDF point measurement (a float) by 8 and
writing the raw Python float straight into the attribute, with no
rounding. The same thing happens to `w:w` (widths in twips, e.g.
`<w:tcW w:w="546.00000000002"/>`) throughout the document -- confirmed by
counting occurrences: 283-306 such non-integer attributes in the two real
salary-slip conversions tested.

Word and LibreOffice are lenient here: they coerce the value to a number
and ignore the fractional part, so the border renders normally -- which is
exactly why testing this fix's rendering with LibreOffice never caught it.
A stricter OOXML parser is allowed by the spec to reject an out-of-schema
attribute value instead of coercing it, and silently drop just that
border. If that's what WPS Office's mobile renderer does, a table with
real single-line borders in its XML would render with **no visible border
at all** -- indistinguishable from plain aligned text, exactly the
"missing table" symptom reported, on a file that another renderer (and
raw XML inspection) shows is structurally correct.

**This explanation is the best-evidenced one available without a WPS
install to test against directly** -- it is not 100% proven the way the
row-height fix was (that one was directly observed overlapping in a
render, then directly observed fixed). It is stated as the most likely
cause, not a certainty. What's important is that the fix carries no
downside either way: normalizing every `w:sz`/`w:w`/`w:trHeight val`
attribute to a clean integer can only make the file *more* spec-compliant,
never less, regardless of whether this exact mechanism is what WPS is
doing.

**Fix:** new post-processing step `fix_measurements`
(`fix_non_integer_measurements()`), run last in the pipeline, rounds every
`w:sz` and `w:w` attribute anywhere in the document, plus `w:val` on
`w:trHeight`, to the nearest whole number. Nothing else (text, colors,
other attributes) is touched.

## Follow-up (2026-09-02, part 3): numbers wrapping mid-value inside their own cell

Same July-2026 file, reported separately: the "Deductions: (Rs.):" row's
value **-7,155.00** was rendering as "-" on one line and "7,155.00" on the
next, inside its own table cell (and "105,752.00" similarly split as
"105,752." / "00"). Measured directly: that cell is 1060 twips wide, but
`pdf2docx` also gives its paragraph a `<w:ind w:left="244"/>` (reproducing
the text's exact horizontal offset from the source PDF), which eats 244 of
those twips before the text even starts. Using reportlab's real font
metrics for the exact run (Times New Roman Bold, 10pt), the string needs
816.6 twips and only 816 are left after the indent -- a razor-thin,
essentially rounding-level shortfall that's enough for the renderer to
wrap after the hyphen (a legal line-break point). "105,752.00" was in the
same situation (14 twips of slack against font-substitution rounding
error). Confirmed both wrapped in an actual LibreOffice rendering, so it's
not WPS-specific this time -- a genuinely tight column.

**Fix:** new step `narrow_cols` (`fix_narrow_column_wraps()`). For every
table cell, it measures the real rendered width of the text (reportlab's
built-in AFM font metrics, not a guess) plus its paragraph indent, and
compares that against the cell's assigned width. Where a column is short,
it widens that column by *borrowing* twips from another column in the
same table that was measured to have spare room -- the table's total
width never changes, so page layout is unaffected.

**Safety restriction, found via testing:** this was first implemented
using each table's `<w:tblGrid>` as the source of truth for "current width
per column," and it caused a real regression on the 11-column Gross
Pay / Deductions / Net Pay summary row -- that table's `tblGrid` lists 11
*equal* placeholder columns (10758 twips / 11 ≈ 978 each) even though the
real, already-reasonable rendered width of every cell comes from that
cell's own `<w:tcW>`, independently set by `pdf2docx` per cell and not
reconcilable with gridSpan sums when different rows merge cells at
different boundaries (row 0 and row 1 of that table don't share the same
span pattern). Reconciling against the meaningless uniform grid overwrote
real widths with nonsense -- making the target cell *narrower*, the
opposite of the fix's purpose. Caught by re-rendering and looking, not by
the text-identity check (which only proves content wasn't lost, not that
widths are sane).

Rather than special-case that, the fix now only ever touches a table where
every row has the exact same number of cells with no `gridSpan` anywhere
-- the one shape where `tblGrid` really does mean the same thing in every
row, so borrowing/lending between columns is unambiguous. Any table built
from row-to-row-different cell merges (like that summary row) is left
completely untouched, exactly as before this fix existed. Net effect:
the wage-type grid and similar plain (non-merged) tables get widened and
stop wrapping; the merged-cell summary row keeps its pre-existing
mid-number wrap (confirmed non-data-loss, per the row-height fix above) —
a known, cosmetic, no-longer-any-data-loss limitation.

**Regression testing (2026-09-02, both follow-ups together):** re-ran the
same 5 original test PDFs plus both real uploaded salary slips (May and
July 2026) through the full production pipeline. Compared every run's
extracted paragraph text and every table's per-cell text against the
row-height-only baseline (the version already confirmed live) -- **100%
identical in all 7 files**, before and after adding `narrow_cols` and
`fix_measurements`. Re-rendered every file via LibreOffice and visually
confirmed: wage-type/general tables gain visible borders and single-line
number cells with no data-loss overlap; the 11-column summary row is
provably untouched (widths match the pre-fix baseline exactly); the PESCO
bordered-table and May salary-slip renderings are unchanged.

## Follow-up (2026-09-03): logo landing off the page edge

New report on the same July-2026 file: the district logo now appeared right
at the page's edge, unlike the original PDF. Root cause, found by reading
the raw OOXML: the header row's table (title text in one cell, the logo
image in the other) carries a left indent (`<w:tblInd>`, reproducing the
title text's exact PDF x-offset) *and* a `<w:tblGrid>` sized to the page's
full usable width -- pdf2docx computes the two independently and never
checks whether indent + width still fit on the page. Measured on the
actual file: left margin + indent (1262 twips) + grid width (10754 twips)
overran the page by ~33.7pt, dragging the (inline) logo in its cell along
with it -- confirmed by rendering and measuring the logo's bounding box
with `pymupdf.get_image_info()`: its right edge sat at 603.8pt on a
595.3pt-wide page.

**Fix:** new step `page_overflow` (`fix_table_page_overflow()`), run last.
For every top-level table, using the real page size/margins/indent (all
read from the file), if the table's grid is wider than what's actually
available, every column is scaled down by the same ratio so the table's
right edge lands exactly at the margin -- proportions preserved, nothing
assumed. Verified after the fix: the logo's bounding box is now
480.25-540.75pt, safely inside the page.

**Bug found and fixed while building this:** the first version rebuilt
each cell's width as `sum(scaled_gridCol[position : position+gridSpan])`
-- correct when every row shares one column layout, but for the "Gross
Pay/Deductions/Net Pay" summary table (different gridSpan pattern in each
row -- see the next section) that discarded whatever row-specific width
adjustment had just been made, silently re-wrapping "-7,155.00" even
though the fix that widened it had already run earlier in the same
pipeline. Corrected to scale each cell's *own current* width by the ratio
instead of reconstructing it from grid position -- for ordinary tables
this produces the exact same numbers as before; for span-varying tables
it stops erasing other steps' work.

## Follow-up (2026-09-03): "-7,155.00" and "105,752.00" still wrapping

Direct user report, repeated after the row-height and narrow_cols fixes
were already live: the "Deductions: (Rs.):" and "Net Pay: (Rs.):" values
were still splitting onto two lines. Root cause: those values live in the
"Gross Pay / Deductions / Net Pay" summary table, whose row 0 (Payable /
Recovered / Exempted / Recoverable) and row 1 (Gross Pay / Deductions /
Net Pay) use *different* `gridSpan` patterns over the same 11-column
`<w:tblGrid>` -- exactly the shape `fix_narrow_column_wraps`'s safety gate
was built to skip (see the part-3 section above), so this table was never
touched by that fix.

**First attempt, and why it failed:** widen each deficient cell's own
`<w:tcW>`, borrowing slack from another cell in the *same row* only (never
touching `<w:tblGrid>`, so the cross-row ambiguity that forced the earlier
safety gate couldn't apply). The saved file genuinely had the new
`<w:tcW>` values -- confirmed by re-opening it -- but re-rendering showed
*zero* visual change, and manually forcing +400 twips onto the exact
deficient cells still produced an identical render. Root cause: this
table's `<w:tblPr>` has `<w:tblLayout w:type="fixed"/>` with
`<w:tblW w:type="auto" w:w="0"/>`. For a "fixed"-layout table whose rows
slice `<w:tblGrid>` into different `gridSpan` patterns, both LibreOffice
and Word render each cell's width as the sum of the grid columns its span
covers -- `<w:tcW>` is written by pdf2docx on every cell but is decorative
here; only `<w:tblGrid>` actually controls layout. This directly overturns
what the part-3 note above assumed ("a table's real rendered width is
per-cell tcW, not necessarily gridCol") -- true for tables where gridCol
was already a meaningless uniform placeholder nobody read, false for a
table like this one where the renderer reads it as authoritative.

**Real fix:** new step `merged_row_wraps` (`fix_merged_row_narrow_wraps()`),
run right after `narrow_cols`. For a table with row-to-row gridSpan
differences, if every row's spans still add up to exactly the table's
column count (a clean full re-partition each time -- otherwise the table
is left untouched, same caution as before), the fix measures every cell's
real needed text width (same reportlab AFM-metrics technique, with one bug
fixed along the way: `<w:b w:val="0"/>` -- bold explicitly turned off --
was being read as bold because the code only checked whether `<w:b>`
existed, not its value, overestimating some cells' need), spreads that
need evenly across the grid columns the cell covers, and sets each grid
column to the *maximum* any row's cell needs from it. Leftover width is
handed back proportionally to the columns' original sizes, so the table's
overall width -- and the page layout -- never changes. Verified on the
real file: "-7,155.00" and "105,752.00" (and, as a bonus, "Recovered till
JUL-2026:" and "Exempted: 0.17-" in the row above, which were also
wrapping) now render on a single line each; re-rendered and confirmed the
May slip, PESCO bill, and all synthetic test files are visually unchanged.

## Follow-up (2026-09-03): invalid `w:color` hex values

While investigating why the table stayed invisible in WPS even after the
float-`w:sz` fix (see part 2 above) went live, found that pdf2docx writes
every `<w:color>` as `"#RRGGBB"` -- valid CSS, but invalid OOXML, which
requires `ST_HexColor` to be exactly 6 hex digits or the literal `"auto"`,
with no `#`. This is systemic: 100% of `w:color` occurrences in every test
file use this invalid form (273-306 per real salary slip), and it's
present in pdf2docx's own base conversion, before any post-processing.

**Fix:** `fix_measurements` (already normalizing non-integer `w:sz`/`w:w`)
now also strips the leading `#` from every `w:color` value. Like the
float-sz fix, this is offered honestly as the best-evidenced next
candidate for the WPS invisible-table symptom, not a proven one -- the
float-sz fix alone did not make the table appear in WPS when tested live,
so this is a stronger, more systemic companion fix, but there is still no
WPS installation available in this environment to confirm it directly.

## Follow-up (2026-09-03): `patch_column_widths` matching an image table

`patch_column_widths()` (the `cols` step) matches each DOCX table to a PDF
table region by column count, in order. On the July file this caused the
2-column header/logo table to match an unrelated 4-column PDF region via
the "nearest match" fallback, producing nonsense widths for a table that
has no business being width-patched by text geometry in the first place --
it holds a picture, not text columns. Fixed by skipping any table that
contains a `<w:drawing>` before this logic runs.

## Follow-up (2026-09-03): heading breaking into six ugly lines

Direct user report, with screenshots: the heading no longer looked like
the original PDF at all -- it rendered as six short, oddly-broken lines
("Dist. Govt. KP-" / "Provincial District" / "Accounts Office" /
"Peshawar Dist." / "Monthly Salary" / "Statement (July-2026)") even after
every fix above was live. This was NOT caused by any of today's fixes --
it was already there (visible in this session's own earlier render
screenshots), just not flagged until now.

Root cause: the title-text cell (in the same row/table as the district
logo) is a reasonable 5526 twips (~276pt) wide, but its one paragraph
carries `<w:ind w:left="1288" w:right="1440" w:firstLine="378"/>` --
2728 twips of left+right indent, reproducing the text's original
horizontal offset from the page's left edge in the source PDF. That made
sense when this text was a normal line on a single-column page; once
pdf2docx also put it inside a table cell -- whose position is already
fully determined by the table's `<w:tblInd>` and column boundary -- the
paragraph indent became pure redundant overhead, eating 2728 of the
cell's 5526 twips before a single character is drawn and leaving only
~140pt to wrap into, instead of the cell's real ~276pt. Confirmed by
directly zeroing just this one paragraph's indent on the real file: the
six-line break became two clean lines ("Dist. Govt. KP-Provincial
District Accounts Office" / "Peshawar Dist. Monthly Salary Statement
(July-2026)"), close to the source PDF's own three-line layout.

**Fix:** new step `title_indent` (`fix_header_title_indent()`), run right
after `cols`. Scope kept deliberately narrow: only paragraphs in a
non-image cell that shares its table with an image cell (exactly the
header/logo table pattern this was diagnosed on) have their `w:ind`
left/right/firstLine zeroed. Every other cell's indent is legitimate,
small, and already accounted for by `narrow_cols`/`merged_row_wraps` as
real width-consumption, so nothing else is touched. Verified: exactly 1
paragraph fixed on each real salary slip (May and July), 0 on all 5
synthetic test files (none of them have an image-bearing table). Re-ran
the full text-identity check across all 7 files -- 100% identical to the
text-only baseline, confirming this only changes layout, never content.
Re-rendered both real slips: July's heading is now 2 lines, May's is 3 --
both natural word-wraps at the cell's real width, matching the source
PDF's look far more closely than the six-line break did.

## Known separate issue (not touched here)

Urdu/RTL text (e.g. the PESCO bill's Urdu columns) still renders
garbled/overlapping. That's a text-ordering/bidi issue in `pdf2docx`'s
underlying PyMuPDF-based extraction for right-to-left scripts -- unrelated to
table detection, and explicitly out of scope for this fix per the user's
request (2026-09-02: "Urdu wala abhi rehne do, wo baad mein fix kar denge").
