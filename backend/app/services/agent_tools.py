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
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

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


# ---------------------------------------------------------------------------
# Tool descriptor
# ---------------------------------------------------------------------------


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]      # JSON-schema for arguments
    is_write: bool                  # True → emit proposal, don't execute
    executor: Callable[[Session, Dict[str, Any]], Dict[str, Any]]

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
    """
    tool = _BY_NAME.get(name)
    if tool is None:
        return {"error": f"Unknown tool '{name}'"}
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
