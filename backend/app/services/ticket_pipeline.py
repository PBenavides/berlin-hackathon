"""
ticket_pipeline.py — End-to-end ticket-to-proposal orchestration.

Flow:
  1. Load ticket from DB
  2. Load property's latest context version + chunks + policies  [audit: context.read]
  3. Run PolicyEvaluator against ticket
  4. Run ProposalEngine (stub or AI) to generate proposal data
  5. Persist AgentProposal row linked to ticket + context version  [audit: proposal.create]
  6. Update ticket status to 'proposed'

This is synchronous in MVP — no message queue or background tasks needed.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.tickets import Ticket
from app.models.agent_proposals import AgentProposal
from app.models.context_versions import ContextVersion
from app.models.context_chunks import ContextChunk
from app.models.property_policies import PropertyPolicy
from app.services.audit_service import create_audit_entry
from app.services.proposal_engine import get_proposal_engine
from app.services.policy_evaluator import PolicyEvaluator


def run_pipeline(ticket_id: str, db: Session) -> AgentProposal:
    """
    Execute the full ticket-to-proposal pipeline for a given ticket ID.
    Returns the created AgentProposal.

    Raises ValueError if the ticket or context version cannot be found.
    """
    # --- Step 1: Load ticket ---
    ticket: Ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise ValueError(f"Ticket {ticket_id!r} not found")

    property_id = ticket.property_id

    # --- Step 2: Load latest context version ---
    context_version: ContextVersion = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    if not context_version:
        raise ValueError(f"No context version found for property {property_id!r}")

    # Audit: context.read
    create_audit_entry(
        db,
        actor="pipeline",
        action="context.read",
        entity_type="context_version",
        property_id=property_id,
        entity_id=context_version.id,
        metadata={
            "ticket_id": ticket_id,
            "context_version": context_version.version,
            "reason": "proposal_generation",
        },
    )

    # --- Step 3: Load context chunks for citations ---
    chunks_raw = (
        db.query(ContextChunk)
        .filter(ContextChunk.context_version_id == context_version.id)
        .order_by(ContextChunk.id)
        .all()
    )
    chunks = [{"heading": c.heading, "content": c.content} for c in chunks_raw]

    # --- Step 4: Load policies ---
    policies_raw = (
        db.query(PropertyPolicy)
        .filter(PropertyPolicy.property_id == property_id)
        .filter(PropertyPolicy.active == True)  # noqa: E712
        .all()
    )
    policies = [
        {
            "kind": p.kind,
            "description": p.description,
            "rule_json": p.rule_json or {},
        }
        for p in policies_raw
    ]

    # --- Step 5a: Run PolicyEvaluator ---
    evaluator = PolicyEvaluator()
    policy_result = evaluator.evaluate(
        ticket_subject=ticket.subject,
        ticket_body=ticket.body,
        policies=policies,
    )

    # --- Step 5b: Run ProposalEngine ---
    engine = get_proposal_engine()
    proposal_data = engine.generate(
        ticket_subject=ticket.subject,
        ticket_body=ticket.body,
        ticket_raised_by=ticket.raised_by,
        context_md=context_version.content_md,
        context_chunks=chunks,
        policies=policies,
    )

    # Merge policy evaluation from evaluator into proposal (evaluator is the authoritative source)
    # If the proposal engine already computed policy_evaluation (AI mode), we merge.
    # Stub already includes hand-crafted policy_evaluation — supplement with evaluator if empty.
    if not proposal_data.policy_evaluation.get("matched_policies"):
        proposal_data.policy_evaluation = policy_result.to_dict()
    else:
        # Keep proposal engine's richer matched_policies; supplement with evaluator's violations
        evaluator_violations = policy_result.to_dict().get("violations", [])
        if evaluator_violations and not proposal_data.policy_evaluation.get("violations"):
            proposal_data.policy_evaluation["violations"] = evaluator_violations

    # --- Step 6: Persist AgentProposal ---
    proposal = AgentProposal(
        ticket_id=ticket_id,
        context_version_id=context_version.id,
        proposed_external_action=proposal_data.proposed_external_action,
        context_delta=proposal_data.context_delta,
        reasoning=proposal_data.reasoning,
        citations=proposal_data.citations,
        policy_evaluation=proposal_data.policy_evaluation,
        risk_level=proposal_data.risk_level,
        confidence=proposal_data.confidence,
        action_status="pending",
        memory_status="pending",
    )
    db.add(proposal)
    db.flush()

    # Audit: proposal.create
    create_audit_entry(
        db,
        actor="pipeline",
        action="proposal.create",
        entity_type="agent_proposal",
        property_id=property_id,
        entity_id=proposal.id,
        metadata={
            "ticket_id": ticket_id,
            "context_version_id": context_version.id,
            "risk_level": proposal_data.risk_level,
            "engine": type(engine).__name__,
        },
    )

    # --- Step 7: Update ticket status ---
    ticket.status = "proposed"
    db.flush()

    db.commit()
    db.refresh(proposal)
    db.refresh(ticket)

    return proposal
