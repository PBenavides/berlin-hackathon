# Backend Documentation

**Stack:** FastAPI · SQLAlchemy 2.0 · PostgreSQL 16 · Python  
**Port:** 8000  
**Entry point:** `run.py` → `app/main.py`

---

## Architecture

```
backend/
├── app/
│   ├── api/routes/      # HTTP layer – thin controllers
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic request / response shapes
│   ├── services/        # Business logic (proposal engine, pipeline, etc.)
│   ├── config.py        # Env-based settings (pydantic-settings)
│   ├── database.py      # Engine + SessionLocal + Base
│   ├── main.py          # App factory, CORS, route registration
│   └── seed.py          # Demo data seeder
├── alembic/             # DB migrations
├── requirements.txt
└── Dockerfile
```

Processing is **synchronous** (no async queues). Every ticket submission runs the full pipeline inline and returns immediately.

---

## Configuration (`app/config.py`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `ENVIRONMENT` | `development` | Controls debug mode |
| `PROPOSAL_ENGINE` | `stub` | `stub` (template) or `ai` (LLM) |
| `OPENROUTER_API_KEY` | — | Required when `PROPOSAL_ENGINE=ai` |
| `SLACK_WEBHOOK_URL` | — | Outbound Slack notifications (optional) |
| `APP_BASE_URL` | — | Frontend URL embedded in Slack deep-links |

---

## Database Models (`app/models/`)

| Model | Key Fields | Notes |
|---|---|---|
| `Property` | `id`, `name`, `slack_channel` | Top-level tenant entity |
| `Ticket` | `property_id`, `title`, `description`, `status`, `risk_level` | `status`: open → proposed → approved/rejected → resolved |
| `AgentProposal` | `ticket_id`, `action_decision`, `memory_decision`, `action_status`, `memory_status` | Two-stage approval; each decision is independent |
| `ContextVersion` | `property_id`, `version_number`, `content`, `branch` | Full snapshot per save |
| `ContextChunk` | `version_id`, `chunk_text`, `chunk_index` | For semantic retrieval / citations |
| `PropertyPolicy` | `property_id`, `title`, `rule_text`, `priority` | Human-readable rules fed to policy evaluator |
| `AuditLog` | `entity_type`, `entity_id`, `action`, `actor`, `before`/`after` | Immutable event trail |

---

## API Routes (`app/api/routes/`)

All routes are prefixed `/api/v1`. Interactive docs at `http://localhost:8000/docs`.

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check — returns `{"status": "ok"}` |

### Properties
| Method | Path | Description |
|---|---|---|
| GET | `/properties` | List all properties, ordered by creation date |
| GET | `/properties/{property_id}` | Single property by ID |

### Context
| Method | Path | Description |
|---|---|---|
| GET | `/properties/{property_id}/context` | Latest context version (records audit `context.read`) |
| POST | `/properties/{property_id}/context` | Save new context version; auto-splits into chunks (records audit `context.write`) |
| GET | `/properties/{property_id}/context/versions` | All versions for a property, ordered descending |
| GET | `/properties/{property_id}/context/versions/{version}` | Specific version by number (records audit) |
| GET | `/properties/{property_id}/context/diff` | Unified diff between two versions — query params: `?from={n}&to={n}` |

### Tickets
| Method | Path | Description |
|---|---|---|
| POST | `/tickets` | Submit new ticket → triggers full proposal pipeline synchronously |
| GET | `/tickets` | All tickets; optional filter `?status={status}` |
| GET | `/tickets/{ticket_id}` | Single ticket with latest proposal and both decision statuses |
| GET | `/properties/{property_id}/tickets` | Tickets scoped to one property; optional filter `?status={status}` |

**Valid status values:** `open` · `proposed` · `approved` · `resolved` · `rejected`

### Proposals (Human Review)
Granular endpoints for independent action and memory decisions:

| Method | Path | Description |
|---|---|---|
| GET | `/proposals/{proposal_id}` | Get a single proposal by ID |
| GET | `/tickets/{ticket_id}/proposal` | Latest proposal for a ticket |
| POST | `/proposals/{proposal_id}/action/approve` | Approve the proposed action |
| POST | `/proposals/{proposal_id}/action/edit` | Edit and approve the proposed action |
| POST | `/proposals/{proposal_id}/action/reject` | Reject the proposed action |
| POST | `/proposals/{proposal_id}/memory/approve` | Approve context update → creates new `ContextVersion` |
| POST | `/proposals/{proposal_id}/memory/edit` | Apply operator-edited markdown as context update |
| POST | `/proposals/{proposal_id}/memory/reject` | Reject context update (no new version created) |
| POST | `/proposals/{proposal_id}/action` | Unified action decision (`decision`: `approve`/`edit`/`reject`) |
| POST | `/proposals/{proposal_id}/memory` | Unified memory decision (`decision`: `approve`/`edit`/`reject`) |

All decision endpoints require `reviewed_by` in the request body. Edit endpoints accept `edited_action` or `edited_context_md`. Reject endpoints accept `rejection_reason`.

### Policies
| Method | Path | Description |
|---|---|---|
| GET | `/properties/{property_id}/policies` | List all active policies for a property |
| POST | `/properties/{property_id}/policies` | Create a new policy (records audit `policy.create`) |
| PATCH | `/policies/{policy_id}` | Partial update of a policy (records audit `policy.update`) |
| DELETE | `/policies/{policy_id}` | Soft-delete (deactivate) a policy — returns 204 (records audit `policy.delete`) |

### Audit
| Method | Path | Description |
|---|---|---|
| GET | `/audit` | Read-only audit trail; filters: `?property_id={id}` · `?action={type}`; pagination: `?limit={1-500}&offset={n}` |

### Dev Utilities
| Method | Path | Description |
|---|---|---|
| POST | `/dev/reset` | Wipe all data and reseed database (destructive — dev/demo only) |
| POST | `/dev/simulate-ticket` | Create a ticket from a predefined template; body: `{"template_id": "string"}` |
| GET | `/dev/ticket-templates` | List all available ticket simulation templates |

---

## Services (`app/services/`)

### `ticket_pipeline.py` — Core Orchestrator
Called on every `POST /tickets`. Runs synchronously:
1. Load latest context version for the property
2. Load property policies
3. `PolicyEvaluator` checks ticket against policies
4. `ProposalEngine` generates action + memory proposal
5. `SlackService` sends notification (if configured)
6. `AuditService` logs the event

### `proposal_engine.py` — Pluggable Proposal Generation
Two implementations selected by `PROPOSAL_ENGINE` env var:
- **`StubProposalEngine`** – deterministic template-based proposals (no API key needed)
- **`AIProposalEngine`** – sends context + ticket to an LLM via OpenRouter, parses structured JSON response

### `policy_evaluator.py`
Checks ticket description against all active `PropertyPolicy` rules. Returns a list of violated policies (fed into proposal context).

### `context_service.py`
- Saves new `ContextVersion` records (full content snapshots)
- Computes unified diffs between versions
- Splits content into `ContextChunk` records for retrieval

### `audit_service.py`
Creates `AuditLog` rows. Called from routes and pipeline to record every meaningful state transition.

### `slack_service.py`
Sends a formatted message to the configured webhook with ticket summary and deep-link to the frontend review page.

### `seed_service.py`
Inserts demo properties, context, policies, and sample tickets for local development.

---

## Ticket Lifecycle

```
POST /tickets
       │
       ▼
 ticket_pipeline
  ├─ load context + policies
  ├─ policy_evaluator  →  violations list
  ├─ proposal_engine   →  AgentProposal (action + memory draft)
  └─ slack_service     →  notification sent
       │
       ▼
 status: "proposed"
       │
  human reviews via frontend
  ├─ POST /proposals/{id}/action/approve|edit|reject  →  action_status
  └─ POST /proposals/{id}/memory/approve|edit|reject  →  memory_status
       │
       ▼
 status: "resolved"  (both decisions finalized)
```

---

## Running Locally

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in env vars
cp .env.example .env

# Apply migrations
alembic upgrade head

# Seed demo data (optional)
python -c "from app.seed import seed; seed()"

# Start server
python run.py
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

Or with Docker Compose from the repo root:
```bash
docker compose up --build
```
