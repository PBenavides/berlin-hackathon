"""Unit tests for app.services.pdf_service.

These don't touch the DB or HTTP — they verify the extraction primitive in
isolation against fixture PDFs we build on the fly with pypdf so the suite is
self-contained.
"""
import io
import os

import pypdf
import pytest

from app.services.pdf_service import MAX_EXTRACT_CHARS, extract_text


def _write_pdf(tmp_path, pages_text):
    """Generate a real PDF whose pages contain the given text.

    pypdf's PdfWriter does not have a high-level "add a text page" helper, so
    we hand-build a minimal page using PageObject.create_blank_page and inject
    a content stream that draws each line. This is enough to exercise the
    text-extraction path round-trip.
    """
    writer = pypdf.PdfWriter()
    for text in pages_text:
        page = writer.add_blank_page(width=612, height=792)
        # Build a minimal content stream that draws the text using the built-in
        # Helvetica font. We declare the font in the page resources so pypdf's
        # extractor can resolve it.
        from pypdf.generic import (
            ContentStream,
            DictionaryObject,
            NameObject,
            create_string_object,
        )

        content_lines = [b"BT", b"/F1 12 Tf", b"72 720 Td"]
        for line in text.split("\n"):
            content_lines.append(b"(" + line.encode("latin-1", "replace") + b") Tj")
            content_lines.append(b"0 -14 Td")
        content_lines.append(b"ET")
        cs = ContentStream(None, writer)
        cs.set_data(b"\n".join(content_lines))
        page[NameObject("/Contents")] = cs

        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        resources = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
        })
        page[NameObject("/Resources")] = resources

    out = tmp_path / "doc.pdf"
    with open(out, "wb") as fh:
        writer.write(fh)
    return str(out)


def test_extract_text_happy_path(tmp_path):
    path = _write_pdf(tmp_path, ["Hello world", "Second page"])
    result = extract_text(path)

    assert result["error"] is None
    assert result["page_count"] == 2
    assert result["truncated"] is False
    # Text extraction is fuzzy on hand-built PDFs, but at minimum we should
    # get *some* characters back from a non-image PDF.
    assert "Hello" in result["full_text"] or "world" in result["full_text"]


def test_extract_text_corrupted_input(tmp_path):
    path = tmp_path / "broken.pdf"
    path.write_bytes(b"not a real pdf at all")

    result = extract_text(str(path))

    assert result["error"] is not None
    assert result["error"].startswith("failed_to_open")
    assert result["page_count"] == 0
    assert result["full_text"] == ""


def test_extract_text_missing_file(tmp_path):
    path = str(tmp_path / "does-not-exist.pdf")
    result = extract_text(path)
    assert result["error"] is not None
    assert result["page_count"] == 0


def test_extract_text_image_only_pdf(tmp_path):
    """A PDF with no text layer should return empty text but no error."""
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=612, height=792)
    out = tmp_path / "blank.pdf"
    with open(out, "wb") as fh:
        writer.write(fh)

    result = extract_text(str(out))
    assert result["error"] is None
    assert result["page_count"] == 1
    assert result["full_text"] == ""
    assert result["truncated"] is False


def test_extract_text_truncates_to_cap(tmp_path, monkeypatch):
    """Drop the cap to a tiny value to verify the truncation path."""
    monkeypatch.setattr(
        "app.services.pdf_service.MAX_EXTRACT_CHARS", 10
    )
    path = _write_pdf(tmp_path, ["A" * 200])
    result = extract_text(path)

    # Either we got real text and it was truncated, or extraction yielded
    # empty text (which is fine for a hand-built PDF). The interesting
    # assertion: when text *is* produced, it must be capped.
    if result["full_text"]:
        assert len(result["full_text"]) <= 10
        assert result["truncated"] is True


def test_max_extract_chars_default():
    assert MAX_EXTRACT_CHARS == 200_000
