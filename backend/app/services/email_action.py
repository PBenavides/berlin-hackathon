"""
email_action.py — The streamed Hermes email tool.

`EmailAction.run(db, args)` is a generator that yields phase records for the
agent runtime. Each phase becomes a `tool_phase` SSE frame and is appended to
the corresponding AgentAction.payload["phases"] array, so the activity feed
shows ONE row that mutates from drafting → sending → awaiting_reply →
reply_received → completed.

The final tuple yielded by the generator is `("__final__", result_dict)`,
which the runtime serialises as a normal `tool_result` and feeds back to
the LLM so it can keep reasoning.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Generator, Tuple

from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.mailosaur_client import MailosaurClient


# Phase tuple = (phase_name, data_dict). Generator terminator is ("__final__", payload).
PhaseEvent = Tuple[str, Dict[str, Any]]


@dataclass
class _Phase:
    name: str
    description: str


PHASE_DRAFTING = _Phase("drafting", "Drafting email")
PHASE_SENDING = _Phase("sending", "Sending via Mailosaur")
PHASE_AWAITING = _Phase("awaiting_reply", "Awaiting reply")
PHASE_RECEIVED = _Phase("reply_received", "Reply received")
PHASE_COMPLETED = _Phase("completed", "Email round-trip complete")
PHASE_ERROR = _Phase("error", "Email tool error")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _agent_from_address() -> str:
    s = get_settings()
    if s.mailosaur_agent_server:
        return f"hermes@{s.mailosaur_agent_server}.mailosaur.net"
    return "hermes@mailosaur.net"


def _server_id_for(role: str) -> str:
    s = get_settings()
    if role == "vendor":
        return s.mailosaur_vendor_server
    if role == "tenant":
        return s.mailosaur_tenant_server
    return s.mailosaur_agent_server


def run(
    db: Session, args: Dict[str, Any]
) -> Generator[PhaseEvent, None, None]:
    """
    Drive one outbound email + (optional) reply round-trip through Mailosaur.

    Args (from the LLM tool call):
      - ticketId (str)
      - recipientRole ("vendor" | "tenant")
      - recipientAddress (str)
      - subject (str)
      - body (str)
      - expectReply (bool, default True)
      - replyTimeoutSeconds (int, default 120)
      - fromAddress (str, optional — defaults to hermes@<agent_server>)
    """
    started = datetime.now(timezone.utc)
    role = args.get("recipientRole") or "vendor"
    to_addr = args.get("recipientAddress") or ""
    from_addr = args.get("fromAddress") or _agent_from_address()
    subject = args.get("subject") or ""
    body = args.get("body") or ""
    expect_reply = args.get("expectReply", True)
    timeout_s = int(args.get("replyTimeoutSeconds", 120))
    ticket_id = args.get("ticketId", "")

    # ---- drafting ----
    yield (
        PHASE_DRAFTING.name,
        {
            "label": PHASE_DRAFTING.description,
            "ts": _now_iso(),
            "data": {
                "to": to_addr,
                "from": from_addr,
                "subject": subject,
                "bodyExcerpt": body[:240],
            },
        },
    )

    try:
        client = MailosaurClient()
    except RuntimeError as e:
        yield (
            PHASE_ERROR.name,
            {"label": PHASE_ERROR.description, "ts": _now_iso(), "data": {"reason": str(e)}},
        )
        yield (
            "__final__",
            {
                "ok": False,
                "error": str(e),
                "ticketId": ticket_id,
            },
        )
        return

    # ---- sending ----
    yield (
        PHASE_SENDING.name,
        {
            "label": PHASE_SENDING.description,
            "ts": _now_iso(),
            "data": {"to": to_addr, "from": from_addr},
        },
    )

    try:
        client.send_smtp(from_addr=from_addr, to_addr=to_addr, subject=subject, body=body)
    except Exception as e:  # noqa: BLE001 — surface upstream failure to LLM
        yield (
            PHASE_ERROR.name,
            {
                "label": PHASE_ERROR.description,
                "ts": _now_iso(),
                "data": {"reason": f"smtp_failed: {type(e).__name__}: {e}"},
            },
        )
        yield (
            "__final__",
            {
                "ok": False,
                "error": f"smtp_failed: {e}",
                "ticketId": ticket_id,
            },
        )
        return

    if not expect_reply:
        yield (
            PHASE_COMPLETED.name,
            {
                "label": PHASE_COMPLETED.description,
                "ts": _now_iso(),
                "data": {
                    "durationMs": _ms_since(started),
                    "expectReply": False,
                },
            },
        )
        yield (
            "__final__",
            {
                "ok": True,
                "ticketId": ticket_id,
                "to": to_addr,
                "subject": subject,
                "expectReply": False,
            },
        )
        return

    # ---- awaiting reply ----
    server_id = _server_id_for(role)
    yield (
        PHASE_AWAITING.name,
        {
            "label": f"Awaiting reply from {role}",
            "ts": _now_iso(),
            "data": {
                "serverId": server_id,
                "address": from_addr,  # vendor/tenant replies to our agent inbox
                "timeoutS": timeout_s,
            },
        },
    )

    try:
        # Reply lands in the agent's own inbox (cuujqwff); `sent_to` is the
        # from_addr we used when sending (which is also the inbox we own).
        s = get_settings()
        agent_server = s.mailosaur_agent_server
        reply = client.wait_for_message(
            server_id=agent_server,
            sent_to=from_addr,
            timeout_s=timeout_s,
        )
    except TimeoutError as e:
        yield (
            PHASE_ERROR.name,
            {
                "label": PHASE_ERROR.description,
                "ts": _now_iso(),
                "data": {"reason": "reply_timeout", "detail": str(e)},
            },
        )
        yield (
            "__final__",
            {
                "ok": False,
                "error": "reply_timeout",
                "ticketId": ticket_id,
            },
        )
        return
    except Exception as e:  # noqa: BLE001
        yield (
            PHASE_ERROR.name,
            {
                "label": PHASE_ERROR.description,
                "ts": _now_iso(),
                "data": {"reason": f"poll_failed: {type(e).__name__}: {e}"},
            },
        )
        yield (
            "__final__",
            {
                "ok": False,
                "error": f"poll_failed: {e}",
                "ticketId": ticket_id,
            },
        )
        return

    # ---- reply received ----
    yield (
        PHASE_RECEIVED.name,
        {
            "label": f"Reply received from {role}",
            "ts": _now_iso(),
            "data": {
                "messageId": reply.id,
                "from": reply.from_addr,
                "subject": reply.subject,
                "bodyExcerpt": reply.text[:400],
            },
        },
    )

    # ---- completed ----
    yield (
        PHASE_COMPLETED.name,
        {
            "label": PHASE_COMPLETED.description,
            "ts": _now_iso(),
            "data": {"durationMs": _ms_since(started)},
        },
    )

    yield (
        "__final__",
        {
            "ok": True,
            "ticketId": ticket_id,
            "to": to_addr,
            "subject": subject,
            "reply": {
                "messageId": reply.id,
                "from": reply.from_addr,
                "subject": reply.subject,
                "text": reply.text,
            },
        },
    )


def _ms_since(start: datetime) -> int:
    return int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
