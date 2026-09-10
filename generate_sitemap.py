#!/usr/bin/env python3
"""
generate_sitemap.py -- keeps sitemap.xml in sync with the actual HTML files
in this repository.

WHY THIS EXISTS
---------------
sitemap.xml was previously a hand-maintained, static file with no generator
behind it. build.py (the page-template generator) never touched it. As a
result, every time a new tool page was shipped, sitemap.xml had to be
updated *manually* -- and it wasn't, six times over (protect-pdf.html,
unlock-pdf.html, image-format-converter.html, compound-interest-calculator.html,
income-percentile-calculator.html, word-counter.html were all live,
internally linked, and indexable, but absent from sitemap.xml).

For a brand-new domain with no external backlinks, the sitemap is often
the ONLY discovery path search engines have to a page. A missing sitemap
entry does not 3xx/4xx the page, but it materially lowers the odds Googlebot
finds and prioritizes crawling it quickly.

WHAT THIS SCRIPT DOES
----------------------
1. Scans every *.html file in the repo root and blog/.
2. Skips any page whose <meta name="robots"> contains "noindex" (e.g. the
   internal ai-instance-test.html page) -- a noindex page has no business
   in the sitemap.
3. Reuses the existing <changefreq>/<priority> for any URL already present
   in sitemap.xml, so re-running this never silently changes values someone
   deliberately tuned.
4. Assigns sensible defaults for genuinely new pages based on simple,
   documented heuristics (see PRIORITY_RULES below) -- category hub pages
   (*-tools.html, calculators.html, etc.) get weekly/0.8-0.9, individual
   tool pages get monthly/0.7-0.8, blog posts get monthly/0.6.
5. Writes sitemap.xml back out, sorted in the same category order as
   before (PDF -> Image -> Calculators -> Finance -> SEO -> AI -> misc ->
   blog) so diffs stay readable.

USAGE
-----
Run this after adding/removing any HTML page:

    python3 generate_sitemap.py

It is safe to run repeatedly -- it is idempotent given an unchanged file set.
This script does not touch any HTML file; it only reads them and rewrites
sitemap.xml.
"""
import os
import re
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.abspath(__file__))
DOMAIN = "https://toolflight.com"
SITEMAP_PATH = os.path.join(ROOT, "sitemap.xml")
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"

# Ordered category buckets purely for readable output grouping.
CATEGORY_ORDER = [
    ("pdf-tools.html", ["pdf-tools.html", "pdf-", "word-to-pdf.html", "resume-builder.html", "protect-pdf.html", "unlock-pdf.html"]),
    ("image-tools.html", ["image-tools.html", "image-", "ecommerce-product-editor.html", "rotate-flip.html", "background-", "magic-eraser.html", "ai-photo-", "ai-image-upscaler.html", "ai-ocr.html", "passport-photo-maker.html"]),
    ("calculators.html", ["calculators.html", "-calculator.html", "unit-converter.html", "currency-converter.html"]),
    ("finance-tools.html", ["finance-tools.html"]),
    ("seo-tools.html", ["seo-tools.html", "qr-code-generator.html", "keyword-density-checker.html", "robots-txt-generator.html", "meta-tag-generator.html", "word-counter.html"]),
    ("ai-tools.html", ["ai-tools.html", "ai-email-writer.html", "ai-keyword-generator.html"]),
    ("misc", ["invoice-maker.html", "contact.html"]),
    ("blog.html", ["blog.html", "blog/"]),
]

# Defaults applied ONLY to a URL that has never appeared in sitemap.xml
# before. Existing entries always keep their current values.
DEFAULT_CHANGEFREQ_HUB = "weekly"
DEFAULT_PRIORITY_HUB = "0.8"
DEFAULT_CHANGEFREQ_TOOL = "monthly"
DEFAULT_PRIORITY_TOOL = "0.8"
DEFAULT_CHANGEFREQ_BLOG = "monthly"
DEFAULT_PRIORITY_BLOG = "0.6"

HUB_PAGES = {
    "pdf-tools.html", "image-tools.html", "calculators.html",
    "finance-tools.html", "seo-tools.html", "ai-tools.html", "blog.html",
}


def is_noindex(filepath):
    try:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            head = f.read(4000)
    except OSError:
        return True
    m = re.search(r'<meta\s+name="robots"\s+content="([^"]*)"', head, re.I)
    return bool(m and "noindex" in m.group(1).lower())


def discover_pages():
    pages = []
    for name in sorted(os.listdir(ROOT)):
        if name.endswith(".html") and os.path.isfile(os.path.join(ROOT, name)):
            pages.append(name)
    blog_dir = os.path.join(ROOT, "blog")
    if os.path.isdir(blog_dir):
        for name in sorted(os.listdir(blog_dir)):
            if name.endswith(".html"):
                pages.append(f"blog/{name}")
    return pages


def load_existing():
    existing = {}
    if not os.path.exists(SITEMAP_PATH):
        return existing
    tree = ET.parse(SITEMAP_PATH)
    root = tree.getroot()
    for url in root.findall(f"{{{NS}}}url"):
        loc = url.find(f"{{{NS}}}loc").text.strip()
        path = loc[len(DOMAIN):].lstrip("/")
        if path == "":
            path = "index.html"
        cf = url.find(f"{{{NS}}}changefreq")
        pr = url.find(f"{{{NS}}}priority")
        existing[path] = {
            "changefreq": cf.text if cf is not None else DEFAULT_CHANGEFREQ_TOOL,
            "priority": pr.text if pr is not None else DEFAULT_PRIORITY_TOOL,
        }
    return existing


def category_bucket(path):
    # Blog posts are checked first and matched purely by directory, so a
    # post whose filename happens to contain "pdf"/"image" etc. (e.g.
    # blog/best-free-pdf-tools.html) never leaks into the PDF/Image tool
    # buckets -- that substring match was the original bug here.
    if path.startswith("blog/") or path == "blog.html":
        return "blog.html"
    for bucket, prefixes in CATEGORY_ORDER:
        if bucket == "blog.html":
            continue
        for p in prefixes:
            if path == p:
                return bucket
            # Hyphenated group prefixes (e.g. "pdf-", "image-", "-calculator.html")
            # are matched with startswith/endswith only -- never a bare
            # substring check, which is what previously caused false matches.
            if p.endswith(".html") and not p.startswith("-") :
                continue  # exact-name prefixes already handled by path == p above
            if p.startswith("-") and path.endswith(p):
                return bucket
            if not p.startswith("-") and not p.endswith(".html") and path.startswith(p):
                return bucket
    return "misc"


def main():
    pages = discover_pages()
    existing = load_existing()

    entries = []
    skipped_noindex = []
    for path in pages:
        fp = os.path.join(ROOT, path)
        if is_noindex(fp):
            skipped_noindex.append(path)
            continue
        if path in existing:
            entries.append((path, existing[path]["changefreq"], existing[path]["priority"]))
        else:
            if path == "index.html":
                entries.append((path, "weekly", "1.0"))
            elif path in HUB_PAGES:
                entries.append((path, DEFAULT_CHANGEFREQ_HUB, DEFAULT_PRIORITY_HUB))
            elif path.startswith("blog/"):
                entries.append((path, DEFAULT_CHANGEFREQ_BLOG, DEFAULT_PRIORITY_BLOG))
            else:
                entries.append((path, DEFAULT_CHANGEFREQ_TOOL, DEFAULT_PRIORITY_TOOL))
            print(f"[new] adding {path} to sitemap with defaults "
                  f"(changefreq={entries[-1][1]}, priority={entries[-1][2]}) -- "
                  f"review and adjust priority by hand if this page deserves more/less weight.")

    # Sort by category bucket order, then alphabetically within bucket,
    # with index.html always first.
    bucket_rank = {b: i for i, (b, _) in enumerate(CATEGORY_ORDER)}

    def sort_key(entry):
        path = entry[0]
        if path == "index.html":
            return (-1, "")
        return (bucket_rank.get(category_bucket(path), 999), path)

    entries.sort(key=sort_key)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, changefreq, priority in entries:
        loc = DOMAIN + "/" if path == "index.html" else f"{DOMAIN}/{path}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")

    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nWrote {len(entries)} URLs to sitemap.xml.")
    if skipped_noindex:
        print(f"Skipped {len(skipped_noindex)} noindex page(s): {', '.join(skipped_noindex)}")


if __name__ == "__main__":
    main()
