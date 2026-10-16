#!/usr/bin/env python3
"""
generate_sitemap.py -- rebuilds sitemap.xml from the HTML files in this repo.

* One <url> per indexable page; <loc> is read from the page's own
  <link rel="canonical">, so sitemap and canonical can never disagree
  (clean URLs, no ".html").
* Skips noindex pages and 404.html.
* <lastmod> is honest: data/sitemap-state.json stores a content hash per page;
  the date only changes when the page content actually changes.
* changefreq/priority are omitted on purpose (Google ignores them).

Run:  python3 generate_sitemap.py      (Netlify also runs it on every deploy)
"""
import os, re, glob, json, hashlib, datetime
ROOT = os.path.dirname(os.path.abspath(__file__))
DOMAIN = "https://toolflight.com"
STATE = os.path.join(ROOT, "data", "sitemap-state.json")
SKIP = {"404.html"}
HUBS = ["pdf-tools", "image-tools", "calculators", "finance-tools", "seo-tools", "ai-tools", "blog"]

def today():
    return os.environ.get("SITEMAP_TODAY") or datetime.date.today().isoformat()

def load_state():
    try:
        return json.load(open(STATE, encoding="utf-8"))
    except Exception:
        return {}

def content_hash(html):
    html = re.sub(r"\?v=\d{8}-\d{4}", "", html)   # ignore cache-busting build stamp
    return hashlib.sha1(html.encode("utf-8")).hexdigest()

def main():
    state, new_state, entries = load_state(), {}, []
    files = sorted(glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "blog", "*.html")))
    for f in files:
        rel = os.path.relpath(f, ROOT).replace(os.sep, "/")
        if rel in SKIP:
            continue
        html = open(f, encoding="utf-8", errors="ignore").read()
        m = re.search(r'<meta\s+name="robots"\s+content="([^"]*)"', html)
        if m and "noindex" in m.group(1).lower():
            continue
        c = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', html)
        loc = c.group(1) if c else DOMAIN + ("/" if rel == "index.html" else "/" + rel[:-5])
        h = content_hash(html)
        old = state.get(loc)
        lastmod = old["lastmod"] if old and old.get("hash") == h else today()
        new_state[loc] = {"hash": h, "lastmod": lastmod}
        entries.append((loc, lastmod, rel))

    def order(e):
        loc, _, rel = e; slug = rel[:-5]
        if rel == "index.html": return (0, "")
        if slug in HUBS: return (1, HUBS.index(slug))
        if rel.startswith("blog/"): return (3, slug)
        return (2, slug)
    entries.sort(key=order)
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lm, _ in entries:
        out += ["  <url>", f"    <loc>{loc}</loc>", f"    <lastmod>{lm}</lastmod>", "  </url>"]
    out.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(new_state, open(STATE, "w", encoding="utf-8"), indent=1, sort_keys=True)
    print(f"sitemap.xml written: {len(entries)} URLs")

if __name__ == "__main__":
    main()
