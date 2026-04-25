"""PDF text extraction.

Used by the documents flow to pull plain text out of an uploaded PDF so it
can later be fed into a Hermes profile as ambient context. Keep this module
dependency-light: it should not import database or FastAPI types.
"""
from typing import List, Optional, TypedDict

import pypdf


# Hard cap on extracted characters per document. Anything longer is truncated
# (with `truncated=True` flagged) so a single huge PDF cannot blow up the row
# size or the eventual prompt budget.
MAX_EXTRACT_CHARS = 200_000


class PdfExtractionResult(TypedDict):
    full_text: str
    page_count: int
    truncated: bool
    error: Optional[str]


def extract_text(path: str) -> PdfExtractionResult:
    """Read a PDF from disk and return its text content.

    Returns a result dict either way — callers should check `error` rather
    than catch exceptions. An empty `full_text` with no `error` indicates a
    scanned/image-only PDF that has no embedded text layer.
    """
    try:
        reader = pypdf.PdfReader(path)
    except Exception as exc:  # encrypted, corrupted, not a PDF, etc.
        return {
            "full_text": "",
            "page_count": 0,
            "truncated": False,
            "error": f"failed_to_open: {type(exc).__name__}: {str(exc)[:200]}",
        }

    pages: List[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            # Per-page failure: keep going so a single bad page doesn't lose
            # the rest of the document.
            pages.append("")

    full_text = "\n\n".join(p for p in pages if p)
    truncated = len(full_text) > MAX_EXTRACT_CHARS
    if truncated:
        full_text = full_text[:MAX_EXTRACT_CHARS]

    return {
        "full_text": full_text,
        "page_count": len(pages),
        "truncated": truncated,
        "error": None,
    }
