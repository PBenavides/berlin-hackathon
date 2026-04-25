"""Integration tests for /api/properties/{id}/documents and /documents/*.

These exercise the full HTTP stack against a real Postgres (the same DB the
dev server uses). Each test cleans up the rows + files it creates.
"""
import io
import os

import pypdf
import pytest
from sqlalchemy import text

from app.database import SessionLocal
from app.models.properties import Property
from app.models.property_documents import PropertyDocument


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_pdf_bytes(text_lines):
    """Build a minimal PDF in memory and return its bytes."""
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=612, height=792)

    from pypdf.generic import (
        ContentStream,
        DictionaryObject,
        NameObject,
    )

    content_lines = [b"BT", b"/F1 12 Tf", b"72 720 Td"]
    for line in text_lines:
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

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture
def property_id():
    """Pick the first existing property; tests don't mutate it directly."""
    db = SessionLocal()
    try:
        prop = db.query(Property).first()
        assert prop, "No property in DB — seed before running integration tests"
        return prop.id
    finally:
        db.close()


@pytest.fixture
def cleanup():
    """Track document IDs created in a test and tear them down at the end."""
    created_ids = []

    def _track(doc_id):
        created_ids.append(doc_id)

    yield _track

    db = SessionLocal()
    try:
        for doc_id in created_ids:
            doc = (
                db.query(PropertyDocument)
                .filter(PropertyDocument.id == doc_id)
                .first()
            )
            if doc:
                path = doc.storage_path
                db.delete(doc)
                if path and os.path.isfile(path):
                    try:
                        os.remove(path)
                    except OSError:
                        pass
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# POST /properties/{id}/documents
# ---------------------------------------------------------------------------


def test_upload_pdf_happy_path(client, property_id, cleanup):
    pdf = _make_pdf_bytes(["Invoice 2026", "Total: 1234"])
    resp = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("invoice.pdf", pdf, "application/pdf")},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    cleanup(body["id"])

    assert body["propertyId"] == property_id
    assert body["filename"] == "invoice.pdf"
    assert body["mimeType"] == "application/pdf"
    assert body["sizeBytes"] == len(pdf)
    assert body["pageCount"] == 1
    assert body["extractionError"] is None
    assert body["hasExtractedText"] is True
    assert body["fileUrl"] == f"/api/documents/{body['id']}/file"
    assert body["extractedText"]  # non-empty


def test_upload_rejects_non_pdf(client, property_id):
    resp = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("note.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 415


def test_upload_rejects_empty(client, property_id):
    resp = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert resp.status_code == 400


def test_upload_unknown_property_404(client):
    pdf = _make_pdf_bytes(["x"])
    resp = client.post(
        "/api/properties/00000000-0000-0000-0000-000000000000/documents",
        files={"file": ("x.pdf", pdf, "application/pdf")},
    )
    assert resp.status_code == 404


def test_upload_too_large_413(client, property_id, monkeypatch):
    """Drop the size cap to a tiny number to exercise the 413 path."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "max_document_bytes", 100)
    # Clear lru_cache so route picks up modified settings
    get_settings.cache_clear()
    monkeypatch.setattr(
        "app.api.routes.documents.get_settings",
        lambda: settings,
    )

    pdf = _make_pdf_bytes(["a" * 500])
    assert len(pdf) > 100  # sanity
    resp = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("big.pdf", pdf, "application/pdf")},
    )
    assert resp.status_code == 413


def test_upload_accepts_pdf_with_wrong_content_type(client, property_id, cleanup):
    """Browsers sometimes send octet-stream — we should accept by magic bytes."""
    pdf = _make_pdf_bytes(["fallback"])
    resp = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("doc.pdf", pdf, "application/octet-stream")},
    )
    assert resp.status_code == 201, resp.text
    cleanup(resp.json()["id"])


# ---------------------------------------------------------------------------
# GET endpoints
# ---------------------------------------------------------------------------


def test_list_documents(client, property_id, cleanup):
    pdf = _make_pdf_bytes(["listing test"])
    up = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("list.pdf", pdf, "application/pdf")},
    )
    assert up.status_code == 201
    cleanup(up.json()["id"])

    resp = client.get(f"/api/properties/{property_id}/documents")
    assert resp.status_code == 200
    rows = resp.json()
    assert any(r["id"] == up.json()["id"] for r in rows)
    # Summary view should NOT include extractedText
    assert "extractedText" not in rows[0]


def test_list_documents_unknown_property_404(client):
    resp = client.get(
        "/api/properties/00000000-0000-0000-0000-000000000000/documents"
    )
    assert resp.status_code == 404


def test_get_document_detail(client, property_id, cleanup):
    pdf = _make_pdf_bytes(["detail test 42"])
    up = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("detail.pdf", pdf, "application/pdf")},
    ).json()
    cleanup(up["id"])

    resp = client.get(f"/api/documents/{up['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == up["id"]
    assert body["extractedText"] == up["extractedText"]


def test_get_document_404(client):
    resp = client.get("/api/documents/does-not-exist-id")
    assert resp.status_code == 404


def test_download_document_file(client, property_id, cleanup):
    pdf = _make_pdf_bytes(["download me"])
    up = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("dl.pdf", pdf, "application/pdf")},
    ).json()
    cleanup(up["id"])

    resp = client.get(f"/api/documents/{up['id']}/file")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    # File bytes should match what we uploaded
    assert resp.content[:8] == b"%PDF-1.3" or resp.content.startswith(b"%PDF-")


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------


def test_delete_document(client, property_id):
    pdf = _make_pdf_bytes(["delete me"])
    up = client.post(
        f"/api/properties/{property_id}/documents",
        files={"file": ("del.pdf", pdf, "application/pdf")},
    ).json()
    storage_path = None

    db = SessionLocal()
    try:
        doc = (
            db.query(PropertyDocument)
            .filter(PropertyDocument.id == up["id"])
            .first()
        )
        storage_path = doc.storage_path
    finally:
        db.close()

    resp = client.delete(f"/api/documents/{up['id']}")
    assert resp.status_code == 204

    # Row should be gone
    resp2 = client.get(f"/api/documents/{up['id']}")
    assert resp2.status_code == 404

    # File on disk should be gone
    if storage_path:
        assert not os.path.isfile(storage_path)


def test_delete_document_404(client):
    resp = client.delete("/api/documents/does-not-exist-id")
    assert resp.status_code == 404
