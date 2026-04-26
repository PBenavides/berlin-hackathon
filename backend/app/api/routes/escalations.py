"""
GET /api/escalations — operator's "what's on fire" view.

Ranking:
  1. risk='high' tickets (any non-terminal status)
  2. SLA-violation tickets in risk='medium': vendor_job.scheduled_for in the
     past AND completed_at IS NULL.

Excludes terminal statuses (resolved, rejected). Returns the same nested
Ticket DTO as GET /api/tickets/:id so the frontend doesn't special-case it.
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tickets import Ticket
from app.models.vendor_jobs import VendorJob
from app.schemas.tickets import TicketDetail
from app.api.routes.tickets import build_ticket_detail

router = APIRouter()

_TERMINAL = {"resolved", "rejected"}


@router.get("/escalations", response_model=List[TicketDetail])
def list_escalations(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # Bucket 1: high-risk, non-terminal
    high_risk = (
        db.query(Ticket)
        .filter(Ticket.risk == "high", ~Ticket.status.in_(_TERMINAL))
        .order_by(Ticket.created_at.desc())
        .all()
    )

    # Bucket 2: medium-risk with SLA violation
    sla_violators = (
        db.query(Ticket)
        .join(VendorJob, VendorJob.ticket_id == Ticket.id)
        .filter(
            Ticket.risk == "medium",
            ~Ticket.status.in_(_TERMINAL),
            VendorJob.scheduled_for.isnot(None),
            VendorJob.scheduled_for < now,
            VendorJob.completed_at.is_(None),
        )
        .order_by(VendorJob.scheduled_for.asc())
        .all()
    )

    # Dedupe while preserving order (high first, then SLA violators)
    seen: set[str] = set()
    ordered: list[Ticket] = []
    for t in high_risk + sla_violators:
        if t.id not in seen:
            seen.add(t.id)
            ordered.append(t)

    return [build_ticket_detail(db, t) for t in ordered]
