// Multi-agent system seed data — extends BUENA_DATA
window.BUENA_AGENTS = {
  // ----- Vendor directory -----
  vendors: [
    { id: "v1", name: "Heinz GmbH", trade: "HVAC", contact_email: "dispatch@heinz-haustechnik.de", contact_phone: "+49 30 4400 9911", reliability: 0.94, avg_response_min: 38, last_response: "12m ago", active: true, properties: ["p1", "p2"], notes: "24h emergency line — only share when on-call. Service contract.", slaHours: 24, openJobs: 2 },
    { id: "v2", name: "Maler Krüger GmbH", trade: "Paint", contact_email: "info@maler-krueger.de", contact_phone: "+49 30 5512 0388", reliability: 0.81, avg_response_min: 240, last_response: "2d ago", active: true, properties: ["p1", "p3"], notes: "Slow but reliable. Email-only.", slaHours: 48, openJobs: 0 },
    { id: "v3", name: "Schulz & Söhne Elektro", trade: "Electrical", contact_email: "buero@schulz-elektro.de", contact_phone: "+49 30 6677 4221", reliability: 0.88, avg_response_min: 95, last_response: "1h ago", active: true, properties: ["p1", "p2", "p3"], notes: "Family business, prefers SMS for urgent.", slaHours: 24, openJobs: 1 },
    { id: "v4", name: "Klempner Bauer", trade: "Plumbing", contact_email: "kontakt@bauer-klempner.de", contact_phone: "+49 30 8821 4400", reliability: 0.72, avg_response_min: 480, last_response: "5d ago", active: true, properties: ["p1"], notes: "Backup only — flaky. Use Heinz first when overlap.", slaHours: 24, openJobs: 0 },
    { id: "v5", name: "Reinigung Berlin Mitte", trade: "Cleaning", contact_email: "office@rbm-berlin.de", contact_phone: "+49 30 4400 1100", reliability: 0.91, avg_response_min: 60, last_response: "3h ago", active: true, properties: ["p1", "p2", "p3"], notes: "Weekly contract. Ad-hoc within 24h.", slaHours: 24, openJobs: 0 },
    { id: "v6", name: "Fenster & Türen Wagner", trade: "Windows", contact_email: "info@wagner-ft.de", contact_phone: "+49 30 7766 5544", reliability: 0.66, avg_response_min: 720, last_response: "9d ago", active: false, properties: ["p1"], notes: "Blocked: 3 missed appointments in March.", slaHours: 48, openJobs: 0 },
  ],

  // ----- Pipeline tickets (extends what's in BUENA_DATA.tickets with agent state) -----
  pipeline: [
    { id: "t-7831", num: "GAR-118", property: "p1", subject: "Heating cold — Unit 3B", stage: "awaiting_approval", agent: "triage", agentState: "idle", slaHours: 24, ageMin: 2, slaPct: 0.08, raisedBy: "Herr Schmidt · Unit 3B", source: "voice", risk: "medium" },
    { id: "t-7830", num: "GAR-117", property: "p1", subject: "Water leak under kitchen sink", stage: "awaiting_approval", agent: "triage", agentState: "idle", slaHours: 24, ageMin: 18, slaPct: 0.012, raisedBy: "Frau Becker · Unit 1A", source: "email", risk: "low" },
    { id: "t-7820", num: "GAR-108", property: "p1", subject: "Boiler pressure low — Unit 7A", stage: "vendor_coordinating", agent: "vendor", agentState: "awaiting_reply", slaHours: 24, ageMin: 240, slaPct: 0.42, raisedBy: "Herr Klein · Unit 7A", source: "email", risk: "medium", vendor: "Heinz GmbH", lastMsg: "SMS sent 14:02" },
    { id: "t-7819", num: "GAR-107", property: "p1", subject: "Hallway lights flickering 2F", stage: "vendor_coordinating", agent: "vendor", agentState: "slot_proposed", slaHours: 24, ageMin: 480, slaPct: 0.55, raisedBy: "Concierge", source: "slack", risk: "low", vendor: "Schulz & Söhne", lastMsg: "Vendor proposed Tue 14–16" },
    { id: "t-7818", num: "GAR-106", property: "p1", subject: "Intercom — Unit 5C", stage: "tenant_confirming", agent: "tenant", agentState: "awaiting_reply", slaHours: 48, ageMin: 720, slaPct: 0.25, raisedBy: "Frau Wagner · Unit 5C", source: "voice", risk: "low", vendor: "Schulz & Söhne", lastMsg: "Email + SMS sent 09:14" },
    { id: "t-7817", num: "GAR-105", property: "p1", subject: "Kitchen faucet drip — Unit 4A", stage: "tenant_confirming", agent: "tenant", agentState: "awaiting_reply", slaHours: 48, ageMin: 1380, slaPct: 0.48, raisedBy: "Frau Müller · Unit 4A", source: "email", risk: "low", vendor: "Klempner Bauer", lastMsg: "Tenant viewed, no reply" },
    { id: "t-7816", num: "LIN-042", property: "p2", subject: "Cellar door won't lock", stage: "vendor_coordinating", agent: "vendor", agentState: "escalating", slaHours: 24, ageMin: 1340, slaPct: 0.93, raisedBy: "Concierge", source: "slack", risk: "medium", vendor: "Schulz & Söhne", lastMsg: "No reply 22h — escalating" },
    { id: "t-7815", num: "KAS-201", property: "p3", subject: "Lift outage — Tower B", stage: "vendor_coordinating", agent: "vendor", agentState: "awaiting_reply", slaHours: 4, ageMin: 110, slaPct: 0.46, raisedBy: "Concierge", source: "voice", risk: "high", vendor: "Lift-Service Berlin", lastMsg: "SMS sent 15:08" },
    { id: "t-7814", num: "GAR-104", property: "p1", subject: "Tenant complaint: noise 3F", stage: "new", agent: "triage", agentState: "processing", slaHours: 24, ageMin: 4, slaPct: 0.003, raisedBy: "Frau Becker · Unit 1A", source: "email", risk: "low" },
    { id: "t-7813", num: "GAR-103", property: "p1", subject: "Recurring damp patch — Unit 2B", stage: "triaged", agent: "triage", agentState: "idle", slaHours: 24, ageMin: 35, slaPct: 0.024, raisedBy: "Herr Bauer · Unit 2B", source: "voice", risk: "medium" },
    { id: "t-7812", num: "LIN-041", property: "p2", subject: "Bike room light out", stage: "done", agent: "tenant", agentState: "completed", slaHours: 48, ageMin: 2880, slaPct: 1.0, raisedBy: "Concierge", source: "slack", risk: "low", vendor: "Schulz & Söhne", lastMsg: "Resolved · tenant confirmed" },
    { id: "t-7811", num: "KAS-200", property: "p3", subject: "Garage gate sensor", stage: "done", agent: "tenant", agentState: "completed", slaHours: 24, ageMin: 1440, slaPct: 1.0, raisedBy: "Concierge", source: "voice", risk: "low", vendor: "Tor-Service GmbH", lastMsg: "Resolved 23:14 yesterday" },
    { id: "t-7810", num: "GAR-102", property: "p1", subject: "Window won't close — Unit 6B", stage: "escalated", agent: "vendor", agentState: "timeout", slaHours: 24, ageMin: 1620, slaPct: 1.12, raisedBy: "Herr Ostrowski · Unit 6B", source: "email", risk: "medium", vendor: "Wagner (blocked)", lastMsg: "Vendor unresponsive 27h" },
  ],

  // ----- Live event feed -----
  feed: [
    { ts: "16:48:21", icon: "🤖", agent: "triage", text: "Triage proposed dispatch_repair on GAR-118", ticket: "t-7831", level: "info" },
    { ts: "16:47:55", icon: "🔔", agent: "system", text: "Slack ping sent → #property-gartenstrasse for GAR-118", ticket: "t-7831", level: "info" },
    { ts: "16:45:58", icon: "📞", agent: "system", text: "Voice call ended (87s, −18.4dB) — ticket GAR-118 created", ticket: "t-7831", level: "info" },
    { ts: "16:32:11", icon: "✉", agent: "tenant", text: "Tenant agent: confirmation email + SMS to Herr Klein for GAR-108", ticket: "t-7820", level: "info" },
    { ts: "16:29:08", icon: "📩", agent: "vendor", text: "Vendor agent: SMS reply parsed from Heinz GmbH — slot Tue 09–11", ticket: "t-7820", level: "ok" },
    { ts: "16:11:42", icon: "📤", agent: "vendor", text: "Vendor agent: SMS sent to Heinz GmbH for GAR-108", ticket: "t-7820", level: "info" },
    { ts: "15:57:30", icon: "✓", agent: "operator", text: "Maria approved action on GAR-108 → vendor agent activated", ticket: "t-7820", level: "ok" },
    { ts: "15:14:18", icon: "📩", agent: "tenant", text: "Tenant agent: reply parsed from Frau Wagner — confirmed Tue 14–16", ticket: "t-7818", level: "ok" },
    { ts: "14:52:04", icon: "⚠", agent: "vendor", text: "Vendor agent on LIN-042 entering escalation — 22h no reply", ticket: "t-7816", level: "warn" },
    { ts: "14:47:02", icon: "📩", agent: "vendor", text: "Vendor agent: ambiguous reply from Schulz — clarification round 1/2", ticket: "t-7819", level: "warn" },
    { ts: "14:32:51", icon: "🔴", agent: "vendor", text: "GAR-102 SLA breached — moved to escalation queue", ticket: "t-7810", level: "err" },
    { ts: "13:08:19", icon: "✓", agent: "tenant", text: "LIN-041 resolved — tenant confirmation received", ticket: "t-7812", level: "ok" },
  ],

  // ----- Multi-party timeline for hero ticket (GAR-108 / t-7820) -----
  hero: {
    id: "t-7820",
    num: "GAR-108",
    property: "p1",
    subject: "Boiler pressure low — Unit 7A",
    raisedBy: "Herr Klein · Unit 7A",
    raisedByEmail: "h.klein@example.de",
    raisedByPhone: "+49 174 8821 ****",
    vendor: { id: "v1", name: "Heinz GmbH", phone: "+49 30 4400 9911", email: "dispatch@heinz-haustechnik.de" },
    timeline: [
      // tenant lane
      { lane: "tenant", at: "14:01", channel: "email", dir: "in", title: "Inbound email", body: "Dear Sir or Madam,\n\nthe pressure on the boiler in my unit (7A) has been at 0.5 bar since yesterday evening. The heating still works but I'm worried about a fault.\n\nBest regards,\nH. Klein" },
      // system / triage
      { lane: "system", at: "14:01", agent: "triage", title: "Triage agent activated", body: "Classified: HVAC · severity:medium · matched policy P4 (vendor=Heinz GmbH for HVAC)" },
      { lane: "system", at: "14:01", agent: "triage", title: "Proposal drafted", body: "dispatch_repair · vendor=Heinz GmbH · est €165 · under threshold P1 (€200)" },
      { lane: "system", at: "15:57", agent: "operator", title: "Maria approved action", body: "Memory decision: edited (added 'recurring 7A' note → ctx v12)", op: true },
      { lane: "system", at: "15:57", agent: "vendor", title: "Vendor agent activated", body: "Channel selected: SMS (Heinz prefers SMS for urgent). SLA timer 24h started." },
      // vendor lane
      { lane: "vendor", at: "16:11", channel: "sms", dir: "out", title: "SMS to Heinz GmbH", body: "Hi Heinz GmbH, this is Buena Property Mgmt. Maintenance needed: boiler pressure drop, Gartenstraße 42, Unit 7A. When can you come? Please reply today. Ref GAR-108." },
      { lane: "vendor", at: "16:29", channel: "sms", dir: "in", title: "SMS reply Heinz", body: "Hi, Tue 09–11 or Wed 14–16. Klaus" },
      { lane: "system", at: "16:29", agent: "vendor", title: "Reply parsed (conf 0.94)", body: "Slot 1: 2026-04-29 09:00–11:00 · Slot 2: 2026-04-30 14:00–16:00 · Handoff to tenant agent." },
      // tenant agent
      { lane: "system", at: "16:32", agent: "tenant", title: "Tenant agent activated", body: "Channel: email + SMS (Klein has both on file). SLA timer 48h started." },
      { lane: "tenant", at: "16:32", channel: "email", dir: "out", title: "Email to Mr Klein", body: "Dear Mr Klein,\n\nthank you for reporting this. Heinz GmbH has offered two appointment slots: Tue 29 Apr 09–11 or Wed 30 Apr 14–16. Please reply with \"Slot 1\" or \"Slot 2\".\n\nBest regards,\nBuena Property Management\nRef GAR-108" },
      { lane: "tenant", at: "16:32", channel: "sms", dir: "out", title: "SMS to Mr Klein", body: "Buena: Heinz GmbH offers Tue 09–11 or Wed 14–16. Reply with \"1\" or \"2\". Ref GAR-108." },
      // future / pending
      { lane: "tenant", at: "—", channel: "email", dir: "in", title: "Awaiting reply…", body: "SLA: 47h 32m remaining", pending: true },
    ],
  },

  // ----- Agent state inspector data -----
  agentStates: {
    "t-7820": [
      { agent: "triage", state: "completed", input_tokens: 2841, output_tokens: 612, model: "haiku-4.5", elapsed_ms: 412, finished: "14:01:33" },
      { agent: "vendor", state: "completed", input_tokens: 1402, output_tokens: 188, model: "haiku-4.5", elapsed_ms: 287, finished: "16:29:14", retries: 0, clarifications: 0 },
      { agent: "tenant", state: "awaiting_reply", input_tokens: 1844, output_tokens: 372, model: "haiku-4.5", elapsed_ms: 318, finished: "16:32:01", deadline: "2026-04-27 16:32 (+48h)", remaining: "47h 32m", retries: 0 },
    ],
    "t-7831": [
      { agent: "triage", state: "completed", input_tokens: 2902, output_tokens: 588, model: "haiku-4.5", elapsed_ms: 397, finished: "16:45:59" },
      { agent: "vendor", state: "blocked_pending_approval", note: "Awaiting operator approval before activation" },
      { agent: "tenant", state: "blocked_pending_approval", note: "Awaiting vendor agent" },
    ],
  },

  // ----- Escalation queue -----
  escalations: [
    { id: "t-7810", num: "GAR-102", property: "p1", subject: "Window won't close — Unit 6B", reason: "Vendor SLA breach (27h, no reply)", agent: "vendor", vendor: "Wagner (blocked)", since: "3h ago", severity: "high" },
    { id: "t-7816", num: "LIN-042", property: "p2", subject: "Cellar door won't lock", reason: "Vendor SLA at 93% — preempting timeout", agent: "vendor", vendor: "Schulz & Söhne", since: "now", severity: "amber" },
    { id: "t-7805", num: "GAR-101", property: "p1", subject: "Mailbox lock — Unit 1A", reason: "Tenant non-response · 2 reminders sent", agent: "tenant", since: "1d ago", severity: "amber" },
    { id: "t-7799", num: "KAS-198", property: "p3", subject: "Heating cold — Tower A 4F", reason: "Vendor reply ambiguous · 2/2 clarifications used", agent: "vendor", vendor: "Heinz GmbH", since: "5h ago", severity: "amber" },
  ],

  // ----- Tenant unified comms thread (for tenant comms screen) -----
  tenantThread: {
    ticket: "GAR-108",
    tenant: "Mr Klein · Unit 7A",
    email: "h.klein@example.de",
    phone: "+49 174 8821 ****",
    messages: [
      { ts: "Mon 14:01", channel: "email", dir: "in", subject: "Boiler pressure", body: "Pressure has been at 0.5 bar since yesterday…" },
      { ts: "Mon 14:02", channel: "email", dir: "out", agent: "system", subject: "Re: Boiler pressure", body: "Thanks for the report — we're on it. You'll hear back within 24h. Ref GAR-108." },
      { ts: "Mon 16:32", channel: "email", dir: "out", agent: "tenant", subject: "Heinz GmbH appointment — please choose", body: "Tue 09–11 or Wed 14–16. Please reply with \"1\" or \"2\"." },
      { ts: "Mon 16:32", channel: "sms", dir: "out", agent: "tenant", body: "Buena: Slot Tue 09–11 or Wed 14–16. Reply \"1\" or \"2\"." },
      { ts: "Mon 17:48", channel: "sms", dir: "in", body: "1" },
      { ts: "Mon 17:48", channel: "email", dir: "out", agent: "tenant", subject: "Confirmed — Slot 1", body: "Confirmed: Tue 29 Apr 09–11, Heinz GmbH. Best, Buena." },
    ],
  },
};
