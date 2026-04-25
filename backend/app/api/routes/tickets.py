from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.tickets import Ticket, VALID_TICKET_STATUSES
from app.models.properties import Property
from app.models.agent_proposals import AgentProposal
from app.schemas.tickets import TicketOut, TicketCreate, RejectRequest
from app.schemas.proposals import AgentProposalOut
from app.services.audit_service import create_audit_entry

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TicketWithProposal(TicketOut):
    """Ticket enriched with its latest proposal."""
    proposal: Optional[AgentProposalOut] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_status(status: str) -> None:
    if status not in VALID_TICKET_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Valid values: {', '.join(sorted(VALID_TICKET_STATUSES))}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/tickets", response_model=TicketOut, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new ticket for a property and trigger the proposal pipeline.
    property_id must be included in the request body.
    """
    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # Auto-generate ticket number if counter is available
    ticket_num: Optional[str] = None
    try:
        from app.services.ticket_number_service import next_ticket_num
        ticket_num = next_ticket_num(db, payload.property_id)
    except Exception:
        pass  # num remains None if no counter configured

    ticket = Ticket(
        property_id=payload.property_id,
        unit_id=payload.unit_id,
        source=payload.source,
        external_id=payload.external_id,
        raised_by=payload.raised_by,
        raised_by_phone=payload.raised_by_phone,
        subject=payload.subject,
        body=payload.body,
        excerpt=payload.excerpt,
        risk=payload.risk,
        confidence=payload.confidence,
        status="new",
        num=ticket_num,
    )
    db.add(ticket)
    db.flush()

    create_audit_entry(
        db,
        actor="api",
        action="ticket.create",
        entity_type="ticket",
        property_id=payload.property_id,
        entity_id=ticket.id,
        metadata={"source": payload.source, "subject": payload.subject, "num": ticket_num},
    )
    db.commit()
    db.refresh(ticket)

    # Trigger proposal pipeline synchronously in MVP
    try:
        from app.services.ticket_pipeline import run_pipeline
        run_pipeline(ticket.id, db)
    except Exception as e:
        print(f"[pipeline] Warning: pipeline failed for ticket {ticket.id}: {e}")

    return ticket


@router.get("/tickets", response_model=List[TicketOut])
def list_all_tickets(
    property_id: Optional[str] = None,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List tickets across all properties.
    Supports query params: ?propertyId=p1, ?status=proposed, ?risk=high
    """
    query = db.query(Ticket)

    if property_id:
        query = query.filter(Ticket.property_id == property_id)

    if status:
        _validate_status(status)
        query = query.filter(Ticket.status == status)

    if risk:
        valid_risks = {"low", "medium", "high"}
        if risk not in valid_risks:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid risk '{risk}'. Valid values: {', '.join(sorted(valid_risks))}",
            )
        query = query.filter(Ticket.risk == risk)

    return query.order_by(Ticket.created_at.desc()).all()


@router.get("/properties/{property_id}/tickets", response_model=List[TicketOut])
def list_property_tickets(
    property_id: str,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all tickets for a specific property."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    query = db.query(Ticket).filter(Ticket.property_id == property_id)
    if status:
        _validate_status(status)
        query = query.filter(Ticket.status == status)
    if risk:
        query = query.filter(Ticket.risk == risk)

    return query.order_by(Ticket.created_at.desc()).all()


@router.get("/tickets/{ticket_id}", response_model=TicketWithProposal)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """
    Get a single ticket with its latest proposal.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    proposal = (
        db.query(AgentProposal)
        .filter(AgentProposal.ticket_id == ticket_id)
        .order_by(AgentProposal.created_at.desc())
        .first()
    )

    result = TicketWithProposal.model_validate(ticket)
    result.proposal = AgentProposalOut.model_validate(proposal) if proposal else None
    return result


@router.post("/tickets/{ticket_id}/approve", response_model=TicketOut)
def approve_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Operator approves the agent proposal for a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    allowed_from = {"proposed"}
    if ticket.status not in allowed_from:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot approve ticket with status '{ticket.status}'. Must be 'proposed'.",
        )

    ticket.status = "approved"
    create_audit_entry(
        db,
        actor="operator",
        action="ticket.approve",
        entity_type="ticket",
        property_id=ticket.property_id,
        entity_id=ticket_id,
        metadata={"from_status": "proposed", "to_status": "approved"},
    )
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/reject", response_model=TicketOut)
def reject_ticket(
    ticket_id: str,
    payload: Optional[RejectRequest] = None,
    db: Session = Depends(get_db),
):
    """Operator rejects the agent proposal for a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status in {"resolved", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail=f"Ticket is already '{ticket.status}' and cannot be rejected again.",
        )

    ticket.status = "rejected"
    create_audit_entry(
        db,
        actor="operator",
        action="ticket.reject",
        entity_type="ticket",
        property_id=ticket.property_id,
        entity_id=ticket_id,
        metadata={"reason": payload.reason if payload else None},
    )
    db.commit()
    db.refresh(ticket)
    return ticket
