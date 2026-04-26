"""
Agent-run routes for ticket-scoped streaming.

GET  /api/tickets/{id}/actions       — list all persisted AgentAction rows for a ticket
POST /api/tickets/{id}/agent-run     — run Hermes on a ticket; returns text/event-stream
                                        of action_card + delta + done events (SSE)
                                        and persists each action to agent_actions table.

SSE event types emitted:
  event: action_card  — {id, ticketId, runId, actionType, toolName, label, description,
                          status, payload, createdAt}  (one per tool call / proposal)
  event: delta        — {text}   (agent reasoning text)
  event: action_proposal — raw proposal envelope (mirrors chat.py)
  event: done         — {runId, turns}
  event: error        — {message}
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.tickets import Ticket
from app.models.agent_actions import AgentAction
from app.schemas.agent_actions import AgentActionOut, AgentRunRequest
from app.services import agent_runtime, agent_tools

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sse(event: str, data: Dict[str, Any]) -> bytes:
    return (
        f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"
    ).encode("utf-8")


def _action_to_dict(action: AgentAction) -> Dict[str, Any]:
    return {
        "id": action.id,
        "ticketId": action.ticket_id,
        "runId": action.run_id,
        "callId": action.call_id,
        "actionType": action.action_type,
        "toolName": action.tool_name,
        "label": action.label,
        "description": action.description,
        "status": action.status,
        "payload": action.payload,
        "createdAt": action.created_at.isoformat() if action.created_at else None,
    }


# Human-readable labels for read tools
_READ_LABELS: Dict[str, str] = {
    "list_tickets": "Listed tickets",
    "get_ticket": "Read ticket details",
    "list_escalations": "Checked escalations",
    "get_property": "Read property info",
    "get_property_context": "Read property context",
    "list_vendors": "Listed vendors",
    "get_vendor": "Read vendor profile",
    "list_units": "Listed units",
    "get_owner": "Read owner profile",
}

_READ_DESCRIPTIONS: Dict[str, str] = {
    "list_tickets": "Fetched open tickets for context",
    "get_ticket": "Loaded ticket details including body and vendor job",
    "list_escalations": "Checked for other high-risk open tickets",
    "get_property": "Loaded property metadata (building, owner, city)",
    "get_property_context": "Loaded 4-layer property context (vendor, owner, building, property)",
    "list_vendors": "Fetched vendor list for this building",
    "get_vendor": "Loaded vendor profile and recent case history",
    "list_units": "Loaded unit details (tenant, rent, owner)",
    "get_owner": "Loaded owner profile, policies, and preferences",
}

_WRITE_DESCRIPTIONS: Dict[str, str] = {
    "send_vendor_email": "Drafted an email to vendor for operator review",
    "respond_to_tenant": "Drafted a tenant response for operator review",
    "send_owner_report": "Compiled a financial report for operator review",
    "escalate_to_human": "Flagged this ticket for human operator attention",
    "approve_ticket": "Proposed approving vendor dispatch",
    "reject_ticket": "Proposed rejecting this ticket",
    "save_memory": "Proposed saving memory update to context.md",
    "skip_memory": "Proposed skipping the memory update",
    "propose_context_edit": "Proposed editing property context",
}


def _label_for(tool_name: str, args: Dict[str, Any], is_write: bool) -> str:
    if is_write:
        if tool_name == "send_vendor_email":
            return f"Draft email to {args.get('vendorName', 'vendor')}"
        if tool_name == "respond_to_tenant":
            return f"Respond to {args.get('tenantName', 'tenant')} via {args.get('channel', '?')}"
        if tool_name == "send_owner_report":
            return f"Financial report for {args.get('ownerName', 'owner')}"
        if tool_name == "escalate_to_human":
            return f"Escalate to human: {args.get('reason', '')[:60]}"
        if tool_name == "approve_ticket":
            return f"Propose approving ticket"
        if tool_name == "reject_ticket":
            return f"Propose rejecting ticket"
    return _READ_LABELS.get(tool_name, tool_name)


def _description_for(tool_name: str, is_write: bool, summary: Optional[str] = None) -> str:
    if summary:
        return summary
    if is_write:
        return _WRITE_DESCRIPTIONS.get(tool_name, f"Proposed {tool_name}")
    return _READ_DESCRIPTIONS.get(tool_name, f"Called {tool_name}")


# ---------------------------------------------------------------------------
# GET /tickets/{ticket_id}/actions
# ---------------------------------------------------------------------------


@router.get("/tickets/{ticket_id}/actions", response_model=List[AgentActionOut])
def list_ticket_actions(
    ticket_id: str,
    run_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List all persisted agent actions for a ticket, ordered oldest-first.
    Optionally filter by run_id to show only one agent run's actions.
    """
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")

    q = db.query(AgentAction).filter(AgentAction.ticket_id == ticket_id)
    if run_id:
        q = q.filter(AgentAction.run_id == run_id)
    return q.order_by(AgentAction.created_at.asc()).all()


# ---------------------------------------------------------------------------
# POST /tickets/{ticket_id}/agent-run  — SSE streaming
# ---------------------------------------------------------------------------


@router.post("/tickets/{ticket_id}/agent-run")
def run_agent_on_ticket(
    ticket_id: str,
    body: Optional[AgentRunRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Trigger Hermes to analyse and propose actions for a specific ticket.
    Returns text/event-stream:
      - action_card events (one per tool call, updating from thinking → completed/proposed)
      - delta events (agent reasoning text)
      - action_proposal events (raw write-tool proposal envelopes)
      - done event (signals completion)

    Each action is also persisted to the agent_actions table so the ticket
    detail page can show the full history on reload.
    """
    # Pre-flight: validate ticket exists before committing to a StreamingResponse.
    # This allows FastAPI to return a proper 404 JSON response instead of an
    # SSE error frame that the browser has already started consuming.
    t_check = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t_check:
        raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found")

    prompt_hint = (body.prompt_hint if body else None) or ""

    def generator():
        db: Session = SessionLocal()
        run_id = f"run-{uuid.uuid4().hex[:10]}"

        try:
            # Load the ticket to build a targeted prompt
            ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
            if not ticket:
                yield _sse("error", {"message": f"Ticket '{ticket_id}' not found"})
                return

            property_id = ticket.property_id
            ticket_ref = ticket.num or ticket_id

            # Build a targeted prompt that guides the agent toward the right action type
            user_message = (
                f"Process ticket {ticket_ref}: \"{ticket.subject}\"\n\n"
                f"Ticket body:\n{ticket.body[:600]}\n\n"
                f"Property ID: {property_id} | Source channel: {ticket.source}\n\n"
                f"Steps to follow:\n"
                f"1. Call get_ticket({ticket_id!r}) to read full details\n"
                f"2. Call get_property_context({property_id!r}) to load context\n"
                f"3. Based on the ticket type:\n"
                f"   - Maintenance/repair → get_vendor + approve_ticket or send_vendor_email\n"
                f"   - Tenant FAQ/inquiry → respond_to_tenant (channel={ticket.source!r}→"
                f"{'sms' if ticket.source=='voice' else 'email_reply' if ticket.source=='email' else 'portal_message'})\n"
                f"   - Financial/cost/invoice → get_owner + send_owner_report\n"
                f"   - Legal/Abmahnung/Kündigung/rent_arrears → ALWAYS escalate_to_human\n"
                f"   - Cost above threshold → escalate_to_human\n"
                + (f"\nOperator hint: {prompt_hint}" if prompt_hint else "")
            )

            # Map from call_id to the AgentAction we created for it
            pending_actions: Dict[str, AgentAction] = {}

            last_keepalive = time.time()

            for event_name, data in agent_runtime.stream_agent(
                db,
                user_message,
                property_id=property_id,
            ):
                # Keepalive
                if time.time() - last_keepalive > 15:
                    yield b": keepalive\n\n"
                    last_keepalive = time.time()

                if event_name == "tool_call":
                    # Create action card in "thinking" state
                    tool_name = data.get("name", "")
                    call_id = data.get("id", "")
                    is_w = agent_tools.is_write(tool_name)
                    args = data.get("args") or {}

                    action = AgentAction(
                        ticket_id=ticket_id,
                        run_id=run_id,
                        call_id=call_id,
                        action_type="write_proposal" if is_w else "read",
                        tool_name=tool_name,
                        label=_label_for(tool_name, args, is_w),
                        description="Thinking…",
                        status="thinking",
                        payload={"callId": call_id, "toolName": tool_name, "args": args},
                    )
                    db.add(action)
                    db.flush()
                    # server_default is only populated after a full commit/refresh;
                    # set created_at explicitly so the first SSE emit has a timestamp.
                    if action.created_at is None:
                        action.created_at = datetime.now(timezone.utc)
                    pending_actions[call_id] = action
                    yield _sse("action_card", _action_to_dict(action))

                elif event_name == "tool_result":
                    # Update action to completed
                    call_id = data.get("id", "")
                    if call_id in pending_actions:
                        action = pending_actions[call_id]
                        action.status = "completed"
                        action.description = _description_for(
                            action.tool_name or "",
                            False,
                            data.get("summary"),
                        )
                        action.payload = {
                            **(action.payload or {}),
                            "summary": data.get("summary"),
                            "result": data.get("result"),
                        }
                        db.commit()
                        yield _sse("action_card", _action_to_dict(action))

                elif event_name == "action_proposal":
                    # Update action to "proposed" with full proposal payload
                    call_id = data.get("id", "")
                    tool_name = data.get("tool", "")

                    if call_id in pending_actions:
                        action = pending_actions[call_id]
                        action.status = "proposed"
                        action.action_type = tool_name or action.action_type
                        action.label = data.get("label", action.label)
                        action.description = _description_for(tool_name, True)
                        action.payload = {
                            **(action.payload or {}),
                            "proposal": data,
                        }
                        db.commit()
                        yield _sse("action_card", _action_to_dict(action))
                    else:
                        # Fallback: create a new action row if call_id wasn't tracked
                        action = AgentAction(
                            ticket_id=ticket_id,
                            run_id=run_id,
                            call_id=call_id,
                            action_type=tool_name or "write_proposal",
                            tool_name=tool_name,
                            label=data.get("label", tool_name),
                            description=_description_for(tool_name, True),
                            status="proposed",
                            payload={"proposal": data},
                        )
                        db.add(action)
                        db.commit()
                        yield _sse("action_card", _action_to_dict(action))

                    # Also emit the raw action_proposal event for full proposal detail
                    yield _sse("action_proposal", data)

                elif event_name == "delta":
                    yield _sse("delta", data)

                elif event_name == "done":
                    yield _sse(
                        "done",
                        {**data, "runId": run_id, "ticketId": ticket_id},
                    )
                    break

                elif event_name == "error":
                    yield _sse("error", data)
                    break

        except Exception as e:
            yield _sse("error", {"message": f"{type(e).__name__}: {e}"})
        finally:
            db.close()

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
