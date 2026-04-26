from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.schemas.base import CamelModel


class TicketBase(BaseModel):
    source: str
    external_id: Optional[str] = None
    raised_by: str
    subject: str
    body: str
    status: str = "new"
    risk: Optional[str] = None
    excerpt: Optional[str] = None
    raised_by_phone: Optional[str] = None
    confidence: Optional[float] = None


class TicketCreate(TicketBase):
    property_id: str
    unit_id: Optional[str] = None


class TicketOut(CamelModel):
    id: str
    num: Optional[str] = None
    property_id: str
    unit_id: Optional[str] = None
    source: str
    external_id: Optional[str] = None
    raised_by: str
    raised_by_phone: Optional[str] = None
    subject: str
    body: str
    status: str
    risk: Optional[str] = None
    excerpt: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime


class RejectRequest(BaseModel):
    """Optional body for POST /tickets/{id}/reject."""
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Nested children for the collapsed ticket DTO (frontend contract)
# ---------------------------------------------------------------------------


class ProposalForTicket(CamelModel):
    """Proposal nested under a ticket — uses API-contract field names."""
    id: str
    confidence: Optional[float] = None
    context_version: Optional[int] = None        # → contextVersion (int)
    proposed_action: Dict[str, Any] = Field(default_factory=dict)  # → proposedAction
    reasoning: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    policies_evaluated: List[Dict[str, Any]] = Field(default_factory=list)  # → policiesEvaluated


class CallSessionOut(CamelModel):
    duration: Optional[str] = None
    caller_phone: Optional[str] = None
    summary: Optional[str] = None
    noise_reduction_db: Optional[int] = None
    transcript: Optional[List[Dict[str, Any]]] = None


class VendorJobOut(CamelModel):
    vendor_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    accepted: Optional[bool] = None
    scheduled_for: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    final_cost_eur: Optional[float] = None
    notes: Optional[str] = None


class MemoryProposalOut(CamelModel):
    text: str
    target_version: int
    status: str  # "pending" | "saved" | "skipped"


class TicketDetail(TicketOut):
    """Single-ticket detail with all nested children, per frontend/API.md."""
    proposal: Optional[ProposalForTicket] = None
    call_session: Optional[CallSessionOut] = None
    email_body: Optional[str] = None
    vendor_job: Optional[VendorJobOut] = None
    memory_proposal: Optional[MemoryProposalOut] = None


# ---------------------------------------------------------------------------
# Response shapes for action endpoints
# ---------------------------------------------------------------------------


class ApproveResponse(CamelModel):
    status: str = "approved"
    vendor_job: Optional[VendorJobOut] = None


class MemorySaveResponse(CamelModel):
    status: str = "saved"
    context_version: int


class MemorySkipResponse(CamelModel):
    status: str = "skipped"
