# Buena Context Engine — Hi-Fi Hackathon Build

Next.js 15 + shadcn/ui monorepo. Mock data only (no backend wiring).

## Quick start

```bash
pnpm install
pnpm dev
# → http://localhost:3000
```

## Structure

```
buena-context-engine/
├─ apps/
│  └─ web/                     # Next.js 15 app (App Router, Tailwind v4)
│     ├─ app/
│     │  ├─ layout.tsx
│     │  ├─ page.tsx            # → /overview
│     │  ├─ overview/
│     │  ├─ escalations/
│     │  ├─ properties/
│     │  ├─ property/[id]/      # property shell with tabs
│     │  ├─ ticket/[id]/
│     │  ├─ owners/, owner/[id]/
│     │  ├─ buildings/, building/[id]/
│     │  ├─ vendors/, vendor/[id]/
│     │  ├─ extract/            # PDF extract
│     │  └─ chat/               # Hermes chat with system prompts
│     ├─ components/            # local components (sidebar, layer-badge, etc.)
│     └─ lib/
│        ├─ data.ts             # seed properties, tickets, units, owners
│        ├─ agents.ts           # Hermes + sub-agent system prompts
│        └─ types.ts
├─ packages/
│  └─ ui/                       # shadcn primitives (re-exported via @repo/ui)
│     └─ src/components/
│        ├─ button.tsx, card.tsx, badge.tsx, table.tsx, tabs.tsx, ...
└─ pnpm-workspace.yaml
```

## What's in the box

- **Overview** — kanban + KPI row + live feed
- **Property shell** — nested tabs (Tickets · Units & Owners · Context · Editor · Versions · Sources · Policies · Calls · Audit)
- **Ticket detail** — proposal-first, transcript collapsed, **memory decision fixed** (only after vendor closes job)
- **Knowledge layers** — Vendors, Owners, Buildings (with cascade context)
- **Tools** — PDF Extract, Hermes Chat (system prompts visible)
- **Escalations** — high-risk queue

## Memory decision flow (fixed)

```
Approve dispatch  →  SMS Heinz · Email Schmidt · SLA timer starts
                          ↓
                   [vendor works]
                          ↓
                   Vendor reports completion + final cost
                          ↓
                   ★ Memory decision appears HERE
                     "Save 'Unit 3B valve replaced 2026-04-25 by Heinz GmbH €175'
                      to context.md v12?"  [Save] [Edit] [Skip]
```

## System prompts

See `apps/web/lib/agents.ts`. Each agent has a versioned prompt:
- `hermesPrompt` — orchestrator
- `triagePrompt` — classifies inbound
- `tenantCommsPrompt` — Sie-Form, mobility-aware drafting
- `vendorCommsPrompt` — SMS/email negotiation, SLA
- `memoryPrompt` — context.md diff proposal

These are surfaced in `/chat` in a side panel for transparency.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript 5
- Tailwind v4 · shadcn/ui (preset `b5d3AD0yW`)
- pnpm workspace

## Init command used

```bash
pnpm dlx shadcn@latest init --preset b5d3AD0yW --template next --monorepo --pointer
```
