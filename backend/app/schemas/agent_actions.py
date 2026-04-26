"""
Pydantic schemas for AgentAction — the streaming action cards visible on the ticket detail page.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.base import CamelModel


class AgentActionOut(CamelModel):
    id: str
    ticket_id: str
    run_id: Optional[str] = None
    call_id: Optional[str] = None
    action_type: str
    tool_name: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    status: str  # "thinking" | "completed" | "proposed" | "confirmed" | "rejected"
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime


class EscalateRequest(CamelModel):
    """Body for POST /tickets/{id}/escalate"""
    reason: str
    triggering_policy: Optional[str] = None
    recommendation: Optional[str] = None


class EscalateResponse(CamelModel):
    status: str = "escalated"
    ticket_id: str
    escalation_reason: str


class AgentRunRequest(CamelModel):
    """Optional body for POST /tickets/{id}/agent-run (all fields optional)."""
    prompt_hint: Optional[str] = None  # optional operator hint to guide the agent
    demo_mode: bool = False  # when true, agent prefers tavily_vendor_search over escalation
