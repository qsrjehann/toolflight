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

## Known separate issue (not touched here)

Urdu/RTL text (e.g. the PESCO bill's Urdu columns) still renders
garbled/overlapping. That's a text-ordering/bidi issue in `pdf2docx`'s
underlying PyMuPDF-based extraction for right-to-left scripts -- unrelated to
table detection, and explicitly out of scope for this fix per the user's
request (2026-09-02: "Urdu wala abhi rehne do, wo baad mein fix kar denge").
