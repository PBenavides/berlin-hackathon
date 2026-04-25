/* global React, ReactDOM */
const { useState, useEffect, useMemo, useRef, Fragment } = React;

const D = window.BUENA_DATA;
const L = window.BUENA_LAYERS;
const A = window.BUENA_AGENTS;

// ---------- Hash router ----------
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/overview");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/overview");
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.hash = "#/overview";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash.replace(/^#/, "");
}
const go = (path) => { window.location.hash = "#" + path; };
const Link = ({ to, children, className, style, ...rest }) => (
  <a href={"#" + to} className={className} style={style} onClick={(e) => { e.preventDefault(); go(to); }} {...rest}>{children}</a>
);

// ---------- Utility components ----------
const Stories = ({ items }) => (
  <div className="story-strip">
    <span className="label">User stories</span>
    {items.map((it) => (
      <span key={it.n} className="us-tag" title={it.text}><b>US{it.n}</b> · {it.text}</span>
    ))}
  </div>
);

const ApiStrip = ({ endpoints }) => (
  <div className="api-strip">
    <span className="label">API · :8000/api/v1</span>
    {endpoints.map((e, i) => {
      const [verb, ...rest] = e.split(" ");
      return (
        <span key={i} className="api-pill">
          <span className={`verb ${verb.toLowerCase()}`}>{verb}</span>
          <span>{" "}{rest.join(" ")}</span>
        </span>
      );
    })}
  </div>
);

const RiskBadge = ({ r }) => r ? <span className={`badge risk-${r}`}>{r} risk</span> : null;
const SourceBadge = ({ s }) => {
  const map = { voice: "📞 voice", email: "✉ email", slack: "# slack", manual: "✎ manual", api: "{} api" };
  return <span className={`badge badge-${s}`}>{map[s] || s}</span>;
};
const StatusBadge = ({ s }) => <span className={`badge badge-${s}`}><span className="badge-dot" />{s}</span>;
const LayerBadge = ({ layer }) => {
  const map = {
    vendor:   { label: "Vendors",   color: "#6E7480", bg: "#EEF0F2" },
    owner:    { label: "Owners",    color: "#7A4FB6", bg: "#F1EBFA" },
    building: { label: "Building",  color: "#3D7CC9", bg: "#E6F0FB" },
    property: { label: "Property",  color: "#256E4F", bg: "#E5F3EC" }
  };
  const c = map[layer] || map.property;
  return <span className="layer-badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33` }}>{c.label}</span>;
};

// ---------- Sidebar ----------
const Sidebar = () => {
  const route = useHashRoute();
  const propMatch = route.match(/^\/property\/(p\d+)/);
  const activeProp = propMatch ? propMatch[1] : null;

  const isActive = (path) => route === path || route.startsWith(path + "/");
  const startsWith = (path) => route.startsWith(path);

  // open whichever property is in the URL, or none
  const [openProp, setOpenProp] = useState(activeProp);
  useEffect(() => { if (activeProp) setOpenProp(activeProp); }, [activeProp]);

  const PROP_TABS = [
    ["tickets",  "Tickets"],
    ["units",    "Units & Owners"],
    ["context",  "Context"],
    ["editor",   "Editor"],
    ["versions", "Versions"],
    ["sources",  "Sources"],
    ["policies", "Policies"],
    ["calls",    "Calls"],
  ];

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo" />
        <div className="sb-name">Buena</div>
        <div className="sb-env">dev</div>
      </div>

      {/* WORK */}
      <div className="sb-section">Work</div>
      <div className="sb-list">
        <Link to="/overview" className={`sb-item ${isActive("/overview") ? "active" : ""}`}>
          <span className="dot" />Overview
          <span className="badge" style={{ background: "var(--hermes-soft)", color: "var(--hermes)" }}>
            {(A?.pipeline || []).filter(t => t.stage !== "done").length}
          </span>
        </Link>
        <Link to="/escalations" className={`sb-item ${isActive("/escalations") ? "active" : ""}`}>
          <span className="dot" />Escalations
          <span className="badge" style={{ background: "#FDECEC", color: "#B23A3A" }}>
            {(A?.escalations || []).length}
          </span>
        </Link>
      </div>

      {/* PROPERTIES */}
      <div className="sb-section">
        Properties
        <span style={{ float: "right", fontWeight: 400, color: "var(--ink-4)", cursor: "pointer", fontSize: 14 }} title="New property">+</span>
      </div>
      <div className="sb-list">
        {D.properties.map((p) => {
          const isOpen = openProp === p.id;
          const pendingApproval = (A?.pipeline || []).filter(t => t.property === p.id && t.stage === "awaiting_approval").length;
          return (
            <Fragment key={p.id}>
              <div
                className={`sb-item sb-prop ${startsWith(`/property/${p.id}`) || startsWith(`/inbox/${p.id}`) ? "active" : ""}`}
                onClick={() => {
                  setOpenProp(isOpen ? null : p.id);
                  go(`/property/${p.id}/tickets`);
                }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="dot" />{p.name.split(" ")[0]}
                </span>
                <span style={{ display: "flex", gap: 4 }}>
                  {pendingApproval > 0 && <span className="badge" style={{ background: "#FBE9CD", color: "#9A6618" }}>{pendingApproval}</span>}
                  {p.openTickets > 0 && <span className="badge">{p.openTickets}</span>}
                  <span style={{ color: "var(--ink-4)", fontSize: 10 }}>{isOpen ? "▾" : "▸"}</span>
                </span>
              </div>
              {isOpen && (
                <div style={{ paddingLeft: 20, paddingBottom: 2 }}>
                  {PROP_TABS.map(([key, label]) => {
                    const badge = key === "tickets" && p.openTickets > 0 ? p.openTickets : null;
                    return (
                      <Link key={key} to={`/property/${p.id}/${key}`}
                        className={`sb-item ${route === `/property/${p.id}/${key}` ? "active" : ""}`}
                        style={{ fontSize: 12, padding: "3px 10px" }}>
                        {label}
                        {badge && <span className="badge" style={{ marginLeft: 4 }}>{badge}</span>}
                        {key === "context" && <span className="badge mono" style={{ marginLeft: 4 }}>v{p.version}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* KNOWLEDGE */}
      <div className="sb-section">Knowledge</div>
      <div className="sb-list">
        <Link to="/vendors" className={`sb-item ${startsWith("/vendor") ? "active" : ""}`}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6E7480", display: "inline-block", marginRight: 7, flexShrink: 0 }} />
          Vendors
          <span className="badge mono" style={{ marginLeft: "auto" }}>{(A?.vendors || []).length}</span>
        </Link>
        <Link to="/owners" className={`sb-item ${startsWith("/owner") ? "active" : ""}`}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7A4FB6", display: "inline-block", marginRight: 7, flexShrink: 0 }} />
          Owners
          <span className="badge mono" style={{ marginLeft: "auto" }}>{(L?.owners || []).length}</span>
        </Link>
        <Link to="/buildings" className={`sb-item ${startsWith("/building") ? "active" : ""}`}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3D7CC9", display: "inline-block", marginRight: 7, flexShrink: 0 }} />
          Buildings
          <span className="badge mono" style={{ marginLeft: "auto" }}>{(L?.buildings || []).length}</span>
        </Link>
      </div>

      {/* TOOLS */}
      <div className="sb-section">Tools</div>
      <div className="sb-list">
        <Link to="/extract" className={`sb-item ${isActive("/extract") ? "active" : ""}`}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C28537", display: "inline-block", marginRight: 7 }} />
          PDF Extract
        </Link>
        <Link to="/chat" className={`sb-item ${isActive("/chat") ? "active" : ""}`}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#79D89C", display: "inline-block", marginRight: 7 }} />
          Hermes Chat
        </Link>
      </div>

      {/* DEV */}
      <div className="sb-section" style={{ marginTop: "auto" }}>Dev</div>
      <div className="sb-list" style={{ marginBottom: 8 }}>
        <Link to="/coverage" className={`sb-item ${isActive("/coverage") ? "active" : ""}`} style={{ opacity: 0.65, fontSize: 12 }}>
          <span className="dot" />Wireframe map
        </Link>
        <Link to="/audit" className={`sb-item ${isActive("/audit") ? "active" : ""}`} style={{ opacity: 0.65, fontSize: 12 }}>
          <span className="dot" />Audit log
        </Link>
      </div>

      <div className="sb-foot">
        <div className="avatar">{D.operator.initials}</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{D.operator.name}</div>
          <div className="dim" style={{ fontSize: 10.5 }}>Operator</div>
        </div>
        <div style={{ marginLeft: "auto" }} className="kbd">⌘K</div>
      </div>
    </aside>
  );
};

// ---------- Topbar ----------
const Topbar = ({ crumbs, actions }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span className={i === crumbs.length - 1 ? "now" : ""}>{c.label}</span>}
        </Fragment>
      ))}
    </div>
    <div className="topbar-spacer" />
    <div className="topbar-actions">{actions}</div>
  </div>
);

// expose
Object.assign(window, {
  useHashRoute, go, Link, Stories, ApiStrip,
  RiskBadge, SourceBadge, StatusBadge, LayerBadge,
  Sidebar, Topbar,
  D, L, A,
  useState, useEffect, useMemo, useRef, Fragment
});
