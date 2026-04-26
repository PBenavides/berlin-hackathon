"""
agent_runtime.py — Hermes agent loop with tool calling.

Yields a stream of `(event_name, data_dict)` tuples that the SSE route
serialises and pushes to the browser. Event types:

  delta             {text: str}
  tool_call         {id, name, args}
  tool_result       {id, ok, summary, result}
  action_proposal   {id, tool, args, label, confirmEndpoint, confirmMethod, confirmBody, ...}
  done              {messageId, appliedTo, turns}

Loop budget: MAX_TURNS tool-call cycles per user message. Falls back to a
single canned reply when no API key is configured.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict, Generator, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.services import agent_tools
from app.services.context_layer_service import parse_layers
from app.models.context_versions import ContextVersion
from app.models.tickets import Ticket
from app.config import get_settings


_MODEL = "google/gemini-2.5-flash"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
# Override via env: HERMES_MAX_TURNS=20
MAX_TURNS = int(os.environ.get("HERMES_MAX_TURNS", "50"))


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def _open_tickets_summary(db: Session, property_id: str, limit: int = 6) -> str:
    rows = (
        db.query(Ticket)
        .filter(
            Ticket.property_id == property_id,
            ~Ticket.status.in_(["resolved", "rejected"]),
        )
        .order_by(Ticket.created_at.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return "(no open tickets)"
    return "\n".join(
        f"- {t.num or t.id} [{t.status}, risk={t.risk or '-'}]: {t.subject}"
        for t in rows
    )


def _system_prompt(db: Session, property_id: Optional[str], scope: Optional[Dict[str, Any]]) -> str:
    base = (
        "You are Hermes, the property-management assistant for Buena. "
        "You can read system state via tools and propose write actions for the operator to confirm. "
        "Rules:\n"
        "- Always use tools for facts (ticket status, vendor history, context). Never invent IDs, "
        "  numbers, or vendor names.\n"
        "- Cite ticket numbers (e.g. GAR-118) when you discuss them.\n"
        "- For write actions (approve, reject, save_memory, skip_memory, propose_context_edit, "
        "  send_vendor_email, respond_to_tenant, send_owner_report, escalate_to_human), "
        "  CALL the tool — it does not mutate state, it surfaces a confirm button to the operator.\n"
        "- Ticket action selection logic:\n"
        "  * Maintenance/repair ticket → use get_property_context + list_vendors + get_vendor, then approve_ticket or send_vendor_email\n"
        "  * Tenant FAQ/inquiry → use get_property_context to find the answer, then respond_to_tenant (channel matches ticket source: voice→sms, email→email_reply, portal→portal_message)\n"
        "  * Financial/cost/invoice request → use list_units + get_owner, then send_owner_report\n"
        "  * Legal dispute/formal notice/Abmahnung/Kündigung/rent_arrears > threshold → ALWAYS escalate_to_human\n"
        "  * Costs above property threshold → escalate_to_human\n"
        "- Be concise (2-4 sentences once you have the answer).\n"
        f"- The hard tool-call budget is {MAX_TURNS} turns; gather info efficiently."
    )
    if not property_id:
        return base

    cv = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    open_tickets = _open_tickets_summary(db, property_id)
    ctx_preview = ""
    if cv:
        layers = parse_layers(cv.content_md)
        ctx_preview = (
            f"# Property {property_id} (context v{cv.version})\n"
            f"## Vendor layer\n{layers['vendor']['raw'][:500]}\n"
            f"## Owner layer\n{layers['owner']['raw'][:500]}\n"
        )
    scope_line = ""
    if scope:
        scope_line = f"\nCurrent operator scope: layer={scope.get('layer')}, id={scope.get('id')}\n"
    property_id_line = (
        f"\n\nIMPORTANT: When calling tools, always use the internal property ID '{property_id}' "
        f"(not a derived slug). For example: list_tickets(propertyId='{property_id}'), "
        f"get_property_context(propertyId='{property_id}')."
    ) if property_id else ""
    return f"{base}\n\n{ctx_preview}\n# Open tickets:\n{open_tickets}{scope_line}{property_id_line}"


# ---------------------------------------------------------------------------
# Stub mode (no API key)
# ---------------------------------------------------------------------------


def _stub_stream(message: str, property_id: Optional[str], db: Session) -> Generator[Tuple[str, Dict[str, Any]], None, None]:
    open_tix = _open_tickets_summary(db, property_id) if property_id else "(no property scope)"
    reply = (
        f'You asked: "{message[:80]}". '
        f"Open items: {open_tix}. "
        f"Click an open ticket to review its proposal."
    )
    for word in reply.split(" "):
        yield ("delta", {"text": word + " "})


# ---------------------------------------------------------------------------
# OpenRouter call (one turn, may include tool_calls in the result)
# ---------------------------------------------------------------------------


def _call_llm_streaming(
    api_key: str,
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
) -> Tuple[str, List[Dict[str, Any]], str]:
    """
    Stream one model turn. Returns (content_text, tool_calls, finish_reason).

    `tool_calls` is the list of accumulated calls (each {id, name, arguments_str}).
    Yields nothing — we rebuild streaming at a higher level via a synchronous
    generator wrapper to keep the loop linear.
    """
    import httpx

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Buena ContextOps",
    }
    body = {
        "model": _MODEL,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": 0.3,
        "max_tokens": 800,
        "stream": False,  # use non-streaming for tool-call accumulation simplicity
    }

    r = httpx.post(_OPENROUTER_URL, json=body, headers=headers, timeout=60.0)
    r.raise_for_status()
    data = r.json()
    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content = msg.get("content") or ""
    raw_tool_calls = msg.get("tool_calls") or []
    tool_calls = [
        {
            "id": tc.get("id") or f"call_{uuid.uuid4().hex[:8]}",
            "name": (tc.get("function") or {}).get("name", ""),
            "arguments_str": (tc.get("function") or {}).get("arguments", "{}"),
        }
        for tc in raw_tool_calls
    ]
    finish = choice.get("finish_reason") or "stop"
    return content, tool_calls, finish


def _chunk_text(text: str, n: int = 6) -> List[str]:
    """Split a finished completion into pseudo-chunks so the UI still streams."""
    words = text.split(" ")
    out = []
    for i in range(0, len(words), n):
        out.append(" ".join(words[i:i + n]) + (" " if i + n < len(words) else ""))
    return out


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def stream_agent(
    db: Session,
    user_message: str,
    property_id: Optional[str] = None,
    scope: Optional[Dict[str, Any]] = None,
) -> Generator[Tuple[str, Dict[str, Any]], None, None]:
    """
    Top-level generator. Yields (event_name, data) tuples.
    Caller (chat route) wraps each into SSE bytes.
    """
    settings = get_settings()
    api_key = settings.openrouter_api_key or settings.openai_api_key or os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    message_id = f"msg-{uuid.uuid4().hex[:10]}"

    if not api_key:
        yield from _stub_stream(user_message, property_id, db)
        yield ("done", {"messageId": message_id, "appliedTo": [], "turns": 0})
        return

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": _system_prompt(db, property_id, scope)},
        {"role": "user", "content": user_message},
    ]
    tools = agent_tools.schemas()
    applied_to: List[Dict[str, Any]] = []

    for turn in range(MAX_TURNS):
        try:
            content, tool_calls, finish = _call_llm_streaming(api_key, messages, tools)
        except Exception as e:
            # Graceful degradation — fall back to the deterministic stub so
            # the demo never breaks mid-conversation on an upstream LLM hiccup.
            yield ("delta", {"text": f"[hermes-fallback: {type(e).__name__}] "})
            yield from _stub_stream(user_message, property_id, db)
            yield ("done", {"messageId": message_id, "appliedTo": applied_to, "turns": turn})
            return

        # Stream the content text (if any) as faux-chunks for the UI
        for chunk in _chunk_text(content):
            yield ("delta", {"text": chunk})

        if not tool_calls:
            yield ("done", {"messageId": message_id, "appliedTo": applied_to, "turns": turn + 1})
            return

        # Append the assistant's tool-calling turn so the model sees its own calls
        messages.append({
            "role": "assistant",
            "content": content or None,
            "tool_calls": [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments_str"]},
                }
                for tc in tool_calls
            ],
        })

        for tc in tool_calls:
            name = tc["name"]
            args_str = tc["arguments_str"]
            yield ("tool_call", {"id": tc["id"], "name": name, "args": _safe_parse(args_str)})

            result = agent_tools.execute(db, name, args_str)
            db.commit()  # flush audit log entry per tool call

            if agent_tools.is_write(name):
                # Surface as an action_proposal — the result IS the proposal envelope
                yield ("action_proposal", {**result, "id": tc["id"]})
                tool_payload = {"proposed": True, "label": result.get("label")}
            else:
                summary = _summarise(name, result)
                yield ("tool_result", {
                    "id": tc["id"], "ok": "error" not in result,
                    "summary": summary, "result": result,
                })
                tool_payload = result

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(tool_payload, default=str)[:4000],
            })

    # Hit the cap
    yield ("delta", {"text": f"\n[Hit {MAX_TURNS}-turn budget — please refine your question.]"})
    yield ("done", {"messageId": message_id, "appliedTo": applied_to, "turns": MAX_TURNS})


def _safe_parse(s: str) -> Any:
    try:
        return json.loads(s) if s else {}
    except json.JSONDecodeError:
        return {"_raw": s}


def _summarise(tool_name: str, result: Dict[str, Any]) -> str:
    """Short human-readable line for the SSE viewer / debug panel."""
    if "error" in result:
        return f"{tool_name}: error — {result['error']}"
    if tool_name == "list_tickets":
        return f"list_tickets → {result.get('count', 0)} tickets"
    if tool_name == "get_ticket":
        return f"get_ticket → {result.get('id')} status={result.get('status')}"
    if tool_name == "list_escalations":
        return f"list_escalations → {result.get('count', 0)} high-risk open"
    if tool_name == "get_property_context":
        return f"get_property_context v{result.get('version')}"
    if tool_name == "list_vendors":
        return f"list_vendors → {len(result.get('vendors', []))} vendors"
    if tool_name == "get_vendor":
        return f"get_vendor → {result.get('name')} ({len(result.get('cases', []))} cases)"
    # Sprint 2 write tools (appear as action_proposal, not tool_result, but include for completeness)
    if tool_name == "send_vendor_email":
        return f"send_vendor_email → draft to {result.get('email', {}).get('to', '?')}"
    if tool_name == "respond_to_tenant":
        return f"respond_to_tenant → {result.get('response', {}).get('channelLabel', '?')}"
    if tool_name == "send_owner_report":
        return f"send_owner_report → {result.get('report', {}).get('formatLabel', '?')}"
    if tool_name == "escalate_to_human":
        return f"escalate_to_human → {result.get('escalation', {}).get('reason', '?')[:60]}"
    return f"{tool_name} ok"
