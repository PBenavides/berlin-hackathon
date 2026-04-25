# Buena ContextOps

A human-in-the-loop property management system that automatically generates AI proposals for maintenance tickets based on property context and policies.

## What it does

When a maintenance ticket comes in, the system:
1. Loads the property's latest context (rules, notes, policies)
2. Evaluates the ticket against property-specific policies
3. Generates an AI proposal (e.g. approve, escalate, reject) with a rationale
4. Notifies the team via Slack and logs everything to an audit trail
5. Lets a human review, edit, and accept or reject the proposal

## Tech Stack

| Layer    | Choice |
|----------|--------|
| Backend  | FastAPI + SQLAlchemy (Python) |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui |
| AI       | Claude (Anthropic) via ticket pipeline |
| Infra    | Docker Compose |

## Quick Start

### With Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/docs

### Local development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Set DATABASE_URL in .env
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `SLACK_WEBHOOK_URL` | Slack webhook for proposal notifications | optional |
| `APP_BASE_URL` | Base URL for links in notifications | `http://localhost:3000` |

## Project Structure

```
hackathon2026/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # FastAPI endpoints
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic
│   │       ├── ticket_pipeline.py   # Core orchestration
│   │       ├── proposal_engine.py   # AI proposal generation
│   │       ├── policy_evaluator.py  # Policy rule evaluation
│   │       ├── context_service.py   # Property context loading
│   │       ├── audit_service.py     # Immutable audit trail
│   │       └── slack_service.py     # Slack notifications
│   └── alembic/              # DB migrations
└── frontend/
    └── app/
        ├── tickets/          # Ticket list + detail views
        ├── properties/       # Property + context management
        └── audit/            # Audit trail viewer
```

## API

Swagger docs available at http://localhost:8000/api/docs once running.

Key endpoints:
- `POST /api/v1/tickets/{id}/run-pipeline` — trigger AI proposal generation
- `GET /api/v1/tickets` — list tickets with status
- `GET /api/v1/properties/{id}/context` — get property context
- `GET /api/v1/audit` — audit trail
