"""
agent_tools.py — Hermes tool registry.

Tools split into:
  - READ tools  → execute immediately against the DB, return result to the LLM
  - WRITE tools → produce a `proposed_action` envelope; operator confirms in UI
                  by POSTing to `confirm_endpoint` themselves. The agent never
                  silently mutates state.

Schema format follows OpenAI/OpenRouter function-calling spec
(`tools=[{type: "function", function: {name, description, parameters}}]`).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterator, List, Optional

from sqlalchemy.orm import Session

from app.models.tickets import Ticket
from app.models.properties import Property
from app.models.units import Unit
from app.models.vendors import Vendor
from app.models.vendor_cases import VendorCase
from app.models.owners import Owner
from app.models.context_versions import ContextVersion
from app.models.vendor_jobs import VendorJob
from app.services.audit_service import create_audit_entry
from app.services.context_layer_service import parse_layers
from app.services import email_action
from app.services.tavily_client import TavilyClient, normalise_results

# Channel mapping from ticket source to communication channel
_SOURCE_TO_CHANNEL = {
    "voice": "sms",
    "email": "email_reply",
    "portal": "portal_message",
    "slack": "slack_message",
    "manual": "email_reply",
    "api": "email_reply",
    "letter": "email_reply",
    "simulated": "email_reply",
}


# ---------------------------------------------------------------------------
# Tool descriptor
# ---------------------------------------------------------------------------


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]      # JSON-schema for arguments
    is_write: bool                  # True → emit proposal, don't execute
    executor: Optional[Callable[[Session, Dict[str, Any]], Dict[str, Any]]] = None
    # "read"   — execute immediately, return result to LLM
    # "write"  — produce a proposed_action envelope for operator review
    # "stream" — execute side effects directly while emitting incremental phases.
    #            Provide `streaming_executor` instead of `executor`.
    kind: str = "read"
    streaming_executor: Optional[
        Callable[[Session, Dict[str, Any]], Iterator[Any]]
    ] = None

    def schema(self) -> Dict[str, Any]:
        """Return the tool descriptor in the OpenAI function-calling shape."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ticket_summary(t: Ticket) -> Dict[str, Any]:
    return {
        "id": t.id,
        "num": t.num,
        "propertyId": t.property_id,
        "unitId": t.unit_id,
        "subject": t.subject,
        "status": t.status,
        "risk": t.risk,
        "raisedBy": t.raised_by,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
    }


def _vendor_summary(v: Vendor) -> Dict[str, Any]:
    return {
        "id": v.id,
        "name": v.name,
        "trade": v.trade,
        "preferred": v.preferred,
        "slaHours": v.sla_hours,
        "rating": float(v.rating) if v.rating is not None else None,
    }


def _audit(db: Session, action: str, args: Dict[str, Any]) -> None:
    """Log the tool call to the audit trail (cheap, invaluable for replay)."""
    create_audit_entry(
        db,
        actor="hermes",
        action=action,
        entity_type="agent_tool",
        metadata={"args": args},
    )


# ---------------------------------------------------------------------------
# READ tool executors
# ---------------------------------------------------------------------------


def _list_tickets(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    q = db.query(Ticket)
    if pid := args.get("propertyId"):
        q = q.filter(Ticket.property_id == pid)
    if status := args.get("status"):
        q = q.filter(Ticket.status == status)
    if risk := args.get("risk"):
        q = q.filter(Ticket.risk == risk)
    rows = q.order_by(Ticket.created_at.desc()).limit(20).all()
    return {"tickets": [_ticket_summary(t) for t in rows], "count": len(rows)}


def _get_ticket(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    tid = args["ticketId"]
    t = db.query(Ticket).filter(Ticket.id == tid).first()
    if not t:
        return {"error": f"Ticket '{tid}' not found"}
    job = (
        db.query(VendorJob)
        .filter(VendorJob.ticket_id == tid)
        .order_by(VendorJob.created_at.desc())
        .first()
    )
    out = _ticket_summary(t)
    out["body"] = t.body
    out["excerpt"] = t.excerpt
    out["confidence"] = float(t.confidence) if t.confidence is not None else None
    if job:
        out["vendorJob"] = {
            "vendorId": job.vendor_id,
            "sentAt": job.sent_at.isoformat() if job.sent_at else None,
            "completedAt": job.completed_at.isoformat() if job.completed_at else None,
            "finalCostEur": float(job.final_cost_eur) if job.final_cost_eur is not None else None,
        }
    return out


def _list_escalations(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    rows = (
        db.query(Ticket)
        .filter(Ticket.risk == "high", ~Ticket.status.in_(["resolved", "rejected"]))
        .order_by(Ticket.created_at.desc())
        .all()
    )
    return {"escalations": [_ticket_summary(t) for t in rows], "count": len(rows)}


def _get_property(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    pid = args["propertyId"]
    p = db.query(Property).filter(Property.id == pid).first()
    if not p:
        return {"error": f"Property '{pid}' not found"}
    return {
        "id": p.id, "name": p.name, "buildingId": p.building_id,
        "ownerId": p.owner_id, "city": p.city, "phone": p.phone, "email": p.email,
    }


def _get_property_context(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    pid = args["propertyId"]
    cv = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == pid)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    if not cv:
        return {"error": f"No context for property '{pid}'"}
    return {
        "propertyId": pid,
        "version": cv.version,
        "layers": parse_layers(cv.content_md),
    }


def _list_vendors(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    q = db.query(Vendor)
    if bid := args.get("buildingId"):
        # join via building_vendors — keep it simple, raw SQL would be fine too
        from app.models.building_vendors import BuildingVendor
        ids = [r.vendor_id for r in db.query(BuildingVendor).filter(BuildingVendor.building_id == bid)]
        q = q.filter(Vendor.id.in_(ids))
    rows = q.order_by(Vendor.preferred.desc(), Vendor.rating.desc()).all()
    return {"vendors": [_vendor_summary(v) for v in rows]}


def _get_vendor(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    vid = args["vendorId"]
    v = db.query(Vendor).filter(Vendor.id == vid).first()
    if not v:
        return {"error": f"Vendor '{vid}' not found"}
    cases = db.query(VendorCase).filter(VendorCase.vendor_id == vid).order_by(VendorCase.date.desc()).limit(10).all()
    out = _vendor_summary(v)
    out["cases"] = [
        {
            "date": c.date,
            "description": c.description,
            "costEur": float(c.cost_eur) if c.cost_eur is not None else None,
            "slaMet": c.sla_met,
            "rating": c.rating,
        }
        for c in cases
    ]
    return out


def _list_units(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    pid = args["propertyId"]
    rows = db.query(Unit).filter(Unit.property_id == pid).order_by(Unit.label).all()
    return {
        "units": [
            {
                "id": u.id, "label": u.label, "type": u.type,
                "tenant": u.tenant, "ownerName": u.owner_name,
                "rentEur": float(u.rent_eur) if u.rent_eur is not None else None,
                "beirat": u.beirat,
            }
            for u in rows
        ]
    }


def _get_owner(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    oid = args["ownerId"]
    o = db.query(Owner).filter(Owner.id == oid).first()
    if not o:
        return {"error": f"Owner '{oid}' not found"}
    return {
        "id": o.id, "name": o.name, "type": o.type,
        "contact": o.contact, "email": o.email, "phone": o.phone,
        "policies": o.policies, "decisions": o.decisions,
    }


# ---------------------------------------------------------------------------
# Web-search READ tool (Demo Mode vendor fallback)
# ---------------------------------------------------------------------------


def _tavily_vendor_search(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Web-search vendor candidates via Tavily. Used when the seeded vendor
    table has nothing for the required trade and the agent is running in
    Demo Mode (so escalation isn't acceptable).

    Args:
      - trade (str, required) — e.g. "plumber", "electrician"
      - location (str, optional) — city or postcode for local results
      - query (str, optional) — full override; ignored if absent
    """
    trade = (args.get("trade") or "").strip()
    if not trade:
        return {"error": "trade is required"}
    location = (args.get("location") or "").strip()
    override = (args.get("query") or "").strip()

    if override:
        query = override
    else:
        suffix = f" in {location}" if location else ""
        query = f"reliable {trade} contractor{suffix} contact details"

    try:
        client = TavilyClient()
    except RuntimeError as e:
        return {"error": str(e)}

    try:
        raw = client.search(query, max_results=5, include_answer=True)
    except Exception as e:  # noqa: BLE001 — surface to LLM, don't crash run
        return {"error": f"{type(e).__name__}: {e}"}

    return {
        "query": query,
        "answer": raw.get("answer") or "",
        "results": normalise_results(raw),
    }


# ---------------------------------------------------------------------------
# WRITE tool executors — return a `proposed_action` envelope, do NOT mutate
# ---------------------------------------------------------------------------


def _propose_approve(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    tid = args["ticketId"]
    return {
        "tool": "approve_ticket",
        "args": {"ticketId": tid},
        "confirmEndpoint": f"/api/tickets/{tid}/approve",
        "confirmMethod": "POST",
        "confirmBody": {},
        "label": f"Approve & dispatch ticket {tid}",
    }


def _propose_reject(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    tid = args["ticketId"]
    reason = args.get("reason", "")
    return {
        "tool": "reject_ticket",
        "args": {"ticketId": tid, "reason": reason},
        "confirmEndpoint": f"/api/tickets/{tid}/reject",
        "confirmMethod": "POST",
        "confirmBody": {"reason": reason},
        "label": f"Reject ticket {tid}",
    }


def _propose_save_memory(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    tid = args["ticketId"]
    return {
        "tool": "save_memory",
        "args": {"ticketId": tid},
        "confirmEndpoint": f"/api/tickets/{tid}/memory/save",
        "confirmMethod": "POST",
        "confirmBody": {},
        "label": f"Save memory update for {tid}",
    }


def _propose_skip_memory(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    tid = args["ticketId"]
    return {
        "tool": "skip_memory",
        "args": {"ticketId": tid},
        "confirmEndpoint": f"/api/tickets/{tid}/memory/skip",
        "confirmMethod": "POST",
        "confirmBody": {},
        "label": f"Skip memory update for {tid}",
    }


def _propose_context_edit(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """No mutation endpoint exists yet — emit the diff for the operator to review."""
    return {
        "tool": "propose_context_edit",
        "args": args,
        "confirmEndpoint": None,
        "confirmMethod": None,
        "confirmBody": None,
        "label": f"Edit {args.get('layer','?')} layer of {args.get('propertyId','?')}",
        "diff": {
            "layer": args.get("layer"),
            "heading": args.get("heading"),
            "before": args.get("before"),
            "after": args.get("after"),
            "rationale": args.get("rationale"),
        },
    }


def _propose_send_vendor_email(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Propose sending an email to a vendor about a ticket.
    The email is NOT sent — it is displayed as a proposed action for operator review.
    """
    tid = args.get("ticketId", "")
    vendor_name = args.get("vendorName", "Vendor")
    recipient = args.get("recipient", "")
    subject = args.get("subject", "")
    body = args.get("body", "")

    return {
        "tool": "send_vendor_email",
        "args": args,
        "confirmEndpoint": None,   # display-only: no actual email sending
        "confirmMethod": None,
        "confirmBody": None,
        "label": f"Send email to {vendor_name} ({recipient})",
        "email": {
            "to": recipient,
            "vendorName": vendor_name,
            "subject": subject,
            "body": body,
            "ticketId": tid,
        },
    }


def _propose_respond_to_tenant(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Propose a response to a tenant inquiry.
    The channel is matched to the ticket's source channel.
    """
    tid = args.get("ticketId", "")
    tenant_name = args.get("tenantName", "Tenant")
    channel = args.get("channel", "email_reply")
    body = args.get("body", "")

    # Derive a friendly channel label
    channel_labels = {
        "email_reply": "Email reply",
        "sms": "SMS",
        "portal_message": "Portal message",
        "slack_message": "Slack message",
    }
    channel_label = channel_labels.get(channel, channel)

    return {
        "tool": "respond_to_tenant",
        "args": args,
        "confirmEndpoint": None,   # display-only
        "confirmMethod": None,
        "confirmBody": None,
        "label": f"Respond to {tenant_name} via {channel_label}",
        "response": {
            "tenantName": tenant_name,
            "channel": channel,
            "channelLabel": channel_label,
            "body": body,
            "ticketId": tid,
        },
    }


def _propose_send_owner_report(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Propose sending a financial report/summary to the property owner.
    Respects the owner's preferred communication channel and format.
    """
    tid = args.get("ticketId", "")
    owner_name = args.get("ownerName", "Owner")
    recipient = args.get("recipient", "")
    channel = args.get("channel", "email")
    fmt = args.get("format", "plain_email")
    content = args.get("content", "")

    format_labels = {
        "pdf_email": "PDF via email",
        "plain_email": "Plain-text email",
        "email": "Email",
    }
    fmt_label = format_labels.get(fmt, fmt)

    return {
        "tool": "send_owner_report",
        "args": args,
        "confirmEndpoint": None,   # display-only
        "confirmMethod": None,
        "confirmBody": None,
        "label": f"Send financial report to {owner_name} ({fmt_label})",
        "report": {
            "ownerName": owner_name,
            "recipient": recipient,
            "channel": channel,
            "format": fmt,
            "formatLabel": fmt_label,
            "content": content,
            "ticketId": tid,
        },
    }


def _propose_escalate_to_human(db: Session, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Propose escalating a ticket to a human operator.
    Sets the confirm endpoint so the operator can confirm and actually escalate.
    """
    tid = args.get("ticketId", "")
    reason = args.get("reason", "")
    triggering_policy = args.get("triggeringPolicy", "")
    recommendation = args.get("recommendation", "")

    return {
        "tool": "escalate_to_human",
        "args": args,
        "confirmEndpoint": f"/api/tickets/{tid}/escalate",
        "confirmMethod": "POST",
        "confirmBody": {
            "reason": reason,
            "triggeringPolicy": triggering_policy,
            "recommendation": recommendation,
        },
        "label": f"Escalate ticket {tid} to human operator",
        "escalation": {
            "reason": reason,
            "triggeringPolicy": triggering_policy,
            "recommendation": recommendation,
            "ticketId": tid,
        },
    }


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


REGISTRY: List[Tool] = [
    Tool(
        name="list_tickets",
        description="List tickets, optionally filtered by property, status, or risk. Returns up to 20 most recent.",
        parameters={
            "type": "object",
            "properties": {
                "propertyId": {"type": "string"},
                "status": {"type": "string", "enum": [
                    "new","triaged","proposed","approved","awaiting_vendor",
                    "scheduled","in_progress","completed","resolved","rejected",
                ]},
                "risk": {"type": "string", "enum": ["low","medium","high"]},
            },
        },
        is_write=False,
        executor=_list_tickets,
    ),
    Tool(
        name="get_ticket",
        description="Fetch a ticket with its body, vendor job summary and confidence.",
        parameters={
            "type": "object",
            "properties": {"ticketId": {"type": "string"}},
            "required": ["ticketId"],
        },
        is_write=False,
        executor=_get_ticket,
    ),
    Tool(
        name="list_escalations",
        description="List high-risk open tickets that need operator attention now.",
        parameters={"type": "object", "properties": {}},
        is_write=False,
        executor=_list_escalations,
    ),
    Tool(
        name="get_property",
        description="Get core property metadata (building, owner, city, contact).",
        parameters={
            "type": "object",
            "properties": {"propertyId": {"type": "string"}},
            "required": ["propertyId"],
        },
        is_write=False,
        executor=_get_property,
    ),
    Tool(
        name="get_property_context",
        description="Fetch the property's context.md split into 4 layers (vendor, owner, building, property).",
        parameters={
            "type": "object",
            "properties": {"propertyId": {"type": "string"}},
            "required": ["propertyId"],
        },
        is_write=False,
        executor=_get_property_context,
    ),
    Tool(
        name="list_vendors",
        description="List vendors. Optionally filter by building.",
        parameters={
            "type": "object",
            "properties": {"buildingId": {"type": "string"}},
        },
        is_write=False,
        executor=_list_vendors,
    ),
    Tool(
        name="get_vendor",
        description="Get a vendor's profile + last 10 cases.",
        parameters={
            "type": "object",
            "properties": {"vendorId": {"type": "string"}},
            "required": ["vendorId"],
        },
        is_write=False,
        executor=_get_vendor,
    ),
    Tool(
        name="tavily_vendor_search",
        description=(
            "Search the open web (via Tavily) for vendor candidates when no "
            "seeded vendor matches the requested trade. ONLY use this in Demo "
            "Mode and ONLY after `list_vendors` returns no match — it replaces "
            "`escalate_to_human` for the missing-vendor case so the agent can "
            "solve the issue autonomously. Returns up to 5 ranked results plus a "
            "short summary; pick the most credible one and continue with normal "
            "outreach (`send_email_via_mailosaur` or `send_vendor_email`)."
        ),
        parameters={
            "type": "object",
            "properties": {
                "trade":    {"type": "string", "description": "e.g. plumber, electrician, locksmith"},
                "location": {"type": "string", "description": "city or postcode for local results"},
                "query":    {"type": "string", "description": "optional full search query override"},
            },
            "required": ["trade"],
        },
        is_write=False,
        executor=_tavily_vendor_search,
    ),
    Tool(
        name="list_units",
        description="List all units in a property with tenant, owner and rent.",
        parameters={
            "type": "object",
            "properties": {"propertyId": {"type": "string"}},
            "required": ["propertyId"],
        },
        is_write=False,
        executor=_list_units,
    ),
    Tool(
        name="get_owner",
        description="Get an owner record including policies and recent decisions.",
        parameters={
            "type": "object",
            "properties": {"ownerId": {"type": "string"}},
            "required": ["ownerId"],
        },
        is_write=False,
        executor=_get_owner,
    ),
    # ---------- WRITE tools (proposal-only) ----------
    Tool(
        name="approve_ticket",
        description="Propose to approve a ticket. The operator confirms before dispatch.",
        parameters={
            "type": "object",
            "properties": {"ticketId": {"type": "string"}},
            "required": ["ticketId"],
        },
        is_write=True,
        executor=_propose_approve,
    ),
    Tool(
        name="reject_ticket",
        description="Propose to reject a ticket. Include a short reason.",
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["ticketId"],
        },
        is_write=True,
        executor=_propose_reject,
    ),
    Tool(
        name="save_memory",
        description="Propose to save the memory update produced by the memory engine.",
        parameters={
            "type": "object",
            "properties": {"ticketId": {"type": "string"}},
            "required": ["ticketId"],
        },
        is_write=True,
        executor=_propose_save_memory,
    ),
    Tool(
        name="skip_memory",
        description="Propose to skip the memory update for a ticket.",
        parameters={
            "type": "object",
            "properties": {"ticketId": {"type": "string"}},
            "required": ["ticketId"],
        },
        is_write=True,
        executor=_propose_skip_memory,
    ),
    Tool(
        name="propose_context_edit",
        description="Propose a manual context-md edit. Provide before/after/rationale; operator reviews.",
        parameters={
            "type": "object",
            "properties": {
                "propertyId": {"type": "string"},
                "layer": {"type": "string", "enum": ["vendor","owner","building","property"]},
                "heading": {"type": "string"},
                "before": {"type": "string"},
                "after": {"type": "string"},
                "rationale": {"type": "string"},
            },
            "required": ["propertyId","layer","heading","after","rationale"],
        },
        is_write=True,
        executor=_propose_context_edit,
    ),
    # ---------- Sprint 2 WRITE tools ----------
    Tool(
        name="send_vendor_email",
        description=(
            "Propose drafting and sending an email to a vendor regarding a ticket. "
            "The email references the ticket details and the vendor's contact info from context. "
            "The email is NOT sent automatically — it is displayed as a proposed action for the operator. "
            "First use get_vendor to retrieve the vendor's email address. "
            "Write a professional German or English email as appropriate."
        ),
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string", "description": "ID of the ticket this email is for"},
                "vendorId": {"type": "string", "description": "ID of the vendor to email"},
                "vendorName": {"type": "string", "description": "Display name of the vendor"},
                "recipient": {"type": "string", "description": "Vendor email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "Full email body text"},
            },
            "required": ["ticketId", "vendorId", "vendorName", "recipient", "subject", "body"],
        },
        is_write=True,
        executor=_propose_send_vendor_email,
    ),
    Tool(
        name="respond_to_tenant",
        description=(
            "Propose a response to a tenant's inquiry or message. "
            "The response channel must match the ticket's source: "
            "voice→sms, email→email_reply, portal→portal_message. "
            "The response should be accurate using property context (FAQ, rules, policies). "
            "Write in the same language as the tenant's message (usually German, Sie-form)."
        ),
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string", "description": "ID of the ticket being responded to"},
                "tenantName": {"type": "string", "description": "Name of the tenant"},
                "channel": {
                    "type": "string",
                    "enum": ["email_reply", "sms", "portal_message", "slack_message"],
                    "description": "Communication channel matching the ticket source",
                },
                "body": {"type": "string", "description": "Full response text to the tenant"},
            },
            "required": ["ticketId", "tenantName", "channel", "body"],
        },
        is_write=True,
        executor=_propose_respond_to_tenant,
    ),
    Tool(
        name="send_owner_report",
        description=(
            "Propose sending a financial report or summary to the property owner. "
            "Use when the ticket involves cost reporting, invoice forwarding, arrears notification, "
            "or monthly summaries. Compile data from vendor jobs, unit rents, and ticket history. "
            "Respect the owner's communication preferences from the owner layer of property context "
            "(channel, format, language). The report is NOT sent automatically — it is proposed."
        ),
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string", "description": "ID of the related ticket"},
                "ownerName": {"type": "string", "description": "Owner display name"},
                "recipient": {"type": "string", "description": "Owner email address"},
                "channel": {
                    "type": "string",
                    "enum": ["email", "portal_message"],
                    "description": "Communication channel (from owner preferences)",
                },
                "format": {
                    "type": "string",
                    "enum": ["pdf_email", "plain_email"],
                    "description": "Report format (from owner preferences)",
                },
                "content": {"type": "string", "description": "Full report content / financial summary"},
            },
            "required": ["ticketId", "ownerName", "recipient", "channel", "format", "content"],
        },
        is_write=True,
        executor=_propose_send_owner_report,
    ),
    Tool(
        name="escalate_to_human",
        description=(
            "Propose escalating a ticket to a human operator when the agent determines it "
            "cannot or should not resolve it autonomously. Use this when the ticket involves: "
            "legal matters (Abmahnung, Kündigung), rent arrears above policy thresholds, "
            "costs above the property's approval threshold, safety concerns, formal notices, "
            "or any situation explicitly listed in the property's escalation rules. "
            "Include the specific reason, which policy triggered escalation, "
            "and a clear recommendation for the human operator."
        ),
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string", "description": "ID of the ticket to escalate"},
                "reason": {"type": "string", "description": "Clear explanation of why this must be escalated"},
                "triggeringPolicy": {"type": "string", "description": "The specific rule/policy that requires escalation"},
                "recommendation": {"type": "string", "description": "Recommended next step for the human operator"},
            },
            "required": ["ticketId", "reason", "triggeringPolicy", "recommendation"],
        },
        is_write=True,
        executor=_propose_escalate_to_human,
    ),
    Tool(
        name="send_email_via_mailosaur",
        description=(
            "Send a real email through the Mailosaur sandbox SMTP and (optionally) wait "
            "for the recipient's reply. Use this for the autonomous tenant/vendor "
            "scheduling flow — vendor outreach, tenant timeslot relay, final confirmations. "
            "Streams progress phases (drafting → sending → awaiting_reply → reply_received). "
            "Set expectReply=false for fire-and-forget confirmations."
        ),
        parameters={
            "type": "object",
            "properties": {
                "ticketId": {"type": "string", "description": "ID of the ticket this email belongs to"},
                "recipientRole": {
                    "type": "string",
                    "enum": ["vendor", "tenant"],
                    "description": "Which actor we're emailing (decides which Mailosaur server to poll)",
                },
                "recipientAddress": {"type": "string", "description": "Recipient email address"},
                "fromAddress": {
                    "type": "string",
                    "description": "Sender address (defaults to hermes@<agent_server>.mailosaur.net)",
                },
                "subject": {"type": "string"},
                "body": {"type": "string"},
                "expectReply": {"type": "boolean", "default": True},
                "replyTimeoutSeconds": {"type": "integer", "default": 120},
            },
            "required": ["ticketId", "recipientRole", "recipientAddress", "subject", "body"],
        },
        is_write=True,
        kind="stream",
        streaming_executor=email_action.run,
    ),
]


_BY_NAME: Dict[str, Tool] = {t.name: t for t in REGISTRY}


def get_tool(name: str) -> Optional[Tool]:
    return _BY_NAME.get(name)


def schemas() -> List[Dict[str, Any]]:
    """All tool schemas in OpenAI function-calling format, for the LLM request."""
    return [t.schema() for t in REGISTRY]


def execute(db: Session, name: str, raw_args: str) -> Dict[str, Any]:
    """
    Run a tool by name. `raw_args` is the JSON-string from the LLM.
    Returns either the read result or the proposed_action envelope.
    Errors are returned as {"error": "..."} — never raised.

    Streaming tools cannot be invoked through this entry point — the runtime
    must drive their generator directly. Calling `execute` on a streaming
    tool is a programming error and surfaces as such.
    """
    tool = _BY_NAME.get(name)
    if tool is None:
        return {"error": f"Unknown tool '{name}'"}
    if tool.kind == "stream" or tool.executor is None:
        return {"error": f"Tool '{name}' is streaming and must be driven via the runtime"}
    try:
        args = json.loads(raw_args) if raw_args else {}
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in tool arguments"}

    _audit(db, f"agent.{'propose' if tool.is_write else 'read'}.{name}", args)

    try:
        return tool.executor(db, args)
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


def is_write(name: str) -> bool:
    tool = _BY_NAME.get(name)
    return tool is not None and tool.is_write


def is_streaming(name: str) -> bool:
    tool = _BY_NAME.get(name)
    return tool is not None and tool.kind == "stream"


def parse_args(raw_args: str) -> Dict[str, Any]:
    """Helper for the runtime: parse the LLM's JSON-string args, default to {}."""
    if not raw_args:
        return {}
    try:
        return json.loads(raw_args)
    except json.JSONDecodeError:
        return {}


def audit(db: Session, name: str, args: Dict[str, Any]) -> None:
    """Public wrapper so the runtime can audit streaming tool invocations."""
    _audit(db, f"agent.stream.{name}", args)
