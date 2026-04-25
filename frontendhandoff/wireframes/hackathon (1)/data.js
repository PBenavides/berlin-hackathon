// Seed data for the prototype
window.BUENA_DATA = {
  operator: { name: "Maria Lehmann", email: "maria@buena.io", initials: "ML" },
  properties: [
    { id: "p1", slug: "gartenstrasse-42", name: "Gartenstraße 42", city: "Berlin-Mitte", units: 14, version: 11, openTickets: 3, suggestions: 2, phone: "+49 30 5550 1142" },
    { id: "p2", slug: "linienstrasse-88", name: "Linienstraße 88", city: "Berlin-Mitte", units: 9, version: 7, openTickets: 1, suggestions: 0, phone: "+49 30 5550 1188" },
    { id: "p3", slug: "kastanienallee-12", name: "Kastanienallee 12", city: "Prenzlauer Berg", units: 22, version: 18, openTickets: 5, suggestions: 1, phone: "+49 30 5550 1112" }
  ],
  tickets: [
    { id: "t-7831", num: "GAR-118", property: "p1", source: "voice", status: "proposed", risk: "medium", subject: "Heating cold — Unit 3B", raisedBy: "Mr Schmidt · Unit 3B", excerpt: "Heating cold since Tuesday evening, radiator in living room won't warm up.", createdAt: "2m ago", confidence: 0.86, callId: "cs-9921", actionStatus: "pending", memoryStatus: "pending" },
    { id: "t-7830", num: "GAR-117", property: "p1", source: "email", status: "proposed", risk: "low", subject: "Water leak under kitchen sink", raisedBy: "Frau Becker · Unit 1A", excerpt: "Slow drip from the U-bend, towel placed underneath. Photos attached.", createdAt: "18m ago", confidence: 0.92, actionStatus: "pending", memoryStatus: "pending" },
    { id: "t-7829", num: "GAR-116", property: "p1", source: "slack", status: "open", risk: "low", subject: "Lobby door closer broken", raisedBy: "Concierge · door-issues", excerpt: "Door slams shut, residents complaining. Closer arm appears bent.", createdAt: "47m ago" },
    { id: "t-7828", num: "GAR-115", property: "p1", source: "manual", status: "resolved", risk: "low", subject: "Hallway light replacement scheduled", raisedBy: "Maria Lehmann", excerpt: "2nd floor hallway, both fixtures. Bulbs ordered.", createdAt: "3h ago", actionStatus: "approved", memoryStatus: "approved" },
    { id: "t-7827", num: "GAR-114", property: "p1", source: "voice", status: "resolved", risk: "medium", subject: "Intercom not working — Unit 5C", raisedBy: "Frau Wagner · Unit 5C", excerpt: "Visitors can't ring up. Confirmed wiring fault, technician dispatched.", createdAt: "Yesterday", callId: "cs-9918", actionStatus: "approved", memoryStatus: "approved" },
    { id: "t-7826", num: "GAR-113", property: "p1", source: "email", status: "resolved", risk: "low", subject: "Heating maintenance — Unit 7A", raisedBy: "Herr Klein · Unit 7A", excerpt: "Radiator bleed required. €145 quote approved.", createdAt: "Yesterday", actionStatus: "approved", memoryStatus: "edited" },
    { id: "t-7825", num: "GAR-112", property: "p1", source: "voice", status: "resolved", risk: "low", subject: "Heating cold — Unit 2B", raisedBy: "Herr Bauer · Unit 2B", excerpt: "Bleed + check thermostat. €165 invoice from Heinz GmbH.", createdAt: "2d ago", actionStatus: "approved", memoryStatus: "approved" },
    { id: "t-7824", num: "GAR-111", property: "p1", source: "manual", status: "resolved", risk: "low", subject: "Heating cold — Unit 4A", raisedBy: "Frau Müller · Unit 4A", excerpt: "Boiler restart + valve replacement. €198.", createdAt: "3d ago", actionStatus: "edited", memoryStatus: "approved" },
    { id: "t-7823", num: "GAR-110", property: "p1", source: "email", status: "resolved", risk: "low", subject: "Heating cold — Unit 6B", raisedBy: "Herr Ostrowski · Unit 6B", excerpt: "Radiator valve seized. €179. Heinz GmbH.", createdAt: "5d ago", actionStatus: "approved", memoryStatus: "approved" },
    { id: "t-7822", num: "GAR-109", property: "p1", source: "slack", status: "rejected", risk: "high", subject: "Quote: balcony repaint €4,200", raisedBy: "Maler Krüger GmbH", excerpt: "Above approval threshold; needs owner board review.", createdAt: "6d ago", actionStatus: "rejected", memoryStatus: "rejected" }
  ],
  contextV11: `---
property_id: p1
version: 11
updated_at: 2026-04-24T16:42:00+02:00
updated_by: maria@buena.io
---

## Basics

**Address:** Gartenstraße 42, 10115 Berlin-Mitte
**Built:** 1908, restored 2003
**Units:** 14 (12 residential, 2 commercial)
**Owner:** WEG Gartenstraße 42 (Verwaltungsbeirat: Herr Klein)
**Heating:** Central gas, replaced 2023 (Viessmann Vitodens 200-W). Service contract: Heinz GmbH.
**Inbound phone:** +49 30 5550 1142 → routes to Buena voice agent.

## Tenants

- **Unit 1A** — Frau Becker, since 2014. Quiet, prefers email.
- **Unit 2B** — Herr Bauer, since 2019. Hard of hearing, calls instead of writing.
- **Unit 3B** — Herr Schmidt, 68, since 2002. Mobility-limited. **Always confirm callback in writing.**
- **Unit 4A** — Frau Müller, since 2021. Two children.
- **Unit 5C** — Frau Wagner, since 2017. Speaks Polish + German.
- **Unit 6B** — Herr Ostrowski, since 2020.
- **Unit 7A** — Herr Klein, since 2008. Verwaltungsbeirat (board representative).

## Known issues

- Radiator valves on north-facing units (2B, 3B, 4A, 6B) are original 1990s — known to seize.
  Heinz GmbH replaces in batches. Typical cost €150–€200 per unit, parts + 1h labor.
- Lobby door closer was replaced Jan 2026 but model is under-spec for the door weight.
  Replacement scheduled Q2.
- Cellar window seals leak in heavy rain — patched, full replacement in 2027 budget.

## Policies

- **Approval threshold:** €200 — repairs at or below this auto-suggest "approve" with reasoning,
  but still require human sign-off (MVP).
- **Tone:** formal Sie-Form in German, factual, no apologies for things outside our control.
- **Forbidden:** never commit to a fixed callback time; always say "innerhalb von 24 Stunden".
- **Vendor preference:** Heinz GmbH for HVAC, Maler Krüger for paint, Schulz Elektro for electrical.

## Source documents

- \`docs/wartungsvertrag-heinz-2024.pdf\` (HVAC service contract)
- \`docs/teilungserklaerung.pdf\` (deed of partition)
- \`erp://yardi/property/GAR42\` (current rent roll)`,
  contextV10: `---
property_id: p1
version: 10
updated_at: 2026-04-22T11:15:00+02:00
updated_by: maria@buena.io
---

## Basics

**Address:** Gartenstraße 42, 10115 Berlin-Mitte
**Built:** 1908, restored 2003
**Units:** 14 (12 residential, 2 commercial)
**Owner:** WEG Gartenstraße 42 (Verwaltungsbeirat: Herr Klein)
**Heating:** Central gas, replaced 2023 (Viessmann Vitodens 200-W). Service contract: Heinz GmbH.

## Tenants

- **Unit 1A** — Frau Becker, since 2014. Quiet, prefers email.
- **Unit 2B** — Herr Bauer, since 2019. Hard of hearing, calls instead of writing.
- **Unit 3B** — Herr Schmidt, 68, since 2002. Mobility-limited.
- **Unit 4A** — Frau Müller, since 2021. Two children.
- **Unit 5C** — Frau Wagner, since 2017. Speaks Polish + German.
- **Unit 6B** — Herr Ostrowski, since 2020.
- **Unit 7A** — Herr Klein, since 2008. Verwaltungsbeirat (board representative).

## Known issues

- Radiator valves on north-facing units are original 1990s.
- Lobby door closer was replaced Jan 2026 but model is under-spec.

## Policies

- **Approval threshold:** €500.
- **Tone:** formal Sie-Form in German, factual.
- **Vendor preference:** Heinz GmbH for HVAC.

## Source documents

- \`docs/wartungsvertrag-heinz-2024.pdf\`
- \`docs/teilungserklaerung.pdf\``,
  versions: [
    { v: 11, by: "maria@buena.io", at: "2026-04-24 16:42", reason: "Tightened approval threshold to €200, added Unit 3B mobility note, expanded valve cost guidance." },
    { v: 10, by: "hermes", at: "2026-04-22 11:15", reason: "Accepted Hermes suggestion: add note about 1A email preference.", flagHermes: true },
    { v: 9, by: "maria@buena.io", at: "2026-04-19 09:08", reason: "Recorded heating contract with Heinz GmbH." },
    { v: 8, by: "ben@buena.io", at: "2026-04-15 14:32", reason: "Added 6B and 7A tenant entries during Maria's leave." },
    { v: 7, by: "maria@buena.io", at: "2026-04-09 10:55", reason: "Annual review — refreshed source documents list." },
    { v: 6, by: "system", at: "2026-04-01 00:00", reason: "Auto-imported rent roll from Yardi." },
    { v: 5, by: "maria@buena.io", at: "2026-03-21 17:14", reason: "Lobby door closer replaced; tracking under-spec issue." },
    { v: 4, by: "maria@buena.io", at: "2026-03-12 11:20", reason: "Cellar window patch noted; full replacement scheduled 2027." },
    { v: 3, by: "maria@buena.io", at: "2026-02-28 09:00", reason: "Tone policy: formal Sie-Form." },
    { v: 2, by: "maria@buena.io", at: "2026-02-04 16:48", reason: "Initial tenant roster populated." },
    { v: 1, by: "system", at: "2026-01-15 08:00", reason: "Property onboarded." }
  ],
  policies: [
    { id: "pol-1", title: "Approval threshold €200", priority: 10, ruleText: "Repairs at or below €200 may be auto-suggested for approve, but still require human sign-off (MVP).", active: true, updated: "2d ago" },
    { id: "pol-2", title: "Tone: formal Sie-Form (DE)", priority: 8, ruleText: "Always reply in formal German Sie-Form. Factual tone. Never apologize for things outside our control.", active: true, updated: "2mo ago" },
    { id: "pol-3", title: "Forbidden: fixed callback times", priority: 9, ruleText: "Never commit to a fixed callback time. Always use \"innerhalb von 24 Stunden\" instead.", active: true, updated: "2mo ago" },
    { id: "pol-4", title: "Preferred vendors by trade", priority: 6, ruleText: "Use Heinz GmbH for HVAC, Maler Krüger for paint, Schulz Elektro for electrical.", active: true, updated: "1mo ago" },
    { id: "pol-5", title: "Mobility-limited tenants: written confirmation", priority: 9, ruleText: "Tenants flagged mobility-limited always receive a written confirmation in addition to any phone callback.", active: true, updated: "3w ago" }
  ],
  sources: [
    { id: "s1", kind: "pdf", uri: "docs/wartungsvertrag-heinz-2024.pdf", status: "allowed", approvedBy: "maria@buena.io", approvedAt: "2026-01-20" },
    { id: "s2", kind: "pdf", uri: "docs/teilungserklaerung.pdf", status: "allowed", approvedBy: "maria@buena.io", approvedAt: "2026-01-15" },
    { id: "s3", kind: "erp", uri: "erp://yardi/property/GAR42", status: "allowed", approvedBy: "system", approvedAt: "2026-04-01" },
    { id: "s4", kind: "email", uri: "imap://hausverwaltung@buena.io/INBOX/GAR42", status: "pending", approvedBy: null, approvedAt: null },
    { id: "s5", kind: "pdf", uri: "docs/owner-meeting-2026-q1.pdf", status: "allowed", approvedBy: "maria@buena.io", approvedAt: "2026-03-30" },
    { id: "s6", kind: "voice", uri: "livekit://+493055501142", status: "allowed", approvedBy: "maria@buena.io", approvedAt: "2026-04-10" }
  ],
  suggestions: [
    {
      id: "sg-1",
      kind: "policy_suggestion",
      title: "Auto-approve heating repairs under €200 from preferred vendor",
      message: "4 of the last 10 heating tickets at Gartenstraße 42 were approved at €145–€198 from Heinz GmbH. Consider auto-approving identical patterns to save Maria ~6 minutes per ticket.",
      proposed: { kind: "auto_approval", scope: "heating_repair", max_eur: 200, vendor: "Heinz GmbH" },
      evidence: [
        { ticket: "GAR-117", reason: "€145, Heinz GmbH" },
        { ticket: "GAR-114", reason: "€165, Heinz GmbH" },
        { ticket: "GAR-111", reason: "€198, Heinz GmbH" },
        { ticket: "GAR-110", reason: "€179, Heinz GmbH" }
      ],
      confidence: 0.81,
      created: "12m ago"
    },
    {
      id: "sg-2",
      kind: "context_addition",
      title: "Add note: 'Heinz GmbH 24h emergency line'",
      message: "Three tenants in the last 30 days asked Maria for an after-hours number. Heinz GmbH's emergency line +49 30 4400 9911 was given each time.",
      proposedHeading: "Known issues",
      proposedMd: "- **HVAC emergency:** Heinz GmbH 24h line +49 30 4400 9911 (do not give out by default — only when on-call hours).",
      evidence: [
        { ticket: "GAR-104", reason: "Tenant asked at 22:14" },
        { ticket: "GAR-098", reason: "Tenant asked Sunday morning" },
        { ticket: "GAR-091", reason: "Voicemail at 19:30" }
      ],
      confidence: 0.74,
      created: "1h ago"
    },
    {
      id: "sg-3",
      kind: "context_correction",
      title: "Correct vendor: Schulz Elektro → Schulz & Söhne Elektro",
      message: "Last 2 invoices were issued by 'Schulz & Söhne Elektro GmbH'. The shorter form in context.md may cause invoice-matching confusion.",
      target: "Policies",
      proposedMd: "- **Vendor preference:** Heinz GmbH for HVAC, Maler Krüger for paint, Schulz & Söhne Elektro GmbH for electrical.",
      evidence: [
        { ticket: "GAR-109", reason: "Invoice header 'Schulz & Söhne'" },
        { ticket: "GAR-102", reason: "Invoice header 'Schulz & Söhne'" }
      ],
      confidence: 0.92,
      created: "3h ago"
    }
  ],
  audit: [
    { ts: "16:48:21", actor: "hermes", action: "hermes.suggest", entity: "sg-1", meta: "policy_suggestion · evidence: 4 tickets" },
    { ts: "16:48:20", actor: "hermes", action: "hermes.run", entity: "p1", meta: "K=20, runtime 412ms" },
    { ts: "16:46:02", actor: "system", action: "proposal.create", entity: "pr-7831", meta: "ticket=t-7831 ctx_v=11" },
    { ts: "16:45:58", actor: "system", action: "ticket.create", entity: "t-7831", meta: "source=voice call=cs-9921" },
    { ts: "16:45:54", actor: "system", action: "call.end", entity: "cs-9921", meta: "duration=87s noise_reduction=18.4dB" },
    { ts: "16:44:27", actor: "system", action: "call.start", entity: "cs-9921", meta: "from=+49 174 8821 ... unit=3B" },
    { ts: "16:42:08", actor: "maria@buena.io", action: "context.write", entity: "p1@v11", meta: "approved threshold change €500→€200" },
    { ts: "16:42:08", actor: "maria@buena.io", action: "policy.update", entity: "pol-1", meta: "max_eur 500→200" },
    { ts: "16:30:11", actor: "maria@buena.io", action: "proposal.approve", entity: "pr-7826", meta: "final_action: dispatch Heinz GmbH €145" },
    { ts: "16:29:55", actor: "maria@buena.io", action: "context.read", entity: "p1@v10", meta: "via ticket detail" },
    { ts: "16:18:02", actor: "system", action: "ticket.create", entity: "t-7830", meta: "source=email" },
    { ts: "15:51:34", actor: "ben@buena.io", action: "context.read", entity: "p1@v10", meta: "browse" },
    { ts: "11:15:00", actor: "hermes", action: "hermes.accept", entity: "sg-prev", meta: "applied as ctx v10" },
    { ts: "11:14:58", actor: "maria@buena.io", action: "hermes.accept", entity: "sg-prev", meta: "auto-approval Schulz" },
    { ts: "09:08:11", actor: "maria@buena.io", action: "context.write", entity: "p1@v9", meta: "Heinz GmbH service contract recorded" }
  ],
  callSession: {
    id: "cs-9921",
    callerPhone: "+49 174 8821 ****",
    startedAt: "16:44:27",
    duration: "1m 27s",
    noiseReduction: 18.4,
    summary: "Tenant Herr Schmidt (Unit 3B) reports cold radiator in living room since Tuesday evening; requests visit.",
    transcript: [
      { spk: "agent", t: "0:00", text: "Buena Hausverwaltung, guten Tag. Wie kann ich Ihnen helfen?", en: "Good day, Buena property management. How can I help?" },
      { spk: "tenant", t: "0:04", text: "Ja hallo, hier Schmidt, Gartenstraße 42. Meine Heizung ist kalt.", en: "Yes hello, Schmidt here, Gartenstraße 42. My heating is cold." },
      { spk: "agent", t: "0:11", text: "Guten Tag Herr Schmidt. In welcher Wohneinheit wohnen Sie?", en: "Good day Mr Schmidt. Which unit do you live in?" },
      { spk: "tenant", t: "0:16", text: "3B, im zweiten Stock.", en: "3B, on the second floor." },
      { spk: "agent", t: "0:19", text: "Danke. Seit wann ist die Heizung kalt?", en: "Thank you. Since when is the heating cold?" },
      { spk: "tenant", t: "0:24", text: "Seit Dienstagabend. Der Heizkörper im Wohnzimmer wird nicht warm. Die Küche ist okay.", en: "Since Tuesday evening. The radiator in the living room won't warm up. The kitchen is okay." },
      { spk: "agent", t: "0:35", text: "Verstanden. Ich erstelle einen Vorgang. Sie erhalten in Kürze eine schriftliche Bestätigung. Innerhalb von 24 Stunden meldet sich ein Techniker.", en: "Understood. I'll log a ticket. You'll receive a written confirmation shortly. A technician will be in touch within 24 hours." },
      { spk: "tenant", t: "0:48", text: "Gut, danke schön.", en: "Good, thank you very much." },
      { spk: "agent", t: "0:51", text: "Vielen Dank für Ihren Anruf. Auf Wiederhören.", en: "Thank you for your call. Goodbye." }
    ]
  },
  proposal: {
    id: "pr-7831",
    contextVersion: 11,
    contextVersionId: "ctx-p1-v11",
    confidence: 0.86,
    actionStatus: "pending",
    memoryStatus: "pending",
    memoryDraft: "## Known issues\n- Unit 3B radiator valve replaced 2026-04-25 by Heinz GmbH (€175). Recurrence — 4th unit on north-facing column this quarter.",
    proposedAction: {
      type: "dispatch_repair",
      vendor: "Heinz GmbH",
      trade: "HVAC",
      target: "Unit 3B radiator (living room)",
      estimate_eur: 175,
      eta_hours: 24,
      tenant_communication: "Send written confirmation in German (Sie-Form) acknowledging receipt and 24h technician window."
    },
    reasoning: "Pattern matches 4 prior approvals at this property (GAR-117, GAR-114, GAR-111, GAR-110), all heating valve repairs by Heinz GmbH at €145–€198. Tenant is in Unit 3B (north-facing, on the known-issue list). Mobility-limited flag present → written confirmation required (policy P5). Estimated cost €175 falls under approval threshold of €200 (policy P1).",
    citations: [
      { heading: "Tenants", excerpt: "Unit 3B — Herr Schmidt, 68, since 2002. Mobility-limited. Always confirm callback in writing.", chunk: "ctx-3b" },
      { heading: "Known issues", excerpt: "Radiator valves on north-facing units (2B, 3B, 4A, 6B) are original 1990s — known to seize. Heinz GmbH replaces in batches. Typical cost €150–€200.", chunk: "ctx-issues" },
      { heading: "Policies", excerpt: "Approval threshold: €200 — repairs at or below this auto-suggest approve, still require human sign-off.", chunk: "ctx-pol-1" },
      { heading: "Policies", excerpt: "Vendor preference: Heinz GmbH for HVAC.", chunk: "ctx-pol-4" }
    ],
    policyEval: { allowed: true, requiresHumanApproval: true, violations: [] }
  }
};
