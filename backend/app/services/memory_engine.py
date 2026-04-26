"""
memory_engine.py — Deterministic memory-update text builder.

Runs at vendor-job completion time. Produces a single markdown line that
the operator can save into the property's context.md (bumping its version).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models.tickets import Ticket
from app.models.vendor_jobs import VendorJob
from app.models.units import Unit
from app.models.vendors import Vendor


def generate(ticket: Ticket, vendor_job: VendorJob, db) -> str:
    """
    Build a one-line context update for the memory proposal.

    Format:
      "Unit {label} {symptom} fixed {date} by {vendor} (€{cost})."

    All sub-parts degrade gracefully if data is missing.
    """
    # Unit label
    unit_label = ""
    if ticket.unit_id:
        unit = db.query(Unit).filter(Unit.id == ticket.unit_id).first()
        if unit:
            unit_label = f"Unit {unit.label} "

    # Symptom — short-cut from subject (strip trailing "— Unit X" decoration)
    symptom = ticket.subject or "issue"
    if " — " in symptom:
        symptom = symptom.split(" — ")[0]
    if " - " in symptom:
        symptom = symptom.split(" - ")[0]
    symptom = symptom.lower().rstrip(".")

    # Vendor name
    vendor_name = "vendor"
    if vendor_job.vendor_id:
        v = db.query(Vendor).filter(Vendor.id == vendor_job.vendor_id).first()
        if v:
            vendor_name = v.name

    # Date
    completed = vendor_job.completed_at or datetime.now(timezone.utc)
    date_str = completed.date().isoformat()

    # Cost
    cost_str = ""
    if vendor_job.final_cost_eur is not None:
        cost_str = f" (€{int(vendor_job.final_cost_eur)})"

    return f"{unit_label}{symptom} fixed {date_str} by {vendor_name}{cost_str}."
