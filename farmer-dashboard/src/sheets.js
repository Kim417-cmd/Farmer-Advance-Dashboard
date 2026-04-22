import { SHEET_ID, MONTHS } from "./config.js";

// ─── Normalize clerk names ────────────────────────────────────────────────────
const CLERK_MAP = {
  "nuru juma": "Nuru Juma", "nuru": "Nuru Juma",
  "bilal kizere": "Bilali Kizere", "bilal": "Bilali Kizere", "bilali kizere": "Bilali Kizere",
  "vallary mbone": "Vallary Mbone",
  "geofrey mhandi": "Geofry Mwandi", "geofrey": "Geofry Mwandi",
  "harrison": "Harrison Mwero", "hassan mwero": "Harrison Mwero",
  "feli adero": "Felix Adero", "adero felix": "Felix Adero",
  "emmanuel": "Emmanuel Mwendwa", "ezekiel": "Ezekiel Malondo",
  "livingston masha": "Livingstone Masha", "livingston": "Livingstone Masha",
  "hassan nzaria": "Hassan Nzaria",
  "said mwadzarino": "Saidi Mwadzarino", "mwadzarino": "Saidi Mwadzarino", "mwazdarino": "Saidi Mwadzarino",
  "abdallah kipanga": "Abdalla Kipanga", "stephen": "Stephen Muthui",
  "abdalla mwajadi": "Mwajadi", "mwajadi": "Mwajadi", "hemedi": "Hemedi Sheria",
  "regan mumo": "Regun Mumo", "jackson mumo": "Regun Mumo",
  "victor musyoki": "Victor Musyoka", "hassan omar": "Omar Hassan", "odero": "Odero Felix",
};

function normalizeClerk(raw) {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0];
    return local.replace(/[^a-zA-Z\s]/g, " ").split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ").trim() || "Unknown";
  }
  return CLERK_MAP[trimmed.toLowerCase()] || trimmed;
}

// ─── Fetch via Vercel proxy (production) or direct (localhost) ────────────────
export async function fetchTab(tabName) {
  const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const url = isDev
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`
    : `/api/sheet?sheetId=${SHEET_ID}&sheet=${encodeURIComponent(tabName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to load tab "${tabName}" (HTTP ${res.status}). Make sure the Google Sheet is shared as "Anyone with the link can view". ${body}`);
  }

  const text = await res.text();
  const jsonStr = text.replace(/^[^\{]*/, "").replace(/\);\s*$/, "");
  let gviz;
  try { gviz = JSON.parse(jsonStr); }
  catch (e) { throw new Error(`Could not parse response for tab "${tabName}". Raw: ${text.slice(0, 200)}`); }

  if (!gviz?.table?.rows) return [];
  return gviz.table.rows.map(row => row.c.map(cell => (cell ? cell.v : null)));
}

function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseRows(rawRows, layout, year) {
  if (!rawRows.length) return [];
  return rawRows.slice(1).map(row => {
    let name, clerk, dateOfIssue, monthlyStart;
    if (layout === "standard2026")   { name=row[1]; clerk=row[2]; dateOfIssue=row[4]; monthlyStart=5; }
    else if (layout === "withDistrict")  { name=row[0]; clerk=row[2]; dateOfIssue=row[4]; monthlyStart=5; }
    else if (layout === "withOpeningBal"){ name=row[1]; clerk=row[3]; dateOfIssue=row[7]; monthlyStart=8; }
    else { name=row[0]; clerk=row[1]; dateOfIssue=row[3]; monthlyStart=4; }

    if (!name || typeof name !== "string" || !name.trim()) return null;

    const months = MONTHS.map((month, i) => ({
      month, monthIndex: i,
      additions: num(row[monthlyStart + i * 3]),
      recovery:  num(row[monthlyStart + i * 3 + 1]),
    }));

    const totalIssued    = months.reduce((s, m) => s + m.additions, 0);
    const totalRecovered = months.reduce((s, m) => s + m.recovery,  0);

    let dateStr = "";
    if (dateOfIssue) {
      if (typeof dateOfIssue === "string" && dateOfIssue.startsWith("Date(")) {
        const parts = dateOfIssue.replace("Date(","").replace(")","").split(",");
        dateStr = new Date(+parts[0], +parts[1], +parts[2]).toLocaleDateString("en-KE");
      } else { dateStr = String(dateOfIssue); }
    }

    return { name: name.trim(), clerk: normalizeClerk(clerk), dateOfIssue: dateStr, year, months, totalIssued, totalRecovered, pending: totalIssued - totalRecovered };
  }).filter(r => r !== null && r.totalIssued > 0);
}

export function buildSummary(rows) {
  const monthlyMap = {}, clerkMap = {}, farmerCount = {};
  MONTHS.forEach((m, i) => { monthlyMap[m] = { month: m, monthIndex: i, issued: 0, recovered: 0, count: 0 }; });
  rows.forEach(r => {
    farmerCount[r.name] = (farmerCount[r.name] || 0) + 1;
    r.months.forEach(m => {
      monthlyMap[m.month].issued    += m.additions;
      monthlyMap[m.month].recovered += m.recovery;
      if (m.additions > 0) monthlyMap[m.month].count += 1;
    });
    const ck = r.clerk;
    if (!clerkMap[ck]) clerkMap[ck] = { clerk: ck, issued: 0, recovered: 0, count: 0 };
    clerkMap[ck].issued    += r.totalIssued;
    clerkMap[ck].recovered += r.totalRecovered;
    if (r.totalIssued > 0) clerkMap[ck].count += 1;
  });
  return {
    rows,
    monthly:  Object.values(monthlyMap).filter(m => m.issued > 0 || m.recovered > 0),
    clerks:   Object.values(clerkMap).sort((a, b) => b.issued - a.issued),
    frequent: Object.entries(farmerCount).filter(([,c]) => c > 1)
      .sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,count]) => ({name,count})),
  };
}

export async function loadAllTabs(tabs) {
  const results = {};
  await Promise.all(tabs.map(async tab => {
    const raw  = await fetchTab(tab.name);
    const rows = parseRows(raw, tab.layout, tab.year);
    results[tab.name] = buildSummary(rows);
  }));
  return results;
}
