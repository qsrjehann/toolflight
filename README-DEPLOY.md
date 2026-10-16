# ToolFlight – deployment notes (GSC clean-up release)

Static site hosted on **Netlify** (`netlify.toml`). Firebase is used only for Firestore (invoice accounts);
`server/` is the PDF→Word backend on Render. This release changes how URLs work, so read "URL policy" first.

## URL policy (the important part)
* Every page has exactly ONE public URL, **without `.html`**: `https://toolflight.com/pdf-merge`, homepage `/`, blog hub `/blog`.
* Canonical, `og:url`, JSON-LD, sitemap and all internal links use that clean URL.
* `netlify.toml` 301-redirects the legacy `/page.html` form to the clean URL (`force = true` – required because the file exists).
* Internal links are root-absolute (`/pdf-merge`) – open the site through a web server, not by double-clicking the files.

## Adding / editing pages
* **The HTML files are the source of truth.** `build.py` is legacy, out of sync, and locked
  (`ALLOW_LEGACY_BUILD=1` to override – do not, it would overwrite this release).
* New page checklist: clean `<link rel="canonical">`, matching `og:url`, one `<h1>`, unique `<title>` (≤ ~65 chars) and
  meta description, 450+ words of unique useful text, add it to the "Explore all tools" block in every page
  (`grep -l tf-allnav *.html`) – or at minimum link it from its hub and 3+ related pages.
* `python3 generate_sitemap.py` rebuilds `sitemap.xml` (Netlify runs it on every deploy). It reads each page's own
  canonical, skips `noindex` pages, and keeps `lastmod` honest through `data/sitemap-state.json` – commit that file.
* `ai-email-writer.html` is intentionally `noindex` (no AI provider is connected). When a real backend exists, change its
  robots meta to `index, follow`, add the provider origin to `connect-src` in `netlify.toml`, and re-run the sitemap script.

## After deploying – Google Search Console checklist
1. Check headers: `https://toolflight.com/background-remover.html` must 301 → `/background-remover` (200); `/index.html` → `/`.
2. Search Console → Sitemaps → resubmit `https://toolflight.com/sitemap.xml` (60 URLs, all clean).
3. URL Inspection → "Request indexing" for the homepage, the 6 category hubs and your ~10 best tools (daily quota is small).
4. Page indexing report: old `.html` URLs will keep showing as **"Page with redirect"** for weeks/months. That is expected and
   harmless – do not try to "fix" it. "Alternate page with proper canonical tag" should shrink as Google recrawls.
   After ~1 week, open each remaining issue and press **Validate fix**.
5. Expect 2–6 weeks for the former "Discovered – currently not indexed" pages. Indexing is Google's decision; what this release
   gives it is clean signals, a crawl path from every page, and unique content on every URL.

## Smoke test on a Netlify deploy preview (≈10 min – things a sandbox cannot reach)
PDF Merge + PDF Compress (CDN libs) · PDF to Word (Render backend) · AI Background Remover (model download) ·
Invoice Maker sign-in and "Continue as guest" (Firebase) · Contact form send (EmailJS) · Currency Converter (live rates) ·
open an old `…​.html` URL and confirm it lands on the clean URL with `?query` preserved (invoice invite links).
