# RECONCILE_CONTRACT — Backend ↔ frontendhandoff (canonical)

> **Source of truth:** `frontendhandoff/API.md` on `main` (committed in `98e32d0` /
> `f2d891b`). This document maps that contract onto the existing FastAPI backend
> at `backend/`, and lists exactly what to recycle, extend, or build new.
>
> **One handoff only.** The local untracked folder `frontend/handoff/` is a
> superseded earlier draft and should be **deleted**. Everything below points at
> `frontendhandoff/` (no slash) — the canonical path on main.

---

## 0. What changed vs. the previous draft

The previous reconcile draft was reverse-engineered from a richer (but un-merged)
mock that included pages for escalations, owners, buildings, vendors, chat,
extract, plus property tabs Editor/Versions/Sources/Policies/Calls. Main's
canonical handoff is **smaller and more opinionated**:

| Topic | Earlier draft (guessed) | API.md on main (canonical) |
|---|---|---|
| API base | `/api/v1/...` | **`/api/...`** |
| Proposal resource | First-class (`POST /proposals/{id}/action/{approve\|edit\|reject}`) | **Collapsed into ticket** — `POST /api/tickets/:id/approve` / `reject` |
| Edit path on proposals | `POST .../action/edit`, `.../memory/edit` | **No edit path** — only approve+reject (action) and save+skip (memory) |
| Memory decision | `/proposals/{id}/memory/{approve\|edit\|reject}` | `POST /api/tickets/:id/memory/save` and `.../memory/skip` |
| Context body | Single `content_md`, parse layers client-side | **Structured response** — `{layers: {vendor, owner, building, property: {raw}}}` (server splits) |
| Chat | Request/response | **SSE stream** — `event: delta` / `event: done` |
| Agents registry | `GET /agents` (system prompts visible) | **Not in API.md** — drop |
| PDF extract | sync `POST /documents/.../extract-facts` + apply | **Async polling** — `POST /api/extract` returns `{extractionId, pollUrl}`, `GET /api/extract/:id` returns `{status, proposedDiffs[]}` |
| Vendor cases | Separate `GET /vendors/{id}/cases` | **Embedded** in `GET /api/vendors/:id` response |
| Escalations | Filter on `/tickets` | **Dedicated** `GET /api/escalations` |
| Sources tab API | `GET /properties/{id}/sources` | **Not in API.md** |
| Calls tab API | `GET /properties/{id}/calls` | **Not in API.md** — calls live inside `ticket.callSession` |
| Policies tab API | `GET /properties/{id}/policies?cascade=true` | **Not in API.md** |
| Editor tab API | `POST /properties/{id}/context-proposals` | **Not in API.md** |
| Audit log | `GET /audit` exposed | **Not in API.md** |
| Error shape | implicit | **Standardized:** `{error, code, status}` with `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT` |

If a surface from the earlier draft does not appear in API.md, treat it as **out
of scope for the contract** (mock it locally for now, propose adding it to the
API later if the page lands).

---

## 1. Pages on main vs. pages we still need

### 1.1 In main's `frontendhandoff/`

```
apps/web/app/
├── page.tsx                                  # redirect → /overview
├── layout.tsx                                # ThemeProvider + Sidebar
├── overview/page.tsx                         # KPIs + pipeline + approval queue + memory queue
├── property/[id]/
│   ├── tickets/page.tsx                      # filtered ticket list
│   ├── units/page.tsx                        # units table + WEG callout
│   └── context/page.tsx                      # 4-layer rendered view
└── ticket/[id]/page.tsx                      # proposal-first detail w/ memory gate
```

That's **5 routes**. Sidebar already links to:

- `/escalations`
- `/vendors`, `/owners`, `/buildings`
- `/extract`, `/chat`
- per-property `editor`, `versions`, `sources`, `policies`, `calls`

— so those pages are *expected* but not yet built. API.md covers some of them
(escalations, vendors, owners, buildings, chat, extract); others (editor,
versions, sources, policies, calls) have neither page nor contract yet.

### 1.2 Files NOT committed in main but needed to run locally

Main's `frontendhandoff/` is missing:

- `apps/web/lib/{data.ts, types.ts, utils.ts}` — referenced by every page
- `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`
- `packages/ui/src/components/{card.tsx, table.tsx, separator.tsx, input.tsx, tabs.tsx}` — imported but not committed
- root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`

These can be lifted from the deprecated local `frontend/handoff/` (same
shadcn primitives, same `lib/data.ts` mock seed). When syncing, copy them into
`frontendhandoff/` to make the workspace runnable, then delete `frontend/handoff/`.

---

## 2. The canonical contract (verbatim from `frontendhandoff/API.md`)

Reproduced here so reconcile decisions are anchored to one spec. Endpoints
prefixed `/api`. JSON. Bearer auth (omitted for hackathon).

### 2.1 Properties
- `GET /api/properties` → `Property[]`
- `GET /api/properties/:id` → `Property`

### 2.2 Units
- `GET /api/properties/:propertyId/units` → `Unit[]`

### 2.3 Tickets
- `GET /api/tickets` (`?propertyId`, `?status`, `?risk`) → `Ticket[]`
- `GET /api/tickets/:id` → `Ticket` (with embedded `proposal`, `callSession`, `emailBody`, `vendorJob`, `memoryProposal`)
- `POST /api/tickets/:id/approve` → `{status:"approved", vendorJob}`
- `POST /api/tickets/:id/reject` → body `{reason?:string}`
- `POST /api/tickets/:id/memory/save` → `{status:"saved", contextVersion}`
- `POST /api/tickets/:id/memory/skip`

### 2.4 Vendors
- `GET /api/vendors` (`?buildingId`) → `Vendor[]`
- `GET /api/vendors/:id` → `Vendor & {cases: VendorCase[]}`

### 2.5 Owners
- `GET /api/owners` → `Owner[]`
- `GET /api/owners/:id` → `Owner`

### 2.6 Buildings
- `GET /api/buildings` → `Building[]`
- `GET /api/buildings/:id` → `Building`

### 2.7 Context
- `GET /api/properties/:id/context` → `{propertyId, version, updatedAt, layers:{vendor,owner,building,property: {raw:string}}}`
- `GET /api/properties/:id/context/versions` → `{version, createdAt, author, summary}[]`
- `GET /api/properties/:id/context/versions/:version` → same shape as current

### 2.8 Chat / Hermes (SSE)
- `POST /api/chat` body `{message, propertyId, scope:{layer, id}}` → `text/event-stream`
  - `event: delta` `data: {text}`
  - `event: done` `data: {messageId, appliedTo}`

### 2.9 PDF Extract (async polling)
- `POST /api/extract` (multipart) `file, propertyId?, layer?` → `{extractionId, status:"processing", pollUrl}`
- `GET /api/extract/:extractionId` → `{extractionId, status, proposedDiffs[]}` where each diff is `{layer, heading, before, after, rationale, confidence}`

### 2.10 Escalations
- `GET /api/escalations` → `Ticket[]` filtered/sorted by urgency

### 2.11 Pipeline stages (frontend-static)

`new, triaged, proposed, awaiting_vendor, scheduled, completed` — labels and descriptions live in the frontend.

### 2.12 Errors (every endpoint)

```json
{ "error": "human-readable", "code": "MACHINE_CODE", "status": 400 }
```

`NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT`.

---

## 3. Reconciliation matrix (re-anchored to API.md)

Legend: ✅ recycle (no change) · ➕ extend · 🆕 build new · ❌ drop from earlier plan

### 3.A Properties / Units

| Need | Status | Action |
|---|---|---|
| `GET /api/properties` (with full shape) | ➕ | Existing `GET /api/v1/properties` returns `{id, name, slack_channel, created_at}`. Add `building_id`, `owner_id`, `city`, `units` (count), `open_tickets` (computed), `context_version` (computed = max ContextVersion.version), `phone`, `email`. |
| `GET /api/properties/:id` | ➕ | Same shape as list item. |
| `GET /api/properties/:propertyId/units` | 🆕 | New `units` table + endpoint. Fields exactly per API.md: `id, propertyId, label, type(residential\|commercial), areaQm, meaPermille, ownerName, ownerSince, tenant, rentEur (nullable), beirat (bool)`. |

### 3.B Tickets (the ticket-resource collapse)

| Need | Status | Action |
|---|---|---|
| `GET /api/tickets` with `propertyId/status/risk` filters | ➕ | Backend already has `GET /api/v1/tickets?status` and `GET /api/v1/properties/{id}/tickets?status`. Collapse to one endpoint with all three filters. |
| `GET /api/tickets/:id` returning embedded `proposal/callSession/emailBody/vendorJob/memoryProposal` | ➕ | Backend `TicketWithProposal` returns `proposal` already. Add `callSession`, `emailBody` (from `body` when source=email), `vendorJob`, `memoryProposal` to the response composer. |
| Ticket fields: `num, unitId, source, risk, subject, excerpt, raisedBy, raisedByPhone, createdAt, confidence` | ➕ | Add `num` (auto-generated `GAR-118`-style), `unit_id (FK)`, `risk(low\|medium\|high)`, `excerpt`, `raised_by_phone`, `confidence` (Float). |
| Ticket status enum (10 states) | ➕ | Migrate `open→new`. Add `triaged, approved, awaiting_vendor, scheduled, in_progress, completed`. State-machine validation in service layer (return `409 CONFLICT` on illegal transitions). |
| `proposal.proposedAction = {type, vendor, vendorId, trade, target, estimateEur, etaHours}` | ➕ | Standardize the dispatch_vendor shape. Today's `proposed_external_action: dict` keeps the freedom for non-dispatch actions. |
| `proposal.policiesEvaluated = [{code, name, passed}]` | ➕ | Add `code` field on policies; map `policy_evaluation.matched_policies` into this shape. |
| `POST /api/tickets/:id/approve` | ➕ | Wraps existing `POST /api/v1/proposals/{proposalId}/action/approve`. Same call internally — `tickets/:id/approve` looks up the latest proposal for the ticket, then approves it AND creates the `VendorJob`. Returns `{status:"approved", vendorJob}`. |
| `POST /api/tickets/:id/reject` | ➕ | Same wrap over `proposals/{id}/action/reject` with `{reason?}` body. |
| Drop the **edit** path | ❌ | Remove `POST .../action/edit` and `.../memory/edit` from the public surface. Keep them internally if useful; do not expose in `/api`. |
| `POST /api/tickets/:id/memory/save` | ➕ | Wraps `POST /api/v1/proposals/{id}/memory/approve`. Returns `{status:"saved", contextVersion}`. **Gating:** only allow when the linked `VendorJob.completed_at` is set; else `409 CONFLICT`. |
| `POST /api/tickets/:id/memory/skip` | ➕ | Wraps `memory/reject` with no reason needed. |

### 3.C Vendor / Owner / Building knowledge layer

| Need | Status | Action |
|---|---|---|
| `GET /api/vendors`, `GET /api/vendors/:id` (with `cases[]` inline) | 🆕 | New `vendors` + `vendor_cases` tables. Detail endpoint returns vendor + cases in one payload (no separate cases endpoint). |
| `GET /api/owners`, `GET /api/owners/:id` | 🆕 | New `owners` table with embedded `policies: string[]`, `decisions: {date,text}[]`. (Treat as JSON columns or two child tables — JSON is fine for hackathon.) |
| `GET /api/buildings`, `GET /api/buildings/:id` | 🆕 | New `buildings` table; `systems` is a JSON object. `vendors` is a list of vendor IDs (M:N table or JSON array). |

### 3.D Context (layered)

| Need | Status | Action |
|---|---|---|
| `GET /api/properties/:id/context` returning `{layers:{vendor,owner,building,property:{raw}}}` | ➕ | Backend has `ContextVersion.content_md`. Add a server-side splitter that recognizes 4 named headings (`## Vendor layer`, `## Owner layer`, `## Building layer`, `## Property layer`) and returns each layer's body as `{raw}`. **Important: this is a new server obligation** — the previous draft expected client-side parsing, but API.md commits the backend to do the split. |
| `GET /api/properties/:id/context/versions` | ✅ | Existing endpoint; rename `created_by → author`, `created_reason → summary`, `created_at → createdAt` in the response DTO. |
| `GET /api/properties/:id/context/versions/:version` | ➕ | Existing endpoint; respond with the same layered shape as the current-version endpoint (not raw markdown). |

### 3.E Chat (SSE)

| Need | Status | Action |
|---|---|---|
| `POST /api/chat` returning `text/event-stream` with `event: delta` / `event: done` | 🆕 | The existing `concierge_dispatcher` returns a single `MessageDispatchResult`. Build a new chat handler that streams deltas (e.g., via the SDK's streaming interface) and emits `event: done` with `{messageId, appliedTo}`. `appliedTo` lists context layers/versions the agent touched (often `[]`). |
| `scope: {layer, id}` | 🆕 | Pass through to the orchestrator system prompt; restricts which layers Hermes can read/propose against. |
| Agents registry endpoint | ❌ | Not in API.md — drop. System prompts live in code, not API. |

### 3.F PDF Extract (async polling)

| Need | Status | Action |
|---|---|---|
| `POST /api/extract` returning `{extractionId, status:"processing", pollUrl}` | 🆕 | Existing `POST /api/v1/properties/{id}/documents` does sync upload+text-extraction. Refactor: file upload returns immediately with extractionId, then a background task runs the LLM diff-proposal pipeline. |
| `GET /api/extract/:extractionId` returning `proposedDiffs[]` with `{layer, heading, before, after, rationale, confidence}` | 🆕 | New job-status endpoint. `proposedDiffs` is unified-diff style at the heading level — backend must align each fact to a layer + heading + before/after pair. |
| Optional `propertyId` and `layer` hints in upload | 🆕 | Used to pre-bias the extractor. |
| "Apply selected diffs" endpoint | ❌ (out of scope until UI lands) | API.md does not define one. Add when the page is built. |

### 3.G Escalations

| Need | Status | Action |
|---|---|---|
| `GET /api/escalations` | 🆕 | First-class endpoint. Filter: `risk='high' OR sla_violation=true`, exclude terminal states (`resolved`, `rejected`). Sort by urgency (`risk DESC, createdAt ASC`). |

### 3.H Pipeline stages

| Need | Status | Action |
|---|---|---|
| Static metadata for `new, triaged, proposed, awaiting_vendor, scheduled, completed` | ✅ | Frontend-only. No backend change. |

### 3.I Errors

| Need | Status | Action |
|---|---|---|
| Standardized `{error, code, status}` envelope | ➕ | Add a FastAPI exception handler that maps `HTTPException` and validation errors into this shape. Codes: `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `CONFLICT`. |

### 3.J Out of scope per main (drop from earlier draft)

- `GET /audit` and audit endpoints — not in API.md.
- Policies CRUD (`/properties/{id}/policies` + `PATCH/DELETE /policies/{id}`) — not exposed.
- Property documents listing (`GET /api/v1/properties/{id}/documents`, `GET /documents/{id}/file`) — replaced by extract endpoints.
- Per-property concierge messages (`/properties/{id}/messages`) — replaced by global `/api/chat`.
- `GET /properties/{id}/sources`, `GET /properties/{id}/calls` — calls are nested in `ticket.callSession`, sources aren't in API.
- Editor "Propose change" endpoint — page not in main yet, no contract.
- `GET /agents` — agent prompts not exposed.

Keep the implementations server-side if useful (audit log, policies eval) — just don't surface them in `/api/*`.

---

## 4. Schema & service changes (rolled-up checklist)

### 4.1 New tables

```
owners                 (id, name, type, contact, email, phone, language, monthly_revenue_eur,
                        notes, policies JSON, decisions JSON, created_at)
buildings              (id, name, owner_id FK, address, city, year_built, units,
                        systems JSON, notes, created_at)
building_vendors       (building_id, vendor_id)                     -- M:N
vendors                (id, name, trade, contact, phone, email, rating, preferred,
                        sla_hours, created_at)
vendor_cases           (id, vendor_id FK, property_id FK, date, description,
                        cost_eur, sla_met, rating, created_at)
units                  (id, property_id FK, label, type, area_qm, mea_permille,
                        owner_name, owner_since, tenant, rent_eur, beirat, created_at)
call_sessions          (id, ticket_id FK, duration, caller_phone, summary,
                        transcript_json, noise_reduction_db, created_at)
vendor_jobs            (id, ticket_id FK, proposal_id FK, vendor_id FK,
                        sent_at, accepted, scheduled_for, completed_at,
                        final_cost_eur, notes, created_at)
extractions            (id, property_id FK?, layer_hint, status, file_path,
                        proposed_diffs_json, created_at, finished_at)
property_ticket_counters (property_id, last_num)
```

### 4.2 Existing models — additive columns

- `properties`: `building_id (FK)`, `owner_id (FK)`, `city`, `phone`, `email`. Computed in DTO: `units` (count from units), `open_tickets`, `context_version`.
- `tickets`: `num`, `unit_id (FK)`, `risk`, `excerpt`, `raised_by_phone`, `confidence`. Status enum extended (10 states) with state-machine.
- `agent_proposals`: keep as-is internally; `proposed_external_action` standardized to `{type, vendor, vendor_id, trade, target, estimate_eur, eta_hours}` for `type="dispatch_vendor"`.
- `policies`: add `code` and `source_layer`. Cascade endpoint not exposed via API; needed only as input to `policy_evaluation` — `code/name/passed` flow into proposal payload.

### 4.3 Service layer

- New: `vendor_job_service.py` (dispatch, accept, schedule, complete; complete-event triggers memory-engine).
- New: `memory_engine.py` (rerun on vendor completion; populates `final_context_update_md`).
- New: `context_layer_splitter.py` (parse `## <Layer> layer` headings).
- New: `extraction_service.py` (background task + polling state).
- New: `chat_streaming.py` (SSE-format wrapper around `concierge_dispatcher`).
- New: `num_generator.py` (per-property monotonic ticket numbers).
- Refactor: `proposal_engine` defers context-delta until vendor completion (move from `run_pipeline` → `vendor_job_service.complete`).
- Refactor: API surface re-prefixed from `/api/v1` → `/api`. Either move the router prefix or run two prefixes during migration.

### 4.4 Error handling

- Single FastAPI handler:
  - `HTTPException` → `{error, code, status}` (`code` from a small map; default `VALIDATION_ERROR`).
  - `RequestValidationError` → `VALIDATION_ERROR`.
  - State-machine violations in ticket transitions → `CONFLICT`.

---

## 5. Migration / cleanup actions

1. **Delete** `frontend/handoff/` (the un-merged earlier draft, untracked locally).
2. **Sync** main's `frontendhandoff/` locally (`git checkout origin/main -- frontendhandoff/` once merged into your branch, or rebase onto main).
3. **Port forward** the missing scaffolding files (`apps/web/lib/{data,types,utils}.ts`, `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, root `package.json`, `pnpm-workspace.yaml`, missing shadcn primitives in `packages/ui/src/components/`) from the deprecated `frontend/handoff/` into `frontendhandoff/` so the polish UI runs.
4. **Move this doc** if needed: if you keep `frontend/handoff/RECONCILE_CONTRACT.md` from the earlier write, replace it with this canonical one and `git rm` the old path.
5. Re-prefix backend routers: `/api/v1/...` → `/api/...` (keep the existing routers behind `/api/v1` for one cycle if any tests depend on it, then drop).

---

## 6. Verification (end-to-end smoke after wiring)

1. `pnpm --filter web dev` and `cd backend && python run.py`. `/overview` populates from `GET /api/tickets`.
2. Open a `proposed` ticket → click **Approve dispatch** → `POST /api/tickets/:id/approve` 200; ticket transitions to `awaiting_vendor`; `vendorJob` row exists; response contains `{status, vendorJob}`.
3. Simulate vendor completion (`vendor_job_service.complete(ticket_id, final_cost_eur, notes)`). Re-fetch ticket: `memoryProposal.status === "pending"`.
4. **Save to memory** → `POST /api/tickets/:id/memory/save` → `{status:"saved", contextVersion: 12}`. `/property/.../context` reflects new version.
5. `GET /api/properties/p1/context` returns `{layers:{vendor,owner,building,property:{raw}}}` with the four layer bodies populated.
6. `POST /api/extract` (multipart PDF) → 200 `{extractionId, pollUrl}`. Poll `GET /api/extract/:id` until `status==="done"` → `proposedDiffs[]` populated.
7. `POST /api/chat` (SSE) → consume `event: delta` until `event: done`.
8. `GET /api/escalations` returns the `risk=high` non-terminal ticket.
9. `GET /api/owners/o1`, `GET /api/buildings/b1`, `GET /api/vendors/v1` — vendor response includes `cases[]` inline.
10. Trigger a `409 CONFLICT` on memory save before vendor completion — verify the standardized error envelope.

---

## 7. Suggested execution order

1. **Re-prefix routers** to `/api/...` and add the standardized error handler.
2. **Schema + migrations**: owners, buildings, vendors, vendor_cases, units, call_sessions, vendor_jobs, extractions, property_ticket_counters. Property + Ticket extensions. Backfill `seed_service` to match `lib/data.ts` so the demo runs.
3. **Read endpoints**: `/api/properties` (extended), `/api/properties/:id/units`, `/api/owners`, `/api/buildings`, `/api/vendors` + `:id` with embedded cases.
4. **Ticket endpoints**: extended fields + filters + ticket-collapsed approve/reject/memory wrappers.
5. **Vendor-job lifecycle**: dispatch on approve, complete event triggers memory-engine and unlocks memory decision.
6. **Layered context**: server-side splitter; updated DTOs for `/context` and version reads.
7. **Escalations** endpoint.
8. **PDF Extract** async pipeline + polling endpoint.
9. **Chat SSE** streaming.
10. **Frontend wiring**: replace `lib/data.ts` reads with API hooks page-by-page; cut `/overview` last.

---

## 8. Out of scope (explicit non-goals)

- Auth / multi-tenancy.
- Real SMS/email integration (mocks acceptable inside `vendor_job_service.dispatch()`).
- Editor-tab "Propose change" endpoint and Versions/Sources/Policies/Calls property tabs (no API surface in main yet — defer until those pages land).
- Audit log endpoint, agents registry, per-property concierge messages, document listing (kept server-side; not exposed in `/api`).
- Streaming for endpoints other than `/api/chat`.
- Rolling back `ContextVersion`s.

---

## Appendix — endpoint coverage cheat-sheet

| Frontend need | Status | Endpoint |
|---|---|---|
| Sidebar properties | ➕ | `GET /api/properties` |
| `/overview` KPIs + pipeline | ➕ | `GET /api/tickets` (compose KPIs client-side) |
| `/escalations` | 🆕 | `GET /api/escalations` |
| `/property/[id]/tickets` | ➕ | `GET /api/tickets?propertyId=...&status=...` |
| `/property/[id]/units` | 🆕 | `GET /api/properties/:id/units` |
| `/property/[id]/context` | ➕ | `GET /api/properties/:id/context` (layered) |
| `/property/[id]/versions` (page not on main yet) | ✅ | `GET /api/properties/:id/context/versions` |
| `/property/[id]/{editor,sources,policies,calls}` | ❌ | not in API.md — deferred |
| `/ticket/[id]` detail | ➕ | `GET /api/tickets/:id` (with embedded children) |
| Approve dispatch | ➕ | `POST /api/tickets/:id/approve` |
| Reject dispatch | ➕ | `POST /api/tickets/:id/reject` |
| Save / Skip memory (gated on vendor completion) | ➕ | `POST /api/tickets/:id/memory/{save,skip}` |
| `/owners` + `/owner/[id]` (page not on main yet) | 🆕 | `GET /api/owners`, `GET /api/owners/:id` |
| `/buildings` + `/building/[id]` (page not on main yet) | 🆕 | `GET /api/buildings`, `GET /api/buildings/:id` |
| `/vendors` + `/vendor/[id]` (page not on main yet) | 🆕 | `GET /api/vendors`, `GET /api/vendors/:id` (cases inline) |
| `/extract` upload (page not on main yet) | 🆕 | `POST /api/extract` |
| `/extract` poll (page not on main yet) | 🆕 | `GET /api/extract/:extractionId` |
| `/chat` (page not on main yet) | 🆕 | `POST /api/chat` (SSE) |
