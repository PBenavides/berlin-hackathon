# Hermes Implementation Plan — Buena ContextOps

*Companion to* `docs/HERMES_PRD.md`
*Status:* Draft v2 — refined after backend audit; pending approval
*Last updated:* 2026-04-25

---

## 0. One-paragraph summary

We add a Hermes-based AI concierge to Buena ContextOps without changing the existing FastAPI domain logic. The Hermes CLI is **installed inside the backend Docker container**; each property owner gets their own Hermes **profile** at `/root/.hermes/profiles/<slug>/` (persisted on host via a `./hermes/runtime` bind mount) with its own `SOUL.md`, skills, sessions, and state. Owners interact with their agent through a **new backend messaging endpoint** (`POST /api/v1/properties/{id}/messages`) that accepts text and images. The backend stores the message + image, calls a Gemini vision pass for multimodal description, then dispatches the message to the property's Hermes profile via `subprocess.run` inside the same container. Hermes — guided by a small set of markdown **skills** — uses its built-in HTTP tool to read context, create tickets, and inspect proposals against the existing `/api/v1/*` endpoints, calling back over the docker network at `http://backend:8000`. Every backend call carries a `X-Hermes-Dispatch-Id` header so audit rows correlate exactly to the originating message. Hermes' reply is captured and returned to the caller. No MCP server is introduced. New properties = new profiles, no domain code changes.

---

## 1. Goals & non-goals

### Goals
1. Each property owner has an isolated Hermes profile with their own state, memory, and persona — directly mirroring the PRD's "one profile and folder directory for each."
2. Owners send messages (text + images) through one **new backend endpoint** we control, without depending on Telegram/Slack/Discord for the demo.
3. Hermes is the **only** new component touching LLMs in this delivery; the existing backend pipeline (`ticket_pipeline`, `proposal_engine`, etc.) is untouched.
4. The agent reads property context, creates tickets on behalf of the owner, and surfaces proposals — but **does not auto-approve** memory or action proposals (humans still decide via the existing webUI).
5. Each profile is provisioned manually via a script that copies a template, renders per-property values, and runs `hermes profile create`.
6. The whole thing is demoable in <5 minutes against a seeded property.

### Non-goals (explicit)
- Authn/authz on the messaging endpoint (single-tenant demo).
- Auto-provisioning Hermes profiles on `POST /properties` (manual script is enough).
- Telegram/Slack/Discord gateways (deferred — Hermes supports them, we just don't wire them in v1).
- Production hosting of Hermes (runs co-located inside the backend container for the demo).
- Changing the existing proposal/policy/audit logic.
- A custom MCP server (using Hermes built-in HTTP tool + skills instead).

---

## 2. Functional requirements

| # | Requirement |
|---|---|
| FR-1 | A new endpoint `POST /api/v1/properties/{property_id}/messages` accepts `multipart/form-data` with `text` (required) and zero-or-more `images` (optional). |
| FR-2 | Each uploaded image is stored on disk under `backend/data/attachments/{owner_message_id}/{filename}` and a row is recorded in `attachments` with metadata (mime type, size, sha256). |
| FR-3 | Each image is passed to Gemini Flash via OpenRouter for a one-paragraph multimodal description; the description is appended to the message body Hermes sees. |
| FR-4 | The backend dispatches the (vision-augmented) text to the property's Hermes profile via the **Hermes dispatcher service** and captures the agent's reply. |
| FR-5 | The endpoint returns synchronously: `{message_id, agent_reply, actions_taken[], attachments[]}` where `actions_taken` enumerates side-effects Hermes performed (ticket created, context read, etc., reconstructed from audit log). |
| FR-6 | A `GET /api/v1/properties/{property_id}/messages` lists past messages with their replies (for debugging / replay). |
| FR-7 | A `GET /api/v1/attachments/{attachment_id}` serves the stored image file. |
| FR-8 | Hermes skills know how to: read latest context, list policies, list/get tickets, get proposals, create a ticket — using the built-in HTTP tool against `BUENA_BACKEND_URL`. |
| FR-9 | Each Hermes profile has `BUENA_PROPERTY_ID` and `BUENA_BACKEND_URL` baked into its `.env` so the agent always operates on a single property. |
| FR-10 | Profile provisioning is a one-shot bash script: `hermes/scripts/provision_profile.sh <property_id> <property_name> <slug>`. |
| FR-11 | Hermes uses Gemini Flash (`google/gemini-3.1-flash-lite-preview`) via OpenRouter as the default model in the profile template. |
| FR-12 | A separate runbook document, `docs/HERMES_TESTING.md`, walks through end-to-end testing including the image flow. |

---

## 3. Non-functional requirements

- **Pluggable**: the existing FastAPI app keeps running unchanged if `HERMES_ENABLED=false` (Hermes integration is gated by a feature flag — the `/messages` endpoint returns 503 with a clear error if disabled).
- **Synchronous in v1**: messaging endpoint is request/response (no queues, no SSE) to match the existing pipeline pattern (`POST /tickets` is sync today).
- **Storage**: attachments live on local disk under `backend/data/attachments/`; the existing `./backend:/app` bind mount in docker-compose already persists this directory to the host. Hermes profile state lives at `/root/.hermes` inside the backend container, persisted via a separate `./hermes/runtime:/root/.hermes` bind mount so profiles survive container rebuilds.
- **Cost**: Gemini Flash via OpenRouter is the cheapest multimodal-capable option that still handles the use case; sub-$0.001 per typical message.
- **Observability**: every Hermes invocation writes an audit row (`action="hermes.dispatch"`) capturing input length, output length, latency, and any subprocess error.
- **Failure modes**: if Hermes fails (timeout, non-zero exit), the message is still saved; the response carries `agent_reply: null` and `error` fields so the caller can surface the failure.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Test client (curl / postman / frontend chat box)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ POST /api/v1/properties/{id}/messages
                               │   text + image[s]
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FastAPI backend (existing, port 8000)                              │
│                                                                      │
│  app/api/routes/messages.py        ← NEW                             │
│    1. persist OwnerMessage + Attachment rows                        │
│    2. vision_service.describe(images)  → text snippets              │
│    3. hermes_dispatcher.send(profile_slug, text + snippets)         │
│    4. persist agent_reply, return synchronously                     │
│                                                                      │
│  Existing routes (unchanged):                                        │
│    /properties /context /tickets /proposals /policies /audit        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ subprocess / HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Hermes runs INSIDE the backend container via subprocess            │
│  Profiles at /root/.hermes/profiles/owner_<slug>/                   │
│  Persisted on host at ./hermes/runtime/profiles/<slug>/ (bind mount)│
│    - config.yaml      (model: openrouter/google/gemini-2.5-flash)  │
│    - .env             (BUENA_PROPERTY_ID, BUENA_BACKEND_URL, key)   │
│    - SOUL.md          (per-property persona)                        │
│    - skills/          (links/copies of hermes/skills/*)             │
│    - sessions/        (Hermes-managed conversation history)         │
│    - state.db         (Hermes-managed)                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Hermes built-in HTTP tool
                               ▼
                   GET/POST http://backend:8000/api/v1/...
                   (back to the same FastAPI process via docker net)
                   Every call carries header X-Hermes-Dispatch-Id: <uuid>
```

**Key idea**: Hermes is a sidecar — but a co-located one, installed in the backend Docker image and invoked per-message via `subprocess.run`. The backend is the system of record; Hermes is the conversational layer that calls back into the backend over the docker network just like any external client would.

---

## 5. Hermes invocation strategy

There are two viable transports, listed in order of preference. Plan picks (a) for v1 and keeps (b) as a documented fallback.

### (a) Subprocess one-shot per message  — **chosen for v1**
Backend invokes (inside the backend container — Hermes CLI is installed in the image):
```
hermes -p <profile_slug> --continue --message "$rendered_input" --json
```
Reads the JSON envelope from stdout, extracts the assistant's final message. Session state is preserved via `--continue` + Hermes' built-in session DB, so each owner's conversation is durable across calls.

**Why**: zero new long-running processes; co-located with the backend so no networking dance; trivial to debug (`docker compose exec backend hermes ...`). Cost: ~spawn latency per message (acceptable for a demo).

**Pre-flight CLI validation (do this first):** before writing `hermes_dispatcher.py`, run `hermes --help` and `hermes profile --help` inside the backend container and confirm `--message`, `--continue`, `--json` flags exist. If any flag is missing, decide between (i) piping stdin/stdout to `hermes -p X chat`, or (ii) starting the dispatcher against the API-server fallback (§5b). 30-min spike; saves hours of debugging downstream.

**Subprocess safety & env propagation:**
- Use `subprocess.run(args=[...])` **list form**; never `shell=True` — owner messages are untrusted input.
- Pass `OPENROUTER_API_KEY` and `BUENA_BACKEND_URL` via `subprocess.run(env={...})` rather than relying on the parent process env.
- Capture stdout AND stderr; on non-zero exit, persist stderr to `OwnerMessage.agent_error` and to the audit row's `metadata`.
- Hard timeout via `timeout=settings.hermes_timeout_s`; on `TimeoutExpired`, kill the process group (start the subprocess with `start_new_session=True` and call `os.killpg(...)`), not just the parent.

### (b) Per-profile Hermes API server — **fallback**
The Hermes docs list "API server" as a session source. If subprocess proves unreliable (cold-start latency, env propagation, etc.), each profile runs `hermes -p <slug> server start --port <auto>` once at provisioning time, and the dispatcher forwards messages over HTTP. We won't wire this up in v1 unless (a) breaks.

---

## 6. New backend components

### 6.1 Models (SQLAlchemy)
- `OwnerMessage` — `id`, `property_id`, `text` (input), `vision_text` (concatenated image descriptions), `agent_reply`, `agent_error`, `latency_ms`, `created_at`.
- `Attachment` — `id`, `owner_message_id`, `filename`, `mime_type`, `size_bytes`, `sha256`, `storage_path`, `vision_description`, `created_at`.

One Alembic migration adds both tables.

### 6.2 Schemas (Pydantic)
- `OwnerMessageOut`, `OwnerMessageList`, `AttachmentOut`, `MessageDispatchResult`.

### 6.3 Routes
- `app/api/routes/messages.py` — `POST /properties/{id}/messages`, `GET /properties/{id}/messages`, `GET /messages/{id}`.
- `app/api/routes/attachments.py` — `GET /attachments/{id}` (serves the stored file with correct mime).

**Error semantics for `POST /messages`:**
| Condition | Status | Body |
|---|---|---|
| `HERMES_ENABLED=false` | 503 | `{"error": "hermes_disabled"}` |
| Property has no provisioned Hermes profile (`/root/.hermes/profiles/{prefix}{slug}` missing) | 409 | `{"error": "no_profile_for_property", "hint": "run hermes/scripts/provision_profile.sh ..."}` |
| Hermes subprocess timeout / non-zero exit | 200 with `agent_reply: null`, `error: "..."` populated, message still persisted | — |

### 6.4 Services
- `app/services/vision_service.py` — calls `https://openrouter.ai/api/v1/chat/completions` with `google/gemini-2.5-flash` and a multimodal payload, returns one description per image. Mirrors the existing httpx call pattern in `proposal_engine.py:705-799` (same auth headers, timeout). OpenRouter follows OpenAI's content-array format — pass images as `{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}`, NOT as file paths. Deterministic stub mode when `OPENROUTER_API_KEY` is empty (returns `"[image: {filename}]"`).
- `app/services/attachment_service.py` — file persistence, sha256, mime sniffing. **Vision caching by sha256**: before calling vision, query for any existing `Attachment` with the same sha256 and a non-null `vision_description`; copy it forward instead of re-hitting the API. Same image uploaded twice doesn't double-spend.
- `app/services/hermes_dispatcher.py` — wraps the subprocess call to `hermes`, handles timeouts (default 60s), captures stdout/stderr, parses the JSON envelope. Generates a `dispatch_id = uuid4()` per call and embeds it in the message envelope (see §8).
- `app/services/openrouter_client.py` *(optional, time-permitting)* — 10-line shared `_openrouter_post(model, messages, **kwargs)` helper extracted from `proposal_engine.py` and reused by `vision_service.py`. Skip if time-pressed; copy/paste is acceptable for hackathon.

### 6.4a Dispatch correlation middleware (new — supports R1)
- `app/middleware/dispatch_id.py` — ASGI middleware that reads the `X-Hermes-Dispatch-Id` request header (with a query-param fallback `?dispatch_id=<uuid>`, see R-3) and stores the value in a `contextvars.ContextVar` for the duration of the request.
- `app/services/audit_service.py` (edit) — `create_audit_entry()` reads the contextvar; if set, merges `{"dispatch_id": <uuid>}` into the `metadata` dict before persisting.
- Enables exact `actions_taken` reconstruction via `SELECT * FROM audit_log WHERE event_metadata->>'dispatch_id' = :id` instead of a brittle time-window query.

### 6.5 Config additions (`app/config.py`)
Existing config uses `pydantic-settings.BaseSettings` with lowercase Python field names (env vars auto-uppercased). New fields:

| Var | Default | Purpose |
|---|---|---|
| `HERMES_ENABLED` | `true` | Feature flag for the messaging endpoint. |
| `HERMES_BIN` | `hermes` | Path to the Hermes CLI binary inside the backend container. |
| `HERMES_PROFILE_PREFIX` | `owner_` | Prefix used to derive a profile slug from a property. |
| `HERMES_TIMEOUT_S` | `60` | Subprocess timeout. |
| `HERMES_PROFILES_DIR` | `/root/.hermes/profiles` | Where Hermes stores profiles inside the container (bind-mounted to `./hermes/runtime/profiles` on host). |
| `ATTACHMENTS_DIR` | `./data/attachments` | Where image files live on disk. |
| `VISION_MODEL` | `google/gemini-2.5-flash` | OpenRouter model for vision. |

**Implementation note — `audit_log.metadata` column:** SQLAlchemy reserves `metadata` on the Base class, so `backend/app/models/audit_log.py:18` declares it as `event_metadata = sa.Column("metadata", sa.JSON, nullable=True)`. Use `AuditLog.event_metadata` in ORM queries but `metadata` in raw SQL / migrations / JSON-path filters (e.g. `event_metadata->>'dispatch_id'`). The `audit_service.create_audit_entry()` helper takes a `metadata=` kwarg — preserve that signature.

---

## 7. Hermes profile + skills layout

Profiles live at `/root/.hermes/profiles/` **inside the backend container**, bind-mounted to `./hermes/runtime/profiles/` on the host so they survive container rebuilds. The `hermes/` directory at the repo root holds the static templates and skill markdown that get copied into each new profile.

Repo layout (new `hermes/` directory at project root):

```
hermes/
├── README.md                       — setup instructions, model + key choices
├── profiles/
│   ├── _template/                  — copied verbatim by provisioning script
│   │   ├── config.yaml.tmpl        — model, toolset, skill registration
│   │   ├── env.tmpl                — BUENA_*, OPENROUTER_API_KEY placeholders
│   │   └── SOUL.md.tmpl            — per-property persona stub
│   └── .gitignore                  — generated profiles are not committed
├── skills/                         — markdown procedural skills
│   ├── buena_intake.md             — "when an owner sends a message, do this:"
│   ├── buena_context.md            — endpoint contract for context reads
│   ├── buena_tickets.md            — endpoint contract for ticket CRUD
│   ├── buena_proposals.md          — read-only proposal inspection contract
│   └── buena_policies.md           — endpoint contract for active policies
└── scripts/
    └── provision_profile.sh        — see below
```

### 7.1 `provision_profile.sh` contract
Run **inside the backend container** so it operates on the same `/root/.hermes/` Hermes sees at dispatch time:
```
docker compose exec backend bash hermes/scripts/provision_profile.sh \
    --property-id  <uuid> \
    --property-name "Haus 42" \
    --slug         haus42 \
    --backend-url  http://backend:8000 \
    --openrouter-key sk-or-...
```
Does:
1. Generate slug `owner_<slug>`.
2. Copy `_template/` to a temp dir, render `{{ ... }}` placeholders.
3. Run `hermes profile create owner_<slug> --clone-from <temp_dir>` (or `--clone` from a base profile, depending on what `hermes profile create` actually accepts — confirm during the §5a pre-flight check).
4. Symlink `hermes/skills/*.md` into the profile's skills directory.
5. Print the profile path + a one-liner test command.

Because `/root/.hermes` is bind-mounted to `./hermes/runtime`, the resulting profile is also visible on the host at `./hermes/runtime/profiles/owner_<slug>/`.

### 7.2 `SOUL.md.tmpl` (sketch)
> You are the AI concierge for **{{property_name}}** (`property_id: {{property_id}}`). You help the property owner triage incoming issues and surface what your living context document already knows. Before suggesting a course of action you ALWAYS consult the latest context via `GET {{backend_url}}/api/v1/properties/{{property_id}}/context`. When the owner reports a new problem you create a ticket via `POST {{backend_url}}/api/v1/tickets` with their message as the body. You NEVER approve action or memory proposals on the owner's behalf — you tell them where to review them in the dashboard.

### 7.3 Skill files
Each skill is short markdown with the endpoint contract + an example. For instance, `buena_tickets.md` documents that `POST /api/v1/tickets` takes `{property_id, source: "owner_message", subject, body, raised_by}` and returns the ticket id, and instructs the agent to use the HTTP tool. Hermes skills are procedural memory — the agent learns by reading them.

**Mandatory header on every backend HTTP call (R1 dispatch correlation):** every skill that documents a backend endpoint MUST instruct the agent to include `X-Hermes-Dispatch-Id: {{dispatch_id}}` on the request. The current dispatch_id is provided to the agent in the message envelope (see §8 step 4). Example snippet to include verbatim in each skill:
> Always include header `X-Hermes-Dispatch-Id: <dispatch_id>` on every call. The dispatch_id is the UUID at the top of the user's message envelope. Without this header, the action will not be correlated with the originating message in the audit log.

`buena_intake.md` should additionally extract and surface the dispatch_id at the start of the agent's reasoning so it's available as a variable for subsequent tool calls.

---

## 8. Data flow — one message, end-to-end

1. Caller sends `POST /api/v1/properties/<id>/messages` with text + image.
2. Route persists `OwnerMessage` (status `pending`) and one `Attachment` per image; files saved under `data/attachments/<msg_id>/`. For each attachment, attachment_service first checks if any existing `Attachment` shares the same sha256 + has a non-null `vision_description`; if so, copy it and skip the API call (cache hit).
3. `vision_service.describe(attachment)` is called for each cache miss; descriptions stored on the `Attachment` row and concatenated into `vision_text`.
4. Dispatcher generates `dispatch_id = uuid4()`, persists it on the `OwnerMessage` row, and composes the rendered input:
   ```
   [Dispatch ID: <uuid> — include this UUID as the X-Hermes-Dispatch-Id header on EVERY backend HTTP call]

   [Owner of property {property_id}]:
   {text}

   [Attached images, described by vision]:
   - <vision_description_1>
   - <vision_description_2>
   ```
5. Dispatcher invokes `hermes -p owner_<slug> --continue --message "..." --json` with a hard timeout, passing `OPENROUTER_API_KEY` and `BUENA_BACKEND_URL` via `subprocess.run(env={...})`.
6. Hermes loads its skills (which instruct it to forward the `X-Hermes-Dispatch-Id` header), and decides to call `GET /context`, `POST /tickets`, etc. against `http://backend:8000` (= the same FastAPI process, reached via docker network). Each backend hit hits the dispatch_id middleware (§6.4a), and any audit row written during that request gets the dispatch_id stamped into its `metadata`.
7. Hermes returns its assistant message in the JSON envelope.
8. Backend stores `agent_reply` + `latency_ms` on `OwnerMessage` and writes `audit_log(action="hermes.dispatch", metadata={"dispatch_id": <uuid>, "stderr": ...})`.
9. Backend returns `MessageDispatchResult { message_id, agent_reply, actions_taken[], attachments[] }`. `actions_taken` is reconstructed by `SELECT id, action, entity_type, entity_id FROM audit_log WHERE event_metadata->>'dispatch_id' = :dispatch_id` — exact correlation, no time-window heuristic.

---

## 9. File-by-file change list

**Backend (new files):**
- `backend/app/api/routes/messages.py`
- `backend/app/api/routes/attachments.py`
- `backend/app/models/owner_messages.py`
- `backend/app/models/attachments.py`
- `backend/app/schemas/messages.py`
- `backend/app/schemas/attachments.py`
- `backend/app/services/vision_service.py`
- `backend/app/services/attachment_service.py`
- `backend/app/services/hermes_dispatcher.py`
- `backend/app/services/openrouter_client.py` *(optional shared httpx helper, R2 — skip if time-pressed)*
- `backend/app/middleware/dispatch_id.py` *(R1 — ASGI middleware reading `X-Hermes-Dispatch-Id` into a contextvar)*
- `backend/app/middleware/__init__.py`
- `backend/alembic/versions/<rev>_add_owner_messages_attachments.py`

**Backend (edits):**
- `backend/app/main.py` — register `messages` and `attachments` routers; register `DispatchIdMiddleware`; add `@app.on_event("startup")` hook that runs `os.makedirs(settings.attachments_dir, exist_ok=True)` and `os.makedirs(settings.hermes_profiles_dir, exist_ok=True)`.
- `backend/app/services/audit_service.py` — read the dispatch_id contextvar inside `create_audit_entry()`; if set, merge `{"dispatch_id": <uuid>}` into the `metadata` dict before persisting.
- `backend/app/config.py` — add `HERMES_*`, `HERMES_PROFILES_DIR`, `ATTACHMENTS_DIR`, `VISION_MODEL`.
- `backend/requirements.txt` — add `python-multipart` (multipart upload), `pillow` (mime sniff). No Hermes Python lib needed; we shell out.
- `backend/Dockerfile` — install Hermes CLI per Hermes quickstart; ensure `hermes` is on PATH; consider running `hermes setup` at image build time using build-time `OPENROUTER_API_KEY` arg (or defer to first-run init script).
- `docker-compose.yml` — add bind mount `./hermes/runtime:/root/.hermes`; pass `OPENROUTER_API_KEY` and `HERMES_ENABLED` env vars to the `backend` service. The existing `./backend:/app` mount already covers `data/attachments/`.

**Hermes (new tree):**
- `hermes/README.md`
- `hermes/profiles/_template/config.yaml.tmpl`
- `hermes/profiles/_template/env.tmpl`
- `hermes/profiles/_template/SOUL.md.tmpl`
- `hermes/profiles/.gitignore`
- `hermes/skills/buena_intake.md`
- `hermes/skills/buena_context.md`
- `hermes/skills/buena_tickets.md`
- `hermes/skills/buena_proposals.md`
- `hermes/skills/buena_policies.md`
- `hermes/scripts/provision_profile.sh`

**Docs:**
- `docs/HERMES_PLAN.md` — this file.
- `docs/HERMES_TESTING.md` — runbook (written after plan approval).

---

## 10. Testing plan (sketch — full doc to follow)

1. **Stack up + DB seeded**: `docker compose up --build` (Hermes CLI is installed in the backend image; `./hermes/runtime` bind mount is created on first run). Then `docker compose exec backend python -c "from app.seed import seed; seed()"`.
2. **Confirm Hermes CLI** inside the container: `docker compose exec backend hermes --help`. Run `docker compose exec backend hermes setup` once if not baked into the image — set OpenRouter as provider, key from env.
3. **Provision** one demo profile inside the container:
   ```
   docker compose exec backend bash hermes/scripts/provision_profile.sh \
       --property-id <seed-id> --property-name "Demo Haus" \
       --slug demohaus --backend-url http://backend:8000
   ```
4. **Smoke test the dispatcher** inside the container:
   `docker compose exec backend hermes -p owner_demohaus --continue --message "hi" --json` should return JSON with the assistant reply (and the agent should be able to call `http://backend:8000/api/v1/health`).
5. **Send a text message** from the host via `curl -F text='Toilet leaking in 3B' http://localhost:8000/api/v1/properties/<id>/messages`. Expect: ticket appears in the existing webUI within ~5s.
6. **Send a text + image** via `curl -F text='See photo' -F images=@leak.jpg http://localhost:8000/api/v1/properties/<id>/messages`. Expect: vision description in the ticket body, image fetchable at `/api/v1/attachments/<aid>`. Re-upload the same image and confirm vision is served from sha256 cache (no new OpenRouter call — verify via logs or vision-service stub counter).
7. **Multi-turn**: second message references the first ticket. The same Hermes session continues, agent recalls context.
8. **Verify dispatch correlation** (R1): `SELECT id, action, event_metadata->>'dispatch_id' FROM audit_log WHERE event_metadata->>'dispatch_id' IS NOT NULL` should return all rows from a single dispatch sharing the same UUID. The response payload's `actions_taken[]` should match this query exactly.
9. **Verify audit trail** has rows for `ticket.create` (actor=`api`, source=`owner_message`) plus `hermes.dispatch`, all stamped with the same dispatch_id.
10. **Verify isolation**: provisioning a second profile for a different property and chatting with it does not leak context across (each Hermes session DB lives under its own profile dir).
11. **Verify error paths**: `HERMES_ENABLED=false` → 503; property without provisioned profile → 409 with `no_profile_for_property`.
12. **Verify persistence**: `docker compose down && docker compose up` — profiles, attachments, and DB all survive.

The full testing doc adds: env setup matrix, sample images, expected ticket bodies, troubleshooting, and a teardown step.

---

## 11. Risks & open questions

| # | Risk / unknown | Mitigation |
|---|---|---|
| R-1 | Exact Hermes CLI flags for one-shot JSON output may differ from the doc summary. | Mandatory pre-flight check at the start of §5a: run `hermes --help` inside the backend container before writing the dispatcher. If `--message`/`--json` are missing, fall back to piping stdin/stdout to `hermes -p X chat`, OR switch to API-server fallback (§5b). |
| R-2 | `hermes profile create --clone-from <dir>` may not accept an arbitrary directory. | Provisioning may need a two-step dance: first `hermes profile create _buena_base --clone`, populate it, then `--clone-from _buena_base`. Document either way in the testing runbook. |
| R-3 | Hermes' built-in HTTP tool may not support per-call custom headers, breaking the R1 dispatch_id correlation via `X-Hermes-Dispatch-Id`. | If per-call headers can't be set: keep dispatch_id in the message envelope as a token the agent must include in a query param `?dispatch_id=<uuid>` instead — the middleware already reads from header OR query. Worst case: revert §8 step 9 to the time-window approach (acceptable for single-user demo). |
| R-4 | Hermes' built-in HTTP tool may need explicit allowlist for `BUENA_BACKEND_URL=http://backend:8000`. | Configure `tools.http.allowed_hosts` in the profile template `config.yaml.tmpl`. |
| R-5 | Subprocess cold-start latency may exceed 60s under load. | Switch to API-server fallback (§5b). Demo is single-user so unlikely to bite. |
| R-6 | Vision-described image may miss critical details (e.g. meter readings). | Stash both the image file and the description; humans see the image in the ticket UI. |
| R-7 | OpenRouter rate limits during demo. | Cache vision descriptions by attachment sha256 (implemented in §6.4 — same image uploaded twice doesn't re-hit the API). |
| R-8 | Hermes CLI install adds non-trivial size to the backend image; rebuild needed for CLI version bumps. | Pin Hermes version in the Dockerfile; rebuild only when explicitly bumping. Use docker layer caching so CLI install is cached across most rebuilds. |

---

## 12. Effort estimate

Rough — single-developer, hackathon clock:

| Block | Effort |
|---|---|
| Hermes CLI pre-flight spike (R1, §5a) | 0.5h |
| Backend models + migration + multipart route | 2.5h |
| Vision service + attachment service (with sha256 caching) | 1.7h |
| Hermes dispatcher (subprocess, with safety guards) | 1.5h |
| Dispatch-id middleware + audit_service edit (R1) | 0.5h |
| Hermes profile template + 5 skill files + `SOUL.md.tmpl` | 2h |
| `provision_profile.sh` | 1h |
| Dockerfile + docker-compose changes (Hermes install, bind mount, env) | 1h |
| Wire up + manual end-to-end on one property | 1.5h |
| `HERMES_TESTING.md` runbook | 1h |
| **Total** | **~13h** (~1.5 working days) |

---

## 13. Acceptance checklist

- [ ] `POST /api/v1/properties/{id}/messages` accepts text + multipart images and returns within `HERMES_TIMEOUT_S`.
- [ ] Image bytes persisted; `GET /api/v1/attachments/{id}` returns the file with correct mime.
- [ ] Vision description appears in the ticket body when an image is sent.
- [ ] Re-uploading an image with the same sha256 reuses the cached vision description (no second OpenRouter call).
- [ ] A real `Ticket` row is created via the existing pipeline (so `proposal_engine` runs, audit rows land).
- [ ] All audit rows from a single dispatch share the same `event_metadata->>'dispatch_id'` UUID; `actions_taken[]` in the response is reconstructed from this query.
- [ ] Hermes (running inside the backend container) can call `http://backend:8000/api/v1/...` and receive successful responses.
- [ ] Hermes profile state persists across `docker compose down && docker compose up` (via `./hermes/runtime` bind mount).
- [ ] Two property profiles can be provisioned and held simultaneously without state bleed.
- [ ] Sending a message to a property with no provisioned profile returns 409 `no_profile_for_property`.
- [ ] `HERMES_ENABLED=false` cleanly disables the new endpoint with 503 without affecting existing ones.
- [ ] `docs/HERMES_TESTING.md` walks a stranger from clean clone to a successful end-to-end run via `docker compose up`.
