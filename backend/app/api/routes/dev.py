from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.database import get_db, engine, Base
from app.models import Property, ContextVersion, ContextChunk, PropertyPolicy, ContextSource, Ticket, AgentProposal, AuditLog
from app.models.properties import Property as PropertyModel
from app.schemas.tickets import TicketOut
from app.seed import TICKET_TEMPLATES, run_seed
from app.services.audit_service import create_audit_entry

router = APIRouter()


class SimulateTicketRequest(BaseModel):
    template_id: str


@router.post("/dev/reset")
def reset_database(db: Session = Depends(get_db)):
    """
    Drop all data and re-seed the database.
    WARNING: Destructive operation — for dev/demo use only.
    """
    # Delete in reverse FK order
    db.query(AuditLog).delete()
    db.query(AgentProposal).delete()
    db.query(Ticket).delete()
    db.query(ContextSource).delete()
    db.query(PropertyPolicy).delete()
    db.query(ContextChunk).delete()
    db.query(ContextVersion).delete()
    db.query(Property).delete()
    db.commit()

    result = run_seed(db)
    return {"message": "Database reset and re-seeded", "seed_result": result}


@router.post("/dev/simulate-ticket", response_model=TicketOut, status_code=201)
def simulate_ticket(
    request: SimulateTicketRequest,
    db: Session = Depends(get_db),
):
    """Create a ticket from a predefined template."""
    template = next((t for t in TICKET_TEMPLATES if t["id"] == request.template_id), None)
    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"Template '{request.template_id}' not found. Available: {[t['id'] for t in TICKET_TEMPLATES]}",
        )

    # Find property by name
    prop = (
        db.query(PropertyModel)
        .filter(PropertyModel.name == template["property"])
        .first()
    )
    if not prop:
        raise HTTPException(
            status_code=422,
            detail=f"Property '{template['property']}' not found in database. Run /dev/reset first.",
        )

    from app.models.tickets import Ticket
    ticket = Ticket(
        property_id=prop.id,
        source=template["source"],
        raised_by=template["raised_by"],
        subject=template["subject"],
        body=template["body"],
        status="open",
    )
    db.add(ticket)
    db.flush()

    create_audit_entry(
        db,
        actor="dev-simulator",
        action="ticket.create",
        entity_type="ticket",
        property_id=prop.id,
        entity_id=ticket.id,
        metadata={"template_id": template["id"], "template_name": template["name"]},
    )
    db.commit()
    db.refresh(ticket)

    # Trigger the proposal pipeline
    try:
        from app.services.ticket_pipeline import run_pipeline
        run_pipeline(ticket.id, db)
        db.refresh(ticket)
    except Exception as e:
        print(f"[pipeline] Warning: pipeline failed for ticket {ticket.id}: {e}")

    return ticket


@router.get("/dev/ticket-templates")
def list_ticket_templates():
    """List all available ticket simulation templates."""
    return {"templates": TICKET_TEMPLATES}
