from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.tickets import Ticket
from app.models.properties import Property
from app.models.agent_proposals import AgentProposal
from app.schemas.tickets import TicketOut, TicketCreate
from app.schemas.proposals import AgentProposalOut
from app.services.audit_service import create_audit_entry

router = APIRouter()


class TicketWithProposal(TicketOut):
    proposal: Optional[AgentProposalOut] = None


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

    ticket = Ticket(
        property_id=payload.property_id,
        source=payload.source,
        external_id=payload.external_id,
        raised_by=payload.raised_by,
        subject=payload.subject,
        body=payload.body,
        status="open",
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
        metadata={"source": payload.source, "subject": payload.subject},
    )
    db.commit()
    db.refresh(ticket)

    # Trigger proposal pipeline asynchronously (synchronous in MVP)
    try:
        from app.services.ticket_pipeline import run_pipeline
        run_pipeline(ticket.id, db)
    except Exception as e:
        # Pipeline failure should not fail ticket creation
        print(f"[pipeline] Warning: pipeline failed for ticket {ticket.id}: {e}")

    return ticket


@router.get("/properties/{property_id}/tickets", response_model=List[TicketOut])
def list_property_tickets(
    property_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all tickets for a property, optionally filtered by status."""
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    query = db.query(Ticket).filter(Ticket.property_id == property_id)
    if status:
        query = query.filter(Ticket.status == status)

    return query.order_by(Ticket.created_at.desc()).all()


@router.get("/tickets/{ticket_id}", response_model=TicketWithProposal)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Get a single ticket with its latest proposal."""
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
