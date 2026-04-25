# Overnight Run — Backend

> **Reading order:** start with `frontendhandoff/API.md` (the canonical contract)
> and `frontendhandoff/RECONCILE_CONTRACT.md` (the gap analysis). This file is
> the *execution* view: how to work through the gap in a single overnight, what
> to watch out for in each chunk, and which dominoes fall over which.

The frontend on `main` is mock-only. Everything below either re-shapes existing
endpoints or adds new ones so that when the frontend points at our running
service, every page renders without scaffolding patches. The frontend never
talks about a `proposal` resource — the surface is collapsed onto the ticket. We
keep the proposal model and policy/audit machinery internally, but only
ticket/context/owner/building/vendor/unit/extract/chat/escalations show up on
the wire.

---

## How to use this doc

- Three buckets: **Quick wins (S)**, **Mid-weight (M)**, **Heavy (L)**. Pick by
  energy level, not order — within each bucket, items are roughly
  dependency-ordered.
- One golden path: **S1 → S2 → M1 → M3 → M4 → L1 → L2 → L3**. That gets the
  *primary demo flow* (dispatch a proposal, vendor completes, save memory) on a
  green wire. Everything else is reach.
- Treat each block as a thinking aid, not a checklist. The "Consider" lines are
  the gotchas the engineer will hit at 02:00 if they don't pause first.

---

## S — Quick wins (≤ 1 hr each)

### S1. Re-prefix routers `/api/v1/...` → `/api/...`

The handoff API specifies bare `/api`. We're on `/api/v1`. This is one config
flip in `app/main.py` plus tests, but it's table-stakes — every other change
fails CORS otherwise.

**Consider:**
- Keep `/api/v1` mounted in parallel for one cycle if any seed/dev script or
  test depends on it. Drop after the seed reset.
- The frontend hardcodes `/api` in the `fetch` calls it'll add — there's no
  per-environment base URL flag yet, so do this *before* the frontend wires up.
- OpenAPI docs (`/api/docs`, `/api/redoc`) move with the prefix. Update any
  external link in `README.md` / `docs/`.

### S2. Standardized error envelope

API.md commits us to `{ "error", "code", "status" }` with a known set of codes
(`NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT`). FastAPI's default
422 is incompatible with that shape.

**Consider:**
- One central exception handler is enough. Map `HTTPException`,
  `RequestValidationError`, and a new `StateConflictError` for the ticket
  state-machine work later in L2.
- Codes are the *contract*; messages are free-form. Don't accidentally include
  stack traces in `error` — log them, don't ship them.
- Keep the code map small (4 codes today). Resist temptation to add `INTERNAL`
  unless you wire a 500-handler too — silent 500s tank demos.

### S3. Reset seed data to match the frontend mock

The frontend's `lib/data.ts` (Gartenstraße / Brunnenstraße / Linienstraße,
Heinz / Bekey / Schmidt / Berlin Elektro, units 1A..7A + E1, plus the
`pr-7831` proposal scenarios) is the demo's source of truth. Our `seed_service`
seeds two properties with different content.

**Consider:**
- Do this *after* the schema migrations land (M1) — otherwise you backfill twice.
- The frontend assumes deterministic IDs (`p1, b1, o1, v1, u-1a, t-7831`). Seed
  with stable string IDs, not UUIDs, or add an alias map.
- `dev/reset` should bring the demo back to a fresh, recordable state in one
  call. Treat it as a demo tool, not a test fixture.

---

## M — Mid-weight (1–3 hrs)

### M1. Knowledge-layer schema

Add the new tables in one migration so FKs land together:
`owners`, `buildings`, `building_vendors`, `vendors`, `vendor_cases`, `units`,
`call_sessions`, `vendor_jobs`, `extractions`, `property_ticket_counters`.

**Consider:**
- Owner `policies` and `decisions` are simple lists in the frontend
  (`string[]` and `{date, text}[]`). JSON columns are plenty for the hackathon —
  resist normalising into 5 child tables.
- `building.systems` is a small fixed-key map (`hvac, heating, elevator,
  intercom`). JSON column. Document the keys with a Pydantic schema, not a
  DB constraint.
- `vendor_jobs` is the **gating row** for the memory decision (L2). Make
  `completed_at` nullable and indexed; everything in L3 reads it.
- `extractions` is the queue for L4 — it's polled, so add a `(status, created_at)`
  index from the start.
- Don't forget `property_ticket_counters` — without it, ticket `num` generation
  in M3 races under concurrent inserts.
- Cascade rules: deleting a property should cascade to units, tickets, vendor_jobs.
  Don't cascade owners → buildings → properties (those are independent records
  in the frontend's mind).

### M2. Owner / Building / Vendor / Unit read endpoints

`GET /api/owners`, `GET /api/owners/:id`, same for buildings, vendors, units.
Vendor detail bundles `cases[]` inline.

**Consider:**
- These are read-only and uncached. Skip pagination — datasets are < 50 rows.
- Vendor `buildings: string[]` (an array of building IDs) is a frontend shape
  expectation. Either store the M:N (recommended) and project, or store as a
  JSON array on `vendors`. M:N is more correct; either works for the demo.
- Owner `buildingsCount` and `unitsCount` and `monthlyRevenueEur` are computed
  fields in the frontend mock. Compute server-side at response time. Don't
  denormalise into the table — it'll drift the second a unit's rent changes.
- Mirror Pydantic schema names *exactly* to the frontend `types.ts` (camelCase
  in the JSON response). FastAPI's `alias_generator` saves you here — define
  it in a base model class once.

### M3. Property + Ticket model extensions

Property gets `building_id, owner_id, city, phone, email`. Ticket gets `num,
unit_id, risk, excerpt, raised_by_phone, confidence` and a 10-state status enum.

**Consider:**
- The status enum migration is a string column today — extending it is just a
  set-of-allowed-values change in the Pydantic / app layer. No DB-level enum
  tightening needed; you'll regret a Postgres `ENUM` if you have to add a state
  on Saturday morning.
- Old rows: `open → new`. Update once in the migration; don't leave both states
  visible.
- `excerpt` is a UI-side concern: the first ~200 chars of `body`, possibly
  cleaned of leading "Hello,\n\n". Compute it on insert/update, don't recompute
  on every read.
- `num`: per-property monotonic counter. Use `INSERT ... RETURNING` against
  `property_ticket_counters` inside the same transaction as the ticket insert.
  A SQL-side advisory lock or `SELECT ... FOR UPDATE` is the safest pattern.
- The state machine for transitions belongs in a service helper, not in the
  routes. Reject illegal transitions with `409 CONFLICT` (which now has an
  envelope from S2).

### M4. Ticket-collapsed approve / reject / memory wrappers

`POST /api/tickets/:id/approve` wraps the existing
`POST /api/v1/proposals/{id}/action/approve` (resolves the latest proposal
internally) AND creates the `vendor_job` row in the same transaction. Same idea
for `/reject`, `/memory/save`, `/memory/skip`.

**Consider:**
- The frontend has *no concept* of a proposal as a separate object. It approves
  the *ticket*. The wrapper is the only place where that translation happens —
  keep proposal endpoints internal.
- "Edit" path is gone from the wire. Don't expose it in `/api`. Internal use
  is fine.
- `memory/save` must **fail** with `CONFLICT` if the ticket has no completed
  vendor_job. This is the gating rule the README pinned: memory writes happen
  *after* the job, not at dispatch. Don't be lazy with this — the demo lives or
  dies on it appearing at the right moment.
- Approve response must include the freshly-created `vendorJob` so the
  frontend's optimistic update has the right shape (it's spelled out in API.md).

---

## L — Heavy (≥ half-day, architectural)

### L1. Layered context splitter

`GET /api/properties/:id/context` must return:
```
{ propertyId, version, updatedAt, layers: { vendor, owner, building, property: { raw } } }
```
not raw markdown. The split happens server-side from `ContextVersion.content_md`.

**Consider:**
- Pick *one* convention and enforce it: `## Vendor layer`, `## Owner layer`,
  `## Building layer`, `## Property layer` as top-level sections. The seed
  service must produce exactly this shape so older versions render.
- Lines before the first layer heading are "preamble" — either drop, or attach
  to the property layer. Document the choice.
- Versions endpoint (`/context/versions/:version`) returns the same layered
  shape, not raw. The reuse is trivial — same parser, different version row.
- The previous frontend draft assumed client-side parsing; the canonical
  contract puts this work on the backend. Don't punt it back.
- Keep `ContextChunk` table populated as today (it's heading-keyed already);
  the new layer split is a pre-step before chunking.

### L2. Vendor-job lifecycle + memory deferral

Currently `proposal_engine` produces `context_delta` immediately at proposal
time. Move that work to vendor-job completion: when `vendor_jobs.completed_at`
is set, run a `memory_engine.generate(ticket, vendor_job)` that fills
`agent_proposals.final_context_update_md`, then the `memory/save` endpoint
commits the ContextVersion bump.

**Consider:**
- Pipeline order is now: triage → propose-action → (operator approves) → dispatch
  → vendor accepts → vendor completes → **memory engine runs** → operator
  saves/skips memory → ticket resolves.
- `vendor_job` lifecycle: `dispatched → accepted → scheduled → in_progress →
  completed`. Side-channel writes to ticket.status mirror this. Pick one
  helper that updates both atomically.
- Memory engine in v1 can be a deterministic template: "{unit} {symptom} {fix}
  {date} by {vendor} (€{cost})". An LLM call is overkill for the demo and adds
  failure modes.
- Existing rows have `context_delta` already populated. Don't try to clean
  them — the new flow only *uses* `final_context_update_md`. Keep the column,
  ignore it for new memory decisions.
- Auto-resolve still fires when both action_status *and* memory_status are
  finalised — that logic in `proposals` service stays.
- Dispatch side-effects (Slack, SMS-mock, email-mock) live in
  `vendor_job_service.dispatch()`. Audit them via the existing audit service —
  audit is internal, not exposed.

### L3. Chat SSE streaming

`POST /api/chat` returns `text/event-stream` with `event: delta` (`{text}`)
and a final `event: done` (`{messageId, appliedTo}`). Body is
`{message, propertyId, scope: {layer, id}}`.

**Consider:**
- This is *not* `/properties/{id}/messages`. Drop that endpoint. There's one
  global chat with a `scope` parameter; property is just one possible scope.
- Streaming protocol matters for UX feel. Don't buffer the full reply and emit
  it as one event — the user wants the typewriter effect. OpenRouter / Anthropic
  / OpenAI SDKs all expose a streaming iterator; route those chunks straight to
  SSE deltas.
- `appliedTo` is the array of `{layer, id, version}` that the agent *touched*
  (cited or proposed against). For v1, send `[]` and let it be a future hook.
- SSE keep-alives: send a comment line `:keepalive\n\n` every 15s if the LLM
  takes a while. Browsers timeout silent connections at ~30s.
- CORS on SSE is fragile. `Cache-Control: no-cache, no-transform` and
  `X-Accel-Buffering: no` are the magic incantations on Next.js dev proxy /
  nginx. Test via the deployed setup, not just curl.
- The orchestrator system prompt is internal — API.md does **not** expose an
  agents registry. Keep prompts in code; don't build a registry endpoint we'll
  have to support later.

### L4. PDF Extract — async pipeline

`POST /api/extract` (multipart) returns `{extractionId, status: "processing",
pollUrl}` immediately. `GET /api/extract/:extractionId` returns
`{status, proposedDiffs[]}` where each diff is `{layer, heading, before, after,
rationale, confidence}`.

**Consider:**
- This is *not* the same shape as today's `POST /api/v1/properties/{id}/documents`.
  That endpoint does sync upload + text extraction. Refactor it: the upload is
  step 1 (cheap), extraction is step 2 (background), proposed-diffs is step 3
  (LLM). Each step writes to the `extractions` row.
- "Background task" can be FastAPI `BackgroundTasks` for a hackathon — no Celery
  needed. Just be ready for the process restart wiping in-flight extractions
  (you can ignore it, or persist `status` and resume).
- The diff format is *unified-style*, not "extracted facts list". For each
  candidate context-md change: identify the target layer, the heading inside
  that layer, the existing line(s), and the proposed new line(s). The earlier
  draft's flat fact list is wrong.
- `propertyId` and `layer` hints in the upload help bias the extractor.
  `propertyId` lets you load the current context.md for *diffing*; `layer` is
  a soft hint, not a hard filter.
- "Apply selected diffs" is *not* in API.md yet. The frontend page that
  approves them isn't on main. Don't build the apply endpoint until the page
  arrives — but design the diff shape so applying becomes a straightforward
  ContextVersion bump later.
- Confidence is per-diff, not per-document. The frontend will sort/filter on it.

### L5. Escalations endpoint

`GET /api/escalations` returns Ticket[] sorted by urgency. A first-class
endpoint, not just a filter on `/tickets`.

**Consider:**
- Ranking rule: `risk='high'` first, then SLA-violation (vendor_job.scheduled_for
  past + not completed) within risk-medium, then nothing else. Start simple.
- Exclude terminal states (`resolved`, `rejected`).
- This is the page the operator opens "when something is on fire" — make it
  fast (single query, indexed on `(risk, status)`).
- Reuse the same Ticket DTO as `GET /api/tickets/:id` for shape consistency.
  Frontend will not want to special-case the escalations item shape.

---

## What is *not* in scope tonight

The earlier reconcile draft listed many surfaces that have **no contract on
main**: audit log endpoints, policy CRUD, sources tab, calls tab, policies
tab cascade, editor "propose change", agents registry, per-property concierge
messages, document listing.

Keep their server-side implementations (audit, policy_evaluator). They run
internally. They just don't appear under `/api/*` until the corresponding page
lands and we update API.md. Don't preemptively expose them — every public
surface is a future contract obligation.

---

## Smoke test (run against your local server before sleeping)

```bash
# 1. Server up, /api prefix
curl -s localhost:8000/api/properties | jq '.[0].name'

# 2. Ticket detail with embedded children
curl -s localhost:8000/api/tickets/t-7831 | jq '{num, risk, proposal: .proposal.id, callSession: .callSession.duration}'

# 3. Approve flow + vendor job
curl -s -X POST localhost:8000/api/tickets/t-7831/approve | jq '.vendorJob.sentAt'

# 4. Memory should 409 BEFORE completion
curl -s -X POST localhost:8000/api/tickets/t-7831/memory/save | jq '{code, status}'
# expect: { "code": "CONFLICT", "status": 409 }

# 5. Mark vendor job complete (admin/dev path), then memory should 200
# (vendor-job complete endpoint may be internal/dev — call it however you wire it)

# 6. Layered context
curl -s localhost:8000/api/properties/p1/context | jq '.layers | keys'
# expect: ["building", "owner", "property", "vendor"]

# 7. Escalations
curl -s localhost:8000/api/escalations | jq '.[].risk' | sort -u
# expect "high" only

# 8. Extract async
EID=$(curl -s -F file=@sample.pdf localhost:8000/api/extract | jq -r .extractionId)
curl -s "localhost:8000/api/extract/$EID" | jq .status

# 9. Chat SSE — must see incremental events
curl -N -H 'Accept: text/event-stream' \
     -d '{"message":"What needs my approval?","propertyId":"p1"}' \
     -H 'Content-Type: application/json' \
     localhost:8000/api/chat
```

If 1–6 pass, the core demo runs. 7–9 are the "wow" parts; do them after the core is green.

---

## Failure modes worth pre-mortem'ing

- **Camel-case drift.** FastAPI defaults snake_case; frontend wants camel. Set
  `alias_generator=to_camel` once on a base model and never think about it again.
- **Memory decision visible too early.** Easy to introduce by accident if you
  forget to gate `memoryProposal` rendering on `vendorJob.completedAt` in the
  ticket DTO. Test the timing — open ticket *before* completion, verify the
  field is `null`.
- **Status-enum mismatch.** Old rows in dev DBs will have `open` even after
  the migration. Reset the DB before demo (`POST /api/dev/reset`).
- **SSE buffering.** A reverse proxy or Next.js rewrite that buffers will turn
  streaming chat into a one-shot. Test through the actual proxy chain.
- **Extract polling drift.** If the FE polls every 500ms and the LLM takes 8s,
  you get 16 round trips. Push the polling cadence to 2s with exponential
  backoff up to 5s, OR send the eventual SSE for extract too (out of scope, but
  good to keep in mind for v2).
- **Stable IDs.** If anything generates UUIDs at runtime that the demo seed
  expects to match, the demo's deep links break. Use the literal IDs from
  `lib/data.ts`.
