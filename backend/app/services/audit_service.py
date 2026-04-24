from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def create_audit_entry(
    db: Session,
    actor: str,
    action: str,
    entity_type: str,
    property_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    entry = AuditLog(
        actor=actor,
        action=action,
        property_id=property_id,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
    )
    db.add(entry)
    db.flush()
    return entry
