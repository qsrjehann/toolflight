import os
from datetime import datetime, timezone

OUT = "/home/claude/toolverse-multi"

# Single build version generated once per build run, applied identically to
# every local asset reference across every page. Format matches the task's
# example: YYYYMMDD-HHMM in UTC, so every deployment automatically gets a
# fresh, unique version with zero manual editing required.
BUILD_VERSION = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")

PAGES = [
    ("index.html", "Home"),
    ("pdf-tools.html", "PDF Tools"),
    ("image-tools.html", "Image Tools"),
    ("calculators.html", "Calculators"),
    ("finance-tools.html", "Finance Tools"),
    ("seo-tools.html", "SEO Tools"),
]

NAV_ITEMS = [
    ("index.html", "Home"),
    ("pdf-tools.html", "PDF Tools"),
    ("image-tools.html", "Image Tools"),
    ("calculators.html", "Calculators"),
    ("finance-tools.html", "Finance Tools"),
    ("seo-tools.html", "SEO Tools"),
    ("ai-tools.html", "AI Tools"),
    ("blog.html", "Blog"),
]

def head(title, description, og_path):
    return f"""<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="icon" href="assets/favicon.ico?v={BUILD_VERSION}" sizes="32x32">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg?v={BUILD_VERSION}">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v={BUILD_VERSION}">
<link rel="canonical" href="https://toolflight.com/{og_path}">

<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ToolFlight">
<meta property="og:url" content="https://toolflight.com/{og_path}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">

<script>
/* Runs synchronously, before CSS or body paint -- the only way to avoid a
   flash of the wrong theme, since an external script (even with defer)
   always executes after the DOM is parsed. Prefers a saved user choice over
   the OS-level prefers-color-scheme, so a manual theme selection survives
   navigating between ToolFlight's pages instead of resetting on every load. */
(function(){{
  try{{
    var saved = localStorage.getItem('toolflight_theme');
    var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  }}catch(e){{}}
}})();
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css?v={BUILD_VERSION}">
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "ToolFlight",
  "applicationCategory": "Utility",
  "operatingSystem": "Any",
  "description": "{description}",
  "offers": {{ "@type": "Offer", "price": "0", "priceCurrency": "USD" }}
}}
</script>
"""

def navbar(active_file):
    links = ""
    for href, label in NAV_ITEMS:
        links += f'<a href="{href}" data-page="{href}">{label}</a>\n      '
    return f"""<nav class="navbar">
  <div class="nav-inner">
    <a href="index.html" class="logo" style="text-decoration:none;">
      <img src="assets/logo.svg?v={BUILD_VERSION}" alt="ToolFlight logo" width="30" height="30" style="border-radius:9px;">
      ToolFlight
    </a>
    <div class="nav-links mobile-hide">
      {links}
    </div>
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">
      <svg id="themeIconSun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      <svg id="themeIconMoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hidden"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
  </div>
</nav>
"""

def footer():
    return f"""<footer>
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="logo" style="margin-bottom:10px;"><img src="assets/logo.svg?v={BUILD_VERSION}" alt="ToolFlight logo" width="30" height="30" style="border-radius:9px;"> ToolFlight</div>
        <p style="font-size:13px;color:var(--ink-soft);max-width:260px;line-height:1.6;">Free PDF, image, calculator, finance, and SEO tools that respect your privacy — most run locally in your browser.</p>
      </div>
      <div>
        <h4>Tools</h4>
        <a href="pdf-tools.html">PDF Tools</a>
        <a href="image-tools.html">Image Tools</a>
        <a href="calculators.html">Calculators</a>
        <a href="finance-tools.html">Finance Tools</a>
        <a href="seo-tools.html">SEO Tools</a>
        <a href="ai-tools.html">AI Tools</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="index.html#about-section">About</a>
        <a href="index.html#faq">FAQ</a>
        <a href="#" onclick="openLegal('contact');return false;">Contact</a>
      </div>
      <div>
        <h4>Legal</h4>
        <a href="#" onclick="openLegal('privacy');return false;">Privacy Policy</a>
        <a href="#" onclick="openLegal('terms');return false;">Terms of Service</a>
      </div>
    </div>
    <div class="footer-bottom">© <span id="year"></span> ToolFlight. All core tools are processed locally in your browser.</div>
  </div>
</footer>

<div class="legal-modal" id="legalModal">
  <div class="legal-box">
    <button class="legal-close" onclick="closeLegal()">✕</button>
    <div id="legalContent"></div>
  </div>
</div>

<div class="toast-stack" id="toastStack" role="status" aria-live="polite"></div>
"""

def page_shell(active_file, title, description, body, og_path_override=None):
    og_path = active_file if og_path_override is None else og_path_override
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{head(title, description, og_path)}
</head>
<body>
{navbar(active_file)}
{body}
{footer()}
<script defer src="js/app.js?v={BUILD_VERSION}"></script>
</body>
</html>
"""

# ---------- ICONS ----------
ICON_PDF_MERGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="10" height="13" rx="2"/><path d="M10 17v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1"/></svg>'
ICON_PDF_SPLIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>'
ICON_PDF_COMPRESS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 13l2 2 4-4"/></svg>'
ICON_PDF_WORD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 13l1.5 5L11 14l1.5 4L14 13"/></svg>'
ICON_COMPRESS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h4v6M20 10h-4V4M14 4l6 6M4 20l6-6"/></svg>'
ICON_QR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01"/></svg>'
ICON_RESIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'
ICON_AGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
ICON_BMI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5c0 2-1 3-1 5v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8c0-2-1-3-1-5a5 5 0 0 1 5-5z"/></svg>'
ICON_CURRENCY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8h7a3 3 0 0 1 0 6H8m0 0l3 3m-3-3l3-3M17 16H9"/></svg>'
ICON_LOAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M2 11h20M6 15h4"/></svg>'
ICON_META = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h7"/></svg>'
ICON_KEYWORDS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>'
ICON_ROBOTS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/><path d="M9 18h6"/></svg>'
ICON_GST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l3 3v17H6z"/><path d="M9 12l6 6M15 12l-6 6"/></svg>'
ICON_SCIENTIFIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M7 12h1M11 12h1M15 12h1M7 16h1M11 16h1M15 16h1"/></svg>'
ICON_UNIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3v18M7 3l-3 4M7 3l3 4M17 21V3M17 21l-3-4M17 21l3-4"/></svg>'
ICON_XCHANGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>'
ICON_CROP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>'
ICON_WATERMARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17l3-3 2 2 4-5"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>'
ICON_ROTATE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 1 3 6.7"/><path d="M3 21v-5h5"/></svg>'
ICON_AI_REMOVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4"/><circle cx="12" cy="12" r="4"/></svg>'
ICON_AI_CHANGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>'
ICON_MAGIC_ERASER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3l12 12-6 6L3 9z"/><path d="M9 3L3 9"/><path d="M14 8L8 14"/></svg>'
ICON_PHOTO_ENHANCER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>'
ICON_UPSCALER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M9 9l6 6M15 9v6h-6"/></svg>'
ICON_OCR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>'
ICON_RESUME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/></svg>'
ICON_AI_EMAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/><path d="M15.5 3.5l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5L13.5 5.7l1.5-.7z"/></svg>'
ICON_PASSPORT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>'

def tool_card(icon_svg, title, desc, tool_key, placeholder=False):
    active_cls = " active" if not placeholder and tool_key == "__FIRST__" else ""
    ph_attr = ' data-placeholder="true"' if placeholder else ""
    tag = '<span class="coming-soon-tag">Coming soon</span>' if placeholder else ""
    return f"""<button class="tool-card{'' if placeholder else ''}" data-tool="{tool_key}"{ph_attr}>
      {tag}
      <div class="tool-icon">{icon_svg}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </button>"""

def category_hub_card(href, icon_svg, title, desc, cta="Open tools"):
    return f"""<a href="{href}" class="category-hub-card">
      <div class="tool-icon">{icon_svg}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <span class="cta-link">{cta} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
    </a>"""

import re as _re
def ensure_button_types(html):
    """Every <button ...> without an explicit type= gets type="button" added.
    None of our buttons are meant to submit a form, so this is always safe,
    and it protects every current and future page from the spec's default
    (type=submit) causing inconsistent behavior if a button ever ends up
    inside a <form> later."""
    def _fix(m):
        tag = m.group(0)
        if 'type=' in tag:
            return tag
        return tag[:-1] + ' type="button">'
    return _re.sub(r'<button(?![^>]*type=)[^>]*>', _fix, html)

os.makedirs(OUT, exist_ok=True)
print("helpers ready")

# ============ INDEX ============
index_body = f"""<div class="hero">
  <div class="hero-orb orb1"></div>
  <div class="hero-orb orb2"></div>
  <span class="hero-badge"><span class="dot"></span> No signup · 100% free</span>
  <h1>Free Online PDF, Image &amp; Everyday Tools</h1>
  <p class="subtitle">Secure • Fast • Files Never Leave Your Device</p>
  <a href="#tools" id="heroCta" class="cta-btn" style="text-decoration:none;">
    Start using tools
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  </a>

  <div class="feature-strip">
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z"/></svg></div><div class="fc-label">40+ Free Online Tools</div></div>
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg></div><div class="fc-label">Fast</div></div>
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/></svg></div><div class="fc-label">Secure</div></div>
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></div><div class="fc-label">Mobile Friendly</div></div>
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16v12H4zM8 20h8M12 16v4"/></svg></div><div class="fc-label">No Installation</div></div>
    <div class="feature-chip"><div class="fc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="fc-label">Free Forever</div></div>
  </div>
</div>

<div class="container" id="tools">
  <div class="category-hub-grid">
    {category_hub_card("pdf-tools.html", ICON_PDF_MERGE, "PDF Tools", "Merge, split, compress, convert PDF/Word, and build a resume.")}
    {category_hub_card("image-tools.html", ICON_COMPRESS, "Image Tools", "Passport photos, AI OCR, upscaler, photo enhancer, and more.")}
    {category_hub_card("calculators.html", ICON_AGE, "Calculators", "Age, BMI, EMI, GST, scientific, unit, and currency calculators.")}
    {category_hub_card("finance-tools.html", ICON_CURRENCY, "Finance Tools", "Currency conversion and loan calculations, in progress.")}
    {category_hub_card("seo-tools.html", ICON_QR, "SEO Tools", "AI keyword generator, QR codes, robots.txt, and meta tags for site owners.")}
    {category_hub_card("ai-tools.html", ICON_AI_EMAIL, "AI Tools", "AI-assisted writing tools, starting with the AI Email Writer.")}
    {category_hub_card("blog.html", ICON_META, "Blog", "Guides and tips on PDFs, images, and getting more from ToolFlight.", cta="Read articles")}
  </div>
</div>

<section id="faq">
  <div class="container" style="max-width:680px;">
    <h2 class="section-title">Frequently Asked Questions</h2>
    <div id="faqList"></div>
  </div>
</section>

<section id="about-section">
  <div class="container" style="max-width:680px;text-align:center;">
    <h2 class="section-title">About ToolFlight</h2>
    <p style="color:var(--ink-soft);font-size:14.5px;line-height:1.7;">ToolFlight is a free, growing set of everyday tools organized into five categories: PDF, Image, Calculators, Finance, and SEO. Wherever possible, tools run entirely in your browser — there's no account, no server upload, and no waiting.</p>
  </div>
</section>

<!-- Hidden, statically-present form purely so Netlify's build-time bot registers
     "contact" as a form. The real, visible version of this form is injected into
     the Contact modal by JavaScript and is what users actually fill in and submit. -->
<form name="contact" data-netlify="true" data-netlify-honeypot="bot-field" netlify hidden style="display:none;" aria-hidden="true">
  <input type="hidden" name="form-name" value="contact">
  <input type="text" name="name">
  <input type="email" name="email">
  <input type="tel" name="whatsapp">
  <input type="text" name="subject">
  <textarea name="message"></textarea>
  <input name="bot-field">
</form>
"""

# ============ PDF TOOLS ============
pdf_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> 8 free PDF tools</span>
  <h1>PDF Tools</h1>
  <p class="subtitle">Merge, split, convert, compress, convert PDFs to and from Word, and build or check a resume — free, private, no signup. Each one has its own page.</p>
</div>

<div class="container">
  <div class="category-hub-grid">
    {category_hub_card("pdf-merge.html", ICON_PDF_MERGE, "Merge PDF", "Combine multiple PDFs into one, in any order you choose.", cta="Open tool")}
    {category_hub_card("pdf-split.html", ICON_PDF_SPLIT, "Split PDF", "Pull specific pages out, or split every page into its own file.", cta="Open tool")}
    {category_hub_card("image-to-pdf.html", ICON_CROP, "Image to PDF", "Combine JPG, PNG, WEBP, BMP, or GIF images into one PDF.", cta="Open tool")}
    {category_hub_card("pdf-to-image.html", ICON_COMPRESS, "PDF to Image", "Convert every page of a PDF into JPG, PNG, or WEBP images.", cta="Open tool")}
    {category_hub_card("pdf-compress.html", ICON_PDF_COMPRESS_ICON, "PDF Compress", "Shrink PDF file size by recompressing embedded images.", cta="Open tool")}
    {category_hub_card("pdf-to-word.html", ICON_PDF_WORD, "PDF to Word Converter", "Convert PDF into an editable DOCX — real selectable text.", cta="Open tool")}
    {category_hub_card("word-to-pdf.html", ICON_PDF_WORD, "Word to PDF Converter", "Convert DOCX into a real, selectable-text PDF.", cta="Open tool")}
    {category_hub_card("resume-builder.html", ICON_RESUME, "Resume Builder & ATS Checker", "Build a resume and check it against common ATS patterns.", cta="Open tool")}
  </div>
</div>
"""

# ============ STANDALONE PDF TOOL PAGES ============
# Core form markup below is copied verbatim from the working embedded version —
# same element IDs/classes, so js/app.js needs zero changes to power these pages.

PDF_MERGE_FORM = """<div class="view-title"><h2>Merge PDF</h2><span class="badge" id="mergePageBadge">0 files</span></div>
      <span class="field-label">Add PDF files — drag items below to reorder</span>
      <div class="drop-zone" id="mergeDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop PDFs here or tap to browse</div>
        <div class="drop-sub">You can select multiple files at once</div>
        <input type="file" id="mergeInput" accept="application/pdf" multiple>
      </div>
      <div class="file-list" id="mergeList"></div>
      <div class="row">
        <button class="btn btn-primary" id="mergeBtn" disabled>Merge &amp; download</button>
        <button class="btn btn-danger" id="mergeClearBtn">Clear all</button>
      </div>"""

PDF_SPLIT_FORM = """<div class="view-title"><h2>Split PDF</h2><span class="badge hidden" id="splitPageBadge">0 pages</span></div>
      <span class="field-label">Choose one PDF</span>
      <div class="drop-zone" id="splitDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a PDF here or tap to browse</div>
        <div class="drop-sub">One file at a time</div>
        <input type="file" id="splitInput" accept="application/pdf">
      </div>
      <div class="file-list" id="splitList"></div>
      <div id="splitPagePicker" class="hidden">
        <span class="field-label" style="margin-top:16px;">Select pages to export (tap to toggle)</span>
        <div class="page-grid" id="pageGrid"></div>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-ghost" id="selectAllBtn" style="flex:0;min-width:auto;">Select all</button>
          <button class="btn btn-ghost" id="selectNoneBtn" style="flex:0;min-width:auto;">Clear selection</button>
        </div>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="splitBtn" disabled>Split &amp; download .zip</button>
        <button class="btn btn-danger" id="splitClearBtn">Clear</button>
      </div>"""

ITP_FORM = """<div class="view-title"><h2>Image to PDF</h2><span class="badge" id="itpCountBadge">0 images</span></div>
      <span class="field-label">Add images — drag items below to reorder</span>
      <div class="drop-zone" id="itpDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop images here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, WEBP, BMP, or GIF — multiple files at once</div>
        <input type="file" id="itpInput" accept="image/jpeg,image/png,image/webp,image/bmp,image/gif" multiple>
      </div>
      <div class="file-list" id="itpList"></div>

      <div class="qr-controls" style="margin-top:14px;">
        <div class="ctrl">
          <label for="itpPageSize">Page size</label>
          <select id="itpPageSize">
            <option value="a4" selected>A4</option>
            <option value="letter">Letter</option>
            <option value="fit">Fit to page</option>
            <option value="original">Original size</option>
          </select>
        </div>
        <div class="ctrl">
          <label for="itpOrientation">Orientation</label>
          <select id="itpOrientation">
            <option value="portrait" selected>Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div class="ctrl" style="grid-column:span 2;">
          <label for="itpMargin">Margin: <span id="itpMarginVal">20</span>pt</label>
          <input type="range" id="itpMargin" min="0" max="60" value="20" oninput="document.getElementById('itpMarginVal').textContent=this.value">
        </div>
      </div>

      <span class="field-label" style="margin-top:16px;">Preview pages</span>
      <div class="thumb-grid" id="itpPreviewGrid"><p class="editor-hint">Add images to see a page preview.</p></div>

      <div class="row">
        <button class="btn btn-primary" id="itpDownloadBtn" style="flex:1;" type="button" disabled>Convert &amp; download PDF</button>
        <button class="btn btn-danger" id="itpClearBtn" type="button">Clear all</button>
      </div>"""

PTI_FORM = """<div class="view-title"><h2>PDF to Image</h2></div>
      <span class="field-label">Choose a PDF</span>
      <div class="drop-zone" id="ptiDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a PDF here or tap to browse</div>
        <div class="drop-sub">One PDF at a time — every page is converted</div>
        <input type="file" id="ptiInput" accept="application/pdf">
      </div>
      <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;" id="ptiFileInfo"></p>

      <div id="ptiStage" class="hidden">
        <div class="qr-controls" style="margin-top:10px;">
          <div class="ctrl">
            <label for="ptiFormat">Output format</label>
            <select id="ptiFormat">
              <option value="jpg" selected>JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="ptiDpi">DPI</label>
            <select id="ptiDpi">
              <option value="72">72 (screen)</option>
              <option value="150" selected>150 (good quality)</option>
              <option value="300">300 (print quality)</option>
            </select>
          </div>
          <div class="ctrl" id="ptiQualityRow" style="grid-column:span 2;">
            <label for="ptiQuality">Quality: <span id="ptiQualityVal">85</span>%</label>
            <input type="range" id="ptiQuality" min="10" max="100" value="85">
          </div>
        </div>

        <div class="progress-wrap hidden" id="ptiProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="ptiProgressFill"></div></div>
          <div class="progress-label" id="ptiProgressLabel">Reading PDF…</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="ptiConvertBtn" style="flex:1;" type="button" disabled>Convert to images</button>
        </div>

        <span class="field-label" style="margin-top:16px;">Pages</span>
        <div class="thumb-grid" id="ptiPageGrid"></div>
        <div class="row hidden" id="ptiDownloadAllBtnRow">
          <button class="btn btn-success hidden" id="ptiDownloadAllBtn" style="flex:1;" type="button">Download all as ZIP</button>
        </div>
      </div>"""

PDFC_FORM = """<div class="view-title"><h2>PDF Compress</h2></div>
      <span class="field-label">Choose a PDF</span>
      <div class="drop-zone" id="pdfcDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a PDF here or tap to browse</div>
        <div class="drop-sub">One PDF at a time</div>
        <input type="file" id="pdfcInput" accept="application/pdf">
      </div>

      <div id="pdfcStage" class="hidden">
        <div class="row" style="margin-top:10px;align-items:center;">
          <div style="flex:1;font-size:12.5px;color:var(--ink-soft);">
            <strong id="pdfcFileName" style="color:var(--ink);"></strong><br>
            Original size: <span id="pdfcOriginalSize"></span> · <span id="pdfcPageCount"></span>
          </div>
        </div>

        <div class="canvas-stage" id="pdfcPreviewStage" style="margin-top:10px;max-height:280px;overflow:auto;">
          <div id="pdfcPreview" style="width:100%;display:flex;align-items:center;justify-content:center;"><span class="placeholder-text">Preview will appear here</span></div>
        </div>

        <span class="field-label" style="margin-top:14px;">Compression level</span>
        <div class="unit-toggle pdfc-level-toggle">
          <button data-level="low" type="button">Low</button>
          <button class="active" data-level="medium" type="button">Medium</button>
          <button data-level="high" type="button">High</button>
        </div>
        <p class="editor-hint">Low keeps the most detail; High gives the smallest file size. Text and vector content are never altered at any level.</p>

        <div class="progress-wrap hidden" id="pdfcProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="pdfcProgressFill"></div></div>
          <div class="progress-label" id="pdfcProgressLabel">Reading PDF…</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="pdfcCompressBtn" style="flex:1;" type="button" disabled>Compress PDF</button>
        </div>

        <div class="result-grid hidden" id="pdfcResultRow">
          <div class="result-stat"><div class="num" id="pdfcOriginalSize2">0</div><div class="label">Original Size</div></div>
          <div class="result-stat"><div class="num" id="pdfcCompressedSize">0</div><div class="label">Compressed Size</div></div>
          <div class="result-stat"><div class="num" id="pdfcSavedAmount">0</div><div class="label">Space Saved</div></div>
          <div class="result-stat"><div class="num" id="pdfcSavedPct">0%</div><div class="label">Percent Saved</div></div>
        </div>
        <p class="editor-hint" id="pdfcResultNote"></p>

        <div class="row hidden" id="pdfcDownloadRow">
          <button class="btn btn-success" id="pdfcDownloadBtn" style="flex:1;" type="button">Download compressed PDF</button>
        </div>
      </div>"""

def pw_form(default_mode):
    p2w_active = 'active' if default_mode == 'p2w' else ''
    w2p_active = 'active' if default_mode == 'w2p' else ''
    accept = 'application/pdf' if default_mode == 'p2w' else '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
    drop_title = 'Drop a PDF here or tap to browse' if default_mode == 'p2w' else 'Drop a Word document here or tap to browse'
    drop_sub = 'PDF — up to 40MB' if default_mode == 'p2w' else 'DOCX or DOC — up to 40MB'
    convert_label = 'Convert to Word' if default_mode == 'p2w' else 'Convert to PDF'
    return f"""<div class="view-title"><h2>PDF \u2194 Word Converter</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Real, selectable-text conversion \u2014 not a screenshot embedded in a PDF, and not a fake preview. Runs entirely in your browser; nothing is uploaded. Formatting is preserved on a best-effort basis \u2014 see the FAQ below for exactly what is and isn't supported.</p>

      <div class="editor-toolbar" role="tablist" aria-label="Conversion direction">
        <button class="editor-tool-btn {p2w_active}" id="pwTabPdfToWord" type="button" role="tab" aria-selected="{'true' if default_mode=='p2w' else 'false'}">PDF \u2192 Word</button>
        <button class="editor-tool-btn {w2p_active}" id="pwTabWordToPdf" type="button" role="tab" aria-selected="{'true' if default_mode=='w2p' else 'false'}">Word \u2192 PDF</button>
      </div>

      <div class="drop-zone" id="pwDrop" style="margin-top:14px;">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title" id="pwDropTitle">{drop_title}</div>
        <div class="drop-sub" id="pwDropSub">{drop_sub}</div>
        <input type="file" id="pwInput" accept="{accept}">
      </div>

      <div id="pwFileInfo" class="hidden" style="margin-top:10px;font-size:12.5px;color:var(--ink-soft);">
        <strong id="pwFileName" style="color:var(--ink);"></strong> \u00b7 <span id="pwFileSize"></span><span id="pwPageCount"></span>
      </div>

      <div class="progress-wrap hidden" id="pwProgressWrap">
        <div class="progress-track"><div class="progress-fill" id="pwProgressFill"></div></div>
        <div class="progress-label" id="pwProgressLabel">Processing\u2026</div>
      </div>

      <div class="row">
        <button class="btn btn-primary" id="pwConvertBtn" type="button" style="flex:1;" disabled>{convert_label}</button>
        <button class="btn btn-danger hidden" id="pwCancelBtn" type="button">Cancel</button>
      </div>

      <p class="editor-hint hidden" id="pwErrorBox" style="color:var(--err);"></p>

      <div class="row hidden" id="pwResultRow">
        <button class="btn btn-success" id="pwDownloadBtn" type="button" style="flex:1;">Download result</button>
        <button class="btn btn-ghost" id="pwConvertAnotherBtn" type="button">Convert another file</button>
      </div>"""

def _resume_repeat_section(key, title, add_label):
    return f"""<div class="resume-section-block">
        <div class="resume-section-heading-row"><h3>{title}</h3><button class="btn btn-secondary" id="rbAdd_{key}" type="button" style="padding:8px 14px;font-size:12.5px;">{add_label}</button></div>
        <div id="rbList_{key}"></div>
      </div>"""

RESUME_FORM = """<div class="view-title"><h2>Resume Builder &amp; ATS Checker</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Build a resume and check it against common ATS (Applicant Tracking System) patterns \u2014 everything runs locally in your browser, nothing is uploaded. The ATS check is rule-based analysis, not AI \u2014 see its FAQ below for exactly what that means.</p>

      <div class="editor-toolbar" role="tablist" aria-label="Resume tool">
        <button class="editor-tool-btn active" id="resumeTabBuilder" type="button" role="tab" aria-selected="true">Resume Builder</button>
        <button class="editor-tool-btn" id="resumeTabAts" type="button" role="tab" aria-selected="false">ATS Resume Checker</button>
      </div>

      <div id="resumeBuilderPanel">
        <div class="resume-layout">
          <div class="resume-form-col">
            <span class="field-label">Template</span>
            <div class="row" style="margin-top:6px;">
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="rbTemplate" value="classic" checked style="margin-right:6px;accent-color:var(--accent1);">Classic</label>
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="rbTemplate" value="modern" style="margin-right:6px;accent-color:var(--accent1);">Modern</label>
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="rbTemplate" value="minimal" style="margin-right:6px;accent-color:var(--accent1);">Minimal</label>
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="rbTemplate" value="professional" style="margin-right:6px;accent-color:var(--accent1);">Professional</label>
            </div>

            <div class="resume-section-block" style="border-top:none;margin-top:16px;padding-top:0;">
              <h3 style="font-size:15px;font-weight:800;margin:0 0 6px;">Personal Information</h3>
              <div class="resume-form-grid">
                <div class="resume-field-group"><label for="rbName">Full Name</label><input type="text" id="rbName" autocomplete="name"></div>
                <div class="resume-field-group"><label for="rbPhone">Phone</label><input type="text" id="rbPhone" autocomplete="tel"></div>
                <div class="resume-field-group"><label for="rbEmail">Email</label><input type="email" id="rbEmail" autocomplete="email"></div>
                <div class="resume-field-group"><label for="rbLocation">Location</label><input type="text" id="rbLocation" autocomplete="address-level2"></div>
                <div class="resume-field-group"><label for="rbLinkedin">LinkedIn</label><input type="text" id="rbLinkedin"></div>
                <div class="resume-field-group"><label for="rbPortfolio">Portfolio / Website</label><input type="text" id="rbPortfolio"></div>
              </div>
            </div>

            <div class="resume-section-block">
              <h3 style="font-size:15px;font-weight:800;margin:0 0 6px;">Summary</h3>
              <textarea id="rbSummary" rows="3" aria-label="Professional summary" style="width:100%;font-family:inherit;font-size:13.5px;padding:12px 13px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--ink);resize:vertical;"></textarea>
            </div>

            """ + _resume_repeat_section("experience", "Experience", "+ Add Job") + """
            """ + _resume_repeat_section("education", "Education", "+ Add School") + """
            """ + _resume_repeat_section("projects", "Projects", "+ Add Project") + """

            <div class="resume-section-block">
              <h3 style="font-size:15px;font-weight:800;margin:0 0 6px;">Skills</h3>
              <input type="text" id="rbSkills" placeholder="Comma-separated, e.g. JavaScript, Project Management, Figma" aria-label="Skills, comma separated">
            </div>

            """ + _resume_repeat_section("languages", "Languages", "+ Add Language") + """
            """ + _resume_repeat_section("certifications", "Certifications", "+ Add Certification") + """

            <div class="resume-section-block">
              <h3 style="font-size:15px;font-weight:800;margin:0 0 6px;">Achievements</h3>
              <textarea id="rbAchievements" rows="3" placeholder="One per line" aria-label="Achievements, one per line" style="width:100%;font-family:inherit;font-size:13.5px;padding:12px 13px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--ink);resize:vertical;"></textarea>
            </div>

            """ + _resume_repeat_section("references", "References (optional)", "+ Add Reference") + """

            <div class="row" style="margin-top:20px;">
              <button class="btn btn-success" id="rbDownloadPdfBtn" type="button" style="flex:1;">Download PDF</button>
              <button class="btn btn-secondary" id="rbPrintBtn" type="button">Print</button>
            </div>
          </div>

          <div class="resume-preview-col">
            <span class="field-label">Live Preview</span>
            <div class="resume-preview resume-tpl-classic" id="resumePreview" style="margin-top:8px;" aria-live="polite"></div>
          </div>
        </div>
      </div>

      <div id="atsCheckerPanel" class="hidden">
        <span class="field-label">Upload your resume (PDF or DOCX)</span>
        <div class="drop-zone" id="atsDrop" style="margin-top:8px;">
          <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
          <div class="drop-title">Drop your resume here or tap to browse</div>
          <div class="drop-sub">PDF or DOCX \u2014 up to 20MB</div>
          <input type="file" id="atsInput" accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
        </div>
        <div id="atsFileInfo" class="hidden" style="margin-top:10px;font-size:12.5px;color:var(--ink-soft);">
          <strong id="atsFileName" style="color:var(--ink);"></strong> \u00b7 <span id="atsFileSize"></span>
        </div>

        <div class="progress-wrap hidden" id="atsProgressWrap">
          <div class="progress-track"><div class="progress-fill" style="width:60%;"></div></div>
          <div class="progress-label">Analyzing\u2026</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="atsAnalyzeBtn" type="button" style="flex:1;" disabled>Analyze Resume</button>
        </div>

        <div id="atsResultWrap" class="hidden" style="margin-top:16px;">
          <div class="ats-score-wrap">
            <div class="ats-score-num" id="atsScoreNum">0</div>
            <div><div style="font-weight:700;font-size:13px;">ATS Score (out of 100)</div><div class="ats-score-label" id="atsScoreLabel"></div></div>
          </div>

          <div class="resume-section-block">
            <h3 style="font-size:14px;font-weight:800;margin:0 0 4px;">Strengths</h3>
            <ul class="ats-result-list" id="atsStrengthsList"></ul>
          </div>
          <div class="resume-section-block">
            <h3 style="font-size:14px;font-weight:800;margin:0 0 4px;">Weaknesses</h3>
            <ul class="ats-result-list" id="atsWeaknessesList"></ul>
          </div>
          <div class="resume-section-block">
            <h3 style="font-size:14px;font-weight:800;margin:0 0 4px;">Missing Sections</h3>
            <ul class="ats-result-list" id="atsMissingSectionsList"></ul>
          </div>
          <div class="resume-section-block">
            <h3 style="font-size:14px;font-weight:800;margin:0 0 4px;">Optimization Tips</h3>
            <ul class="ats-result-list" id="atsSuggestionsList"></ul>
          </div>

          <div class="row">
            <button class="btn btn-ghost" id="atsAnotherBtn" type="button">Check another resume</button>
          </div>
        </div>
      </div>"""

PDF_TOOLS = [
    {"slug":"pdf-merge","name":"Merge PDF","desc":"Combine multiple PDFs into one, in any order you choose.",
     "subtitle":"Combine multiple PDF files into one, in any order you choose — free, private, instant.",
     "meta":"Free online PDF merge tool. Combine multiple PDF files into one in any order, right in your browser. No upload, no signup.",
     "category":"BusinessApplication","form":PDF_MERGE_FORM,
     "intro":"Whether you're combining scanned receipts, assembling a report from separate chapters, or stitching signed pages back into one contract, Merge PDF combines any number of PDF files into a single document — reordered exactly how you want, processed entirely in your browser.",
     "features":["Drag and drop multiple PDF files at once","Reorder files before merging by dragging them into place","Live file count and total page count","One-click merge and download"],
     "benefits":["Files are never uploaded — merging happens locally in your browser","No file size limits imposed by a server, no daily quota","Works identically on desktop and mobile"],
     "how_to":"Drag in all the PDF files you want combined, or tap to browse. Drag the files into the order you want the final document to read in, then tap Merge &amp; download.",
     "faq":[("Is there a limit to how many PDFs I can merge?","Browser-based merging is limited by your device's memory rather than a fixed count — a handful of files works instantly, while dozens of very large files may be slower."),
            ("Will merging affect the quality of my PDFs?","No — merging combines pages as-is; it doesn't re-render or re-compress content, so text and images stay exactly as sharp as the originals."),
            ("Can I merge password-protected PDFs?","Most browser-based mergers, including this one, can't read encrypted PDFs directly — remove the password first using a PDF editor, then merge.")],
     "related":["pdf-split","pdf-to-word"]},

    {"slug":"pdf-split","name":"Split PDF","desc":"Pull specific pages out, or split every page into its own file.",
     "subtitle":"Pull specific pages out, or split every page into its own file — free, private, instant.",
     "meta":"Free online PDF split tool. Extract specific pages or split every page into its own file, right in your browser. No upload, no signup.",
     "category":"BusinessApplication","form":PDF_SPLIT_FORM,
     "intro":"Need just a few pages from a larger PDF, or want every page as its own file? Split PDF shows you the total page count, lets you tap to select exactly which pages you want, and packages the result as a downloadable .zip — all without uploading your document anywhere.",
     "features":["Visual page picker with total page count shown upfront","Select all or clear selection with one tap","Split into individual files, packaged as a .zip","Works on any PDF, any length, entirely offline"],
     "benefits":["Nothing is uploaded — your document stays on your device the whole time","No signup, no watermark, no daily limit","A visual page grid means no guessing at page numbers"],
     "how_to":"Drop in one PDF, then tap the pages you want in the page grid (or use Select all / Clear selection). Tap Split &amp; download .zip to get your extracted pages as separate files.",
     "faq":[("Do I need to install anything?","No — this runs using JavaScript already built into your browser; there's nothing to download or install."),
            ("Is it safe to split sensitive documents online?","Yes, specifically because this tool processes files locally in your browser rather than uploading them to a server — worth checking for that distinction in any tool you use for sensitive documents."),
            ("Can I extract just one page?","Yes — tap only that page in the grid before splitting; the result is a .zip containing just that single-page PDF.")],
     "related":["pdf-merge","word-to-pdf"]},

    {"slug":"image-to-pdf","name":"Image to PDF","desc":"Combine JPG, PNG, WEBP, BMP, or GIF images into one PDF.",
     "subtitle":"Combine JPG, PNG, WEBP, BMP, or GIF images into a single PDF, with page size, orientation, and margin control.",
     "meta":"Free online image to PDF converter. Combine JPG, PNG, WEBP, BMP, or GIF images into one PDF with A4/Letter/original sizing, right in your browser.",
     "category":"BusinessApplication","form":ITP_FORM,
     "intro":"Turn a batch of photos, scans, or screenshots into a single, organized PDF. Image to PDF supports JPG, PNG, WEBP, BMP, and GIF, lets you reorder and rotate each image, and gives you control over page size, orientation, and margins before you download.",
     "features":["Drag and drop multiple images at once, in any of 5 formats","Reorder images by dragging them into place","Rotate any image in 90° steps before converting","A4, Letter, Fit to page, or Original size page options, with margin control","Live page preview before you download"],
     "benefits":["Nothing is uploaded — the PDF is built entirely in your browser","No file size limits imposed by a server, no daily quota","Full control over layout instead of a one-size-fits-all export"],
     "how_to":"Drop in your images, drag to reorder or tap rotate on any image, then choose a page size, orientation, and margin. Check the live preview, then tap Convert &amp; download PDF.",
     "faq":[("Which image formats are supported?","JPG, PNG, WEBP, BMP, and GIF (the first frame of an animated GIF is used)."),
            ("What does \"Original size\" do?","Instead of fitting your image onto a standard page like A4, each PDF page is sized to match that image's own pixel dimensions plus your chosen margin — no scaling or cropping."),
            ("Can I mix different image formats and sizes in one PDF?","Yes — each image becomes its own page, so you can freely mix formats, orientations, and sizes in a single conversion.")],
     "related":["pdf-to-image","pdf-compress"]},

    {"slug":"pdf-compress","name":"PDF Compress","desc":"Shrink PDF file size by recompressing embedded images.",
     "subtitle":"Shrink a PDF's file size by recompressing its embedded images, while keeping text sharp and selectable.",
     "meta":"Free online PDF compressor. Reduce PDF file size by recompressing embedded images at your chosen level, right in your browser. Text stays untouched.",
     "category":"BusinessApplication","form":PDFC_FORM,
     "intro":"Large PDFs are often large because of the photos or scans inside them, not the text. PDF Compress finds the embedded images in your document, recompresses them at your chosen level, and rebuilds the file — leaving every word of text exactly as sharp and selectable as it started.",
     "features":["Three compression levels: Low, Medium, and High","First-page preview before you compress","Shows original size, compressed size, space saved, and percent saved","Automatically keeps the original if compression wouldn't actually shrink it","Progress indicator while processing"],
     "benefits":["Text and vector content are never touched — nothing gets blurry or unselectable","Nothing is uploaded — compression happens entirely in your browser","No signup, no file size limit imposed by a server"],
     "how_to":"Drop in a PDF, check the preview and original size, choose a compression level, then tap Compress PDF. Review the size comparison, and download if it's smaller — if it isn't, the tool tells you honestly rather than replacing your file with a bigger one.",
     "faq":[("Will this make my text blurry?","No — only embedded images are recompressed. Text, fonts, and vector graphics are left completely untouched, so they stay sharp and selectable."),
            ("What if my PDF doesn't get any smaller?","Some PDFs are already efficiently compressed, or contain mostly text with few images. In that case, the tool tells you directly and keeps your original file rather than replacing it with something larger."),
            ("Which images does this compress?","Images embedded using JPEG compression, which covers the large majority of photos and scans in real-world PDFs. Images using other internal formats are left unchanged to avoid any risk of visual corruption.")],
     "related":["pdf-merge","pdf-to-word"]},

    {"slug":"pdf-to-word","name":"PDF to Word Converter","desc":"Convert PDF into an editable DOCX \u2014 real selectable text, not a screenshot.",
     "subtitle":"Convert a PDF into an editable Word document \u2014 real selectable text, not an image pretending to be one.",
     "meta":"Free PDF to Word converter. Convert PDF into an editable DOCX with headings, bold/italic, and hyperlinks preserved on a best-effort basis, entirely in your browser.",
     "category":"BusinessApplication","form":pw_form("p2w"),
     "intro":"PDF to Word Converter reconstructs your PDF's text, headings, and basic formatting into a real, editable .docx file \u2014 not a rasterized image dropped into a Word wrapper. Because a PDF has no built-in concept of \"this is a heading\" or \"this is bold,\" the structure is rebuilt using font-size and font-style analysis, which works well for typical documents but isn't guaranteed on every layout \u2014 see the FAQ for exactly what this does and doesn't handle.",
     "features":["Real, editable text output \u2014 not an embedded screenshot","Heading levels reconstructed from relative font size","Bold and italic detected from font metadata","Hyperlinks preserved from the PDF's link annotations","Page breaks preserved 1:1 with the original PDF's pages","Shows filename, size, and page count before converting"],
     "benefits":["Nothing is uploaded \u2014 conversion happens entirely in your browser","No signup, no page limit imposed by a server","Genuinely editable output, so you can actually fix and reuse the content"],
     "how_to":"Upload a PDF (drag and drop or browse), review the page count, then tap Convert to Word. When it finishes, download the .docx \u2014 or tap Convert another file to start over.",
     "faq":[("Will tables and images be preserved?","Honestly, no \u2014 not in this direction. Reliably detecting table grid structure and extracting images from raw PDF content is a genuinely hard problem, and a wrong guess would scramble your document worse than leaving it out. Text, headings, bold/italic, hyperlinks, and page breaks are reconstructed; tables and embedded images currently are not."),
            ("Will this work on scanned PDFs?","No \u2014 this reads the actual text layer of a PDF. A scanned PDF that's really just a photo of a page has no text layer to extract, so there's nothing to convert. You'd need an OCR tool first."),
            ("Why might headings or bold text be misdetected?","Headings are inferred from font size relative to the rest of the document, and bold/italic from the font's internal name \u2014 both are the standard heuristics for this kind of extraction, but not every PDF-generating tool names its fonts predictably, so results can vary."),
            ("Is my file uploaded anywhere?","No \u2014 both reading the PDF and building the Word document happen entirely inside your browser.")],
     "related":["resume-builder","word-to-pdf"]},

    {"slug":"word-to-pdf","name":"Word to PDF Converter","desc":"Convert DOCX into a real, selectable-text PDF \u2014 not a screenshot.",
     "subtitle":"Convert a Word document into a real PDF with selectable text \u2014 not a screenshot embedded in a PDF wrapper.",
     "meta":"Free Word to PDF converter. Convert DOCX into a genuine text-based PDF with headings, bold/italic, lists, tables, and images preserved, entirely in your browser.",
     "category":"BusinessApplication","form":pw_form("w2p"),
     "intro":"Word to PDF Converter reads your .docx and rebuilds it as a real PDF with actual selectable, searchable text \u2014 the common shortcut most browser-based converters take is to screenshot the page and embed that image in a PDF, which looks right but can't be selected, searched, or read by a screen reader. This tool avoids that shortcut entirely.",
     "features":["Real selectable, searchable PDF text \u2014 not a rasterized image","Headings, bold, italic, and paragraph structure preserved","Bullet and numbered lists preserved","Basic tables and embedded images rendered","Automatic pagination as content flows across pages"],
     "benefits":["Nothing is uploaded \u2014 conversion happens entirely in your browser","Accessible output: real text means screen readers and copy/paste both work","No signup, no watermark"],
     "how_to":"Upload a .docx file (drag and drop or browse), tap Convert to PDF, then download the result once it finishes.",
     "faq":[("Why not just screenshot the page like most browser converters?","Because the result wouldn't be a real document \u2014 you couldn't select the text, search it, or have it read aloud by a screen reader. This tool places actual text on the PDF page instead, at the cost of not perfectly matching Word's exact pixel-for-pixel visual layout."),
            ("Will this look identical to the original in Word?","Close, but not pixel-perfect. Complex layouts \u2014 multi-column text, precise table borders, unusual fonts, headers/footers \u2014 are simplified. Standard documents with headings, paragraphs, lists, basic tables, and images convert well."),
            ("Does it support legacy .doc files?","No \u2014 only the modern .docx format. If you have an older .doc file, save it as .docx in Word first."),
            ("Is my file uploaded anywhere?","No \u2014 both reading the Word document and building the PDF happen entirely inside your browser.")],
     "related":["pdf-to-word","pdf-merge"]},

    {"slug":"pdf-to-image","name":"PDF to Image","desc":"Convert every page of a PDF into JPG, PNG, or WEBP images.",
     "subtitle":"Convert every page of a PDF into JPG, PNG, or WEBP images, with adjustable DPI and quality.",
     "meta":"Free online PDF to image converter. Convert every page of a PDF into JPG, PNG, or WEBP, with adjustable DPI and quality, right in your browser.",
     "category":"BusinessApplication","form":PTI_FORM,
     "intro":"Need your PDF's pages as images instead? PDF to Image renders every page using the same open-source engine that powers Firefox's built-in PDF viewer, with control over output format, resolution, and quality — download pages individually or all at once as a .zip.",
     "features":["Converts every page automatically, in order","JPG, PNG, or WEBP output","Adjustable DPI (72/150/300) and quality","Download pages individually or all together as a .zip","Live progress indicator while converting"],
     "benefits":["Your document is processed entirely in your browser — nothing is uploaded","Higher DPI options make this suitable for print-quality exports, not just screen use","No signup, no per-page limit"],
     "how_to":"Drop in a PDF, choose your output format, DPI, and quality, then tap Convert to images. Download pages one at a time, or tap Download all as ZIP once conversion finishes.",
     "faq":[("What DPI should I use?","150 DPI is a good default for general use; use 300 DPI if you plan to print the images, or 72 DPI for smaller files meant only for screen viewing."),
            ("Why would I choose WEBP over JPG or PNG?","WEBP typically produces smaller files than JPG at similar quality; if your browser can't encode WEBP, this tool automatically falls back to PNG for that page rather than failing.")],
     "related":["image-to-pdf","pdf-compress"]},

    {"slug":"resume-builder","name":"Resume Builder & ATS Checker","desc":"Build a professional resume and check it against common ATS patterns.",
     "subtitle":"Build a professional resume with live preview, plus check any resume against common ATS (Applicant Tracking System) patterns \u2014 both entirely in your browser.",
     "meta":"Free resume builder and ATS resume checker. Build a resume with 4 templates and a live preview, or upload a PDF/DOCX resume for a rule-based ATS score, entirely in your browser.",
     "category":"BusinessApplication","form":RESUME_FORM,
     "intro":"Two tools in one page: a Resume Builder with a live preview and four templates that exports to a real, selectable-text PDF, and an ATS Resume Checker that analyzes an uploaded resume using transparent, rule-based checks \u2014 not AI dressed up to sound smarter than it is. Everything runs locally in your browser; nothing is uploaded to a server.",
     "features":["Four resume templates: Classic, Modern, Minimal, Professional","Live preview that updates as you type","Add, remove, and reorder entries within each section","Real, selectable-text PDF export \u2014 not a screenshot","Print directly from the browser","ATS checker with a transparent, explainable 0\u2013100 score"],
     "benefits":["Nothing is uploaded \u2014 both the builder and the checker run entirely in your browser","No signup, no watermark, no per-use limit","The ATS score comes with specific, stated reasons \u2014 not a mysterious black-box number"],
     "how_to":"On the Resume Builder tab, fill in your details, pick a template, and use Download PDF or Print when you're ready. On the ATS Resume Checker tab, upload a PDF or DOCX resume and tap Analyze Resume to see your score, strengths, weaknesses, missing sections, and specific suggestions.",
     "faq":[("Is the ATS checker really AI?","No, and we'd rather say that plainly than oversell it. It's rule-based analysis: it checks for things like a detectable email and phone number, common section headings, resume length, bullet point usage, action verbs, and quantified results (numbers and percentages). Every point in the score maps to a specific, statable reason, not a hidden model."),
            ("How accurate is a real ATS score compared to this tool?","This tool checks for well-known, broadly-agreed-upon resume best practices that most real ATS systems and recruiters respond well to \u2014 but every company's actual ATS software is different and this tool can't see the specific job posting or system you're applying through. Treat the score as a genuinely useful sanity check, not a guarantee."),
            ("Is my resume data saved anywhere?","No \u2014 everything in the builder lives only in your browser tab's memory while you're using it, and the ATS checker's file processing happens entirely locally too. Closing or refreshing the page clears your data, so keep your PDF downloads."),
            ("Why isn't my resume's exact formatting preserved in the ATS checker?","The checker extracts and analyzes the underlying text, the same way many real ATS systems do \u2014 visual formatting like columns or graphics isn't part of what's being scored, since ATS software generally can't reliably parse those either.")],
     "related":["pdf-to-word","word-to-pdf"]},
]
PDF_TOOL_BY_SLUG = {t["slug"]: t for t in PDF_TOOLS}

def build_pdf_tool_page(tool):
    import json as _json
    breadcrumb = f'''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <a href="pdf-tools.html" style="color:var(--ink-soft);text-decoration:none;">PDF Tools</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">{tool["name"]}</span>
</nav>'''

    features_html = "".join(f'<li>{f}</li>' for f in tool["features"])
    benefits_html = "".join(f'<li>{b}</li>' for b in tool["benefits"])
    faq_html = ""
    faq_items = []
    for q, a in tool["faq"]:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for rslug in tool["related"]:
        rt = PDF_TOOL_BY_SLUG[rslug]
        related_html += f'      <a href="{rslug}.html" class="blog-card"><span class="blog-tag">PDF Tool</span><h3>{rt["name"]}</h3><p>{rt["desc"]}</p></a>\n'

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "PDF Tools", "item": "https://toolflight.com/pdf-tools.html"},
            {"@type": "ListItem", "position": 3, "name": tool["name"], "item": f'https://toolflight.com/{tool["slug"]}.html'},
        ]
    }
    webpage_schema = {
        "@context": "https://schema.org", "@type": "WebPage",
        "name": tool["name"], "description": tool["meta"], "url": f'https://toolflight.com/{tool["slug"]}.html'
    }
    software_schema = {
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        "name": tool["name"], "applicationCategory": tool["category"], "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>{tool["name"]}</h1>
  <p class="subtitle">{tool["subtitle"]}</p>
</div>

<div class="container">
  <div class="row" style="margin:0 0 18px;">
    <a href="pdf-tools.html" class="btn btn-back" style="flex:0;min-width:auto;">Back to PDF Tools</a>
  </div>

  <div class="workspace">
      {tool["form"]}
  </div>

  <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border);max-width:720px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">About the {tool["name"]}</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["intro"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Features</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{features_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">How to Use</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["how_to"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Benefits</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{benefits_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Frequently Asked Questions</h2>
{faq_html}    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Related Tools</h2>
    <div class="related-grid">
{related_html}    </div>
  </div>
</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(webpage_schema)}</script>
<script type="application/ld+json">{_json.dumps(software_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

# ============ IMAGE TOOLS ============
image_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> 12 free image tools</span>
  <h1>Image Tools</h1>
  <p class="subtitle">Make passport photos, compress, extract text, retouch portraits, crop, rotate, remove backgrounds, remove objects, enhance, upscale, change backgrounds, and watermark — free, private, no signup. Each one has its own page.</p>
</div>

<div class="container">
  <div class="category-hub-grid">
    {category_hub_card("passport-photo-maker.html", ICON_PASSPORT, "Passport & Visa Photo Maker", "Auto-cropped passport and visa photos for 42 countries with AI face detection.", cta="Open tool")}
    {category_hub_card("image-compress.html", ICON_COMPRESS, "Compress Image", "Shrink JPG/PNG/WEBP file size with a live before & after preview.", cta="Open tool")}
    {category_hub_card("ai-ocr.html", ICON_OCR, "AI OCR (Image & PDF to Text)", "Extract editable, searchable text from images and scanned PDFs.", cta="Open tool")}
    {category_hub_card("ai-photo-retouch.html", ICON_PHOTO_ENHANCER, "AI Photo Retouch & Beauty", "Skin smoothing, background blur, and a full Lightroom-style adjustment panel.", cta="Open tool")}
    {category_hub_card("image-crop.html", ICON_CROP, "Image Crop Tool", "Free crop or locked ratios (1:1, 16:9, 9:16), plus rotate.", cta="Open tool")}
    {category_hub_card("rotate-flip.html", ICON_ROTATE, "Rotate & Flip Tool", "Rotate 90°/180°/270° and flip horizontal or vertical.", cta="Open tool")}
    {category_hub_card("background-remover.html", ICON_AI_REMOVE, "AI Background Remover", "Automatic AI-powered background removal, plus a full manual refine editor.", cta="Open tool")}
    {category_hub_card("background-changer.html", ICON_AI_CHANGE, "Background Changer", "Solid colors, gradients, or a custom background image.", cta="Open tool")}
    {category_hub_card("ai-photo-enhancer.html", ICON_PHOTO_ENHANCER, "AI Photo Enhancer", "Natural photo enhancement with AI-targeted face smoothing.", cta="Open tool")}
    {category_hub_card("ai-image-upscaler.html", ICON_UPSCALER, "AI Image Upscaler", "Upscale images 2x or 4x with real AI, using a browser-optimized model.", cta="Open tool")}
    {category_hub_card("magic-eraser.html", ICON_MAGIC_ERASER, "Magic Eraser (AI Object Remover)", "Brush over unwanted objects and remove them with real AI inpainting.", cta="Open tool")}
    {category_hub_card("image-watermark.html", ICON_WATERMARK, "Image Watermark Tool", "Add draggable text or logo watermarks with adjustable opacity.", cta="Open tool")}
  </div>
</div>
"""

# ============ STANDALONE IMAGE TOOL PAGES ============
# Core form markup below is copied verbatim from the working embedded version —
# same element IDs/classes, so js/app.js needs zero changes to power these pages.

COMPRESS_FORM = """<div class="view-title"><h2>Compress Image</h2></div>
      <span class="field-label">Choose an image (JPG, PNG, or WEBP)</span>
      <div class="drop-zone" id="compressDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP — up to 50MB</div>
        <input type="file" id="compressInput" accept="image/png, image/jpeg, image/webp">
      </div>
      <span class="field-label" style="margin-top:16px;">Quality: <span id="qualityVal">70</span>%</span>
      <input type="range" id="qualitySlider" min="10" max="95" value="70">
      <div class="progress-wrap hidden" id="compressProgressWrap">
        <div class="progress-track"><div class="progress-fill" id="compressProgressFill"></div></div>
        <div class="progress-label" id="compressProgressLabel">Reading image…</div>
      </div>
      <div class="compare hidden" id="compareBox">
        <div class="box"><span class="tag">Original</span><img id="origPreview" loading="lazy"><div class="size" id="origSize"></div></div>
        <div class="box"><span class="tag">Compressed</span><img id="compPreview" loading="lazy"><div class="size" id="compSize"></div></div>
      </div>
      <div id="savedRow" class="hidden" style="text-align:center;"><span class="saved-badge" id="savedBadge"></span></div>
      <div class="row">
        <button class="btn btn-primary" id="compressBtn" disabled>Compress</button>
        <button class="btn btn-success hidden" id="compressDownloadBtn">Download result</button>
      </div>"""

CROP_FORM = """<div class="view-title"><h2>Image Crop Tool</h2></div>
      <span class="field-label">Choose an image</span>
      <div class="drop-zone" id="cropDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP</div>
        <input type="file" id="cropInput" accept="image/png, image/jpeg, image/webp">
      </div>

      <div id="cropStageWrap" class="hidden">
        <div class="unit-toggle crop-aspect-toggle" style="margin-top:14px;">
          <button class="active" data-ratio="free" type="button">Free</button>
          <button data-ratio="square" type="button">1:1 (Square)</button>
          <button data-ratio="16:9" type="button">16:9</button>
          <button data-ratio="9:16" type="button">9:16</button>
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn btn-ghost" id="cropRotateLeftBtn" type="button">⟲ Rotate left</button>
          <button class="btn btn-ghost" id="cropRotateRightBtn" type="button">⟳ Rotate right</button>
        </div>

        <div class="canvas-stage" id="cropStage">
          <canvas id="cropCanvas"></canvas>
          <div class="crop-box" id="cropBoxEl">
            <div class="crop-handle tl"></div>
            <div class="crop-handle tr"></div>
            <div class="crop-handle bl"></div>
            <div class="crop-handle br"></div>
          </div>
          <div class="loading-overlay" id="cropLoading"><div class="spinner"></div></div>
        </div>

        <span class="field-label" style="margin-top:14px;">Live preview</span>
        <canvas id="cropPreview" style="border:1px solid var(--card-border);border-radius:10px;max-width:100%;"></canvas>

        <div class="row">
          <button class="btn btn-success" id="cropDownloadBtn" style="flex:1;" type="button">Download cropped image</button>
          <button class="btn btn-danger" id="cropResetBtn" type="button">Reset</button>
        </div>
      </div>"""

WATERMARK_FORM = """<div class="view-title"><h2>Image Watermark Tool</h2></div>
      <span class="field-label">Choose an image</span>
      <div class="drop-zone" id="wmDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP</div>
        <input type="file" id="wmInput" accept="image/png, image/jpeg, image/webp">
      </div>

      <div id="wmStageWrap" class="hidden">
        <div class="unit-toggle wm-type-toggle" style="margin-top:14px;">
          <button class="active" data-type="text" type="button">Text watermark</button>
          <button data-type="logo" type="button">Logo watermark</button>
        </div>

        <div id="wmTextFields" style="margin-top:12px;">
          <span class="field-label">Watermark text</span>
          <input type="text" id="wmText" placeholder="© Your Brand" value="© ToolFlight">
          <div class="qr-controls" style="margin-top:12px;">
            <div class="ctrl"><label>Font size</label><input type="range" id="wmFontSize" min="12" max="120" value="36"></div>
            <div class="ctrl"><label>Color</label><input type="color" id="wmColor" value="#ffffff"></div>
          </div>
        </div>
        <div id="wmLogoFields" class="hidden" style="margin-top:12px;">
          <span class="field-label">Logo image</span>
          <div class="drop-zone" id="wmLogoDrop" style="padding:18px;">
            <div class="drop-title">Drop a logo image or tap to browse</div>
            <input type="file" id="wmLogoInput" accept="image/png, image/jpeg, image/webp">
          </div>
        </div>

        <span class="field-label" style="margin-top:14px;">Opacity: <span id="wmOpacityVal">80</span>%</span>
        <input type="range" id="wmOpacity" min="10" max="100" value="80">

        <span class="field-label" style="margin-top:14px;">Position (or drag directly on the image)</span>
        <div class="pos-grid">
          <button class="pos-btn" data-pos="tl" type="button"><span class="dot"></span></button>
          <div></div>
          <button class="pos-btn" data-pos="tr" type="button"><span class="dot"></span></button>
          <div></div>
          <button class="pos-btn active" data-pos="c" type="button"><span class="dot"></span></button>
          <div></div>
          <button class="pos-btn" data-pos="bl" type="button"><span class="dot"></span></button>
          <div></div>
          <button class="pos-btn" data-pos="br" type="button"><span class="dot"></span></button>
        </div>

        <div class="canvas-stage" id="wmStage" style="margin-top:16px;">
          <canvas id="wmCanvas"></canvas>
          <div class="loading-overlay" id="wmLoading"><div class="spinner"></div></div>
        </div>

        <div class="row">
          <button class="btn btn-success hidden" id="wmDownloadBtn" style="flex:1;" type="button">Download image</button>
        </div>
      </div>"""

ROTATE_FLIP_FORM = """<div class="view-title"><h2>Rotate &amp; Flip Tool</h2></div>
      <span class="field-label">Choose an image</span>
      <div class="drop-zone" id="rfDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP</div>
        <input type="file" id="rfInput" accept="image/png, image/jpeg, image/webp">
      </div>

      <div id="rfStageWrap" class="hidden">
        <div class="canvas-stage" id="rfStage" style="margin-top:14px;">
          <canvas id="rfCanvas"></canvas>
          <div class="loading-overlay" id="rfLoading"><div class="spinner"></div></div>
        </div>
        <div class="row">
          <button class="btn btn-ghost" id="rfRotate90Btn" type="button">Rotate 90°</button>
          <button class="btn btn-ghost" id="rfRotate180Btn" type="button">Rotate 180°</button>
          <button class="btn btn-ghost" id="rfRotate270Btn" type="button">Rotate 270°</button>
        </div>
        <div class="row">
          <button class="btn btn-ghost" id="rfFlipHBtn" type="button">Flip horizontal</button>
          <button class="btn btn-ghost" id="rfFlipVBtn" type="button">Flip vertical</button>
        </div>
        <div class="row">
          <button class="btn btn-success" id="rfDownloadBtn" style="flex:1;" type="button">Download image</button>
          <button class="btn btn-danger" id="rfResetBtn" type="button">Reset</button>
        </div>
      </div>"""

BG_REMOVER_FORM = """<div class="view-title"><h2>AI Background Remover</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Powered by Google's MediaPipe AI model, running entirely in your browser — no file is ever uploaded anywhere. Works best on photos of people, animals, vehicles, and everyday objects.</p>

      <div id="autoSaveBanner" class="hidden" style="background:color-mix(in srgb, var(--accent1) 8%, var(--card));border:1px solid var(--card-border);border-radius:12px;padding:12px 14px;margin-bottom:14px;" role="status">
        <p style="font-size:13px;margin:0 0 8px;">You have an unsaved editing session from before — resume it?</p>
        <div class="row" style="margin-top:0;">
          <button class="btn btn-primary" id="autoSaveResumeBtn" type="button" style="flex:1;">Resume session</button>
          <button class="btn btn-ghost" id="autoSaveDiscardBtn" type="button">Discard</button>
        </div>
      </div>

      <span class="field-label">Choose an image (JPG, PNG, or WEBP)</span>
      <div class="drop-zone" id="aiRemoveDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP — up to 50MB</div>
        <input type="file" id="aiRemoveInput" accept="image/png, image/jpeg, image/webp" aria-label="Choose an image file">
      </div>
      <div class="model-status-line" id="aiModelStatus" role="status"><span class="dot"></span><span>AI model loads on first use.</span></div>

      <div id="aiRemoveStage" class="hidden">
        <div class="canvas-stage" id="aiRemovePreviewStage" style="margin-top:14px;">
          <div id="aiRemovePreview" style="width:100%;"></div>
        </div>
        <div class="row">
          <button class="btn btn-primary" id="aiRemoveBtn" type="button" disabled>Remove background (AI)</button>
        </div>
        <div class="row hidden" id="aiRemoveDownloadRow">
          <button class="btn btn-success" id="aiRemoveDownloadBtn" type="button">Download PNG</button>
          <button class="btn btn-ghost hidden" id="sendToAiChangerBtn" type="button">Send to Background Changer →</button>
        </div>
      </div>

      <div id="aiEditorPanel" class="hidden" style="margin-top:22px;padding-top:20px;border-top:1px solid var(--card-border);">
        <h3 style="font-size:15px;font-weight:800;margin-bottom:10px;">Refine selection</h3>

        <div class="editor-toolbar" role="group" aria-label="Selection tools">
          <button class="editor-tool-btn active" data-tool="brush" type="button" aria-pressed="true">Brush (keep)</button>
          <button class="editor-tool-btn" data-tool="eraser" type="button" aria-pressed="false">Eraser</button>
          <button class="editor-tool-btn" data-tool="edge" type="button" aria-pressed="false" title="Content-aware refinement for hair, fur, and soft edges">Edge Refine</button>
          <button class="editor-tool-btn" data-tool="wand" type="button" aria-pressed="false">Magic Wand</button>
          <button class="editor-tool-btn" data-tool="polygon" type="button" aria-pressed="false">Polygon / Pen</button>
          <button class="editor-tool-btn" data-tool="lasso" type="button" aria-pressed="false">Lasso</button>
        </div>

        <div class="unit-toggle select-mode-toggle" style="margin-top:10px;" role="group" aria-label="Selection mode">
          <button class="active" data-mode="add" type="button" aria-pressed="true">Add to selection</button>
          <button data-mode="subtract" type="button" aria-pressed="false">Subtract</button>
        </div>
        <p class="editor-hint">Add/Subtract applies to Magic Wand, Polygon, and Lasso. Brush always adds, Eraser always subtracts. Edge Refine blends toward real color edges under the brush — useful for hair and fur where the AI's edge is rough.</p>

        <div class="qr-controls" style="margin-top:10px;">
          <div class="ctrl"><label for="brushSizeSlider">Brush size: <span id="brushSizeVal">40</span>px</label><input type="range" id="brushSizeSlider" min="5" max="150" value="40"></div>
          <div class="ctrl"><label for="brushSoftSlider">Soft edge: <span id="brushSoftVal">50</span>%</label><input type="range" id="brushSoftSlider" min="0" max="100" value="50"></div>
          <div class="ctrl"><label for="wandToleranceSlider">Wand tolerance: <span id="wandToleranceVal">30</span></label><input type="range" id="wandToleranceSlider" min="1" max="100" value="30"></div>
          <div class="ctrl">
            <label for="zoomSelect">Zoom</label>
            <select id="zoomSelect" aria-label="Zoom level">
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="100" selected>100%</option>
              <option value="200">200%</option>
              <option value="400">400%</option>
            </select>
          </div>
        </div>

        <div class="qr-controls" style="margin-top:10px;">
          <div class="ctrl"><label for="featherSlider">Feather edge: <span id="featherVal">0</span>px</label><input type="range" id="featherSlider" min="0" max="30" value="0" step="1"></div>
          <div class="ctrl"><label for="smoothSlider">Edge smooth: <span id="smoothVal">0</span>px</label><input type="range" id="smoothSlider" min="0" max="10" value="0" step="1"></div>
          <div class="ctrl" style="grid-column:span 2;"><label for="expandSlider">Expand / Contract: <span id="expandVal">0</span>px</label><input type="range" id="expandSlider" min="-20" max="20" value="0" step="1"></div>
        </div>

        <div class="row">
          <button class="btn btn-ghost" id="undoBtn" type="button">Undo</button>
          <button class="btn btn-ghost" id="redoBtn" type="button">Redo</button>
          <button class="btn btn-ghost" id="invertSelBtn" type="button">Invert selection</button>
          <button class="btn btn-danger" id="resetSelBtn" type="button">Reset to AI result</button>
        </div>
        <div class="row">
          <button class="btn btn-ghost" id="overlayToggleBtn" type="button" aria-pressed="false">Selection overlay</button>
          <button class="btn btn-ghost" id="compareToggleBtn" type="button" aria-pressed="false">Before / After</button>
        </div>

        <div class="editor-stage-wrap tool-brush" id="aiEditStageWrap">
          <canvas id="aiEditCanvas" role="img" aria-label="Editable image selection canvas — use mouse, touch, or stylus to draw"></canvas>
          <div id="compareWrap" class="hidden" style="position:relative;">
            <img id="compareBefore" alt="Original image" style="display:block;width:100%;">
            <div id="compareAfterWrap" style="position:absolute;top:0;left:0;height:100%;overflow:hidden;width:50%;">
              <img id="compareAfter" alt="Background removed, shown on white" style="display:block;height:100%;width:auto;max-width:none;">
            </div>
            <div id="compareHandle" role="slider" aria-label="Before/after comparison position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0" style="position:absolute;top:0;left:50%;width:36px;height:36px;margin-left:-18px;top:calc(50% - 18px);border-radius:50%;background:#fff;border:2px solid var(--accent1);cursor:ew-resize;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
          </div>
        </div>
        <p class="editor-hint">Keyboard: Ctrl+Z undo, Ctrl+Y redo, hold Space and scroll/drag to pan, Escape or Delete cancels an in-progress Polygon/Lasso selection. Scroll or pinch to pan when zoomed in; mouse wheel over the canvas zooms in/out; two-finger pinch/drag on touch devices. Canvas drawing itself needs a pointer (mouse, touch, or stylus) — every other control here is fully keyboard operable.</p>

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--card-border);">
          <span class="field-label">Export</span>
          <div class="qr-controls" style="margin-top:8px;">
            <div class="ctrl">
              <label for="exportFormat">Format</label>
              <select id="exportFormat" aria-label="Export format">
                <option value="png" selected>PNG (transparent)</option>
                <option value="jpg">JPG (solid background)</option>
                <option value="webp">WEBP (transparent)</option>
              </select>
            </div>
            <div class="ctrl" id="exportBgColorRow">
              <label for="exportBgColor">Background (JPG only)</label>
              <input type="color" id="exportBgColor" value="#ffffff">
            </div>
            <div class="ctrl hidden" id="exportQualityRow" style="grid-column:span 2;">
              <label for="exportQuality">Quality: <span id="exportQualityVal">90</span>%</label>
              <input type="range" id="exportQuality" min="10" max="100" value="90">
            </div>
          </div>
          <div class="row">
            <button class="btn btn-primary" id="exportBtn" type="button" style="flex:1;">Export image</button>
          </div>
          <p class="editor-hint">Exports are rebuilt at your original image's full resolution regardless of the editing preview size, using a background worker when your browser supports it so large images don't freeze the page.</p>
        </div>
      </div>"""

BG_CHANGER_FORM = """<div class="view-title"><h2>Background Changer</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Upload a transparent PNG/WEBP (e.g. from the AI Background Remover) and place it on a solid color, gradient, or custom background image.</p>
      <span class="field-label">Choose a transparent image</span>
      <div class="drop-zone" id="bgChangerDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a transparent PNG/WEBP or tap to browse</div>
        <div class="drop-sub">Or send it directly from the AI Background Remover</div>
        <input type="file" id="bgChangerInput" accept="image/png, image/webp">
      </div>

      <div id="bgChangerStage" class="hidden">
        <div class="bg-mode-tabs" style="margin-top:16px;">
          <button class="bg-mode-tab active" data-mode="color" type="button">Solid color</button>
          <button class="bg-mode-tab" data-mode="gradient" type="button">Gradient</button>
          <button class="bg-mode-tab" data-mode="image" type="button">Custom image</button>
        </div>

        <div class="bg-mode-panel" data-mode="color">
          <div class="bg-swatch-row" style="margin-top:12px;">
            <button class="bg-swatch selected" data-color="#ffffff" type="button"></button>
            <button class="bg-swatch" data-color="#151726" type="button"></button>
            <button class="bg-swatch" data-color="#6D5EF5" type="button"></button>
            <button class="bg-swatch" data-color="#C24CF0" type="button"></button>
            <button class="bg-swatch" data-color="#12A66B" type="button"></button>
            <button class="bg-swatch" data-color="#F59E0B" type="button"></button>
            <input type="color" id="bgChangerSolidColor" value="#ffffff" style="width:36px;height:36px;">
          </div>
        </div>

        <div class="bg-mode-panel hidden" data-mode="gradient">
          <div class="qr-controls" style="margin-top:12px;">
            <div class="ctrl"><label>Start</label><input type="color" id="bgChangerGradStart" value="#6D5EF5"></div>
            <div class="ctrl"><label>End</label><input type="color" id="bgChangerGradEnd" value="#C24CF0"></div>
            <div class="ctrl" style="grid-column:span 2;">
              <label>Angle: <span id="bgChangerGradAngleVal">45</span>°</label>
              <input type="range" id="bgChangerGradAngle" min="0" max="360" value="45">
            </div>
          </div>
        </div>

        <div class="bg-mode-panel hidden" data-mode="image">
          <div class="drop-zone" id="bgChangerCustomDrop" style="margin-top:12px;padding:20px;">
            <div class="drop-title">Drop a background image or tap to browse</div>
            <input type="file" id="bgChangerCustomInput" accept="image/*">
          </div>
        </div>

        <div class="canvas-stage" id="bgChangerPreviewStage" style="margin-top:16px;">
          <div id="bgChangerPreview" style="width:100%;"></div>
        </div>
        <div class="row hidden" id="bgChangerDownloadRow">
          <button class="btn btn-success" id="bgChangerDownloadBtn" style="flex:1;" type="button">Download final image</button>
        </div>
      </div>"""

ME_FORM = """<div class="view-title"><h2>Magic Eraser (AI Object Remover)</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Powered by LaMa, an open-source AI inpainting model, running entirely in your browser via WebAssembly \u2014 no file is ever uploaded anywhere. The first use downloads the AI model (~200MB, one-time, cached by your browser afterward).</p>

      <span class="field-label">Choose an image (JPG, PNG, or WEBP)</span>
      <div class="drop-zone" id="meDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP \u2014 up to 50MB</div>
        <input type="file" id="meInput" accept="image/jpeg, image/png, image/webp">
      </div>

      <div id="meStage" class="hidden">
        <div class="qr-controls" style="margin-top:14px;">
          <div class="ctrl"><label for="meBrushSize">Brush size: <span id="meBrushSizeVal">40</span>px</label><input type="range" id="meBrushSize" min="8" max="150" value="40"></div>
          <div class="ctrl"><label for="meBrushSoftness">Soft edge: <span id="meBrushSoftnessVal">60</span>%</label><input type="range" id="meBrushSoftness" min="0" max="100" value="60"></div>
          <div class="ctrl">
            <label for="meZoomSelect">Zoom</label>
            <select id="meZoomSelect" aria-label="Zoom level">
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="100" selected>100%</option>
              <option value="200">200%</option>
              <option value="400">400%</option>
            </select>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <button class="btn btn-ghost" id="meFitScreenBtn" type="button" style="width:100%;">Fit to screen</button>
          </div>
        </div>

        <div class="row">
          <button class="btn btn-ghost" id="meUndoBtn" type="button">Undo</button>
          <button class="btn btn-ghost" id="meRedoBtn" type="button">Redo</button>
          <button class="btn btn-danger" id="meClearSelectionBtn" type="button">Clear Selection</button>
          <button class="btn btn-danger" id="meResetImageBtn" type="button">Reset Image</button>
        </div>

        <div class="editor-stage-wrap tool-brush" id="meStageWrap" style="margin-top:14px;">
          <canvas id="meEditCanvas" role="img" aria-label="Brush over the object you want removed"></canvas>
        </div>
        <p class="editor-hint">Brush over the object you want removed (shown in red). Hold Space to pan, scroll to zoom, Ctrl+Z / Ctrl+Y to undo/redo. Works with touch, mouse, or stylus.</p>

        <div class="progress-wrap hidden" id="meProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="meProgressFill"></div></div>
          <div class="progress-label" id="meProgressLabel">Processing\u2026</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="meRemoveBtn" type="button" style="flex:1;" disabled>Remove Object</button>
        </div>

        <div id="meCompareWrap" class="hidden" style="position:relative;margin-top:16px;border:1.5px solid var(--card-border);border-radius:16px;overflow:hidden;">
          <img id="meCompareBefore" alt="Original image" style="display:block;width:100%;">
          <div id="meCompareAfterWrap" style="position:absolute;top:0;left:0;height:100%;overflow:hidden;width:50%;">
            <img id="meCompareAfter" alt="Object removed" style="display:block;height:100%;width:auto;max-width:none;">
          </div>
          <div id="meCompareHandle" role="slider" aria-label="Before/after comparison position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0" style="position:absolute;top:calc(50% - 18px);left:50%;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#fff;border:2px solid var(--accent1);cursor:ew-resize;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>

        <div class="row hidden" id="meDownloadRow">
          <button class="btn btn-success" id="meDownloadPngBtn" type="button" style="flex:1;">Download PNG</button>
          <button class="btn btn-success" id="meDownloadJpgBtn" type="button" style="flex:1;">Download JPG</button>
        </div>
      </div>"""

APE_FORM = """<div class="view-title"><h2>AI Photo Enhancer</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Natural photo enhancement \u2014 not a beauty filter. Face Enhancement uses a real AI model (MediaPipe Face Landmarker) purely to detect where your face is, so smoothing and clarity are applied precisely and naturally. It never changes your face shape, identity, or adds makeup.</p>

      <span class="field-label">Choose an image (JPG, PNG, or WEBP)</span>
      <div class="drop-zone" id="apeDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here or tap to browse</div>
        <div class="drop-sub">JPG, PNG, or WEBP \u2014 up to 40MB</div>
        <input type="file" id="apeInput" accept="image/jpeg, image/png, image/webp">
      </div>
      <div class="model-status-line hidden" id="apeModelStatus" role="status"><span class="dot"></span><span></span></div>

      <div id="apeStage" class="hidden">
        <div class="row">
          <button class="btn btn-primary" id="apeAutoEnhanceBtn" type="button" style="flex:1;">Auto Enhance</button>
          <button class="btn btn-danger" id="apeResetBtn" type="button">Reset</button>
        </div>

        <span class="field-label" style="margin-top:14px;">Enhancement Strength: <span id="apeStrengthVal">100</span>%</span>
        <input type="range" id="apeStrength" min="0" max="100" value="100">

        <div class="qr-controls" style="margin-top:10px;">
          <div class="ctrl"><label for="apeBrightness">Brightness: <span id="apeBrightnessVal">0</span></label><input type="range" id="apeBrightness" min="-100" max="100" value="0"></div>
          <div class="ctrl"><label for="apeContrast">Contrast: <span id="apeContrastVal">0</span></label><input type="range" id="apeContrast" min="-100" max="100" value="0"></div>
          <div class="ctrl"><label for="apeSaturation">Saturation (Color): <span id="apeSaturationVal">0</span></label><input type="range" id="apeSaturation" min="-100" max="100" value="0"></div>
          <div class="ctrl"><label for="apeSharpness">Sharpness / Detail: <span id="apeSharpnessVal">0</span></label><input type="range" id="apeSharpness" min="0" max="100" value="0"></div>
          <div class="ctrl"><label for="apeNoise">Noise Reduction: <span id="apeNoiseVal">0</span></label><input type="range" id="apeNoise" min="0" max="100" value="0"></div>
          <div class="ctrl"><label for="apeSmoothing">Skin Smoothing: <span id="apeSmoothingVal">0</span></label><input type="range" id="apeSmoothing" min="0" max="100" value="0"></div>
        </div>

        <div class="row" style="margin-top:10px;">
          <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="apeFaceEnhance" style="width:15px;height:15px;accent-color:var(--accent1);"> Face Enhancement (AI-targeted, natural)</label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="apeWhiteBalance" style="width:15px;height:15px;accent-color:var(--accent1);"> White Balance Correction</label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="apeHdr" style="width:15px;height:15px;accent-color:var(--accent1);"> HDR-like Enhancement</label>
        </div>

        <div class="qr-controls" style="margin-top:10px;">
          <div class="ctrl">
            <label for="apeZoomSelect">Zoom</label>
            <select id="apeZoomSelect" aria-label="Zoom level">
              <option value="25">25%</option><option value="50">50%</option>
              <option value="100" selected>100%</option><option value="200">200%</option><option value="400">400%</option>
            </select>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <button class="btn btn-ghost" id="apeFitScreenBtn" type="button" style="width:100%;">Fit to screen</button>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <button class="btn btn-ghost" id="apeUndoBtn" type="button" style="width:100%;">Undo</button>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <button class="btn btn-ghost" id="apeRedoBtn" type="button" style="width:100%;">Redo</button>
          </div>
        </div>

        <div class="editor-stage-wrap tool-brush" id="apeStageWrap" style="margin-top:14px;cursor:default;">
          <canvas id="apeEditCanvas" role="img" aria-label="Live preview of your enhanced photo"></canvas>
        </div>
        <p class="editor-hint">Scroll or pinch to zoom, drag to pan when zoomed in. Ctrl+Z / Ctrl+Y to undo/redo.</p>

        <div class="progress-wrap hidden" id="apeProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="apeProgressFill" style="width:60%;"></div></div>
          <div class="progress-label" id="apeProgressLabel">Processing\u2026</div>
        </div>

        <div class="row">
          <button class="btn btn-secondary" id="apeCompareBtn" type="button" style="flex:1;">Before / After</button>
        </div>
        <div id="apeCompareWrap" class="hidden" style="position:relative;margin-top:12px;border:1.5px solid var(--card-border);border-radius:16px;overflow:hidden;">
          <img id="apeCompareBefore" alt="Original image" style="display:block;width:100%;">
          <div id="apeCompareAfterWrap" style="position:absolute;top:0;left:0;height:100%;overflow:hidden;width:50%;">
            <img id="apeCompareAfter" alt="Enhanced image" style="display:block;height:100%;width:auto;max-width:none;">
          </div>
          <div id="apeCompareHandle" role="slider" aria-label="Before/after comparison position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0" style="position:absolute;top:calc(50% - 18px);left:50%;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#fff;border:2px solid var(--accent1);cursor:ew-resize;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--card-border);">
          <span class="field-label">Export</span>
          <div class="qr-controls" style="margin-top:8px;">
            <div class="ctrl" style="grid-column:span 2;">
              <label for="apeQuality">JPG/WEBP Quality: <span id="apeQualityVal">90</span>%</label>
              <input type="range" id="apeQuality" min="10" max="100" value="90">
            </div>
          </div>
          <div class="row hidden" id="apeDownloadRow">
            <button class="btn btn-success" id="apeDownloadPngBtn" type="button">Download PNG</button>
            <button class="btn btn-success" id="apeDownloadJpgBtn" type="button">Download JPG</button>
            <button class="btn btn-success" id="apeDownloadWebpBtn" type="button">Download WEBP</button>
          </div>
          <p class="editor-hint">Downloads are rebuilt at your original image's full resolution \u2014 the editor above is a capped-resolution live preview for responsiveness, images are never upscaled beyond their original size.</p>
        </div>
      </div>"""

UPS_FORM = """<div class="view-title"><h2>AI Image Upscaler</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Real AI super-resolution (ESRGAN via UpscalerJS / TensorFlow.js), not a simple resize \u2014 runs entirely in your browser. The AI model downloads only when you tap AI Upscale (one-time, cached after). Images larger than 1600px on their longest side aren't accepted, to avoid crashing your browser tab.</p>

      <span class="field-label">Choose an image (JPG, PNG, or WEBP)</span>
      <div class="drop-zone" id="upsDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image here, tap to browse, or paste from clipboard</div>
        <div class="drop-sub">JPG, PNG, or WEBP \u2014 up to 30MB, 1600px max side</div>
        <input type="file" id="upsInput" accept="image/jpeg, image/png, image/webp">
      </div>

      <div id="upsStage" class="hidden">
        <div class="qr-controls" style="margin-top:14px;">
          <div class="ctrl">
            <label>Scale</label>
            <div class="unit-toggle">
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="upsScale" value="2" checked style="margin-right:6px;accent-color:var(--accent1);">2x</label>
              <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="upsScale" value="4" style="margin-right:6px;accent-color:var(--accent1);">4x</label>
            </div>
          </div>
          <div class="ctrl">
            <label for="upsZoomSelect">Zoom</label>
            <select id="upsZoomSelect" aria-label="Zoom level">
              <option value="25">25%</option><option value="50">50%</option>
              <option value="100" selected>100%</option><option value="200">200%</option>
            </select>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <button class="btn btn-ghost" id="upsFitScreenBtn" type="button" style="width:100%;">Fit to screen</button>
          </div>
          <div class="ctrl" style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="upsHighQuality" style="width:15px;height:15px;accent-color:var(--accent1);"> Higher quality (slower)</label>
          </div>
        </div>
        <p class="editor-hint">"Higher quality" uses a larger AI model \u2014 noticeably better detail, but meaningfully slower, especially on phones. Default is the model UpscalerJS's own maintainers recommend for browser use.</p>

        <div id="upsDims" style="font-size:12.5px;color:var(--ink-soft);margin-top:6px;"></div>

        <div class="editor-stage-wrap" id="upsStageWrap" style="margin-top:10px;cursor:default;">
          <canvas id="upsPreviewCanvas" role="img" aria-label="Image preview"></canvas>
        </div>

        <div class="progress-wrap hidden" id="upsProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="upsProgressFill"></div></div>
          <div class="progress-label" id="upsProgressLabel">Processing\u2026</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="upsUpscaleBtn" type="button" style="flex:1;" disabled>AI Upscale</button>
          <button class="btn btn-danger hidden" id="upsCancelBtn" type="button">Cancel</button>
          <button class="btn btn-ghost" id="upsResetBtn" type="button">Reset</button>
        </div>

        <div id="upsCompareWrap" class="hidden" style="position:relative;margin-top:14px;border:1.5px solid var(--card-border);border-radius:16px;overflow:hidden;">
          <img id="upsCompareBefore" alt="Original image" style="display:block;width:100%;">
          <div id="upsCompareAfterWrap" style="position:absolute;top:0;left:0;height:100%;overflow:hidden;width:50%;">
            <img id="upsCompareAfter" alt="Upscaled image" style="display:block;height:100%;width:auto;max-width:none;">
          </div>
          <div id="upsCompareHandle" role="slider" aria-label="Before/after comparison position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0" style="position:absolute;top:calc(50% - 18px);left:50%;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#fff;border:2px solid var(--accent1);cursor:ew-resize;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--card-border);">
          <span class="field-label">Export</span>
          <div class="qr-controls" style="margin-top:8px;">
            <div class="ctrl" style="grid-column:span 2;">
              <label for="upsQuality">JPG/WEBP Quality: <span id="upsQualityVal">92</span>%</label>
              <input type="range" id="upsQuality" min="10" max="100" value="92">
            </div>
          </div>
          <div class="row hidden" id="upsDownloadRow">
            <button class="btn btn-success" id="upsDownloadPngBtn" type="button">Download PNG</button>
            <button class="btn btn-success" id="upsDownloadJpgBtn" type="button">Download JPG</button>
            <button class="btn btn-success" id="upsDownloadWebpBtn" type="button">Download WEBP</button>
          </div>
          <div class="row">
            <button class="btn btn-ghost" id="upsConvertAnotherBtn" type="button">Upscale another image</button>
          </div>
        </div>
      </div>"""

OCR_FORM = """<div class="view-title"><h2>AI OCR \u2014 Image &amp; PDF to Text</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Real OCR (Tesseract.js), running entirely in your browser \u2014 nothing is uploaded. For PDFs, each page is rendered as an image first, then read with the same OCR engine (Tesseract.js itself doesn't read PDF files directly \u2014 see the FAQ).</p>

      <span class="field-label">Language(s)</span>
      <div class="row" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" class="ocr-lang-check" value="eng" checked style="width:15px;height:15px;accent-color:var(--accent1);"> English</label>
        <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" class="ocr-lang-check" value="urd" style="width:15px;height:15px;accent-color:var(--accent1);"> Urdu</label>
        <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" class="ocr-lang-check" value="ara" style="width:15px;height:15px;accent-color:var(--accent1);"> Arabic</label>
      </div>
      <p class="editor-hint">Select every language actually present in your file \u2014 selecting languages that aren't there can reduce accuracy.</p>

      <span class="field-label" style="margin-top:14px;">Choose a file</span>
      <div class="drop-zone" id="ocrDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop an image or PDF here, tap to browse, or paste from clipboard</div>
        <div class="drop-sub">JPG, PNG, WEBP, or PDF \u2014 up to 30MB</div>
        <input type="file" id="ocrInput" accept="image/jpeg, image/png, image/webp, application/pdf">
      </div>

      <div id="ocrStage" class="hidden">
        <div style="margin-top:12px;font-size:12.5px;color:var(--ink-soft);">
          <strong id="ocrFileName" style="color:var(--ink);"></strong> \u00b7 <span id="ocrFileSize"></span>
        </div>
        <div class="canvas-stage" style="margin-top:10px;max-height:280px;overflow:auto;display:flex;align-items:center;justify-content:center;">
          <img id="ocrPreviewImg" alt="File preview" class="hidden" style="max-width:100%;max-height:260px;">
          <span id="ocrPreviewPdfNote" class="hidden" style="font-size:13px;color:var(--ink-soft);"></span>
        </div>

        <div class="progress-wrap hidden" id="ocrProgressWrap">
          <div class="progress-track"><div class="progress-fill" id="ocrProgressFill"></div></div>
          <div class="progress-label" id="ocrProgressLabel">Processing\u2026</div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="ocrExtractBtn" type="button" style="flex:1;" disabled>Extract Text</button>
          <button class="btn btn-danger hidden" id="ocrCancelBtn" type="button">Cancel</button>
        </div>

        <div id="ocrResultWrap" class="hidden" style="margin-top:14px;">
          <div class="row" style="margin-top:0;">
            <input type="text" id="ocrSearchInput" placeholder="Search extracted text\u2026" style="flex:1;" aria-label="Search extracted text">
            <span id="ocrSearchCount" style="font-size:12px;color:var(--ink-soft);align-self:center;white-space:nowrap;"></span>
          </div>
          <textarea id="ocrResultText" readonly rows="12" style="width:100%;margin-top:10px;font-family:inherit;font-size:13.5px;padding:13px 14px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--ink);resize:vertical;" aria-label="Extracted text"></textarea>
          <div id="ocrCharCount" style="font-size:12px;color:var(--ink-soft);margin-top:4px;"></div>

          <div class="row">
            <button class="btn btn-secondary" id="ocrCopyBtn" type="button">Copy Text</button>
            <button class="btn btn-success" id="ocrDownloadTxtBtn" type="button">Download TXT</button>
            <button class="btn btn-success" id="ocrDownloadDocxBtn" type="button">Download DOCX</button>
          </div>
          <div class="row">
            <button class="btn btn-ghost" id="ocrConvertAnotherBtn" type="button">Extract from another file</button>
          </div>
        </div>
      </div>"""

PP_COUNTRIES = [
    ("us-passport","USA Passport"), ("us-visa","USA Visa"), ("dv-lottery","DV Lottery (Green Card)"),
    ("ca-passport","Canada Passport"), ("ca-visa","Canada Visa"), ("uk-passport","UK Passport"),
    ("au-passport","Australia Passport"), ("nz-passport","New Zealand Passport"), ("de-passport","Germany Passport"),
    ("fr-passport","France Passport"), ("it-passport","Italy Passport"), ("es-passport","Spain Passport"),
    ("nl-passport","Netherlands Passport"), ("be-passport","Belgium Passport"), ("ch-passport","Switzerland Passport"),
    ("at-passport","Austria Passport"), ("no-passport","Norway Passport"), ("se-passport","Sweden Passport"),
    ("dk-passport","Denmark Passport"), ("fi-passport","Finland Passport"), ("ie-passport","Ireland Passport"),
    ("pt-passport","Portugal Passport"), ("pl-passport","Poland Passport"), ("cz-passport","Czech Republic Passport"),
    ("jp-passport","Japan Passport"), ("kr-passport","South Korea Passport"), ("cn-passport","China Passport"),
    ("sg-passport","Singapore Passport"), ("my-passport","Malaysia Passport"), ("ae-passport","UAE Passport"),
    ("sa-passport","Saudi Arabia Passport"), ("qa-passport","Qatar Passport"), ("kw-passport","Kuwait Passport"),
    ("om-passport","Oman Passport"), ("bh-passport","Bahrain Passport"), ("pk-passport","Pakistan Passport"),
    ("in-passport","India Passport"), ("bd-passport","Bangladesh Passport"), ("lk-passport","Sri Lanka Passport"),
    ("np-passport","Nepal Passport"), ("tr-passport","Turkey Passport"), ("schengen-visa","Schengen Visa"),
    ("custom","Custom Size\u2026"),
]
PP_COUNTRY_OPTIONS = "\n".join(f'              <option value="{slug}"{" selected" if slug=="us-passport" else ""}>{label}</option>' for slug, label in PP_COUNTRIES)

PP_FORM = """<div class="view-title"><h2>Passport &amp; Visa Photo Maker</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Automatic face detection and cropping for passport and visa photos across 42 presets, entirely in your browser. Specifications are not a legal guarantee \u2014 see the FAQ below for full details and always verify with your country's official source.</p>

      <span class="field-label">Country / Document</span>
      <select id="ppCountry" style="margin-bottom:8px;">
""" + PP_COUNTRY_OPTIONS + """
      </select>

      <div class="hidden" id="ppCustomSizePanel" style="margin-bottom:12px;padding:12px 14px;border:1.5px solid var(--card-border);border-radius:12px;background:var(--card);">
        <div class="resume-form-grid">
          <div class="resume-field-group"><label for="ppCustomWidthVal">Width</label><input type="number" id="ppCustomWidthVal" value="35" min="0.1" step="0.1"></div>
          <div class="resume-field-group"><label for="ppCustomHeightVal">Height</label><input type="number" id="ppCustomHeightVal" value="45" min="0.1" step="0.1"></div>
          <div class="resume-field-group"><label for="ppCustomUnit">Unit</label><select id="ppCustomUnit"><option value="mm" selected>Millimeters</option><option value="cm">Centimeters</option><option value="in">Inches</option><option value="px">Pixels</option></select></div>
          <div class="resume-field-group"><label for="ppCustomDpi">DPI</label><input type="number" id="ppCustomDpi" value="300" min="72" max="1200" step="1"></div>
        </div>
        <p id="ppCustomValidation" style="font-size:12.5px;font-weight:600;margin:10px 0 0;"></p>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:8px;line-height:1.8;">
          <div>Width: <strong id="ppDimW">\u2014</strong> &middot; Height: <strong id="ppDimH">\u2014</strong> &middot; DPI: <strong id="ppDimDpi">\u2014</strong></div>
          <div>Pixels: <strong id="ppDimPx">\u2014</strong> &middot; Aspect ratio: <strong id="ppDimRatio">\u2014</strong></div>
          <div>Physical size: <strong id="ppDimPhysical">\u2014</strong></div>
        </div>
        <p class="editor-hint">Custom sizes use standard ICAO-convention head/eye guides since no official rule exists for an arbitrary size \u2014 not a substitute for your destination's actual requirements.</p>
      </div>

      <p class="hidden" id="ppUsWarning" role="alert" style="font-size:12px;line-height:1.5;color:var(--err-solid);margin:0 0 12px;">
        \u26a0 US passport/visa photos: avoid AI background replacement and enhancement sliders \u2014 see the full notice in the FAQ below.
      </p>

      <div class="drop-zone" id="ppDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a photo here, tap to browse, or paste from clipboard</div>
        <div class="drop-sub">JPG, PNG, or WEBP \u2014 up to 30MB</div>
        <input type="file" id="ppInput" accept="image/jpeg, image/png, image/webp">
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="btn btn-ghost" id="ppOpenCameraBtn" type="button">Use Camera</button>
        <input type="file" id="ppCameraFallbackInput" accept="image/*" capture="user" style="display:none;" aria-hidden="true">
      </div>

      <div class="hidden pp-camera-debug" id="ppCameraDebugPanel">
        <div style="font-weight:800;font-size:12.5px;margin-bottom:6px;">Camera Debug Panel</div>
        <div id="ppCameraDebugLog" style="font-size:11px;line-height:1.7;font-family:monospace;white-space:pre-wrap;word-break:break-word;"></div>
      </div>

      <div class="legal-modal hidden" id="ppCameraModal" role="dialog" aria-modal="true" aria-label="Camera capture">
        <div class="legal-box" style="max-width:480px;padding:20px;">
          <button class="legal-close" id="ppCameraCloseBtn" type="button" aria-label="Close camera">\u2715</button>
          <h3 style="margin-top:0;">Position your face in the oval</h3>
          <div id="ppCameraStageDebugBorder" style="position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:3/4;border:3px solid transparent;">
            <video id="ppCameraVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:block;border:3px solid transparent;"></video>
            <svg viewBox="0 0 300 400" id="ppCameraOverlaySvg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border:3px solid transparent;" aria-hidden="true">
              <ellipse cx="150" cy="190" rx="95" ry="130" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="10 8" opacity="0.85"/>
            </svg>
          </div>
          <p class="editor-hint" style="margin-top:6px;">Debug mode: red border = stage wrapper, green border = &lt;video&gt; element, blue border = face-guide overlay. If you see only some of these colors, that tells us which layer is actually rendering.</p>
          <div class="row">
            <button class="btn btn-primary" id="ppCameraCaptureBtn" type="button" style="flex:1;">Capture Photo</button>
          </div>
        </div>
      </div>
      <div class="model-status-line hidden" id="ppModelStatus" role="status"><span class="dot"></span><span></span></div>

      <div id="ppStage" class="hidden">
        <div class="editor-stage-wrap" id="ppCanvasStageWrap" style="margin-top:14px;cursor:default;">
          <canvas id="ppPreviewCanvas" role="img" aria-label="Passport photo preview"></canvas>
          <canvas id="ppIcaoOverlay" style="position:absolute;top:0;left:0;pointer-events:none;"></canvas>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:6px;cursor:pointer;"><input type="checkbox" id="ppIcaoToggle" checked style="width:15px;height:15px;accent-color:var(--accent1);"> Show ICAO compliance guides</label>
        <div id="ppOutputDims" style="font-size:12.5px;color:var(--ink-soft);margin-top:6px;"></div>

        <details class="pp-accordion" id="ppAccordionManual">
        <summary class="pp-accordion-summary">Manual Editing (optional)</summary>
        <p class="editor-hint">Erase, restore, and refine edges by hand \u2014 useful when AI background replacement isn't quite clean, or unavailable. Hold Space and drag to pan; scroll to zoom toward your cursor.</p>
        <div class="editor-toolbar" role="toolbar" aria-label="Manual editing tools" style="flex-wrap:wrap;">
          <button class="editor-tool-btn pp-tool-btn" data-tool="erase" type="button" aria-label="Magic Eraser brush">Magic Eraser</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="restore" type="button" aria-label="Restore brush">Restore</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="hair" type="button" aria-label="Hair refinement brush, a finer mode of the same brush">Hair Refine</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="rect" type="button" aria-label="Rectangle selection">Rectangle</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="circle" type="button" aria-label="Circle selection">Circle</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="lasso" type="button" aria-label="Freehand lasso selection">Lasso</button>
          <button class="editor-tool-btn pp-tool-btn" data-tool="polygon" type="button" aria-label="Polygon selection, click to place points and click near the start to close">Polygon</button>
        </div>
        <p class="editor-hint">Brush and selection tools are drawn by mouse, finger, or stylus \u2014 there isn't a practical fully keyboard-driven equivalent for freehand drawing, though every button above is keyboard-reachable and operable.</p>

        <div class="resume-form-grid">
          <div class="resume-field-group"><label for="ppBrushSize">Brush Size: <span id="ppBrushSizeVal">40</span>px</label><input type="range" id="ppBrushSize" min="4" max="200" value="40"></div>
          <div class="resume-field-group"><label for="ppBrushHardness">Edge Hardness: <span id="ppBrushHardnessVal">60</span></label><input type="range" id="ppBrushHardness" min="0" max="100" value="60"></div>
        </div>

        <div class="row hidden" id="ppSelectionActions">
          <button class="btn btn-secondary" id="ppFillSelectionEraseBtn" type="button">Erase Selection</button>
          <button class="btn btn-secondary" id="ppFillSelectionRestoreBtn" type="button">Restore Selection</button>
          <button class="btn btn-ghost" id="ppClearSelectionBtn" type="button">Clear Selection</button>
        </div>

        <div class="row">
          <input type="range" id="ppFeatherRadius" min="1" max="20" value="4" aria-label="Feather radius" style="flex:1;">
          <button class="btn btn-secondary" id="ppFeatherBtn" type="button">Feather Edges</button>
        </div>

        <div class="row">
          <button class="btn btn-ghost" id="ppUndoBtn" type="button" aria-label="Undo" disabled>Undo (Ctrl+Z)</button>
          <button class="btn btn-ghost" id="ppRedoBtn" type="button" aria-label="Redo" disabled>Redo (Ctrl+Y)</button>
        </div>
        </details>

        <details class="pp-accordion" id="ppAccordionPosition" open>
        <summary class="pp-accordion-summary">Position &amp; Size</summary>
        <div class="resume-form-grid">
          <div class="resume-field-group"><label for="ppZoomSlider">Zoom</label><input type="range" id="ppZoomSlider" min="30" max="300" value="100"></div>
          <div class="resume-field-group"><label for="ppMoveX">Move Horizontal</label><input type="range" id="ppMoveX" min="-200" max="200" value="0"></div>
          <div class="resume-field-group"><label for="ppMoveY">Move Vertical</label><input type="range" id="ppMoveY" min="-200" max="200" value="0"></div>
        </div>
        <div class="row">
          <button class="btn btn-secondary" id="ppAutoCenterBtn" type="button">Auto Center Face</button>
          <button class="btn btn-secondary" id="ppFitScreenBtn" type="button">Fit to Screen</button>
          <button class="btn btn-ghost" id="ppRotateBtn" type="button">Rotate 90\u00b0</button>
          <button class="btn btn-ghost" id="ppFlipBtn" type="button">Flip</button>
          <button class="btn btn-danger" id="ppResetBtn" type="button">Reset</button>
        </div>
        <div class="row">
          <button class="btn btn-secondary" id="ppCropToggleBtn" type="button" aria-pressed="false">Crop</button>
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="ppCropLockRatio" checked style="width:15px;height:15px;accent-color:var(--accent1);"> Lock to passport ratio</label>
        </div>
        <div class="row hidden" id="ppCropActions">
          <button class="btn btn-primary" id="ppCropApplyBtn" type="button">Apply Crop</button>
          <button class="btn btn-ghost" id="ppCropResetBtn" type="button">Reset Crop</button>
          <button class="btn btn-ghost" id="ppCropCancelBtn" type="button">Cancel</button>
        </div>
        </details>

        <details class="pp-accordion" id="ppAccordionBackground" open>
        <summary class="pp-accordion-summary">Background</summary>
        <div class="row" style="margin-top:6px;">
          <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="ppBg" value="preset" checked style="margin-right:6px;accent-color:var(--accent1);">Country Default</label>
          <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="ppBg" value="white" style="margin-right:6px;accent-color:var(--accent1);">Pure White</label>
          <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="ppBg" value="gray" style="margin-right:6px;accent-color:var(--accent1);">Light Gray</label>
          <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="ppBg" value="blue" style="margin-right:6px;accent-color:var(--accent1);">Blue</label>
          <label class="btn btn-ghost" style="cursor:pointer;"><input type="radio" name="ppBg" value="custom" style="margin-right:6px;accent-color:var(--accent1);">Custom<input type="color" id="ppCustomBgColor" value="#ffffff" style="margin-left:6px;vertical-align:middle;"></label>
        </div>
        <div class="row">
          <button class="btn btn-secondary" id="ppReplaceBgBtn" type="button">Replace Background (AI)</button>
        </div>
        <p class="editor-hint">Choosing a background color sets the target for AI background replacement below \u2014 tap <strong>Replace Background (AI)</strong> to actually apply it. It won't change anything on its own if your photo already fills the frame edge-to-edge.</p>
        <div class="row hidden" id="ppManualBgRow">
          <button class="btn btn-ghost" id="ppManualBgClickBtn" type="button">Manual: Click Background to Replace</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-top:10px;cursor:pointer;color:var(--ink-soft);"><input type="checkbox" id="ppDebugSegmentation" style="width:15px;height:15px;accent-color:var(--accent1);"> Debug Segmentation Mode (developer)</label>
        <p class="editor-hint">When enabled, tapping Replace Background (AI) additionally logs detailed pixel-level data to the browser console and shows every intermediate stage below \u2014 for diagnosing background-replacement issues, not for normal use.</p>
        <div class="hidden pp-debug-panel" id="ppDebugPanel"></div>
        </details>

        <details class="pp-accordion" id="ppAccordionAdjustments">
        <summary class="pp-accordion-summary">Adjustments</summary>
        <div class="resume-form-grid">
          <div class="resume-field-group"><label for="ppBrightness">Brightness: <span id="ppBrightnessVal">0</span></label><input type="range" id="ppBrightness" min="-100" max="100" value="0"></div>
          <div class="resume-field-group"><label for="ppContrast">Contrast: <span id="ppContrastVal">0</span></label><input type="range" id="ppContrast" min="-100" max="100" value="0"></div>
          <div class="resume-field-group"><label for="ppSaturation">Saturation: <span id="ppSaturationVal">0</span></label><input type="range" id="ppSaturation" min="-100" max="100" value="0"></div>
          <div class="resume-field-group"><label for="ppSharpness">Sharpness: <span id="ppSharpnessVal">0</span></label><input type="range" id="ppSharpness" min="0" max="100" value="0"></div>
          <div class="resume-field-group"><label for="ppTemperature">Temperature: <span id="ppTemperatureVal">0</span></label><input type="range" id="ppTemperature" min="-100" max="100" value="0"></div>
        </div>
        </details>

        <span class="field-label" style="margin-top:14px;">Automated Suitability Score</span>
        <div class="ats-score-wrap">
          <div class="ats-score-num" id="ppScoreNum">\u2014</div>
          <div><div style="font-weight:700;font-size:13px;">Automated checks (not an official validator)</div><div class="ats-score-label" id="ppScoreLabel"></div></div>
        </div>
        <ul class="ats-result-list" id="ppValidationList" style="margin-top:10px;"></ul>

        <details class="pp-accordion" id="ppAccordionExport">
        <summary class="pp-accordion-summary">Export &amp; Print</summary>
          <div class="row hidden" id="ppDownloadRow">
            <button class="btn btn-success" id="ppDownloadPngBtn" type="button">Download PNG</button>
            <button class="btn btn-success" id="ppDownloadJpgBtn" type="button">Download JPEG</button>
          </div>
          <div class="qr-controls" style="margin-top:10px;">
            <div class="ctrl">
              <label for="ppSheetSize">Print Sheet Size</label>
              <select id="ppSheetSize"><option value="4x6">4x6 inch</option><option value="5x7">5x7 inch</option><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="custom">Custom</option></select>
            </div>
            <div class="ctrl">
              <label for="ppSheetMargin">Margin (pt)</label>
              <input type="range" id="ppSheetMargin" min="6" max="40" value="18">
            </div>
            <div class="ctrl">
              <label for="ppSheetGap">Spacing (pt)</label>
              <input type="range" id="ppSheetGap" min="0" max="20" value="6">
            </div>
          </div>
          <div class="resume-form-grid hidden" id="ppCustomPaperRow">
            <div class="resume-field-group"><label for="ppCustomPaperW">Custom Width (in)</label><input type="number" id="ppCustomPaperW" value="4" min="1" max="20" step="0.1"></div>
            <div class="resume-field-group"><label for="ppCustomPaperH">Custom Height (in)</label><input type="number" id="ppCustomPaperH" value="6" min="1" max="20" step="0.1"></div>
          </div>

          <div id="ppSheetInfo" style="font-size:12.5px;color:var(--ink-soft);margin-top:10px;"></div>
          <div id="ppSheetPreviewWrap" class="pp-sheet-preview-wrap"></div>
          <p class="editor-hint">Tap a photo in the sheet preview, then tap another to swap their positions.</p>

          <div class="row">
            <button class="btn btn-secondary" id="ppDownloadSheetBtn" type="button" style="width:100%;">Download Print Sheet PDF</button>
          </div>
          <div class="row">
            <button class="btn btn-ghost" id="ppPrintBtn" type="button" style="width:100%;">Print Sheet Directly</button>
          </div>
        </details>
      </div>

      <div id="ppPrintRoot" class="pp-print-root"></div>"""

RT_FORM = """<div class="view-title"><h2>AI Photo Retouch &amp; Beauty Editor</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">A professional portrait retouch editor \\u2014 skin smoothing, background blur, and a full set of Lightroom-style tone and color adjustments, running entirely in your browser at full resolution. Nothing you upload ever leaves your device.</p>

      <div class="drop-zone" id="rtDrop">
        <div class="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg></div>
        <div class="drop-title">Drop a portrait photo here, tap to browse, or paste from clipboard</div>
        <div class="drop-sub">JPG, PNG, or WEBP \\u2014 up to 30MB</div>
        <input type="file" id="rtInput" accept="image/jpeg, image/png, image/webp">
      </div>

      <div class="model-status-line hidden" id="rtModelStatus" role="status"><span class="dot"></span><span></span></div>

      <div id="rtStage" class="hidden">
        <div class="row" style="margin-top:8px;">
          <button class="btn btn-secondary" id="rtFitScreenBtn" type="button">Fit to Screen</button>
          <button class="btn btn-ghost" id="rtCompareBtn" type="button" aria-pressed="false">Hold to Compare Original</button>
          <button class="btn btn-danger" id="rtResetBtn" type="button">Reset All</button>
        </div>
        <div class="editor-stage-wrap" id="rtCanvasStageWrap" style="margin-top:14px;cursor:default;">
          <canvas id="rtPreviewCanvas" role="img" aria-label="Photo retouch preview"></canvas>
        </div>
        <div class="row" style="margin-top:8px;align-items:center;">
          <label style="font-size:12.5px;color:var(--ink-soft);white-space:nowrap;">Zoom: <span id="rtZoomVal">100</span>%</label>
          <input type="range" id="rtZoomSlider" min="30" max="400" value="100" style="flex:1;">
        </div>

        <details class="pp-accordion" id="rtAccordionFace" open>
          <summary class="pp-accordion-summary">Skin &amp; Face</summary>
          <p class="editor-hint">Face-aware smoothing that protects eyes, brows, nose, mouth, and ears from being blurred \\u2014 detected automatically once a face is found.</p>
          <div id="rtFaceStatus" style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;"></div>
          <div class="qr-controls">
            <div class="ctrl"><label for="rtSkinSmooth">Skin Smoothing: <span id="rtSkinSmoothVal">0</span></label><input type="range" id="rtSkinSmooth" min="0" max="100" value="0"></div>
            <div class="ctrl"><label for="rtFaceBrighten">Face Brightening: <span id="rtFaceBrightenVal">0</span></label><input type="range" id="rtFaceBrighten" min="0" max="100" value="0"></div>
            <div class="ctrl"><label for="rtSkinTone">Skin Tone Warmth: <span id="rtSkinToneVal">0</span></label><input type="range" id="rtSkinTone" min="-50" max="50" value="0"></div>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionLight">
          <summary class="pp-accordion-summary">Light</summary>
          <div class="qr-controls">
            <div class="ctrl"><label for="rtExposure">Exposure: <span id="rtExposureVal">0</span></label><input type="range" id="rtExposure" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtBrightness">Brightness: <span id="rtBrightnessVal">0</span></label><input type="range" id="rtBrightness" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtContrast">Contrast: <span id="rtContrastVal">0</span></label><input type="range" id="rtContrast" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtHighlights">Highlights: <span id="rtHighlightsVal">0</span></label><input type="range" id="rtHighlights" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtShadows">Shadows: <span id="rtShadowsVal">0</span></label><input type="range" id="rtShadows" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtWhites">Whites: <span id="rtWhitesVal">0</span></label><input type="range" id="rtWhites" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtBlacks">Blacks: <span id="rtBlacksVal">0</span></label><input type="range" id="rtBlacks" min="-100" max="100" value="0"></div>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionColor">
          <summary class="pp-accordion-summary">Color</summary>
          <div class="qr-controls">
            <div class="ctrl"><label for="rtSaturation">Saturation: <span id="rtSaturationVal">0</span></label><input type="range" id="rtSaturation" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtVibrance">Vibrance: <span id="rtVibranceVal">0</span></label><input type="range" id="rtVibrance" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtTemperature">Temperature: <span id="rtTemperatureVal">0</span></label><input type="range" id="rtTemperature" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtTint">Tint: <span id="rtTintVal">0</span></label><input type="range" id="rtTint" min="-100" max="100" value="0"></div>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionDetail">
          <summary class="pp-accordion-summary">Detail</summary>
          <div class="qr-controls">
            <div class="ctrl"><label for="rtClarity">Clarity: <span id="rtClarityVal">0</span></label><input type="range" id="rtClarity" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtTexture">Texture: <span id="rtTextureVal">0</span></label><input type="range" id="rtTexture" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtDehaze">Dehaze: <span id="rtDehazeVal">0</span></label><input type="range" id="rtDehaze" min="-100" max="100" value="0"></div>
            <div class="ctrl"><label for="rtSharpness">Sharpness: <span id="rtSharpnessVal">0</span></label><input type="range" id="rtSharpness" min="0" max="100" value="0"></div>
            <div class="ctrl"><label for="rtNoiseReduction">Noise Reduction: <span id="rtNoiseReductionVal">0</span></label><input type="range" id="rtNoiseReduction" min="0" max="100" value="0"></div>
            <div class="ctrl"><label for="rtHdr">HDR Effect: <span id="rtHdrVal">0</span></label><input type="range" id="rtHdr" min="0" max="100" value="0"></div>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionBackground">
          <summary class="pp-accordion-summary">Background</summary>
          <p class="editor-hint">Uses AI subject detection to blur only the background, keeping your subject sharp \\u2014 a portrait bokeh effect. First use downloads a small AI model (a few MB, cached after).</p>
          <div class="qr-controls">
            <div class="ctrl"><label for="rtBgBlur">Background Blur: <span id="rtBgBlurVal">0</span></label><input type="range" id="rtBgBlur" min="0" max="100" value="0"></div>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionFilters">
          <summary class="pp-accordion-summary">Filters &amp; Presets</summary>
          <div class="row" style="flex-wrap:wrap;">
            <button class="btn btn-ghost" data-preset="none" type="button">None</button>
            <button class="btn btn-ghost" data-preset="natural" type="button">Natural</button>
            <button class="btn btn-ghost" data-preset="portrait" type="button">Professional Portrait</button>
            <button class="btn btn-ghost" data-preset="vintage" type="button">Vintage</button>
            <button class="btn btn-ghost" data-preset="cinematic" type="button">Cinematic</button>
          </div>
        </details>

        <details class="pp-accordion" id="rtAccordionExport">
          <summary class="pp-accordion-summary">Export</summary>
          <div class="row">
            <select id="rtExportFormat"><option value="png">PNG (lossless)</option><option value="jpeg" selected>JPG (max quality)</option><option value="webp">WEBP (max quality)</option></select>
          </div>
          <div class="row" style="margin-top:8px;">
            <button class="btn btn-primary" id="rtDownloadBtn" type="button" style="flex:1;">Download \\u2014 Original Resolution</button>
          </div>
          <div id="rtOutputDims" style="font-size:12.5px;color:var(--ink-soft);margin-top:8px;"></div>
        </details>
      </div>"""

IMAGE_TOOLS = [
    {"slug":"passport-photo-maker","name":"Passport & Visa Photo Maker","desc":"Auto-cropped passport and visa photos for 42 countries with real AI face detection.",
     "subtitle":"Professional passport and visa photos for 42 countries, with AI face detection and automatic sizing \u2014 entirely in your browser.",
     "meta":"Free passport and visa photo maker with AI face detection, background replacement, and correct sizing for USA, UK, Canada, Schengen, and 38 more countries. Runs entirely in your browser.",
     "category":"MultimediaApplication","form":PP_FORM,
     "intro":"Passport & Visa Photo Maker uses real AI face detection (the same MediaPipe technology behind ToolFlight's AI Background Remover and AI Photo Enhancer) to automatically position and size your photo to a selected country's typical passport or visa specification, with manual fine-tuning, background replacement, and automated compliance checks \u2014 all running locally in your browser. Photo requirements genuinely do change and vary by application type, so always verify current requirements on your country's official passport or embassy website before submitting \u2014 see our <a href=\"blog/passport-photo-rules-ai-editing.html\">full guide to passport photo rules and AI editing limitations</a> for more.",
     "features":["42 built-in country and document presets","Real AI face detection for automatic positioning","AI-powered background replacement, plus solid color options","Brightness, contrast, saturation, sharpness, and temperature adjustment","Automated checks for resolution, exposure, blur, and background uniformity","Printable photo sheets (4x6in, A4, Letter) with automatic duplication"],
     "benefits":["Nothing is uploaded \u2014 face detection and all processing run locally in your browser","No signup, no per-photo fee, no watermark","One tool for dozens of countries instead of hunting for country-specific templates"],
     "how_to":"Choose your country or document type, upload a photo (or use your camera), and the AI will automatically detect your face and position the crop. Fine-tune with the zoom and move controls, choose a background, adjust lighting if needed, then review the automated checks before downloading your photo or a printable sheet.",
     "faq":[("How do I make a passport photo online for free?","Choose your country from the dropdown, upload a clear, front-facing photo with a plain background, let the AI auto-position your face, review the automated checks, and download the result \u2014 no signup or payment required."),
            ("What are the US passport photo requirements?","2 x 2 inches (51 x 51mm), plain white or off-white background, with your head measuring 1 to 1\u215c inches (25-35mm) from chin to crown \u2014 roughly 50-69% of the frame height. This tool's US preset is built to that specification, cross-checked against multiple current sources, but always confirm against travel.state.gov before submitting."),
            ("What size is a UK passport photo?","35 x 45mm, a size shared by many other countries' passport and Schengen visa photos. This tool's UK preset uses that size by default."),
            ("What is the Schengen visa photo size?","35 x 45mm, the same widely-used ICAO-style format as most European passport photos."),
            ("Can I print passport photos at home?","Yes \u2014 use the Print Sheet PDF export, which tiles multiple copies onto a 4x6in, A4, or Letter page sized for standard photo paper. Home printing quality varies, so check your specific application's rules about home-printed photos."),
            ("Is this guaranteed to be accepted?","No tool can guarantee that, including this one \u2014 passport and visa photo rules are set and enforced by each country's government and can change at any time. This tool is a genuinely useful starting point built on commonly-documented specifications, not an official verification service. Always check your country's current official requirements before submitting."),
            ("Are these specifications a legal guarantee?","No. USA, UK, and Canada dimensions were individually checked against multiple current public sources in July 2026. The remaining presets follow well-established, widely-used conventions (mostly the standard 35\u00d745mm ICAO/Schengen format) that were not individually re-verified against each country's current official source this pass. Requirements change \u2014 always confirm with your country's official passport or embassy website before submitting."),
            ("Why shouldn't I use AI background replacement or enhancement for a US passport photo?","As of January 2026, the U.S. Department of State explicitly rejects passport photos that show any sign of digital alteration \u2014 including background replacement and lighting/skin adjustments, even subtle ones. This tool's background replacement and enhancement sliders are provided for other documents and general use, but we'd recommend not using them for a US passport or visa photo. Use a plain, evenly-lit background captured directly, and rely on cropping and sizing only. This tool cannot detect AI-alteration the way the official validator does \u2014 always verify against travel.state.gov before submitting."),
            ("Where can I read more about passport photo rules and AI editing limitations?","See our full guide, \"Passport Photo Rules Explained: Requirements, Backgrounds, and Why AI Editing Can Get You Rejected,\" which covers country-specific differences, background rules, and how to verify your photo before submitting.")],
     "related":["background-remover","image-crop"]},


    {"slug":"image-compress","name":"Compress Image","desc":"Shrink JPG/PNG/WEBP file size with a live before & after preview.",
     "subtitle":"Shrink JPG, PNG, and WEBP file size with a live before &amp; after preview — free, private, instant.",
     "meta":"Free online image compressor. Shrink JPG, PNG, and WEBP file size with a live before/after preview, right in your browser.",
     "category":"MultimediaApplication","form":COMPRESS_FORM,
     "intro":"Large photos slow down websites, fill up phone storage, and bounce out of email attachments. Compress Image shrinks JPG, PNG, and WEBP files right in your browser — no upload, no signup, no waiting on a server.",
     "features":["Live before/after preview with exact file sizes","Adjustable quality slider for fine control","Automatic resize for oversized images (2000px cap) to keep exports fast","Works with JPG, PNG, and WEBP up to 50MB"],
     "benefits":["Faster-loading web pages and lighter email attachments","Your image never leaves your device — nothing is uploaded anywhere","No account, no watermark, no daily limits"],
     "how_to":"Drop in an image, adjust the quality slider, and compare the before/after file sizes live. Download once you're happy with the tradeoff between size and quality.",
     "faq":[("Will compressing reduce image quality?","Some quality loss is inherent to compression, but the live before/after preview lets you find the point where file size drops significantly with no visible difference."),
            ("Does this upload my photos anywhere?","No — compression happens entirely in your browser using JavaScript. Your image is never transmitted to a server.")],
     "related":["image-crop","rotate-flip"]},

    {"slug":"ai-ocr","name":"AI OCR \u2014 Image & PDF to Text","desc":"Extract editable, searchable text from images and scanned PDFs with real OCR.",
     "subtitle":"Extract editable, searchable text from images and scanned PDFs \u2014 real OCR, running entirely in your browser.",
     "meta":"Free AI OCR tool. Extract text from JPG, PNG, WEBP images and scanned PDFs in English, Urdu, or Arabic, entirely in your browser \u2014 no upload, no signup.",
     "category":"BusinessApplication","form":OCR_FORM,
     "intro":"AI OCR reads the actual text in your images and scanned PDFs using Tesseract.js, a real open-source OCR engine \u2014 not a fake preview or a placeholder. Supports English, Urdu, and Arabic, individually or combined. For PDFs specifically, each page is rendered as an image first and then read with the same OCR engine, since Tesseract.js's own documentation states it doesn't read PDF files directly \u2014 this tool is upfront about that rather than pretending otherwise.",
     "features":["Real OCR text extraction, not a placeholder or preview","English, Urdu, and Arabic \u2014 select any combination","Works on images and multi-page scanned PDFs","Search within the extracted text","Copy to clipboard, or download as TXT or DOCX","Cancel a running extraction at any time"],
     "benefits":["Nothing is uploaded \u2014 the OCR engine and all processing run locally in your browser","No signup, no page limit imposed by a server","Genuinely editable output you can search, copy, and reuse"],
     "how_to":"Choose the language(s) present in your file, upload an image or PDF (drag and drop, browse, or paste from clipboard), then tap Extract Text. For PDFs, each page is processed in turn with its own progress. Copy the result, search within it, or download as TXT or DOCX.",
     "faq":[("Does this actually read PDF files directly?","Not literally \u2014 and we'd rather tell you that plainly than pretend otherwise. The OCR engine this tool uses (Tesseract.js) explicitly does not support PDF files in its own documentation. So for PDFs, each page is rendered as an image first, then read with the same real OCR engine used for images. The result is genuine extracted text either way."),
            ("How accurate is the text extraction?","Accuracy depends heavily on image quality \u2014 clean, high-resolution scans of printed text typically extract very well. Handwriting, low-resolution photos, unusual fonts, or unselected languages will reduce accuracy. This is a real limitation of OCR technology generally, not specific to this tool."),
            ("Why choose the language before extracting?","The OCR engine loads a language-specific model to recognize characters, so it needs to know which script(s) to expect. Selecting a language that isn't actually in your file \u2014 or missing one that is \u2014 will reduce accuracy."),
            ("Is my file uploaded anywhere?","No \u2014 both the OCR engine and all processing run entirely inside your browser. Your file is never sent to a server.")],
     "related":["magic-eraser","passport-photo-maker"]},

    {"slug":"ai-photo-retouch","name":"AI Photo Retouch & Beauty Editor","desc":"Professional portrait retouching \\u2014 skin smoothing, background blur, and a full Lightroom-style adjustment panel, entirely in your browser.",
     "subtitle":"Skin smoothing, background blur, and a complete set of tone, color, and detail adjustments \\u2014 face-aware, natural-looking, and processed entirely on your device.",
     "meta":"Free AI photo retouch and beauty editor: skin smoothing, face brightening, background blur, exposure, contrast, saturation, clarity, and more \\u2014 all in your browser, full resolution, nothing uploaded.",
     "category":"PhotoEditingApplication","form":RT_FORM,
     "intro":"AI Photo Retouch is a professional-grade portrait editor \\u2014 skin smoothing that automatically protects your eyes, brows, nose, mouth, and ears from being blurred, background blur for a natural bokeh effect, and a complete Lightroom-style panel covering light, color, and detail. Everything runs locally in your browser at full resolution; your photo is never uploaded anywhere.",
     "features":["Face-aware skin smoothing that detects and protects eyes, nose, mouth, and ears","AI background blur (portrait bokeh) using on-device subject detection","Full tone panel: exposure, brightness, contrast, highlights, shadows, whites, blacks","Full color panel: saturation, vibrance, temperature, tint","Detail panel: clarity, texture, dehaze, sharpness, noise reduction, HDR effect","One-tap filter presets: Natural, Professional Portrait, Vintage, Cinematic","Hold-to-compare against your original photo at any time","Pinch-to-zoom, drag-to-pan, double-tap zoom, and Fit to Screen on mobile","Export at full original resolution as PNG, JPG, or WEBP"],
     "benefits":["Your photo never leaves your device \\u2014 all processing happens in your browser","Face-aware smoothing keeps skin natural instead of plastic-looking","No account, no watermark, no upload limits beyond file size"],
     "how_to":"Upload a portrait photo, then use the accordion sections \\u2014 Skin & Face, Light, Color, Detail, Background, and Filters \\u2014 to adjust your photo. Only one section stays open at a time so sliders don't get bumped by accident while scrolling on mobile. Hold Compare to see your original, then download in your preferred format.",
     "faq":[("Will skin smoothing make my photo look fake or plastic?","Skin smoothing here is face-aware and limited by design \\u2014 it detects your eyes, eyebrows, nose, mouth, and ears and excludes them from the smoothing effect, and the strength is capped to stay natural rather than airbrushed. For the most natural result, keep the amount modest and check with Hold to Compare."),
            ("Does background blur work on any photo?","Background blur uses on-device AI subject detection, which works best on portraits with one clear subject reasonably separated from the background \\u2014 similar to the technology behind our AI Background Remover. Complex or busy scenes may blur less precisely."),
            ("Is this the same as your AI Photo Enhancer?","No \\u2014 AI Photo Enhancer is a simpler, faster one-click enhancement tool. This is a full manual retouching studio with a complete adjustment panel, face-aware skin smoothing, and background blur, for people who want direct control over every aspect of the edit."),
            ("Is my photo uploaded anywhere?","No. Every adjustment, and the AI models used for face and subject detection, run entirely in your browser. Your photo is never sent to a server.")],
     "related":["background-remover","ai-photo-enhancer"]},

    {"slug":"image-crop","name":"Image Crop Tool","desc":"Free crop or locked ratios (1:1, 16:9, 9:16), plus rotate.",
     "subtitle":"Free crop or locked ratios — 1:1, 16:9, 9:16 — plus rotate, all at full resolution.",
     "meta":"Free online image crop tool. Crop freely or lock to 1:1, 16:9, or 9:16 ratios, rotate, and download at full original resolution.",
     "category":"MultimediaApplication","form":CROP_FORM,
     "intro":"Whether you need a square profile photo, a 16:9 banner, or just want to trim a photo down, Image Crop Tool gives you a draggable crop box with locked-ratio presets — all processed locally in your browser.",
     "features":["Free-form crop or locked 1:1, 16:9, 9:16 ratios","Draggable corner handles and touch support","Rotate left/right before cropping","Live preview thumbnail of the exact crop"],
     "benefits":["Downloads are rebuilt at full original resolution, not the on-screen preview size","No account or watermark","Works identically on phone and desktop"],
     "how_to":"Upload an image, then drag the crop box or its corner handles to select the area you want. Choose Free for any shape, or lock to 1:1, 16:9, or 9:16. Use Rotate left/right before cropping if needed, then download.",
     "faq":[("Does cropping reduce image quality?","No — the download is reconstructed from your original file at full resolution, regardless of how the on-screen preview looks."),
            ("Can I crop on my phone?","Yes — dragging the crop box and handles works with touch as well as a mouse.")],
     "related":["image-compress","rotate-flip"]},

    {"slug":"rotate-flip","name":"Rotate & Flip Tool","desc":"Rotate 90°/180°/270° and flip horizontal or vertical.",
     "subtitle":"Rotate 90°, 180°, or 270°, and flip horizontal or vertical, with a live preview.",
     "meta":"Free online image rotate and flip tool. Rotate 90/180/270 degrees and flip horizontal or vertical, with instant live preview.",
     "category":"MultimediaApplication","form":ROTATE_FLIP_FORM,
     "intro":"Fix a sideways photo or create a mirrored version in one click. Rotate & Flip Tool applies rotation and flipping together with an instant live preview, no quality loss.",
     "features":["Rotate 90°, 180°, or 270° with one tap each","Flip horizontal and flip vertical, independently or combined","Live preview updates instantly","Reset button to start over"],
     "benefits":["No resampling means zero quality loss from rotating or flipping","Combine both operations in a single pass before downloading","Fully touch-friendly on mobile"],
     "how_to":"Upload an image, then tap Rotate 90°/180°/270° to turn it, or Flip horizontal/vertical to mirror it. The preview updates live — download once it looks right, or tap Reset to start over.",
     "faq":[("Can I combine rotate and flip?","Yes — rotation and flipping apply together, so you can straighten a sideways photo and mirror it in the same pass."),
            ("Does this reduce image quality?","No — rotating and flipping don't resample pixels the way resizing does, so quality is preserved.")],
     "related":["image-crop","image-watermark"]},

    {"slug":"background-remover","name":"AI Background Remover","desc":"Automatic AI-powered background removal, plus a full manual refine editor.",
     "subtitle":"Automatic AI background removal, plus a full manual editor for pixel-perfect results.",
     "meta":"Free AI background remover. Automatic background removal powered by machine learning, plus brush, eraser, magic wand, polygon, and lasso tools for manual refinement.",
     "category":"MultimediaApplication","form":BG_REMOVER_FORM,
     "intro":"AI Background Remover uses Google's MediaPipe machine learning model to detect and remove backgrounds automatically, then hands you a full manual editor — brush, eraser, magic wand, polygon, and lasso — to refine tricky edges like hair and fur.",
     "features":["One-click AI background detection and removal","Manual refine tools: Brush, Eraser, Edge Refine, Magic Wand, Polygon, Lasso","Zoom, pan, undo/redo, and a Before/After comparison slider","Export as PNG, JPG, or WEBP at full original resolution"],
     "benefits":["Nothing is ever uploaded — the AI model and all editing run locally in your browser","Auto-save protects your editing session if the page refreshes accidentally","Falls back to manual-only editing if AI processing ever fails, so your image is never lost"],
     "how_to":"Upload a photo, then tap Remove background (AI). The first use downloads a small AI model (a few MB, cached afterward), then the background is removed automatically using machine learning. Use the Refine tools below to fix any rough edges before exporting.",
     "faq":[("Is my photo uploaded anywhere?","No — the AI model runs entirely inside your browser using WebAssembly. Your image is never sent to a server."),
            ("What does this work best on?","People, animals, vehicles, furniture, and other common photo subjects. Very fine detail like flyaway hair may not be as precise as a specialized paid tool — that's exactly what the manual refine tools are for.")],
     "related":["background-changer","magic-eraser"]},

    {"slug":"background-changer","name":"Background Changer","desc":"Solid colors, gradients, or a custom background image.",
     "subtitle":"Place any transparent image on a solid color, gradient, or custom background.",
     "meta":"Free online background changer. Place a transparent PNG or WEBP image on a solid color, gradient, or custom background image, at full resolution.",
     "category":"MultimediaApplication","form":BG_CHANGER_FORM,
     "intro":"Already have a transparent-background image — from the AI Background Remover or elsewhere? Background Changer places it on a new solid color, gradient, or custom background image in seconds.",
     "features":["6 preset colors plus a full custom color picker","Adjustable linear gradient with angle control","Upload any image as a custom background","Direct handoff from the AI Background Remover"],
     "benefits":["Full-resolution output matching your uploaded transparent image","No account, no per-image cost","Works entirely offline in your browser"],
     "how_to":"Upload a transparent-background image, choose Solid color, Gradient, or Custom image, then adjust and download. Works seamlessly with the AI Background Remover's output.",
     "faq":[("Why does my image need transparency first?","This tool composites your subject onto a new background — it needs to know which pixels are the subject versus the old background, which is exactly what a transparent PNG/WEBP encodes."),
            ("Is the result full resolution?","Yes — the download matches the resolution of the transparent image you uploaded.")],
     "related":["background-remover","magic-eraser"]},

    {"slug":"ai-photo-enhancer","name":"AI Photo Enhancer","desc":"Natural photo enhancement with AI-targeted face smoothing \u2014 not a beauty filter.",
     "subtitle":"Natural photo enhancement with AI-targeted face smoothing \u2014 not a beauty filter, not plastic skin.",
     "meta":"Free AI photo enhancer. Natural brightness, contrast, color, and AI-targeted skin smoothing that never changes your face shape or identity.",
     "category":"MultimediaApplication","form":APE_FORM,
     "intro":"AI Photo Enhancer improves lighting, color, sharpness, and skin naturally \u2014 it never warps your face shape, changes your identity, or adds makeup. Face Enhancement uses a real AI model to detect exactly where your face is, so smoothing and clarity are applied precisely to skin while leaving eyes, eyebrows, and lips completely untouched.",
     "features":["Auto Enhance with real histogram-based brightness/contrast analysis","Individual sliders for brightness, contrast, saturation, sharpness, noise reduction, and skin smoothing","AI-targeted Face Enhancement that finds your face and protects eyes/lips/eyebrows from smoothing","White balance correction and HDR-like local tone mapping","Before/after comparison slider, zoom, pan, undo, and redo","Export as PNG, JPG, or WEBP with a quality selector, always at your original resolution"],
     "benefits":["Nothing is uploaded \u2014 the AI model and all image processing run locally in your browser","Natural results: smoothing blends real skin detail back in rather than flattening it, so skin never looks plastic","Full control via individual sliders, not just one all-or-nothing filter"],
     "how_to":"Upload a photo, then either tap Auto Enhance for a real histogram-based starting point, or adjust the sliders yourself. Turn on Face Enhancement so skin smoothing and eye clarity target your face precisely instead of the whole image. Compare before/after, then download at full resolution.",
     "faq":[("Is this really AI, or just filters?","Both, and we're specific about which is which: a real AI model (MediaPipe Face Landmarker, open-source, Apache 2.0) detects your face so smoothing and clarity effects are targeted accurately. The actual enhancement operations \u2014 brightness, contrast, color, sharpness, noise reduction \u2014 are genuine per-pixel image processing algorithms (not a deep-learning model, and not a simple decorative CSS filter either)."),
            ("Will this change how I look?","No \u2014 this tool never warps face shape, never changes identity, and never adds makeup. It only adjusts lighting, color, and smooths skin texture using your own real pixels \u2014 nothing is generated or replaced."),
            ("Why does skin smoothing sometimes look uneven without Face Enhancement on?","Without Face Enhancement, smoothing applies evenly across the whole image, including backgrounds and clothing. Turning it on limits smoothing to detected skin specifically, which usually looks more natural on portraits."),
            ("Is my photo uploaded anywhere?","No \u2014 both the AI face detection and all image processing run entirely inside your browser. Your photo is never sent to a server.")],
     "related":["magic-eraser","ai-image-upscaler"]},

    {"slug":"ai-image-upscaler","name":"AI Image Upscaler","desc":"Upscale images 2x or 4x with real AI \u2014 a browser-optimized model, not the largest available.",
     "subtitle":"Upscale images 2x or 4x with real AI super-resolution \u2014 a browser-optimized model chosen deliberately over the largest available option.",
     "meta":"Free AI image upscaler. Upscale JPG, PNG, or WEBP images 2x or 4x with real AI super-resolution (ESRGAN via UpscalerJS), entirely in your browser.",
     "category":"MultimediaApplication","form":UPS_FORM,
     "intro":"AI Image Upscaler increases resolution using a real AI super-resolution model (an ESRGAN-family network, run via UpscalerJS and TensorFlow.js) \u2014 not a simple resize or sharpen filter. By default it uses the lighter model tier that UpscalerJS's own maintainers specifically document as built for browser use, rather than automatically reaching for the largest, slowest option. A \u201cHigher quality (slower)\u201d toggle is available if you'd rather trade speed for a larger model.",
     "features":["Real AI super-resolution, not a basic resize or sharpen filter","2x and 4x scale options","Optional higher-quality model tier for slower, more detailed results","Before/after comparison slider","Paste directly from clipboard, drag and drop, or browse","Automatic safety limit to prevent browser memory crashes on very large images"],
     "benefits":["Nothing is uploaded \u2014 the AI model and all processing run locally in your browser","Fast default model choice means a quick first-use download instead of a long wait","No signup, no watermark"],
     "how_to":"Upload an image (drag and drop, browse, or paste from clipboard), choose 2x or 4x, then tap AI Upscale. The AI model downloads once on first use and is cached afterward. Compare before/after with the slider, then download your result.",
     "faq":[("Why not always use the highest-quality AI model?","The larger model tier is genuinely better on detailed images, but its own library documentation describes it as best suited to a machine with a GPU, with significant latency in a plain browser tab. Defaulting to it would mean a slow, frustrating experience for most people, so the lighter, browser-optimized tier is the default \u2014 the higher-quality option is there if you want to wait for it."),
            ("Why isn't 8x offered?","UpscalerJS's own model documentation states that its 8x model doesn't work reliably in a browser environment. Rather than offer something the library's own maintainers describe as unreliable, this tool caps out at 4x."),
            ("Will this fix a blurry or low-quality photo perfectly?","It will meaningfully improve sharpness, texture, and edge clarity on most photos, but it can't invent detail that was never captured \u2014 severely blurry or heavily compressed source images will still show their original limitations, just less harshly."),
            ("Is my photo uploaded anywhere?","No \u2014 both the AI model and all image processing run entirely inside your browser. Your photo is never sent to a server.")],
     "related":["magic-eraser","ai-ocr"]},

    {"slug":"magic-eraser","name":"Magic Eraser (AI Object Remover)","desc":"Brush over unwanted objects and remove them with real AI inpainting.",
     "subtitle":"Brush over unwanted people, objects, or blemishes and remove them with real AI inpainting \u2014 not a blur or clone trick.",
     "meta":"Free AI object remover. Brush over unwanted objects, people, or photobombers and remove them with genuine AI inpainting (LaMa), entirely in your browser.",
     "category":"MultimediaApplication","form":ME_FORM,
     "intro":"Photobombers, stray objects, power lines, blemishes \u2014 Magic Eraser removes them properly. Brush over what you want gone, and an open-source AI inpainting model (LaMa) reconstructs the area based on the surrounding image content, running entirely in your browser. This is genuine generative inpainting, the same category of technology behind tools like Adobe's Generative Fill, not a blur, clone-stamp, or flat color patch.",
     "features":["Adjustable brush size and soft edge for precise selections","Zoom, pan, and fit-to-screen for detailed work on large photos","Undo, redo, clear selection, and reset image","Before/after comparison with a draggable split slider","Download as PNG or JPG when you're done"],
     "benefits":["Real AI reconstruction of the erased area, not a copied patch or blur","Nothing is uploaded \u2014 the AI model and all processing run locally in your browser","Works alongside ToolFlight's other image tools \u2014 remove an object here, then crop, watermark, or compress the result"],
     "how_to":"Upload a photo, adjust the brush size, and paint over the object you want removed (shown highlighted in red). Tap Remove Object \u2014 the AI model downloads once on first use, then processes your selection. Compare the before/after with the slider, and download your result.",
     "faq":[("Is this really AI, or just a blur/clone tool?","Genuinely AI: this uses LaMa (Large Mask Inpainting), an open-source neural network trained specifically for this task, run through ONNX Runtime Web. It reconstructs the erased area based on the surrounding image content \u2014 it does not blur, clone nearby pixels, or fill with a flat color."),
            ("Why does the first use take a while?","The AI model is roughly 200MB and downloads once on first use. Your browser caches it afterward, so later uses on the same device are much faster."),
            ("Does this work on very large or very detailed objects?","It works best on small to medium objects with a reasonably plain or repeating surrounding background \u2014 like most inpainting tools, very large or highly detailed removals are more likely to show visible artifacts."),
            ("Is my photo uploaded anywhere?","No \u2014 both the AI model and all image processing run entirely inside your browser. Your photo is never sent to a server.")],
     "related":["background-remover","ai-photo-enhancer"]},
    {"slug":"image-watermark","name":"Image Watermark Tool","desc":"Add draggable text or logo watermarks with adjustable opacity.",
     "subtitle":"Add a draggable text or logo watermark, with adjustable size, color, and opacity.",
     "meta":"Free online image watermark tool. Add a text or logo watermark with adjustable size, color, opacity, and position, at full resolution.",
     "category":"MultimediaApplication","form":WATERMARK_FORM,
     "intro":"Protect your photos or brand your content with a text or logo watermark you can position exactly where you want — dragged directly onto the image or snapped to a preset corner.",
     "features":["Text watermark with adjustable font size and color","Logo watermark from any uploaded image","Opacity control and 5 position presets","Drag the watermark directly on the canvas for precise placement"],
     "benefits":["Full-resolution output, matching your original image size","No recurring cost per image, unlike many watermarking services","Runs entirely offline in your browser"],
     "how_to":"Upload an image, choose text or logo watermark, adjust size/color/opacity, then either tap a position preset or drag the watermark directly on the image to place it exactly where you want.",
     "faq":[("Can I use my own logo?","Yes — switch to \"Logo watermark\" and upload any PNG, JPG, or WEBP image; a transparent PNG logo works best."),
            ("Is the watermark placed at full resolution?","Yes — the downloaded file is rebuilt from your original image at its full original size.")],
     "related":["image-crop","image-compress"]},

]
IMG_TOOL_BY_SLUG = {t["slug"]: t for t in IMAGE_TOOLS}

def build_image_tool_page(tool):
    import json as _json
    breadcrumb = f'''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <a href="image-tools.html" style="color:var(--ink-soft);text-decoration:none;">Image Tools</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">{tool["name"]}</span>
</nav>'''

    features_html = "".join(f'<li>{f}</li>' for f in tool["features"])
    benefits_html = "".join(f'<li>{b}</li>' for b in tool["benefits"])
    faq_html = ""
    faq_items = []
    for q, a in tool["faq"]:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for rslug in tool["related"]:
        rt = IMG_TOOL_BY_SLUG[rslug]
        related_html += f'      <a href="{rslug}.html" class="blog-card"><span class="blog-tag">Image Tool</span><h3>{rt["name"]}</h3><p>{rt["desc"]}</p></a>\n'

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "Image Tools", "item": "https://toolflight.com/image-tools.html"},
            {"@type": "ListItem", "position": 3, "name": tool["name"], "item": f'https://toolflight.com/{tool["slug"]}.html'},
        ]
    }
    webpage_schema = {
        "@context": "https://schema.org", "@type": "WebPage",
        "name": tool["name"], "description": tool["meta"], "url": f'https://toolflight.com/{tool["slug"]}.html'
    }
    software_schema = {
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        "name": tool["name"], "applicationCategory": tool["category"], "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>{tool["name"]}</h1>
  <p class="subtitle">{tool["subtitle"]}</p>
</div>

<div class="container">
  <div class="row" style="margin:0 0 18px;">
    <a href="image-tools.html" class="btn btn-back" style="flex:0;min-width:auto;">Back to Image Tools</a>
  </div>

  <div class="workspace">
      {tool["form"]}
  </div>

  <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border);max-width:720px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">About the {tool["name"]}</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["intro"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Features</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{features_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">How to Use</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["how_to"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Benefits</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{benefits_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Frequently Asked Questions</h2>
{faq_html}    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Related Tools</h2>
    <div class="related-grid">
{related_html}    </div>
  </div>
</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(webpage_schema)}</script>
<script type="application/ld+json">{_json.dumps(software_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

# ============ CALCULATORS ============
calc_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> 9 free calculators</span>
  <h1>Calculators</h1>
  <p class="subtitle">Everyday calculators — free, private, no signup. Each one has its own page.</p>
</div>

<div class="container">
  <div class="category-hub-grid">
    {category_hub_card("age-calculator.html", ICON_AGE, "Age Calculator", "Find your exact age in years, months, and days.", cta="Open calculator")}
    {category_hub_card("bmi-calculator.html", ICON_BMI, "BMI Calculator", "Calculate your Body Mass Index from height and weight.", cta="Open calculator")}
    {category_hub_card("percentage-calculator.html", ICON_CURRENCY, "Percentage Calculator", "X% of Y, percent of a total, increase, decrease, and difference.", cta="Open calculator")}
    {category_hub_card("discount-calculator.html", ICON_LOAN, "Discount Calculator", "Final price and amount saved, calculated instantly.", cta="Open calculator")}
    {category_hub_card("emi-calculator.html", ICON_LOAN, "EMI / Loan Calculator", "Monthly payment, total interest, and total payment for any loan.", cta="Open calculator")}
    {category_hub_card("gst-calculator.html", ICON_GST, "GST / VAT Calculator", "Add or remove tax from any amount instantly.", cta="Open calculator")}
    {category_hub_card("scientific-calculator.html", ICON_SCIENTIFIC, "Scientific Calculator", "Trig, logs, powers, memory functions, and full keyboard support.", cta="Open calculator")}
    {category_hub_card("unit-converter.html", ICON_UNIT, "Unit Converter", "Length, weight, temperature, area, volume, speed, time, and data.", cta="Open calculator")}
    {category_hub_card("currency-converter.html", ICON_XCHANGE, "Currency Converter", "Live exchange rates for 25+ currencies, updated daily.", cta="Open calculator")}
  </div>
</div>
"""

# ============ STANDALONE CALCULATOR PAGES ============
# Core form markup below is copied verbatim from the working embedded version —
# same element IDs/classes, so js/app.js needs zero changes to power these pages.

AGE_FORM = """<div class="view-title"><h2>Age Calculator</h2></div>
      <span class="field-label">Date of birth</span>
      <input type="date" id="ageDobInput">
      <span class="field-label" style="margin-top:14px;">Calculate age as of</span>
      <input type="date" id="ageAsOfInput">
      <div class="row">
        <button class="btn btn-primary" id="ageCalcBtn" style="flex:1;">Calculate age</button>
        <button class="btn btn-danger" id="ageClearBtn">Clear</button>
      </div>
      <div class="result-grid hidden" id="ageResultBox">
        <div class="result-stat"><div class="num" id="ageYears">0</div><div class="label">Years</div></div>
        <div class="result-stat"><div class="num" id="ageMonths">0</div><div class="label">Months</div></div>
        <div class="result-stat"><div class="num" id="ageDays">0</div><div class="label">Days</div></div>
      </div>
      <p id="ageTotalDaysLine" class="hidden" style="font-size:12.5px;color:var(--ink-soft);margin-top:12px;">Total days lived: <strong id="ageTotalDays">0</strong></p>"""

BMI_FORM = """<div class="view-title"><h2>BMI Calculator</h2></div>
      <div class="unit-toggle bmi-unit-toggle">
        <button class="active" data-unit="metric" type="button">Metric (cm/kg)</button>
        <button data-unit="imperial" type="button">Imperial (ft/lb)</button>
      </div>

      <div id="bmiMetricFields" style="margin-top:14px;">
        <span class="field-label">Height (cm)</span>
        <input type="number" id="bmiHeightCm" placeholder="e.g. 170" min="1" step="0.1">
        <span class="field-label" style="margin-top:14px;">Weight (kg)</span>
        <input type="number" id="bmiWeightKg" placeholder="e.g. 65" min="1" step="0.1">
      </div>
      <div id="bmiImperialFields" class="hidden" style="margin-top:14px;">
        <span class="field-label">Height</span>
        <div class="row" style="margin-top:0;">
          <input type="number" id="bmiHeightFt" placeholder="Feet" min="0" step="1">
          <input type="number" id="bmiHeightIn" placeholder="Inches" min="0" max="11" step="1">
        </div>
        <span class="field-label" style="margin-top:14px;">Weight (lb)</span>
        <input type="number" id="bmiWeightLb" placeholder="e.g. 140" min="1" step="0.1">
      </div>

      <div class="row">
        <button class="btn btn-primary" id="bmiCalcBtn" style="flex:1;">Calculate BMI</button>
        <button class="btn btn-danger" id="bmiClearBtn">Clear</button>
      </div>

      <div id="bmiResultBox" class="hidden" style="text-align:center;margin-top:18px;">
        <div style="font-size:32px;font-weight:800;letter-spacing:-.02em;" id="bmiValue">0.0</div>
        <span class="bmi-badge" id="bmiCategoryBadge">—</span>
        <p style="font-size:11.5px;color:var(--ink-soft);margin-top:12px;">BMI is a general screening measure and doesn't account for muscle mass, bone density, or body composition. It isn't a diagnosis.</p>
      </div>"""

PERCENTAGE_FORM = """<div class="view-title"><h2>Percentage Calculator</h2></div>
      <div class="unit-toggle pct-mode-toggle">
        <button class="active" data-mode="of" type="button">X% of Y</button>
        <button data-mode="percentOf" type="button">X is what % of Y</button>
        <button data-mode="increase" type="button">% Increase</button>
        <button data-mode="decrease" type="button">% Decrease</button>
        <button data-mode="difference" type="button">% Difference</button>
      </div>
      <span class="field-label" id="pctLabelX" style="margin-top:14px;">Percentage (%)</span>
      <input type="number" id="pctX" placeholder="e.g. 20">
      <span class="field-label" id="pctLabelY" style="margin-top:14px;">Of value</span>
      <input type="number" id="pctY" placeholder="e.g. 250">
      <div class="row">
        <button class="btn btn-primary" id="pctCalcBtn" style="flex:1;">Calculate</button>
        <button class="btn btn-danger" id="pctClearBtn">Clear</button>
      </div>
      <div id="pctResultBox" class="hidden" style="text-align:center;margin-top:18px;">
        <div style="font-size:30px;font-weight:800;letter-spacing:-.02em;" id="pctValue">0</div>
        <p style="font-size:12.5px;color:var(--ink-soft);margin-top:8px;" id="pctFormula"></p>
      </div>"""

DISCOUNT_FORM = """<div class="view-title"><h2>Discount Calculator</h2></div>
      <span class="field-label">Original price</span>
      <input type="number" id="discOriginal" placeholder="e.g. 100" min="0" step="0.01">
      <span class="field-label" style="margin-top:14px;">Discount %</span>
      <input type="number" id="discPercent" placeholder="e.g. 20" min="0" max="100" step="0.1">
      <div class="result-grid">
        <div class="result-stat"><div class="num" id="discFinal">0.00</div><div class="label">Final Price</div></div>
        <div class="result-stat"><div class="num" id="discSaved">0.00</div><div class="label">Amount Saved</div></div>
      </div>"""

EMI_FORM = """<div class="view-title"><h2>EMI / Loan Calculator</h2></div>
      <span class="field-label">Loan amount</span>
      <input type="number" id="emiAmount" placeholder="e.g. 20000" min="0" step="0.01">
      <span class="field-label" style="margin-top:14px;">Interest rate (annual %)</span>
      <input type="number" id="emiRate" placeholder="e.g. 8.5" min="0" step="0.01">
      <span class="field-label" style="margin-top:14px;">Loan term</span>
      <div class="row" style="margin-top:0;">
        <input type="number" id="emiTerm" placeholder="e.g. 5" min="0" step="1">
        <select id="emiTermUnit">
          <option value="years" selected>Years</option>
          <option value="months">Months</option>
        </select>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="emiCalcBtn" style="flex:1;">Calculate EMI</button>
        <button class="btn btn-danger" id="emiResetBtn">Reset</button>
      </div>
      <div class="result-grid hidden" id="emiResultBox">
        <div class="result-stat"><div class="num" id="emiMonthly">0.00</div><div class="label">Monthly EMI</div></div>
        <div class="result-stat"><div class="num" id="emiInterest">0.00</div><div class="label">Total Interest</div></div>
        <div class="result-stat"><div class="num" id="emiTotal">0.00</div><div class="label">Total Payment</div></div>
      </div>"""

GST_FORM = """<div class="view-title"><h2>GST / VAT Calculator</h2></div>
      <div class="unit-toggle gst-mode-toggle">
        <button class="active" data-mode="add" type="button">Add GST/VAT</button>
        <button data-mode="remove" type="button">Remove GST/VAT</button>
      </div>
      <span class="field-label" style="margin-top:14px;" id="gstAmountLabel">Original amount</span>
      <input type="number" id="gstAmount" placeholder="e.g. 100" min="0" step="0.01">
      <span class="field-label" style="margin-top:14px;">Tax percentage (%)</span>
      <input type="number" id="gstPercent" placeholder="e.g. 18" min="0" step="0.01">
      <div class="row">
        <button class="btn btn-primary" id="gstCalcBtn" style="flex:1;">Calculate</button>
        <button class="btn btn-danger" id="gstResetBtn">Reset</button>
      </div>
      <div class="result-grid hidden" id="gstResultBox">
        <div class="result-stat"><div class="num" id="gstTaxAmount">0.00</div><div class="label">Tax Amount</div></div>
        <div class="result-stat"><div class="num" id="gstFinalAmount">0.00</div><div class="label">Final Amount</div></div>
      </div>"""

SCIENTIFIC_FORM = """<div class="view-title"><h2>Scientific Calculator</h2></div>
      <div class="sci-display" id="sciDisplay">0</div>
      <div class="unit-toggle" id="sciAngleToggle" style="margin-top:10px;">
        <button class="active" data-angle="deg" type="button">DEG</button>
        <button data-angle="rad" type="button">RAD</button>
      </div>
      <div class="sci-grid" id="sciGrid">
        <button class="sci-btn sci-mem" data-action="mc" type="button">MC</button>
        <button class="sci-btn sci-mem" data-action="mr" type="button">MR</button>
        <button class="sci-btn sci-mem" data-action="mplus" type="button">M+</button>
        <button class="sci-btn sci-mem" data-action="mminus" type="button">M−</button>

        <button class="sci-btn" data-insert="sin(" type="button">sin</button>
        <button class="sci-btn" data-insert="cos(" type="button">cos</button>
        <button class="sci-btn" data-insert="tan(" type="button">tan</button>
        <button class="sci-btn" data-insert="sqrt(" type="button">√</button>

        <button class="sci-btn" data-insert="log(" type="button">log</button>
        <button class="sci-btn" data-insert="ln(" type="button">ln</button>
        <button class="sci-btn" data-insert="PI" type="button">π</button>
        <button class="sci-btn" data-insert="E" type="button">e</button>

        <button class="sci-btn" data-insert="(" type="button">(</button>
        <button class="sci-btn" data-insert=")" type="button">)</button>
        <button class="sci-btn sci-op" data-action="clear" type="button">C</button>
        <button class="sci-btn sci-op" data-action="backspace" type="button">⌫</button>

        <button class="sci-btn" data-insert="7" type="button">7</button>
        <button class="sci-btn" data-insert="8" type="button">8</button>
        <button class="sci-btn" data-insert="9" type="button">9</button>
        <button class="sci-btn sci-op" data-insert="/" type="button">÷</button>

        <button class="sci-btn" data-insert="4" type="button">4</button>
        <button class="sci-btn" data-insert="5" type="button">5</button>
        <button class="sci-btn" data-insert="6" type="button">6</button>
        <button class="sci-btn sci-op" data-insert="*" type="button">×</button>

        <button class="sci-btn" data-insert="1" type="button">1</button>
        <button class="sci-btn" data-insert="2" type="button">2</button>
        <button class="sci-btn" data-insert="3" type="button">3</button>
        <button class="sci-btn sci-op" data-insert="-" type="button">−</button>

        <button class="sci-btn" data-insert="0" type="button">0</button>
        <button class="sci-btn" data-insert="." type="button">.</button>
        <button class="sci-btn" data-insert="^" type="button">^</button>
        <button class="sci-btn sci-op" data-insert="+" type="button">+</button>

        <button class="sci-btn" data-insert="%" type="button">%</button>
        <button class="sci-btn sci-equals" data-action="equals" type="button" style="grid-column:span 3;">=</button>
      </div>"""

UNIT_FORM = """<div class="view-title"><h2>Unit Converter</h2></div>
      <span class="field-label">Category</span>
      <select id="unitCategory">
        <option value="length" selected>Length</option>
        <option value="weight">Weight</option>
        <option value="temperature">Temperature</option>
        <option value="area">Area</option>
        <option value="volume">Volume</option>
        <option value="speed">Speed</option>
        <option value="time">Time</option>
        <option value="data">Data Storage</option>
      </select>

      <div class="qr-controls" style="margin-top:14px;">
        <div class="ctrl"><label>From</label><select id="unitFromSelect"></select></div>
        <div class="ctrl"><label>To</label><select id="unitToSelect"></select></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-ghost" id="unitSwapBtn" type="button" style="flex:0;min-width:auto;">⇅ Swap</button>
      </div>

      <span class="field-label" style="margin-top:14px;">Value</span>
      <input type="number" id="unitFromValue" placeholder="Enter value" value="1">

      <div class="result-grid" style="grid-template-columns:1fr;margin-top:16px;">
        <div class="result-stat"><div class="num" id="unitToValue">—</div><div class="label" id="unitToLabel">Result</div></div>
      </div>"""

CURRENCY_FORM = """<div class="view-title"><h2>Currency Converter</h2></div>
      <span class="field-label">Amount</span>
      <input type="number" id="curAmount" placeholder="e.g. 100" value="1" min="0" step="0.01">

      <div class="qr-controls" style="margin-top:14px;">
        <div class="ctrl"><label>From</label><select id="curFrom"></select></div>
        <div class="ctrl"><label>To</label><select id="curTo"></select></div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-ghost" id="curSwapBtn" type="button" style="flex:0;min-width:auto;">⇅ Swap</button>
      </div>

      <div class="result-grid" style="grid-template-columns:1fr;margin-top:16px;">
        <div class="result-stat"><div class="num" id="curResult">—</div><div class="label" id="curResultLabel">Converted amount</div></div>
      </div>
      <p id="curStatus" style="font-size:12px;color:var(--ink-soft);margin-top:10px;text-align:center;">Loading exchange rates…</p>"""

CALCULATORS = [
    {"slug":"age-calculator","name":"Age Calculator","desc":"Find your exact age in years, months, and days.",
     "subtitle":"Find your exact age in years, months, and days — free, private, instant.",
     "meta":"Free online age calculator. Find your exact age in years, months, and days, or calculate your age as of any date.",
     "category":"UtilitiesApplication","form":AGE_FORM,
     "how_to":"Enter your date of birth, and optionally change \"Calculate age as of\" to any other date, then tap Calculate age to see your exact age broken down into years, months, and days, plus total days lived.",
     "faq":[("How is my age calculated?","We count full years, then full months, then the remaining days between your date of birth and the \"as of\" date — the same method used by most official age calculators."),
            ("Can I find my age on a specific past or future date?","Yes — change the \"Calculate age as of\" field to any date to see your age at that point in time.")],
     "related":["bmi-calculator","percentage-calculator"]},

    {"slug":"bmi-calculator","name":"BMI Calculator","desc":"Calculate your Body Mass Index from height and weight.",
     "subtitle":"Calculate your Body Mass Index from height and weight — metric or imperial.",
     "meta":"Free online BMI calculator. Calculate your Body Mass Index from height and weight in metric or imperial units, with category breakdown.",
     "category":"HealthApplication","form":BMI_FORM,
     "how_to":"Choose Metric or Imperial units, enter your height and weight, then tap Calculate BMI to see your Body Mass Index and its standard category.",
     "faq":[("What do the BMI categories mean?","Under 18.5 is Underweight, 18.5–24.9 is Normal weight, 25–29.9 is Overweight, and 30+ is Obesity, using the standard WHO ranges."),
            ("Is BMI accurate for everyone?","BMI is a general screening measure and doesn't account for muscle mass, bone density, or body composition — it isn't a diagnosis.")],
     "related":["age-calculator","percentage-calculator"]},

    {"slug":"percentage-calculator","name":"Percentage Calculator","desc":"X% of Y, percent of a total, increase, decrease, and difference.",
     "subtitle":"X% of Y, percent of a total, increase, decrease, and difference — all in one tool.",
     "meta":"Free online percentage calculator. Calculate X% of Y, what percent X is of Y, percentage increase, decrease, and difference.",
     "category":"UtilitiesApplication","form":PERCENTAGE_FORM,
     "how_to":"Choose a mode — X% of Y, X is what % of Y, % Increase, % Decrease, or % Difference — enter your two values, then tap Calculate to see the formula and result.",
     "faq":[("What's the difference between % Increase and % Difference?","% Increase/Decrease measures change relative to the original value; % Difference measures the gap relative to the average of both values, useful when there's no clear \"original\"."),
            ("Can I use negative numbers?","Yes, though results in Increase/Decrease mode are most meaningful when the original value isn't zero.")],
     "related":["discount-calculator","gst-calculator"]},

    {"slug":"discount-calculator","name":"Discount Calculator","desc":"Final price and amount saved, calculated instantly.",
     "subtitle":"Final price and amount saved, calculated instantly as you type.",
     "meta":"Free online discount calculator. Enter the original price and discount percentage to instantly see the final price and amount saved.",
     "category":"UtilitiesApplication","form":DISCOUNT_FORM,
     "how_to":"Enter the original price and the discount percentage — the final price and amount saved update instantly as you type, no button needed.",
     "faq":[("Does this work for stacked or multiple discounts?","This calculates a single discount pass; for stacked discounts, use this calculator's Final Price as the Original Price for the next discount."),
            ("Can I calculate the discount percentage from two prices instead?","This tool goes from percentage to price; for the reverse, use the Percentage Calculator's \"X is what % of Y\" mode with the amount saved and original price.")],
     "related":["percentage-calculator","gst-calculator"]},

    {"slug":"emi-calculator","name":"EMI / Loan Calculator","desc":"Monthly payment, total interest, and total payment for any loan.",
     "subtitle":"Monthly EMI, total interest, and total payment for any loan amount and term.",
     "meta":"Free online EMI and loan calculator. Calculate your monthly EMI, total interest, and total payment using the standard reducing-balance formula.",
     "category":"FinanceApplication","form":EMI_FORM,
     "how_to":"Enter the loan amount, annual interest rate, and loan term in months or years, then tap Calculate EMI to see your monthly payment, total interest, and total amount payable over the life of the loan.",
     "faq":[("How is EMI calculated?","Using the standard reducing-balance formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the principal, r is the monthly interest rate, and n is the number of monthly installments."),
            ("Does this include fees or insurance?","No — this calculates principal and interest only. Add any separate fees or insurance premiums manually.")],
     "related":["discount-calculator","gst-calculator","currency-converter"]},

    {"slug":"gst-calculator","name":"GST / VAT Calculator","desc":"Add or remove tax from any amount instantly.",
     "subtitle":"Add or remove GST/VAT from any amount instantly.",
     "meta":"Free online GST and VAT calculator. Add or remove tax from any amount instantly, for any country's tax rate.",
     "category":"FinanceApplication","form":GST_FORM,
     "how_to":"Enter the amount and tax percentage, choose whether to add or remove tax, then tap Calculate.",
     "faq":[("What's the difference between adding and removing tax?","\"Add\" treats your amount as the pre-tax price and calculates the tax-inclusive total. \"Remove\" treats your amount as already including tax and extracts the original pre-tax price."),
            ("Does this work for any country's tax rate?","Yes — enter whatever percentage applies in your region; the math is the same regardless of what the tax is called locally.")],
     "related":["percentage-calculator","discount-calculator","emi-calculator"]},

    {"slug":"scientific-calculator","name":"Scientific Calculator","desc":"Trig, logs, powers, memory functions, and full keyboard support.",
     "subtitle":"Trig, logs, powers, memory functions, and full keyboard support.",
     "meta":"Free online scientific calculator with trigonometry, logarithms, powers, memory functions, and full keyboard support.",
     "category":"UtilitiesApplication","form":SCIENTIFIC_FORM,
     "how_to":"Tap the number and operator buttons to build an expression, or type directly using your keyboard. Use the DEG/RAD toggle to control how sin, cos, and tan interpret angles, then press = to evaluate.",
     "faq":[("Does this support keyboard input?","Yes — digits, + − * /, parentheses, Enter (=), Backspace, and Escape (clear) all work from your keyboard."),
            ("Degrees or radians?","Use the DEG/RAD toggle above the display — it defaults to degrees.")],
     "related":["percentage-calculator","unit-converter"]},

    {"slug":"unit-converter","name":"Unit Converter","desc":"Length, weight, temperature, area, volume, speed, time, and data.",
     "subtitle":"Length, weight, temperature, area, volume, speed, time, and data storage — 8 categories.",
     "meta":"Free online unit converter for length, weight, temperature, area, volume, speed, time, and data storage, with instant conversion.",
     "category":"UtilitiesApplication","form":UNIT_FORM,
     "how_to":"Pick a category, choose your From and To units, then type a value — the result updates instantly as you type.",
     "faq":[("How many categories are supported?","Eight: Length, Weight, Temperature, Area, Volume, Speed, Time, and Data Storage."),
            ("Are the conversions accurate?","Yes, using standard conversion factors; temperature uses the correct Celsius/Fahrenheit/Kelvin formulas rather than a simple multiplier.")],
     "related":["scientific-calculator","currency-converter"]},

    {"slug":"currency-converter","name":"Currency Converter","desc":"Live exchange rates for 25+ currencies, updated daily.",
     "subtitle":"Live exchange rates for 25+ currencies, updated daily via the free Frankfurter API.",
     "meta":"Free online currency converter with live daily exchange rates for 25+ currencies. No signup, no API key required.",
     "category":"FinanceApplication","form":CURRENCY_FORM,
     "how_to":"Enter an amount, choose your From and To currencies, and the converted amount updates automatically using current exchange rates.",
     "faq":[("Where do the exchange rates come from?","From the free, open Frankfurter API, which publishes daily reference rates sourced from the European Central Bank."),
            ("How often do rates update?","Once per working day — this is a reliable daily reference rate, not real-time tick-by-tick trading data.")],
     "related":["emi-calculator","unit-converter"]},
]
CALC_BY_SLUG = {c["slug"]: c for c in CALCULATORS}

def build_calculator_page(calc):
    import json as _json
    breadcrumb = f'''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <a href="calculators.html" style="color:var(--ink-soft);text-decoration:none;">Calculators</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">{calc["name"]}</span>
</nav>'''

    faq_html = ""
    faq_items = []
    for q, a in calc["faq"]:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for rslug in calc["related"]:
        rc = CALC_BY_SLUG[rslug]
        related_html += f'      <a href="{rslug}.html" class="blog-card"><span class="blog-tag">Calculator</span><h3>{rc["name"]}</h3><p>{rc["desc"]}</p></a>\n'

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "Calculators", "item": "https://toolflight.com/calculators.html"},
            {"@type": "ListItem", "position": 3, "name": calc["name"], "item": f'https://toolflight.com/{calc["slug"]}.html'},
        ]
    }
    software_schema = {
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        "name": calc["name"], "applicationCategory": calc["category"], "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>{calc["name"]}</h1>
  <p class="subtitle">{calc["subtitle"]}</p>
</div>

<div class="container">
  <div class="row" style="margin:0 0 18px;">
    <a href="calculators.html" class="btn btn-back" style="flex:0;min-width:auto;">Back to Calculators</a>
  </div>

  <div class="workspace">
      {calc["form"]}
  </div>

  <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border);max-width:720px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">How to use the {calc["name"]}</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{calc["how_to"]}</p>
    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Frequently Asked Questions</h2>
{faq_html}    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Related Calculators</h2>
    <div class="related-grid">
{related_html}    </div>
  </div>
</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(software_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

# ============ FINANCE TOOLS ============
finance_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> New category</span>
  <h1>Finance Tools</h1>
  <p class="subtitle">Currency conversion and loan calculations — coming to this category soon.</p>
</div>

<div class="container" id="tools">
  <div class="workspace">
    <div class="empty-state">No finance tools are live yet on ToolFlight. We'd rather leave this page honest than show a button that doesn't work — check back soon, or visit our other categories in the meantime.</div>
  </div>
</div>
"""

# ============ SEO TOOLS ============
seo_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> 4 free SEO &amp; web tools</span>
  <h1>SEO &amp; Web Tools</h1>
  <p class="subtitle">Keyword research, QR codes, robots.txt, and meta tags for site owners — free, private, no signup. Each one has its own page.</p>
</div>

<div class="container">
  <div class="category-hub-grid">
    {category_hub_card("ai-keyword-generator.html", ICON_KEYWORDS, "AI Keyword Generator", "AI-assisted keyword research: 20 keyword and content-idea categories.", cta="Open tool")}
    {category_hub_card("qr-code-generator.html", ICON_QR, "QR Generator", "Custom colors, size, and PNG or SVG export.", cta="Open tool")}
    {category_hub_card("robots-txt-generator.html", ICON_ROBOTS, "Robots.txt Generator", "Build a valid robots.txt with allow/disallow rules and a sitemap line.", cta="Open tool")}
    {category_hub_card("meta-tag-generator.html", ICON_META, "Meta Tag Generator", "Title, description, canonical, Open Graph, and Twitter Card tags.", cta="Open tool")}
  </div>
</div>
"""

ai_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> 1 free AI tool</span>
  <h1>AI Tools</h1>
  <p class="subtitle">AI-assisted writing tools for ToolFlight — free, private, honest about what does and doesn't currently run. Each one has its own page.</p>
</div>

<div class="container">
  <div class="category-hub-grid">
    {category_hub_card("ai-email-writer.html", ICON_AI_EMAIL, "AI Email Writer", "A real email-writing interface and provider architecture.", cta="Open tool")}
  </div>
</div>
"""

# ============ STANDALONE SEO TOOL PAGES ============
# Core form markup below is copied verbatim from the working embedded version —
# same element IDs/classes, so js/app.js needs zero changes to power these pages.

QR_FORM = """<div class="view-title"><h2>QR Generator</h2></div>
      <span class="field-label">Link or text to encode</span>
      <input type="text" id="qrInput" placeholder="https://example.com or any text">
      <div class="qr-controls">
        <div class="ctrl"><label>Foreground</label><input type="color" id="qrFg" value="#151726"></div>
        <div class="ctrl"><label>Background</label><input type="color" id="qrBg" value="#ffffff"></div>
        <div class="ctrl" style="grid-column:span 2;">
          <label>Size: <span id="qrSizeVal">240</span>px</label>
          <input type="range" id="qrSize" min="120" max="480" value="240">
        </div>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="qrGenBtn" style="flex:1;">Generate code</button>
        <button class="btn btn-danger" id="qrClearBtn">Clear</button>
      </div>
      <div class="viewfinder" id="qrViewfinder"><span class="placeholder-text">Your QR code will appear here</span></div>
      <div class="row hidden" id="qrDownloadRow">
        <button class="btn btn-success" id="qrDownloadPngBtn">Download PNG</button>
        <button class="btn btn-success" id="qrDownloadSvgBtn">Download SVG</button>
      </div>"""

ROBOTS_FORM = """<div class="view-title"><h2>Robots.txt Generator</h2></div>
      <span class="field-label">Website URL</span>
      <input type="text" id="robotsWebsiteUrl" placeholder="https://example.com">
      <span class="field-label" style="margin-top:14px;">Sitemap URL</span>
      <input type="text" id="robotsSitemapUrl" placeholder="https://example.com/sitemap.xml">

      <span class="field-label" style="margin-top:16px;">Rules</span>
      <div id="robotsRulesList"></div>
      <div class="row">
        <button class="btn btn-ghost" id="robotsAddRuleBtn" style="flex:0;min-width:auto;">+ Add rule</button>
      </div>

      <span class="field-label" style="margin-top:18px;">Preview</span>
      <pre class="code-preview" id="robotsPreview"></pre>
      <div class="row">
        <button class="btn btn-primary" id="robotsCopyBtn" style="flex:1;">Copy</button>
        <button class="btn btn-success" id="robotsDownloadBtn">Download robots.txt</button>
      </div>"""

META_FORM = """<div class="view-title"><h2>Meta Tag Generator</h2></div>
      <span class="field-label">Title</span>
      <input type="text" id="metaTitle" placeholder="Page title">
      <span class="field-label" style="margin-top:14px;">Description</span>
      <input type="text" id="metaDescription" placeholder="Page description">
      <span class="field-label" style="margin-top:14px;">Keywords (comma separated)</span>
      <input type="text" id="metaKeywords" placeholder="keyword one, keyword two">

      <div class="qr-controls" style="margin-top:14px;">
        <div class="ctrl"><label>Canonical URL</label><input type="text" id="metaCanonical" placeholder="https://example.com/page"></div>
        <div class="ctrl"><label>Author</label><input type="text" id="metaAuthor" placeholder="Your name"></div>
        <div class="ctrl" style="grid-column:span 2;">
          <label>Robots</label>
          <select id="metaRobots">
            <option value="index, follow" selected>index, follow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
            <option value="index, nofollow">index, nofollow</option>
            <option value="noindex, follow">noindex, follow</option>
          </select>
        </div>
      </div>

      <span class="field-label" style="margin-top:16px;">Open Graph image URL</span>
      <input type="text" id="metaOgImage" placeholder="https://example.com/image.jpg">
      <span class="field-label" style="margin-top:14px;">Open Graph page URL</span>
      <input type="text" id="metaOgUrl" placeholder="https://example.com/page">
      <span class="field-label" style="margin-top:14px;">Twitter Card type</span>
      <select id="metaTwitterCard">
        <option value="summary_large_image" selected>summary_large_image</option>
        <option value="summary">summary</option>
      </select>

      <span class="field-label" style="margin-top:18px;">Preview</span>
      <pre class="code-preview" id="metaPreview"></pre>
      <div class="row">
        <button class="btn btn-primary" id="metaCopyBtn" style="flex:1;">Copy</button>
        <button class="btn btn-success" id="metaDownloadBtn">Download HTML</button>
      </div>"""

GKW_FORM = """<div class="view-title"><h2>AI Keyword Generator</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">Generates keyword ideas using template-based expansion, entirely in your browser. Metrics (volume, CPC, competition, difficulty) are <strong>AI-estimated for ideation</strong>, not live data from any paid keyword-research platform — there's no backend or API on this site to pull real numbers from. Use this to brainstorm broadly, then verify final picks in your search console or preferred keyword tool.</p>

      <form id="gkwForm">
        <span class="field-label">Main keyword</span>
        <input type="text" id="gkwSeed" placeholder="e.g. protein powder" required>

        <div class="qr-controls" style="margin-top:14px;">
          <div class="ctrl">
            <label for="gkwCountry">Country</label>
            <select id="gkwCountry">
              <option value="us" selected>United States</option>
              <option value="gb">United Kingdom</option>
              <option value="ca">Canada</option>
              <option value="au">Australia</option>
              <option value="in">India</option>
              <option value="global">Global</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwLanguage">Language</label>
            <select id="gkwLanguage">
              <option value="en" selected>English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwIntent">Search intent</label>
            <select id="gkwIntent">
              <option value="" selected>Any</option>
              <option value="informational">Informational</option>
              <option value="commercial">Commercial</option>
              <option value="transactional">Transactional</option>
              <option value="navigational">Navigational</option>
              <option value="local">Local</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwIndustry">Industry</label>
            <select id="gkwIndustry">
              <option value="general" selected>General</option>
              <option value="ecommerce">Ecommerce</option>
              <option value="finance">Finance</option>
              <option value="insurance">Insurance</option>
              <option value="legal">Legal</option>
              <option value="health">Health</option>
              <option value="tech">Technology</option>
              <option value="travel">Travel</option>
              <option value="education">Education</option>
              <option value="realestate">Real Estate</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwAudience">Target audience</label>
            <input type="text" id="gkwAudience" placeholder="e.g. beginners, small business owners">
          </div>
          <div class="ctrl">
            <label for="gkwWebsiteType">Website type</label>
            <select id="gkwWebsiteType">
              <option value="blog" selected>Blog</option>
              <option value="affiliate">Affiliate site</option>
              <option value="youtube">YouTube channel</option>
              <option value="ecommerce">Ecommerce store</option>
              <option value="business">Business website</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwCompetitor">Competitor (optional)</label>
            <input type="text" id="gkwCompetitor" placeholder="e.g. a competitor's brand name">
          </div>
          <div class="ctrl">
            <label for="gkwDifficulty">Preferred difficulty</label>
            <select id="gkwDifficulty">
              <option value="" selected>Any</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div class="ctrl" style="grid-column:span 2;">
            <label for="gkwCount">Number of keyword ideas</label>
            <select id="gkwCount">
              <option value="100" selected>100</option>
              <option value="250">250</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="gkwGenerateBtn" type="submit" style="flex:1;">Generate keywords</button>
          <button class="btn btn-ghost" id="gkwRandomBtn" type="button">Random seed</button>
        </div>
      </form>

      <div id="gkwSummary" class="hidden result-grid" style="margin-top:16px;">
        <div class="result-stat"><div class="num" id="gkwCountStat">0</div><div class="label">Ideas generated</div></div>
        <div class="result-stat"><div class="num" id="gkwVolStat">0</div><div class="label">Avg. est. volume</div></div>
        <div class="result-stat"><div class="num" id="gkwCpcStat">$0</div><div class="label">Avg. est. CPC</div></div>
        <div class="result-stat"><div class="num" id="gkwDiffStat">\u2014</div><div class="label">Avg. difficulty</div></div>
      </div>

      <div id="gkwResultsWrap" class="hidden">
        <div class="qr-controls" style="margin-top:16px;">
          <div class="ctrl">
            <label for="gkwFilterDifficulty">Filter: Difficulty</label>
            <select id="gkwFilterDifficulty">
              <option value="" selected>All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwFilterIntent">Filter: Intent</label>
            <select id="gkwFilterIntent">
              <option value="" selected>All</option>
              <option value="Informational">Informational</option>
              <option value="Commercial">Commercial</option>
              <option value="Transactional">Transactional</option>
              <option value="Local">Local</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="gkwSort">Sort by</label>
            <select id="gkwSort">
              <option value="default" selected>Default (by section)</option>
              <option value="az">Alphabetical</option>
              <option value="volume">Highest volume</option>
              <option value="competition">Lowest competition</option>
              <option value="longest">Longest keyword</option>
              <option value="shortest">Shortest keyword</option>
            </select>
          </div>
          <div class="ctrl" style="display:flex;flex-direction:column;justify-content:flex-end;gap:8px;">
            <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="gkwFilterQuestion" style="width:15px;height:15px;accent-color:var(--accent1);"> Question keywords only</label>
            <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px;cursor:pointer;"><input type="checkbox" id="gkwFilterBuying" style="width:15px;height:15px;accent-color:var(--accent1);"> Buying keywords only</label>
          </div>
        </div>

        <div class="row">
          <button class="btn btn-ghost" id="gkwSelectAllBtn" type="button">Select all</button>
          <button class="btn btn-ghost" id="gkwSelectNoneBtn" type="button">Select none</button>
          <button class="btn btn-ghost" id="gkwRemoveDuplicatesBtn" type="button">Remove duplicates</button>
          <button class="btn btn-ghost" id="gkwRegenerateBtn" type="button">Regenerate</button>
        </div>
        <div class="row">
          <button class="btn btn-secondary" id="gkwCopyAllBtn" type="button">Copy all keywords</button>
          <button class="btn btn-secondary" id="gkwCopySelectedBtn" type="button">Copy selected</button>
        </div>
        <div class="row">
          <button class="btn btn-outline" id="gkwExportTxtBtn" type="button">Export TXT</button>
          <button class="btn btn-outline" id="gkwExportCsvBtn" type="button">Export CSV</button>
          <button class="btn btn-outline" id="gkwExportJsonBtn" type="button">Export JSON</button>
          <button class="btn btn-outline" id="gkwExportMdBtn" type="button">Download Markdown</button>
        </div>

        <div id="gkwResultsBody" style="margin-top:14px;max-height:600px;overflow-y:auto;"></div>
      </div>"""

AEW_FORM = """<div class="view-title"><h2>AI Email Writer</h2></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-top:-6px;margin-bottom:14px;line-height:1.6;">A real, working email-writing interface with a genuine provider abstraction \u2014 not a fake AI demo. This static, backend-free site can't safely hold a real API key, so no provider is currently connected. See the FAQ below for exactly what that means and why.</p>

      <form id="aewForm">
        <div class="qr-controls">
          <div class="ctrl">
            <label for="aewEmailType">Email Type</label>
            <select id="aewEmailType">
              <option>Professional</option><option>Business</option><option>Formal</option><option>Friendly</option>
              <option>Customer Support</option><option>Complaint</option><option>Apology</option><option>Thank You</option>
              <option>Follow Up</option><option>Job Application</option><option>Meeting Request</option><option>Sales</option>
              <option>Marketing</option><option>Invitation</option><option>Resignation</option><option>Custom</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="aewTone">Tone</label>
            <select id="aewTone">
              <option>Professional</option><option>Friendly</option><option>Formal</option><option>Persuasive</option>
              <option>Confident</option><option>Polite</option><option>Casual</option>
            </select>
          </div>
          <div class="ctrl">
            <label for="aewLength">Length</label>
            <select id="aewLength"><option>Short</option><option selected>Medium</option><option>Long</option></select>
          </div>
          <div class="ctrl">
            <label for="aewLanguage">Language</label>
            <select id="aewLanguage"><option>English</option></select>
          </div>
        </div>

        <div class="resume-form-grid" style="margin-top:14px;">
          <div class="resume-field-group"><label for="aewRecipient">Recipient</label><input type="text" id="aewRecipient" placeholder="e.g. Hiring Manager, John Smith"></div>
          <div class="resume-field-group"><label for="aewSubject">Subject</label><input type="text" id="aewSubject" placeholder="e.g. Following up on our meeting"></div>
        </div>
        <div class="resume-field-group" style="margin-top:10px;">
          <label for="aewPurpose">Purpose</label>
          <input type="text" id="aewPurpose" placeholder="What is this email for?">
        </div>
        <div class="resume-field-group" style="margin-top:10px;">
          <label for="aewKeyPoints">Key Points</label>
          <textarea id="aewKeyPoints" rows="4" placeholder="One point per line" style="width:100%;font-family:inherit;font-size:13.5px;padding:12px 13px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--ink);resize:vertical;"></textarea>
        </div>

        <div class="row">
          <button class="btn btn-primary" id="aewGenerateBtn" type="button" style="flex:1;">Generate Email</button>
          <button class="btn btn-danger hidden" id="aewCancelBtn" type="button">Cancel</button>
        </div>
        <p class="editor-hint">Tip: press Ctrl+Enter (Cmd+Enter on Mac) to generate.</p>
      </form>

      <div class="progress-wrap hidden" id="aewLoadingWrap">
        <div class="progress-track"><div class="progress-fill" style="width:60%;"></div></div>
        <div class="progress-label">Generating\u2026</div>
      </div>

      <p class="editor-hint hidden" id="aewErrorBox" style="color:var(--err);" role="alert"></p>

      <div id="aewResultWrap" class="hidden" style="margin-top:16px;">
        <span class="field-label">Generated Email</span>
        <div id="aewResult" style="margin-top:8px;white-space:pre-wrap;font-size:13.5px;line-height:1.6;padding:16px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--ink);min-height:120px;" tabindex="0" role="textbox" aria-readonly="true" aria-label="Generated email text"></div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;">
          <span id="aewWordCount">0 words</span><span id="aewCharCount">0 characters</span><span id="aewReadingTime">~1 min read</span>
        </div>
      </div>

      <div class="row">
        <button class="btn btn-secondary" id="aewCopyBtn" type="button" disabled>Copy</button>
        <button class="btn btn-success" id="aewDownloadBtn" type="button" disabled>Download TXT</button>
        <button class="btn btn-ghost" id="aewClearBtn" type="button">Clear</button>
      </div>"""

SEO_TOOLS = [
    {"slug":"qr-code-generator","name":"QR Generator","desc":"Custom colors, size, and PNG or SVG export.",
     "subtitle":"Generate a custom QR code with adjustable colors, size, and PNG or SVG export.",
     "meta":"Free online QR code generator. Create a custom QR code with adjustable foreground/background colors, size, and PNG or SVG export.",
     "category":"UtilitiesApplication","form":QR_FORM,
     "intro":"Whether it's a link, a WiFi password, or a plain text message, QR Generator turns it into a scannable code you can customize and download — no signup, no watermark, no daily limit.",
     "features":["Custom foreground and background colors","Adjustable size from 120px to 480px","Download as PNG or true vector SVG","Works with any link or plain text"],
     "benefits":["SVG export scales to any size without losing quality — ideal for print","No account or watermark, unlike many free QR generators","Generated entirely in your browser, nothing sent to a server"],
     "how_to":"Type or paste a link or text, adjust the foreground/background colors and size, then tap Generate code. Download as PNG for web use or SVG for print and scaling.",
     "faq":[("What's the difference between PNG and SVG export?","PNG is a fixed-resolution image, good for web use. SVG is a vector format that scales to any size — print-ready — without losing sharpness."),
            ("Is there a limit to how much text I can encode?","QR codes can hold a few thousand characters, but very long text produces a denser, harder-to-scan code — shorter links or text scan more reliably.")],
     "related":["robots-txt-generator","meta-tag-generator"]},

    {"slug":"robots-txt-generator","name":"Robots.txt Generator","desc":"Build a valid robots.txt with allow/disallow rules and a sitemap line.",
     "subtitle":"Build a valid robots.txt file with custom allow/disallow rules and a sitemap reference.",
     "meta":"Free online robots.txt generator. Build a valid robots.txt with custom allow/disallow rules and a sitemap line, with live preview.",
     "category":"UtilitiesApplication","form":ROBOTS_FORM,
     "intro":"A correctly formatted robots.txt tells search engines what they can and can't crawl. Robots.txt Generator builds one with a live preview, so you can see exactly what you're about to publish before you copy or download it.",
     "features":["Add unlimited Allow/Disallow rules","Auto-suggests your sitemap URL from your website URL","Live preview updates as you type","Copy to clipboard or download as robots.txt"],
     "benefits":["Avoids the common formatting mistakes that break a robots.txt file","No signup required, and nothing is sent to a server to generate it","Live preview means no guessing what the final file looks like"],
     "how_to":"Enter your website URL and sitemap URL, add Allow/Disallow rules as needed, then copy the generated text or download it directly as robots.txt.",
     "faq":[("Where do I put the downloaded file?","robots.txt must be placed at the root of your domain, e.g. yoursite.com/robots.txt, for search engines to find it."),
            ("What happens if I don't add any rules?","With no rules, the generator defaults to allowing all crawling — a safe, common default for most sites.")],
     "related":["meta-tag-generator","qr-code-generator"]},

    {"slug":"meta-tag-generator","name":"Meta Tag Generator","desc":"Title, description, canonical, Open Graph, and Twitter Card tags.",
     "subtitle":"Generate title, description, canonical, Open Graph, and Twitter Card meta tags in one pass.",
     "meta":"Free online meta tag generator. Generate title, description, canonical, robots, Open Graph, and Twitter Card meta tags with a live HTML preview.",
     "category":"UtilitiesApplication","form":META_FORM,
     "intro":"Getting meta tags right across title, description, canonical, Open Graph, and Twitter Card all at once is easy to get wrong by hand. Meta Tag Generator builds all of them together with a live preview of the exact HTML you'll paste into your page.",
     "features":["Title, description, keywords, canonical, author, and robots directive","Open Graph tags for social link previews","Twitter Card tags with summary or large-image layout","Live HTML preview, copy or download in one click"],
     "benefits":["One tool covers every major meta tag instead of piecing them together from memory","Live preview catches typos before they go live","Copy or download the exact HTML snippet to paste into your page"],
     "how_to":"Fill in your title, description, and other fields — the Open Graph and Twitter Card tags reuse your title/description automatically. Copy the generated HTML or download it, then paste it into your page's &lt;head&gt;.",
     "faq":[("Do I need to fill in every field?","No — only the fields you fill in appear in the generated output; empty fields are simply omitted."),
            ("Where do these tags go in my page?","All of the generated tags belong inside your HTML page's &lt;head&gt; section.")],
     "related":["qr-code-generator","ai-keyword-generator"]},

    {"slug":"ai-keyword-generator","name":"AI Keyword Generator","desc":"AI-assisted keyword research: 20 keyword and content-idea categories in one pass.",
     "subtitle":"AI-assisted keyword research and content ideation \u2014 20 categories from one seed keyword, entirely in your browser.",
     "meta":"Free AI keyword generator for bloggers, affiliates, YouTubers, and ecommerce. Generate long-tail, question, buying, and local keywords plus blog titles, FAQs, and content outlines.",
     "category":"UtilitiesApplication","form":GKW_FORM,
     "intro":"Type in one seed keyword and get back a structured keyword research pack \u2014 primary keywords, long-tail variations, questions, buying-intent phrases, local and voice-search variants, YouTube titles, blog title ideas, meta suggestions, and a ready-to-use content outline, generated instantly and privately in your browser.",
     "features":["20 keyword and content-idea categories from a single seed keyword","Estimated intent, competition, CPC, trend, content score, difficulty, and volume per keyword","Filter by difficulty, intent, question keywords, or buying keywords","Sort alphabetically, by estimated volume, competition, or keyword length","Select individual keywords or grab everything at once","Export as TXT, CSV, JSON, or Markdown"],
     "benefits":["Nothing is uploaded \u2014 all generation and scoring happens locally in your browser","No signup, no daily limit, no credit card","Consistent, repeatable results \u2014 the same seed keyword always produces the same estimated metrics","Covers keyword research and content planning (titles, FAQs, outlines) in one tool instead of several"],
     "how_to":"Enter your main keyword, set your country, industry, and target audience, choose how many ideas you want (100/250/500), then tap Generate keywords. Use the filters and sort options to narrow down the list, select the keywords you want, and export or copy them.",
     "faq":[("Is this real keyword-planner data?","No \u2014 this site has no backend or API connection to any paid keyword-research platform (such as Google Keyword Planner), so any tool claiming to show that without one would be misrepresenting its numbers. Instead, this generates keyword ideas through structured template-based expansion and attaches consistent, estimated metrics for ideation and prioritization \u2014 a legitimate, widely-used approach for the free tier of many keyword tools, but always verify final keyword choices with your own search console or a dedicated keyword-data tool before relying on the numbers."),
            ("Why does the same keyword always get the same estimated volume?","The estimates are deterministically generated from the keyword text itself, not randomized \u2014 so your results are consistent and comparable across sessions instead of changing every time you regenerate."),
            ("Can I use this for YouTube or local SEO?","Yes \u2014 dedicated YouTube Keywords and Local Keywords sections are included alongside the main keyword-research categories.")],
     "related":["meta-tag-generator","robots-txt-generator"]},
]
SEO_TOOL_BY_SLUG = {t["slug"]: t for t in SEO_TOOLS}

AI_TOOLS = [
    {"slug":"ai-email-writer","name":"AI Email Writer","desc":"A real email-writing interface and provider architecture \u2014 no API key configured on this static site.",
     "subtitle":"A complete email-writing interface with a genuine AI provider architecture \u2014 honestly disclosed: no provider is currently connected.",
     "meta":"AI Email Writer for ToolFlight: choose email type, tone, and length, and generate a draft. A real provider abstraction supporting OpenAI, Claude, Gemini, Groq, and OpenRouter \u2014 currently unconfigured on this static, backend-free site.",
     "category":"BusinessApplication","form":AEW_FORM,
     "intro":"AI Email Writer provides a complete interface for drafting emails \u2014 email type, recipient, subject, purpose, key points, tone, and length \u2014 built on a real provider abstraction that any of OpenAI, Claude, Gemini, Groq, or OpenRouter could plug into without any change to this page. We'd rather tell you plainly than hide it: this static, backend-free site has no secure way to store a real API key client-side, so no provider is currently connected, and the tool says so honestly rather than faking a result.",
     "features":["Full set of email type, tone, and length options","Real prompt construction from your inputs, visible in the code, not hidden","Character count, word count, and estimated reading time","Copy to clipboard and download as TXT","Keyboard shortcut: Ctrl+Enter (Cmd+Enter on Mac) to generate","Cancel button and network-timeout handling built in"],
     "benefits":["Nothing about your draft is stored anywhere \u2014 the interface runs entirely in your browser","A genuinely reusable provider architecture, not a one-off hack","Honest behavior: it tells you clearly when it can't do something, instead of faking a result"],
     "how_to":"Fill in the email type, recipient, subject, purpose, and key points, choose a tone and length, then tap Generate Email (or press Ctrl+Enter). Since no AI provider is currently connected on this static site, you'll see a clear message explaining why, rather than a fabricated email.",
     "faq":[("Why doesn't this actually generate an email?","Because we won't fake it. Real AI email generation needs a large language model, which can't run meaningfully in a browser the way our image-based AI tools do \u2014 it requires a real API call to a provider like OpenAI or Claude, which in turn requires a secret API key. A key can never be safely embedded in client-side JavaScript on a static site like this one — anyone could view the page source and take it. So instead of faking a response, this tool is upfront that no provider is currently connected."),
            ("What would it take to make this fully functional?","A small secure backend (even a single serverless function) to hold the API key and forward requests to a real provider — the entire interface, prompt construction, and provider abstraction here are already built and ready for that; only the key management piece is missing, deliberately."),
            ("Which providers does the architecture support?","The code includes real, correctly-structured request builders for OpenAI, Claude (Anthropic), Gemini, Groq, and OpenRouter. Any one of them can be activated by supplying a key through a secure backend, without changing this page's interface."),
            ("Is my draft data sent anywhere right now?","No \u2014 with no provider connected, nothing leaves your browser. If a provider is connected in the future, only the fields you fill in would be sent to generate the draft, and that will be disclosed clearly at that time.")],
     "related":[]},
]
AI_TOOL_BY_SLUG = {t["slug"]: t for t in AI_TOOLS}

def build_seo_tool_page(tool):
    import json as _json
    breadcrumb = f'''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <a href="seo-tools.html" style="color:var(--ink-soft);text-decoration:none;">SEO Tools</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">{tool["name"]}</span>
</nav>'''

    features_html = "".join(f'<li>{f}</li>' for f in tool["features"])
    benefits_html = "".join(f'<li>{b}</li>' for b in tool["benefits"])
    faq_html = ""
    faq_items = []
    for q, a in tool["faq"]:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for rslug in tool["related"]:
        rt = SEO_TOOL_BY_SLUG[rslug]
        related_html += f'      <a href="{rslug}.html" class="blog-card"><span class="blog-tag">SEO Tool</span><h3>{rt["name"]}</h3><p>{rt["desc"]}</p></a>\n'

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "SEO Tools", "item": "https://toolflight.com/seo-tools.html"},
            {"@type": "ListItem", "position": 3, "name": tool["name"], "item": f'https://toolflight.com/{tool["slug"]}.html'},
        ]
    }
    webpage_schema = {
        "@context": "https://schema.org", "@type": "WebPage",
        "name": tool["name"], "description": tool["meta"], "url": f'https://toolflight.com/{tool["slug"]}.html'
    }
    software_schema = {
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        "name": tool["name"], "applicationCategory": tool["category"], "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>{tool["name"]}</h1>
  <p class="subtitle">{tool["subtitle"]}</p>
</div>

<div class="container">
  <div class="row" style="margin:0 0 18px;">
    <a href="seo-tools.html" class="btn btn-back" style="flex:0;min-width:auto;">Back to SEO Tools</a>
  </div>

  <div class="workspace">
      {tool["form"]}
  </div>

  <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border);max-width:720px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">About the {tool["name"]}</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["intro"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Features</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{features_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">How to Use</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["how_to"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Benefits</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{benefits_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Frequently Asked Questions</h2>
{faq_html}    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Related Tools</h2>
    <div class="related-grid">
{related_html}    </div>
  </div>
</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(webpage_schema)}</script>
<script type="application/ld+json">{_json.dumps(software_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

def build_ai_tool_page(tool):
    import json as _json
    breadcrumb = f'''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <a href="ai-tools.html" style="color:var(--ink-soft);text-decoration:none;">AI Tools</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">{tool["name"]}</span>
</nav>'''

    features_html = "".join(f'<li>{f}</li>' for f in tool["features"])
    benefits_html = "".join(f'<li>{b}</li>' for b in tool["benefits"])
    faq_html = ""
    faq_items = []
    for q, a in tool["faq"]:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for rslug in tool["related"]:
        rt = AI_TOOL_BY_SLUG[rslug]
        related_html += f'      <a href="{rslug}.html" class="blog-card"><span class="blog-tag">AI Tool</span><h3>{rt["name"]}</h3><p>{rt["desc"]}</p></a>\n'

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "AI Tools", "item": "https://toolflight.com/ai-tools.html"},
            {"@type": "ListItem", "position": 3, "name": tool["name"], "item": f'https://toolflight.com/{tool["slug"]}.html'},
        ]
    }
    webpage_schema = {
        "@context": "https://schema.org", "@type": "WebPage",
        "name": tool["name"], "description": tool["meta"], "url": f'https://toolflight.com/{tool["slug"]}.html'
    }
    software_schema = {
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        "name": tool["name"], "applicationCategory": tool["category"], "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>{tool["name"]}</h1>
  <p class="subtitle">{tool["subtitle"]}</p>
</div>

<div class="container">
  <div class="row" style="margin:0 0 18px;">
    <a href="ai-tools.html" class="btn btn-back" style="flex:0;min-width:auto;">Back to AI Tools</a>
  </div>

  <div class="workspace">
      {tool["form"]}
  </div>

  <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--card-border);max-width:720px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">About the {tool["name"]}</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["intro"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Features</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{features_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">How to Use</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">{tool["how_to"]}</p>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Benefits</h2>
    <ul style="font-size:13.5px;color:var(--ink-soft);line-height:1.8;padding-left:20px;margin:0;">{benefits_html}</ul>

    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Frequently Asked Questions</h2>
{faq_html}    <h2 style="font-size:18px;font-weight:800;margin:22px 0 8px;">Related Tools</h2>
    <div class="related-grid">
{related_html}    </div>
  </div>
</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(webpage_schema)}</script>
<script type="application/ld+json">{_json.dumps(software_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'

CONTACT_SERVICES = [
    ("Background Removal", "Clean, precise background removal for product photos, portraits, and marketing images, refined by hand where automated tools fall short."),
    ("Product Photo Editing", "Color correction, cropping, and retouching to make product photos consistent and ready for your store or marketplace listing."),
    ("Transparent PNG Creation", "Convert any image into a clean transparent PNG, ready to drop into designs, presentations, or product mockups."),
    ("Background Replacement", "Swap an existing background for a solid color, gradient, or custom scene, matched carefully to lighting and edges."),
    ("Background Color Change", "Update background colors to match brand guidelines or marketplace requirements, such as white-background product listings."),
    ("Watermark Addition", "Add a text or logo watermark across a batch of images, positioned and sized consistently."),
    ("Image Cropping", "Precise cropping to exact dimensions or aspect ratios for web, print, or social media use."),
    ("Image Compression", "Reduce file size for faster-loading websites and smaller email attachments, without a noticeable quality drop."),
    ("Image Optimization", "Prepare images for real-world use — correctly sized, correctly formatted, and ready to publish."),
    ("Social Media Image Preparation", "Resize and format images to fit specific platform requirements, including profile photos, banners, and post graphics."),
]

CONTACT_TRUST_POINTS = [
    "Privacy-first tools — most of ToolFlight's free tools run entirely in your browser, so your files are never uploaded to a server.",
    "No signup or account required to use any free tool on the site.",
    "Direct, personal communication — your message reaches a real person, not a support queue.",
    "Transparent, no-pressure conversations about custom tools or paid editing work.",
    "Free tools stay free — professional services are optional, never required.",
    "Attentive replies, typically within one to two business days.",
]

CONTACT_FAQ = [
    ("How quickly will I hear back?", "We aim to reply within one to two business days."),
    ("Can I request a custom tool?", "Yes — describe what you need in the message field, and we'll let you know if it's something we can build."),
    ("Do you offer paid image editing services?", "Yes, the professional editing services listed on this page are available on request — get in touch with details about your project and we'll follow up."),
    ("Is my contact information kept private?", "Yes — your name, email, and message are used only to respond to your inquiry."),
    ("What's the best way to report a bug?", "Use the contact form and include the tool name, your browser, and what you were trying to do when the issue occurred."),
]

def build_contact_body():
    import json as _json
    breadcrumb = '''<nav aria-label="Breadcrumb" style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px;">
  <a href="index.html" style="color:var(--ink-soft);text-decoration:none;">Home</a>
  <span style="margin:0 6px;">/</span>
  <span style="color:var(--ink);font-weight:600;">Contact</span>
</nav>'''

    services_html = ""
    for name, desc in CONTACT_SERVICES:
        services_html += f'    <div class="blog-card" style="cursor:default;"><span class="blog-tag">Service</span><h3>{name}</h3><p>{desc}</p></div>\n'

    trust_html = ""
    for point in CONTACT_TRUST_POINTS:
        trust_html += f'    <li>{ICON_CHECK}<span>{point}</span></li>\n'

    faq_html = ""
    faq_items = []
    for q, a in CONTACT_FAQ:
        faq_html += f'    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-top:10px;"><strong>{q}</strong><br>{a}</p>\n'
        faq_items.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    breadcrumb_schema = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://toolflight.com/"},
            {"@type": "ListItem", "position": 2, "name": "Contact", "item": "https://toolflight.com/contact.html"},
        ]
    }
    webpage_schema = {
        "@context": "https://schema.org", "@type": "WebPage",
        "name": "Contact ToolFlight",
        "description": "Contact ToolFlight for questions, bug reports, custom tool requests, or professional image editing services.",
        "url": "https://toolflight.com/contact.html"
    }
    faqpage_schema = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faq_items}

    body = f"""<div class="hero-sub">
  {breadcrumb}
  <h1>Contact ToolFlight</h1>
  <p class="subtitle">Have a question, found a bug, need a custom tool, or want professional image editing services? We'd love to hear from you.</p>
</div>

<div class="container" style="max-width:720px;">

  <div class="workspace">
    <div class="view-title"><h2>Send a message</h2></div>
    <div id="contactSuccessBanner" class="hidden" role="status" style="background:color-mix(in srgb, var(--ok) 10%, var(--card));border:1px solid var(--card-border);border-radius:12px;padding:14px;margin-bottom:16px;font-size:13.5px;">Thanks — your message has been sent. We'll get back to you within one to two business days.</div>

    <form id="contactForm" name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" netlify>
      <input type="hidden" name="form-name" value="contact">
      <p class="hidden" style="display:none;">
        <label>Don't fill this out if you're human: <input name="bot-field" tabindex="-1" autocomplete="off"></label>
      </p>

      <span class="field-label">Full Name</span>
      <input type="text" id="contactName" name="name" placeholder="Your full name" required aria-required="true">
      <span class="field-error" id="contactNameError"></span>

      <span class="field-label" style="margin-top:14px;">Email Address</span>
      <input type="email" id="contactEmail" name="email" placeholder="you@example.com" required aria-required="true">
      <span class="field-error" id="contactEmailError"></span>

      <span class="field-label" style="margin-top:14px;">WhatsApp Number</span>
      <input type="tel" id="contactWhatsapp" name="whatsapp" placeholder="+1 555 123 4567" required aria-required="true">
      <span class="field-error" id="contactWhatsappError"></span>

      <span class="field-label" style="margin-top:14px;">Subject</span>
      <input type="text" id="contactSubject" name="subject" placeholder="What's this about?" required aria-required="true">
      <span class="field-error" id="contactSubjectError"></span>

      <span class="field-label" style="margin-top:14px;">Message</span>
      <textarea id="contactMessage" name="message" placeholder="Tell us a bit more..." required aria-required="true"></textarea>
      <span class="field-error" id="contactMessageError"></span>

      <div class="row">
        <button class="btn btn-primary" id="contactSubmitBtn" type="submit" style="flex:1;">Send message</button>
      </div>
    </form>
  </div>

  <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--card-border);">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:10px;">Direct Contact</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">Prefer email? Reach us directly:</p>
    <a href="mailto:qsrjehan@gmail.com" class="btn btn-ghost" style="text-decoration:none;display:inline-flex;margin-top:8px;">{ICON_MAIL} qsrjehan@gmail.com</a>
  </div>

  <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--card-border);">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:6px;">Professional Image Editing Services</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;margin-bottom:14px;">Beyond the free automated tools on this site, hands-on professional editing is available on request for projects that need a closer touch.</p>
    <div class="related-grid">
{services_html}    </div>
  </div>

  <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--card-border);">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:12px;">Why Choose ToolFlight</h2>
    <ul class="trust-list">
{trust_html}    </ul>
  </div>

  <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--card-border);padding-bottom:10px;">
    <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">Frequently Asked Questions</h2>
{faq_html}  </div>

</div>

<script type="application/ld+json">{_json.dumps(breadcrumb_schema)}</script>
<script type="application/ld+json">{_json.dumps(webpage_schema)}</script>
<script type="application/ld+json">{_json.dumps(faqpage_schema)}</script>
"""
    return body

PAGE_DEFS = [
    ("index.html", "ToolFlight — Free Online PDF, Image & Everyday Tools", "Merge PDFs, compress images, and more free tools — no signup, files never leave your device.", index_body),
    ("pdf-tools.html", "Free Online PDF Tools — Merge, Split, Compress, Resume Builder & More | ToolFlight", "8 free online PDF tools: merge, split, compress, image to PDF, PDF to image, PDF to Word, Word to PDF, and a resume builder with ATS checker. Each with its own dedicated page. No upload, no signup.", pdf_body),
    ("image-tools.html", "Free Online Image Tools — Passport Photo Maker, AI OCR, Upscaler & More | ToolFlight", "11 free online image tools: compress, crop, watermark, rotate/flip, AI background remover, background changer, AI object remover, AI photo enhancer, AI image upscaler, AI OCR, and a passport photo maker. Each with its own dedicated page.", image_body),
    ("calculators.html", "Free Online Calculators — Age, BMI, EMI, GST, Scientific & More | ToolFlight", "9 free online calculators: age, BMI, percentage, discount, EMI/loan, GST/VAT, scientific, unit converter, and currency converter. Each with its own dedicated page.", calc_body),
    ("finance-tools.html", "Finance Tools — Currency & Loan Calculators | ToolFlight", "Free finance tools including currency converter and loan calculator.", finance_body),
    ("seo-tools.html", "Free Online SEO Tools — Keyword Generator, QR Code, Robots.txt & Meta Tags | ToolFlight", "4 free online SEO tools: AI keyword generator, QR code generator, robots.txt generator, and meta tag generator. Each with its own dedicated page.", seo_body),
    ("ai-tools.html", "Free AI Tools — AI Email Writer & More | ToolFlight", "Free AI-assisted tools for ToolFlight, starting with the AI Email Writer. Honest about what's currently connected and what isn't.", ai_body),
]

for filename, title, desc, body in PAGE_DEFS:
    # Homepage canonicalizes to the root URL (https://toolflight.com/) instead
    # of https://toolflight.com/index.html — every other page keeps its
    # existing canonical/OG URL exactly as before (og_path_override=None
    # preserves prior behavior identically). The output filename and navbar
    # active-link detection both still use "index.html" as before, unaffected.
    og_override = "" if filename == "index.html" else None
    html = ensure_button_types(page_shell(filename, title, desc, body, og_path_override=og_override))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ STANDALONE CALCULATOR PAGES (9 files) ============
for calc in CALCULATORS:
    filename = calc["slug"] + ".html"
    title = f'{calc["name"]} — Free Online | ToolFlight'
    body = build_calculator_page(calc)
    html = ensure_button_types(page_shell(filename, title, calc["meta"], body))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ STANDALONE PDF TOOL PAGES (2 files) ============
for tool in PDF_TOOLS:
    filename = tool["slug"] + ".html"
    title = f'{tool["name"]} — Free Online | ToolFlight'
    body = build_pdf_tool_page(tool)
    html = ensure_button_types(page_shell(filename, title, tool["meta"], body))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ STANDALONE SEO TOOL PAGES (3 files) ============
for tool in SEO_TOOLS:
    filename = tool["slug"] + ".html"
    title = f'{tool["name"]} — Free Online | ToolFlight'
    body = build_seo_tool_page(tool)
    html = ensure_button_types(page_shell(filename, title, tool["meta"], body))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ STANDALONE AI TOOL PAGES (1 file) ============
for tool in AI_TOOLS:
    filename = tool["slug"] + ".html"
    title = f'{tool["name"]} — Free Online | ToolFlight'
    body = build_ai_tool_page(tool)
    html = ensure_button_types(page_shell(filename, title, tool["meta"], body))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ STANDALONE IMAGE TOOL PAGES (6 files) ============
for tool in IMAGE_TOOLS:
    filename = tool["slug"] + ".html"
    title = f'{tool["name"]} — Free Online | ToolFlight'
    body = build_image_tool_page(tool)
    html = ensure_button_types(page_shell(filename, title, tool["meta"], body))
    with open(os.path.join(OUT, filename), "w") as f:
        f.write(html)
    print("wrote", filename, len(html), "chars")

# ============ BLOG ============
ARTICLES = [
    {
        "slug": "passport-photo-rules-ai-editing",
        "title": "Passport Photo Rules Explained: Requirements, Backgrounds, and Why AI Editing Can Get You Rejected",
        "meta": "A complete guide to passport photo requirements, background rules, and AI editing limitations — plus why some countries reject digitally altered photos, and how to verify your photo before submitting.",
        "tag": "Passport Photos",
        "reading_time": 8,
        "lede": "Passport photo rejections are more common than most people expect, and a growing share of them now come down to one specific issue: digital editing. Here's what actually matters, country by country.",
        "toc": [
            ("why-rejections-happen", "Why passport photos get rejected"),
            ("size-and-framing", "Passport photo size and framing rules"),
            ("background-rules", "Background rules, and why they vary"),
            ("ai-editing-limits", "What AI editing can and can't safely do"),
            ("why-countries-reject-edited-photos", "Why some countries reject edited photos"),
            ("country-differences", "Country-specific differences worth knowing"),
            ("verification-tips", "How to verify your photo before submitting"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("why-rejections-happen", "Why passport photos get rejected", """
<p>Passport photo rejection is one of the most common reasons a passport or visa application gets delayed. The causes are usually mundane: the head is slightly too small or too large for the frame, the background has a shadow or isn't uniform, the photo is a little blurry, or — increasingly — the photo shows signs of digital editing that the issuing authority doesn't allow. A free <strong>passport photo maker</strong> or <strong>passport photo checker</strong> can catch most of these issues before you ever submit, but it helps to understand what's actually being checked and why.</p>
"""),
            ("size-and-framing", "Passport photo size and framing rules", """
<p>Most <strong>passport photo requirements</strong> and <strong>visa photo requirements</strong> boil down to three numbers: overall photo size, head height as a percentage of the frame, and where the eyes should sit vertically. The specifics vary meaningfully by country. <strong>US passport photo rules</strong> call for a 2 x 2 inch (51 x 51mm) square photo with the head measuring 1 to 1&frac58; inches from chin to crown. Most of Europe, along with a long list of other countries, instead uses a 35 x 45mm rectangular format — a size sometimes called the ICAO or Schengen standard. A handful of countries (China, Malaysia, Turkey, several Gulf states) use their own distinct dimensions entirely, which is exactly the kind of detail that's easy to get wrong without a country-specific <strong>passport photo size</strong> reference.</p>
"""),
            ("background-rules", "Background rules, and why they vary", """
<p>Background requirements exist so that automated systems and human reviewers can isolate your face cleanly from everything else in the frame. Plain white is the most common <strong>passport photo background</strong> requirement, but plenty of countries specify light grey or an off-white/cream tone instead, and a few are specific about avoiding pure white because it can blow out under certain lighting. Shadows on the background, wrinkled backdrops, and visible texture are common, avoidable rejection reasons — which is exactly what a <strong>passport photo background remover</strong> is useful for, replacing an uneven backdrop with a flat, compliant color rather than trying to photograph a perfectly even one at home.</p>
"""),
            ("ai-editing-limits", "What AI editing can and can't safely do", """
<p>This is the part that trips up more people than it used to. Modern <strong>passport photo AI editing</strong> tools can genuinely help with the mechanical parts of the process — detecting your face and automatically centering and sizing the crop, flattening an uneven background into a clean solid color, correcting exposure so the photo isn't over- or under-lit. All of that is about matching a real, existing photo of you to a required format.</p>
<p>Where AI editing becomes a real problem is when it starts changing what you actually look like: smoothing skin, adjusting facial proportions, or applying beautification filters. Several governments — the United States prominently among them — now explicitly screen for signs of digital alteration and reject photos that show it, even when the editing was subtle and well-intentioned. The safest approach with any <strong>passport photo editor</strong> is to use automated tools for cropping, sizing, and background cleanup, and to leave your actual likeness untouched.</p>
"""),
            ("why-countries-reject-edited-photos", "Why some countries reject edited photos", """
<p>Passport photos exist to support identity verification and biometric matching — facial recognition systems used at border control compare your passport photo against your live face, and heavily edited photos measurably reduce match accuracy. This is the underlying reason more governments have moved toward explicit anti-editing policies rather than just relying on manual review to catch it. It's not an arbitrary rule; it's a direct response to biometric systems needing an accurate, unaltered likeness to function correctly.</p>
"""),
            ("country-differences", "Country-specific differences worth knowing", """
<p>Beyond size and background, individual countries layer on their own specific rules: some are strict about glasses (many now disallow them entirely), some have particular rules about hair covering the forehead or ears, and head-height tolerances that look similar on paper (say, 50-69% vs. 62-75% of the frame) can meaningfully change how tightly your face needs to be cropped. A <strong>free passport photo maker</strong> that maintains a real per-country database — rather than one generic template — is genuinely more useful here than trying to eyeball a single set of rules against every country's page.</p>
"""),
            ("verification-tips", "How to verify your photo before submitting", """
<p>No online tool, free or paid, can promise your specific passport office will accept a given photo — rules change, and enforcement varies. A few habits meaningfully reduce your risk: always check your destination country's current official passport or embassy page rather than relying on memory of old rules, avoid any tool that applies beautification or skin-smoothing by default, print a physical test copy at full size before a final in-person submission if that's an option, and when in doubt, treat an online <strong>passport photo compliance</strong> check as a helpful first pass rather than a final answer.</p>
"""),
            ("try-it", "Try it yourself", """
<p>ToolFlight's <a href="../passport-photo-maker.html">Passport & Visa Photo Maker</a> handles the sizing, cropping, and background work for 42 countries with real AI face detection, runs entirely in your browser, and is upfront in its own interface about which edits are safe to use for documents like US passports where AI alteration is explicitly disallowed.</p>
"""),
        ],
        "faq": [
            ("What is the standard passport photo size?", "It depends on the country. The US uses 2 x 2 inches (51 x 51mm); most of Europe and many other countries use 35 x 45mm; a few countries (China, Malaysia, Turkey, and others) use their own distinct sizes."),
            ("Can I use an AI passport photo editor safely?", "Yes, for the mechanical parts — cropping, sizing, and background cleanup. Avoid AI tools that smooth skin or adjust facial features, since several countries, including the US, now explicitly reject photos showing signs of that kind of digital alteration."),
            ("Why do passport photos need a plain background?", "So automated systems and human reviewers can isolate your face cleanly, and because facial recognition matching at border control works more reliably against a clean, unaltered image."),
            ("How can I check if my passport photo will be accepted?", "Use a passport photo checker that validates head size, positioning, and background against your specific country's requirements, then cross-check against your country's current official passport or embassy page before submitting — no online tool can guarantee acceptance."),
        ],
        "related": [],
    },
    {
        "slug": "how-to-compress-images-without-losing-quality",
        "title": "How to Compress Images Without Losing Quality",
        "meta": "Practical techniques to shrink JPG, PNG, and WEBP file sizes while keeping images sharp — plus a free browser-based compressor.",
        "tag": "Image Tools",
        "reading_time": 6,
        "lede": "A bloated image slows down your website and eats phone storage — but crank compression too far and photos turn to mush. Here's how to find the sweet spot.",
        "toc": [
            ("why-size-matters", "Why image file size matters"),
            ("lossy-vs-lossless", "Lossy vs. lossless compression"),
            ("quality-setting", "Finding the right quality setting"),
            ("resize-first", "Resize before you compress"),
            ("format-choice", "Choosing the right format"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("why-size-matters", "Why image file size matters", """
<p>Large images are one of the most common causes of slow-loading web pages, and on mobile connections the effect is even worse — a single uncompressed photo can be 5-10MB, which takes several seconds to download on a weak signal. Beyond speed, big files eat storage on phones and make email attachments bounce. Compression solves both problems by re-encoding the image to remove redundant data, usually with little to no visible difference.</p>
"""),
            ("lossy-vs-lossless", "Lossy vs. lossless compression", """
<p>There are two fundamentally different approaches. <strong>Lossless</strong> compression (used by PNG) shrinks the file without discarding any pixel data — you get the exact same image back, just packed more efficiently. It's ideal for screenshots, logos, and graphics with flat colors and text, but it can't shrink photos nearly as much as lossy methods.</p>
<p><strong>Lossy</strong> compression (used by JPEG and, optionally, WEBP) discards information the human eye is less likely to notice — subtle color gradients, high-frequency detail — in exchange for dramatically smaller files. Most photos compress 70-90% smaller this way with no obvious quality loss, as long as you don't push the compression too far.</p>
"""),
            ("quality-setting", "Finding the right quality setting", """
<p>Most compressors expose a quality slider from roughly 0-100. In practice:</p>
<ul>
<li><strong>90-100:</strong> visually identical to the original, minimal savings</li>
<li><strong>70-85:</strong> the sweet spot for most photos — meaningful size reduction with no visible artifacts at normal viewing sizes</li>
<li><strong>50-70:</strong> noticeable softening in fine detail, but often fine for web thumbnails</li>
<li><strong>Below 50:</strong> visible blocky artifacts, especially around sharp edges and text</li>
</ul>
<p>The right number depends on the image and its use case — always compare a before/after preview rather than trusting a single "safe" number.</p>
"""),
            ("resize-first", "Resize before you compress", """
<p>Quality percentage is only half the story. A photo straight off a modern phone camera can be 4000+ pixels wide — far larger than it will ever be displayed at on a web page or in a chat app. Resizing the image down to the dimensions you'll actually use (say, 2000px on the longest side for a large web photo, or 1200px for a blog post) often saves far more file size than any amount of quality reduction, with zero visible quality loss, since you're removing pixels that were never going to be seen anyway.</p>
"""),
            ("format-choice", "Choosing the right format", """
<p>As a rule of thumb: use <strong>JPEG</strong> for photos, <strong>PNG</strong> for screenshots/graphics/anything needing transparency, and <strong>WEBP</strong> when you want the smaller file size of JPEG-style compression but with broader flexibility (including transparency support) — modern browsers all support it now. See our full <a href="jpg-vs-png-vs-webp.html">JPG vs PNG vs WEBP comparison</a> for a deeper breakdown.</p>
"""),
            ("try-it", "Try it yourself", """
<p>You don't need to install anything to put this into practice — ToolFlight's Image Compressor runs entirely in your browser, resizes large images automatically, and shows a live before/after so you can judge the quality tradeoff yourself.</p>
<a class="inline-cta" href="../image-tools.html">Open the free Image Compressor →</a>
"""),
        ],
        "faq": [
            ("Will compressing an image reduce its dimensions?", "Not unless you choose to resize it — compression reduces file size by re-encoding pixel data, while resizing reduces the pixel dimensions. Good compressors do both together for the best results."),
            ("Is WEBP always smaller than JPEG?", "Usually, often by 25-35% at equivalent visual quality, but not universally — for some images JPEG at a slightly higher quality setting can still come out smaller. It's worth comparing both for images that matter."),
            ("Can I compress a PNG the same way as a JPEG?", "PNG compression is lossless by design, so file size gains are smaller. For photos saved as PNG, converting to JPEG or WEBP first usually gives far better results."),
        ],
        "related": ["jpg-vs-png-vs-webp", "how-to-resize-images-online"],
    },
    {
        "slug": "how-to-merge-pdf-files-online",
        "title": "How to Merge PDF Files Online",
        "meta": "Step-by-step guide to combining multiple PDFs into one file for free, without installing software or uploading sensitive documents.",
        "tag": "PDF Tools",
        "reading_time": 5,
        "lede": "Whether you're combining scanned pages, invoices, or a multi-part report, merging PDFs is one of those tasks everyone needs eventually. Here's the fastest, safest way to do it.",
        "toc": [
            ("when-to-merge", "When you need to merge PDFs"),
            ("online-vs-software", "Online tool vs. desktop software"),
            ("step-by-step", "Step-by-step: merging online"),
            ("order-matters", "Getting the page order right"),
            ("privacy", "A note on privacy"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("when-to-merge", "When you need to merge PDFs", """
<p>Common cases include combining scanned receipts into one expense report, stitching together chapters of a document, merging signed pages back into a full contract, or assembling a portfolio from several individual PDFs. In every case, the goal is the same: one clean file instead of a scattered folder of attachments.</p>
"""),
            ("online-vs-software", "Online tool vs. desktop software", """
<p>Desktop PDF editors can merge files too, but they're often paid, require installation, and are overkill for an occasional task. A browser-based merger avoids all of that — no download, no account, and it works the same on Windows, Mac, Chromebook, or a phone.</p>
"""),
            ("step-by-step", "Step-by-step: merging online", """
<ol>
<li>Open a browser-based PDF merge tool.</li>
<li>Select or drag in all the PDF files you want combined.</li>
<li>Reorder them into the sequence you want the final document to read in.</li>
<li>Click merge, and download the single resulting file.</li>
</ol>
<p>The whole process typically takes under a minute, even for a dozen files.</p>
"""),
            ("order-matters", "Getting the page order right", """
<p>The single most common mistake is merging files in the wrong order — most tools combine files in the order you added them, not alphabetically or by date. Good tools let you drag files to reorder them before merging; always double check the order (and file names, if page counts are shown) before hitting merge.</p>
"""),
            ("privacy", "A note on privacy", """
<p>Because merging a PDF doesn't require any AI processing or lookup, it's a task well suited to running entirely inside your browser using JavaScript — meaning your files never actually get uploaded to a server at all. If a tool advertises this, it's worth preferring for anything sensitive like contracts, IDs, or financial documents.</p>
"""),
            ("try-it", "Try it yourself", """
<p>ToolFlight's Merge PDF tool works exactly this way: drag your files in, reorder them, and download — all processed locally in your browser.</p>
<a class="inline-cta" href="../pdf-tools.html">Open the free PDF Merger →</a>
"""),
        ],
        "faq": [
            ("Is there a limit to how many PDFs I can merge?", "Browser-based tools are limited by your device's memory rather than a fixed count — a handful of files works instantly, while dozens of very large files may be slower."),
            ("Will merging affect the quality of my PDFs?", "No — merging combines pages as-is; it doesn't re-render or re-compress content, so text and images stay exactly as sharp as the originals."),
            ("Can I merge password-protected PDFs?", "Most browser-based mergers can't read encrypted PDFs directly — you'd need to remove the password first using a PDF editor, then merge."),
        ],
        "related": ["best-free-pdf-tools", "how-to-compress-images-without-losing-quality"],
    },
    {
        "slug": "jpg-vs-png-vs-webp",
        "title": "JPG vs PNG vs WEBP: Which Image Format Should You Use?",
        "meta": "A plain-English comparison of JPG, PNG, and WEBP — file size, transparency, and quality — so you can pick the right format every time.",
        "tag": "Image Tools",
        "reading_time": 7,
        "lede": "Three formats, three very different jobs. Picking the wrong one is the easiest way to end up with a bloated web page or a blurry logo.",
        "toc": [
            ("quick-answer", "Quick answer"),
            ("jpg", "JPG (JPEG)"),
            ("png", "PNG"),
            ("webp", "WEBP"),
            ("comparison-table", "Side-by-side comparison"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("quick-answer", "Quick answer", """
<p>Use <strong>JPG</strong> for photographs, <strong>PNG</strong> for screenshots, logos, and anything needing a transparent background, and <strong>WEBP</strong> when you want smaller files than JPG with more flexibility — it's supported by all modern browsers and is a safe default for most web images today.</p>
"""),
            ("jpg", "JPG (JPEG)", """
<p>JPG uses lossy compression tuned for photographs — smooth color gradients, natural detail — and can shrink a photo by 70-90% with minimal visible quality loss. Its weaknesses: no transparency support, and it handles sharp edges or text poorly, often showing blocky artifacts around high-contrast lines.</p>
"""),
            ("png", "PNG", """
<p>PNG uses lossless compression, so it preserves every pixel exactly and supports full transparency (an alpha channel), making it the standard choice for logos, icons, and screenshots with text. The tradeoff is file size — a photo saved as PNG is often 5-10x larger than the same photo saved as JPG, with no visible quality benefit for that use case.</p>
"""),
            ("webp", "WEBP", """
<p>WEBP is a newer format from Google that supports both lossy and lossless compression, plus transparency, in a single format — effectively combining the strengths of JPG and PNG. At equivalent visual quality, WEBP files are typically 25-35% smaller than JPG and significantly smaller than PNG. The main historical drawback — inconsistent browser support — is no longer a real concern, as of the current generation of browsers.</p>
"""),
            ("comparison-table", "Side-by-side comparison", """
<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">
<thead><tr style="text-align:left;border-bottom:2px solid var(--card-border);"><th style="padding:8px 6px;">Feature</th><th style="padding:8px 6px;">JPG</th><th style="padding:8px 6px;">PNG</th><th style="padding:8px 6px;">WEBP</th></tr></thead>
<tbody>
<tr style="border-bottom:1px solid var(--card-border);"><td style="padding:8px 6px;">Best for</td><td style="padding:8px 6px;">Photos</td><td style="padding:8px 6px;">Graphics/logos</td><td style="padding:8px 6px;">Both</td></tr>
<tr style="border-bottom:1px solid var(--card-border);"><td style="padding:8px 6px;">Transparency</td><td style="padding:8px 6px;">No</td><td style="padding:8px 6px;">Yes</td><td style="padding:8px 6px;">Yes</td></tr>
<tr style="border-bottom:1px solid var(--card-border);"><td style="padding:8px 6px;">Compression</td><td style="padding:8px 6px;">Lossy</td><td style="padding:8px 6px;">Lossless</td><td style="padding:8px 6px;">Both</td></tr>
<tr><td style="padding:8px 6px;">Typical file size</td><td style="padding:8px 6px;">Small</td><td style="padding:8px 6px;">Large</td><td style="padding:8px 6px;">Smallest</td></tr>
</tbody>
</table>
"""),
            ("try-it", "Try it yourself", """
<p>Not sure which format your image should be? Compress it with ToolFlight and compare the resulting file size directly against the original.</p>
<a class="inline-cta" href="../image-tools.html">Open the free Image Compressor →</a>
"""),
        ],
        "faq": [
            ("Can I convert between these formats?", "Yes — most image tools, including browser-based compressors, can re-save an image in a different format simply by changing the export type."),
            ("Does WEBP work in all browsers now?", "All major modern browsers (Chrome, Firefox, Safari, Edge) support WEBP for both viewing and, in most cases, editing."),
            ("Why do screenshots look bad as JPG?", "JPG's lossy compression struggles with the sharp edges and flat colors common in screenshots and text, producing visible blocky artifacts — PNG or WEBP (lossless mode) avoids this."),
        ],
        "related": ["how-to-compress-images-without-losing-quality", "how-to-resize-images-online"],
    },
    {
        "slug": "best-free-pdf-tools",
        "title": "Best Free PDF Tools (No Signup Required)",
        "meta": "A rundown of the essential free PDF tools everyone needs — merging, splitting, and more — without paying for software or creating an account.",
        "tag": "PDF Tools",
        "reading_time": 5,
        "lede": "You don't need a subscription to do 90% of what most people ever need a PDF tool for. Here's what actually matters.",
        "toc": [
            ("what-you-actually-need", "What most people actually need"),
            ("merge", "Merging PDFs"),
            ("split", "Splitting PDFs"),
            ("what-to-avoid", "What to avoid"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("what-you-actually-need", "What most people actually need", """
<p>Despite how many paid "PDF suites" exist, the overwhelming majority of everyday PDF tasks fall into two buckets: combining multiple files into one, or pulling specific pages out of a larger file. Full-blown PDF editing (rewriting text, redesigning layouts) is a much rarer need, and usually justifies a heavier paid tool if you truly need it regularly.</p>
"""),
            ("merge", "Merging PDFs", """
<p>Look for a merge tool that lets you reorder files before combining — this single feature separates a genuinely useful tool from an annoying one, since getting the final page order right on the first try (without a reorder step) is rare. See our full <a href="how-to-merge-pdf-files-online.html">guide to merging PDFs</a> for a step-by-step walkthrough.</p>
"""),
            ("split", "Splitting PDFs", """
<p>A good split tool should let you either extract specific page ranges, or split every page into its own file, and should show you the total page count before you commit — guessing at page numbers is a common source of mistakes.</p>
"""),
            ("what-to-avoid", "What to avoid", """
<p>Watch out for tools that require an account just to download your own output file, or that don't clearly state what happens to your file after upload. Browser-based tools that never actually transmit your document anywhere sidestep both concerns entirely, and are worth preferring for anything containing sensitive information like contracts, IDs, or financial statements.</p>
"""),
            ("try-it", "Try it yourself", """
<p>ToolFlight's PDF Tools page covers both of the core use cases — Merge and Split — for free, with no signup and no file upload.</p>
<a class="inline-cta" href="../pdf-tools.html">Open the free PDF Tools →</a>
"""),
        ],
        "faq": [
            ("Do I need to install anything?", "No — browser-based PDF tools run using JavaScript already built into your browser; there's nothing to download or install."),
            ("Is it safe to merge sensitive documents online?", "It's safe specifically with tools that process files locally in your browser rather than uploading them to a server — check for that distinction before using a tool for anything sensitive."),
            ("Can I edit text inside a PDF with a free browser tool?", "Basic tools like merge/split generally don't support rewriting text content — that typically requires a dedicated PDF editor."),
        ],
        "related": ["how-to-merge-pdf-files-online", "how-to-compress-images-without-losing-quality"],
    },
    {
        "slug": "how-to-resize-images-online",
        "title": "How to Resize Images Online",
        "meta": "How and why to resize images before uploading or sharing them, and the difference between resizing and compressing.",
        "tag": "Image Tools",
        "reading_time": 5,
        "lede": "Resizing is the single most underused trick for smaller, faster-loading images — and it's often confused with compression, which does something different.",
        "toc": [
            ("resize-vs-compress", "Resizing vs. compressing"),
            ("why-resize", "Why resize before uploading"),
            ("what-size", "What size should you use"),
            ("aspect-ratio", "Keeping the aspect ratio"),
            ("try-it", "Try it yourself"),
        ],
        "sections": [
            ("resize-vs-compress", "Resizing vs. compressing", """
<p>These two terms get used interchangeably, but they do different things. <strong>Resizing</strong> changes the pixel dimensions of an image (say, from 4000×3000 down to 1200×900). <strong>Compressing</strong> keeps the same dimensions but re-encodes the pixel data to take up less file space. For the biggest size reduction with the least visible quality loss, you generally want both — resize down to the dimensions you'll actually display, then compress on top of that.</p>
"""),
            ("why-resize", "Why resize before uploading", """
<p>Modern phone cameras capture images far larger than almost any website or app will display them at. A profile photo displayed at 200×200 pixels doesn't need to be a 4000×3000 pixel file — the browser would just scale it down anyway, wasting bandwidth and load time in the process. Resizing before upload fixes this at the source.</p>
"""),
            ("what-size", "What size should you use", """
<ul>
<li><strong>Profile photos / avatars:</strong> 400-800px on the longest side is plenty</li>
<li><strong>Blog post images:</strong> 1200-1600px on the longest side covers virtually all display contexts</li>
<li><strong>Large hero/banner images:</strong> up to 2000px on the longest side for full-width desktop banners</li>
<li><strong>Print:</strong> resizing rules don't apply the same way — print needs much higher resolution and is a different consideration entirely</li>
</ul>
"""),
            ("aspect-ratio", "Keeping the aspect ratio", """
<p>Always resize proportionally (locking width and height together) unless you specifically want to crop or stretch an image — stretching distorts faces and objects in an obvious, unflattering way. Good resize tools calculate the second dimension automatically once you set one.</p>
"""),
            ("try-it", "Try it yourself", """
<p>ToolFlight's Image Compressor automatically resizes any image over 2000px on its longest side as part of compression, so oversized photos are handled for you without an extra step.</p>
<a class="inline-cta" href="../image-tools.html">Open the free Image Compressor →</a>
"""),
        ],
        "faq": [
            ("Does resizing reduce image quality?", "Reducing dimensions doesn't blur or degrade a photo when viewed at the new, smaller size — quality loss only becomes visible if you try to display the resized image larger than its new dimensions."),
            ("What's the best format after resizing?", "Photos are usually smallest as JPG or WEBP after resizing; graphics or anything needing transparency should stay PNG or WEBP. See our JPG vs PNG vs WEBP comparison for details."),
            ("Can I resize multiple images at once?", "Batch resizing needs a tool built for it specifically — single-image browser tools typically process one file at a time."),
        ],
        "related": ["how-to-compress-images-without-losing-quality", "jpg-vs-png-vs-webp"],
    },
]

def render_article(article):
    toc_html = "\n".join(f'<li><a href="#{sid}">{stitle}</a></li>' for sid, stitle in article["toc"])
    sections_html = ""
    for sid, stitle, content in article["sections"]:
        sections_html += f'<h2 id="{sid}">{stitle}</h2>\n{content}\n'

    faq_html = ""
    faq_schema = []
    for q, a in article["faq"]:
        faq_html += f'<div class="faq-item"><div class="faq-q">{q} <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg></div><div class="faq-a">{a}</div></div>\n'
        faq_schema.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})

    related_html = ""
    for slug in article["related"]:
        match = next((a for a in ARTICLES if a["slug"] == slug), None)
        if match:
            related_html += f'<a href="{match["slug"]}.html" class="blog-card"><span class="blog-tag">{match["tag"]}</span><h3>{match["title"]}</h3><p>{match["meta"]}</p></a>\n'

    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article["title"],
        "description": article["meta"],
        "author": {"@type": "Organization", "name": "ToolFlight"},
        "publisher": {"@type": "Organization", "name": "ToolFlight"},
    }
    import json as _json
    faq_page_schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq_schema,
    }

    body = f"""<div class="article-shell">
  <div class="article-meta-row">
    <span class="badge">{article["tag"]}</span>
    <span style="font-size:12px;color:var(--ink-soft);">{article["reading_time"]} min read</span>
  </div>
  <h1>{article["title"]}</h1>
  <p class="article-lede">{article["lede"]}</p>

  <div class="toc-box">
    <h2>Table of contents</h2>
    <ol>
{toc_html}
    </ol>
  </div>

  <div class="article-body">
{sections_html}
  </div>

  <section style="margin-top:38px;">
    <h2 style="font-size:19px;font-weight:800;margin-bottom:10px;">Frequently asked questions</h2>
    {faq_html}
  </section>

  <section style="margin-top:38px;">
    <h2 style="font-size:19px;font-weight:800;margin-bottom:6px;">Related articles</h2>
    <div class="related-grid">
{related_html}
    </div>
  </section>
</div>
<script type="application/ld+json">{_json.dumps(schema)}</script>
<script type="application/ld+json">{_json.dumps(faq_page_schema)}</script>
"""
    return body

# Blog articles live in /blog/, so relative asset paths need one extra "../"
def head_for_blog(title, description, og_path):
    h = head(title, description, og_path)
    return (h.replace('href="assets/', 'href="../assets/')
             .replace('href="css/style.css?', 'href="../css/style.css?'))

def navbar_for_blog(active_file):
    n = navbar(active_file)
    return (n.replace('href="index.html"', 'href="../index.html"')
             .replace('href="pdf-tools.html"', 'href="../pdf-tools.html"')
             .replace('href="image-tools.html"', 'href="../image-tools.html"')
             .replace('href="calculators.html"', 'href="../calculators.html"')
             .replace('href="finance-tools.html"', 'href="../finance-tools.html"')
             .replace('href="seo-tools.html"', 'href="../seo-tools.html"')
             .replace('href="ai-tools.html"', 'href="../ai-tools.html"')
             .replace('href="blog.html"', 'href="../blog.html"')
             .replace('src="assets/', 'src="../assets/'))

def footer_for_blog():
    f = footer()
    return (f.replace('href="pdf-tools.html"', 'href="../pdf-tools.html"')
             .replace('href="image-tools.html"', 'href="../image-tools.html"')
             .replace('href="calculators.html"', 'href="../calculators.html"')
             .replace('href="finance-tools.html"', 'href="../finance-tools.html"')
             .replace('href="seo-tools.html"', 'href="../seo-tools.html"')
             .replace('href="ai-tools.html"', 'href="../ai-tools.html"')
             .replace('href="index.html#about-section"', 'href="../index.html#about-section"')
             .replace('href="index.html#faq"', 'href="../index.html#faq"')
             .replace('src="assets/', 'src="../assets/'))

os.makedirs(os.path.join(OUT, "blog"), exist_ok=True)

for article in ARTICLES:
    filename = article["slug"] + ".html"
    body = render_article(article)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
{head_for_blog(article["title"] + " | ToolFlight Blog", article["meta"], "blog/" + filename)}
</head>
<body>
{navbar_for_blog(filename)}
{body}
{footer_for_blog()}
<script defer src="../js/app.js?v={BUILD_VERSION}"></script>
</body>
</html>
"""
    path = os.path.join(OUT, "blog", filename)
    html = ensure_button_types(html)
    with open(path, "w") as f:
        f.write(html)
    print("wrote blog/" + filename, len(html), "chars")

# Blog listing page (blog.html at project root)
blog_cards = ""
for a in ARTICLES:
    blog_cards += f"""<a href="blog/{a['slug']}.html" class="blog-card">
      <span class="blog-tag">{a['tag']}</span>
      <h3>{a['title']}</h3>
      <p>{a['meta']}</p>
      <div class="blog-meta">{a['reading_time']} min read</div>
    </a>\n"""

blog_index_body = f"""<div class="hero-sub">
  <span class="hero-badge"><span class="dot"></span> Guides &amp; tips</span>
  <h1>ToolFlight Blog</h1>
  <p class="subtitle">Practical guides on PDFs, images, and getting the most out of free browser-based tools.</p>
</div>

<div class="container">
  <div class="blog-grid">
{blog_cards}
  </div>
</div>
"""

blog_html = ensure_button_types(page_shell("blog.html", "Blog — PDF & Image Guides | ToolFlight", "Practical guides on compressing images, merging PDFs, choosing image formats, and more free tool tips.", blog_index_body))
with open(os.path.join(OUT, "blog.html"), "w") as f:
    f.write(blog_html)
print("wrote blog.html", len(blog_html), "chars")


