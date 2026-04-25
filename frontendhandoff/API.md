# Buena Context Engine — Frontend API Contract

The frontend currently runs against static data in `apps/web/lib/data.ts`.
This document defines the REST API the backend must implement for the frontend to go live.

All endpoints are prefixed `/api`. JSON only. Auth: bearer token (omitted for hackathon).

---

## Data types

```ts
type TicketStatus = "new" | "triaged" | "proposed" | "approved" | "awaiting_vendor" | "scheduled" | "in_progress" | "completed" | "resolved" | "rejected";
type Risk = "low" | "medium" | "high";
type Source = "voice" | "email" | "slack" | "manual" | "api";
type Layer = "vendor" | "owner" | "building" | "property";
```

---

## Properties

### `GET /api/properties`
Returns all properties the operator has access to.

**Response**
```json
[
  {
    "id": "p1",
    "name": "Gartenstraße 42",
    "buildingId": "b1",
    "ownerId": "o1",
    "city": "Berlin",
    "units": 8,
    "openTickets": 3,
    "contextVersion": 11,
    "phone": "+49 30 5550 1042",
    "email": "garten42@buena.io"
  }
]
```

### `GET /api/properties/:id`
Single property detail.

---

## Units

### `GET /api/properties/:propertyId/units`
All units for a property.

**Response**
```json
[
  {
    "id": "u-1a",
    "propertyId": "p1",
    "label": "1A",
    "type": "residential",        // "residential" | "commercial"
    "areaQm": 62,
    "meaPermille": 78,
    "ownerName": "Frau Becker",
    "ownerSince": 2014,
    "tenant": "Frau Becker (self)",
    "rentEur": null,              // null = self-occupied / not rented
    "beirat": false               // WEG board member
  }
]
```

---

## Tickets

### `GET /api/tickets`
All tickets. Supports query params:
- `?propertyId=p1` — filter by property
- `?status=proposed` — filter by status
- `?risk=high` — filter by risk

**Response** — array of `Ticket` objects (see shape below).

### `GET /api/tickets/:id`
Full ticket detail including proposal, call session, vendor job, memory proposal.

**Ticket shape**
```json
{
  "id": "t-7831",
  "num": "GAR-118",
  "propertyId": "p1",
  "unitId": "u-3b",
  "source": "voice",
  "status": "proposed",
  "risk": "medium",
  "subject": "Heating cold — Unit 3B",
  "excerpt": "Short summary for list views",
  "raisedBy": "Herr Schmidt",
  "raisedByPhone": "+49 170 2233 445",
  "createdAt": "2026-04-25T08:14:00Z",
  "confidence": 0.86,

  "proposal": {
    "id": "pr-7831",
    "confidence": 0.86,
    "contextVersion": 11,
    "proposedAction": {
      "type": "dispatch_vendor",
      "vendor": "Heinz GmbH",
      "vendorId": "v1",
      "trade": "HVAC",
      "target": "Unit 3B radiator (living room)",
      "estimateEur": 175,
      "etaHours": 24
    },
    "reasoning": "...",
    "citations": [
      { "heading": "Unit 3B history", "excerpt": "Valve replaced 2025-11-08 by Heinz GmbH (€165)." }
    ],
    "policiesEvaluated": [
      { "code": "P1", "name": "approval_threshold (€175 ≤ €200)", "passed": true }
    ]
  },

  "callSession": {
    "duration": "1:27",
    "callerPhone": "+49 170 2233 445",
    "summary": "...",
    "noiseReductionDb": 18,
    "transcript": [
      { "spk": "agent", "t": "0:00", "text": "Buena Hausverwaltung...", "en": "Buena property management..." }
    ]
  },

  "emailBody": "Hello,\n\nThe kitchen sink...",

  "vendorJob": {
    "vendorId": "v2",
    "sentAt": "2026-04-22T14:32:00Z",
    "accepted": true,
    "scheduledFor": "2026-04-23T10:00:00Z",
    "completedAt": "2026-04-23T11:05:00Z",
    "finalCostEur": 90,
    "notes": "Replaced intercom call module."
  },

  "memoryProposal": {
    "text": "Unit 6B intercom call module replaced 2026-04-23 by Bekey Service (€90).",
    "targetVersion": 12,
    "status": "pending"           // "pending" | "saved" | "skipped"
  }
}
```

### `POST /api/tickets/:id/approve`
Operator approves the Hermes proposal. Triggers vendor dispatch SMS + tenant email.

**Request body** — empty or `{}`

**Response**
```json
{ "status": "approved", "vendorJob": { ... } }
```

### `POST /api/tickets/:id/reject`
Operator rejects the proposal.

**Request body**
```json
{ "reason": "optional free text" }
```

### `POST /api/tickets/:id/memory/save`
Operator approves the memory write. Bumps `contextVersion` by 1.

**Response**
```json
{ "status": "saved", "contextVersion": 12 }
```

### `POST /api/tickets/:id/memory/skip`
Operator skips the memory write.

---

## Vendors

### `GET /api/vendors`
All vendors. Optional `?buildingId=b1` filter.

**Response**
```json
[
  {
    "id": "v1",
    "name": "Heinz GmbH",
    "trade": "HVAC",
    "contact": "Herr Heinz",
    "phone": "+49 30 4411 8800",
    "email": "dispatch@heinz-hvac.de",
    "rating": 4.7,
    "preferred": true,
    "buildings": ["b1", "b2"],
    "slaHours": 24
  }
]
```

### `GET /api/vendors/:id`
Vendor detail including job history.

**Response** — vendor object plus:
```json
{
  "cases": [
    {
      "id": "vc1",
      "propertyId": "p1",
      "date": "2025-11-04",
      "description": "Heating cold — valve replacement Unit 3B",
      "costEur": 165,
      "slaMet": true,
      "rating": 5
    }
  ]
}
```

---

## Owners

### `GET /api/owners`
All owners.

**Response**
```json
[
  {
    "id": "o1",
    "name": "WEG Gartenstraße 42",
    "type": "weg",
    "contact": "Herr Klein (Verwaltungsbeirat)",
    "email": "klein@weg-gartenstrasse.de",
    "phone": "+49 30 9012 3456",
    "language": "de",
    "buildingsCount": 1,
    "unitsCount": 8,
    "monthlyRevenueEur": 7460,
    "policies": ["Repairs > €1,000 require board sign-off"],
    "decisions": [
      { "date": "2026-03-12", "text": "Approved €4,200 façade painting" }
    ],
    "notes": "..."
  }
]
```

### `GET /api/owners/:id`
Owner detail.

---

## Buildings

### `GET /api/buildings`
All buildings.

**Response**
```json
[
  {
    "id": "b1",
    "name": "Gartenstraße 42",
    "ownerId": "o1",
    "address": "Gartenstraße 42, 10115 Berlin",
    "city": "Berlin",
    "yearBuilt": 1928,
    "units": 8,
    "systems": {
      "hvac": "Vaillant gas central, replaced 2019",
      "heating": "Vaillant ecoTEC plus, last service 2025-09",
      "elevator": "None (4-storey walkup)",
      "intercom": "Bekey digital, installed 2024-06"
    },
    "vendors": ["v1", "v2", "v3"],
    "notes": "Pre-war Altbau, listed building (Denkmalschutz)."
  }
]
```

### `GET /api/buildings/:id`
Building detail.

---

## Context (context.md)

### `GET /api/properties/:id/context`
Current rendered context.md as structured JSON.

**Response**
```json
{
  "propertyId": "p1",
  "version": 11,
  "updatedAt": "2026-04-20T11:00:00Z",
  "layers": {
    "vendor": { "raw": "markdown string for this layer" },
    "owner": { "raw": "..." },
    "building": { "raw": "..." },
    "property": { "raw": "..." }
  }
}
```

### `GET /api/properties/:id/context/versions`
Version history.

**Response**
```json
[
  { "version": 11, "createdAt": "2026-04-20T11:00:00Z", "author": "memory-agent", "summary": "Unit 6B intercom added" },
  { "version": 10, "createdAt": "2026-03-12T09:30:00Z", "author": "operator", "summary": "Façade decision added" }
]
```

### `GET /api/properties/:id/context/versions/:version`
Specific version content (same shape as current context endpoint).

---

## Chat / Hermes

### `POST /api/chat`
Send a message to Hermes. Returns a **Server-Sent Events (SSE)** stream.

**Request body**
```json
{
  "message": "What's the status of the heating ticket in 3B?",
  "propertyId": "p1",
  "scope": { "layer": "property", "id": "p1" }
}
```

**SSE events**
```
event: delta
data: {"text": "The heating"}

event: delta
data: {"text": " ticket GAR-118..."}

event: done
data: {"messageId": "msg-xyz", "appliedTo": []}
```

---

## PDF Extract

### `POST /api/extract`
Upload a PDF document for extraction into structured context.

**Request** — `multipart/form-data`
- `file`: PDF binary
- `propertyId`: target property (optional, helps routing)
- `layer`: `"vendor" | "owner" | "building" | "property"` (optional hint)

**Response**
```json
{
  "extractionId": "ext-abc123",
  "status": "processing",
  "pollUrl": "/api/extract/ext-abc123"
}
```

### `GET /api/extract/:extractionId`
Poll extraction status.

**Response**
```json
{
  "extractionId": "ext-abc123",
  "status": "done",
  "proposedDiffs": [
    {
      "layer": "building",
      "heading": "Systems",
      "before": "Vaillant gas central, replaced 2019",
      "after": "Vaillant gas central, replaced 2019 — annual service scheduled 2026-09",
      "rationale": "Service schedule extracted from PDF invoice",
      "confidence": 0.89
    }
  ]
}
```

---

## Escalations

### `GET /api/escalations`
All open escalations (tickets with `risk=high` or SLA violations).

**Response** — array of Ticket objects filtered/sorted by urgency.

---

## Pipeline stages (static)

The pipeline stages are static config — no API needed. The frontend hardcodes:

| id | label | description |
|----|-------|-------------|
| `new` | New | Inbound landed — agent hasn't looked yet |
| `triaged` | Triaged | Classified — proposal being drafted |
| `proposed` | Awaiting approval | Operator decision required |
| `awaiting_vendor` | Vendor coord. | SMS sent, waiting on vendor |
| `scheduled` | Scheduled | Vendor confirmed, work pending |
| `completed` | Completed | Vendor reports done — memory decision pending |

---

## Error shape

All errors return:
```json
{
  "error": "human-readable message",
  "code": "MACHINE_CODE",
  "status": 400
}
```

Common codes: `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT`
