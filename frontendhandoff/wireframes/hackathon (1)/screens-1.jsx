/* Screens part 1: Inbox, Coverage, Slack, Audit, Context viewer/editor, Versions, Diff */

const propBy = (id) => D.properties.find(p => p.id === id) || D.properties[0];

// ---------- Wireframe coverage map ----------
const CoveragePage = () => {
  const screens = [
    { name: "🌟 Pipeline overview (default landing)", route: "/overview", us: [1, 6, 11], group: "Multi-agent" },
    { name: "🌟 Multi-party timeline (hero ticket)", route: "/timeline/t-7820", us: [1, 6], group: "Multi-agent" },
    { name: "Vendor directory", route: "/vendors", us: [4, 6], group: "Multi-agent" },
    { name: "Escalation queue", route: "/escalations", us: [6, 11], group: "Multi-agent" },
    { name: "Tenant unified comms thread", route: "/tenant-thread/t-7820", us: [9, 10], group: "Multi-agent" },
    { name: "Property dashboard / sidebar", route: "/inbox/p1", us: [1], group: "Inbox & tickets" },
    { name: "Ticket inbox (per-property)", route: "/inbox/p1", us: [1, 5], group: "Inbox & tickets" },
    { name: "Ticket detail — voice (variant A)", route: "/ticket/t-7831?v=a", us: [1, 2, 8, 9], group: "Inbox & tickets" },
    { name: "Ticket detail — voice (variant B)", route: "/ticket/t-7831?v=b", us: [1, 2, 8, 9], group: "Inbox & tickets" },
    { name: "Ticket detail — email", route: "/ticket/t-7830", us: [1, 2], group: "Inbox & tickets" },
    { name: "Context viewer", route: "/context/p1", us: [3, 11], group: "Context" },
    { name: "Context editor", route: "/editor/p1", us: [3], group: "Context" },
    { name: "Version history", route: "/versions/p1", us: [3, 7], group: "Context" },
    { name: "Diff viewer", route: "/diff/p1", us: [7], group: "Context" },
    { name: "Policies", route: "/policies/p1", us: [4], group: "Governance" },
    { name: "Sources", route: "/sources/p1", us: [3], group: "Governance" },
    { name: "Suggestions panel — variant A (cards)", route: "/suggestions/p1?v=a", us: [6], group: "Hermes" },
    { name: "Suggestions panel — variant B (review queue)", route: "/suggestions/p1?v=b", us: [6], group: "Hermes" },
    { name: "Audit log", route: "/audit", us: [4, 7, 11], group: "System" },
    { name: "Simulate ticket / call panel", route: "/simulate/p1", us: [1, 8], group: "System" },
    { name: "Slack notification mock", route: "/slack", us: [5, 10], group: "System" }
  ];
  const groups = [...new Set(screens.map(s => s.group))];
  const stories = [
    "see every interaction as one normalized inbox",
    "trust proposals are grounded in a context version",
    "edit context.md directly when I learn something",
    "change a policy and see it take effect",
    "get Slack ping with deep link",
    "review Hermes' suggestions and accept/dismiss",
    "see clean diff between context versions",
    "tenant: be understood first time, even from noisy room",
    "tenant: not have to repeat my building / unit",
    "tenant: get callback or written confirmation",
    "Ben: read context + audit and be productive in 5 min"
  ];
  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Dev" }, { label: "Wireframe map" }]} actions={null} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Wireframe coverage</h1>
        <p className="subtle">Mid-fi clickable wireframes for the Buena Context Engine MVP, including the multi-agent coordination layer. Click any screen to jump in. <b>🌟 hero demo path</b>: Overview → Timeline → Vendors → Escalations.</p>

        <div className="section-head"><h2 className="h2">Screens by area</h2><span className="muted mono">{screens.length} screens</span></div>
        {groups.map(g => (
          <div key={g} style={{ marginBottom: 18 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>{g}</div>
            <table className="matrix">
              <tbody>
                {screens.filter(s => s.group === g).map((s, i) => (
                  <tr key={i}>
                    <td style={{ width: 40 }} className="mono muted">{String(screens.indexOf(s) + 1).padStart(2, "0")}</td>
                    <td><Link to={s.route} style={{ color: "var(--accent)", textDecoration: "underline" }}>{s.name}</Link></td>
                    <td style={{ width: 280 }} className="mono muted">{s.route}</td>
                    <td>{s.us.map(n => <span key={n} className="us-tag" style={{ marginRight: 4 }}><b>US{n}</b></span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="section-head"><h2 className="h2">Hero demo flow</h2></div>
        <div className="card card-pad">
          <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9 }}>
            <li><b>Pipeline overview</b> — show fleet view across 3 properties, point at "vendor coordinating" and "tenant confirming" columns.</li>
            <li><b>Click GAR-118 (voice ticket)</b> → ticket detail with dual-decision UI. Approve action.</li>
            <li><b>Open multi-party timeline (GAR-108)</b> — show triage → vendor SMS → vendor reply → tenant agent emails+SMSes tenant. Toggle agent state inspector.</li>
            <li><b>Vendor directory</b> — show structured table, reliability, the agent picks Heinz GmbH automatically.</li>
            <li><b>Escalation queue</b> — be honest about agent failure modes (SLA breach, ambiguous reply, tenant non-response).</li>
            <li><b>Live feed tab</b> — leave on, watch new events arrive as the system runs.</li>
          </ol>
        </div>

        <div className="section-head"><h2 className="h2">User stories reference</h2></div>
        <div className="card card-pad">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            {stories.map((s, i) => <li key={i} className="muted"><b style={{ color: "var(--ink)" }}>US{i + 1}</b> — {s}</li>)}
          </ol>
        </div>

        <div className="section-head"><h2 className="h2">Multi-agent architecture</h2></div>
        <div className="card card-pad">
          <p style={{ marginTop: 0 }}>Three agents, same ticket, narrow scopes:</p>
          <ul style={{ paddingLeft: 22 }}>
            <li><b>Triage agent</b> — classifies inbound, drafts proposal, stops at <span className="mono">awaiting_approval</span>.</li>
            <li><b>Vendor agent</b> — activated post-approval. SMS+email to vendor, parses reply, max 2 clarification rounds, escalates on timeout (24h default).</li>
            <li><b>Tenant agent</b> — activated when vendor confirms. SMS+email to tenant, parses confirm/reschedule/cancel. 48h timeout, 2 reminders.</li>
          </ul>
          <p>A non-agent <b>coordinator</b> watches state, routes between agents, and pushes to the escalation queue when timeouts hit.</p>
        </div>
      </div></div>
    </div>
  );
};

// ---------- Inbox (redirects to property shell tickets tab) ----------
const InboxPage = ({ propId }) => {
  // Redirect into property shell
  useEffect(() => { go(`/property/${propId}/tickets`); }, [propId]);
  return null;
};

// ---------- Slack mock ----------
const SlackPage = () => (
  <div className="main">
    <Topbar crumbs={[{ label: "Mocks" }, { label: "Slack notifications" }]} actions={null} />
    <Stories items={[
      { n: 5, text: "Slack ping with deep link to ticket" },
      { n: 10, text: "tenant gets confirmation issue is logged" }
    ]} />
    <ApiStrip endpoints={["POST {SLACK_WEBHOOK_URL}", "trigger: ticket.created (voice)", "trigger: suggestion.high_value", "trigger: proposal.resolved"]} />
    <div className="page"><div className="page-inner" style={{ maxWidth: 720 }}>
      <h1 className="h1">Outbound Slack notifications</h1>
      <p className="subtle">Plain-text webhook to <span className="mono">#property-gartenstrasse</span>. Three triggers: voice ticket created, Hermes high-value suggestion, proposal resolved. No buttons, no blocks — just text + deep link, matching PRD §8.</p>

      <div className="slack-window" style={{ marginBottom: 16 }}>
        <div className="slack-head"># property-gartenstrasse</div>
        <div className="slack-msg">
          <div className="av">B</div>
          <div>
            <div><span className="who">Buena</span><span className="when">APP · 16:46</span></div>
            <div style={{ marginTop: 4 }}>🎫 New ticket for <b>Gartenstraße 42</b> (📞 voice call)</div>
            <div className="dim" style={{ fontSize: 12.5 }}>From: Mr Schmidt (Unit 3B) · Subject: Heating cold</div>
            <div style={{ marginTop: 4 }}>→ <a href="#/ticket/t-7831" onClick={(e) => { e.preventDefault(); go("/ticket/t-7831"); }}>Review in Buena</a></div>
          </div>
        </div>
        <div className="slack-msg">
          <div className="av">B</div>
          <div>
            <div><span className="who">Buena</span><span className="when">APP · 16:48</span></div>
            <div style={{ marginTop: 4 }}>🧠 Hermes has a suggestion for <b>Gartenstraße 42</b></div>
            <div style={{ color: "#ABABAD", fontStyle: "italic", marginTop: 2 }}>"Heating issues under €200 were approved 4 times this week."</div>
            <div style={{ marginTop: 4 }}>→ <a href="#/suggestions/p1" onClick={(e) => { e.preventDefault(); go("/suggestions/p1"); }}>Review in Buena</a></div>
          </div>
        </div>
        <div className="slack-msg">
          <div className="av">B</div>
          <div>
            <div><span className="who">Buena</span><span className="when">APP · 17:02</span></div>
            <div style={{ marginTop: 4 }}>✅ Proposal approved · <b>GAR-117</b></div>
            <div className="dim" style={{ fontSize: 12.5 }}>Maria approved repair (Heinz GmbH, €145). Context now at v12.</div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="h2" style={{ marginBottom: 6 }}>Tenant confirmation (out-of-band)</div>
        <p className="muted" style={{ margin: "0 0 10px" }}>Sent to tenant after voice ticket — closes the loop on US10 even when no email is on file.</p>
        <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap" }}>{`SMS · +49 174 8821 ****
Dear Mr Schmidt,
Your heating issue for Unit 3B has been registered
(Ticket GAR-118). A technician will contact you
within 24 hours.
— Buena Property Management`}</div>
      </div>
    </div></div>
  </div>
);

// ---------- Audit ----------
const AuditPage = () => {
  const [actor, setActor] = useState("all");
  const [prop, setProp] = useState("all");
  const rows = D.audit.filter(r => actor === "all" ? true : r.actor === actor);
  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Audit log" }]} actions={<button className="btn btn-sm">Export</button>} />
      <Stories items={[
        { n: 4, text: "policy changes have full audit trail" },
        { n: 7, text: "see what the system 'knows' and when it learned it" },
        { n: 11, text: "Ben: read the audit log and be productive in 5 min" }
      ]} />
      <ApiStrip endpoints={["GET /audit", "GET /audit?actor=hermes", "GET /audit?property_id=...&limit=100"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Audit log</h1>
        <p className="subtle">Every read, write, decision and learning event. Hermes appears as an actor.</p>

        <div className="row" style={{ marginBottom: 12, gap: 8 }}>
          <select className="select" style={{ width: 180 }} value={actor} onChange={e => setActor(e.target.value)}>
            <option value="all">All actors</option>
            <option value="maria@buena.io">maria@buena.io</option>
            <option value="ben@buena.io">ben@buena.io</option>
            <option value="hermes">hermes</option>
            <option value="system">system</option>
          </select>
          <select className="select" style={{ width: 220 }} value={prop} onChange={e => setProp(e.target.value)}>
            <option value="all">All properties</option>
            {D.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" placeholder="Filter actions..." style={{ flex: 1 }} />
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <div className="audit-row" style={{ background: "var(--surface-2)", color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.04, fontWeight: 500 }}>
            <div>Time</div><div>Actor</div><div>Action</div><div>Detail</div><div>Entity</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="audit-row">
              <div className="ts">2026-04-25 {r.ts}</div>
              <div className="actor">
                {r.actor === "hermes" && <span className="badge badge-hermes" style={{ marginRight: 4 }}>🧠</span>}
                {r.actor}
              </div>
              <div className="action">{r.action}</div>
              <div className="muted">{r.meta}</div>
              <div className="mono dim" style={{ fontSize: 11 }}>{r.entity}</div>
            </div>
          ))}
        </div>
      </div></div>
    </div>
  );
};

// ---------- Context viewer ----------
const ContextPage = ({ propId }) => {
  const prop = propBy(propId);
  const md = D.contextV11;
  // crude markdown render
  const lines = md.split("\n");
  const rendered = [];
  let inYaml = false, ul = null;
  lines.forEach((l, i) => {
    if (l === "---") { inYaml = !inYaml; if (!inYaml) rendered.push(<div className="yaml" key={i}>{lines.slice(0, i + 1).filter((_, j) => j > 0 && j < i).join("\n")}</div>); return; }
    if (inYaml) return;
    if (l.startsWith("## ")) { ul && rendered.push(<ul key={"ul" + i}>{ul}</ul>); ul = null; rendered.push(<h2 id={l.slice(3).toLowerCase().replace(/\s/g, "-")} key={i}>{l.slice(3)}</h2>); return; }
    if (l.startsWith("- ")) { ul = ul || []; ul.push(<li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l.slice(2)) }} />); return; }
    if (ul) { rendered.push(<ul key={"ul" + i}>{ul}</ul>); ul = null; }
    if (l.trim() === "") return;
    rendered.push(<p key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />);
  });
  if (ul) rendered.push(<ul key="ul-end">{ul}</ul>);

  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Context" }]}
        actions={<>
          <span className="badge mono">v{prop.version}</span>
          <button className="btn btn-sm" onClick={() => go(`/versions/${prop.id}`)}>History</button>
          <button className="btn btn-primary btn-sm" onClick={() => go(`/editor/${prop.id}`)}>Edit</button>
        </>}
      />
      <Stories items={[
        { n: 3, text: "edit context.md when I learn something new" },
        { n: 11, text: "Ben: read context and be productive in 5 min" }
      ]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/context`, `GET /properties/${propId}/context/versions`]} />
      <div className="page"><div className="page-inner" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <aside style={{ position: "sticky", top: 0, alignSelf: "start" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 6 }}>On this page</div>
          {["Basics", "Tenants", "Known issues", "Policies", "Source documents"].map(h => (
            <a key={h} href={`#${h.toLowerCase().replace(/\s/g, "-")}`} style={{ display: "block", padding: "4px 0", color: "var(--ink-2)", fontSize: 12.5, textDecoration: "none" }}>{h}</a>
          ))}
          <hr className="line" />
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Last updated</div>
          <div className="mono" style={{ fontSize: 11.5 }}>2026-04-24 16:42</div>
          <div className="muted" style={{ fontSize: 11.5 }}>maria@buena.io</div>
        </aside>
        <div>
          <h1 className="h1">{prop.name} · context.md</h1>
          <p className="subtle">A living, versioned document. Every automated proposal cites this version directly.</p>
          <div className="card card-pad md">{rendered}</div>
        </div>
      </div></div>
    </div>
  );
};

function renderInline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// ---------- Editor ----------
const EditorPage = ({ propId }) => {
  const prop = propBy(propId);
  const lines = D.contextV11.split("\n");
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/context/${prop.id}` }, { label: "Editor" }]}
        actions={<>
          <span className="badge mono">v{prop.version} · editing</span>
          <button className="btn btn-sm" onClick={() => go(`/context/${prop.id}`)}>Cancel</button>
          <button className="btn btn-primary btn-sm">Save as v{prop.version + 1}</button>
        </>}
      />
      <Stories items={[{ n: 3, text: "edit context.md directly when I learn something" }]} />
      <ApiStrip endpoints={[`POST /properties/${propId}/context`, "body: { content_md, reason, created_by }"]} />
      <div className="page"><div className="page-inner" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="badge">Markdown</span>
            <span className="muted mono" style={{ fontSize: 11 }}>·  {lines.length} lines · 1.4 KB</span>
            <span style={{ flex: 1 }} />
            <span className="muted" style={{ fontSize: 11.5 }}>Unsaved changes will create a new immutable version</span>
          </div>
          <div className="editor">
            {lines.map((l, i) => {
              let cls = "ln";
              if (i < 6) cls += " ln-yaml";
              if (l.startsWith("##")) cls += " ln-h";
              if (i === 30) cls += " ln-edit";
              return <span key={i} className={cls}>{l || " "}</span>;
            })}
          </div>
        </div>
        <aside className="col gap-12">
          <div className="card">
            <div className="card-head"><div className="h2">Save as new version</div></div>
            <div className="card-pad">
              <div className="field">
                <label>Reason for change</label>
                <textarea className="textarea" defaultValue="Added Unit 3B mobility note + tightened approval threshold to €200." />
              </div>
              <div className="field">
                <label>Author</label>
                <input className="input" value={D.operator.email} readOnly />
              </div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Saving creates context_versions row v{prop.version + 1}. The previous version stays immutable. Audit entry <span className="mono">context.write</span> is emitted.</div>
              <button className="btn btn-primary btn-lg" style={{ width: "100%" }}>Save v{prop.version + 1}</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div className="h2">Outline</div></div>
            <div className="card-pad" style={{ paddingTop: 6 }}>
              {["Basics", "Tenants", "Known issues", "Policies", "Source documents"].map(h => (
                <div key={h} style={{ padding: "4px 0", fontSize: 12.5 }}>## {h}</div>
              ))}
            </div>
          </div>
        </aside>
      </div></div>
    </div>
  );
};

// ---------- Versions ----------
const VersionsPage = ({ propId }) => {
  const prop = propBy(propId);
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/context/${prop.id}` }, { label: "Versions" }]}
        actions={<button className="btn btn-sm" onClick={() => go(`/diff/${prop.id}`)}>Open diff viewer</button>}
      />
      <Stories items={[{ n: 7, text: "see what the system knows and when it learned it" }]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/context/versions`, `GET /properties/${propId}/context/versions/{n}`]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Version history</h1>
        <p className="subtle">{D.versions.length} versions · {prop.name}</p>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table">
            <thead><tr><th style={{ width: 60 }}>Version</th><th style={{ width: 180 }}>Author</th><th style={{ width: 150 }}>When</th><th>Reason</th><th style={{ width: 110 }}></th></tr></thead>
            <tbody>
              {D.versions.map((v, i) => (
                <tr key={v.v}>
                  <td><span className="mono" style={{ fontWeight: 600 }}>v{v.v}</span>{i === 0 && <span className="badge badge-approved" style={{ marginLeft: 6 }}>current</span>}</td>
                  <td>
                    {v.flagHermes && <span className="badge badge-hermes" style={{ marginRight: 4 }}>🧠 hermes</span>}
                    <span className="mono" style={{ fontSize: 11.5 }}>{v.by}</span>
                  </td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{v.at}</td>
                  <td>{v.reason}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => go(`/diff/${prop.id}?from=${v.v - 1}&to=${v.v}`)}>Diff</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>
  );
};

// ---------- Diff ----------
const DiffPage = ({ propId }) => {
  const prop = propBy(propId);
  const rows = [
    { type: "hunk", content: "@@ ## Basics @@" },
    { type: "ctx", a: 7, b: 7, content: "**Heating:** Central gas, replaced 2023 (Viessmann Vitodens 200-W). Service contract: Heinz GmbH." },
    { type: "add", b: 8, content: "**Inbound phone:** +49 30 5550 1142 → routes to Buena voice agent." },
    { type: "ctx", a: 8, b: 9, content: "" },
    { type: "hunk", content: "@@ ## Tenants @@" },
    { type: "del", a: 14, content: "- **Unit 3B** — Herr Schmidt, 68, since 2002. Mobility-limited." },
    { type: "add", b: 15, content: "- **Unit 3B** — Herr Schmidt, 68, since 2002. Mobility-limited. **Always confirm callback in writing.**" },
    { type: "hunk", content: "@@ ## Known issues @@" },
    { type: "del", a: 22, content: "- Radiator valves on north-facing units are original 1990s." },
    { type: "add", b: 23, content: "- Radiator valves on north-facing units (2B, 3B, 4A, 6B) are original 1990s — known to seize." },
    { type: "add", b: 24, content: "  Heinz GmbH replaces in batches. Typical cost €150–€200 per unit, parts + 1h labor." },
    { type: "hunk", content: "@@ ## Policies @@" },
    { type: "del", a: 30, content: "- **Approval threshold:** €500." },
    { type: "add", b: 32, content: "- **Approval threshold:** €200 — repairs at or below this auto-suggest \"approve\" with reasoning," },
    { type: "add", b: 33, content: "  but still require human sign-off (MVP)." },
    { type: "add", b: 36, content: "- **Forbidden:** never commit to a fixed callback time; always say \"innerhalb von 24 Stunden\"." }
  ];
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/context/${prop.id}` }, { label: "Diff" }]}
        actions={<button className="btn btn-sm" onClick={() => go(`/versions/${prop.id}`)}>Back to versions</button>}
      />
      <Stories items={[{ n: 7, text: "see clean diff between versions" }]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/context/diff?from=10&to=11`]} />
      <div className="page"><div className="page-inner">
        <div className="row" style={{ marginBottom: 12, gap: 12 }}>
          <div className="row gap-12">
            <span className="muted" style={{ fontSize: 11.5 }}>Compare</span>
            <select className="select" style={{ width: 80 }} defaultValue="10"><option>9</option><option>10</option></select>
            <span className="muted">→</span>
            <select className="select" style={{ width: 80 }} defaultValue="11"><option>11</option></select>
          </div>
          <div style={{ flex: 1 }} />
          <span className="badge badge-approved">+8 lines</span>
          <span className="badge badge-rejected">−3 lines</span>
          <span className="badge">3 hunks</span>
        </div>

        <div className="card card-pad" style={{ marginBottom: 12, display: "flex", gap: 24 }}>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>From</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>v10</div>
            <div className="muted mono" style={{ fontSize: 11 }}>2026-04-22 11:15 · hermes</div>
          </div>
          <div style={{ width: 1, background: "var(--line)" }} />
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>To</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>v11 (current)</div>
            <div className="muted mono" style={{ fontSize: 11 }}>2026-04-24 16:42 · maria@buena.io</div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="muted" style={{ fontSize: 12, fontStyle: "italic" }}>"Tightened approval threshold to €200, added Unit 3B mobility note, expanded valve cost guidance."</div>
        </div>

        <div className="diff">
          {rows.map((r, i) => (
            <div key={i} className={`row ${r.type}`}>
              <div className="gutter">{r.a || ""}</div>
              <div className="gutter">{r.b || ""}</div>
              <div className="marker">{r.type === "add" ? "+" : r.type === "del" ? "−" : r.type === "hunk" ? "" : " "}</div>
              <div className="content" dangerouslySetInnerHTML={{ __html: renderInline(r.content) }} />
            </div>
          ))}
        </div>
      </div></div>
    </div>
  );
};

Object.assign(window, { CoveragePage, InboxPage, SlackPage, AuditPage, ContextPage, EditorPage, VersionsPage, DiffPage, propBy, renderInline });
