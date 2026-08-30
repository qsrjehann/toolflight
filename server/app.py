"""
ToolFlight PDF → Word Conversion Server
========================================
POST /api/pdf-to-word
  - Accept: multipart/form-data  { file: <PDF bytes> }
  - Returns: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - Errors: application/json { error: <message> }

All processing is in-memory. No files are ever written to disk.
Rate-limited to 10 requests per minute per IP.
CORS restricted to toolflight.com (and localhost for dev).
"""

import io
import os
import sys
import time
import tempfile
import logging

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("toolflight-pdf2word")

app = Flask(__name__)

# Allow requests from the production domain and local dev
ALLOWED_ORIGINS = [
    "https://toolflight.com",
    "https://www.toolflight.com",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500",   # VS Code Live Server
    "http://127.0.0.1:5500",
    # GitHub Pages test/staging deployment (e.g. https://qsrjehann.github.io/...)
    # -- CORS matches on origin only (scheme+host), not path, so this single
    # entry covers every repo/page served from that account's Pages site.
    # Safe to remove once the site is only ever served from toolflight.com.
    "https://qsrjehann.github.io",
]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# Rate limiting — 10 conversions per minute per IP (generous for a free tool)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["10 per minute"],
    storage_uri="memory://",
)

# Max upload size: 20 MB
MAX_FILE_BYTES = 20 * 1024 * 1024
PDF_MAGIC = b"%PDF"

# ---------------------------------------------------------------------------
# Lazy-import the heavy conversion libraries at first request
# (keeps cold-start time low on Render Free Tier)
# ---------------------------------------------------------------------------

_pdf2docx_Converter = None
_postprocess = None


def _ensure_libs():
    global _pdf2docx_Converter, _postprocess
    if _pdf2docx_Converter is None:
        from pdf2docx import Converter as _C
        _pdf2docx_Converter = _C
        log.info("pdf2docx loaded")
    if _postprocess is None:
        from postprocess_docx import postprocess as _pp
        _postprocess = _pp
        log.info("postprocess_docx loaded")


# ---------------------------------------------------------------------------
# Conversion helper
# ---------------------------------------------------------------------------

def convert_pdf_bytes_to_docx_bytes(pdf_bytes: bytes) -> bytes:
    """
    Run pdf2docx + post-processing entirely in temp files.
    Returns DOCX bytes. Temp files are cleaned up unconditionally.
    """
    _ensure_libs()

    tmp_pdf = tmp_docx_base = tmp_docx_out = None
    try:
        # Write PDF to a named temp file (pdf2docx requires a file path)
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_pdf = f.name

        tmp_docx_base = tmp_pdf.replace(".pdf", "_base.docx")
        tmp_docx_out  = tmp_pdf.replace(".pdf", "_out.docx")

        # Step 1: pdf2docx baseline conversion
        t0 = time.perf_counter()
        cv = _pdf2docx_Converter(tmp_pdf)
        cv.convert(tmp_docx_base, start=0, end=None)
        cv.close()
        log.info(f"pdf2docx: {time.perf_counter()-t0:.2f}s")

        # Step 2: Post-processing (callout boxes, column widths,
        #         section breaks, underlines)
        t1 = time.perf_counter()
        _postprocess(
            pdf_path=tmp_pdf,
            docx_in_path=tmp_docx_base,
            docx_out_path=tmp_docx_out,
            fixes=("section_breaks", "callout", "cols", "underline"),
        )
        log.info(f"postprocess: {time.perf_counter()-t1:.2f}s")

        with open(tmp_docx_out, "rb") as f:
            return f.read()

    finally:
        for path in (tmp_pdf, tmp_docx_base, tmp_docx_out):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def health():
    return jsonify({"status": "ok", "service": "toolflight-pdf2word"})


@app.get("/api/health")
def api_health():
    return jsonify({"status": "ok"})


@app.post("/api/pdf-to-word")
@limiter.limit("10 per minute")
def pdf_to_word():
    # ---- Validate request ----
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send the PDF as 'file' in multipart/form-data."}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename."}), 400

    pdf_bytes = f.read()

    if len(pdf_bytes) == 0:
        return jsonify({"error": "Uploaded file is empty."}), 400

    if len(pdf_bytes) > MAX_FILE_BYTES:
        mb = len(pdf_bytes) / (1024 * 1024)
        return jsonify({"error": f"File too large ({mb:.1f} MB). Maximum is 20 MB."}), 413

    # Magic-byte validation — must start with %PDF
    if not pdf_bytes[:4].startswith(PDF_MAGIC):
        return jsonify({"error": "Uploaded file does not appear to be a valid PDF."}), 400

    # ---- Convert ----
    try:
        t_start = time.perf_counter()
        docx_bytes = convert_pdf_bytes_to_docx_bytes(pdf_bytes)
        elapsed = time.perf_counter() - t_start
        log.info(f"Conversion OK: {len(pdf_bytes)//1024}KB PDF → {len(docx_bytes)//1024}KB DOCX in {elapsed:.1f}s")

        # Derive output filename from original
        orig_name = os.path.splitext(os.path.basename(f.filename))[0]
        out_name = (orig_name or "converted") + ".docx"

        return send_file(
            io.BytesIO(docx_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            as_attachment=True,
            download_name=out_name,
        )

    except Exception as exc:
        log.exception("Conversion failed")
        return jsonify({"error": f"Conversion failed: {str(exc)[:200]}"}), 500


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests. Please wait a moment and try again."}), 429


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    log.info(f"Starting ToolFlight PDF→Word server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
