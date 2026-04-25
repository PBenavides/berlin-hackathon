# Frontend Documentation

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui  
**Port:** 3000  
**Backend:** `http://localhost:8000/api/v1`

---

## Architecture

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout – nav + sidebar
│   ├── globals.css             # CSS variables, base styles
│   ├── page.tsx                # / → Properties dashboard
│   ├── tickets/
│   │   ├── page.tsx            # /tickets → All tickets list
│   │   └── [id]/page.tsx       # /tickets/:id → Ticket detail + review
│   ├── properties/
│   │   └── [id]/
│   │       ├── tickets/page.tsx   # /properties/:id/tickets
│   │       └── context/page.tsx   # /properties/:id/context
│   └── audit/
│       └── page.tsx            # /audit → Audit log
├── components/                 # Shared UI components
├── package.json
├── tailwind.config.ts
└── Dockerfile
```

Data fetching is done via **Next.js Server Components** using native `fetch` with `cache: "no-store"` — no client-side HTTP library.

---

## Pages

### `/` — Properties Dashboard
Lists all properties with summary stats (open tickets, last activity). Entry point for navigating to a property's tickets or context.

### `/tickets` — All Tickets
Cross-property ticket list. Filterable by status (open, proposed, approved, rejected, resolved) and risk level. Each row links to the ticket detail page.

### `/tickets/:id` — Ticket Detail & Review
The main human-in-the-loop page:
- Displays ticket metadata, description, risk level
- Shows the AI-generated `AgentProposal` (action draft + context update draft)
- **Two-stage decision interface** — action and memory decisions are handled independently via `ProposalReview` component
- Renders cited context chunks inline

### `/properties/:id/tickets` — Property-Scoped Tickets
Same as `/tickets` but filtered to a single property. Includes a header with property info.

### `/properties/:id/context` — Context Editor
- View the current versioned markdown context for a property
- Edit and save (creates a new `ContextVersion`)
- Browse version history
- Compare two versions via `DiffViewer`

### `/audit` — Audit Log
Read-only table of all `AuditLog` entries. Filterable by entity type and action. Shows before/after JSON snapshots for state changes.

---

## Key Components (`app/components/`)

| Component | Purpose |
|---|---|
| `PropertySidebar.tsx` | Left navigation listing all properties; highlights active route |
| `ProposalReview.tsx` | Two-panel decision UI — action approval and memory approval rendered as distinct cards with loading states |
| `TicketFilterTabs.tsx` | Tab strip to filter tickets by status |
| `DiffViewer.tsx` | Renders unified diff output with syntax highlighting for context version comparisons |
| `MarkdownRenderer.tsx` | Renders property context markdown with citation anchor support |

---

## Backend Communication

All data fetching happens server-side (RSC). Pattern used throughout:

```ts
const res = await fetch(`${BACKEND_URL}/api/v1/tickets/${id}`, {
  cache: "no-store",
});
const data = await res.json();
```

`BACKEND_URL` defaults to `http://localhost:8000` (configured via env var or fallback).

Mutations (form submissions, decision posts) are handled via Next.js **Server Actions** or route handler `POST` calls — no client-state libraries (no Zustand, no React Query).

---

## Routing & Navigation

Navigation is file-system based (Next.js App Router). The root `layout.tsx` renders:
- Top nav bar (app name, global links)
- `PropertySidebar` on the left
- Main content slot on the right

Active route highlighting in the sidebar uses `usePathname()`.

---

## Styling

- **Tailwind CSS** for all layout and spacing
- **CSS custom properties** in `globals.css` for brand colors (`--brand-600`, etc.)
- **shadcn/ui** components (Button, Badge, Card, Tabs) for consistent UI primitives
- **Lucide React** for icons

---

## Running Locally

```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:3000
```

Requires the backend to be running at port 8000. See `backend/docs/README.md`.

Or from the repo root (starts both):
```bash
docker compose up --build
```
