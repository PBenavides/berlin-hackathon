from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.properties import Property
from app.models.property_policies import PropertyPolicy
from app.schemas.policies import PolicyOut, PolicyCreate, PolicyUpdate
from app.services.audit_service import create_audit_entry

router = APIRouter()


def _get_property_or_404(db: Session, property_id: str) -> Property:
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _get_policy_or_404(db: Session, policy_id: str) -> PropertyPolicy:
    policy = db.query(PropertyPolicy).filter(PropertyPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.get("/properties/{property_id}/policies", response_model=List[PolicyOut])
def list_policies(property_id: str, db: Session = Depends(get_db)):
    """List all active policies for a property."""
    _get_property_or_404(db, property_id)
    return (
        db.query(PropertyPolicy)
        .filter(
            PropertyPolicy.property_id == property_id,
            PropertyPolicy.active == True,  # noqa: E712
        )
        .order_by(PropertyPolicy.created_at)
        .all()
    )


@router.post("/properties/{property_id}/policies", response_model=PolicyOut, status_code=201)
def create_policy(
    property_id: str,
    payload: PolicyCreate,
    db: Session = Depends(get_db),
):
    """Create a new policy for a property."""
    _get_property_or_404(db, property_id)

    policy = PropertyPolicy(property_id=property_id, **payload.model_dump())
    db.add(policy)
    db.flush()

    create_audit_entry(
        db,
        actor="api",
        action="policy.create",
        entity_type="property_policy",
        property_id=property_id,
        entity_id=policy.id,
        metadata={"kind": policy.kind, "description": policy.description},
    )
    db.commit()
    db.refresh(policy)
    return policy


@router.patch("/policies/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: str,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
):
    """Update a policy."""
    policy = _get_policy_or_404(db, policy_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)

    create_audit_entry(
        db,
        actor="api",
        action="policy.update",
        entity_type="property_policy",
        property_id=policy.property_id,
        entity_id=policy.id,
        metadata={"updated_fields": list(update_data.keys())},
    )
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db),
):
    """Deactivate (soft-delete) a policy."""
    policy = _get_policy_or_404(db, policy_id)
    policy.active = False

    create_audit_entry(
        db,
        actor="api",
        action="policy.delete",
        entity_type="property_policy",
        property_id=policy.property_id,
        entity_id=policy.id,
        metadata={"kind": policy.kind},
    )
    db.commit()
