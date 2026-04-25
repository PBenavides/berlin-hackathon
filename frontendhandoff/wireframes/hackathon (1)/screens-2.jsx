/* Screens part 2: Ticket detail (voice + email + variants), Policies, Sources, Suggestions, Calls, Simulate */

// ---------- Waveform SVG ----------
const Waveform = ({ seed = 1, density = 60, color = "var(--ink-3)", playProgress = 0.35 }) => {
  const bars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < density; i++) {
      const x = (Math.sin(i * 1.7 + seed) * 0.5 + Math.cos(i * 0.43 + seed * 2) * 0.3 + Math.sin(i * 3.1 + seed * 5) * 0.2);
      arr.push(Math.abs(x) * 0.85 + 0.05);
    }
    return arr;
  }, [seed, density]);
  return (
    <div className="wave">
      <svg viewBox={`0 0 ${density} 100`} preserveAspectRatio="none">
        {bars.map((h, i) => (
          <rect key={i} x={i + 0.2} y={50 - h * 50} width={0.6} height={h * 100}
                fill={i / density < playProgress ? "var(--accent)" : color} opacity={i / density < playProgress ? 1 : 0.6} />
        ))}
      </svg>
      <div className="play-head" style={{ left: `${playProgress * 100}%` }} />
    </div>
  );
};

// ---------- Ticket detail (voice — variant A: proposal-first) ----------
const TicketVoiceA = ({ ticket }) => {
  const cs = D.callSession;
  const pr = D.proposal;
  const [showTranscript, setShowTranscript] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [actionState, setActionState] = useState("pending"); // pending | approved | rejected
  const [memoryState, setMemoryState] = useState("pending");
  const [audio, setAudio] = useState("cleaned");

  const consequencesApprove = [
    `Dispatch ${pr.proposedAction.vendor} to ${pr.proposedAction.target}`,
    `Written confirmation sent to Herr Schmidt (Unit 3B) — Sie-Form, mobility flag`,
    `Vendor agent activated — SMS to Heinz GmbH, 24h SLA timer starts`,
    `Context updated to v12 with repair note`,
  ];

  return (
    <div className="page-inner" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, paddingBottom: 24 }}>

      {/* LEFT: Proposal — the primary decision surface */}
      <div className="col gap-12">

        {/* Proposal card */}
        <div className="card" style={{ border: actionState === "approved" ? "1.5px solid #79D89C" : actionState === "rejected" ? "1.5px solid #F08D8D" : "1.5px solid var(--accent)" }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--accent-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--accent)" }}>Proposed action</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{pr.id}</span>
            </div>
            <span className="badge mono" style={{ background: "var(--surface)" }}>conf {Math.round(pr.confidence * 100)}%</span>
          </div>

          {/* ACTION — the big stuff */}
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1.2, marginBottom: 4 }}>
                  {pr.proposedAction.vendor}
                </div>
                <div style={{ color: "var(--ink-2)", fontSize: 13 }}>
                  {pr.proposedAction.trade} · {pr.proposedAction.target}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <div style={{ textAlign: "center", padding: "6px 12px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>€{pr.proposedAction.estimate_eur}</div>
                  <div className="muted" style={{ fontSize: 10.5 }}>estimate</div>
                </div>
                <div style={{ textAlign: "center", padding: "6px 12px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{pr.proposedAction.eta_hours}h</div>
                  <div className="muted" style={{ fontSize: 10.5 }}>ETA</div>
                </div>
              </div>
            </div>

            {/* Policy checks inline */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              <span className="badge badge-approved" style={{ fontSize: 11 }}>✓ under €200 threshold</span>
              <span className="badge badge-approved" style={{ fontSize: 11 }}>✓ preferred vendor</span>
              <span className="badge badge-approved" style={{ fontSize: 11 }}>✓ mobility note applied</span>
            </div>

            {/* Consequences preview */}
            {actionState === "pending" && (
              <div style={{ padding: "10px 12px", background: "#F0FBF5", borderRadius: 6, marginBottom: 14, border: "1px solid #C3E8D4" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#256E4F", marginBottom: 6 }}>Approving will:</div>
                <div className="col" style={{ gap: 5 }}>
                  {consequencesApprove.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-2)" }}>
                      <span style={{ color: "#256E4F", fontWeight: 700, flexShrink: 0 }}>→</span>{c}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionState === "approved" && (
              <div style={{ padding: "12px", background: "#F0FBF5", borderRadius: 6, marginBottom: 14, border: "1.5px solid #79D89C", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#256E4F" }}>Action approved</div>
                  <div className="muted" style={{ fontSize: 12 }}>Vendor agent activated · Heinz GmbH notified · tenant confirmation queued</div>
                </div>
              </div>
            )}

            {actionState === "rejected" && (
              <div style={{ padding: "12px", background: "#FEF2F2", borderRadius: 6, marginBottom: 14, border: "1.5px solid #F08D8D", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>✕</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#B23A3A" }}>Action rejected</div>
                  <div className="muted" style={{ fontSize: 12 }}>No vendor dispatch. Ticket remains open.</div>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            {actionState === "pending" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button className="btn btn-approve" style={{ flex: 1, fontSize: 14, padding: "10px 0" }}
                  onClick={() => setActionState("approved")}>
                  ✓ Approve dispatch
                </button>
                <button className="btn btn-sm" onClick={() => {}}>Edit</button>
                <button className="btn btn-reject btn-sm" onClick={() => setActionState("rejected")}>Reject</button>
              </div>
            )}
          </div>

          {/* Collapsible reasoning */}
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <button
              onClick={() => setShowReasoning(s => !s)}
              style={{ width: "100%", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-2)" }}>
              <span>Reasoning & evidence <span className="mono muted" style={{ fontSize: 11 }}>cites context.md v{pr.contextVersion}</span></span>
              <span style={{ color: "var(--ink-4)" }}>{showReasoning ? "▲" : "▼"}</span>
            </button>
            {showReasoning && (
              <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--line)" }}>
                <p style={{ margin: "12px 0 10px", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{pr.reasoning}</p>
                <div className="col" style={{ gap: 6 }}>
                  {pr.citations.map((c, i) => (
                    <div key={i} className="cite-chip" style={{ display: "block", padding: "6px 8px" }}>
                      <div style={{ fontWeight: 600, fontSize: 11.5 }}># {c.heading}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>"{c.excerpt}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Memory decision — compact footer */}
          <div style={{ borderTop: "1px solid var(--line)", padding: "10px 16px", background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Memory decision <span className="badge badge-pending" style={{ marginLeft: 4 }}>pending</span></div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  What context v12 will remember:&nbsp;
                  <span className="mono" style={{ fontSize: 10.5 }}>Unit 3B valve replaced 2026-04-25 by Heinz GmbH (€175)</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {memoryState === "pending" ? (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => setMemoryState("approved")}>✓ Save</button>
                    <button className="btn btn-sm" onClick={() => {}}>Edit</button>
                    <button className="btn btn-reject btn-sm" onClick={() => setMemoryState("rejected")}>Skip</button>
                  </>
                ) : (
                  <span className={`badge ${memoryState === "approved" ? "badge-approved" : "badge-rejected"}`}>
                    {memoryState === "approved" ? "✓ Saved to v12" : "Skipped"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tenant history — compact */}
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Herr Schmidt · Unit 3B · History</div>
          <div className="col" style={{ gap: 5, fontSize: 12.5 }}>
            <div className="row"><span className="muted mono" style={{ width: 80, flexShrink: 0 }}>2025-11</span><span>Heating cold — valve replacement €165 · Heinz GmbH</span></div>
            <div className="row"><span className="muted mono" style={{ width: 80, flexShrink: 0 }}>2024-03</span><span>Window seal renewed</span></div>
            <div className="row"><span className="muted mono" style={{ width: 80, flexShrink: 0 }}>2023-08</span><span>Mobility flag added to context</span></div>
          </div>
        </div>
      </div>

      {/* RIGHT: Voice call + ticket body */}
      <aside className="col gap-12">

        {/* Ticket summary */}
        <div className="card card-pad">
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <SourceBadge s={ticket.source} />
            <StatusBadge s={ticket.status} />
            <span className="mono muted" style={{ fontSize: 11, marginLeft: "auto" }}>{ticket.num}</span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ticket.subject}</div>
          <div className="muted" style={{ fontSize: 12 }}>From {ticket.raisedBy} · {ticket.createdAt}</div>
          <hr className="line" />
          <div style={{ fontStyle: "italic", color: "var(--ink-2)", fontSize: 12.5 }}>{cs.summary}</div>
        </div>

        {/* Voice card — compact */}
        <div className="card">
          <div className="card-head">
            <div className="row" style={{ gap: 6 }}>
              <span className="badge badge-voice">📞 voice</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{cs.duration}</span>
              <span className="badge badge-approved" style={{ fontSize: 11 }}>−{cs.noiseReduction} dB</span>
            </div>
          </div>
          <div className="card-pad">
            <div className="row gap-12" style={{ marginBottom: 8 }}>
              <button className="btn btn-sm">▶</button>
              <div style={{ flex: 1 }}>
                <Waveform seed={audio === "raw" ? 9 : 3} density={60} playProgress={0.42} />
              </div>
            </div>
            <div className="row" style={{ background: "var(--surface-2)", borderRadius: 4, padding: 3, gap: 0, marginBottom: 10 }}>
              <button className="btn btn-sm" style={{ flex: 1, fontSize: 11, background: audio === "raw" ? "var(--surface)" : "transparent", borderColor: audio === "raw" ? "var(--line-strong)" : "transparent" }} onClick={() => setAudio("raw")}>Raw</button>
              <button className="btn btn-sm" style={{ flex: 1, fontSize: 11, background: audio === "cleaned" ? "var(--surface)" : "transparent", borderColor: audio === "cleaned" ? "var(--line-strong)" : "transparent" }} onClick={() => setAudio("cleaned")}>Cleaned (ai-coustics)</button>
            </div>

            {/* Collapsed transcript */}
            <button
              onClick={() => setShowTranscript(s => !s)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 5, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-2)" }}>
              <span>Transcript · {cs.transcript.length} lines · DE / EN</span>
              <span style={{ color: "var(--ink-4)", fontSize: 11 }}>{showTranscript ? "▲ hide" : "▼ show"}</span>
            </button>
            {showTranscript && (
              <div className="transcript" style={{ marginTop: 8, maxHeight: 280, overflowY: "auto" }}>
                {cs.transcript.map((t, i) => (
                  <div key={i} className={`tr-row ${t.spk}`}>
                    <span className="speaker">{t.spk}</span>
                    <span className="time">{t.t}</span>
                    <div>
                      <div>{t.en}</div>
                      <div className="muted" style={{ fontSize: 11, fontStyle: "italic", marginTop: 1 }}>{t.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card-foot muted" style={{ fontSize: 10.5 }}>
            Deepgram nova-2 · ai-coustics · Gradium
          </div>
        </div>
      </aside>
    </div>
  );
};

// ---------- Variant B: timeline-first (transcript across the top, proposal below, citations inline) ----------
const TicketVoiceB = ({ ticket }) => {
  const cs = D.callSession;
  const pr = D.proposal;
  return (
    <div className="page-inner" style={{ paddingBottom: 16 }}>
      {/* Hero strip */}
      <div className="card" style={{ marginBottom: 12, overflow: "hidden" }}>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div className="row" style={{ marginBottom: 4 }}>
              <span className="badge badge-voice">📞 voice</span>
              <span className="badge badge-proposed">proposed</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{ticket.num}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 16 }}>{ticket.subject}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{ticket.raisedBy} · {cs.callerPhone} · {cs.duration}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Confidence</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(pr.confidence * 100)}%</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Estimate</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>€{pr.proposedAction.estimate_eur}</div>
          </div>
          <div className="row gap-12">
            <button className="btn btn-approve btn-lg">✓ Approve</button>
            <button className="btn btn-lg">Edit</button>
            <button className="btn btn-reject btn-lg">Reject</button>
          </div>
        </div>

        {/* Audio strip */}
        <div style={{ padding: 12, background: "var(--surface-2)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderBottom: "1px solid var(--line)" }}>
          <div>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className="badge">RAW</span><span className="muted" style={{ fontSize: 11.5 }}>café audio bed · pre ai-coustics</span>
              <button className="btn btn-sm" style={{ marginLeft: "auto" }}>▶</button>
            </div>
            <Waveform seed={9} density={140} playProgress={0.42} />
          </div>
          <div>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className="badge badge-approved">CLEANED</span><span className="muted" style={{ fontSize: 11.5 }}>−{cs.noiseReduction} dB · post ai-coustics</span>
              <button className="btn btn-sm" style={{ marginLeft: "auto" }}>▶</button>
            </div>
            <Waveform seed={3} density={140} playProgress={0.42} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="card-head"><div className="h2">Transcript</div></div>
          <div className="card-pad">
            <div className="transcript">
              {cs.transcript.map((t, i) => (
                <div key={i} className={`tr-row ${t.spk}`}>
                  <span className="speaker">{t.spk}</span>
                  <span className="time">{t.t}</span>
                  <div>{t.en}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col gap-12">
          <div className="card">
            <div className="card-head">
              <div className="h2">Reasoning · cites context v{pr.contextVersion}</div>
              <Link to="/context/p1" className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>open →</Link>
            </div>
            <div className="card-pad">
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)" }}>{pr.reasoning}</p>
              <hr className="line" />
              <div className="col" style={{ gap: 6 }}>
                {pr.citations.map((c, i) => (
                  <div key={i} className="cite-chip" style={{ display: "block", padding: "6px 8px" }}>
                    <div style={{ fontWeight: 600 }}># {c.heading}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>"{c.excerpt}"</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Proposed action</div>
            <pre className="mono" style={{ margin: 0, fontSize: 11.5, background: "var(--surface-2)", padding: 8, borderRadius: 4, overflow: "auto" }}>
{JSON.stringify(pr.proposedAction, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Email ticket ----------
const TicketEmail = ({ ticket }) => {
  return (
    <div className="page-inner" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, paddingBottom: 16 }}>
      <div className="col gap-12">
        <div className="card">
          <div className="card-head">
            <div className="row"><span className="badge badge-email">✉ email</span><span className="mono muted" style={{ fontSize: 11 }}>{ticket.num}</span></div>
            <span className="badge badge-proposed">proposed</span>
          </div>
          <div className="card-pad">
            <h2 style={{ margin: 0, fontSize: 15 }}>{ticket.subject}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>From <b style={{ color: "var(--ink-2)" }}>{ticket.raisedBy}</b> · {ticket.createdAt} · <span className="mono">becker@example.de</span></div>
            <hr className="line" />
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}>{`Dear Ms Lehmann,

water has been dripping from the U-bend under the kitchen sink since yesterday evening. I've put a towel underneath. Two photos are attached.

I'm home during the day.

Best regards,
M. Becker
Apartment 1A`}</div>
            <hr className="line" />
            <div className="row gap-12">
              <div style={{ width: 90, height: 70, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 4, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 10, fontFamily: "var(--font-mono)" }}>IMG_001.jpg</div>
              <div style={{ width: 90, height: 70, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 4, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 10, fontFamily: "var(--font-mono)" }}>IMG_002.jpg</div>
            </div>
          </div>
        </div>
      </div>
      <aside className="card">
        <div className="card-head" style={{ background: "var(--accent-soft)" }}>
          <div className="h2" style={{ color: "oklch(0.4 0.13 250)" }}>Proposal</div>
          <span className="badge mono">conf 92%</span>
        </div>
        <div className="card-pad">
          <div className="kv" style={{ marginBottom: 10 }}>
            <dt>Type</dt><dd className="mono">dispatch_repair</dd>
            <dt>Vendor</dt><dd>Sanitär Schäfer</dd>
            <dt>Estimate</dt><dd>€90</dd>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)" }}>Slow drip from U-bend in kitchen. Tenant home daytime. Estimate within threshold.</p>
          <hr className="line" />
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Citations · v11</div>
          <div className="cite-chip" style={{ display: "block", padding: "6px 8px", marginBottom: 6 }}>
            <div style={{ fontWeight: 600 }}># Tenants</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, marginTop: 2 }}>"Unit 1A — Frau Becker, since 2014. Quiet, prefers email."</div>
          </div>
        </div>
        <div className="card-foot">
          <button className="btn btn-approve" style={{ flex: 1 }}>✓ Approve</button>
          <button className="btn">Edit</button>
          <button className="btn btn-reject">Reject</button>
        </div>
      </aside>
    </div>
  );
};

const TicketPage = ({ ticketId, query }) => {
  const ticket = D.tickets.find(t => t.id === ticketId) || D.tickets[0];
  const variant = query.get("v") || "a";
  const isVoice = ticket.source === "voice";
  return (
    <div className="main">
      <Topbar
        crumbs={[
          { label: "Properties" },
          { label: "Gartenstraße 42", to: `/inbox/${ticket.property}` },
          { label: "Inbox", to: `/inbox/${ticket.property}` },
          { label: ticket.num }
        ]}
        actions={<>
          <Link to={`/timeline/${ticket.id}`} className="btn btn-sm">Multi-party timeline</Link>
          <Link to={`/tenant-thread/${ticket.id}`} className="btn btn-sm">Tenant thread</Link>
          {isVoice && <>
            <button className={`btn btn-sm ${variant === "a" ? "btn-primary" : ""}`} onClick={() => go(`/ticket/${ticket.id}?v=a`)}>Variant A · 3-pane</button>
            <button className={`btn btn-sm ${variant === "b" ? "btn-primary" : ""}`} onClick={() => go(`/ticket/${ticket.id}?v=b`)}>Variant B · timeline</button>
          </>}
        </>}
      />
      <Stories items={isVoice ? [
        { n: 1, text: "voice landed in same inbox as email" },
        { n: 2, text: "proposal cites a specific context version" },
        { n: 8, text: "tenant: understood first time from a noisy room" },
        { n: 9, text: "tenant: doesn't have to repeat unit/building" }
      ] : [
        { n: 1, text: "email landed in same inbox" },
        { n: 2, text: "proposal cites context version" }
      ]} />
      <div className="page">
        {isVoice
          ? (variant === "b" ? <TicketVoiceB ticket={ticket} /> : <TicketVoiceA ticket={ticket} />)
          : <TicketEmail ticket={ticket} />}
      </div>
    </div>
  );
};

// ---------- Policies ----------
const PoliciesPage = ({ propId }) => {
  const prop = propBy(propId);
  const [editing, setEditing] = useState(null);
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Policies" }]}
        actions={<button className="btn btn-primary btn-sm">+ New policy</button>}
      />
      <Stories items={[{ n: 4, text: "change a policy and see it take effect on the next ticket" }]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/policies`, `POST /properties/${propId}/policies`, "PATCH /policies/{id}", "DELETE /policies/{id}"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Policies</h1>
        <p className="subtle">Curated by humans. Loaded by the proposal pipeline at request time. Past proposals are not recomputed.</p>

        <div className="col gap-12">
          {D.policies.map(p => (
            <div key={p.id} className="card">
              <div className="card-head">
                <div className="row">
                  <span className={`badge ${p.active ? "badge-approved" : ""}`}><span className="badge-dot" />{p.active ? "active" : "off"}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>{p.kind}</span>
                </div>
                <div className="row">
                  <span className="muted" style={{ fontSize: 11 }}>updated {p.updated}</span>
                  <button className="btn btn-sm" onClick={() => setEditing(p.id)}>Edit</button>
                </div>
              </div>
              <div className="card-pad">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{p.desc}</div>
                <pre className="mono" style={{ margin: 0, fontSize: 11.5, background: "var(--surface-2)", padding: 8, borderRadius: 4 }}>{JSON.stringify(p.rule, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <div className="modal-bg" onClick={() => setEditing(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="card-head"><div className="h2">Edit policy: approval_threshold</div><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button></div>
              <div className="card-pad">
                <div className="field"><label>Description</label><input className="input" defaultValue="Repairs ≤ €200 auto-suggest approve (still needs sign-off)" /></div>
                <div className="field"><label>Max EUR</label><input className="input" type="number" defaultValue={200} /></div>
                <div className="field"><label>Scope</label><select className="select" defaultValue="repairs"><option>repairs</option><option>maintenance</option><option>any</option></select></div>
                <div className="muted" style={{ fontSize: 11.5 }}>Saving emits <span className="mono">policy.update</span> and applies to the next incoming ticket.</div>
              </div>
              <div className="card-foot" style={{ justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => setEditing(null)}>Save policy</button>
              </div>
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
};

// ---------- Sources ----------
const SourcesPage = ({ propId }) => {
  const prop = propBy(propId);
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Sources" }]}
        actions={<button className="btn btn-primary btn-sm">+ Register source</button>}
      />
      <Stories items={[{ n: 3, text: "context grounded in allowlisted source documents" }]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/sources`, "POST /sources", "PATCH /sources/{id}"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Allowlisted sources</h1>
        <p className="subtle">Read-only allowlist of inputs that can feed context. Each source has a kind, URI, and approval status.</p>

        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table">
            <thead><tr><th style={{ width: 80 }}>Kind</th><th>URI</th><th style={{ width: 100 }}>Status</th><th style={{ width: 180 }}>Approved by</th><th style={{ width: 140 }}>Date</th><th style={{ width: 110 }}></th></tr></thead>
            <tbody>
              {D.sources.map(s => (
                <tr key={s.id}>
                  <td><span className="badge">{s.kind}</span></td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{s.uri}</td>
                  <td><StatusBadge s={s.status === "allowed" ? "approved" : s.status === "pending" ? "pending" : "rejected"} /></td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{s.approvedBy || "—"}</td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{s.approvedAt || "—"}</td>
                  <td>{s.status === "pending" && <button className="btn btn-sm">Review</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>
  );
};

// ---------- Suggestions (variant A: cards) ----------
const SuggestionsA = () => (
  <div className="col gap-12" style={{ paddingBottom: 16 }}>
    {D.suggestions.map(sg => (
      <div key={sg.id} className="sugg-card">
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="badge badge-hermes">🧠 hermes</span>
          <span className="badge mono">{sg.kind}</span>
          <span className="mono muted" style={{ fontSize: 11 }}>conf {Math.round(sg.confidence * 100)}%</span>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11 }}>{sg.created}</span>
        </div>
        <h3 style={{ margin: 0, fontSize: 14 }}>{sg.title}</h3>
        <p className="muted" style={{ margin: "4px 0 8px", fontSize: 12.5 }}>{sg.message}</p>

        {sg.proposed && (
          <div style={{ background: "var(--surface-2)", padding: 8, borderRadius: 4, marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 2 }}>Proposed policy</div>
            <pre className="mono" style={{ margin: 0, fontSize: 11.5 }}>{JSON.stringify(sg.proposed, null, 2)}</pre>
          </div>
        )}
        {sg.proposedMd && (
          <div style={{ background: "var(--surface-2)", padding: 8, borderRadius: 4, marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 2 }}>{sg.target ? `Replacement under ## ${sg.target}` : `Add under ## ${sg.proposedHeading}`}</div>
            <pre className="mono" style={{ margin: 0, fontSize: 11.5, whiteSpace: "pre-wrap" }}>{sg.proposedMd}</pre>
          </div>
        )}

        <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Evidence ({sg.evidence.length})</div>
        <div className="col" style={{ gap: 2, marginBottom: 10 }}>
          {sg.evidence.map((e, i) => (
            <div key={i} className="row" style={{ fontSize: 12 }}>
              <span className="mono" style={{ color: "var(--accent)", width: 80 }}>{e.ticket}</span>
              <span className="muted">{e.reason}</span>
            </div>
          ))}
        </div>

        <div className="row gap-12">
          <button className="btn btn-approve btn-sm">✓ Accept</button>
          <button className="btn btn-sm">Edit & accept</button>
          <button className="btn btn-sm">Dismiss</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost btn-sm">View evidence trail →</button>
        </div>
      </div>
    ))}
  </div>
);

// ---------- Suggestions (variant B: review queue) ----------
const SuggestionsB = () => {
  const [active, setActive] = useState(D.suggestions[0].id);
  const sg = D.suggestions.find(s => s.id === active);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, paddingBottom: 16 }}>
      <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
        <div className="card-head"><div className="h2">Queue · {D.suggestions.length}</div></div>
        {D.suggestions.map(s => (
          <div key={s.id}
               onClick={() => setActive(s.id)}
               style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: active === s.id ? "var(--accent-soft)" : "transparent" }}>
            <div className="row" style={{ marginBottom: 2 }}>
              <span className="badge badge-hermes" style={{ fontSize: 9.5 }}>🧠</span>
              <span className="badge mono" style={{ fontSize: 9.5 }}>{s.kind.replace("_", " ")}</span>
              <span style={{ flex: 1 }} />
              <span className="muted mono" style={{ fontSize: 10 }}>{Math.round(s.confidence * 100)}%</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3 }}>{s.title}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{s.evidence.length} pieces of evidence · {s.created}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head" style={{ background: "var(--hermes-soft)" }}>
          <div className="h2" style={{ color: "var(--hermes)" }}>{sg.title}</div>
          <span className="mono" style={{ fontSize: 11 }}>conf {Math.round(sg.confidence * 100)}%</span>
        </div>
        <div className="card-pad">
          <p style={{ margin: 0 }}>{sg.message}</p>
          <hr className="line" />

          {sg.kind === "policy_suggestion" && (
            <>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Diff against active policies</div>
              <div className="diff" style={{ marginBottom: 12 }}>
                <div className="row hunk"><div className="gutter" /><div className="gutter" /><div className="marker" /><div className="content">@@ property_policies @@</div></div>
                <div className="row add"><div className="gutter" /><div className="gutter">+</div><div className="marker">+</div><div className="content">{`{ kind: "auto_approval", scope: "heating_repair", max_eur: 200, vendor: "Heinz GmbH" }`}</div></div>
              </div>
            </>
          )}

          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Evidence trail</div>
          <table className="table" style={{ marginBottom: 12 }}>
            <thead><tr><th style={{ width: 100 }}>Ticket</th><th>Reason</th><th style={{ width: 110 }}></th></tr></thead>
            <tbody>
              {sg.evidence.map((e, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: "var(--accent)" }}>{e.ticket}</td>
                  <td className="muted">{e.reason}</td>
                  <td><button className="btn btn-sm">Open ticket</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <button className="btn btn-approve">✓ Accept</button>
          <button className="btn">Edit & accept</button>
          <button className="btn">Dismiss with reason</button>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11 }}>Accepting creates {sg.kind === "policy_suggestion" ? "a new policy + audit entry" : "context v12 + audit entry"}</span>
        </div>
      </div>
    </div>
  );
};

const SuggestionsPage = ({ propId, query }) => {
  const prop = propBy(propId);
  const variant = query.get("v") || "a";
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Suggestions" }]}
        actions={<>
          <button className={`btn btn-sm ${variant === "a" ? "btn-primary" : ""}`} onClick={() => go(`/suggestions/${prop.id}?v=a`)}>A · cards</button>
          <button className={`btn btn-sm ${variant === "b" ? "btn-primary" : ""}`} onClick={() => go(`/suggestions/${prop.id}?v=b`)}>B · review queue</button>
          <button className="btn btn-sm">Run Hermes ↻</button>
        </>}
      />
      <Stories items={[{ n: 6, text: "review Hermes' suggestions and accept/dismiss with one click" }]} />
      <ApiStrip endpoints={[`GET /properties/${propId}/suggestions?status=pending`, "POST /suggestions/{id}/accept", "POST /suggestions/{id}/dismiss", "POST /dev/run-hermes"]} />
      <div className="page"><div className="page-inner">
        <div className="row" style={{ marginBottom: 12 }}>
          <h1 className="h1" style={{ margin: 0 }}>Hermes suggestions</h1>
          <span className="badge badge-hermes" style={{ marginLeft: 12 }}>{D.suggestions.length} pending</span>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 12 }}>Last run: 12m ago · Next scheduled: 18m</span>
        </div>
        <p className="subtle">Hermes proposes; humans dispose. Every suggestion carries evidence; nothing auto-applies.</p>
        {variant === "b" ? <SuggestionsB /> : <SuggestionsA />}
      </div></div>
    </div>
  );
};

// ---------- Calls ----------
const CallsPage = ({ propId }) => {
  const prop = propBy(propId);
  const calls = [
    { id: "cs-9921", phone: "+49 174 8821 ****", at: "16:44", dur: "1m 27s", noise: 18.4, ticket: "GAR-118", summary: "Heating cold Unit 3B — Herr Schmidt" },
    { id: "cs-9918", phone: "+49 152 5512 ****", at: "Yesterday 10:12", dur: "2m 04s", noise: 11.2, ticket: "GAR-114", summary: "Intercom not working Unit 5C — Frau Wagner" },
    { id: "cs-9912", phone: "+49 174 8821 ****", at: "Mon 14:33", dur: "0m 48s", noise: 22.1, ticket: "GAR-112", summary: "Heating cold Unit 2B — Herr Bauer" }
  ];
  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Calls" }]}
        actions={<button className="btn btn-sm" onClick={() => go(`/simulate/${prop.id}`)}>▷ Simulate call</button>}
      />
      <Stories items={[
        { n: 8, text: "voice survives noise" },
        { n: 9, text: "tenant: not have to repeat unit/building" }
      ]} />
      <ApiStrip endpoints={["LiveKit webhook → POST /tickets (source=voice)", "ai-coustics SDK in-line", "Deepgram STT"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Voice calls</h1>
        <p className="subtle">Inbound at <span className="mono">{prop.phone}</span> via LiveKit · ai-coustics for noise reduction · Deepgram STT.</p>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table">
            <thead><tr><th style={{ width: 130 }}>Session</th><th>Caller</th><th>Summary</th><th style={{ width: 90 }}>Duration</th><th style={{ width: 110 }}>Noise −dB</th><th style={{ width: 100 }}>Ticket</th></tr></thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} onClick={() => go(`/ticket/t-7831`)}>
                  <td className="mono" style={{ fontSize: 11 }}>{c.id}<div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{c.at}</div></td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{c.phone}</td>
                  <td>{c.summary}</td>
                  <td className="mono">{c.dur}</td>
                  <td><span className="badge badge-approved">−{c.noise} dB</span></td>
                  <td className="mono" style={{ color: "var(--accent)" }}>{c.ticket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>
    </div>
  );
};

// ---------- Simulate ----------
const SimulatePage = ({ propId }) => {
  const prop = propBy(propId);
  const templates = [
    { id: "heating", title: "Heating issue", icon: "🔥", body: "Tenant reports cold radiator, north-facing unit." },
    { id: "noise", title: "Noise complaint", icon: "🔊", body: "Loud music from upstairs unit after 22:00." },
    { id: "repair", title: "Repair request", icon: "🔧", body: "Cabinet hinge broken in kitchen." },
    { id: "lease", title: "Lease question", icon: "📜", body: "Tenant asks about subletting clause." },
    { id: "payment", title: "Payment delay", icon: "💶", body: "Tenant flags late rent transfer." }
  ];
  const fixtures = [
    { id: "noisy_cafe", label: "Café noise · 0:48", desc: "Heavy background chatter, espresso machine" },
    { id: "street", label: "Street noise · 1:14", desc: "Tram + traffic" },
    { id: "kids", label: "Kids in background · 0:52", desc: "Living room with TV + children" }
  ];

  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Properties" }, { label: prop.name, to: `/inbox/${prop.id}` }, { label: "Simulate" }]} actions={null} />
      <Stories items={[
        { n: 1, text: "ingest from any channel" },
        { n: 8, text: "voice survives noise (demo)" }
      ]} />
      <ApiStrip endpoints={["GET /dev/ticket-templates", "POST /dev/simulate-ticket", "POST /tickets"]} />
      <div className="page"><div className="page-inner">
        <div className="row">
          <span className="badge" style={{ background: "var(--warn-soft)", color: "oklch(0.45 0.13 75)" }}>dev only</span>
          <span className="muted" style={{ fontSize: 12 }}>Hidden behind env flag in production. Used for hackathon demo.</span>
        </div>
        <h1 className="h1" style={{ marginTop: 12 }}>Simulate inbound</h1>
        <p className="subtle">Trigger a synthetic ticket or voice call. Both go through the exact same downstream pipeline.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card">
            <div className="card-head"><div className="h2">Simulate ticket</div><span className="mono muted" style={{ fontSize: 11 }}>POST /dev/simulate-ticket</span></div>
            <div className="card-pad">
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Templates</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                {templates.map(t => (
                  <button key={t.id} className="btn" style={{ height: "auto", padding: "10px 12px", textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <div><span style={{ marginRight: 6 }}>{t.icon}</span><b>{t.title}</b></div>
                    <div className="muted" style={{ fontSize: 11.5, fontWeight: 400 }}>{t.body}</div>
                  </button>
                ))}
              </div>
              <div className="field"><label>Source</label>
                <select className="select"><option>email</option><option>slack</option><option>manual</option><option>api</option></select>
              </div>
              <div className="field"><label>Raised by</label><input className="input" placeholder="Herr Schmidt · Unit 3B" /></div>
              <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={() => go(`/inbox/${prop.id}`)}>Create ticket →</button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="h2">Simulate voice call</div>
              <span className="mono muted" style={{ fontSize: 11 }}>POST /dev/simulate-call</span>
            </div>
            <div className="card-pad">
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 6 }}>Audio fixtures</div>
              <div className="col" style={{ gap: 6, marginBottom: 12 }}>
                {fixtures.map(f => (
                  <label key={f.id} style={{ display: "flex", gap: 8, padding: 8, border: "1px solid var(--line)", borderRadius: 4, cursor: "pointer" }}>
                    <input type="radio" name="fix" defaultChecked={f.id === "noisy_cafe"} />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 12.5 }}>{f.label}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{f.desc}</div>
                    </div>
                    <span style={{ marginLeft: "auto" }} className="muted">▶</span>
                  </label>
                ))}
              </div>

              <div className="field"><label>Property (caller resolution)</label>
                <select className="select" defaultValue={prop.id}>{D.properties.map(p => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}</select>
              </div>
              <div className="field"><label>Caller phone (override)</label>
                <input className="input" placeholder="+49 174 8821 ****" defaultValue="+49 174 8821 ****" />
              </div>

              <button className="btn btn-primary btn-lg" style={{ width: "100%", background: "var(--voice)", borderColor: "var(--voice)" }} onClick={() => go(`/ticket/t-7831`)}>📞 Place call →</button>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Pipeline: LiveKit → ai-coustics → Gradium → POST /tickets. Generates a call session, transcript, and proposal in ~3s.</div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  );
};

Object.assign(window, { TicketPage, PoliciesPage, SourcesPage, SuggestionsPage, CallsPage, SimulatePage });
