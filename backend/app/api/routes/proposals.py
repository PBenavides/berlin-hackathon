from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent_proposals import AgentProposal
from app.models.context_versions import ContextVersion
from app.models.tickets import Ticket
from app.schemas.proposals import AgentProposalOut
from app.services.audit_service import create_audit_entry
from app.services.context_service import create_context_chunks, get_next_version

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ActionDecisionRequest(BaseModel):
    reviewed_by: str
    edited_action: Optional[dict] = None
    rejection_reason: Optional[str] = None


class MemoryDecisionRequest(BaseModel):
    reviewed_by: str
    edited_context_md: Optional[str] = None
    rejection_reason: Optional[str] = None


# Unified (legacy) schemas kept for backward-compatibility
class UnifiedActionRequest(BaseModel):
    decision: str  # "approve" | "reject" | "edit"
    reviewed_by: str
    edited_action: Optional[dict] = None
    rejection_reason: Optional[str] = None


class UnifiedMemoryRequest(BaseModel):
    decision: str  # "approve" | "reject" | "edit"
    reviewed_by: str
    edited_context_md: Optional[str] = None
    rejection_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_proposal_or_404(proposal_id: str, db: Session) -> AgentProposal:
    proposal = db.query(AgentProposal).filter(AgentProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


def _get_ticket(proposal: AgentProposal, db: Session) -> Optional[Ticket]:
    return db.query(Ticket).filter(Ticket.id == proposal.ticket_id).first()


def _auto_resolve_ticket(proposal: AgentProposal, ticket: Optional[Ticket], db: Session) -> None:
    """Transition ticket to 'resolved' once both action AND memory decisions are finalised."""
    if ticket is None:
        return
    action_done = proposal.action_status in ("approved", "edited", "rejected")
    memory_done = proposal.memory_status in ("approved", "edited", "rejected")
    if action_done and memory_done:
        ticket.status = "resolved"


def _apply_context_delta(current_md: str, suggested_update: str) -> str:
    """
    Apply a context delta to the current markdown.
    MVP strategy: if a '## Recent Decisions' section exists, prepend a bullet;
    otherwise append a dated '## Context Update' section.
    """
    from datetime import date

    today = date.today().isoformat()

    if "## Recent Decisions" in current_md:
        lines = current_md.split("\n")
        for i, line in enumerate(lines):
            if line.strip().startswith("## Recent Decisions"):
                lines.insert(i + 1, f"- {today}: {suggested_update[:150]}")
                return "\n".join(lines)

    return current_md + f"\n\n## Context Update ({today})\n{suggested_update}"


def _create_context_version(
    proposal: AgentProposal,
    ticket: Ticket,
    content_md: str,
    reviewed_by: str,
    db: Session,
) -> ContextVersion:
    """Persist a new context version derived from a memory decision."""
    current = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == ticket.property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    if not current:
        raise HTTPException(
            status_code=422,
            detail="No existing context version found for this property",
        )

    new_version_num = get_next_version(db, ticket.property_id)
    new_version = ContextVersion(
        property_id=ticket.property_id,
        version=new_version_num,
        content_md=content_md,
        frontmatter={
            "version": new_version_num,
            "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "updated_by": reviewed_by,
        },
        created_by=reviewed_by,
        created_reason=f"Memory update from proposal {proposal.id}",
        parent_version=current.version,
        source_proposal_id=proposal.id,
    )
    db.add(new_version)
    db.flush()
    create_context_chunks(db, new_version.id, ticket.property_id, content_md)

    create_audit_entry(
        db,
        actor=reviewed_by,
        action="context.write",
        entity_type="context_version",
        property_id=ticket.property_id,
        entity_id=new_version.id,
        metadata={
            "proposal_id": proposal.id,
            "ticket_id": proposal.ticket_id,
            "from_version": current.version,
            "to_version": new_version_num,
        },
    )

    proposal.final_context_update_md = content_md
    return new_version


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------


@router.get("/proposals/{proposal_id}", response_model=AgentProposalOut)
def get_proposal(proposal_id: str, db: Session = Depends(get_db)):
    """Get a single agent proposal by ID."""
    return _get_proposal_or_404(proposal_id, db)


@router.get("/tickets/{ticket_id}/proposal", response_model=AgentProposalOut)
def get_ticket_proposal(ticket_id: str, db: Session = Depends(get_db)):
    """Get the latest proposal for a given ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    proposal = (
        db.query(AgentProposal)
        .filter(AgentProposal.ticket_id == ticket_id)
        .order_by(AgentProposal.created_at.desc())
        .first()
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="No proposal found for this ticket")
    return proposal


# ---------------------------------------------------------------------------
# s3-f1  External Action Decision Endpoints (granular)
# ---------------------------------------------------------------------------


@router.post("/proposals/{proposal_id}/action/approve", response_model=AgentProposalOut)
def approve_action(
    proposal_id: str,
    payload: ActionDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Approve the proposed external action.
    Sets action_status='approved' and stores the original proposed action as final.
    Returns 409 if the action has already been rejected.
    """
    proposal = _get_proposal_or_404(proposal_id, db)

    if proposal.action_status == "rejected":
        raise HTTPException(
            status_code=409,
            detail="Cannot approve an already-rejected action",
        )

    proposal.action_status = "approved"
    proposal.final_external_action = proposal.proposed_external_action
    proposal.reviewed_by = payload.reviewed_by
    proposal.reviewed_at = datetime.now(timezone.utc)

    ticket = _get_ticket(proposal, db)
    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.action.approve",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": "approve", "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/action/edit", response_model=AgentProposalOut)
def edit_action(
    proposal_id: str,
    payload: ActionDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Edit and approve the proposed external action.
    Sets action_status='edited' and stores the operator-supplied action as final.
    """
    proposal = _get_proposal_or_404(proposal_id, db)

    if proposal.action_status == "rejected":
        raise HTTPException(
            status_code=409,
            detail="Cannot edit an already-rejected action",
        )

    proposal.action_status = "edited"
    proposal.final_external_action = (
        payload.edited_action or proposal.proposed_external_action
    )
    proposal.reviewed_by = payload.reviewed_by
    proposal.reviewed_at = datetime.now(timezone.utc)

    ticket = _get_ticket(proposal, db)
    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.action.edit",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": "edit", "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/action/reject", response_model=AgentProposalOut)
def reject_action(
    proposal_id: str,
    payload: ActionDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Reject the proposed external action.
    Sets action_status='rejected' and records the rejection reason.
    """
    proposal = _get_proposal_or_404(proposal_id, db)

    proposal.action_status = "rejected"
    proposal.rejection_reason = payload.rejection_reason
    proposal.reviewed_by = payload.reviewed_by
    proposal.reviewed_at = datetime.now(timezone.utc)

    ticket = _get_ticket(proposal, db)
    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.action.reject",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={
            "decision": "reject",
            "ticket_id": proposal.ticket_id,
            "reason": payload.rejection_reason,
        },
    )

    db.commit()
    db.refresh(proposal)
    return proposal


# ---------------------------------------------------------------------------
# s3-f2  Memory Decision & Context Version Creation (granular)
# ---------------------------------------------------------------------------


@router.post("/proposals/{proposal_id}/memory/approve", response_model=AgentProposalOut)
def approve_memory(
    proposal_id: str,
    payload: MemoryDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Approve the proposed context (memory) update.
    Creates a new context_version with version = previous + 1 using the
    AI-suggested update merged into the current markdown.
    """
    proposal = _get_proposal_or_404(proposal_id, db)
    ticket = _get_ticket(proposal, db)

    context_delta = proposal.context_delta or {}
    suggested_update = context_delta.get("suggested_context_update")

    if suggested_update and ticket:
        current = (
            db.query(ContextVersion)
            .filter(ContextVersion.property_id == ticket.property_id)
            .order_by(ContextVersion.version.desc())
            .first()
        )
        if current:
            new_content = _apply_context_delta(current.content_md, suggested_update)
            _create_context_version(proposal, ticket, new_content, payload.reviewed_by, db)

    proposal.memory_status = "approved"
    proposal.reviewed_by = payload.reviewed_by
    if not proposal.reviewed_at:
        proposal.reviewed_at = datetime.now(timezone.utc)

    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.memory.approve",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": "approve", "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/memory/edit", response_model=AgentProposalOut)
def edit_memory(
    proposal_id: str,
    payload: MemoryDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Apply an operator-edited markdown as the context update.
    Creates a new context_version using the operator's edited markdown.
    """
    proposal = _get_proposal_or_404(proposal_id, db)
    ticket = _get_ticket(proposal, db)

    if ticket and payload.edited_context_md:
        _create_context_version(
            proposal, ticket, payload.edited_context_md, payload.reviewed_by, db
        )

    proposal.memory_status = "edited"
    proposal.reviewed_by = payload.reviewed_by
    if not proposal.reviewed_at:
        proposal.reviewed_at = datetime.now(timezone.utc)

    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.memory.edit",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": "edit", "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/memory/reject", response_model=AgentProposalOut)
def reject_memory(
    proposal_id: str,
    payload: MemoryDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Reject the proposed context update.
    Context remains unchanged. No new version is created.
    """
    proposal = _get_proposal_or_404(proposal_id, db)
    ticket = _get_ticket(proposal, db)

    proposal.memory_status = "rejected"
    proposal.rejection_reason = payload.rejection_reason
    proposal.reviewed_by = payload.reviewed_by
    if not proposal.reviewed_at:
        proposal.reviewed_at = datetime.now(timezone.utc)

    _auto_resolve_ticket(proposal, ticket, db)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action="proposal.memory.reject",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={
            "decision": "reject",
            "ticket_id": proposal.ticket_id,
            "reason": payload.rejection_reason,
        },
    )

    db.commit()
    db.refresh(proposal)
    return proposal


# ---------------------------------------------------------------------------
# Unified (legacy) endpoints — kept for backward-compatibility with frontend
# ---------------------------------------------------------------------------


@router.post("/proposals/{proposal_id}/action", response_model=AgentProposalOut)
def decide_on_action(
    proposal_id: str,
    payload: UnifiedActionRequest,
    db: Session = Depends(get_db),
):
    """
    Operator decision on the proposed external action.
    decision: 'approve' | 'edit' | 'reject'
    Delegates to the granular handlers above.
    """
    if payload.decision == "approve":
        return approve_action(
            proposal_id,
            ActionDecisionRequest(reviewed_by=payload.reviewed_by),
            db,
        )
    elif payload.decision == "edit":
        return edit_action(
            proposal_id,
            ActionDecisionRequest(
                reviewed_by=payload.reviewed_by,
                edited_action=payload.edited_action,
            ),
            db,
        )
    elif payload.decision == "reject":
        return reject_action(
            proposal_id,
            ActionDecisionRequest(
                reviewed_by=payload.reviewed_by,
                rejection_reason=payload.rejection_reason,
            ),
            db,
        )
    else:
        raise HTTPException(status_code=400, detail="decision must be approve | edit | reject")


@router.post("/proposals/{proposal_id}/memory", response_model=AgentProposalOut)
def decide_on_memory(
    proposal_id: str,
    payload: UnifiedMemoryRequest,
    db: Session = Depends(get_db),
):
    """
    Operator decision on the proposed context (memory) update.
    decision: 'approve' | 'edit' | 'reject'
    Delegates to the granular handlers above.
    """
    if payload.decision == "approve":
        return approve_memory(
            proposal_id,
            MemoryDecisionRequest(reviewed_by=payload.reviewed_by),
            db,
        )
    elif payload.decision == "edit":
        return edit_memory(
            proposal_id,
            MemoryDecisionRequest(
                reviewed_by=payload.reviewed_by,
                edited_context_md=payload.edited_context_md,
            ),
            db,
        )
    elif payload.decision == "reject":
        return reject_memory(
            proposal_id,
            MemoryDecisionRequest(
                reviewed_by=payload.reviewed_by,
                rejection_reason=payload.rejection_reason,
            ),
            db,
        )
    else:
        raise HTTPException(status_code=400, detail="decision must be approve | edit | reject")
