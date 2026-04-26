# Overnight Run — Frontend

> **Historical document.** References to `frontendhandoff/` now point to the renamed `frontend/` (consolidated 2026-04-26).

> **Reading order:** `frontendhandoff/API.md` is the contract.
> `frontendhandoff/RECONCILE_CONTRACT.md` shows what we're keeping, extending,
> and dropping vs. older drafts. This file is the *execution* view: how to spend
> a single overnight on the frontend without painting into a corner.

We start from `frontendhandoff/` on `main` — the polished design (teal theme,
dark mode, retractable sidebar) with **5 wired pages** and the rest of the
sidebar pointing into the void. Goals tonight, in order of importance:

1. The 5 main pages render against the real backend instead of `lib/data.ts`.
2. The dispatch → vendor-completion → memory-save flow works end-to-end on
   `/ticket/[id]`.
3. The 6 missing pages the sidebar already links to (escalations, owners,
   buildings, vendors, chat, extract) at least *exist* and read live data,
   even if rough.

We do **not** build editor / versions / sources / policies / calls property
tabs tonight — they have neither pages nor backend contract on main. Sidebar
will link to placeholders. That's fine.

---

## How to use this doc

- Three buckets: **Quick wins (S)**, **Mid-weight (M)**, **Heavy (L)**.
- Golden path: **S1 → S2 → M1 → M2 → L1 → L2 → L3**. That gets the demo flow
  green. Everything else is reach.
- The "Consider" lines are the gotchas that bite at 03:00. Read them before
  starting each block.

---

## S — Quick wins (≤ 1 hr each)

### S1. Folder cleanup — one canonical handoff

The repo currently has two parallel handoff drafts:

- `frontendhandoff/` (committed on main, **canonical**, polished UI, 5 pages)
- `frontend/handoff/` (local untracked, earlier draft, more pages, no theming)

Pick one and delete the other. We've decided on `frontendhandoff/`.

**Consider:**
- Before deleting `frontend/handoff/`, *cherry-pick the page files we want* —
  most of the additional pages (escalations, owners, buildings, vendors,
  property tabs) are usable as starting points after a re-style. Move them
  into `frontendhandoff/apps/web/app/...` first, then nuke the old folder.
- The polish branch's pages use updated tokens (`text-emerald-500/30`,
  dark-mode-aware variants). When porting, search-replace
  `border-foo-200`/`bg-foo-50/40` → `border-foo-500/30`/`bg-foo-500/5` to keep
  the look consistent.
- `frontend/` (the legacy Sprint-1..5 frontend) is *also* deprecated but stays
  on disk — it's referenced by `docker-compose.yml`. Update compose to point
  at `frontendhandoff/` once it's runnable. Don't delete `frontend/` until
  after the demo unless you're sure nothing else points at it.

### S2. Make `frontendhandoff/` runnable

Main only commits the *unique* files (theme, sidebar, the 5 pages, badges,
page-header, and 2 ui primitives). Missing scaffolding the pages need:

- `apps/web/lib/{data.ts, types.ts, utils.ts}`
- `apps/web/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `components.json`
- `packages/ui/src/components/{card.tsx, table.tsx, separator.tsx, input.tsx, tabs.tsx, ...}`
- root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`

**Consider:**
- Lift these files from `frontend/handoff/` (deprecated draft) verbatim — they
  match the contract types and are already proven to compile.
- The deprecated draft pages may import primitives that aren't in the polish
  branch's `packages/ui` yet. When a port complains "module not found", copy
  the primitive over too — they're tiny.
- Once `pnpm install && pnpm dev` runs, you're done with S2. Don't yet try to
  wire to the backend.

### S3. Pipeline stages constant

API.md says "pipeline stages are static config — no API needed". Today the
frontend imports `pipelineStages` from `lib/data.ts`. Move it to a dedicated
`lib/pipeline.ts` so it stops travelling with the mock data when we delete
that file.

**Consider:**
- The constant is tiny (6 entries, `id, label, description`). Centralising it
  here makes status-rendering throughout the app trivial.
- The 10-state ticket status enum is bigger than the 6-stage pipeline. Don't
  conflate — `Ticket.status` can be `approved` even though there's no
  "Approved" pipeline column.

### S4. Error envelope display

Backend will respond with `{ error, code, status }` for every error. Decide
*now* how the UI renders these — a one-line shadcn `Toast`/`Sonner` pattern
is fine.

**Consider:**
- Map `CONFLICT` to a specific message, especially for the memory-save case
  (saving before vendor completes). The user shouldn't see "409 conflict" —
  they should see "Vendor hasn't reported completion yet".
- `NOT_FOUND` on detail pages should `notFound()` (App Router has it built-in).
- Wrap the central `fetch` helper in S5 so this lives in one place.

---

## M — Mid-weight (1–3 hrs)

### M1. The API client (`lib/api.ts`)

We have one shot at picking the data-fetching pattern. Two options:

- **RSC + `fetch` revalidation** — server components do the fetching, route
  segments use `revalidateTag`. Simpler model, less code, but mutations need
  server actions.
- **TanStack Query** — client-side, familiar mutation/cache patterns, plays
  with optimistic updates well.

**Consider:**
- Most of the 5 main pages already use `"use client"` (the ticket detail's
  approve buttons demand it). TanStack Query fits that grain.
- For pages that *don't* need interactivity (overview, units), RSC + `fetch`
  is faster to ship.
- Whatever you pick, **wrap one helper** that knows about the error envelope
  shape, throws a typed `ApiError`, and lets every consumer call
  `await api.tickets.list({ status: 'proposed' })`. That is the bridge between
  S4's toast handler and every page.
- Don't over-design. A flat module exporting `api.tickets`, `api.properties`,
  `api.owners`, `api.buildings`, `api.vendors`, `api.context`, `api.chat`,
  `api.extract`, `api.escalations` is plenty. No code generation, no OpenAPI
  client. Hand-write 9 modules in 30 minutes.
- Mirror the response types from `lib/types.ts` 1:1. The contract is
  *already* camelCase; the backend will alias-generate to camelCase too. No
  case translation in the client.

### M2. Wire the 5 main pages

Replace `import { tickets, properties, ... } from "@/lib/data"` with calls
through `lib/api.ts`. One page at a time:

- `/overview` — `api.tickets.list()`, `api.properties.list()`, KPIs computed client-side.
- `/property/[id]/tickets` — `api.tickets.list({ propertyId })` with the
  unsolved/all/resolved filter applied client-side (or via param).
- `/property/[id]/units` — `api.properties.units(propertyId)`,
  `api.properties.get(propertyId)` for the WEG callout.
- `/property/[id]/context` — `api.context.get(propertyId)` returns the
  *layered* shape; map directly to the 4 `<Layer>` cards.
- `/ticket/[id]` — `api.tickets.get(id)` for everything (proposal, callSession,
  emailBody, vendorJob, memoryProposal embedded). Mutations: `approve`,
  `reject`, `memory/save`, `memory/skip`.

**Consider:**
- Use `loading.tsx` for each route — the ticket detail in particular fetches
  enough that a skeleton is the difference between "feels native" and "feels
  half-broken".
- `lib/data.ts` is a *seed*, not a runtime — once everything reads from the
  API, it becomes dead code. Delete it after `/overview` is green; let the
  TS errors tell you what's still un-ported.
- The new layered context shape (`{layers: {vendor, owner, building, property:
  {raw}}}`) replaces the old client-side-parsed approach. Make sure
  `lib/types.ts`'s context type matches API.md exactly.
- Per the contract, the `Property.contextVersion` field is computed server-side
  (latest version number) and present in `GET /api/properties/:id`. Don't
  re-fetch the version from a separate endpoint just to show "v11" in
  the sidebar footer.

### M3. Memory-decision gating in `/ticket/[id]`

Today the page renders `memoryProposal` whenever it exists. The backend will
only populate it after `vendorJob.completedAt` is set. Two layers of safety:

**Consider:**
- The card should render only when **both** `vendorJob.completedAt` is set
  *and* `memoryProposal.status === 'pending'`. The first guard is the contract;
  the second is the local "operator already decided" rule.
- The "Approve dispatch will…" consequences card has a line that says "memory
  write happens *after* vendor reports completion (not now)". Keep that copy —
  it's the README's whole pinned UX point.
- After memory save: invalidate the ticket query and (if you went TanStack)
  the context query and the versions query. The sidebar's `context.md vN`
  badge needs to bump too.
- `memory/save` 409 should be impossible to hit if the gate is correct. If
  it does fire, the toast from S4 is your last line of defence.

### M4. Port the missing pages from the deprecated draft

The deprecated draft has working (mock-only) pages for:

- `/escalations`
- `/owners`, `/owner/[id]`
- `/buildings`, `/building/[id]`
- `/vendors`, `/vendor/[id]`

All four have backend contracts in API.md. Lift the page files into
`frontendhandoff/apps/web/app/...`, re-skin to match the polished theme, wire
to `lib/api.ts`. None individually is hard; in aggregate they're an evening.

**Consider:**
- These pages use shadcn primitives (`Table`, `Card`, `Badge`) that we already
  copied in S2. No new dependencies.
- The deprecated draft's owner/[id] page has decisions and policies as `string[]`
  / `{date,text}[]` — the contract gives the same shape. Direct paste.
- Vendor detail's `cases[]` is *embedded in the GET /api/vendors/:id response*.
  The deprecated draft fetches `vendorCases` separately — fix that during the
  port; don't keep two queries.
- Sidebar links already exist; the moment a page lands, the click works.
- For the 6 property-tab subroutes that the sidebar links to but we are
  **not** building (`editor`, `versions`, `sources`, `policies`, `calls`),
  add a stub page that renders `<Coming soon>` so the click doesn't 404 in
  the demo.

### M5. Optimistic updates / cache invalidation

For the approve / reject / memory mutations, the user expects the page to
update without a hard refresh.

**Consider:**
- TanStack: `useMutation` with `onSuccess` invalidating `[tickets, id]` and
  `[tickets, list]`. RSC: `revalidatePath('/ticket/' + id)` from the server
  action.
- The approve mutation returns `{ status, vendorJob }` — apply that to the
  local cache so the vendor-job card appears without a refetch.
- After memory save the ticket transitions to `resolved` and the property's
  `contextVersion` bumps. Two invalidations: ticket detail + property detail
  (which the sidebar reads).
- Don't be clever about full optimistic state — the contract has a
  state-machine on the backend. If you set status optimistically and the
  backend 409s, you've lied to the operator.

---

## L — Heavy (≥ half-day, architectural)

### L1. SSE chat client (`/chat` page + streaming)

`POST /api/chat` returns `text/event-stream` with `event: delta` (`{text}`)
and a final `event: done` (`{messageId, appliedTo}`).

**Consider:**
- `EventSource` only supports GET, so use a **fetch + ReadableStream** parser.
  The standard recipe: `fetch().body.getReader()` → decode UTF-8 → split on
  `\n\n` → parse `event:` and `data:` lines. There are tiny libs (`@microsoft/fetch-event-source`)
  if you don't want to write the parser; either is fine.
- Append delta `text` to the in-flight assistant message. Use a stable
  key per message (the eventual `messageId` arrives only on `done`).
- Render a typewriter effect — that's the demo moment. Don't `setState` per
  character; batch in a `requestAnimationFrame` to avoid React thrashing.
- The chat page itself is **not** on main yet. Start from the deprecated
  draft's `/chat/page.tsx` (Hermes layout with side panel of agents) but
  **drop the agents-panel system-prompt viewer** — API.md doesn't expose
  agent prompts. Replace it with a "context being read" panel that consumes
  `appliedTo` from the `done` event.
- Property scoping: pass `propertyId` and `scope: { layer, id }` from the
  chat page based on which property you're focused on (sidebar currently knows
  this; lift it into a context provider).
- Errors mid-stream: if the connection drops, show a "reconnect" affordance,
  not a silent fail. The error envelope only applies to non-2xx responses;
  in-stream errors are a separate event your handler should be ready for.

### L2. Async-poll PDF Extract (`/extract` page)

`POST /api/extract` returns `{ extractionId, status: "processing", pollUrl }`.
Poll `GET /api/extract/:id` until `status === "done"`, then render
`proposedDiffs[]` — each `{ layer, heading, before, after, rationale, confidence }`.

**Consider:**
- Polling cadence: start at 1500ms, back off to 3000ms after the first 5
  attempts. Cap total wait at ~60s; show a "still working…" message after 15.
- Don't poll on a hidden tab. `document.visibilityState` check + pause / resume.
- Each diff renders as a card with `before/after` shown as a tiny diff
  (red strike + green addition). The `confidence` chip drives sort order
  (highest first).
- "Apply selected diffs" — there's **no API** for this yet. Hide that button
  for now or wire it to a no-op with a toast that says "coming next". Don't
  build a fake mutation that lies to the operator.
- The deprecated draft's `/extract` page exists with mock data. Lift the
  layout, drop the mock "facts list" rendering, replace with the
  before/after diff card — different visual idiom.
- Files are PDFs only; multipart upload uses a hidden `<input type="file" accept="application/pdf">`.
  Show file size + page count once available; the backend may report them
  in the polled response.

### L3. Layered context renderer

The current `/property/[id]/context` page reads from mocks (owner, building,
property objects) and constructs the layered view client-side. The new
contract delivers the layered shape pre-split. Re-shape the page to render
the *raw markdown* of each layer rather than synthesising it.

**Consider:**
- Each layer's `raw` is a markdown string. Render with the same markdown
  component the legacy frontend uses (`react-markdown` was in the old
  `frontend/`, copy if needed). Don't try to roll your own parser.
- Empty layers (`{ raw: "" }`) should render as "No facts yet" not as a blank
  card.
- The layer headings (Vendor / Owner / Building / Property) are part of the
  *page*, not the data. The data inside each layer is sub-headings (`### …`)
  rendered by the markdown component.
- Conflicts and cross-layer cascades (Property > Building > Owner > Vendor)
  are an L4 nicety we're not building tonight. Don't surface them until the
  contract does.
- Versions: when L1 of the backend lands, the same renderer powers
  `/property/[id]/context/versions/:version`. Plan for a version-picker
  dropdown but ship with current-only first.

### L4. Telemetry / demo polish (only after L1-L3 work)

If you have time after the streaming + extract loops are green:

- Add a global `<Sparkles>` toast for "Hermes did X" — surfaces invisible
  agent work to the operator and makes the demo feel alive.
- Persist sidebar collapse state to `localStorage`.
- Hot-reload context version badge in the sidebar footer when memory commits
  bump it (already invalidated in M5; just animate the digit change).
- Skeletons everywhere; skeletons during extract polling especially.

---

## What is *not* in scope tonight

- Editor / Versions / Sources / Policies / Calls property tabs — no contract
  yet. Stub pages only.
- Authentication — bearer token plumbing is "omitted for hackathon" per API.md.
- Multi-conversation chat history. `/api/chat` doesn't expose a conversations
  list; treat each chat session as ephemeral until the contract grows.
- Agent-prompt registry / system-prompt viewer — API.md doesn't expose it. The
  deprecated draft showed it; the polish branch correctly hides it.
- Apply-extracted-diffs mutation. No backend route. Don't fake it.
- `/api/v1`-prefixed calls. Backend will move to `/api`. Hardcode `/api`
  everywhere.

---

## Smoke test (end of overnight)

1. `pnpm dev` boots cleanly, no missing-module errors.
2. `/overview` shows real KPI counts (the four cards) sourced from
   `GET /api/tickets`. The pipeline columns split tickets by status.
3. `/property/p1/tickets` filters work; clicking a ticket lands on
   `/ticket/[id]` with a populated proposal card.
4. **Approve dispatch** flips the ticket card to `awaiting_vendor` without
   a refresh; the vendor-job card appears.
5. After the backend is told vendor completed (some dev path), refreshing
   the ticket shows the **memory decision card**. Save commits, sidebar's
   `context.md vN` ticks up.
6. `/escalations` lists `risk=high` tickets only.
7. `/owners` and `/owner/o1` render with policies / decisions blocks.
8. `/vendors/v1` shows the embedded `cases[]` table.
9. `/chat` accepts a message and streams a Hermes reply token-by-token.
10. `/extract` accepts a PDF and renders proposed diffs after polling.

If 1–6 pass, the core demo flow is wired. 7–10 are the breadth.

---

## Failure modes worth pre-mortem'ing

- **Refresh-fights-cache.** TanStack default staleTime is 0; you'll over-fetch.
  Set a 30s staleTime globally and invalidate explicitly on mutations.
- **CamelCase mismatch.** If any backend response leaks snake_case, every
  destructure breaks. Have a single `unwrap` helper that asserts shape via
  Zod (or even just runtime camelCase conversion); fail loud, not silent.
- **SSE buffering.** A reverse proxy in dev (Next.js rewrites or any nginx
  in front) will buffer the stream into one chunk, killing the typewriter
  effect. Test through the actual prod-like setup, not just `pnpm dev` local.
- **Memory card flashing.** If your fetcher races, the memory card might
  flash visible during a stale read while the new ticket-after-completion
  loads. Render-conditional on both `vendorJob.completedAt` *and*
  `memoryProposal.status === 'pending'` to avoid this.
- **Stub-page 404s in the demo.** Sidebar links to 6 unbuilt subroutes. A
  silent 404 mid-demo is the worst kind of bug. Stub them.
- **`lib/data.ts` lingering imports.** Until you delete the file, TS will
  silently let you keep importing the mock. Delete the file once
  `/overview` is wired; let TS errors hunt down the rest.
- **Theme regressions on ported pages.** The polish branch uses
  500/30 opacity tokens; the deprecated draft uses 200/40. A copy-paste leaves
  a visibly off-theme card in dark mode. Search-replace at port time.
