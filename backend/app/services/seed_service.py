"""
Seed service: creates the exact demo dataset the frontend expects.

All IDs are stable strings matching lib/data.ts:
  Properties : p1, p2, p3
  Building   : b1, b2, b3
  Owner      : o1, o2
  Vendors    : v1, v2, v3, v4
  Units      : u-1a … u-7a, u-e1  (for p1)
  Tickets    : t-7831 … t-7843
  Call sess. : cs-7831, cs-7838
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
from app.models.property_policies import PropertyPolicy
from app.models.context_sources import ContextSource
from app.models.tickets import Ticket
from app.models.agent_proposals import AgentProposal
from app.models.call_sessions import CallSession
from app.models.vendor_jobs import VendorJob
from app.models.property_ticket_counters import PropertyTicketCounter
from app.services.context_service import create_context_chunks


# ---------------------------------------------------------------------------
# Context markdown — 4-layer heading format (enriched for agent decision-making)
# ---------------------------------------------------------------------------

GARTENSTR_CONTEXT = """\
---
version: 12
updated_at: 2026-04-26
updated_by: memory-agent
---

## Vendor layer
**Preferred vendors:**
- Heinz GmbH (HVAC, SLA 24h) — v1
  - Email: dispatch@heinz-hvac.de · Phone: +49 30 4411 8800
  - Preferred contact: Email dispatch request with unit, issue description, preferred time slot
  - On-call emergency: +49 30 4411 8801 (heating outages Oct–Mar)
- Bekey Service (Access/Intercom, SLA 48h) — v2
  - Email: service@bekey.de · Phone: +49 30 8877 3300
  - Preferred contact: Email with photo of faulty unit, serial number if available
  - Quote requests: quotes@bekey.de (include scope and floor plan reference)
- Schmidt Sanitär (Plumbing, SLA 48h) — v3
  - Email: info@schmidt-sanitaer.de · Phone: +49 30 2255 6600
  - Preferred contact: Phone for emergencies; email for non-urgent jobs
  - Emergency line (active leaks): +49 30 2255 6611

**Recent jobs:**
- 2025-11-08: Heinz GmbH — Unit 3B radiator valve replaced (€165, SLA met)
- 2024-06: Bekey Service — Intercom system upgraded to digital
- 2026-04-23: Bekey Service — Unit E1 intercom call module replaced (€90)

## Owner layer
**WEG Gartenstraße 42** (WEG) — contact: Herr Klein (Verwaltungsbeirat)
- Email: klein@weg-gartenstrasse.de · Phone: +49 30 9012 3456
- **Financial reporting preferences**: Monthly PDF cost summary by email (klein@weg-gartenstrasse.de), itemised per unit; invoices forwarded as PDF attachments with subject "Rechnung [job-type] [date]"
- **Communication channel**: Email preferred for all financial matters; phone only for urgent decisions
- Policies:
  - Repairs > €1,000 require WEG board sign-off (reply within 48h)
  - Any legal matter (Mietrecht, Abmahnung, Kündigung) must be escalated to human property manager immediately — do NOT respond autonomously
  - Costs above €2,500 require full WEG assembly vote — escalate to human
- Decisions:
  - 2026-03-12: Approved €4,200 façade painting
  - 2026-01-20: Approved elevator annual inspection

## Building layer
**Gartenstraße 42** — Altbau 1928, Denkmalschutz, 8 units
- HVAC: Vaillant gas central, replaced 2019
- Heating: Vaillant ecoTEC plus, last service 2025-09
- Elevator: None (4-storey walkup)
- Intercom: Bekey digital, installed 2024-06
- Boiler room: Keller (basement), accessible via janitor key (Schlüsselnummer B-3)
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

### Tenant FAQ & Property Rules
**Recycling / Mülltrennung:**
- Gelber Sack (Verpackungen): every 2 weeks, Tuesday morning — bin at rear courtyard
- Blaue Tonne (Papier): every 4 weeks, Wednesday — bin at rear courtyard
- Restmüll (grey bin): every 2 weeks, Tuesday morning
- Biomüll (brown bin): every 2 weeks, Tuesday morning
- Sperrmüll (bulky waste): call BSR Berlin (+49 30 7592 4900) or book at bsr.de — not included in building service
- Glass/Altglas: communal containers at Gartenstraße corner (50 m from building)

**Post & Pakete (Packages):**
- DHL Packstation: nearest at Friedrichstraße 60 (400 m) — ID: 182
- In-building: packages left in the entrance hall (Eingangsbereich) if they don't fit in the mailbox
- If lost/stolen: contact Buena office first; we'll check with DHL tracking. For confirmed theft, file a police report (Anzeige) and forward the Aktenzeichen to garten42@buena.io
- Package retrieval disputes between tenants: escalated to human property manager

**Besucherparken (Guest Parking):**
- No dedicated guest parking at Gartenstraße 42
- Street parking on Gartenstraße: mixed parking zone, 2-hour limit 9:00–20:00 Mon–Sat
- Nearest paid parking: Parkhaus Mitte, Friedrichstraße 90 (800 m), €2/hour
- Resident parking permits: apply at Bürgeramt Mitte — Buena can provide the Wohnortbestätigung letter on request

### Recent Decisions
- 2026-04-26: Accepted Heinz GmbH quote for Unit 3B radiator (€175, within threshold)
- 2026-03-12: Approved façade painting (board sign-off obtained)
- 2026-01-20: Elevator inspection passed

### Escalation Rules
- **ALWAYS escalate to human** if: legal dispute, formal Abmahnung, Kündigung, rent arrears overdue > 60 days, costs > €2,500, structural damage suspicion
- **Agent may resolve autonomously**: vendor dispatch ≤ €1,000, tenant FAQ answers, document forwarding, cost summary generation
- **Requires owner confirmation**: any single expense €1,000–€2,500
"""

BRUNNENSTR_CONTEXT = """\
---
version: 4
updated_at: 2026-04-26
updated_by: system
---

## Vendor layer
**Preferred vendors:**
- Heinz GmbH (HVAC, SLA 24h) — v1
  - Email: dispatch@heinz-hvac.de · Phone: +49 30 4411 8800
  - Preferred contact: Email with unit and issue description
- Berlin Elektro GmbH (Electrical, SLA 72h) — v4
  - Email: auftrag@berlin-elektro.de · Phone: +49 30 9900 1234
  - Preferred contact: Email with scope of work and access instructions
- Bekey Service (Access/Intercom, SLA 48h) — v2 (non-preferred, use for intercom only)
  - Email: service@bekey.de · Phone: +49 30 8877 3300
  - Quote requests: quotes@bekey.de

## Owner layer
**Klaus Weber** (private) — email: k.weber@example.com · phone: +49 170 9988 001
- **Financial reporting preferences**: Invoice PDF forwarded by email immediately after job completion; monthly summary on the 1st of each month in plain-text email format
- **Communication channel**: Email preferred; available by phone Mon–Fri 08:00–18:00
- Policies:
  - Any expense above €300 requires owner approval (email confirmation sufficient)
  - Legal disputes or formal tenant notices must be escalated to human property manager
  - Intercom or access system changes require owner sign-off before dispatch

## Building layer
**Brunnenstraße 18** — built 1972, 6 units
- Heating: Gas central, last service 2025-11
- Elevator: None
- Intercom: Analogue system, original installation (approx. 1990) — replacement discussed

## Property layer
**Address**: Brunnenstraße 18, 10119 Berlin
**Phone**: +49 30 5550 1118  ·  **Email**: brunnen18@buena.io
**Units**: 6  ·  **City**: Berlin

### Units & Tenants
- **1A** (55 m²): Herr Nowak — tenant, rent €720, since 2017
- **1B** (50 m²): Frau Gruber — tenant, rent €680, since 2020
- **2A** (60 m²): Familie Yilmaz — tenant, rent €780, since 2019
- **2B** (58 m²): Herr Petrov — tenant, rent €760, since 2021
- **3A** (65 m²): Dr. Braun — tenant, rent €840, since 2015
- **3B** (62 m²): Leer (vacant) — —

### Escalation Rules
- **ALWAYS escalate to human** if: legal dispute, formal Abmahnung, rent arrears > 60 days, costs > €300 not pre-approved, structural damage
- **Agent may resolve autonomously**: tenant FAQ, document forwarding, cost summary (within approved budget)
- **Requires owner confirmation (k.weber@example.com)**: any expense > €300
"""

LINIENSTR_CONTEXT = """\
---
version: 6
updated_at: 2026-04-26
updated_by: system
---

## Vendor layer
**Preferred vendors:**
- Schmidt Sanitär (Plumbing, SLA 48h) — v3
  - Email: info@schmidt-sanitaer.de · Phone: +49 30 2255 6600
  - Preferred contact: Email for standard jobs; phone for active leaks
  - Emergency line: +49 30 2255 6611
- Berlin Elektro GmbH (Electrical, SLA 72h) — v4
  - Email: auftrag@berlin-elektro.de · Phone: +49 30 9900 1234
  - Preferred contact: Email with scope of work

## Owner layer
**Ingrid Sommer** (private) — email: i.sommer@example.com · phone: +49 160 3344 5566
- **Financial reporting preferences**: Monthly cost summary PDF on the 1st of each month; invoices forwarded same day as received; preferred format: itemised per unit with total at bottom
- **Communication channel**: Email only (i.sommer@example.com); does not take phone calls for financial matters
- Policies:
  - Maintenance > €250 requires prior email approval from Ingrid Sommer
  - Legal or tenant dispute matters must be escalated to human property manager — no autonomous action
  - Rent arrears > 30 days: notify owner immediately; > 60 days: escalate to human for legal review

## Building layer
**Linienstraße 77** — built 1965, 5 units
- Heating: Oil central, last service 2025-08
- Elevator: None
- Parking: 3 spaces in rear courtyard (assigned to units 1A, 2A, 3A)

## Property layer
**Address**: Linienstraße 77, 10115 Berlin
**Phone**: +49 30 5550 1777  ·  **Email**: linie77@buena.io
**Units**: 5  ·  **City**: Berlin

### Units & Tenants
- **1A** (60 m²): Herr Kraft — tenant, rent €740, since 2018, parking space #1
- **2A** (65 m²): Familie Reiter — tenant, rent €800, since 2020, parking space #2
- **3A** (70 m²): Frau Vogel — tenant, rent €860, since 2016, parking space #3
- **4A** (55 m²): Herr Dimitriou — tenant, rent €680, since 2022 — rent arrears 2 months
- **5A** (58 m²): Leer (vacant) — —

### Tenant FAQ & Property Rules
**Besucherparken (Guest Parking):**
- Only 3 rear courtyard spaces exist, all assigned to tenants (1A, 2A, 3A)
- No visitor parking on property — guests must use street parking on Linienstraße
- Street parking: unrestricted (no time limit, no permit required) on east side of Linienstraße
- Overnight parking: permitted on street; no overnight use of the 3 tenant spaces by visitors
- Parking disputes between tenants: document with photo, contact Buena office at linie77@buena.io

### Escalation Rules
- **ALWAYS escalate to human** if: legal dispute, rent arrears > 60 days, costs > €250 not pre-approved, formal Kündigung or Abmahnung
- **Agent may resolve autonomously**: tenant FAQ, document forwarding, owner notification of rent arrears (first notice only)
- **Requires owner confirmation (i.sommer@example.com)**: any expense > €250
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
        BuildingVendor(building_id="b2", vendor_id="v2"),
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
    # Context versions (enriched)
    # ------------------------------------------------------------------
    cv1 = ContextVersion(
        property_id="p1",
        version=12,
        content_md=GARTENSTR_CONTEXT,
        frontmatter={"version": 12, "updated_at": "2026-04-26", "updated_by": "memory-agent"},
        created_by="memory-agent",
        created_reason="Enriched vendor contacts, tenant FAQ, owner financial prefs, escalation rules",
    )
    cv2 = ContextVersion(
        property_id="p2",
        version=4,
        content_md=BRUNNENSTR_CONTEXT,
        frontmatter={"version": 4, "updated_at": "2026-04-26", "updated_by": "system"},
        created_by="system",
        created_reason="Added vendor emails, owner financial prefs, escalation rules",
    )
    cv3 = ContextVersion(
        property_id="p3",
        version=6,
        content_md=LINIENSTR_CONTEXT,
        frontmatter={"version": 6, "updated_at": "2026-04-26", "updated_by": "system"},
        created_by="system",
        created_reason="Added vendor emails, parking FAQ, owner financial prefs, escalation rules",
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
            description="Legal, rent, billing, and high-cost decisions require human escalation",
            rule_json={
                "type": "escalation_trigger",
                "topics": ["legal", "rent", "billing", "abmahnung", "kuendigung"],
                "cost_threshold_eur": 2500,
            },
        ),
        PropertyPolicy(
            property_id="p1",
            kind="urgency",
            description="Heating outage Oct–Mar: respond within 2 hours",
            rule_json={"type": "urgency_override", "issue_type": "heating_outage", "sla_hours": 2},
        ),
    ]
    db.add_all(policies_p1)

    # Policies for p2
    policies_p2 = [
        PropertyPolicy(
            property_id="p2",
            kind="approval",
            description="Any expense > €300 requires Klaus Weber email approval",
            rule_json={"type": "expense_threshold", "threshold_eur": 300, "approver": "Klaus Weber"},
        ),
        PropertyPolicy(
            property_id="p2",
            kind="escalation",
            description="Legal matters and formal notices require human escalation",
            rule_json={"type": "escalation_trigger", "topics": ["legal", "abmahnung", "kuendigung"]},
        ),
    ]
    db.add_all(policies_p2)

    # Policies for p3
    policies_p3 = [
        PropertyPolicy(
            property_id="p3",
            kind="approval",
            description="Any expense > €250 requires Ingrid Sommer email approval",
            rule_json={"type": "expense_threshold", "threshold_eur": 250, "approver": "Ingrid Sommer"},
        ),
        PropertyPolicy(
            property_id="p3",
            kind="escalation",
            description="Legal matters, formal notices, and rent arrears > 60 days require human escalation",
            rule_json={
                "type": "escalation_trigger",
                "topics": ["legal", "abmahnung", "kuendigung", "rent_arrears"],
                "rent_arrears_days": 60,
            },
        ),
    ]
    db.add_all(policies_p3)

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
        PropertyTicketCounter(property_id="p1", prefix="GAR", last_num=126),
        PropertyTicketCounter(property_id="p2", prefix="BRU", last_num=12),
        PropertyTicketCounter(property_id="p3", prefix="LIN", last_num=7),
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
    # ORIGINAL Tickets  (stable IDs: t-7831, t-7832, t-7833)
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
        subject="Heizung kalt — Wohnung 3B",
        body=(
            "Die Heizung in meiner Wohnung ist seit gestern Abend kalt. "
            "Ich habe den Thermostat verstellt, aber das hilft nicht. "
            "Bitte schicken Sie so schnell wie möglich jemanden."
        ),
        excerpt="Heizung seit gestern Abend ausgefallen, Thermostat reagiert nicht.",
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
        subject="Gegensprechanlage defekt — Einheit E1",
        body="Unser Türklingel-Modul funktioniert nicht mehr. Besucher können uns nicht von der Straße aus anrufen.",
        excerpt="Gegensprechanlage defekt, Besucher können nicht klingeln.",
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
        subject="Lärmbeschwerde — Wohnung 3A",
        body="Anhaltend laute Musik aus Wohnung 3A an jedem Wochenendabend nach 22:00 Uhr.",
        excerpt="Laute Musik aus 3A an Wochenendabenden.",
        status="triaged",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 24, 19, 30, 0, tzinfo=timezone.utc),
    )
    db.add_all([t1, t2, t3])
    db.flush()

    # ------------------------------------------------------------------
    # NEW Tickets — Vendor Coordination (3 tickets)
    # ------------------------------------------------------------------

    # t-7834: Boiler failure requiring HVAC dispatch (p1, voice, new)
    t4 = Ticket(
        id="t-7834",
        property_id="p1",
        unit_id="u-4a",
        num="GAR-121",
        source="voice",
        raised_by="Dr. Faber",
        raised_by_phone="+49 172 6677 881",
        subject="Heizkessel ausgefallen — Wohnung 4A",
        body=(
            "Guten Morgen, hier spricht Dr. Faber aus Wohnung 4A. "
            "Seit heute Nacht um ca. 03:00 Uhr funktioniert die Heizung überhaupt nicht mehr. "
            "Es ist sehr kalt in der Wohnung, gefühlt unter 15 Grad. "
            "Ich habe gehört, dass es am Heizkessel im Keller liegen könnte. "
            "Bitte organisieren Sie dringend einen Techniker."
        ),
        excerpt="Heizkessel komplett ausgefallen seit Nacht, Wohnungstemperatur unter 15°C, dringender Techniker benötigt.",
        status="new",
        risk="high",
        confidence=None,
        created_at=datetime(2026, 4, 26, 6, 45, 0, tzinfo=timezone.utc),
    )

    # t-7835: Plumbing leak requiring emergency scheduling (p1, phone, new)
    t5 = Ticket(
        id="t-7835",
        property_id="p1",
        unit_id="u-3a",
        num="GAR-122",
        source="voice",
        raised_by="Frau Okonkwo",
        raised_by_phone="+49 160 9988 334",
        subject="Wasserrohrbruch unter der Spüle — Wohnung 3A",
        body=(
            "Hallo, Frau Okonkwo aus der 3A. Ich habe heute Morgen einen Wasserfleck "
            "unter meiner Küchenspüle entdeckt. Das Rohr tropft stark, ich habe bereits "
            "ein Handtuch untergelegt aber das reicht nicht. Bitte schicken Sie so schnell "
            "wie möglich einen Klempner. Ich bin den ganzen Tag zu Hause."
        ),
        excerpt="Aktives Wasserleck unter Küchenspüle in Wohnung 3A, starkes Tropfen, Klempner dringend benötigt.",
        status="new",
        risk="high",
        confidence=None,
        created_at=datetime(2026, 4, 26, 9, 12, 0, tzinfo=timezone.utc),
    )

    # t-7836: Intercom replacement quote request (p2, email, new)
    t6 = Ticket(
        id="t-7836",
        property_id="p2",
        unit_id=None,
        num="BRU-11",
        source="email",
        raised_by="Klaus Weber",
        raised_by_phone=None,
        subject="Angebot Austausch Gegensprechanlage — Brunnenstraße 18",
        body=(
            "Betreff: Kostenvoranschlag Gegensprechanlage\n\n"
            "Hallo,\n\n"
            "die Gegensprechanlage in der Brunnenstraße 18 ist nun ca. 35 Jahre alt und "
            "fällt regelmäßig aus. Ich möchte ein Angebot für den kompletten Austausch "
            "durch ein modernes System einholen. Bitte kontaktieren Sie Bekey Service und "
            "bitten Sie um einen Kostenvoranschlag für alle 6 Einheiten inkl. Einbau.\n\n"
            "Mit freundlichen Grüßen,\nKlaus Weber"
        ),
        excerpt="Eigentümer bittet um Kostenvoranschlag für Austausch der 35 Jahre alten Gegensprechanlage (alle 6 Einheiten).",
        status="new",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 25, 14, 30, 0, tzinfo=timezone.utc),
    )

    # ------------------------------------------------------------------
    # NEW Tickets — Tenant Inquiries (3 tickets, different channels)
    # ------------------------------------------------------------------

    # t-7837: Tenant asking about recycling rules (p1, email, new)
    t7 = Ticket(
        id="t-7837",
        property_id="p1",
        unit_id="u-2a",
        num="GAR-123",
        source="email",
        raised_by="Herr Mayer",
        raised_by_phone=None,
        subject="Frage zur Mülltrennung — Wohnung 2A",
        body=(
            "Betreff: Abfallentsorgung im Haus\n\n"
            "Guten Tag,\n\n"
            "ich bin seit 2019 Mieter in Wohnung 2A und habe eine Frage zur korrekten "
            "Mülltrennung. Wann wird der Gelbe Sack abgeholt? Und wohin mit altem "
            "Papier und Kartonagen? Gibt es hier eine Papiertonne im Haus, oder muss "
            "ich zur Sammelstelle? Außerdem: Wie entsorge ich größere Gegenstände "
            "(Sperrmüll) korrekt?\n\n"
            "Vielen Dank im Voraus,\nHerr Mayer, Wohnung 2A"
        ),
        excerpt="Mieter fragt nach Abfuhrplan für Gelben Sack, Papiertonne und Sperrmüllentsorgung.",
        status="new",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 25, 11, 20, 0, tzinfo=timezone.utc),
    )

    # t-7838: Tenant calling about lost package (p1, voice, new)
    t8 = Ticket(
        id="t-7838",
        property_id="p1",
        unit_id="u-1a",
        num="GAR-124",
        source="voice",
        raised_by="Frau Becker",
        raised_by_phone="+49 30 4433 2211",
        subject="Vermisstes Paket — Wohnung 1A",
        body=(
            "Guten Tag, hier ist Frau Becker aus Wohnung 1A. Ich erwarte seit drei Tagen "
            "ein Paket von DHL. Die App zeigt 'zugestellt im Eingangsbereich', aber ich "
            "finde es nirgends. Haben Sie eine Möglichkeit nachzusehen, oder wissen Sie, "
            "wie ich das klären kann? Ich mache mir ein bisschen Sorgen."
        ),
        excerpt="Mieterin vermisst DHL-Paket — lt. Tracking im Eingangsbereich zugestellt, aber nicht auffindbar.",
        status="new",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 26, 10, 5, 0, tzinfo=timezone.utc),
    )

    # t-7839: Tenant messaging about guest parking policy (p3, portal, new)
    t9 = Ticket(
        id="t-7839",
        property_id="p3",
        unit_id=None,
        num="LIN-6",
        source="portal",
        raised_by="Herr Dimitriou",
        raised_by_phone=None,
        subject="Frage zum Besucherparken — Linienstraße 77",
        body=(
            "Hallo,\n\n"
            "ich bin Mieter in Wohnung 4A, Linienstraße 77. Meine Familie besucht mich "
            "dieses Wochenende mit dem Auto. Gibt es Besucherparkplätze auf dem Grundstück, "
            "die ich kurzzeitig nutzen kann? Wenn nicht — wo können meine Gäste parken, "
            "ohne ein Knöllchen zu riskieren?\n\n"
            "Danke,\nK. Dimitriou"
        ),
        excerpt="Mieter fragt nach Besucherparkplätzen auf dem Grundstück und Alternativen für Gäste.",
        status="new",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 25, 16, 45, 0, tzinfo=timezone.utc),
    )

    # ------------------------------------------------------------------
    # NEW Tickets — Owner Financial Actions (2 tickets)
    # ------------------------------------------------------------------

    # t-7840: Monthly cost summary request from owner (p1, email, new)
    t10 = Ticket(
        id="t-7840",
        property_id="p1",
        unit_id=None,
        num="GAR-125",
        source="email",
        raised_by="Herr Klein (WEG Beirat)",
        raised_by_phone=None,
        subject="Monatliche Kostenübersicht April 2026 — Gartenstraße 42",
        body=(
            "Betreff: Monatliche Kostenübersicht\n\n"
            "Sehr geehrte Damen und Herren,\n\n"
            "könnten Sie mir bitte die monatliche Kostenübersicht für April 2026 "
            "zusammenstellen? Ich benötige eine Auflistung aller angefallenen Kosten "
            "nach Einheit sowie die Gesamtsumme. Bitte als PDF an "
            "klein@weg-gartenstrasse.de senden.\n\n"
            "Mit freundlichen Grüßen,\nHerr Klein, WEG Beirat"
        ),
        excerpt="WEG-Beirat bittet um monatliche Kostenübersicht April 2026 als PDF, aufgeschlüsselt nach Einheiten.",
        status="new",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 26, 8, 0, 0, tzinfo=timezone.utc),
    )

    # t-7841: Invoice forwarding after completed job (p2, email, triaged)
    t11 = Ticket(
        id="t-7841",
        property_id="p2",
        unit_id=None,
        num="BRU-12",
        source="email",
        raised_by="Heinz GmbH",
        raised_by_phone=None,
        subject="Rechnung Heizungswartung Februar 2026 — Brunnenstraße 18",
        body=(
            "Betreff: Rechnung Nr. HG-2026-0234\n\n"
            "Sehr geehrte Damen und Herren,\n\n"
            "anbei übersenden wir Ihnen die Rechnung für die Heizungswartung vom "
            "12. Februar 2026 in der Brunnenstraße 18.\n\n"
            "Betrag: €285,00 inkl. MwSt.\n"
            "Fälligkeit: 30 Tage nach Rechnungsdatum\n\n"
            "Bitte leiten Sie diese Rechnung an den Eigentümer Klaus Weber weiter.\n\n"
            "Mit freundlichen Grüßen,\nHeinz GmbH"
        ),
        excerpt="Rechnung von Heinz GmbH über €285 für Heizungswartung — an Eigentümer Klaus Weber weiterzuleiten.",
        status="triaged",
        risk="low",
        confidence=None,
        created_at=datetime(2026, 4, 24, 9, 0, 0, tzinfo=timezone.utc),
    )

    # ------------------------------------------------------------------
    # NEW Ticket — Human Escalation Trigger (legal concern)
    # ------------------------------------------------------------------

    # t-7842: Rent arrears — owner notification (p3, portal, triaged)
    t12 = Ticket(
        id="t-7842",
        property_id="p3",
        unit_id=None,
        num="LIN-7",
        source="portal",
        raised_by="System (automatisch)",
        raised_by_phone=None,
        subject="Mietrückstand 2 Monate — Wohnung 4A, Linienstraße 77",
        body=(
            "Automatische Benachrichtigung: Mieter Herr Dimitriou (Wohnung 4A, "
            "Linienstraße 77) ist mit der Miete für März und April 2026 im Rückstand. "
            "Ausstehender Betrag: €1.360 (2 × €680). "
            "Letzte Zahlung: Februar 2026. "
            "Bitte informieren Sie die Eigentümerin Ingrid Sommer und klären Sie das "
            "weitere Vorgehen."
        ),
        excerpt="Mietrückstand 2 Monate (€1.360) — Herr Dimitriou, Wohnung 4A. Eigentümerin zu benachrichtigen.",
        status="triaged",
        risk="medium",
        confidence=None,
        created_at=datetime(2026, 4, 26, 7, 0, 0, tzinfo=timezone.utc),
    )

    # t-7843: Legal concern — formal Abmahnung dispute (p1, letter, triaged) — ESCALATION TRIGGER
    t13 = Ticket(
        id="t-7843",
        property_id="p1",
        unit_id="u-2b",
        num="GAR-126",
        source="letter",
        raised_by="Rechtsanwalt Dr. Müller (i.A. Familie Torres)",
        raised_by_phone=None,
        subject="Anwaltliches Schreiben: Abmahnung wegen Mängeln — Wohnung 2B",
        body=(
            "Einschreiben mit Rückschein\n\n"
            "Betreff: Abmahnung gemäß § 536a BGB — Mängelbeseitigung Wohnung 2B\n\n"
            "Sehr geehrte Damen und Herren,\n\n"
            "ich vertrete Familie Torres, Mieter der Wohnung 2B, Gartenstraße 42. "
            "Meine Mandanten zeigen an, dass trotz mehrfacher Mängelanzeige (zuletzt "
            "schriftlich am 15. März 2026) die Feuchtigkeitsschäden im Badezimmer und "
            "die defekte Fensterdichtung im Schlafzimmer bis heute nicht beseitigt wurden. "
            "Ich fordere Sie hiermit auf, die Mängel bis zum 10. Mai 2026 zu beseitigen, "
            "andernfalls behalten meine Mandanten sich eine Mietminderung sowie "
            "Schadensersatzansprüche nach § 536a BGB ausdrücklich vor.\n\n"
            "Mit freundlichen Grüßen,\nRA Dr. Müller"
        ),
        excerpt="Anwaltliche Abmahnung: Feuchtigkeitsschäden + defekte Fensterdichtung Whg. 2B nicht beseitigt — Mietminderung angedroht. ESKALATION ERFORDERLICH.",
        status="triaged",
        risk="high",
        confidence=None,
        created_at=datetime(2026, 4, 25, 0, 0, 0, tzinfo=timezone.utc),
    )

    db.add_all([t4, t5, t6, t7, t8, t9, t10, t11, t12, t13])
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
            "Heinz GmbH is preferred vendor for HVAC with 24h SLA (dispatch@heinz-hvac.de). "
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

    # Call session for t-7838 (lost package call)
    cs2 = CallSession(
        id="cs-7838",
        ticket_id="t-7838",
        duration="0:58",
        caller_phone="+49 30 4433 2211",
        summary=(
            "Frau Becker called to report a missing DHL package. Tracking shows it was "
            "delivered to the entrance area but she cannot find it. Agent noted the case "
            "and explained the package handling procedure."
        ),
        noise_reduction_db=12,
        transcript=[
            {"spk": "agent", "t": "0:00",
             "text": "Buena Hausverwaltung, guten Tag.",
             "en": "Buena property management, good afternoon."},
            {"spk": "tenant", "t": "0:03",
             "text": "Guten Tag, hier ist Becker aus der 1A. Mein DHL-Paket fehlt.",
             "en": "Good afternoon, this is Becker from 1A. My DHL package is missing."},
            {"spk": "agent", "t": "0:08",
             "text": "Das tut mir leid. Laut der DHL-App — wo wurde es zugestellt?",
             "en": "I'm sorry to hear that. According to the DHL app — where was it delivered?"},
            {"spk": "tenant", "t": "0:13",
             "text": "Im Eingangsbereich, steht da. Aber ich finde es nicht.",
             "en": "In the entrance area, it says. But I can't find it."},
            {"spk": "agent", "t": "0:19",
             "text": "Ich lege das als Ticket an und prüfe die Situation. Pakete werden normalerweise neben den Briefkästen abgestellt.",
             "en": "I'll log this as a ticket and investigate. Packages are usually left next to the mailboxes."},
        ],
    )
    db.add(cs2)

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
        "tickets": [
            "t-7831 (GAR-118 proposed)",
            "t-7832 (GAR-119 completed)",
            "t-7833 (GAR-120 triaged)",
            "t-7834 (GAR-121 new — boiler failure, vendor dispatch)",
            "t-7835 (GAR-122 new — plumbing leak, vendor dispatch)",
            "t-7836 (BRU-11 new — intercom quote, vendor coordination)",
            "t-7837 (GAR-123 new — recycling inquiry, tenant FAQ)",
            "t-7838 (GAR-124 new — lost package, tenant inquiry)",
            "t-7839 (LIN-6 new — guest parking, tenant FAQ)",
            "t-7840 (GAR-125 new — monthly cost summary, owner financial)",
            "t-7841 (BRU-12 triaged — invoice forwarding, owner financial)",
            "t-7842 (LIN-7 triaged — rent arrears, owner financial)",
            "t-7843 (GAR-126 triaged — legal Abmahnung, ESCALATION REQUIRED)",
        ],
    }
