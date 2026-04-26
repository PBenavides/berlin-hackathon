from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from app.database import get_db
from app.models import (
    Property, ContextVersion, ContextChunk, PropertyPolicy, ContextSource,
    Ticket, AgentProposal, AuditLog, OwnerMessage, Attachment, AgentAction,
    AgentActivityEntry,
)
from app.models.properties import Property as PropertyModel
from app.models.owners import Owner
from app.models.buildings import Building
from app.models.building_vendors import BuildingVendor
from app.models.vendors import Vendor
from app.models.vendor_cases import VendorCase
from app.models.units import Unit
from app.models.call_sessions import CallSession
from app.models.vendor_jobs import VendorJob
from app.models.extractions import Extraction
from app.models.property_ticket_counters import PropertyTicketCounter
from app.schemas.tickets import TicketOut, VendorJobOut
from app.seed import TICKET_TEMPLATES, run_seed
from app.services.audit_service import create_audit_entry
from app.services import vendor_job_service

router = APIRouter()


class SimulateTicketRequest(BaseModel):
    template_id: str


class CompleteVendorJobRequest(BaseModel):
    final_cost_eur: float | None = None
    notes: str | None = None


@router.post("/dev/reset")
def reset_database(db: Session = Depends(get_db)):
    """
    Drop all data and re-seed the database with the full demo dataset.
    WARNING: Destructive operation — for dev/demo use only.
    Idempotent: calling reset twice produces the same state.
    """
    # Sprint 3: stop the auto-solve queue before resetting
    from app.services import agent_queue_service
    agent_queue_service.stop_queue()

    # Delete in reverse FK dependency order
    db.query(AgentActivityEntry).delete()  # Sprint 3: activity feed
    db.query(AuditLog).delete()
    db.query(AgentAction).delete()   # Sprint 2: agent action streaming records
    db.query(Attachment).delete()
    db.query(OwnerMessage).delete()
    db.query(VendorJob).delete()
    db.query(CallSession).delete()
    db.query(Extraction).delete()
    db.query(PropertyTicketCounter).delete()
    db.query(AgentProposal).delete()
    db.query(Ticket).delete()
    db.query(Unit).delete()
    db.query(ContextSource).delete()
    db.query(PropertyPolicy).delete()
    db.query(ContextChunk).delete()
    db.query(ContextVersion).delete()
    db.query(VendorCase).delete()
    db.query(BuildingVendor).delete()
    db.query(Property).delete()
    db.query(Building).delete()
    db.query(Vendor).delete()
    db.query(Owner).delete()
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

    # Auto-generate ticket number
    ticket_num = None
    try:
        from app.services.ticket_number_service import next_ticket_num
        ticket_num = next_ticket_num(db, prop.id)
    except Exception:
        pass

    from app.models.tickets import Ticket
    ticket = Ticket(
        property_id=prop.id,
        source=template["source"],
        raised_by=template["raised_by"],
        subject=template["subject"],
        body=template["body"],
        status="new",
        num=ticket_num,
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


@router.post("/dev/complete-vendor-job/{job_id}", response_model=VendorJobOut)
def dev_complete_vendor_job(
    job_id: str,
    payload: CompleteVendorJobRequest | None = None,
    db: Session = Depends(get_db),
):
    """
    Mark a vendor job complete (lifecycle terminal state). Mirrors the ticket
    to 'completed' and runs the memory engine to fill the proposal's
    final_context_update_md so the operator's memory decision becomes visible.

    Dev-only shortcut for the demo flow — production would receive this via
    a vendor webhook.
    """
    cost = payload.final_cost_eur if payload else None
    notes = payload.notes if payload else None
    job = vendor_job_service.complete(db, job_id, final_cost_eur=cost, notes=notes)
    db.commit()
    db.refresh(job)
    return job


@router.post("/dev/test-conflict")
def dev_test_conflict():
    """Force-trigger the StateConflictError handler (for envelope tests)."""
    from app.exceptions import StateConflictError
    raise StateConflictError("Synthetic conflict for envelope testing")
