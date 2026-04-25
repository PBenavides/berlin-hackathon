from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional
from decimal import Decimal

from app.schemas.base import CamelModel


class AgentProposalOut(CamelModel):
    id: str
    ticket_id: str
    context_version_id: Optional[str] = None
    proposed_external_action: Dict[str, Any]
    context_delta: Dict[str, Any]
    reasoning: str
    citations: Any
    policy_evaluation: Optional[Any] = None
    risk_level: str
    confidence: Optional[Decimal] = None
    action_status: str
    memory_status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    final_external_action: Optional[Any] = None
    final_context_update_md: Optional[str] = None
    rejection_reason: Optional[str] = None
    slack_message_ts: Optional[str] = None
    created_at: datetime
