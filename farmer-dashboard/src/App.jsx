import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { TABS, MONTHS } from "./config.js";
import { loadAllTabs } from "./sheets.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = ["#16a34a","#0ea5e9","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#a3e635"];

function fmt(n) {
  if (!n) return "KES 0";
  if (n >= 1_000_000) return "KES " + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "KES " + (n / 1_000).toFixed(1) + "K";
  return "KES " + n.toLocaleString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, color, icon }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "20px 22px",
      boxShadow: "0 2px 16px rgba(0,0,0,0.07)", borderTop: `4px solid ${color}`,
      animation: "fadeUp .4s ease both",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{title}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 8, fontFamily: "'Sora',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
      <div style={{
        width: 48, height: 48, border: "4px solid #dcfce7",
        borderTop: "4px solid #16a34a", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "#64748b", fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>Fetching live data from Google Sheets…</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, textAlign: "center", margin: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
      <p style={{ color: "#dc2626", fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{message}</p>
      <p style={{ color: "#64748b", fontSize: 13 }}>Make sure the Google Sheet is shared as <strong>"Anyone with the link can view"</strong></p>
      <button onClick={onRetry} style={{
        marginTop: 12, padding: "8px 20px", borderRadius: 8, border: "none",
        background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
      }}>Retry</button>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function App() {
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const [activeTab, setActiveTab] = useState(TABS[0].name);
  const [monthFilter, setMonthFilter] = useState("All");
  const [clerkFilter, setClerkFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 25;

  // ── Fetch data ──────────────────────────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadAllTabs(TABS);
      setAllData(data);
      setLastFetched(new Date());
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const tabData = allData?.[activeTab];

  const allClerks = useMemo(() => {
    if (!tabData) return ["All"];
    return ["All", ...Array.from(new Set(tabData.rows.map(r => r.clerk))).sort()];
  }, [activeTab, tabData]);

  const filtered = useMemo(() => {
    if (!tabData) return [];
    let rows = tabData.rows;
    if (clerkFilter !== "All") rows = rows.filter(r => r.clerk === clerkFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) || r.clerk.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [tabData, clerkFilter, search]);

  const monthlyDisplay = useMemo(() => {
    if (!tabData) return [];
    if (monthFilter === "All") return tabData.monthly;
    return tabData.monthly.filter(m => m.month === monthFilter);
  }, [tabData, monthFilter]);

  const kpiSource = clerkFilter === "All" && !search.trim() ? tabData?.rows ?? [] : filtered;
  const totalIssued    = kpiSource.reduce((s, r) => s + r.totalIssued, 0);
  const totalRecovered = kpiSource.reduce((s, r) => s + r.totalRecovered, 0);
  const totalPending   = totalIssued - totalRecovered;
  const recoveryRate   = totalIssued > 0 ? Math.round((totalRecovered / totalIssued) * 100) : 0;

  const clerkDisplay = useMemo(() => {
    if (!tabData) return [];
    if (clerkFilter !== "All") return tabData.clerks.filter(c => c.clerk === clerkFilter);
    return tabData.clerks.slice(0, 15);
  }, [tabData, clerkFilter]);

  const pagedRows  = filtered.slice(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function switchTab(name) {
    setActiveTab(name);
    setMonthFilter("All");
    setClerkFilter("All");
    setSearch("");
    setTablePage(0);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        .pill-btn  { transition: all .18s; border: none; cursor: pointer; font-family: 'DM Sans',sans-serif; }
        .pill-btn:hover  { opacity: .82; }
        .row-tr:hover    { background: #f0fdf4 !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg,#052e16 0%,#14532d 55%,#166534 100%)",
        padding: "26px 28px 22px", color: "#fff",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
              }}>🌾</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "'Sora',sans-serif", letterSpacing: -0.5 }}>
                  Farmer Advance Tracker
                </h1>
                <p style={{ margin: 0, fontSize: 12, opacity: .6 }}>
                  Live data from Google Sheets
                  {lastFetched && ` · Updated ${lastFetched.toLocaleTimeString("en-KE")}`}
                </p>
              </div>
            </div>

            <button onClick={fetchData} disabled={loading}
              style={{
                padding: "8px 18px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
              }}>
              {loading ? "⏳ Loading…" : "🔄 Refresh"}
            </button>
          </div>

          {/* Year tabs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            {TABS.map(t => (
              <button key={t.name} className="pill-btn" onClick={() => switchTab(t.name)}
                style={{
                  padding: "7px 18px", borderRadius: 30, fontSize: 13, fontWeight: 600,
                  background: activeTab === t.name ? "#fff" : "rgba(255,255,255,0.12)",
                  color: activeTab === t.name ? "#15803d" : "#fff",
                }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "22px 20px 48px" }}>

        {loading && !allData && <Spinner />}
        {error && <ErrorBox message={error} onRetry={fetchData} />}

        {allData && tabData && (
          <>
            {/* FILTERS */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Month:</span>
              {["All", ...MONTHS].map(m => (
                <button key={m} className="pill-btn" onClick={() => { setMonthFilter(m); setTablePage(0); }}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: "1.5px solid", cursor: "pointer",
                    borderColor: monthFilter === m ? "#16a34a" : "#e2e8f0",
                    background: monthFilter === m ? "#dcfce7" : "#fff",
                    color: monthFilter === m ? "#15803d" : "#64748b",
                  }}>
                  {m === "All" ? "All" : m.slice(0, 3)}
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select value={clerkFilter} onChange={e => { setClerkFilter(e.target.value); setTablePage(0); }}
                  style={{
                    padding: "7px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                    fontSize: 12, background: "#fff", color: "#374151", maxWidth: 220,
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                  {allClerks.map(c => <option key={c} value={c}>{c === "All" ? "All Clerks" : c}</option>)}
                </select>

                <input value={search} onChange={e => { setSearch(e.target.value); setTablePage(0); }}
                  placeholder="🔍 Search farmer or clerk…"
                  style={{
                    padding: "7px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                    fontSize: 12, width: 210, fontFamily: "'DM Sans',sans-serif", outline: "none",
                  }} />
              </div>
            </div>

            {/* KPI CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard title="Total Farmers"    value={kpiSource.length}      sub={`records in ${activeTab}`}        color="#16a34a" icon="👨‍🌾" />
              <KpiCard title="Total Issued"     value={fmt(totalIssued)}      sub="gross advance amount"              color="#0ea5e9" icon="💵" />
              <KpiCard title="Total Recovered"  value={fmt(totalRecovered)}   sub={`${recoveryRate}% recovery rate`} color="#8b5cf6" icon="✅" />
              <KpiCard title="Pending Balance"  value={fmt(totalPending)}     sub="outstanding amount"                color="#ef4444" icon="⚠️" />
            </div>

            {/* CHARTS ROW */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

              {/* Bar: Issued vs Recovered */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'Sora',sans-serif" }}>
                  📊 Monthly Issued vs Recovered
                </h3>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={monthlyDisplay} barGap={2} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.slice(0, 3)} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v, n) => [fmt(v), n === "issued" ? "Issued" : "Recovered"]} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="issued"    fill="#0ea5e9" name="issued"    radius={[3,3,0,0]} />
                    <Bar dataKey="recovered" fill="#16a34a" name="recovered" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line: Advance Count */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'Sora',sans-serif" }}>
                  📈 Number of Advances Per Month
                </h3>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={tabData.monthly.filter(m => m.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.slice(0, 3)} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                    <Tooltip formatter={v => [v, "Advances"]} />
                    <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2.5}
                      dot={{ fill: "#f59e0b", r: 3 }} activeDot={{ r: 5 }} name="count" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FREQUENT FARMERS + CLERK SUMMARY */}
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, marginBottom: 16 }}>

              {/* Frequent Farmers */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'Sora',sans-serif" }}>
                  🔁 Frequent Applicants
                </h3>
                {tabData.frequent.length === 0
                  ? <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No repeat applicants this year</p>
                  : tabData.frequent.map((f, i) => (
                    <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: COLORS[i % COLORS.length], color: "#fff",
                        fontWeight: 800, fontSize: 12,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {f.name}
                        </div>
                        <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginTop: 3 }}>
                          <div style={{
                            height: 5, borderRadius: 3,
                            background: COLORS[i % COLORS.length],
                            width: `${(f.count / tabData.frequent[0].count) * 100}%`,
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{f.count}x</span>
                    </div>
                  ))
                }
              </div>

              {/* Clerk Summary */}
              <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "auto" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'Sora',sans-serif" }}>
                  👤 Buying Clerk Summary {clerkFilter !== "All" ? `— ${clerkFilter}` : "(Top 15)"}
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Buying Clerk", "Advances", "Total Issued", "Recovered", "Pending", "Recovery %"].map(h => (
                        <th key={h} style={{
                          padding: "8px 12px", textAlign: "left", fontWeight: 700,
                          color: "#64748b", fontSize: 11, textTransform: "uppercase",
                          letterSpacing: .5, borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clerkDisplay.map((c, i) => {
                      const pending = c.issued - c.recovered;
                      const rate = c.issued > 0 ? Math.round((c.recovered / c.issued) * 100) : 0;
                      return (
                        <tr key={c.clerk} className="row-tr" style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0f172a" }}>
                            <span style={{
                              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                              background: COLORS[i % COLORS.length], marginRight: 8,
                            }} />
                            {c.clerk}
                          </td>
                          <td style={{ padding: "9px 12px", color: "#475569" }}>{c.count}</td>
                          <td style={{ padding: "9px 12px", color: "#0ea5e9", fontWeight: 600 }}>{fmt(c.issued)}</td>
                          <td style={{ padding: "9px 12px", color: "#16a34a", fontWeight: 600 }}>{fmt(c.recovered)}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{
                              background: pending > 0 ? "#fef2f2" : "#f0fdf4",
                              color: pending > 0 ? "#ef4444" : "#16a34a",
                              padding: "2px 9px", borderRadius: 10, fontWeight: 700, fontSize: 11,
                            }}>{fmt(pending)}</span>
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                                <div style={{
                                  height: 6, borderRadius: 3, width: `${rate}%`,
                                  background: rate >= 80 ? "#16a34a" : rate >= 50 ? "#f59e0b" : "#ef4444",
                                }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", minWidth: 32 }}>{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RECORDS TABLE */}
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a", fontFamily: "'Sora',sans-serif" }}>
                  📋 All Records
                  <span style={{ color: "#64748b", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>({filtered.length} farmers)</span>
                </h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => setTablePage(p => Math.max(0, p - 1))} disabled={tablePage === 0}
                    style={{
                      padding: "5px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                      background: "#fff", cursor: tablePage === 0 ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: 600,
                      color: tablePage === 0 ? "#cbd5e1" : "#374151",
                    }}>← Prev</button>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Page {tablePage + 1} of {Math.max(1, totalPages)}
                  </span>
                  <button onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePage >= totalPages - 1}
                    style={{
                      padding: "5px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                      background: "#fff", cursor: tablePage >= totalPages - 1 ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: 600,
                      color: tablePage >= totalPages - 1 ? "#cbd5e1" : "#374151",
                    }}>Next →</button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["#", "Farmer Name", "Buying Clerk", "Date Issued", "Total Issued (KES)", "Recovered (KES)", "Pending (KES)", "Status"].map(h => (
                        <th key={h} style={{
                          padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#64748b",
                          fontSize: 11, textTransform: "uppercase", letterSpacing: .4,
                          borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r, i) => {
                      const status = r.pending <= 0 ? "Cleared" : r.totalRecovered > 0 ? "Partial" : "Unpaid";
                      const sc = status === "Cleared" ? "#16a34a" : status === "Partial" ? "#f59e0b" : "#ef4444";
                      const sb = status === "Cleared" ? "#f0fdf4"  : status === "Partial" ? "#fffbeb"  : "#fef2f2";
                      return (
                        <tr key={i} className="row-tr" style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "9px 12px", color: "#94a3b8", fontWeight: 600 }}>
                            {tablePage * PAGE_SIZE + i + 1}
                          </td>
                          <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0f172a" }}>{r.name}</td>
                          <td style={{ padding: "9px 12px", color: "#475569" }}>{r.clerk}</td>
                          <td style={{ padding: "9px 12px", color: "#64748b" }}>{r.dateOfIssue || "—"}</td>
                          <td style={{ padding: "9px 12px", color: "#0ea5e9", fontWeight: 600 }}>{r.totalIssued.toLocaleString()}</td>
                          <td style={{ padding: "9px 12px", color: "#16a34a", fontWeight: 600 }}>{r.totalRecovered.toLocaleString()}</td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, color: r.pending > 0 ? "#ef4444" : "#16a34a" }}>
                            {Math.abs(r.pending).toLocaleString()}
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ background: sb, color: sc, padding: "2px 10px", borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <p style={{ textAlign: "center", color: "#cbd5e1", fontSize: 11, marginTop: 24 }}>
              🔗 Connected to Google Sheet · Auto-refreshes every 5 minutes
              {lastFetched && ` · Last updated: ${lastFetched.toLocaleTimeString("en-KE")}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
