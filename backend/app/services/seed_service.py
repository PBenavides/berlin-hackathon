"""
Seed service: creates the exact demo dataset the frontend expects.

All IDs are stable strings matching lib/data.ts:
  Properties : p1, p2, p3
  Building   : b1, b2, b3
  Owner      : o1, o2
  Vendors    : v1, v2, v3, v4
  Units      : u-1a … u-7a, u-e1  (for p1)
  Tickets    : t-7831, t-7832, t-7833
  Call sess. : cs-7831
  Vendor job : vj-7832
  Vendor case: vc1, vc2, vc3

Idempotent — if data already exists the function returns early.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.owners import Owner
from app.models.buildings import Building
from app.models.building_vendors import BuildingVendor
from app.models.vendors import Vendor
from app.models.vendor_cases import VendorCase
from app.models.properties import Property
from app.models.units import Unit
from app.models.context_versions import ContextVersion
from app.models.context_chunks import ContextChunk
from app.models.property_policies import PropertyPolicy
from app.models.context_sources import ContextSource
from app.models.tickets import Ticket
from app.models.agent_proposals import AgentProposal
from app.models.call_sessions import CallSession
from app.models.vendor_jobs import VendorJob
from app.models.property_ticket_counters import PropertyTicketCounter
from app.services.context_service import create_context_chunks


# ---------------------------------------------------------------------------
# Context markdown — 4-layer heading format
# ---------------------------------------------------------------------------

GARTENSTR_CONTEXT = """\
---
version: 11
updated_at: 2026-04-20
updated_by: memory-agent
---

## Vendor layer
**Preferred vendors:**
- Heinz GmbH (HVAC, SLA 24h) — v1
- Bekey Service (Access/Intercom, SLA 48h) — v2
- Schmidt Sanitär (Plumbing, SLA 48h) — v3

**Recent jobs:**
- 2025-11-08: Heinz GmbH — Unit 3B radiator valve replaced (€165, SLA met)
- 2024-06: Bekey Service — Intercom system upgraded to digital

## Owner layer
**WEG Gartenstraße 42** (WEG) — contact: Herr Klein (Verwaltungsbeirat)
- Email: klein@weg-gartenstrasse.de · Phone: +49 30 9012 3456
- Policies: Repairs > €1,000 require board sign-off
- Decisions:
  - 2026-03-12: Approved €4,200 façade painting
  - 2026-01-20: Approved elevator annual inspection

## Building layer
**Gartenstraße 42** — Altbau 1928, Denkmalschutz, 8 units
- HVAC: Vaillant gas central, replaced 2019
- Heating: Vaillant ecoTEC plus, last service 2025-09
- Elevator: None (4-storey walkup)
- Intercom: Bekey digital, installed 2024-06
- Notes: Pre-war Altbau, listed building (Denkmalschutz). All external changes require heritage authority approval.

## Property layer
**Address**: Gartenstraße 42, 10115 Berlin
**Phone**: +49 30 5550 1042  ·  **Email**: garten42@buena.io
**Units**: 8  ·  **City**: Berlin

### Units & Tenants
- **1A** (65 m²): Frau Becker — self-occupied, Beirat member, since 2014
- **2A** (62 m²): Herr Mayer — tenant, rent €820, since 2019
- **2B** (58 m²): Familie Torres — tenant, rent €760, since 2021
- **3A** (70 m²): Frau Okonkwo — tenant, rent €910, since 2020
- **3B** (68 m²): Herr Schmidt — tenant, rent €880, since 2022 — heating complaint 2026-04
- **4A** (72 m²): Dr. Faber — tenant, rent €940, since 2018
- **5A** (75 m²): Leer (vacant) — —
- **E1** (commercial, 120 m²): Café Krone — commercial, rent €1,850, since 2016

### Recent Decisions
- 2026-04-20: Accepted Heinz GmbH quote for Unit 3B radiator (€175, within threshold)
- 2026-03-12: Approved façade painting (board sign-off obtained)
- 2026-01-20: Elevator inspection passed
"""

BRUNNENSTR_CONTEXT = """\
---
version: 3
updated_at: 2026-04-10
updated_by: system
---

## Vendor layer
**Preferred vendors:**
- Heinz GmbH (HVAC, SLA 24h) — v1
- Berlin Elektro GmbH (Electrical, SLA 72h) — v4

## Owner layer
**Klaus Weber** (private) — email: k.weber@example.com
- Policies: Any expense above €300 requires owner approval

## Building layer
**Brunnenstraße 18** — built 1972, 6 units
- Heating: Gas central, last service 2025-11
- Elevator: None

## Property layer
**Address**: Brunnenstraße 18, 10119 Berlin
**Phone**: +49 30 5550 1118  ·  **Email**: brunnen18@buena.io
**Units**: 6  ·  **City**: Berlin
"""

LINIENSTR_CONTEXT = """\
---
version: 5
updated_at: 2026-04-15
updated_by: system
---

## Vendor layer
**Preferred vendors:**
- Schmidt Sanitär (Plumbing, SLA 48h) — v3
- Berlin Elektro GmbH (Electrical, SLA 72h) — v4

## Owner layer
**Ingrid Sommer** (private) — monthly summaries preferred
- Policies: Maintenance > €250 requires prior approval

## Building layer
**Linienstraße 77** — built 1965, 5 units
- Heating: Oil central, last service 2025-08
- Elevator: None

## Property layer
**Address**: Linienstraße 77, 10115 Berlin
**Phone**: +49 30 5550 1777  ·  **Email**: linie77@buena.io
**Units**: 5  ·  **City**: Berlin
"""


def seed_database(db: Session) -> dict:
    """
    Seed the database with the full demo dataset.
    Idempotent — checks for existing data before inserting.
    Returns a summary of what was created.
    """
    existing = db.query(Property).filter(Property.id == "p1").first()
    if existing:
        return {"message": "Database already seeded", "seeded": False}

    # ------------------------------------------------------------------
    # Owners
    # ------------------------------------------------------------------
    o1 = Owner(
        id="o1",
        name="WEG Gartenstraße 42",
        type="weg",
        contact="Herr Klein (Verwaltungsbeirat)",
        email="klein@weg-gartenstrasse.de",
        phone="+49 30 9012 3456",
        language="de",
        buildings_count=1,
        units_count=8,
        monthly_revenue_eur=7460,
        policies=["Repairs > €1,000 require board sign-off"],
        decisions=[
            {"date": "2026-03-12", "text": "Approved €4,200 façade painting"},
            {"date": "2026-01-20", "text": "Approved elevator annual inspection"},
        ],
        notes="WEG with 8 unit-owners. Beirat very active.",
    )
    o2 = Owner(
        id="o2",
        name="Klaus Weber",
        type="private",
        contact="Klaus Weber",
        email="k.weber@example.com",
        phone="+49 170 9988 001",
        language="de",
        buildings_count=1,
        units_count=6,
        monthly_revenue_eur=3200,
        policies=["Any expense above €300 requires owner approval"],
        decisions=[],
        notes="Private landlord, responsive by email.",
    )
    db.add_all([o1, o2])
    db.flush()

    # ------------------------------------------------------------------
    # Buildings
    # ------------------------------------------------------------------
    b1 = Building(
        id="b1",
        name="Gartenstraße 42",
        owner_id="o1",
        address="Gartenstraße 42, 10115 Berlin",
        city="Berlin",
        year_built=1928,
        units_count=8,
        systems={
            "hvac": "Vaillant gas central, replaced 2019",
            "heating": "Vaillant ecoTEC plus, last service 2025-09",
            "elevator": "None (4-storey walkup)",
            "intercom": "Bekey digital, installed 2024-06",
        },
        notes="Pre-war Altbau, listed building (Denkmalschutz).",
    )
    b2 = Building(
        id="b2",
        name="Brunnenstraße 18",
        owner_id="o2",
        address="Brunnenstraße 18, 10119 Berlin",
        city="Berlin",
        year_built=1972,
        units_count=6,
        systems={
            "heating": "Gas central, last service 2025-11",
            "elevator": "None",
        },
        notes="Post-war residential building.",
    )
    b3 = Building(
        id="b3",
        name="Linienstraße 77",
        owner_id="o2",
        address="Linienstraße 77, 10115 Berlin",
        city="Berlin",
        year_built=1965,
        units_count=5,
        systems={
            "heating": "Oil central, last service 2025-08",
            "elevator": "None",
        },
        notes="Mixed residential, 5 units.",
    )
    db.add_all([b1, b2, b3])
    db.flush()

    # ------------------------------------------------------------------
    # Vendors
    # ------------------------------------------------------------------
    v1 = Vendor(
        id="v1",
        name="Heinz GmbH",
        trade="HVAC",
        contact="Herr Heinz",
        phone="+49 30 4411 8800",
        email="dispatch@heinz-hvac.de",
        rating=4.7,
        preferred=True,
        sla_hours=24,
    )
    v2 = Vendor(
        id="v2",
        name="Bekey Service",
        trade="Access & Intercom",
        contact="Bekey Dispatch",
        phone="+49 30 8877 3300",
        email="service@bekey.de",
        rating=4.3,
        preferred=True,
        sla_hours=48,
    )
    v3 = Vendor(
        id="v3",
        name="Schmidt Sanitär",
        trade="Plumbing",
        contact="Herr Schmidt",
        phone="+49 30 2255 6600",
        email="info@schmidt-sanitaer.de",
        rating=4.5,
        preferred=False,
        sla_hours=48,
    )
    v4 = Vendor(
        id="v4",
        name="Berlin Elektro GmbH",
        trade="Electrical",
        contact="Frau Lange",
        phone="+49 30 9900 1234",
        email="auftrag@berlin-elektro.de",
        rating=4.1,
        preferred=False,
        sla_hours=72,
    )
    db.add_all([v1, v2, v3, v4])
    db.flush()

    # Building-vendor assignments
    db.add_all([
        BuildingVendor(building_id="b1", vendor_id="v1"),
        BuildingVendor(building_id="b1", vendor_id="v2"),
        BuildingVendor(building_id="b1", vendor_id="v3"),
        BuildingVendor(building_id="b2", vendor_id="v1"),
        BuildingVendor(building_id="b2", vendor_id="v4"),
        BuildingVendor(building_id="b3", vendor_id="v3"),
        BuildingVendor(building_id="b3", vendor_id="v4"),
    ])

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    p1 = Property(
        id="p1",
        name="Gartenstraße 42",
        building_id="b1",
        owner_id="o1",
        city="Berlin",
        phone="+49 30 5550 1042",
        email="garten42@buena.io",
        slack_channel="#gartenstr42-berlin",
    )
    p2 = Property(
        id="p2",
        name="Brunnenstraße 18",
        building_id="b2",
        owner_id="o2",
        city="Berlin",
        phone="+49 30 5550 1118",
        email="brunnen18@buena.io",
        slack_channel="#brunnenstr18-berlin",
    )
    p3 = Property(
        id="p3",
        name="Linienstraße 77",
        building_id="b3",
        owner_id="o2",
        city="Berlin",
        phone="+49 30 5550 1777",
        email="linie77@buena.io",
        slack_channel="#linienstr77-berlin",
    )
    db.add_all([p1, p2, p3])
    db.flush()

    # ------------------------------------------------------------------
    # Context versions
    # ------------------------------------------------------------------
    cv1 = ContextVersion(
        property_id="p1",
        version=11,
        content_md=GARTENSTR_CONTEXT,
        frontmatter={"version": 11, "updated_at": "2026-04-20", "updated_by": "memory-agent"},
        created_by="memory-agent",
        created_reason="Unit 6B intercom added",
    )
    cv2 = ContextVersion(
        property_id="p2",
        version=3,
        content_md=BRUNNENSTR_CONTEXT,
        frontmatter={"version": 3, "updated_at": "2026-04-10", "updated_by": "system"},
        created_by="system",
        created_reason="Initial seed",
    )
    cv3 = ContextVersion(
        property_id="p3",
        version=5,
        content_md=LINIENSTR_CONTEXT,
        frontmatter={"version": 5, "updated_at": "2026-04-15", "updated_by": "system"},
        created_by="system",
        created_reason="Initial seed",
    )
    db.add_all([cv1, cv2, cv3])
    db.flush()

    create_context_chunks(db, cv1.id, "p1", GARTENSTR_CONTEXT)
    create_context_chunks(db, cv2.id, "p2", BRUNNENSTR_CONTEXT)
    create_context_chunks(db, cv3.id, "p3", LINIENSTR_CONTEXT)

    # ------------------------------------------------------------------
    # Policies for p1
    # ------------------------------------------------------------------
    policies_p1 = [
        PropertyPolicy(
            property_id="p1",
            kind="approval",
            description="Repairs > €1,000 require WEG board sign-off",
            rule_json={"type": "expense_threshold", "threshold_eur": 1000, "approver": "WEG board"},
        ),
        PropertyPolicy(
            property_id="p1",
            kind="escalation",
            description="Legal, rent, or billing questions escalated to human review",
            rule_json={"type": "escalation_trigger", "topics": ["legal", "rent", "billing"]},
        ),
        PropertyPolicy(
            property_id="p1",
            kind="urgency",
            description="Heating outage Oct–Mar: respond within 2 hours",
            rule_json={"type": "urgency_override", "issue_type": "heating_outage", "sla_hours": 2},
        ),
    ]
    db.add_all(policies_p1)

    # ------------------------------------------------------------------
    # Units for p1 (1A-7A + E1, matching lib/data.ts)
    # ------------------------------------------------------------------
    units_p1 = [
        Unit(id="u-1a", property_id="p1", label="1A", type="residential",
             area_qm=65, mea_permille=81, owner_name="Frau Becker",
             owner_since=2014, tenant="Frau Becker (self)", rent_eur=None, beirat=True),
        Unit(id="u-2a", property_id="p1", label="2A", type="residential",
             area_qm=62, mea_permille=78, owner_name="Herr Krause",
             owner_since=2016, tenant="Herr Mayer", rent_eur=820, beirat=False),
        Unit(id="u-2b", property_id="p1", label="2B", type="residential",
             area_qm=58, mea_permille=73, owner_name="Frau Lindner",
             owner_since=2018, tenant="Familie Torres", rent_eur=760, beirat=False),
        Unit(id="u-3a", property_id="p1", label="3A", type="residential",
             area_qm=70, mea_permille=88, owner_name="Dr. Faber",
             owner_since=2013, tenant="Frau Okonkwo", rent_eur=910, beirat=False),
        Unit(id="u-3b", property_id="p1", label="3B", type="residential",
             area_qm=68, mea_permille=85, owner_name="Frau Becker",
             owner_since=2014, tenant="Herr Schmidt", rent_eur=880, beirat=False),
        Unit(id="u-4a", property_id="p1", label="4A", type="residential",
             area_qm=72, mea_permille=90, owner_name="Herr Krause",
             owner_since=2016, tenant="Dr. Faber", rent_eur=940, beirat=False),
        Unit(id="u-5a", property_id="p1", label="5A", type="residential",
             area_qm=75, mea_permille=94, owner_name="WEG Gartenstraße 42",
             owner_since=2022, tenant=None, rent_eur=None, beirat=False),
        Unit(id="u-e1", property_id="p1", label="E1", type="commercial",
             area_qm=120, mea_permille=150, owner_name="WEG Gartenstraße 42",
             owner_since=2010, tenant="Café Krone", rent_eur=1850, beirat=False),
    ]
    db.add_all(units_p1)
    db.flush()

    # ------------------------------------------------------------------
    # Ticket counters
    # ------------------------------------------------------------------
    db.add_all([
        PropertyTicketCounter(property_id="p1", prefix="GAR", last_num=120),
        PropertyTicketCounter(property_id="p2", prefix="BRU", last_num=10),
        PropertyTicketCounter(property_id="p3", prefix="LIN", last_num=5),
    ])
    db.flush()

    # ------------------------------------------------------------------
    # Vendor cases
    # ------------------------------------------------------------------
    vc1 = VendorCase(
        id="vc1",
        vendor_id="v1",
        property_id="p1",
        date="2025-11-04",
        description="Heating cold — valve replacement Unit 3B",
        cost_eur=165,
        sla_met=True,
        rating=5,
    )
    vc2 = VendorCase(
        id="vc2",
        vendor_id="v2",
        property_id="p1",
        date="2024-06-15",
        description="Intercom upgrade to Bekey digital system",
        cost_eur=890,
        sla_met=True,
        rating=4,
    )
    vc3 = VendorCase(
        id="vc3",
        vendor_id="v2",
        property_id="p1",
        date="2026-04-23",
        description="Intercom call module Unit 6B replaced",
        cost_eur=90,
        sla_met=True,
        rating=5,
    )
    db.add_all([vc1, vc2, vc3])

    # ------------------------------------------------------------------
    # Tickets  (stable IDs: t-7831, t-7832, t-7833)
    # ------------------------------------------------------------------
    # t-7831: heating cold (proposed) — the primary demo scenario
    t1 = Ticket(
        id="t-7831",
        property_id="p1",
        unit_id="u-3b",
        num="GAR-118",
        source="voice",
        raised_by="Herr Schmidt",
        raised_by_phone="+49 170 2233 445",
        subject="Heating cold — Unit 3B",
        body=(
            "The heating in my unit has been cold since yesterday evening. "
            "I tried adjusting the thermostat but it does not help. "
            "Please send someone as soon as possible."
        ),
        excerpt="Heating not working since yesterday evening, thermostat unresponsive.",
        status="proposed",
        risk="medium",
        confidence=0.86,
        created_at=datetime(2026, 4, 25, 8, 14, 0, tzinfo=timezone.utc),
    )

    # t-7832: intercom broken (completed, vendor job done)
    t2 = Ticket(
        id="t-7832",
        property_id="p1",
        unit_id="u-e1",
        num="GAR-119",
        source="email",
        raised_by="Café Krone",
        raised_by_phone=None,
        subject="Intercom not working — Unit E1",
        body="Our intercom call module has stopped working. Visitors cannot call us from the street.",
        excerpt="Intercom call module broken, visitors cannot ring.",
        status="completed",
        risk="low",
        confidence=0.91,
        created_at=datetime(2026, 4, 22, 10, 0, 0, tzinfo=timezone.utc),
    )

    # t-7833: noise complaint (triaged)
    t3 = Ticket(
        id="t-7833",
        property_id="p1",
        unit_id="u-2b",
        num="GAR-120",
        source="manual",
        raised_by="Familie Torres",
        raised_by_phone="+49 160 5544 112",
        subject="Noise complaint — Unit 3A",
        body="Persistent loud music from Unit 3A every weekend evening after 22:00.",
        excerpt="Loud music from 3A on weekend evenings.",
        status="triaged",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 24, 19, 30, 0, tzinfo=timezone.utc),
    )
    db.add_all([t1, t2, t3])
    db.flush()

    # ------------------------------------------------------------------
    # Agent proposal for t-7831 (pr-7831)
    # ------------------------------------------------------------------
    pr1 = AgentProposal(
        id="pr-7831",
        ticket_id="t-7831",
        context_version_id=cv1.id,
        proposed_external_action={
            "type": "dispatch_vendor",
            "vendor": "Heinz GmbH",
            "vendorId": "v1",
            "trade": "HVAC",
            "target": "Unit 3B radiator (living room)",
            "estimateEur": 175,
            "etaHours": 24,
        },
        context_delta={
            "suggested_context_update": (
                "Unit 3B radiator replaced 2026-04-26 by Heinz GmbH (€175). "
                "Previous valve replacement 2025-11-08 (€165) — recurring issue."
            )
        },
        reasoning=(
            "Tenant Herr Schmidt reports heating failure in Unit 3B. "
            "Context shows previous radiator valve replacement by Heinz GmbH on 2025-11-08 for €165. "
            "Heinz GmbH is preferred vendor for HVAC with 24h SLA. "
            "Estimate of €175 is below the €1,000 board approval threshold. "
            "Policy P1 (approval_threshold €1,000) passed. Dispatching Heinz GmbH is recommended."
        ),
        citations=[
            {
                "heading": "Unit 3B history",
                "excerpt": "Valve replaced 2025-11-08 by Heinz GmbH (€165).",
            },
            {
                "heading": "Owner layer",
                "excerpt": "Repairs > €1,000 require board sign-off.",
            },
        ],
        policy_evaluation=[
            {"code": "P1", "name": "approval_threshold (€175 ≤ €1,000)", "passed": True},
            {"code": "P3", "name": "urgency_heating_oct_mar (SLA 2h)", "passed": True},
        ],
        risk_level="medium",
        confidence=0.86,
        action_status="pending",
        memory_status="pending",
    )
    db.add(pr1)

    # ------------------------------------------------------------------
    # Call session for t-7831
    # ------------------------------------------------------------------
    cs1 = CallSession(
        id="cs-7831",
        ticket_id="t-7831",
        duration="1:27",
        caller_phone="+49 170 2233 445",
        summary=(
            "Herr Schmidt called to report that the heating in Unit 3B has not been working "
            "since yesterday evening. He tried adjusting the thermostat without success. "
            "Agent confirmed the issue and informed him a technician will be dispatched."
        ),
        noise_reduction_db=18,
        transcript=[
            {"spk": "agent", "t": "0:00",
             "text": "Buena Hausverwaltung, guten Morgen, wie kann ich Ihnen helfen?",
             "en": "Buena property management, good morning, how can I help you?"},
            {"spk": "tenant", "t": "0:05",
             "text": "Guten Morgen, hier ist Schmidt aus der 3B. Unsere Heizung funktioniert seit gestern Abend nicht mehr.",
             "en": "Good morning, this is Schmidt from 3B. Our heating hasn't worked since yesterday evening."},
            {"spk": "agent", "t": "0:15",
             "text": "Das tut mir leid zu hören, Herr Schmidt. Haben Sie den Thermostat schon überprüft?",
             "en": "I'm sorry to hear that, Mr Schmidt. Have you already checked the thermostat?"},
            {"spk": "tenant", "t": "0:22",
             "text": "Ja, habe ich. Keine Änderung. Es ist wirklich kalt hier.",
             "en": "Yes, I have. No change. It's really cold here."},
            {"spk": "agent", "t": "0:28",
             "text": "Ich verstehe. Ich werde sofort einen Techniker von Heinz GmbH beauftragen. Sie werden sich innerhalb von 24 Stunden bei Ihnen melden.",
             "en": "I understand. I'll immediately arrange for a technician from Heinz GmbH. They will contact you within 24 hours."},
        ],
    )
    db.add(cs1)

    # ------------------------------------------------------------------
    # Vendor job for t-7832 (completed)
    # ------------------------------------------------------------------
    vj1 = VendorJob(
        id="vj-7832",
        ticket_id="t-7832",
        vendor_id="v2",
        sent_at=datetime(2026, 4, 22, 14, 32, 0, tzinfo=timezone.utc),
        accepted=True,
        scheduled_for=datetime(2026, 4, 23, 10, 0, 0, tzinfo=timezone.utc),
        completed_at=datetime(2026, 4, 23, 11, 5, 0, tzinfo=timezone.utc),
        final_cost_eur=90,
        notes="Replaced intercom call module. Unit E1 intercom fully operational.",
    )
    db.add(vj1)

    db.commit()

    return {
        "message": "Database seeded successfully",
        "seeded": True,
        "properties": ["p1 (Gartenstraße 42)", "p2 (Brunnenstraße 18)", "p3 (Linienstraße 77)"],
        "owners": ["o1 (WEG Gartenstraße 42)", "o2 (Klaus Weber)"],
        "buildings": ["b1", "b2", "b3"],
        "vendors": ["v1 (Heinz GmbH)", "v2 (Bekey Service)", "v3 (Schmidt Sanitär)", "v4 (Berlin Elektro GmbH)"],
        "units": 8,
        "tickets": ["t-7831 (GAR-118 proposed)", "t-7832 (GAR-119 completed)", "t-7833 (GAR-120 triaged)"],
    }
