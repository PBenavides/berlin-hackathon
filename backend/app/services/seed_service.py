"""
Seed service: creates 2 properties with full context, policies, sources.
Idempotent — checks for existing data before inserting.
"""
from sqlalchemy.orm import Session

from app.models.properties import Property
from app.models.context_versions import ContextVersion
from app.models.context_chunks import ContextChunk
from app.models.property_policies import PropertyPolicy
from app.models.context_sources import ContextSource
from app.services.context_service import create_context_chunks


GARTENSTR_CONTEXT = """\
---
version: 1
updated_at: 2026-04-01
updated_by: system
---

## Basics
**Address**: Gartenstraße 42, 10115 Berlin
**Type**: Residential apartment building
**Units**: 6 (ground floor to 3rd floor)
**Year built**: 1958
**Last renovation**: 2019 (roof and facade)
**Property manager**: Maria Hofmann
**Owner**: Klaus Weber

## Units & Tenants
- **Unit 1A** (Ground floor, 65m²): Frau Müller — tenant since 2015, long-term reliable payer
- **Unit 1B** (Ground floor, 58m²): Herr Bauer — tenant since 2021, occasional late payments
- **Unit 2A** (1st floor, 72m²): Familie Schmidt — 4 persons, tenant since 2018
- **Unit 2B** (1st floor, 60m²): Frau Neumann — tenant since 2020, no known issues
- **Unit 3A** (3rd floor, 70m²): Herr König — tenant since 2022
- **Unit 3B** (3rd floor, 68m²): Herr Meier — tenant since 2023, bathroom leak issue in 2026

## Known Issues
- **Bathroom leak Unit 3B**: First reported 2026-03-10. Contractor (Klempnerei Fischer) visited 2026-04-10, reported fixed. Tenant Herr Meier confirmed resolution on 2026-04-12.
- **Elevator**: Serviced annually; last service 2026-01-15. Next scheduled 2027-01-15.
- **Common area lighting**: Replaced stairwell bulbs with LED 2026-02-20. No open issues.

## Owner Preferences
- Owner prefers written communication for decisions > €500
- No same-day repair commitments without prior confirmation from contractor
- Tenant disputes to be handled empathetically; escalate to owner if unresolved after 2 exchanges
- Maintain professional tone in all tenant correspondence
- Owner is available by email weekdays 9–17h: k.weber@example.com

## Policies
- Do not promise repair timelines unless contractor appointment is confirmed
- Any expense above €300 requires owner approval (Klaus Weber, k.weber@example.com)
- Legal, rent, or billing questions must be escalated to human review
- Heating outage during winter months (Oct–Mar) is high urgency — respond within 2 hours
- Use formal but empathetic tone (Sie-form) in all tenant communications
- Water damage or flooding is critical priority — contact owner and contractor immediately

## Source Documents
- Lease agreements: docs/gartenstr42/leases/ (last audited 2025-12)
- Building insurance policy: InsurancePolicy_Gartenstr42_2025.pdf
- Contractor list: docs/contractors.md
- Energy performance certificate: EPC_Gartenstr42_2022.pdf

## Recent Decisions
- 2026-04-12: Bathroom leak in 3B marked resolved after contractor visit confirmed by tenant
- 2026-03-28: Approved exterior painting quote (€2,800) after owner approval
- 2026-02-15: Renewed building insurance with Allianz (unchanged terms)
- 2026-01-20: Elevator annual inspection passed without issues
"""

LINDENALLEE_CONTEXT = """\
---
version: 1
updated_at: 2026-04-01
updated_by: system
---

## Basics
**Address**: Lindenallee 18, 20255 Hamburg
**Type**: Mixed-use building (residential + 1 commercial ground floor)
**Units**: 5 residential + 1 commercial (ground floor)
**Year built**: 1972
**Last renovation**: 2021 (windows and insulation)
**Property manager**: Thomas Brandt
**Owner**: Ingrid Sommer

## Units & Tenants
- **Unit 1A** (Ground floor commercial): Café Lindeneck — commercial lease, long-term tenant since 2018
- **Unit 1B** (1st floor, 55m²): Herr Wagner — tenant since 2019, asked about rent increase legality
- **Unit 2A** (2nd floor, 62m²): Frau Hoffmann — tenant since 2021, good standing
- **Unit 2B** (2nd floor, 58m²): Frau Koch — tenant since 2020, noise complaint filed 2026-04
- **Unit 3A** (3rd floor, 65m²): Familie Richter — tenant since 2022, 3 persons
- **Unit 3B** (3rd floor, 60m²): Herr Lange — new tenant since 2025, subject of noise complaint

## Known Issues
- **Noise complaint (Unit 2B vs 3B)**: Frau Koch (2B) filed complaint 2026-04-20 against Herr Lange (3B) for nightly noise after 22:00. First written warning issued to Herr Lange on 2026-04-21.
- **Commercial lease renewal**: Café Lindeneck lease expires 2026-12-31. Owner Ingrid Sommer to decide by 2026-09.
- **Flat roof inspection**: Last inspection 2025-10. Next due 2026-10.

## Owner Preferences
- Owner Ingrid Sommer prefers monthly summary emails
- Commercial lease decisions require direct owner consultation
- All rent increases must be reviewed by legal counsel before sending
- Respond to tenants within 2 business days for non-urgent matters

## Policies
- Rent increase notices require legal review before sending to tenants
- Noise complaints: issue written warning after first report, escalate to owner after second
- Commercial lease decisions are owner-only — do not negotiate without explicit authorization
- Maintenance expenses above €250 require prior owner approval
- All written communications to use formal German (Sie-form)

## Source Documents
- Lease agreements: docs/lindenallee18/leases/ (last audited 2026-01)
- Commercial lease: CommercialLease_Cafelindeneck_2018.pdf
- Flat roof inspection report: RoofInspection_Lindenallee18_2025.pdf

## Recent Decisions
- 2026-04-21: First written warning issued to Herr Lange (3B) regarding noise
- 2026-03-15: Approved window seal repair quote (€180) — below threshold, authorized directly
- 2026-01-10: Annual lease audit completed — no irregularities found
"""


GARTENSTR_POLICIES = [
    {
        "kind": "approval",
        "description": "Any expense above €300 requires owner approval from Klaus Weber",
        "rule_json": {
            "type": "expense_threshold",
            "threshold_eur": 300,
            "approver": "Klaus Weber",
            "approver_email": "k.weber@example.com",
            "action": "require_approval_before_commit",
        },
    },
    {
        "kind": "communication",
        "description": "Do not promise repair timelines unless contractor appointment is confirmed",
        "rule_json": {
            "type": "commitment_guard",
            "topic": "repair_timelines",
            "condition": "contractor_appointment_confirmed",
            "action": "block_commitment",
        },
    },
    {
        "kind": "escalation",
        "description": "Legal, rent, or billing questions must be escalated to human review",
        "rule_json": {
            "type": "escalation_trigger",
            "topics": ["legal", "rent", "billing", "eviction"],
            "action": "escalate_to_human",
        },
    },
    {
        "kind": "urgency",
        "description": "Heating outage during Oct–Mar is high urgency — respond within 2 hours",
        "rule_json": {
            "type": "urgency_override",
            "issue_type": "heating_outage",
            "months": [10, 11, 12, 1, 2, 3],
            "sla_hours": 2,
            "action": "set_priority_critical",
        },
    },
    {
        "kind": "tone",
        "description": "Use formal but empathetic tone (Sie-form) in all tenant communications",
        "rule_json": {
            "type": "tone_requirement",
            "formality": "formal",
            "language": "de",
            "pronoun": "Sie",
            "tone": "empathetic",
        },
    },
    {
        "kind": "escalation",
        "description": "Water damage or flooding is critical priority — contact owner and contractor immediately",
        "rule_json": {
            "type": "urgency_override",
            "issue_type": "water_damage",
            "sla_hours": 1,
            "notify": ["owner", "contractor"],
            "action": "set_priority_critical",
        },
    },
]

LINDENALLEE_POLICIES = [
    {
        "kind": "escalation",
        "description": "Rent increase notices require legal review before sending to tenants",
        "rule_json": {
            "type": "legal_review_required",
            "topic": "rent_increase",
            "action": "block_until_reviewed",
        },
    },
    {
        "kind": "escalation",
        "description": "Noise complaints: written warning after first report, escalate after second",
        "rule_json": {
            "type": "progressive_escalation",
            "issue_type": "noise_complaint",
            "steps": [
                {"step": 1, "action": "written_warning"},
                {"step": 2, "action": "escalate_to_owner"},
            ],
        },
    },
    {
        "kind": "approval",
        "description": "Commercial lease decisions require direct owner consultation",
        "rule_json": {
            "type": "owner_only",
            "topic": "commercial_lease",
            "action": "require_owner_authorization",
        },
    },
    {
        "kind": "approval",
        "description": "Maintenance expenses above €250 require prior owner approval",
        "rule_json": {
            "type": "expense_threshold",
            "threshold_eur": 250,
            "approver": "Ingrid Sommer",
            "action": "require_approval_before_commit",
        },
    },
    {
        "kind": "communication",
        "description": "All written communications to use formal German (Sie-form)",
        "rule_json": {
            "type": "tone_requirement",
            "formality": "formal",
            "language": "de",
            "pronoun": "Sie",
        },
    },
]

GARTENSTR_SOURCES = [
    {
        "kind": "document",
        "uri": "docs/gartenstr42/leases/",
        "status": "allowed",
        "approved_by": "Maria Hofmann",
    },
    {
        "kind": "document",
        "uri": "InsurancePolicy_Gartenstr42_2025.pdf",
        "status": "allowed",
        "approved_by": "Maria Hofmann",
    },
    {
        "kind": "document",
        "uri": "docs/contractors.md",
        "status": "allowed",
        "approved_by": "Maria Hofmann",
    },
    {
        "kind": "document",
        "uri": "EPC_Gartenstr42_2022.pdf",
        "status": "allowed",
        "approved_by": "Maria Hofmann",
    },
]

LINDENALLEE_SOURCES = [
    {
        "kind": "document",
        "uri": "docs/lindenallee18/leases/",
        "status": "allowed",
        "approved_by": "Thomas Brandt",
    },
    {
        "kind": "document",
        "uri": "CommercialLease_Cafelindeneck_2018.pdf",
        "status": "allowed",
        "approved_by": "Thomas Brandt",
    },
    {
        "kind": "document",
        "uri": "RoofInspection_Lindenallee18_2025.pdf",
        "status": "allowed",
        "approved_by": "Thomas Brandt",
    },
]


def seed_database(db: Session) -> dict:
    """
    Seed the database with 2 properties and associated data.
    Returns a summary of what was created.
    """
    existing = db.query(Property).count()
    if existing > 0:
        return {"message": "Database already seeded", "seeded": False}

    # --- Property 1: Gartenstraße 42, Berlin ---
    prop1 = Property(
        name="Gartenstraße 42, Berlin",
        slack_channel="#gartenstr42-berlin",
    )
    db.add(prop1)
    db.flush()

    # Context version 1
    cv1 = ContextVersion(
        property_id=prop1.id,
        version=1,
        content_md=GARTENSTR_CONTEXT,
        frontmatter={
            "version": 1,
            "updated_at": "2026-04-01",
            "updated_by": "system",
        },
        created_by="system",
        created_reason="Initial seed",
    )
    db.add(cv1)
    db.flush()

    create_context_chunks(db, cv1.id, prop1.id, GARTENSTR_CONTEXT)

    # Policies
    for p in GARTENSTR_POLICIES:
        policy = PropertyPolicy(property_id=prop1.id, **p)
        db.add(policy)

    # Sources
    for s in GARTENSTR_SOURCES:
        source = ContextSource(property_id=prop1.id, **s)
        db.add(source)

    # --- Property 2: Lindenallee 18, Hamburg ---
    prop2 = Property(
        name="Lindenallee 18, Hamburg",
        slack_channel="#lindenallee18-hamburg",
    )
    db.add(prop2)
    db.flush()

    cv2 = ContextVersion(
        property_id=prop2.id,
        version=1,
        content_md=LINDENALLEE_CONTEXT,
        frontmatter={
            "version": 1,
            "updated_at": "2026-04-01",
            "updated_by": "system",
        },
        created_by="system",
        created_reason="Initial seed",
    )
    db.add(cv2)
    db.flush()

    create_context_chunks(db, cv2.id, prop2.id, LINDENALLEE_CONTEXT)

    # Policies
    for p in LINDENALLEE_POLICIES:
        policy = PropertyPolicy(property_id=prop2.id, **p)
        db.add(policy)

    # Sources
    for s in LINDENALLEE_SOURCES:
        source = ContextSource(property_id=prop2.id, **s)
        db.add(source)

    db.commit()

    return {
        "message": "Database seeded successfully",
        "seeded": True,
        "properties": [prop1.name, prop2.name],
    }
