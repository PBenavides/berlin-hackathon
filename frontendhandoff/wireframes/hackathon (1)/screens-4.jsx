/* screens-4.jsx — Owners, Buildings, Properties list, Property shell (nested tabs),
   PDF Extract, Hermes Chat, updated Coverage */
/* global React, Link, go, D, L, LayerBadge, Stories, ApiStrip, Topbar, RiskBadge, SourceBadge, StatusBadge,
   useState, useEffect, useMemo, useRef, Fragment, propBy, renderInline */

const A = window.BUENA_AGENTS;

// ===================================================================
// Helpers
// ===================================================================
const ownerById = (id) => (L?.owners || []).find(o => o.id === id);
const buildingByProp = (propId) => (L?.buildings || []).find(b => b.propertyId === propId);

const fmt = (n) => n != null ? `€${n.toLocaleString("de-DE")}` : "—";

// ===================================================================
// OWNERS directory
// ===================================================================
const OwnersPage = () => {
  const owners = L?.owners || [];
  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Context layers" }, { label: "Owners" }]}
        actions={<button className="btn btn-sm">+ Add owner</button>} />
      <ApiStrip endpoints={["GET /owners", "POST /owners", "PATCH /owners/{id}", "GET /owners/{id}/properties"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Owners</h1>
        <p className="subtle">Each owner governs one or more properties. Owner-level context (contracts, approval thresholds, communication preferences) flows downstream to every property they own.</p>
        <div className="layer-cascade" style={{ marginBottom: 20 }}>
          <LayerBadge layer="owner" /> → <LayerBadge layer="building" /> → <LayerBadge layer="property" />
          <span className="dim" style={{ fontSize: 11, marginLeft: 8 }}>Context propagation direction</span>
        </div>
        <div className="col gap-12">
          {owners.map(o => {
            const props = D.properties.filter(p => o.properties.includes(p.id));
            return (
              <div key={o.id} className="card" style={{ cursor: "pointer" }} onClick={() => go(`/owner/${o.id}`)}>
                <div className="card-head">
                  <div className="row" style={{ gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>
                      {o.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{o.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{o.type} · since {o.since} · {o.contact}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="badge mono">{o.properties.length} {o.properties.length === 1 ? "property" : "properties"}</span>
                    <button className="btn btn-sm" onClick={e => { e.stopPropagation(); go(`/owner/${o.id}`); }}>Open →</button>
                  </div>
                </div>
                <div className="card-pad">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Portfolio revenue YTD</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{fmt(o.portfolioRevenueYTD)}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Active contracts</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{o.contracts.filter(c => c.status === "active").length}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Properties</div>
                      <div style={{ fontSize: 12.5, marginTop: 2 }}>
                        {props.map(p => <span key={p.id} className="badge" style={{ marginRight: 4 }}>{p.name}</span>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 4, fontSize: 11.5 }}>
                    <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Context notes (upstream — applies to all properties)</div>
                    <ul style={{ margin: 0, paddingLeft: 16, color: "var(--ink-2)", lineHeight: 1.7 }}>
                      {o.contextNotes.slice(0, 2).map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div></div>
    </div>
  );
};

// ===================================================================
// OWNER detail
// ===================================================================
const OwnerDetailPage = ({ ownerId }) => {
  const o = ownerById(ownerId) || (L?.owners || [])[0];
  const [tab, setTab] = useState("profile");
  const props = D.properties.filter(p => o.properties.includes(p.id));

  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Owners", to: "/owners" }, { label: o.name }]}
        actions={<button className="btn btn-sm">Edit context</button>}
      />
      <ApiStrip endpoints={[`GET /owners/${ownerId}`, `GET /owners/${ownerId}/properties`, `GET /owners/${ownerId}/contracts`, `GET /owners/${ownerId}/revenue`]} />
      <div className="page"><div className="page-inner">
        <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <LayerBadge layer="owner" />
                <h1 className="h1" style={{ margin: 0 }}>{o.name}</h1>
                <span className="badge">{o.type}</span>
              </div>
              <div className="muted">{o.contact} · <span className="mono">{o.email}</span> · <span className="mono">{o.phone}</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 10.5 }}>Revenue YTD</div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>{fmt(o.portfolioRevenueYTD)}</div>
            </div>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 14 }}>
          {["profile", "properties", "contracts", "context"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card card-pad">
              <div className="h2" style={{ marginBottom: 10 }}>Recent decisions</div>
              <div className="col" style={{ gap: 8 }}>
                {o.decisions.map((d, i) => (
                  <div key={i} style={{ paddingBottom: 8, borderBottom: "1px solid var(--line)", lastChild: { border: "none" } }}>
                    <div className="mono dim" style={{ fontSize: 10.5, marginBottom: 2 }}>{d.ts}</div>
                    <div style={{ fontSize: 12.5 }}>{d.text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card card-pad">
              <div className="h2" style={{ marginBottom: 10 }}>Properties</div>
              {props.map(p => {
                const pTickets = (A?.pipeline || []).filter(t => t.property === p.id && t.stage !== "done");
                return (
                  <div key={p.id} onClick={() => go(`/property/${p.id}/overview`)} style={{ cursor: "pointer", padding: "8px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{p.units} units · {p.city}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {pTickets.length > 0 && <span className="badge">{pTickets.length} open</span>}
                      <span className="badge mono">v{p.version}</span>
                      <span className="muted" style={{ fontSize: 12 }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "properties" && (
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="table">
              <thead><tr><th>Property</th><th>City</th><th style={{ width: 80 }}>Units</th><th style={{ width: 100 }}>Context</th><th style={{ width: 100 }}>Open tickets</th><th style={{ width: 90 }}></th></tr></thead>
              <tbody>
                {props.map(p => (
                  <tr key={p.id} onClick={() => go(`/property/${p.id}/overview`)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td className="muted">{p.city}</td>
                    <td className="mono">{p.units}</td>
                    <td><span className="badge mono">v{p.version}</span></td>
                    <td>{p.openTickets > 0 ? <span className="badge" style={{ background: "#FDECEC", color: "#B23A3A" }}>{p.openTickets}</span> : <span className="dim">—</span>}</td>
                    <td><button className="btn btn-sm">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "contracts" && (
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="table">
              <thead><tr><th>Contract</th><th style={{ width: 100 }}>Status</th><th style={{ width: 160 }}>Until</th><th style={{ width: 200 }}>File</th></tr></thead>
              <tbody>
                {o.contracts.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.title}</td>
                    <td><StatusBadge s={c.status} /></td>
                    <td className="mono muted">{c.until}</td>
                    <td className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{c.file}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "context" && (
          <div>
            <p className="subtle">Owner-level context chunks flow downstream to every property under this owner. They are always loaded by the proposal pipeline alongside property-level context.</p>
            <div className="col gap-12">
              {o.contextNotes.map((note, i) => (
                <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <LayerBadge layer="owner" />
                    <div style={{ marginTop: 6, fontSize: 13 }}>{note}</div>
                  </div>
                  <button className="btn btn-sm">Edit</button>
                </div>
              ))}
              <button className="btn btn-sm" style={{ alignSelf: "flex-start" }}>+ Add context note</button>
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
};

// ===================================================================
// BUILDINGS directory
// ===================================================================
const BuildingsPage = () => {
  const buildings = L?.buildings || [];
  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Context layers" }, { label: "Buildings" }]} actions={null} />
      <ApiStrip endpoints={["GET /buildings", "GET /buildings/{id}", "GET /buildings/{id}/past-cases"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Buildings</h1>
        <p className="subtle">Physical structure context: heating system, past cases, attached vendors, and building-level events. Sits between Owner and Property in the context hierarchy.</p>
        <div className="col gap-12">
          {buildings.map(b => {
            const prop = D.properties.find(p => p.id === b.propertyId);
            const owner = (L?.owners || []).find(o => o.properties.includes(b.propertyId));
            return (
              <div key={b.id} className="card" style={{ cursor: "pointer" }} onClick={() => go(`/building/${b.id}`)}>
                <div className="card-head">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>Built {b.year} · restored {b.restored} · {b.heating}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {owner && <span className="badge" style={{ background: "#F1EBFA", color: "#7A4FB6" }}>{owner.name}</span>}
                    <LayerBadge layer="building" />
                    <button className="btn btn-sm">Open →</button>
                  </div>
                </div>
                <div className="card-pad">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Attached vendors</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {b.attachedVendors.map(vid => {
                          const v = (A?.vendors || []).find(vv => vv.id === vid);
                          return v ? <span key={vid} className="badge" style={{ fontSize: 10.5 }}>{v.name}</span> : null;
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Past cases</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{b.pastCases.length}</div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Latest event</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{b.events[0]?.text?.slice(0, 60)}…</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div></div>
    </div>
  );
};

// ===================================================================
// BUILDING detail
// ===================================================================
const BuildingDetailPage = ({ buildingId }) => {
  const b = (L?.buildings || []).find(x => x.id === buildingId) || (L?.buildings || [])[0];
  const [tab, setTab] = useState("overview");
  const prop = D.properties.find(p => p.id === b.propertyId);
  const owner = (L?.owners || []).find(o => o.properties.includes(b.propertyId));

  return (
    <div className="main">
      <Topbar
        crumbs={[{ label: "Buildings", to: "/buildings" }, { label: b.name }]}
        actions={<button className="btn btn-sm" onClick={() => go(`/property/${b.propertyId}/overview`)}>Property →</button>}
      />
      <ApiStrip endpoints={[`GET /buildings/${buildingId}`, `GET /buildings/${buildingId}/past-cases`, `GET /buildings/${buildingId}/context`]} />
      <div className="page"><div className="page-inner">
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <LayerBadge layer="building" />
                {owner && <span className="badge" style={{ background: "#F1EBFA", color: "#7A4FB6" }}>{owner.name}</span>}
                {prop && <span className="badge">{prop.name}</span>}
              </div>
              <h1 className="h1" style={{ margin: 0 }}>{b.name}</h1>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Built {b.year} · restored {b.restored} · {b.heating}</div>
            </div>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 14 }}>
          {["overview", "past cases", "context"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card card-pad">
              <div className="h2" style={{ marginBottom: 8 }}>Recent events</div>
              {b.events.map((e, i) => (
                <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="mono dim" style={{ fontSize: 10.5 }}>{e.ts}</div>
                  <div style={{ fontSize: 12.5, marginTop: 2 }}>{e.text}</div>
                </div>
              ))}
            </div>
            <div className="card card-pad">
              <div className="h2" style={{ marginBottom: 8 }}>Attached vendors</div>
              {b.attachedVendors.map(vid => {
                const v = (A?.vendors || []).find(vv => vv.id === vid);
                if (!v) return null;
                return (
                  <div key={vid} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{v.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{v.trade} · reliability {Math.round(v.reliability * 100)}%</div>
                    </div>
                    <button className="btn btn-sm" onClick={() => go("/vendors")}>View →</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "past cases" && (
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="table">
              <thead><tr><th style={{ width: 120 }}>Date</th><th>Title</th><th style={{ width: 180 }}>Vendor</th><th style={{ width: 200 }}>Outcome</th></tr></thead>
              <tbody>
                {b.pastCases.map(c => (
                  <tr key={c.id}>
                    <td className="mono muted" style={{ fontSize: 11 }}>{c.date}</td>
                    <td>{c.title}</td>
                    <td className="muted">{c.vendor}</td>
                    <td style={{ fontSize: 12 }}>{c.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "context" && (
          <div>
            <p className="subtle">Building-level context flows downstream to the property. Upstream owner context is also loaded. These chunks inform every proposal at this property.</p>
            <div className="col gap-12">
              {b.contextNotes.map((note, i) => (
                <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <LayerBadge layer="building" />
                    <div style={{ marginTop: 6, fontSize: 13 }}>{note}</div>
                  </div>
                  <button className="btn btn-sm">Edit</button>
                </div>
              ))}
              <button className="btn btn-sm" style={{ alignSelf: "flex-start" }}>+ Add context note</button>
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
};

// ===================================================================
// PROPERTIES list
// ===================================================================
const PropertiesPage = () => (
  <div className="main">
    <Topbar crumbs={[{ label: "Context layers" }, { label: "Properties" }]}
      actions={<button className="btn btn-sm">+ Add property</button>} />
    <ApiStrip endpoints={["GET /properties", "POST /properties"]} />
    <div className="page"><div className="page-inner">
      <h1 className="h1">Properties</h1>
      <p className="subtle">Leaf nodes in the context hierarchy. Each property inherits context from its building and owner layers.</p>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th>Property</th><th>Owner</th><th style={{ width: 80 }}>Units</th><th style={{ width: 100 }}>Context</th><th style={{ width: 110 }}>Open tickets</th><th style={{ width: 80 }}>Phone</th><th style={{ width: 80 }}></th></tr></thead>
          <tbody>
            {D.properties.map(p => {
              const owner = (L?.owners || []).find(o => o.properties.includes(p.id));
              return (
                <tr key={p.id} onClick={() => go(`/property/${p.id}/overview`)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{p.city}</div>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{owner?.name || "—"}</td>
                  <td className="mono">{p.units}</td>
                  <td><span className="badge mono">v{p.version}</span></td>
                  <td>{p.openTickets > 0 ? <span className="badge" style={{ background: "#FDECEC", color: "#B23A3A" }}>{p.openTickets}</span> : <span className="dim">—</span>}</td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{p.phone}</td>
                  <td><button className="btn btn-sm">Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div></div>
  </div>
);

// ===================================================================
// PROPERTY SHELL with nested tabs
// ===================================================================
const PropertyShell = ({ propId, tab: activeTab }) => {
  const prop = D.properties.find(p => p.id === propId) || D.properties[0];
  const owner = (L?.owners || []).find(o => o.properties.includes(propId));
  const building = buildingByProp(propId);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "tickets", label: `Tickets${prop.openTickets > 0 ? ` (${prop.openTickets})` : ""}` },
    { id: "units", label: "Units & Owners" },
    { id: "context", label: `Context v${prop.version}` },
    { id: "editor", label: "Editor" },
    { id: "versions", label: "Versions" },
    { id: "sources", label: "Sources" },
    { id: "policies", label: "Policies" },
    { id: "calls", label: "Calls" },
    { id: "audit", label: "Audit" }
  ];

  return (
    <div className="main">
      <Topbar
        crumbs={[
          { label: "Properties", to: "/properties" },
          { label: prop.name }
        ]}
        actions={<>
          {owner && <Link to={`/owner/${owner.id}`} className="badge" style={{ background: "#F1EBFA", color: "#7A4FB6", cursor: "pointer", textDecoration: "none" }}>{owner.name} ↗</Link>}
          {building && <Link to={`/building/${building.id}`} className="badge" style={{ background: "#E6F0FB", color: "#3D7CC9", cursor: "pointer", textDecoration: "none" }}>Building ↗</Link>}
        </>}
      />

      {/* Property header strip */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "10px 20px", background: "var(--surface)", display: "flex", gap: 20, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{prop.name}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{prop.units} units · {prop.city} · <span className="mono">{prop.phone}</span></div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <LayerBadge layer="property" />
        </div>
      </div>

      {/* Nested tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--line)", background: "var(--surface)", padding: "0 16px" }}>
        {tabs.map(t => (
          <button key={t.id}
            className={`property-tab${activeTab === t.id ? " active" : ""}`}
            onClick={() => go(`/property/${propId}/${t.id}`)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="page">
        {activeTab === "overview" && <PropertyOverviewTab prop={prop} building={building} owner={owner} />}
        {activeTab === "tickets" && <PropertyTicketsTab prop={prop} />}
        {activeTab === "units" && <PropertyUnitsTab prop={prop} building={building} />}
        {activeTab === "context" && <PropertyContextTab propId={propId} prop={prop} />}
        {activeTab === "editor" && <PropertyEditorTab prop={prop} />}
        {activeTab === "versions" && <PropertyVersionsTab prop={prop} />}
        {activeTab === "sources" && <PropertySourcesTab prop={prop} />}
        {activeTab === "policies" && <PropertyPoliciesTab prop={prop} />}
        {activeTab === "calls" && <PropertyCallsTab prop={prop} />}
        {activeTab === "audit" && <PropertyAuditTab prop={prop} />}
      </div>
    </div>
  );
};

// --- Property tab content components ---

const PropertyOverviewTab = ({ prop, building, owner }) => {
  const pipeline = (A?.pipeline || []).filter(t => t.property === prop.id && t.stage !== "done");
  const suggestions = (D?.suggestions || []);
  return (
    <div className="page-inner">
      <ApiStrip endpoints={[`GET /properties/${prop.id}`, `GET /properties/${prop.id}/messages`]} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 6 }}>Context layers active</div>
          <div className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 6 }}>
              <LayerBadge layer="vendor" /><span className="muted" style={{ fontSize: 11.5 }}>{(A?.vendors || []).filter(v => v.properties.includes(prop.id)).length} attached</span>
            </div>
            {owner && <div className="row" style={{ gap: 6 }}><LayerBadge layer="owner" /><span className="muted" style={{ fontSize: 11.5 }}>{owner.name}</span></div>}
            {building && <div className="row" style={{ gap: 6 }}><LayerBadge layer="building" /><span className="muted" style={{ fontSize: 11.5 }}>{building.name}</span></div>}
            <div className="row" style={{ gap: 6 }}><LayerBadge layer="property" /><span className="badge mono">v{prop.version}</span></div>
          </div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 6 }}>Open tickets</div>
          <div style={{ fontWeight: 700, fontSize: 28 }}>{pipeline.length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>across {[...new Set(pipeline.map(t => t.stage))].length} stages</div>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => go(`/property/${prop.id}/tickets`)}>View all →</button>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 6 }}>Hermes suggestions</div>
          <div style={{ fontWeight: 700, fontSize: 28 }} >{suggestions.length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>pending review</div>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => go(`/suggestions/${prop.id}`)}>Review →</button>
        </div>
      </div>

      {building && building.events.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="h2" style={{ margin: 0 }}>Building events</div>
            <LayerBadge layer="building" />
            <Link to={`/building/${building.id}`} className="muted" style={{ marginLeft: "auto", fontSize: 11.5 }}>View building →</Link>
          </div>
          {building.events.slice(0, 2).map((e, i) => (
            <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
              <span className="mono dim" style={{ marginRight: 8 }}>{e.ts.split(" ")[0]}</span>{e.text}
            </div>
          ))}
        </div>
      )}

      <div className="card card-pad">
        <div className="h2" style={{ marginBottom: 8 }}>Recent activity</div>
        {(D.audit || []).slice(0, 5).map((r, i) => (
          <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
            <span className="mono dim" style={{ fontSize: 10.5, width: 80 }}>{r.ts}</span>
            <span className="muted" style={{ width: 110 }}>{r.actor}</span>
            <span>{r.action}</span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>{r.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PropertyTicketsTab = ({ prop }) => {
  const [view, setView] = useState("unsolved"); // unsolved | all | resolved
  const [sort, setSort] = useState("newest");

  const allTickets = D.tickets.filter(t => t.property === prop.id);
  const unsolved = allTickets.filter(t => !["resolved", "rejected"].includes(t.status));
  const resolved = allTickets.filter(t => ["resolved", "rejected"].includes(t.status));

  const displayed = view === "unsolved" ? unsolved : view === "resolved" ? resolved : allTickets;

  const sorted = [...displayed].sort((a, b) => {
    if (sort === "newest") return 0; // already newest-first in seed data
    if (sort === "risk") {
      const rv = { high: 0, medium: 1, low: 2 };
      return (rv[a.risk] ?? 3) - (rv[b.risk] ?? 3);
    }
    return 0;
  });

  const awaitingApproval = unsolved.filter(t => t.status === "proposed").length;

  return (
    <div className="page-inner">
      <ApiStrip endpoints={[`GET /properties/${prop.id}/tickets`, `POST /properties/${prop.id}/messages`]} />

      {/* Awaiting approval callout */}
      {awaitingApproval > 0 && view === "unsolved" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: "#FBF3E7", border: "1px solid #E9C97B", borderRadius: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{awaitingApproval} ticket{awaitingApproval > 1 ? "s" : ""} awaiting your approval</div>
            <div className="muted" style={{ fontSize: 11.5 }}>AI proposals ready — review and approve to dispatch vendor.</div>
          </div>
        </div>
      )}

      {/* Tab bar + sort */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
          {[
            { id: "unsolved", label: "Unsolved", count: unsolved.length },
            { id: "all",      label: "All",      count: allTickets.length },
            { id: "resolved", label: "Resolved", count: resolved.length },
          ].map(t => (
            <button key={t.id}
              onClick={() => setView(t.id)}
              style={{
                padding: "6px 14px", border: "1px solid var(--line)", marginRight: -1,
                background: view === t.id ? "var(--accent)" : "var(--surface)",
                color: view === t.id ? "#fff" : "var(--ink-2)",
                fontWeight: view === t.id ? 600 : 400,
                fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-sans)",
                borderRadius: t.id === "unsolved" ? "5px 0 0 5px" : t.id === "resolved" ? "0 5px 5px 0" : "0",
                zIndex: view === t.id ? 1 : 0, position: "relative"
              }}>
              {t.label}
              <span style={{
                marginLeft: 6, padding: "1px 6px", borderRadius: 8, fontSize: 10.5,
                background: view === t.id ? "rgba(255,255,255,0.25)" : "var(--surface-2)",
                color: view === t.id ? "#fff" : "var(--ink-3)"
              }}>{t.count}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 11.5 }}>Sort:</span>
          <select className="select-sm" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="risk">Risk (high → low)</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-4)", padding: 32 }}>
          {view === "unsolved" ? "🎉 No unsolved tickets" : "No tickets found"}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Source</th>
                <th style={{ width: 80 }}>ID</th>
                <th>Subject</th>
                <th style={{ width: 170 }}>Raised by</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 80 }}>Risk</th>
                <th style={{ width: 72 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr key={t.id} onClick={() => go(`/ticket/${t.id}`)} style={{ cursor: "pointer", background: t.status === "proposed" ? "oklch(0.99 0.02 75)" : undefined }}>
                  <td><SourceBadge s={t.source} /></td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{t.num}</td>
                  <td>
                    <div style={{ fontWeight: t.status === "proposed" ? 600 : 500 }}>{t.subject}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{t.excerpt?.slice(0, 70)}{t.excerpt?.length > 70 ? "…" : ""}</div>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{t.raisedBy}</td>
                  <td><StatusBadge s={t.status} /></td>
                  <td><RiskBadge r={t.risk} /></td>
                  <td className="muted mono" style={{ fontSize: 11 }}>{t.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row muted" style={{ marginTop: 10, fontSize: 11 }}>
        <span className="kbd">↑↓</span> navigate · <span className="kbd">↵</span> open · <span className="kbd">/</span> search
      </div>
    </div>
  );
};

const PropertyContextTab = ({ propId, prop }) => {
  const md = D.contextV11;
  const lines = md.split("\n");
  const rendered = [];
  let inYaml = false, ul = null;
  lines.forEach((l, i) => {
    if (l === "---") { inYaml = !inYaml; if (!inYaml) rendered.push(<div className="yaml" key={i}>{lines.slice(1, i).join("\n")}</div>); return; }
    if (inYaml) return;
    if (l.startsWith("## ")) { ul && rendered.push(<ul key={"ul" + i}>{ul}</ul>); ul = null; rendered.push(<h2 id={l.slice(3).toLowerCase().replace(/\s/g, "-")} key={i}>{l.slice(3)}</h2>); return; }
    if (l.startsWith("- ")) { ul = ul || []; ul.push(<li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l.slice(2)) }} />); return; }
    if (ul) { rendered.push(<ul key={"ul" + i}>{ul}</ul>); ul = null; }
    if (l.trim() === "") return;
    rendered.push(<p key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />);
  });
  if (ul) rendered.push(<ul key="ul-end">{ul}</ul>);

  return (
    <div className="page-inner" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
      <aside style={{ position: "sticky", top: 0, alignSelf: "start" }}>
        <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.06, marginBottom: 6 }}>On this page</div>
        {["Basics", "Tenants", "Known issues", "Policies", "Source documents"].map(h => (
          <a key={h} href={`#${h.toLowerCase().replace(/\s/g, "-")}`} style={{ display: "block", padding: "4px 0", color: "var(--ink-2)", fontSize: 12.5, textDecoration: "none" }}>{h}</a>
        ))}
        <hr className="line" />
        <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Last updated</div>
        <div className="mono" style={{ fontSize: 11.5 }}>2026-04-24 16:42</div>
        <div className="muted" style={{ fontSize: 11 }}>maria@buena.io</div>
        <hr className="line" />
        <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Active layers</div>
        <div className="col" style={{ gap: 4 }}>
          <LayerBadge layer="vendor" /><LayerBadge layer="owner" /><LayerBadge layer="building" /><LayerBadge layer="property" />
        </div>
      </aside>
      <div>
        <ApiStrip endpoints={[`GET /properties/${propId}/context`, `GET /properties/${propId}/context/versions`]} />
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge mono">v{prop.version} · current</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => go(`/property/${propId}/versions`)}>History</button>
          <button className="btn btn-primary btn-sm" onClick={() => go(`/property/${propId}/editor`)}>Edit</button>
        </div>
        <div className="card card-pad md">{rendered}</div>
      </div>
    </div>
  );
};

const PropertyEditorTab = ({ prop }) => {
  const lines = D.contextV11.split("\n");
  return (
    <div className="page-inner" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      <div>
        <ApiStrip endpoints={[`POST /properties/${prop.id}/context`, "body: { content_md, reason, created_by }"]} />
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge">Markdown</span>
          <span className="muted mono" style={{ fontSize: 11 }}>· {lines.length} lines</span>
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
            <div className="field"><label>Reason for change</label><textarea className="textarea" defaultValue="Added Unit 3B mobility note." /></div>
            <div className="field"><label>Author</label><input className="input" value={D.operator.email} readOnly /></div>
            <button className="btn btn-primary btn-lg" style={{ width: "100%" }}>Save v{prop.version + 1}</button>
          </div>
        </div>
      </aside>
    </div>
  );
};

const PropertyVersionsTab = ({ prop }) => (
  <div className="page-inner">
    <ApiStrip endpoints={[`GET /properties/${prop.id}/context/versions`, `GET /properties/${prop.id}/context/diff?from=10&to=11`]} />
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="table">
        <thead><tr><th style={{ width: 60 }}>Version</th><th>Author</th><th style={{ width: 150 }}>When</th><th>Reason</th></tr></thead>
        <tbody>
          {D.versions.map((v, i) => (
            <tr key={v.v}>
              <td><span className="mono" style={{ fontWeight: 600 }}>v{v.v}</span>{i === 0 && <span className="badge badge-approved" style={{ marginLeft: 6 }}>current</span>}</td>
              <td>
                {v.flagHermes && <span className="badge badge-hermes" style={{ marginRight: 4 }}>🧠</span>}
                <span className="mono" style={{ fontSize: 11.5 }}>{v.by}</span>
              </td>
              <td className="mono muted" style={{ fontSize: 11 }}>{v.at}</td>
              <td>{v.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PropertySourcesTab = ({ prop }) => (
  <div className="page-inner">
    <ApiStrip endpoints={[`GET /properties/${prop.id}/sources`, "POST /sources", "PATCH /sources/{id}"]} />
    <div className="row" style={{ marginBottom: 10 }}>
      <h2 className="h2" style={{ margin: 0 }}>Allowlisted sources</h2>
      <button className="btn btn-sm" style={{ marginLeft: "auto" }}>+ Register source</button>
    </div>
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="table">
        <thead><tr><th style={{ width: 80 }}>Kind</th><th>URI</th><th style={{ width: 100 }}>Status</th><th style={{ width: 180 }}>Approved by</th><th style={{ width: 130 }}>Date</th><th style={{ width: 90 }}></th></tr></thead>
        <tbody>
          {D.sources.map(s => (
            <tr key={s.id}>
              <td><span className="badge">{s.kind}</span></td>
              <td className="mono" style={{ fontSize: 11.5 }}>{s.uri}</td>
              <td><StatusBadge s={s.status === "allowed" ? "approved" : s.status} /></td>
              <td className="mono muted" style={{ fontSize: 11 }}>{s.approvedBy || "—"}</td>
              <td className="mono muted" style={{ fontSize: 11 }}>{s.approvedAt || "—"}</td>
              <td>{s.status === "pending" && <button className="btn btn-sm">Review</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PropertyPoliciesTab = ({ prop }) => {
  const [editing, setEditing] = useState(null);
  return (
    <div className="page-inner">
      <ApiStrip endpoints={[`GET /properties/${prop.id}/policies`, `POST /properties/${prop.id}/policies`, "PATCH /policies/{id}"]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 className="h2" style={{ margin: 0 }}>Policies</h2>
        <button className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }}>+ New policy</button>
      </div>
      <p className="subtle" style={{ marginBottom: 12 }}>Curated by humans. Loaded by the proposal pipeline at request time.</p>
      <div className="col gap-12">
        {D.policies.map(p => (
          <div key={p.id} className="card">
            <div className="card-head">
              <div className="row"><span className={`badge ${p.active ? "badge-approved" : ""}`}><span className="badge-dot" />{p.active ? "active" : "off"}</span><span style={{ fontWeight: 500, marginLeft: 4 }}>{p.title}</span></div>
              <div className="row"><span className="muted" style={{ fontSize: 11 }}>updated {p.updated}</span><button className="btn btn-sm" onClick={() => setEditing(p.id)}>Edit</button></div>
            </div>
            <div className="card-pad" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{p.ruleText}</div>
          </div>
        ))}
      </div>
      {editing && (
        <div className="modal-bg" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-head"><div className="h2">Edit policy</div><button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button></div>
            <div className="card-pad">
              <div className="field"><label>Rule text</label><textarea className="textarea" defaultValue={D.policies.find(p => p.id === editing)?.ruleText} /></div>
            </div>
            <div className="card-foot" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setEditing(null)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PropertyCallsTab = ({ prop }) => {
  const calls = [
    { id: "cs-9921", phone: "+49 174 8821 ****", at: "16:44", dur: "1m 27s", noise: 18.4, ticket: "GAR-118", summary: "Heating cold Unit 3B — Herr Schmidt" },
    { id: "cs-9918", phone: "+49 152 5512 ****", at: "Yesterday 10:12", dur: "2m 04s", noise: 11.2, ticket: "GAR-114", summary: "Intercom not working Unit 5C — Frau Wagner" }
  ];
  return (
    <div className="page-inner">
      <ApiStrip endpoints={["LiveKit webhook → POST /tickets (source=voice)", "ai-coustics SDK in-line"]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 className="h2" style={{ margin: 0 }}>Voice calls</h2>
        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>Inbound at <span className="mono">{prop.phone}</span></span>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead><tr><th style={{ width: 130 }}>Session</th><th>Caller</th><th>Summary</th><th style={{ width: 90 }}>Duration</th><th style={{ width: 110 }}>Noise −dB</th><th style={{ width: 100 }}>Ticket</th></tr></thead>
          <tbody>
            {calls.map(c => (
              <tr key={c.id} onClick={() => go(`/ticket/t-7831`)}>
                <td className="mono" style={{ fontSize: 11 }}>{c.id}<div className="muted" style={{ fontSize: 10.5 }}>{c.at}</div></td>
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
    </div>
  );
};

const PropertyAuditTab = ({ prop }) => (
  <div className="page-inner">
    <ApiStrip endpoints={[`GET /audit?property_id=${prop.id}`, "GET /audit?actor=hermes"]} />
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="audit-row" style={{ background: "var(--surface-2)", color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", fontWeight: 500 }}>
        <div>Time</div><div>Actor</div><div>Action</div><div>Detail</div><div>Entity</div>
      </div>
      {D.audit.map((r, i) => (
        <div key={i} className="audit-row">
          <div className="ts">2026-04-25 {r.ts}</div>
          <div className="actor">{r.actor === "hermes" && <span className="badge badge-hermes" style={{ marginRight: 4 }}>🧠</span>}{r.actor}</div>
          <div className="action">{r.action}</div>
          <div className="muted">{r.meta}</div>
          <div className="mono dim" style={{ fontSize: 11 }}>{r.entity}</div>
        </div>
      ))}
    </div>
  </div>
);

// ===================================================================
// PROPERTY UNITS TAB — Einheiten + Eigentümer (WEG unit owners)
// ===================================================================
const UNITS_SEED = [
  { id: "u-1a", haus: "b1", typ: "residential", qm: 62, mea: 78, owner: "Frau Becker", ownerSince: 2014, tenant: "Frau Becker (self)", rent: null, beirat: false },
  { id: "u-2b", haus: "b1", typ: "residential", qm: 71, mea: 89, owner: "Herr Bauer", ownerSince: 2019, tenant: "Herr Bauer (self)", rent: null, beirat: false },
  { id: "u-3b", haus: "b1", typ: "residential", qm: 58, mea: 73, owner: "Schmidt GbR", ownerSince: 2002, tenant: "Herr Schmidt", rent: 890, beirat: false },
  { id: "u-4a", haus: "b1", typ: "residential", qm: 84, mea: 105, owner: "Frau Müller", ownerSince: 2021, tenant: "Frau Müller (self)", rent: null, beirat: false },
  { id: "u-5c", haus: "b1", typ: "residential", qm: 55, mea: 69, owner: "Wagner KG", ownerSince: 2017, tenant: "Frau Wagner", rent: 840, beirat: false },
  { id: "u-6b", haus: "b1", typ: "residential", qm: 66, mea: 83, owner: "Ostrowski GmbH", ownerSince: 2020, tenant: "Herr Ostrowski", rent: 970, beirat: false },
  { id: "u-7a", haus: "b1", typ: "residential", qm: 90, mea: 113, owner: "Herr Klein", ownerSince: 2008, tenant: "Herr Klein (self)", rent: null, beirat: true },
  { id: "u-e1", haus: "b1", typ: "commercial", qm: 120, mea: 150, owner: "Klein Invest UG", ownerSince: 2015, tenant: "Café Bernstein", rent: 2400, beirat: false },
];

const PropertyUnitsTab = ({ prop, building }) => {
  const [filter, setFilter] = useState("all");
  const units = UNITS_SEED.filter(u => filter === "all" ? true : filter === "rented" ? u.rent != null : u.typ === filter);
  const totalMEA = UNITS_SEED.reduce((s, u) => s + u.mea, 0);

  return (
    <div className="page-inner">
      <ApiStrip endpoints={[`GET /properties/${prop.id}/units`, `GET /properties/${prop.id}/owners`]} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Total units</div>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{UNITS_SEED.length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{UNITS_SEED.filter(u => u.typ === "residential").length} residential · {UNITS_SEED.filter(u => u.typ === "commercial").length} commercial</div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Unit owners (Eigentümer)</div>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{new Set(UNITS_SEED.map(u => u.owner)).size}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{UNITS_SEED.filter(u => u.beirat).length} Verwaltungsbeirat</div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", marginBottom: 4 }}>Rented out</div>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{UNITS_SEED.filter(u => u.rent).length}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>Monthly rent: €{UNITS_SEED.filter(u => u.rent).reduce((s, u) => s + u.rent, 0).toLocaleString("de-DE")}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all","All"], ["residential","Residential"], ["commercial","Commercial"], ["rented","Rented out"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: "5px 12px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 5, cursor: "pointer",
              background: filter === k ? "var(--accent)" : "var(--surface)", color: filter === k ? "#fff" : "var(--ink-2)",
              fontFamily: "var(--font-sans)" }}>
            {l}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Unit</th>
              <th style={{ width: 90 }}>Type</th>
              <th style={{ width: 80 }}>Area m²</th>
              <th style={{ width: 80 }}>MEA ‰</th>
              <th>Owner (Eigentümer)</th>
              <th>Tenant / Occupant</th>
              <th style={{ width: 100 }}>Monthly rent</th>
              <th style={{ width: 80 }}>Beirat</th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{u.id.replace("u-","").toUpperCase()}</td>
                <td><span className={`badge ${u.typ === "commercial" ? "" : "badge-ok"}`}>{u.typ}</span></td>
                <td className="mono">{u.qm}</td>
                <td className="mono muted">{u.mea} <span style={{ fontSize: 10, color: "var(--ink-4)" }}>/ {totalMEA}</span></td>
                <td>
                  <div style={{ fontWeight: 500 }}>{u.owner}</div>
                  <div className="muted" style={{ fontSize: 11 }}>since {u.ownerSince}</div>
                </td>
                <td className="muted" style={{ fontSize: 12.5 }}>{u.tenant}</td>
                <td className="mono">{u.rent ? `€${u.rent.toLocaleString("de-DE")}` : <span className="dim">self-use</span>}</td>
                <td>{u.beirat ? <span className="badge badge-approved" style={{ fontSize: 11 }}>✓ Beirat</span> : <span className="dim">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad" style={{ marginTop: 14, background: "#F9F5FF", border: "1px solid #D8CAEE" }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#7A4FB6", marginBottom: 6 }}>WEG context note</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          Unit owners (Eigentümer) are governed by the WEG agreement. Any repair &gt; €1,000 requires written board sign-off from the Verwaltungsbeirat (Herr Klein, Unit 7A). Owner-level context is inherited from <Link to="/owner/o1" style={{ color: "#7A4FB6" }}>WEG Gartenstraße 42 →</Link>
        </div>
      </div>
    </div>
  );
};

// ===================================================================
// VENDOR detail with cases
// ===================================================================
const VendorDetailPage = ({ vendorId }) => {
  const v = (A?.vendors || []).find(vv => vv.id === vendorId) || (A?.vendors || [])[0];
  const [tab, setTab] = useState("cases");
  const cases = (L?.vendorCases || {})[v.id] || [];

  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Vendors", to: "/vendors" }, { label: v.name }]} actions={null} />
      <ApiStrip endpoints={[`GET /vendors/${vendorId}`, `GET /vendors/${vendorId}/jobs`, `PATCH /vendors/${vendorId}`]} />
      <div className="page"><div className="page-inner">
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <LayerBadge layer="vendor" />
                <span className="badge">{v.trade}</span>
                <span className={`badge ${v.active ? "badge-ok" : "badge-blocked"}`}>{v.active ? "active" : "blocked"}</span>
              </div>
              <h1 className="h1" style={{ margin: 0 }}>{v.name}</h1>
              <div className="muted" style={{ fontSize: 12 }}><span className="mono">{v.contact_phone}</span> · <span className="mono">{v.contact_email}</span></div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 10.5 }}>Reliability</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: v.reliability >= 0.85 ? "#256E4F" : v.reliability >= 0.7 ? "#C28537" : "#B23A3A" }}>{Math.round(v.reliability * 100)}%</div>
            </div>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom: 14 }}>
          {["cases", "context"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {tab === "cases" && (
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="table">
              <thead><tr><th style={{ width: 120 }}>Date</th><th>Job</th><th style={{ width: 140 }}>Property</th><th style={{ width: 140 }}>Outcome</th><th style={{ width: 90 }}>Cost</th><th style={{ width: 90 }}>SLA met</th></tr></thead>
              <tbody>
                {cases.map(c => {
                  const prop = D.properties.find(p => p.id === c.property);
                  return (
                    <tr key={c.id}>
                      <td className="mono muted" style={{ fontSize: 11 }}>{c.date}</td>
                      <td>{c.title}</td>
                      <td className="muted">{prop?.name || c.property}</td>
                      <td style={{ fontSize: 12 }}>{c.outcome}</td>
                      <td className="mono">{c.cost != null ? fmt(c.cost) : "—"}</td>
                      <td>{c.slaMet == null ? <span className="dim">—</span> : c.slaMet ? <span className="badge badge-approved">Yes</span> : <span className="badge badge-blocked">No</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "context" && (
          <div>
            <p className="subtle">Vendor-level context is upstream of all properties this vendor is attached to. Changes here propagate automatically.</p>
            <div className="card card-pad">
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Vendor context notes</div>
              <div className="col" style={{ gap: 6, fontSize: 12.5, color: "var(--ink-2)" }}>
                <div>{v.notes}</div>
                <div>SLA default: {v.slaHours}h response.</div>
                <div>Avg response: {v.avg_response_min < 60 ? `${v.avg_response_min}m` : `${Math.round(v.avg_response_min / 60)}h`}</div>
              </div>
            </div>
          </div>
        )}
      </div></div>
    </div>
  );
};

// ===================================================================
// PDF EXTRACT
// ===================================================================
const PDFExtractPage = () => {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState((L?.pdfExtracts || [])[0]?.id);
  const extracts = L?.pdfExtracts || [];
  const detail = extracts.find(e => e.id === selected);

  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Tools" }, { label: "PDF Extract" }]} actions={null} />
      <ApiStrip endpoints={["POST /extract/pdf (multipart/form-data)", "GET /extract/{id}", "POST /extract/{id}/apply-layer"]} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">PDF Extract</h1>
        <p className="subtle">Upload any PDF — contract, invoice, AGM minutes, service agreement. The agent extracts structured chunks and routes them to the appropriate context layers. You review and apply.</p>

        {/* Upload zone */}
        <div
          className="card"
          style={{ padding: 28, textAlign: "center", borderStyle: dragging ? "solid" : "dashed", borderColor: dragging ? "var(--accent)" : "var(--line-strong)", background: dragging ? "var(--accent-soft)" : "var(--surface)", marginBottom: 20, cursor: "pointer" }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={() => setDragging(false)}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 500 }}>Drop PDF here or click to upload</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Any document — contract, invoice, minutes, report. The agent will parse and route automatically.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Choose file…</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
          {/* Extract list */}
          <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
            <div className="card-head"><div className="h2">Recent extracts</div></div>
            {extracts.map(e => (
              <div key={e.id} onClick={() => setSelected(e.id)}
                style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: selected === e.id ? "var(--accent-soft)" : "transparent" }}>
                <div style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 2 }}>{e.filename}</div>
                <div className="muted" style={{ fontSize: 11 }}>{e.pages}p · {e.sizeKb}KB · {e.uploadedAt.split(" ")[0]}</div>
                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {e.detectedLayers.map((dl, i) => <LayerBadge key={i} layer={dl.layer} />)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge ${e.status === "applied" ? "badge-approved" : e.status === "review" ? "badge-pending" : ""}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail */}
          {detail && (
            <div className="card">
              <div className="card-head">
                <div>
                  <div style={{ fontWeight: 600 }}>{detail.filename}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{detail.pages} pages · {detail.sizeKb} KB · uploaded by {detail.uploadedBy} · {detail.uploadedAt}</div>
                </div>
                <span className={`badge ${detail.status === "applied" ? "badge-approved" : "badge-pending"}`}>{detail.status}</span>
              </div>
              <div className="card-pad">
                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Detected layers ({detail.detectedLayers.length})</div>
                <div className="col" style={{ gap: 10 }}>
                  {detail.detectedLayers.map((dl, i) => (
                    <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-2)" }}>
                      <div className="row" style={{ marginBottom: 6 }}>
                        <LayerBadge layer={dl.layer} />
                        <span className="muted" style={{ fontSize: 11.5 }}>→ <span className="mono">{dl.target}</span></span>
                        <span className="mono dim" style={{ fontSize: 11 }}>conf {Math.round(dl.confidence * 100)}%</span>
                        <span className="mono dim" style={{ fontSize: 11 }}>{dl.chunks} chunks</span>
                        <span style={{ flex: 1 }} />
                        {detail.status !== "applied" && (
                          <>
                            <button className="btn btn-approve btn-sm">Apply</button>
                            <button className="btn btn-sm">Skip</button>
                          </>
                        )}
                        {detail.status === "applied" && <span className="badge badge-approved">Applied</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{dl.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
              {detail.status === "review" && (
                <div className="card-foot" style={{ justifyContent: "flex-end" }}>
                  <button className="btn">Skip all</button>
                  <button className="btn btn-primary">Apply all layers →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div></div>
    </div>
  );
};

// ===================================================================
// HERMES CHAT
// ===================================================================
const HermesChatPage = () => {
  const [activeThread, setActiveThread] = useState((L?.hermesThreads || [])[0]?.id);
  const [draft, setDraft] = useState("");
  const threads = L?.hermesThreads || [];
  const thread = threads.find(t => t.id === activeThread);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollTop = bottomRef.current.scrollHeight;
    }
  }, [activeThread]);

  const layerColor = { vendor: "#6E7480", owner: "#7A4FB6", building: "#3D7CC9", property: "#256E4F" };

  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Tools" }, { label: "Hermes Chat" }]} actions={<button className="btn btn-sm">+ New thread</button>} />
      <ApiStrip endpoints={[`POST /properties/{id}/messages`, `GET /properties/{id}/messages`, "GET /messages/{id}", "GET /attachments/{id}"]} />
      <div className="page" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100%", flex: 1 }}>
          {/* Thread list */}
          <div style={{ borderRight: "1px solid var(--line)", overflowY: "auto", background: "var(--surface)" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
              <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Threads by scope</div>
              <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>Each thread governs context for a specific layer.</p>
            </div>
            {threads.map(t => {
              const lc = layerColor[t.scope.layer] || "#6E7480";
              return (
                <div key={t.id} onClick={() => setActiveThread(t.id)}
                  style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: activeThread === t.id ? "var(--accent-soft)" : "transparent" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: lc, flexShrink: 0 }} />
                    <LayerBadge layer={t.scope.layer} />
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 12.5 }}>{t.scope.label}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.messages.length} messages · {t.messages[t.messages.length - 1]?.ts}</div>
                </div>
              );
            })}
          </div>

          {/* Chat pane */}
          {thread ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Header */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--surface)", display: "flex", gap: 8, alignItems: "center" }}>
                <LayerBadge layer={thread.scope.layer} />
                <div style={{ fontWeight: 600 }}>{thread.scope.label}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>Context governance thread</div>
                <div style={{ marginLeft: "auto" }}>
                  <button className="btn btn-sm" onClick={() => go(`/${thread.scope.layer === "owner" ? "owner" : thread.scope.layer === "building" ? "building" : "vendors"}/${thread.scope.id}`)}>Open layer →</button>
                </div>
              </div>

              {/* Messages */}
              <div ref={bottomRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {thread.messages.map((m, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
                    {/* Avatar */}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.role === "user" ? "var(--accent)" : "#1F242A", display: "grid", placeItems: "center", fontSize: 12, color: m.role === "user" ? "#fff" : "#79D89C", flexShrink: 0, fontWeight: 600 }}>
                      {m.role === "user" ? "ML" : "H"}
                    </div>
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                      {/* Bubble */}
                      <div style={{
                        padding: "8px 12px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        background: m.role === "user" ? "var(--accent)" : m.system ? "#0F1216" : "var(--surface-2)",
                        color: m.role === "user" ? "#fff" : m.system ? "#D7DBDF" : "var(--ink)",
                        fontSize: 13, lineHeight: 1.55, border: m.system ? "1px solid #1F242A" : "1px solid var(--line)"
                      }}>
                        {m.system && <div style={{ fontSize: 10, color: "#79D89C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "var(--font-mono)" }}>● AGENT</div>}
                        {m.text}
                        {/* Confirmation chips */}
                        {m.confirms && (
                          <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {m.confirms.map((c, ci) => (
                              <span key={ci} style={{ padding: "2px 6px", background: "#193D2C", color: "#79D89C", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)", border: "1px solid #256E4F44" }}>✓ {c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mono dim" style={{ fontSize: 10 }}>{m.ts}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", background: "var(--surface)", display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, display: "flex", gap: 8, padding: "8px 12px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, alignItems: "center" }}>
                  <input
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--ink)", fontFamily: "var(--font-sans)" }}
                    placeholder={`Message about ${thread.scope.label} context…`}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setDraft(""); }}
                  />
                  <button className="btn btn-sm" style={{ fontSize: 11 }}>Attach PDF</button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setDraft("")}>Send</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 13 }}>
              Select a thread to view the conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===================================================================
// UPDATED COVERAGE MAP
// ===================================================================
const CoveragePage = () => {
  const screens = [
    { name: "🌟 Pipeline overview (default landing)", route: "/overview", group: "Multi-agent" },
    { name: "Multi-party timeline (hero ticket)", route: "/timeline/t-7820", group: "Multi-agent" },
    { name: "Escalation queue", route: "/escalations", group: "Multi-agent" },
    { name: "Tenant unified comms thread", route: "/tenant-thread/t-7820", group: "Multi-agent" },
    { name: "Audit log", route: "/audit", group: "Multi-agent" },
    { name: "Vendors directory", route: "/vendors", group: "Context layers" },
    { name: "Vendor detail + case history", route: "/vendor/v1", group: "Context layers" },
    { name: "Owners directory", route: "/owners", group: "Context layers" },
    { name: "Owner detail (profile / properties / contracts / context)", route: "/owner/o1", group: "Context layers" },
    { name: "Buildings directory", route: "/buildings", group: "Context layers" },
    { name: "Building detail (overview / past cases / context)", route: "/building/b1", group: "Context layers" },
    { name: "Properties list", route: "/properties", group: "Context layers" },
    { name: "Property → Overview tab", route: "/property/p1/overview", group: "Property (nested tabs)" },
    { name: "Property → Tickets tab", route: "/property/p1/tickets", group: "Property (nested tabs)" },
    { name: "Property → Context tab", route: "/property/p1/context", group: "Property (nested tabs)" },
    { name: "Property → Editor tab", route: "/property/p1/editor", group: "Property (nested tabs)" },
    { name: "Property → Versions tab", route: "/property/p1/versions", group: "Property (nested tabs)" },
    { name: "Property → Sources tab", route: "/property/p1/sources", group: "Property (nested tabs)" },
    { name: "Property → Policies tab", route: "/property/p1/policies", group: "Property (nested tabs)" },
    { name: "Property → Calls tab", route: "/property/p1/calls", group: "Property (nested tabs)" },
    { name: "Property → Audit tab", route: "/property/p1/audit", group: "Property (nested tabs)" },
    { name: "Ticket detail — voice (variant A)", route: "/ticket/t-7831?v=a", group: "Tickets" },
    { name: "Ticket detail — voice (variant B)", route: "/ticket/t-7831?v=b", group: "Tickets" },
    { name: "Ticket detail — email", route: "/ticket/t-7830", group: "Tickets" },
    { name: "Suggestions panel — variant A (cards)", route: "/suggestions/p1?v=a", group: "Hermes" },
    { name: "Suggestions panel — variant B (review queue)", route: "/suggestions/p1?v=b", group: "Hermes" },
    { name: "PDF Extract", route: "/extract", group: "Tools" },
    { name: "Hermes Chat (context governance)", route: "/chat", group: "Tools" },
  ];
  const groups = [...new Set(screens.map(s => s.group))];
  return (
    <div className="main">
      <Topbar crumbs={[{ label: "Dev" }, { label: "Wireframe map" }]} actions={null} />
      <div className="page"><div className="page-inner">
        <h1 className="h1">Wireframe coverage</h1>
        <p className="subtle">Complete screen map. <b>🌟 hero demo path:</b> Overview → Timeline → Vendors → Owners → Buildings → Properties → Property detail → PDF Extract → Hermes Chat.</p>
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--line)", fontSize: 12.5 }}>
          <b>Context layer cascade:</b> <LayerBadge layer="vendor" /> → <LayerBadge layer="owner" /> → <LayerBadge layer="building" /> → <LayerBadge layer="property" /> — upstream context is always loaded downstream by the proposal pipeline. <b>Deprecated:</b> Slack mock, Diff viewer, Simulate panel — removed from this version.
        </div>
        {groups.map(g => (
          <div key={g} style={{ marginBottom: 18 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>{g}</div>
            <table className="matrix">
              <tbody>
                {screens.filter(s => s.group === g).map((s, i) => (
                  <tr key={i}>
                    <td style={{ width: 40 }} className="mono muted">{String(screens.indexOf(s) + 1).padStart(2, "0")}</td>
                    <td><Link to={s.route} style={{ color: "var(--accent)", textDecoration: "underline" }}>{s.name}</Link></td>
                    <td style={{ width: 300 }} className="mono muted">{s.route}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div></div>
    </div>
  );
};

Object.assign(window, {
  OwnersPage, OwnerDetailPage,
  BuildingsPage, BuildingDetailPage,
  PropertiesPage, PropertyShell, PropertyUnitsTab,
  VendorDetailPage,
  PDFExtractPage, HermesChatPage,
  CoveragePage
});
