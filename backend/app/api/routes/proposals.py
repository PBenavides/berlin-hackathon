from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.agent_proposals import AgentProposal
from app.models.tickets import Ticket
from app.schemas.proposals import AgentProposalOut
from app.services.audit_service import create_audit_entry

router = APIRouter()


@router.get("/proposals/{proposal_id}", response_model=AgentProposalOut)
def get_proposal(proposal_id: str, db: Session = Depends(get_db)):
    """Get a single agent proposal by ID."""
    proposal = db.query(AgentProposal).filter(AgentProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


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


class ActionDecisionRequest(BaseModel):
    decision: str  # "approve" | "reject" | "edit"
    reviewed_by: str
    edited_action: Optional[dict] = None
    rejection_reason: Optional[str] = None


class MemoryDecisionRequest(BaseModel):
    decision: str  # "approve" | "reject" | "edit"
    reviewed_by: str
    edited_context_md: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.post("/proposals/{proposal_id}/action", response_model=AgentProposalOut)
def decide_on_action(
    proposal_id: str,
    payload: ActionDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Operator decision on the proposed external action.
    decision: 'approve' | 'reject' | 'edit'
    """
    proposal = db.query(AgentProposal).filter(AgentProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if payload.decision == "approve":
        proposal.action_status = "approved"
        proposal.final_external_action = proposal.proposed_external_action
    elif payload.decision == "edit":
        proposal.action_status = "approved"
        proposal.final_external_action = payload.edited_action or proposal.proposed_external_action
    elif payload.decision == "reject":
        proposal.action_status = "rejected"
        proposal.rejection_reason = payload.rejection_reason
    else:
        raise HTTPException(status_code=400, detail="decision must be approve | reject | edit")

    proposal.reviewed_by = payload.reviewed_by
    from datetime import datetime, timezone
    proposal.reviewed_at = datetime.now(timezone.utc)

    # Update ticket status
    ticket = db.query(Ticket).filter(Ticket.id == proposal.ticket_id).first()
    if ticket and proposal.action_status == "approved":
        ticket.status = "approved"

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action=f"proposal.action.{payload.decision}",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": payload.decision, "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/proposals/{proposal_id}/memory", response_model=AgentProposalOut)
def decide_on_memory(
    proposal_id: str,
    payload: MemoryDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Operator decision on the proposed context (memory) update.
    decision: 'approve' | 'reject' | 'edit'
    """
    from app.models.context_versions import ContextVersion
    from app.models.properties import Property
    from app.services.context_service import create_context_chunks, get_next_version
    from datetime import datetime, timezone

    proposal = db.query(AgentProposal).filter(AgentProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    ticket = db.query(Ticket).filter(Ticket.id == proposal.ticket_id).first()

    if payload.decision == "reject":
        proposal.memory_status = "rejected"
        proposal.rejection_reason = payload.rejection_reason
    elif payload.decision in ("approve", "edit"):
        # Determine the context update content
        context_delta = proposal.context_delta or {}
        suggested_update = (
            payload.edited_context_md
            or context_delta.get("suggested_context_update")
        )

        if suggested_update and ticket:
            # Get current context version
            current_version = (
                db.query(ContextVersion)
                .filter(ContextVersion.property_id == ticket.property_id)
                .order_by(ContextVersion.version.desc())
                .first()
            )

            if current_version:
                # Create a new context version with the delta applied
                new_version_num = get_next_version(db, ticket.property_id)
                new_content = _apply_context_delta(
                    current_version.content_md, suggested_update
                )

                new_version = ContextVersion(
                    property_id=ticket.property_id,
                    version=new_version_num,
                    content_md=new_content,
                    frontmatter={
                        "version": new_version_num,
                        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "updated_by": payload.reviewed_by,
                    },
                    created_by=payload.reviewed_by,
                    created_reason=f"Memory update from proposal {proposal_id}",
                    parent_version=current_version.version,
                    source_proposal_id=proposal_id,
                )
                db.add(new_version)
                db.flush()
                create_context_chunks(db, new_version.id, ticket.property_id, new_content)

                proposal.final_context_update_md = new_content

                create_audit_entry(
                    db,
                    actor=payload.reviewed_by,
                    action="context.update",
                    entity_type="context_version",
                    property_id=ticket.property_id,
                    entity_id=new_version.id,
                    metadata={
                        "proposal_id": proposal_id,
                        "ticket_id": proposal.ticket_id,
                        "from_version": current_version.version,
                        "to_version": new_version_num,
                    },
                )

        proposal.memory_status = "approved"
        if ticket:
            ticket.status = "resolved"
    else:
        raise HTTPException(status_code=400, detail="decision must be approve | reject | edit")

    proposal.reviewed_by = payload.reviewed_by
    if not proposal.reviewed_at:
        from datetime import datetime, timezone
        proposal.reviewed_at = datetime.now(timezone.utc)

    create_audit_entry(
        db,
        actor=payload.reviewed_by,
        action=f"proposal.memory.{payload.decision}",
        entity_type="agent_proposal",
        property_id=ticket.property_id if ticket else None,
        entity_id=proposal_id,
        metadata={"decision": payload.decision, "ticket_id": proposal.ticket_id},
    )

    db.commit()
    db.refresh(proposal)
    return proposal


def _apply_context_delta(current_md: str, suggested_update: str) -> str:
    """
    Apply a context delta to the current markdown content.
    Simple strategy: append a '## Recent Updates' section with the delta.
    For a hackathon MVP this is sufficient — a real implementation would
    surgically merge sections.
    """
    from datetime import date
    today = date.today().isoformat()

    # Check if there's a Recent Decisions/Updates section to append to
    if "## Recent Decisions" in current_md:
        # Append new decision at the top of the list
        lines = current_md.split("\n")
        insert_idx = None
        for i, line in enumerate(lines):
            if line.strip().startswith("## Recent Decisions"):
                insert_idx = i + 1
                break
        if insert_idx:
            decision_line = f"- {today}: {suggested_update[:150]}"
            lines.insert(insert_idx, decision_line)
            return "\n".join(lines)

    # Fallback: append as new section
    delta_section = f"\n\n## Context Update ({today})\n{suggested_update}"
    return current_md + delta_section
