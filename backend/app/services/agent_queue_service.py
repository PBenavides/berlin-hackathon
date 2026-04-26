"""
agent_queue_service.py — Background autonomous ticket processor.

When activated via the toggle, this service works through all open tickets
sequentially in priority order (high-risk first, then oldest first), running
each through the full Hermes agent pipeline.

Architecture:
- A single background threading.Thread drives the queue.
- A threading.Event (_stop_event) signals the thread to stop after the
  current ticket finishes.
- Subscriber queues receive every activity event for SSE delivery.
- All DB operations use a short-lived SQLAlchemy session per ticket so
  the main request sessions are never blocked.

Auto-confirm behaviour (Sprint 3, s3-f5):
  When auto-solve is active, ALL proposed write actions are automatically
  confirmed EXCEPT escalate_to_human, which intentionally stays pending
  so the audience can see the agent exercising judgment.

Speed Controls (Sprint 4, s4-f5):
  Three presets control pacing for different demo scenarios:
  - slow:   9s inter-ticket, 2.5s auto-confirm (walkthrough mode)
  - normal: 4s inter-ticket, 1.5s auto-confirm (standard demo)
  - fast:   1.5s inter-ticket, 0.5s auto-confirm (quick showcase)
"""
from __future__ import annotations

import json
import queue
import time
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.tickets import Ticket
from app.models.agent_activity import AgentActivityEntry
from app.models.agent_actions import AgentAction
from app.services import agent_runtime, agent_tools

# ---------------------------------------------------------------------------
# Queue-level configuration
# ---------------------------------------------------------------------------

# Seconds to wait between tickets (configurable via env)
import os
INTER_TICKET_DELAY = float(os.environ.get("AUTO_SOLVE_DELAY", "4"))
# Seconds to wait before auto-confirming a proposed action (s3-f5)
AUTO_CONFIRM_DELAY = float(os.environ.get("AUTO_CONFIRM_DELAY", "1.5"))
# Backend base URL for confirm endpoint calls
BACKEND_BASE = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000")

# ---------------------------------------------------------------------------
# Speed presets (s4-f5)
# ---------------------------------------------------------------------------

SPEED_PRESETS: Dict[str, Dict[str, float]] = {
    "slow":   {"inter_ticket": 9.0, "auto_confirm": 2.5},
    "normal": {"inter_ticket": 4.0, "auto_confirm": 1.5},
    "fast":   {"inter_ticket": 1.5, "auto_confirm": 0.5},
}

# ---------------------------------------------------------------------------
# Labels reused from agent_run.py (DRY-ish)
# ---------------------------------------------------------------------------

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

_WRITE_LABELS: Dict[str, str] = {
    "send_vendor_email": "Draft vendor email",
    "respond_to_tenant": "Draft tenant response",
    "send_owner_report": "Owner report",
    "escalate_to_human": "Human escalation",
    "approve_ticket": "Approve ticket",
    "reject_ticket": "Reject ticket",
    "save_memory": "Save memory",
    "skip_memory": "Skip memory",
    "propose_context_edit": "Context edit",
}


def _label_for(tool_name: str, args: Dict[str, Any], is_write: bool) -> str:
    if is_write:
        if tool_name == "send_vendor_email":
            return f"Draft email to {args.get('vendorName', 'vendor')}"
        if tool_name == "respond_to_tenant":
            return f"Respond to {args.get('tenantName', 'tenant')}"
        if tool_name == "send_owner_report":
            return f"Owner report for {args.get('ownerName', 'owner')}"
        if tool_name == "escalate_to_human":
            return f"Escalate: {args.get('reason', '')[:60]}"
        return _WRITE_LABELS.get(tool_name, tool_name)
    return _READ_LABELS.get(tool_name, tool_name)


def _description_for(tool_name: str, is_write: bool) -> str:
    if is_write:
        return {
            "send_vendor_email": "Drafted email to vendor (auto-confirming…)",
            "respond_to_tenant": "Drafted tenant response (auto-confirming…)",
            "send_owner_report": "Compiled owner report (auto-confirming…)",
            "escalate_to_human": "Flagged for human review — NOT auto-confirmed",
            "approve_ticket": "Proposed approval",
            "reject_ticket": "Proposed rejection",
            "save_memory": "Proposed memory update (auto-confirming…)",
            "skip_memory": "Proposed skipping memory (auto-confirming…)",
        }.get(tool_name, f"Proposed {tool_name}")
    return {
        "list_tickets": "Fetched open tickets",
        "get_ticket": "Loaded ticket details",
        "get_property_context": "Loaded property context",
        "list_vendors": "Fetched vendor list",
        "get_vendor": "Loaded vendor profile",
        "get_owner": "Loaded owner profile",
        "list_units": "Loaded units",
    }.get(tool_name, f"Called {tool_name}")


# ---------------------------------------------------------------------------
# Subscriber registry — SSE clients subscribe to this
# ---------------------------------------------------------------------------

class _SubscriberRegistry:
    """Thread-safe registry of SSE subscriber queues."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subs: Dict[str, queue.Queue] = {}

    def subscribe(self) -> Tuple[str, queue.Queue]:
        sub_id = uuid.uuid4().hex
        q: queue.Queue = queue.Queue(maxsize=200)
        with self._lock:
            self._subs[sub_id] = q
        return sub_id, q

    def unsubscribe(self, sub_id: str) -> None:
        with self._lock:
            self._subs.pop(sub_id, None)

    def broadcast(self, event: Dict[str, Any]) -> None:
        with self._lock:
            dead = []
            for sub_id, q in self._subs.items():
                try:
                    q.put_nowait(event)
                except queue.Full:
                    dead.append(sub_id)
            for sub_id in dead:
                self._subs.pop(sub_id, None)


_subscribers = _SubscriberRegistry()


# ---------------------------------------------------------------------------
# Global queue state
# ---------------------------------------------------------------------------

class QueueState:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.is_running: bool = False
        self.current_ticket_id: Optional[str] = None
        self.current_ticket_num: Optional[str] = None
        self.remaining_count: int = 0
        self.processed_count: int = 0
        self.failed_count: int = 0
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        # Speed controls (s4-f5)
        self.speed: str = "normal"
        self.inter_ticket_delay: float = INTER_TICKET_DELAY
        self.auto_confirm_delay: float = AUTO_CONFIRM_DELAY
        # Summary stats (s4-f1)
        self.start_time: Optional[float] = None
        self.total_vendor_emails: int = 0
        self.total_tenant_responses: int = 0
        self.total_owner_reports: int = 0
        self.total_escalations: int = 0
        self.total_confirmed: int = 0

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "isRunning": self.is_running,
                "currentTicketId": self.current_ticket_id,
                "currentTicketNum": self.current_ticket_num,
                "remainingCount": self.remaining_count,
                "processedCount": self.processed_count,
                "failedCount": self.failed_count,
                # Speed controls
                "speed": self.speed,
                # Summary stats
                "totalVendorEmails": self.total_vendor_emails,
                "totalTenantResponses": self.total_tenant_responses,
                "totalOwnerReports": self.total_owner_reports,
                "totalEscalations": self.total_escalations,
                "totalConfirmed": self.total_confirmed,
                "startTime": self.start_time,
            }


_state = QueueState()


# ---------------------------------------------------------------------------
# Activity feed persistence + broadcast helpers
# ---------------------------------------------------------------------------

def _log_activity(
    db: Session,
    event_type: str,
    description: str,
    severity: str = "info",
    ticket_id: Optional[str] = None,
    ticket_num: Optional[str] = None,
    action_type: Optional[str] = None,
) -> AgentActivityEntry:
    entry = AgentActivityEntry(
        ticket_id=ticket_id,
        ticket_num=ticket_num,
        event_type=event_type,
        action_type=action_type,
        description=description,
        severity=severity,
    )
    db.add(entry)
    db.flush()
    if entry.created_at is None:
        entry.created_at = datetime.now(timezone.utc)
    db.commit()

    # Broadcast to SSE subscribers
    _subscribers.broadcast({
        "id": entry.id,
        "ticketId": ticket_id,
        "ticketNum": ticket_num,
        "eventType": event_type,
        "actionType": action_type,
        "description": description,
        "severity": severity,
        "createdAt": entry.created_at.isoformat() if entry.created_at else None,
    })

    return entry


# ---------------------------------------------------------------------------
# Auto-confirm helper (s3-f5)
# ---------------------------------------------------------------------------

# Tools that are NOT auto-confirmed — they require real human decision
_NO_AUTO_CONFIRM = {"escalate_to_human"}


def _auto_confirm(proposal: Dict[str, Any], ticket_id: str, ticket_num: Optional[str]) -> bool:
    """
    After auto_confirm_delay seconds (from _state), POST to the proposal's confirmEndpoint.
    Returns True if confirmed, False if skipped (e.g. escalation or no endpoint).
    """
    tool_name = proposal.get("tool", "")
    if tool_name in _NO_AUTO_CONFIRM:
        return False
    endpoint = proposal.get("confirmEndpoint")
    if not endpoint:
        return False

    # Visual delay so the audience can see "proposed" before it flips to "confirmed"
    # Use state-based delay to respect speed controls (s4-f5)
    delay = _state.auto_confirm_delay
    time.sleep(delay)

    confirm_method = (proposal.get("confirmMethod") or "POST").upper()
    confirm_body = proposal.get("confirmBody") or {}

    try:
        url = f"{BACKEND_BASE}{endpoint}"
        if confirm_method == "POST":
            resp = httpx.post(url, json=confirm_body, timeout=15.0)
        elif confirm_method == "PUT":
            resp = httpx.put(url, json=confirm_body, timeout=15.0)
        else:
            resp = httpx.request(confirm_method, url, json=confirm_body, timeout=15.0)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[auto-solve] auto-confirm failed for {tool_name} on {ticket_num}: {e}")
        return False


# ---------------------------------------------------------------------------
# Priority ordering
# ---------------------------------------------------------------------------

_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}
_SKIP_STATUSES = {"resolved", "rejected", "escalated"}


def _get_open_tickets(db: Session) -> List[Ticket]:
    """Return open tickets in priority order: high-risk first, then oldest first."""
    tickets = (
        db.query(Ticket)
        .filter(~Ticket.status.in_(["resolved", "rejected"]))
        .order_by(Ticket.created_at.asc())
        .all()
    )
    # Sort by risk priority then age (already sorted by age from DB)
    tickets.sort(key=lambda t: (_RISK_ORDER.get(t.risk or "low", 2),))
    return tickets


# ---------------------------------------------------------------------------
# Per-ticket processing
# ---------------------------------------------------------------------------

def _process_ticket(ticket_id: str, ticket_num: Optional[str], property_id: str) -> Dict[str, Any]:
    """
    Run the full Hermes agent pipeline on one ticket.
    Returns a summary dict with counts (including per-action-type counts for s4-f1).

    Uses its own DB session (not shared with the main thread).
    """
    db: Session = SessionLocal()
    proposals_seen: List[Dict[str, Any]] = []
    reads = 0
    writes = 0
    run_id = f"auto-{uuid.uuid4().hex[:8]}"
    pending_actions: Dict[str, AgentAction] = {}
    # Per-action-type counters (s4-f1)
    vendor_emails = 0
    tenant_responses = 0
    owner_reports = 0
    escalations = 0

    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            return {"error": "ticket not found"}

        # Reload ticket_num in case it was None
        if not ticket_num:
            ticket_num = ticket.num or ticket_id

        ticket_ref = ticket.num or ticket_id
        user_message = (
            f"Process internal ticket ID \"{ticket_id}\" (display ref: {ticket_ref}): \"{ticket.subject}\"\n\n"
            f"Ticket body:\n{ticket.body[:600]}\n\n"
            f"Internal ticket ID to use in all tool calls: {ticket_id}\n"
            f"Property ID: {property_id} | Source channel: {ticket.source}\n\n"
            f"Steps to follow:\n"
            f"1. Call get_ticket(\"{ticket_id}\") — use exactly this internal ID\n"
            f"2. Call get_property_context(\"{property_id}\") to load context\n"
            f"3. Based on the ticket type:\n"
            f"   - Maintenance/repair → get_vendor + approve_ticket or send_vendor_email\n"
            f"   - Tenant FAQ/inquiry → respond_to_tenant (channel={ticket.source!r}→"
            f"{'sms' if ticket.source=='voice' else 'email_reply' if ticket.source=='email' else 'portal_message'})\n"
            f"   - Financial/cost/invoice → get_owner + send_owner_report\n"
            f"   - Legal/Abmahnung/Kündigung/rent_arrears → ALWAYS escalate_to_human\n"
            f"   - Cost above threshold → escalate_to_human\n"
        )

        # Stream agent events — same loop as agent_run.py but without SSE
        for event_name, data in agent_runtime.stream_agent(db, user_message, property_id=property_id):
            # Check for stop signal between events
            if _state._stop_event.is_set():
                break

            if event_name == "tool_call":
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
                if action.created_at is None:
                    action.created_at = datetime.now(timezone.utc)
                pending_actions[call_id] = action

                if not is_w:
                    reads += 1
                    _log_activity(
                        db,
                        event_type="action_read",
                        description=f"[{ticket_num}] {_label_for(tool_name, args, False)}",
                        severity="info",
                        ticket_id=ticket_id,
                        ticket_num=ticket_num,
                        action_type=tool_name,
                    )

            elif event_name == "tool_result":
                call_id = data.get("id", "")
                if call_id in pending_actions:
                    action = pending_actions[call_id]
                    action.status = "completed"
                    action.description = _description_for(action.tool_name or "", False)
                    action.payload = {
                        **(action.payload or {}),
                        "summary": data.get("summary"),
                        "result": data.get("result"),
                    }
                    db.commit()

            elif event_name == "action_proposal":
                tool_name = data.get("tool", "")
                # Fix confirmEndpoint with real ticket_id (mirrors agent_run.py bug-003 fix)
                if tool_name == "escalate_to_human" and data.get("confirmEndpoint"):
                    data["confirmEndpoint"] = f"/api/tickets/{ticket_id}/escalate"
                    if data.get("confirmBody") is None:
                        data["confirmBody"] = {}
                if tool_name in ("approve_ticket", "reject_ticket", "save_memory", "skip_memory"):
                    endpoint_map = {
                        "approve_ticket": f"/api/tickets/{ticket_id}/approve",
                        "reject_ticket": f"/api/tickets/{ticket_id}/reject",
                        "save_memory": f"/api/tickets/{ticket_id}/memory/save",
                        "skip_memory": f"/api/tickets/{ticket_id}/memory/skip",
                    }
                    if data.get("confirmEndpoint"):
                        data["confirmEndpoint"] = endpoint_map.get(tool_name, data["confirmEndpoint"])

                call_id = data.get("id", "")
                if call_id in pending_actions:
                    action = pending_actions[call_id]
                    action.status = "proposed"
                    action.action_type = tool_name or action.action_type
                    action.label = data.get("label", action.label)
                    action.description = _description_for(tool_name, True)
                    action.payload = {**(action.payload or {}), "proposal": data}
                    db.commit()
                else:
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
                    pending_actions[call_id] = action

                writes += 1
                is_escalation = tool_name == "escalate_to_human"

                # Track per-action-type counts (s4-f1)
                if tool_name == "send_vendor_email":
                    vendor_emails += 1
                elif tool_name == "respond_to_tenant":
                    tenant_responses += 1
                elif tool_name == "send_owner_report":
                    owner_reports += 1
                elif tool_name == "escalate_to_human":
                    escalations += 1

                if is_escalation:
                    _log_activity(
                        db,
                        event_type="action_escalated",
                        description=f"[{ticket_num}] Escalated to human: {(data.get('escalation') or {}).get('reason', '')[:80]}",
                        severity="warning",
                        ticket_id=ticket_id,
                        ticket_num=ticket_num,
                        action_type=tool_name,
                    )
                else:
                    _log_activity(
                        db,
                        event_type="action_proposed",
                        description=f"[{ticket_num}] Proposed: {data.get('label', tool_name)}",
                        severity="info",
                        ticket_id=ticket_id,
                        ticket_num=ticket_num,
                        action_type=tool_name,
                    )
                    proposals_seen.append({"proposal": data, "action": action})

            elif event_name == "done":
                break

            elif event_name == "error":
                _log_activity(
                    db,
                    event_type="ticket_error",
                    description=f"[{ticket_num}] Agent error: {data.get('message', '?')[:120]}",
                    severity="error",
                    ticket_id=ticket_id,
                    ticket_num=ticket_num,
                )
                break

    except Exception as e:
        _log_activity(
            db,
            event_type="ticket_error",
            description=f"[{ticket_num}] Exception: {type(e).__name__}: {str(e)[:100]}",
            severity="error",
            ticket_id=ticket_id,
            ticket_num=ticket_num,
        )
    finally:
        db.close()

    # Auto-confirm proposals (s3-f5) — open a fresh session for confirm HTTP calls
    confirmed = 0
    for item in proposals_seen:
        if _state._stop_event.is_set():
            break
        proposal = item["proposal"]
        action = item["action"]
        tool_name = proposal.get("tool", "")
        if _auto_confirm(proposal, ticket_id, ticket_num):
            confirmed += 1
            # Update action status to confirmed
            db2: Session = SessionLocal()
            try:
                a = db2.query(AgentAction).filter(AgentAction.id == action.id).first()
                if a:
                    a.status = "confirmed"
                    db2.commit()
                _log_activity(
                    db2,
                    event_type="action_confirmed",
                    description=f"[{ticket_num}] Auto-confirmed: {proposal.get('label', tool_name)}",
                    severity="success",
                    ticket_id=ticket_id,
                    ticket_num=ticket_num,
                    action_type=tool_name,
                )
            finally:
                db2.close()

    return {
        "reads": reads,
        "writes": writes,
        "confirmed": confirmed,
        "proposals": len(proposals_seen),
        # Per-action-type counts (s4-f1)
        "vendor_emails": vendor_emails,
        "tenant_responses": tenant_responses,
        "owner_reports": owner_reports,
        "escalations": escalations,
    }


# ---------------------------------------------------------------------------
# Main queue loop
# ---------------------------------------------------------------------------

def _queue_loop() -> None:
    """
    Background thread entry point.
    Processes open tickets in priority order until stopped or exhausted.
    """
    db: Session = SessionLocal()
    try:
        _log_activity(db, event_type="queue_started", description="Agent auto-solve activated — processing queue", severity="info")
    finally:
        db.close()

    while not _state._stop_event.is_set():
        # Load current open tickets
        db = SessionLocal()
        try:
            tickets = _get_open_tickets(db)
        finally:
            db.close()

        if not tickets:
            # Queue exhausted — build summary (s4-f1)
            elapsed = time.time() - (_state.start_time or time.time())
            processed = _state.processed_count
            tpm = round((processed / (elapsed / 60.0)), 1) if elapsed > 5 else 0.0

            summary = {
                "ticketsProcessed": processed,
                "vendorEmails": _state.total_vendor_emails,
                "tenantResponses": _state.total_tenant_responses,
                "ownerReports": _state.total_owner_reports,
                "escalations": _state.total_escalations,
                "totalConfirmed": _state.total_confirmed,
                "processingTimeSeconds": round(elapsed, 1),
                "ticketsPerMinute": tpm,
            }

            db = SessionLocal()
            try:
                _log_activity(db, event_type="queue_exhausted", description="All tickets processed — queue empty", severity="success")
            finally:
                db.close()
            with _state._lock:
                _state.is_running = False
                _state.current_ticket_id = None
                _state.current_ticket_num = None
                _state.remaining_count = 0

            # Broadcast exhausted event with summary embedded
            _subscribers.broadcast({
                "id": None,
                "ticketId": None,
                "ticketNum": None,
                "eventType": "queue_exhausted",
                "actionType": None,
                "description": "All tickets processed — queue empty",
                "severity": "success",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "status": _state.to_dict(),
                "summary": summary,
            })
            break

        # Update remaining count
        with _state._lock:
            _state.remaining_count = len(tickets)

        # Pick first ticket not currently in a terminal / in-flight state
        ticket = tickets[0]

        with _state._lock:
            _state.current_ticket_id = ticket.id
            _state.current_ticket_num = ticket.num
            _state.remaining_count = len(tickets) - 1

        db = SessionLocal()
        try:
            _log_activity(
                db,
                event_type="ticket_started",
                description=f"[{ticket.num}] Starting: {ticket.subject[:80]}",
                severity="info",
                ticket_id=ticket.id,
                ticket_num=ticket.num,
            )
        finally:
            db.close()

        # Run the agent
        result = _process_ticket(ticket.id, ticket.num, ticket.property_id)

        # Accumulate summary stats (s4-f1)
        with _state._lock:
            _state.processed_count += 1
            _state.total_vendor_emails += result.get("vendor_emails", 0)
            _state.total_tenant_responses += result.get("tenant_responses", 0)
            _state.total_owner_reports += result.get("owner_reports", 0)
            _state.total_escalations += result.get("escalations", 0)
            _state.total_confirmed += result.get("confirmed", 0)
            if "error" in result:
                _state.failed_count += 1

        db = SessionLocal()
        try:
            _log_activity(
                db,
                event_type="ticket_completed",
                description=(
                    f"[{ticket.num}] Done — "
                    f"{result.get('reads', 0)} reads, "
                    f"{result.get('confirmed', 0)}/{result.get('writes', 0)} actions confirmed"
                ),
                severity="success" if "error" not in result else "warning",
                ticket_id=ticket.id,
                ticket_num=ticket.num,
            )
        finally:
            db.close()

        # Broadcast queue status update
        _subscribers.broadcast({
            "id": None,
            "ticketId": None,
            "ticketNum": None,
            "eventType": "queue_status",
            "actionType": None,
            "description": "Queue status updated",
            "severity": "info",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "status": _state.to_dict(),
        })

        # Delay between tickets — use state-based delay for speed control (s4-f5)
        delay = _state.inter_ticket_delay
        for _ in range(int(delay * 10)):
            if _state._stop_event.is_set():
                break
            time.sleep(0.1)

    # Thread is done
    with _state._lock:
        _state.is_running = False
        _state.current_ticket_id = None
        _state.current_ticket_num = None

    if _state._stop_event.is_set():
        db = SessionLocal()
        try:
            _log_activity(
                db,
                event_type="queue_stopped",
                description="Agent auto-solve stopped by operator",
                severity="info",
            )
        finally:
            db.close()

    _subscribers.broadcast({
        "id": None,
        "ticketId": None,
        "ticketNum": None,
        "eventType": "queue_stopped",
        "actionType": None,
        "description": "Queue stopped",
        "severity": "info",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "status": _state.to_dict(),
    })


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def start_queue(speed: str = "normal") -> Dict[str, Any]:
    """
    Start the background queue processor. No-op if already running.
    speed: one of 'slow', 'normal', 'fast' (s4-f5)
    """
    with _state._lock:
        if _state.is_running:
            return {"started": False, "reason": "already running", **_state.to_dict()}

        # Apply speed preset (s4-f5)
        preset = SPEED_PRESETS.get(speed, SPEED_PRESETS["normal"])
        _state.speed = speed
        _state.inter_ticket_delay = preset["inter_ticket"]
        _state.auto_confirm_delay = preset["auto_confirm"]

        _state.is_running = True
        _state.processed_count = 0
        _state.failed_count = 0
        _state._stop_event.clear()
        # Reset summary counters (s4-f1)
        _state.total_vendor_emails = 0
        _state.total_tenant_responses = 0
        _state.total_owner_reports = 0
        _state.total_escalations = 0
        _state.total_confirmed = 0
        _state.start_time = time.time()

        t = threading.Thread(target=_queue_loop, daemon=True, name="hermes-auto-queue")
        _state._thread = t
        t.start()

    return {"started": True, **_state.to_dict()}


def stop_queue() -> Dict[str, Any]:
    """Signal the queue to stop after finishing the current ticket."""
    with _state._lock:
        if not _state.is_running:
            return {"stopped": False, "reason": "not running", **_state.to_dict()}
        _state._stop_event.set()
        # Mark as stopping — the thread will set is_running=False when it exits
        _state.is_running = False

    return {"stopped": True, **_state.to_dict()}


def get_status() -> Dict[str, Any]:
    """Return current queue status."""
    return _state.to_dict()


def subscribe_to_feed() -> Tuple[str, "queue.Queue"]:
    """Subscribe to the live activity feed (for SSE). Returns (sub_id, q)."""
    return _subscribers.subscribe()


def unsubscribe_from_feed(sub_id: str) -> None:
    _subscribers.unsubscribe(sub_id)
