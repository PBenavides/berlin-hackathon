/* global React, Stories, ApiStrip, Topbar, Link, go, D, RiskBadge, SourceBadge, StatusBadge, useState, useEffect, useMemo, Fragment */

const A = window.BUENA_AGENTS;

// ============================================================
// Pipeline / system overview (default landing)
// ============================================================
const STAGES = [
  { id: "new", label: "1. New", desc: "Inbound landed — agent hasn't looked yet" },
  { id: "triaged", label: "2. Triaged", desc: "Classified · low-risk · agent will draft a proposal" },
  { id: "awaiting_approval", label: "3. Awaiting approval", desc: "Proposal drafted · waiting on YOU" },
  { id: "vendor_coordinating", label: "4. Vendor coordinating", desc: "Vendor agent ↔ vendor (autopilot)" },
  { id: "tenant_confirming", label: "5. Tenant confirming", desc: "Tenant agent ↔ tenant (autopilot)" },
  { id: "done", label: "6. Done", desc: "Resolved, confirmed, or rejected" },
];

const slaPctClass = (p) => p >= 0.95 ? "red" : p >= 0.5 ? "amber" : "green";
const slaDot = (p) => p >= 0.95 ? "🔴" : p >= 0.5 ? "🟡" : "🟢";
const stageColor = (s) => ({
  new: "#9CA3AF", triaged: "#7B8794", awaiting_approval: "#F1B86B",
  vendor_coordinating: "#6FB8FF", tenant_confirming: "#A78BFA",
  done: "#79D89C", escalated: "#F08D8D"
}[s] || "#9CA3AF");

const PipelineCard = ({ t }) => {
  const prop = D.properties.find(p => p.id === t.property);
  return (
    <div className="pipe-card" onClick={() => go(`/ticket/${t.id}`)}>
      <div className="pipe-card-head">
        <span className="mono pipe-num">{t.num}</span>
        <span className={`sla-dot sla-${slaPctClass(t.slaPct)}`} title={`SLA ${Math.round(t.slaPct * 100)}%`}>{slaDot(t.slaPct)}</span>
      </div>
      <div className="pipe-card-subj">{t.subject}</div>
      <div className="pipe-card-meta">
        <span className="muted">{prop?.name?.split(" ")[0] || t.property}</span>
        <span className="dot-sep">·</span>
        <SourceBadge s={t.source} />
        {t.risk === "high" && <RiskBadge r={t.risk} />}
      </div>
      {t.vendor && (
        <div className="pipe-card-vendor mono">{t.agentState === "escalating" ? "⚠" : t.agentState === "slot_proposed" ? "📅" : "📤"} {t.vendor}</div>
      )}
      {t.lastMsg && <div className="pipe-card-last">{t.lastMsg}</div>}
      <div className="pipe-card-foot">
        <span className="mono dim" style={{ fontSize: 10 }}>age {Math.floor(t.ageMin/60) > 0 ? `${Math.floor(t.ageMin/60)}h` : `${t.ageMin}m`}</span>
        <span className={`agent-pill agent-${t.agent}`}>{t.agent}</span>
      </div>
    </div>
  );
};

const PipelineKanban = ({ tickets }) => (
  <div className="kanban">
    {STAGES.map(stage => {
      const cards = tickets.filter(t => t.stage === stage.id);
      return (
        <div key={stage.id} className="kanban-col">
          <div className="kanban-col-head" style={{ borderTopColor: stageColor(stage.id) }}>
            <div className="kanban-col-title">{stage.label}</div>
            <div className="kanban-col-count">{cards.length}</div>
          </div>
          <div className="kanban-col-desc">{stage.desc}</div>
          <div className="kanban-col-body">
            {cards.length === 0 && <div className="kanban-empty">—</div>}
            {cards.map(t => <PipelineCard key={t.id} t={t} />)}
          </div>
        </div>
      );
    })}
  </div>
);

const FeedView = ({ feed }) => (
  <div className="feed">
    {feed.map((e, i) => (
      <div key={i} className={`feed-row level-${e.level}`}>
        <div className="feed-ts mono">{e.ts}</div>
        <div className="feed-icon">{e.icon}</div>
        <div className={`feed-agent agent-${e.agent}`}>{e.agent}</div>
        <div className="feed-text">{e.text}</div>
        {e.ticket && <Link to={`/ticket/${e.ticket}`} className="feed-link mono">→ open</Link>}
      </div>
    ))}
  </div>
);

const SLARiskView = ({ tickets }) => {
  const sorted = [...tickets].filter(t => t.stage !== "done").sort((a, b) => b.slaPct - a.slaPct);
  return (
    <div className="card">
      <table className="table">
        <thead><tr>
          <th style={{ width: 130 }}>Ticket</th>
          <th>Subject</th>
          <th style={{ width: 120 }}>Stage</th>
          <th style={{ width: 110 }}>Agent</th>
          <th style={{ width: 220 }}>SLA</th>
          <th style={{ width: 110 }}>Action</th>
        </tr></thead>
        <tbody>
          {sorted.map(t => (
            <tr key={t.id} onClick={() => go(`/ticket/${t.id}`)}>
              <td className="mono" style={{ fontSize: 11.5 }}>{t.num}</td>
              <td>{t.subject}</td>
              <td><span className="agent-pill" style={{ background: stageColor(t.stage) + "22", color: stageColor(t.stage), borderColor: stageColor(t.stage) + "55" }}>{t.stage.replace(/_/g, " ")}</span></td>
              <td><span className={`agent-pill agent-${t.agent}`}>{t.agent}</span></td>
              <td>
                <div className="sla-bar"><div className={`sla-fill sla-${slaPctClass(t.slaPct)}`} style={{ width: `${Math.min(100, t.slaPct * 100)}%` }} /></div>
                <div className="mono dim" style={{ fontSize: 10, marginTop: 2 }}>{Math.round(t.slaPct * 100)}% of {t.slaHours}h</div>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                {t.slaPct > 0.5 && <button className="btn btn-sm">Escalate</button>}
                {t.slaPct <= 0.5 && <span className="dim mono" style={{ fontSize: 10 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OverviewPage = () => {
  const [tab, setTab] = useState("kanban");
  const [propFilter, setPropFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState(null); // null = show all
  const allTickets = (A?.pipeline || []).filter(t => propFilter === "all" || t.property === propFilter);
  const tickets = stageFilter ? allTickets.filter(t => stageFilter === "sla_risk" ? (t.slaPct >= 0.5 && t.stage !== "done") : t.stage === stageFilter) : allTickets;
  const totals = {
    open: allTickets.filter(t => t.stage !== "done").length,
    waiting_vendor: allTickets.filter(t => t.stage === "vendor_coordinating").length,
    waiting_tenant: allTickets.filter(t => t.stage === "tenant_confirming").length,
    awaiting_approval: allTickets.filter(t => t.stage === "awaiting_approval").length,
    sla_risk: allTickets.filter(t => t.slaPct >= 0.5 && t.stage !== "done").length,
  };
  const kpiClick = (key) => {
    setTab("kanban");
    setStageFilter(stageFilter === key ? null : key);
  };
  const kpiClass = (key) => `kpi kpi-clickable${stageFilter === key ? " kpi-active" : ""}`;

  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Overview" }]}
        actions={<>
          <select className="select-sm" value={propFilter} onChange={e => setPropFilter(e.target.value)}>
            <option value="all">All properties</option>
            {D.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => go(`/simulate/p1`)}>▷ Simulate ticket</button>
          <span className="kbd">G O</span>
        </>}
      />
      <Stories items={[
        { n: 1, text: "fleet view: every ticket across every property" },
        { n: 6, text: "see what agents are doing, accept/escalate" }
      ]} />
      <ApiStrip endpoints={[
        "GET /pipeline",
        "GET /pipeline?property_id=p1",
        "WS /events (SSE: ticket.* agent.*)",
        "POST /tickets/{id}/escalate"
      ]} />

      <div className="page"><div className="page-inner">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
          <p className="subtle" style={{ margin: 0 }}>
            Live state of every ticket across the fleet. <b>Cards = work items</b>, <b>columns = stages</b>. Click a number below to filter; click a card to open it.
          </p>
          {stageFilter && (
            <button className="btn btn-sm" onClick={() => setStageFilter(null)}>
              ✕ Clear filter ({tickets.length} of {allTickets.length})
            </button>
          )}
        </div>
        <div className="kpi-row">
          <div className={kpiClass(null)} onClick={() => kpiClick(null)} style={{ cursor: "pointer" }}><div className="kpi-label">Open tickets</div><div className="kpi-val">{totals.open}</div><div className="kpi-sub">all stages except Done</div></div>
          <div className={kpiClass("awaiting_approval")} onClick={() => kpiClick("awaiting_approval")}><div className="kpi-label">Awaiting your approval</div><div className="kpi-val" style={{ color: "#C28537" }}>{totals.awaiting_approval}</div><div className="kpi-sub">YOU need to act</div></div>
          <div className={kpiClass("vendor_coordinating")} onClick={() => kpiClick("vendor_coordinating")}><div className="kpi-label">Vendor coordinating</div><div className="kpi-val" style={{ color: "#3D7CC9" }}>{totals.waiting_vendor}</div><div className="kpi-sub">agent on autopilot</div></div>
          <div className={kpiClass("tenant_confirming")} onClick={() => kpiClick("tenant_confirming")}><div className="kpi-label">Tenant confirming</div><div className="kpi-val" style={{ color: "#7C5BD1" }}>{totals.waiting_tenant}</div><div className="kpi-sub">agent on autopilot</div></div>
          <div className={kpiClass("sla_risk")} onClick={() => kpiClick("sla_risk")}><div className="kpi-label">SLA risk</div><div className="kpi-val" style={{ color: "#B23A3A" }}>{totals.sla_risk}</div><div className="kpi-sub">≥ 50% of SLA elapsed</div></div>
        </div>

        <div className="tabs" style={{ marginTop: 18 }}>
          <button className={`tab ${tab === "kanban" ? "active" : ""}`} onClick={() => setTab("kanban")}>Pipeline</button>
          <button className={`tab ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")}>Live feed</button>
          <button className={`tab ${tab === "sla" ? "active" : ""}`} onClick={() => setTab("sla")}>SLA risk</button>
        </div>

        {tab === "kanban" && <PipelineKanban tickets={tickets} />}
        {tab === "feed" && <FeedView feed={A?.feed || []} />}
        {tab === "sla" && <SLARiskView tickets={tickets} />}
      </div></div>
    </div>
  );
};

// ============================================================
// Vendors directory
// ============================================================
const VendorsPage = () => {
  const [propFilter, setPropFilter] = useState("all");
  const [tradeFilter, setTradeFilter] = useState("all");
  const vendors = (A?.vendors || []).filter(v =>
    (propFilter === "all" || v.properties.includes(propFilter)) &&
    (tradeFilter === "all" || v.trade === tradeFilter)
  );
  const trades = [...new Set((A?.vendors || []).map(v => v.trade))];

  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Vendors" }]}
        actions={<>
          <button className="btn btn-sm">+ Add vendor</button>
          <button className="btn btn-sm">Import from context.md</button>
        </>}
      />
      <Stories items={[
        { n: 4, text: "vendor preferences as policy, applied per ticket" },
        { n: 6, text: "agent has structured directory to choose from" }
      ]} />
      <ApiStrip endpoints={["GET /vendors", "POST /vendors", "PATCH /vendors/{id}", "GET /vendors/{id}/jobs"]} />

      <div className="page"><div className="page-inner">
        <h1 className="h1">Vendor directory</h1>
        <p className="subtle" style={{ maxWidth: 720 }}>The Vendor Agent picks from this list when an action requires dispatch. Reliability score is computed from response times and missed appointments. Vendors marked inactive are skipped automatically.</p>

        <div className="filter-row">
          <select className="select-sm" value={propFilter} onChange={e => setPropFilter(e.target.value)}>
            <option value="all">All properties</option>
            {D.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select-sm" value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}>
            <option value="all">All trades</option>
            {trades.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="dim mono" style={{ fontSize: 11 }}>{vendors.length} vendor{vendors.length === 1 ? "" : "s"}</span>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table">
            <thead><tr>
              <th style={{ width: 220 }}>Vendor</th>
              <th style={{ width: 110 }}>Trade</th>
              <th>Contact</th>
              <th style={{ width: 130 }}>Reliability</th>
              <th style={{ width: 110 }}>Avg response</th>
              <th style={{ width: 90 }}>Open jobs</th>
              <th style={{ width: 80 }}>Status</th>
            </tr></thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{v.name}</div>
                    <div className="dim" style={{ fontSize: 11 }}>{v.notes}</div>
                  </td>
                  <td><span className="trade-pill">{v.trade}</span></td>
                  <td>
                    <div className="mono" style={{ fontSize: 11.5 }}>{v.contact_phone}</div>
                    <div className="mono dim" style={{ fontSize: 11 }}>{v.contact_email}</div>
                  </td>
                  <td>
                    <div className="rel-bar"><div className="rel-fill" style={{ width: `${v.reliability * 100}%`, background: v.reliability >= 0.85 ? "#79D89C" : v.reliability >= 0.7 ? "#F1B86B" : "#F08D8D" }} /></div>
                    <div className="mono dim" style={{ fontSize: 10.5, marginTop: 2 }}>{Math.round(v.reliability * 100)}%</div>
                  </td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{v.avg_response_min < 60 ? `${v.avg_response_min}m` : `${Math.round(v.avg_response_min/60)}h`}<div className="dim" style={{ fontSize: 10 }}>last: {v.last_response}</div></td>
                  <td className="mono">{v.openJobs}</td>
                  <td>{v.active ? <span className="badge badge-ok">active</span> : <span className="badge badge-blocked">blocked</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="h2" style={{ marginTop: 28 }}>Agent SLA defaults</h2>
        <div className="card" style={{ padding: 16 }}>
          <div className="sla-grid">
            <div><div className="muted" style={{ fontSize: 11 }}>Vendor agent timeout</div><div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>24 hours</div></div>
            <div><div className="muted" style={{ fontSize: 11 }}>Tenant agent timeout</div><div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>48 hours</div></div>
            <div><div className="muted" style={{ fontSize: 11 }}>Vendor clarifications</div><div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>max 2</div></div>
            <div><div className="muted" style={{ fontSize: 11 }}>Tenant reminders</div><div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>2 (24h, 40h)</div></div>
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 12 }}>Defaults; per-vendor and per-property overrides live in <Link to="/policies/p1">Policies</Link>.</div>
        </div>
      </div></div>
    </div>
  );
};

// ============================================================
// Escalation queue
// ============================================================
const EscalationsPage = () => (
  <div className="main">
    <Topbar
      crumbs={[{ label: "Escalations" }]}
      actions={<button className="btn btn-sm">Filter…</button>}
    />
    <Stories items={[
      { n: 6, text: "operator picks up agent failures" },
      { n: 11, text: "honest about agent limits" }
    ]} />
    <ApiStrip endpoints={["GET /escalations", "POST /escalations/{ticket_id}/take", "POST /escalations/{ticket_id}/dismiss"]} />

    <div className="page"><div className="page-inner">
      <h1 className="h1">Escalation queue</h1>
      <p className="subtle" style={{ maxWidth: 720 }}>Tickets where an agent gave up — SLA breached, ambiguous reply, or vendor unresponsive. The agent has paused; an operator decides what to do next.</p>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead><tr>
            <th style={{ width: 130 }}>Ticket</th>
            <th style={{ width: 120 }}>Property</th>
            <th>Reason</th>
            <th style={{ width: 110 }}>Agent</th>
            <th style={{ width: 110 }}>Since</th>
            <th style={{ width: 90 }}>Severity</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr></thead>
          <tbody>
            {(A?.escalations || []).map(e => {
              const prop = D.properties.find(p => p.id === e.property);
              return (
                <tr key={e.id}>
                  <td className="mono" style={{ fontSize: 11.5 }} onClick={() => go(`/ticket/${e.id}`)}><b>{e.num}</b><div className="dim" style={{ fontSize: 10.5 }}>{e.subject}</div></td>
                  <td>{prop?.name}</td>
                  <td>{e.reason}{e.vendor && <div className="mono dim" style={{ fontSize: 10.5 }}>vendor: {e.vendor}</div>}</td>
                  <td><span className={`agent-pill agent-${e.agent}`}>{e.agent}</span></td>
                  <td className="mono dim" style={{ fontSize: 11 }}>{e.since}</td>
                  <td>{e.severity === "high" ? <span className="badge badge-blocked">high</span> : <span className="badge" style={{ background: "#FBE9CD", color: "#9A6618" }}>amber</span>}</td>
                  <td>
                    <button className="btn btn-sm">I'll take it</button>{" "}
                    <button className="btn btn-sm">Try other vendor</button>{" "}
                    <button className="btn btn-sm">Dismiss</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="h2" style={{ marginTop: 28 }}>Why this exists</h2>
      <div className="card" style={{ padding: 16 }}>
        <p style={{ marginTop: 0 }}>Agents are tools, not employees. They escalate — they don't fail silently — when:</p>
        <ul style={{ paddingLeft: 22, marginTop: 8 }}>
          <li><b>Vendor SLA breach</b> — vendor has not replied within configured timeout (default 24h).</li>
          <li><b>Ambiguous reply</b> — vendor said "maybe" or proposed a slot incompatible with policy. After 2 clarification rounds, hands off.</li>
          <li><b>Tenant non-response</b> — 2 reminders sent, still no answer after 48h.</li>
          <li><b>Conflicting tickets</b> — two tickets need the same vendor at overlapping times.</li>
          <li><b>Out-of-policy</b> — vendor's slot violates a property policy (after-hours, weekend without consent, over budget).</li>
        </ul>
      </div>
    </div></div>
  </div>
);

// ============================================================
// Multi-party timeline (hero ticket detail)
// ============================================================
const TimelinePage = ({ ticketId }) => {
  const hero = A?.hero;
  const t = hero;
  const [showAgentInspector, setShowAgentInspector] = useState(false);

  return (
    <div className="main">
      <Topbar
        crumbs={[
          { label: "Overview", to: "/overview" },
          { label: t.num, to: `/ticket/${t.id}` },
          { label: "Timeline" }
        ]}
        actions={<>
          <Link to={`/ticket/${t.id}`} className="btn btn-sm">Classic view</Link>
          <button className="btn btn-sm" onClick={() => setShowAgentInspector(s => !s)}>{showAgentInspector ? "Hide" : "Show"} agent inspector</button>
        </>}
      />
      <Stories items={[
        { n: 1, text: "every channel normalized in one ticket" },
        { n: 6, text: "see what each agent did and when" }
      ]} />
      <ApiStrip endpoints={[`GET /tickets/${t.id}/timeline`, `GET /tickets/${t.id}/agents`, "POST /tickets/{id}/agents/{agent}/intervene"]} />

      <div className="page"><div className="page-inner" style={{ maxWidth: 1180 }}>
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: "#6E7480" }}>{t.num} · Gartenstraße 42</div>
              <h1 className="h1" style={{ margin: "4px 0" }}>{t.subject}</h1>
              <div className="muted">Raised by {t.raisedBy} via email</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="badge badge-vendor">vendor coordinating</div>
              <div className="mono dim" style={{ fontSize: 11, marginTop: 4 }}>SLA 47h 32m remaining</div>
            </div>
          </div>
        </div>

        {showAgentInspector && <AgentInspectorPanel ticketId={t.id} />}

        <div className="swim-frame">
          <div className="swim-head">
            <div className="swim-lane-h" data-lane="tenant">Tenant<div className="dim" style={{ fontSize: 10.5 }}>{t.raisedBy}</div></div>
            <div className="swim-lane-h" data-lane="system">System / Agents<div className="dim" style={{ fontSize: 10.5 }}>triage · vendor · tenant</div></div>
            <div className="swim-lane-h" data-lane="vendor">Vendor<div className="dim" style={{ fontSize: 10.5 }}>{t.vendor.name}</div></div>
          </div>
          <div className="swim-body">
            {t.timeline.map((e, i) => (
              <div key={i} className={`swim-row lane-${e.lane}`}>
                <div className="swim-time mono">{e.at}</div>
                <div className={`swim-bubble lane-${e.lane} ${e.pending ? "pending" : ""} ${e.op ? "op" : ""}`}>
                  <div className="swim-bubble-h">
                    {e.channel && <span className={`channel-pill ch-${e.channel} ${e.dir}`}>{e.channel.toUpperCase()} {e.dir === "in" ? "↓" : "↑"}</span>}
                    {e.agent && <span className={`agent-pill agent-${e.agent}`}>{e.agent}</span>}
                    <span className="bubble-title">{e.title}</span>
                  </div>
                  <div className="swim-bubble-b">{e.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 12, marginTop: 16, background: "#FBF8F3", borderColor: "#E9DEC8" }}>
          <div className="mono" style={{ fontSize: 11, color: "#9A6618", textTransform: "uppercase", letterSpacing: "0.06em" }}>Operator override</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn btn-sm">Pause agents</button>
            <button className="btn btn-sm">Reassign vendor</button>
            <button className="btn btn-sm">Send manual reply</button>
            <button className="btn btn-sm">Force-resolve</button>
            <span className="dim" style={{ fontSize: 11, alignSelf: "center" }}>You can step in at any time. Agents will resume after.</span>
          </div>
        </div>
      </div></div>
    </div>
  );
};

// ============================================================
// Agent state inspector (panel inside timeline)
// ============================================================
const AgentInspectorPanel = ({ ticketId }) => {
  const states = (A?.agentStates && A.agentStates[ticketId]) || A.agentStates["t-7820"];
  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, background: "#0F1216", color: "#D7DBDF", borderColor: "#1F242A" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1F242A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="mono" style={{ fontSize: 11, color: "#79D89C" }}>● AGENT STATE INSPECTOR</div>
        <div className="mono" style={{ fontSize: 10.5, color: "#6E7480" }}>GET /tickets/{ticketId}/agents</div>
      </div>
      <table className="table" style={{ background: "transparent", color: "#D7DBDF", fontSize: 11.5 }}>
        <thead><tr style={{ background: "#14171A" }}>
          <th style={{ color: "#6E7480" }}>Agent</th>
          <th style={{ color: "#6E7480" }}>State</th>
          <th style={{ color: "#6E7480" }}>Model</th>
          <th style={{ color: "#6E7480" }}>Tokens (in / out)</th>
          <th style={{ color: "#6E7480" }}>Elapsed</th>
          <th style={{ color: "#6E7480" }}>Notes</th>
        </tr></thead>
        <tbody>
          {states.map((s, i) => (
            <tr key={i} style={{ borderColor: "#1F242A" }}>
              <td><span className={`agent-pill agent-${s.agent}`}>{s.agent}</span></td>
              <td className="mono">{s.state}</td>
              <td className="mono">{s.model || "—"}</td>
              <td className="mono">{s.input_tokens ? `${s.input_tokens} / ${s.output_tokens}` : "—"}</td>
              <td className="mono">{s.elapsed_ms ? `${s.elapsed_ms}ms` : "—"}</td>
              <td className="mono dim" style={{ fontSize: 10.5 }}>
                {s.finished && `finished ${s.finished}`}
                {s.deadline && <div>deadline {s.deadline}</div>}
                {s.remaining && <div style={{ color: "#F1B86B" }}>{s.remaining} remaining</div>}
                {s.note && <div>{s.note}</div>}
                {s.retries !== undefined && <div>retries: {s.retries}{s.clarifications !== undefined && ` · clarifications: ${s.clarifications}`}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================
// Tenant unified comms thread
// ============================================================
const TenantThreadPage = ({ ticketId }) => {
  const th = A?.tenantThread;
  return (
    <div className="main">
      <Topbar
        crumbs={[
          { label: "Overview", to: "/overview" },
          { label: th.ticket, to: `/ticket/t-7820` },
          { label: "Tenant comms" }
        ]}
        actions={<button className="btn btn-sm">Send message…</button>}
      />
      <Stories items={[
        { n: 9, text: "tenant: don't repeat yourself across channels" },
        { n: 10, text: "tenant gets confirmation through their preferred channel" }
      ]} />
      <ApiStrip endpoints={[`GET /tickets/${th.ticket}/tenant-thread`, "POST /tickets/{id}/messages", "Postmark webhook (email)", "Twilio webhook (SMS)"]} />

      <div className="page"><div className="page-inner" style={{ maxWidth: 820 }}>
        <h1 className="h1">Tenant communications</h1>
        <div className="muted" style={{ marginBottom: 16 }}>{th.tenant} · <span className="mono">{th.email}</span> · <span className="mono">{th.phone}</span></div>

        <div className="thread">
          {th.messages.map((m, i) => (
            <div key={i} className={`thread-msg ${m.dir}`}>
              <div className="thread-side mono">
                <span className={`channel-pill ch-${m.channel} ${m.dir}`}>{m.channel.toUpperCase()}</span>
                <div style={{ fontSize: 10.5, marginTop: 4 }}>{m.ts}</div>
                {m.agent && <div className={`agent-pill agent-${m.agent}`} style={{ marginTop: 4 }}>{m.agent}</div>}
              </div>
              <div className="thread-bubble">
                {m.subject && <div style={{ fontWeight: 500, marginBottom: 4 }}>{m.subject}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 16 }}>
          <div className="mono dim" style={{ fontSize: 11, marginBottom: 8 }}>Send message</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="select-sm"><option>Email</option><option>SMS</option><option>Both</option></select>
            <input className="input" placeholder="Type message…" style={{ flex: 1 }} />
            <button className="btn btn-sm btn-approve">Send</button>
          </div>
        </div>
      </div></div>
    </div>
  );
};

Object.assign(window, { OverviewPage, VendorsPage, EscalationsPage, TimelinePage, AgentInspectorPanel, TenantThreadPage });
