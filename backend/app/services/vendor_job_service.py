"""
vendor_job_service.py — Vendor-job lifecycle helpers.

Lifecycle: dispatched → accepted → scheduled → in_progress → completed
Side-effect: ticket.status mirrors the lifecycle so the operator UI stays in sync.

Single source of truth for state transitions. Routes call these helpers
instead of poking the model fields directly.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.exceptions import StateConflictError
from app.models.tickets import Ticket
from app.models.vendor_jobs import VendorJob
from app.models.agent_proposals import AgentProposal
from app.services.audit_service import create_audit_entry
from app.services import memory_engine


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _latest_proposal(db: Session, ticket_id: str) -> Optional[AgentProposal]:
    return (
        db.query(AgentProposal)
        .filter(AgentProposal.ticket_id == ticket_id)
        .order_by(AgentProposal.created_at.desc())
        .first()
    )


def dispatch(db: Session, ticket: Ticket, vendor_id: Optional[str], job_id: Optional[str] = None) -> VendorJob:
    """
    Create a VendorJob row in the same transaction as the approve. Sets
    sent_at=now and mirrors the ticket to 'awaiting_vendor'. Caller must commit.
    """
    if job_id is None:
        # Stable id derived from ticket id: t-7831 → vj-7831
        suffix = ticket.id.split("-", 1)[-1] if "-" in ticket.id else ticket.id
        job_id = f"vj-{suffix}"

    # Idempotency: if a job already exists for this ticket, return it
    existing = (
        db.query(VendorJob)
        .filter(VendorJob.ticket_id == ticket.id)
        .order_by(VendorJob.created_at.desc())
        .first()
    )
    if existing is not None:
        return existing

    job = VendorJob(
        id=job_id,
        ticket_id=ticket.id,
        vendor_id=vendor_id,
        sent_at=_utcnow(),
        accepted=None,
        scheduled_for=None,
        completed_at=None,
    )
    db.add(job)
    ticket.status = "awaiting_vendor"
    db.flush()
    return job


def complete(db: Session, job_id: str, final_cost_eur: Optional[float] = None, notes: Optional[str] = None) -> VendorJob:
    """
    Mark the vendor job complete, mirror ticket to 'completed', and run the
    memory engine to fill agent_proposals.final_context_update_md.

    Idempotent on completed_at — re-completing a finished job is a no-op.
    """
    job = db.query(VendorJob).filter(VendorJob.id == job_id).first()
    if job is None:
        raise StateConflictError(f"Vendor job '{job_id}' not found")

    if job.completed_at is not None:
        return job  # idempotent

    job.completed_at = _utcnow()
    if final_cost_eur is not None:
        job.final_cost_eur = final_cost_eur
    if notes is not None:
        job.notes = notes

    ticket = db.query(Ticket).filter(Ticket.id == job.ticket_id).first()
    if ticket is not None:
        ticket.status = "completed"

    # Run memory engine — populate proposal.final_context_update_md
    proposal = _latest_proposal(db, job.ticket_id)
    if proposal is not None and ticket is not None:
        proposal.final_context_update_md = memory_engine.generate(ticket, job, db)

    create_audit_entry(
        db,
        actor="vendor",
        action="vendor_job.complete",
        entity_type="vendor_job",
        property_id=ticket.property_id if ticket else None,
        entity_id=job.id,
        metadata={"final_cost_eur": float(job.final_cost_eur) if job.final_cost_eur else None},
    )
    db.flush()
    return job


def has_completed_job(db: Session, ticket_id: str) -> bool:
    """Memory write gate: only true when at least one vendor_job has completed."""
    return (
        db.query(VendorJob)
        .filter(
            VendorJob.ticket_id == ticket_id,
            VendorJob.completed_at.isnot(None),
        )
        .first()
        is not None
    )
