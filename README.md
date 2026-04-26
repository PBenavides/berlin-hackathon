# Buena ContextOps

> **Every resolved ticket makes the next AI response smarter.**

Buena ContextOps turns scattered property knowledge — ERPs, emails, Slack, PDFs, phone calls — into a living, versioned, human-curated `context.md` per property that any AI agent can trust.

Most AI tools try to answer the current ticket faster. **ContextOps improves the next one.**

---

## The Problem

Property managers at Buena operate with fragmented knowledge spread across 5+ tools. When a tenant ticket arrives, response quality depends on whether the human *happens to remember* the right context. AI agents can't safely act without reliable, up-to-date property knowledge, and context goes stale after every ticket unless someone manually updates it.

## Our Solution

A **ContextOps layer** where:

1. Incoming tickets are interpreted against a property's **living memory**
2. AI proposes a safe operational action **and** a context update
3. Humans approve, edit, or reject **each independently**
4. Approved decisions create a new version of `context.md`
5. Future agents use better context than before

**Core loop:**

```
Ticket in → Context loaded → AI proposal → Human decision → Context delta → Updated property memory
```

This creates a **compounding advantage**: every resolved ticket improves the next response.

---

## The Context Layer Architecture

Each property has exactly **one** `context.md` — a versioned, immutable, diffable document structured into **four semantic layers**:

```
┌─────────────────────────────────────────────┐
│              context.md (v12)               │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │  ## Vendor layer                │        │
│  │  Preferred contractors, SLAs,   │        │
│  │  contact details, job history   │        │
│  └─────────────────────────────────┘        │
│  ┌─────────────────────────────────┐        │
│  │  ## Owner layer                 │        │
│  │  Owner identity, financial      │        │
│  │  reporting prefs, approval      │        │
│  │  thresholds, communication      │        │
│  │  channel preferences            │        │
│  └─────────────────────────────────┘        │
│  ┌─────────────────────────────────┐        │
│  │  ## Building layer              │        │
│  │  Physical systems (HVAC,        │        │
│  │  elevator, intercom), year      │        │
│  │  built, maintenance history     │        │
│  └─────────────────────────────────┘        │
│  ┌─────────────────────────────────┐        │
│  │  ## Property layer              │        │
│  │  Units & tenants, FAQ &         │        │
│  │  property rules, recent         │        │
│  │  decisions, escalation rules    │        │
│  └─────────────────────────────────┘        │
│                                             │
│  YAML frontmatter: version, updated_at,     │
│  updated_by, source_proposal_id             │
└─────────────────────────────────────────────┘
```

### Why Four Layers?

| Layer | What it stores | Who cares |
|---|---|---|
| **Vendor** | Preferred contractors, SLAs, contact methods, emergency lines, recent job history | Agent dispatching repairs |
| **Owner** | Financial reporting preferences (format, frequency, channel), approval thresholds, escalation policies | Agent sending reports or requesting approval |
| **Building** | Physical systems, construction year, maintenance schedules, access notes | Agent assessing repair scope and urgency |
| **Property** | Units & tenants, property rules (recycling, parking, packages), recent decisions, escalation rules | Agent answering tenant FAQs and triaging tickets |

### How Each Layer Gets Used

When a ticket arrives, the system loads the relevant layers to make grounded decisions:

- **Maintenance ticket** → Vendor layer (who to call, contact method, SLA) + Building layer (what system is affected) + Owner layer (expense threshold)
- **Tenant FAQ** → Property layer (rules, tenants, parking) + Building layer (systems info)
- **Financial request** → Owner layer (reporting format, channel) + Property layer (unit rents)
- **Escalation check** → Owner layer (approval policies) + Property layer (escalation rules)

### Versioning Rules

- Every write creates a **new immutable row** — no in-place edits
- Version numbers are **monotonic integers** per property (v1 → v2 → v3...)
- Every version records `created_by`, `created_reason`, and `source_proposal_id`
- Every AI proposal stores the **exact context version** it read
- The `context_layer_service` parses the markdown into layers; the `context_service` chunks it by heading for citation

---

## The Context Delta

The standout feature. Every incoming ticket generates a **Context Delta** — a structured explanation of how the ticket changes or challenges the property's existing memory:

| Field | What it answers |
|---|---|
| **Learned facts** | What new information did this ticket reveal? |
| **Conflicts** | Does this contradict existing context? (e.g., "resolved" issue recurs) |
| **Missing info** | What gaps were flagged for follow-up? |
| **Risk label** | AI-assessed severity of the situation |
| **Suggested memory update** | Proposed edit to `context.md` |

The operator reviews the Context Delta **separately** from the external action — approving "what we respond" is independent from "what we remember."

---

## Features

### AI Proposal Engine (Dual-Mode)

Two interchangeable backends behind a stable interface:

- **StubProposalEngine** — deterministic, template-matched proposals (fast, demo-safe)
- **AIProposalEngine** — LLM-backed via Gemini on OpenRouter (realistic, production-shaped)

Each proposal generates **two outputs**: an external action (tenant email, contractor dispatch, escalation) and a Context Delta. Proposals are pinned to an exact context version with visible citations.

### Hermes — Agentic AI Assistant

A full **agent runtime** with function-calling loop (Gemini 2.5 Flash):

- **9 read tools**: list tickets, get ticket details, property context (parsed by layer), vendors, units, owners, escalations
- **8 write tools**: approve, reject, save/skip memory, propose context edits, send vendor email, respond to tenant, send owner report, escalate to human

Write tools **never mutate state** — they produce a proposal envelope that the operator confirms via the UI. SSE streaming pushes real-time tool-call visibility to the frontend.

### Policy Evaluation Engine

Deterministic, keyword-driven policy matching (no LLM required). 8 policy types: urgency overrides, expense thresholds, commitment guards, legal review, progressive escalation, tone requirements, owner-only decisions.

Policies are **visible, not hidden prompts** — operators see exactly which rules shaped the recommendation.

### Owner Concierge

Multimodal dispatcher (text + images) that lets property owners message directly. The agent loads the property's context layers and policies to provide grounded responses, suggest ticket creation, and cite relevant context sections.

### Document Extraction

PDF upload → proposed context diffs per layer. The extraction engine proposes changes to specific layers (e.g., "vendor layer: annual service confirmed") that the operator reviews before merging.

### Full Audit Trail

Every meaningful action is logged: `context.read`, `context.write`, `proposal.create`, `proposal.action.approve`, `proposal.memory.approve`, `policy.update`, `ticket.create`, `slack.notification.*`. Immutable entries with actor, action, entity references, and metadata.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI + SQLAlchemy (Python) |
| Database | PostgreSQL 16 (24 models, Alembic migrations) |
| Frontend | Next.js 15 App Router + Tailwind + shadcn/ui |
| AI | Gemini 2.5 Flash (OpenRouter) — proposal engine + agent runtime + concierge |
| Real-time | SSE streaming for agent tool-call visibility |
| Infra | Docker Compose |

---

## UI Pages

| Page | What it shows |
|---|---|
| **Overview** | Property dashboard with ticket inbox and context summary |
| **Property** | Context viewer with version history, diffs, and section anchors |
| **Ticket** | Full proposal card: citations, Context Delta, policy evaluation, dual approval |
| **Buildings** | Building-level view with linked properties and vendors |
| **Owners** | Owner management with preferences and communication history |
| **Vendors** | Vendor profiles with SLA tracking and case history |
| **Chat** | Live Hermes agent with SSE streaming, tool-call visibility, action proposals |
| **Escalations** | High-risk ticket queue for operator attention |
| **Extract** | Document upload with automated context diff proposals |

---

## Quick Start

### With Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/docs

### Local Development

**Backend:**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Copy .env.example to .env and set DATABASE_URL + OPENROUTER_API_KEY
python run.py
```

**Frontend** (pnpm monorepo — `apps/web` is the Next.js app, `packages/ui` holds shared primitives):

```bash
cd frontend
pnpm install
pnpm dev   # runs on port 3000
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features | optional (falls back to stub) |
| `SLACK_WEBHOOK_URL` | Slack webhook for proposal notifications | optional |
| `APP_BASE_URL` | Base URL for links in notifications | `http://localhost:3000` |

---

## Project Structure

```
berlinhackbuena/
├── backend/
│   ├── app/
│   │   ├── api/routes/               # 20 FastAPI route modules
│   │   ├── models/                   # 24 SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   └── services/
│   │       ├── ticket_pipeline.py    # Core ticket → proposal orchestration
│   │       ├── proposal_engine.py    # Dual-mode AI proposal generation
│   │       ├── policy_evaluator.py   # Deterministic policy matching
│   │       ├── context_service.py    # Context versioning & chunking
│   │       ├── context_layer_service.py  # 4-layer parser
│   │       ├── agent_runtime.py      # Hermes agent loop with tool calling
│   │       ├── agent_tools.py        # 17 tools (9 read + 8 write)
│   │       ├── concierge_dispatcher.py   # Multimodal owner chat
│   │       ├── extract_engine.py     # PDF → context diff proposals
│   │       ├── memory_engine.py      # Post-job memory update builder
│   │       ├── audit_service.py      # Immutable audit trail
│   │       ├── slack_service.py      # Slack notifications
│   │       └── seed_service.py       # Demo data (3 properties, 13 tickets)
│   └── alembic/                      # DB migrations
├── frontend/
│   ├── apps/web/                     # Next.js 15 app (port 3000)
│   │   ├── app/                      # 12 route modules
│   │   ├── components/               # sidebar, action-card, activity-feed,
│   │   │                             # agent-summary-panel, demo-control-bar
│   │   └── lib/                      # API client, types, utils
│   └── packages/ui/                  # @repo/ui — shadcn primitives
├── data/                             # Seed data (stammdaten, bank, jobs)
└── docs/                             # PRD, Hermes plan, integration docs
```

---

## API Highlights

Swagger docs at http://localhost:8000/api/docs once running.

| Endpoint | Purpose |
|---|---|
| `POST /api/tickets` | Create ticket and trigger proposal pipeline |
| `GET /api/properties/{id}/context` | Get latest context version (parsed by layer) |
| `GET /api/properties/{id}/context/versions` | Version history |
| `GET /api/properties/{id}/context/diff` | Unified diff between versions |
| `POST /api/tickets/{id}/approve` | Approve ticket and dispatch |
| `POST /api/tickets/{id}/memory/save` | Approve memory update → bumps context version |
| `GET /api/chat/stream` | SSE stream for Hermes agent |
| `POST /api/extract` | Upload document for context extraction |
| `GET /api/audit` | Full audit trail |

---

## Demo Flow (5 Minutes)

1. **Simulate a ticket** → "Heizung kalt — Wohnung 3B" arrives in the inbox
2. **Agent triages** → Hermes reads context layers, finds the preferred HVAC vendor (Heinz GmbH), checks SLA (24h), loads owner approval threshold (€1,000)
3. **Proposals grounded in context** → Proposal card shows `context v12`, cited sections from all 4 layers, 3 matched policies
4. **Dual decision** → Approve the contractor dispatch (external action) AND the memory update (context delta) separately
5. **Context version bumps** → `v12 → v13` with a visible diff
6. **Re-run a similar ticket** → The next proposal knows about the recent repair — compounding improvement
7. **Policy in action** → Change an expense threshold, rerun → different recommendation. Policies are visible, not hidden

---

## Why This Approach Wins

- **Most teams build AI ticket drafting.** We build AI-driven property memory that **compounds**.
- **The Context Delta is the moat.** Every ticket teaches the system something — not just for this response, but for all future agents.
- **Human-in-the-loop by design.** Separate action and memory decisions.
- **Agent-native architecture.** `context.md` is the universal interface — any AI agent can consume versioned, structured property knowledge.
- **Auditable & trustworthy.** Source-backed proposals, visible policy evaluation, full audit trail.

---

*Built for the Buena Hackathon 2026 — Berlin*