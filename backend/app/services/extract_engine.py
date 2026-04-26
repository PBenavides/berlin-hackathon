"""
extract_engine.py — PDF/document extraction → proposed context diffs.

A hackathon stub: produces deterministic fake `proposedDiffs[]` so the wire
works end-to-end. Each diff matches the API.md shape:
  {layer, heading, before, after, rationale, confidence}

Real implementation would: extract PDF text → call LLM → diff against the
property's current context.md per layer. The stub keeps the pipeline shape
intact so swapping in a real LLM call later is a one-function change.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.context_versions import ContextVersion
from app.models.extractions import Extraction
from app.services.context_layer_service import parse_layers


def _latest_context_md(db: Session, property_id: str) -> str:
    cv = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    return cv.content_md if cv else ""


def _stub_diffs(
    db: Session,
    property_id: Optional[str],
    layer_hint: Optional[str],
    filename: str,
) -> List[Dict[str, Any]]:
    """
    Build 1-2 plausible diffs against the current context. Picks the hinted
    layer (or 'building' by default) and proposes a small annotation.
    """
    target_layer = (layer_hint or "building").lower()
    if target_layer not in {"vendor", "owner", "building", "property"}:
        target_layer = "building"

    before = ""
    if property_id:
        layers = parse_layers(_latest_context_md(db, property_id))
        before = layers.get(target_layer, {}).get("raw", "")[:200]

    annotation = f"[Extracted from {filename}: annual service confirmed]"
    after = (before + "\n" + annotation).strip() if before else annotation

    return [
        {
            "layer": target_layer,
            "heading": "Systems" if target_layer == "building" else target_layer.title(),
            "before": before,
            "after": after,
            "rationale": f"Document '{filename}' references {target_layer}-layer facts not currently captured.",
            "confidence": 0.78,
        }
    ]


def run_extraction(
    extraction_id: str,
    property_id: Optional[str],
    layer_hint: Optional[str],
    filename: str,
    file_bytes: bytes,
    delay_seconds: float = 1.0,
) -> None:
    """
    Background-task entry point. Runs in its own DB session.
    Updates the extraction row to status='done' (or 'failed') with diffs.
    """
    time.sleep(delay_seconds)  # simulate processing latency
    db = SessionLocal()
    try:
        ext = db.query(Extraction).filter(Extraction.id == extraction_id).first()
        if ext is None:
            return
        try:
            diffs = _stub_diffs(db, property_id, layer_hint, filename)
            ext.proposed_diffs = diffs
            ext.status = "done"
        except Exception as e:
            ext.status = "failed"
            ext.error = f"{type(e).__name__}: {e}"
        db.commit()
    finally:
        db.close()
