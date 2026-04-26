from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional

from app.database import get_db
from app.exceptions import StateConflictError
from app.models.tickets import Ticket, VALID_TICKET_STATUSES
from app.models.properties import Property
from app.models.agent_proposals import AgentProposal
from app.models.call_sessions import CallSession
from app.models.vendor_jobs import VendorJob
from app.models.context_versions import ContextVersion
from app.schemas.tickets import (
    TicketOut,
    TicketCreate,
    TicketDetail,
    RejectRequest,
    ProposalForTicket,
    CallSessionOut,
    VendorJobOut,
    MemoryProposalOut,
    ApproveResponse,
    MemorySaveResponse,
    MemorySkipResponse,
)
from app.services.audit_service import create_audit_entry
from app.services import vendor_job_service
from app.services.context_service import create_context_chunks, get_next_version

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_status(status: str) -> None:
    if status not in VALID_TICKET_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Valid values: {', '.join(sorted(VALID_TICKET_STATUSES))}",
        )


def _get_ticket_or_404(db: Session, ticket_id: str) -> Ticket:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return t


def _latest_proposal(db: Session, ticket_id: str) -> Optional[AgentProposal]:
    return (
        db.query(AgentProposal)
        .filter(AgentProposal.ticket_id == ticket_id)
        .order_by(AgentProposal.created_at.desc())
        .first()
    )


def _latest_vendor_job(db: Session, ticket_id: str) -> Optional[VendorJob]:
    return (
        db.query(VendorJob)
        .filter(VendorJob.ticket_id == ticket_id)
        .order_by(VendorJob.created_at.desc())
        .first()
    )


def _latest_call_session(db: Session, ticket_id: str) -> Optional[CallSession]:
    return (
        db.query(CallSession)
        .filter(CallSession.ticket_id == ticket_id)
        .order_by(CallSession.created_at.desc())
        .first()
    )


def _latest_context_version(db: Session, property_id: str) -> Optional[ContextVersion]:
    return (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )


def _build_proposal_dto(
    proposal: AgentProposal, context_version_int: Optional[int]
) -> ProposalForTicket:
    """Translate internal AgentProposal → API-contract ProposalForTicket shape."""
    raw_policies = proposal.policy_evaluation
    policies_list: List[Dict[str, Any]]
    if isinstance(raw_policies, list):
        policies_list = raw_policies
    elif isinstance(raw_policies, dict):
        # Fallback for the proposal_engine's richer shape
        policies_list = raw_policies.get("matched_policies", [])
    else:
        policies_list = []

    confidence_val: Optional[float] = None
    if proposal.confidence is not None:
        confidence_val = float(proposal.confidence)

    return ProposalForTicket(
        id=proposal.id,
        confidence=confidence_val,
        context_version=context_version_int,
        proposed_action=proposal.proposed_external_action or {},
        reasoning=proposal.reasoning,
        citations=list(proposal.citations or []),
        policies_evaluated=policies_list,
    )


def _build_memory_proposal_dto(
    proposal: AgentProposal,
    vendor_job: Optional[VendorJob],
    current_version: int,
) -> Optional[MemoryProposalOut]:
    """
    Memory proposal is only visible *after* the vendor job is completed and
    the memory engine has filled `final_context_update_md`. Hidden until then.
    """
    if vendor_job is None or vendor_job.completed_at is None:
        return None
    if not proposal.final_context_update_md:
        return None
    return MemoryProposalOut(
        text=proposal.final_context_update_md,
        target_version=current_version + 1,
        status=proposal.memory_status or "pending",
    )


def build_ticket_detail(db: Session, ticket: Ticket) -> TicketDetail:
    proposal = _latest_proposal(db, ticket.id)
    vendor_job = _latest_vendor_job(db, ticket.id)
    call_session = _latest_call_session(db, ticket.id)
    cv = _latest_context_version(db, ticket.property_id)

    detail = TicketDetail.model_validate(ticket)
    if proposal:
        detail.proposal = _build_proposal_dto(proposal, cv.version if cv else None)
        if cv is not None:
            detail.memory_proposal = _build_memory_proposal_dto(
                proposal, vendor_job, cv.version
            )
    if call_session:
        detail.call_session = CallSessionOut.model_validate(call_session)
    if vendor_job:
        detail.vendor_job = VendorJobOut.model_validate(vendor_job)
    if ticket.source == "email":
        detail.email_body = ticket.body
    return detail


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/tickets", response_model=TicketOut, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
):
    prop = db.query(Property).filter(Property.id == payload.property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    ticket_num: Optional[str] = None
    try:
        from app.services.ticket_number_service import next_ticket_num
        ticket_num = next_ticket_num(db, payload.property_id)
    except Exception:
        pass

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


@router.get("/tickets/{ticket_id}", response_model=TicketDetail)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Full ticket detail with proposal, callSession, vendorJob, memoryProposal, emailBody."""
    ticket = _get_ticket_or_404(db, ticket_id)
    return build_ticket_detail(db, ticket)


@router.post("/tickets/{ticket_id}/approve", response_model=ApproveResponse)
def approve_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """
    Operator approves the agent proposal for a ticket.
    Same-transaction side effect: creates a `vendor_jobs` row (dispatched)
    and mirrors ticket.status → 'awaiting_vendor'.
    """
    ticket = _get_ticket_or_404(db, ticket_id)

    if ticket.status not in {"proposed"}:
        raise StateConflictError(
            f"Cannot approve ticket with status '{ticket.status}'. Must be 'proposed'."
        )

    proposal = _latest_proposal(db, ticket_id)
    if proposal is None:
        raise StateConflictError("No proposal exists for this ticket — nothing to approve.")

    proposal.action_status = "approved"

    # Pull vendor_id off proposed_external_action.vendorId (engine convention)
    vendor_id: Optional[str] = None
    if isinstance(proposal.proposed_external_action, dict):
        vendor_id = proposal.proposed_external_action.get("vendorId") or proposal.proposed_external_action.get("vendor_id")

    job = vendor_job_service.dispatch(db, ticket, vendor_id)

    create_audit_entry(
        db,
        actor="operator",
        action="ticket.approve",
        entity_type="ticket",
        property_id=ticket.property_id,
        entity_id=ticket_id,
        metadata={"vendor_job_id": job.id, "vendor_id": vendor_id},
    )
    db.commit()
    db.refresh(job)

    return ApproveResponse(
        status="approved",
        vendor_job=VendorJobOut.model_validate(job),
    )


@router.post("/tickets/{ticket_id}/reject", response_model=TicketOut)
def reject_ticket(
    ticket_id: str,
    payload: Optional[RejectRequest] = None,
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id)

    if ticket.status in {"resolved", "rejected"}:
        raise StateConflictError(
            f"Ticket is already '{ticket.status}' and cannot be rejected again."
        )

    ticket.status = "rejected"
    proposal = _latest_proposal(db, ticket_id)
    if proposal is not None:
        proposal.action_status = "rejected"
        if payload and payload.reason:
            proposal.rejection_reason = payload.reason

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


# ---------------------------------------------------------------------------
# Memory wrappers — gated on completed vendor_job
# ---------------------------------------------------------------------------


@router.post("/tickets/{ticket_id}/memory/save", response_model=MemorySaveResponse)
def save_memory(ticket_id: str, db: Session = Depends(get_db)):
    """
    Apply the memory engine's proposed context update.
    409 CONFLICT if no completed vendor_job exists for this ticket.
    """
    ticket = _get_ticket_or_404(db, ticket_id)
    proposal = _latest_proposal(db, ticket_id)
    if proposal is None:
        raise StateConflictError("No proposal exists for this ticket.")

    if not vendor_job_service.has_completed_job(db, ticket_id):
        raise StateConflictError(
            "Cannot save memory before the vendor job is completed."
        )

    if not proposal.final_context_update_md:
        raise StateConflictError(
            "Memory engine has not produced a context update for this ticket."
        )

    if proposal.memory_status == "saved":
        raise StateConflictError("Memory has already been saved for this ticket.")

    cv = _latest_context_version(db, ticket.property_id)
    if cv is None:
        raise StateConflictError("Property has no context version to extend.")

    new_version = get_next_version(db, ticket.property_id)
    new_md = cv.content_md.rstrip() + "\n\n" + proposal.final_context_update_md.strip() + "\n"

    new_cv = ContextVersion(
        property_id=ticket.property_id,
        version=new_version,
        content_md=new_md,
        frontmatter=cv.frontmatter,
        created_by="memory-agent",
        created_reason=f"Auto-update from ticket {ticket.num or ticket.id}",
        parent_version=cv.version,
        source_proposal_id=proposal.id,
    )
    db.add(new_cv)
    db.flush()

    create_context_chunks(db, new_cv.id, ticket.property_id, new_md)

    proposal.memory_status = "saved"
    if proposal.action_status in {"approved", "rejected"}:
        ticket.status = "resolved"

    create_audit_entry(
        db,
        actor="operator",
        action="ticket.memory.save",
        entity_type="context_version",
        property_id=ticket.property_id,
        entity_id=new_cv.id,
        metadata={"ticket_id": ticket_id, "version": new_version},
    )
    db.commit()

    return MemorySaveResponse(status="saved", context_version=new_version)


@router.post("/tickets/{ticket_id}/memory/skip", response_model=MemorySkipResponse)
def skip_memory(ticket_id: str, db: Session = Depends(get_db)):
    """Operator declines the memory write. No new context version created."""
    ticket = _get_ticket_or_404(db, ticket_id)
    proposal = _latest_proposal(db, ticket_id)
    if proposal is None:
        raise StateConflictError("No proposal exists for this ticket.")

    if proposal.memory_status == "saved":
        raise StateConflictError("Memory was already saved; cannot skip.")

    proposal.memory_status = "skipped"
    if proposal.action_status in {"approved", "rejected"}:
        ticket.status = "resolved"

    create_audit_entry(
        db,
        actor="operator",
        action="ticket.memory.skip",
        entity_type="ticket",
        property_id=ticket.property_id,
        entity_id=ticket_id,
        metadata={},
    )
    db.commit()
    return MemorySkipResponse(status="skipped")
