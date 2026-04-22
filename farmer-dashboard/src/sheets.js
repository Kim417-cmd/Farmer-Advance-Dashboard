import { SHEET_ID, MONTHS } from "./config.js";

// ─── Clerk name normalizer ────────────────────────────────────────────────────
const CLERK_MAP = {
  "nuru juma":"Nuru Juma","nuru":"Nuru Juma",
  "bilal kizere":"Bilali Kizere","bilal":"Bilali Kizere","bilali kizere":"Bilali Kizere",
  "vallary mbone":"Vallary Mbone","geofrey mhandi":"Geofry Mwandi","geofrey":"Geofry Mwandi",
  "harrison":"Harrison Mwero","hassan mwero":"Harrison Mwero",
  "feli adero":"Felix Adero","adero felix":"Felix Adero",
  "emmanuel":"Emmanuel Mwendwa","ezekiel":"Ezekiel Malondo",
  "livingston masha":"Livingstone Masha","livingston":"Livingstone Masha",
  "hassan nzaria":"Hassan Nzaria",
  "said mwadzarino":"Saidi Mwadzarino","mwadzarino":"Saidi Mwadzarino","mwazdarino":"Saidi Mwadzarino",
  "abdallah kipanga":"Abdalla Kipanga","stephen":"Stephen Muthui",
  "abdalla mwajadi":"Mwajadi","mwajadi":"Mwajadi","hemedi":"Hemedi Sheria",
  "regan mumo":"Regun Mumo","jackson mumo":"Regun Mumo",
  "victor musyoki":"Victor Musyoka","hassan omar":"Omar Hassan","odero":"Odero Felix",
};

function normalizeClerk(raw) {
  if (!raw) return "Unknown";
  const t = raw.trim();
  if (t.includes("@")) {
    return t.split("@")[0].replace(/[^a-zA-Z\s]/g," ")
      .split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ").trim() || "Unknown";
  }
  return CLERK_MAP[t.toLowerCase()] || t;
}

// ─── Parse CSV text into 2D array ─────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

// ─── Fetch one tab via Vercel proxy → Google CSV export ───────────────────────
export async function fetchTab(tab) {
  const isDev = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1";

  // Use gid (numeric tab id) for reliability
  const url = isDev
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`
    : `/api/sheet?sheetId=${SHEET_ID}&gid=${tab.gid}`;

  const res = await fetch(url);
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch(_) {}
    throw new Error(
      `Tab "${tab.name}" failed (HTTP ${res.status}). ` +
      `Ensure sheet is shared as "Anyone with the link → Viewer". ` +
      (detail ? `Server said: ${detail.slice(0,200)}` : "")
    );
  }

  const csv = await res.text();
  if (!csv || csv.toLowerCase().includes("<!doctype")) {
    throw new Error(`Tab "${tab.name}" returned an HTML page instead of CSV. The sheet may not be public.`);
  }

  return parseCSV(csv);
}

// ─── Number helper ────────────────────────────────────────────────────────────
function num(v) {
  if (!v || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g,"").replace(/[^0-9.\-]/g,""));
  return isNaN(n) ? 0 : n;
}

// ─── Parse 2D CSV array into farmer records ───────────────────────────────────
function parseRows(rows2d, layout, year) {
  if (rows2d.length < 2) return [];
  return rows2d.slice(1).map(row => {
    let name, clerk, dateOfIssue, ms;
    if      (layout === "standard2026")   { name=row[1]; clerk=row[2]; dateOfIssue=row[4]; ms=5; }
    else if (layout === "withDistrict")   { name=row[0]; clerk=row[2]; dateOfIssue=row[4]; ms=5; }
    else if (layout === "withOpeningBal") { name=row[1]; clerk=row[3]; dateOfIssue=row[7]; ms=8; }
    else                                  { name=row[0]; clerk=row[1]; dateOfIssue=row[3]; ms=4; }

    if (!name || !name.trim() || name.trim().toLowerCase() === "name") return null;

    const months = MONTHS.map((month, i) => ({
      month, monthIndex: i,
      additions: num(row[ms + i*3]),
      recovery:  num(row[ms + i*3 + 1]),
    }));

    const totalIssued    = months.reduce((s,m) => s + m.additions, 0);
    const totalRecovered = months.reduce((s,m) => s + m.recovery,  0);
    if (totalIssued === 0) return null;

    return {
      name: name.trim(),
      clerk: normalizeClerk(clerk),
      dateOfIssue: dateOfIssue || "",
      year, months, totalIssued, totalRecovered,
      pending: totalIssued - totalRecovered,
    };
  }).filter(Boolean);
}

// ─── Aggregate into summary ───────────────────────────────────────────────────
export function buildSummary(rows) {
  const mMap={}, cMap={}, fMap={};
  MONTHS.forEach((m,i) => { mMap[m]={month:m,monthIndex:i,issued:0,recovered:0,count:0}; });

  rows.forEach(r => {
    fMap[r.name] = (fMap[r.name]||0) + 1;
    r.months.forEach(m => {
      mMap[m.month].issued    += m.additions;
      mMap[m.month].recovered += m.recovery;
      if (m.additions>0) mMap[m.month].count++;
    });
    if (!cMap[r.clerk]) cMap[r.clerk]={clerk:r.clerk,issued:0,recovered:0,count:0};
    cMap[r.clerk].issued    += r.totalIssued;
    cMap[r.clerk].recovered += r.totalRecovered;
    cMap[r.clerk].count++;
  });

  return {
    rows,
    monthly:  Object.values(mMap).filter(m=>m.issued>0||m.recovered>0),
    clerks:   Object.values(cMap).sort((a,b)=>b.issued-a.issued),
    frequent: Object.entries(fMap).filter(([,c])=>c>1)
      .sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count})),
  };
}

// ─── Load all tabs in parallel ────────────────────────────────────────────────
export async function loadAllTabs(tabs) {
  const results = {};
  await Promise.all(tabs.map(async tab => {
    const raw  = await fetchTab(tab);
    const rows = parseRows(raw, tab.layout, tab.year);
    results[tab.name] = buildSummary(rows);
  }));
  return results;
}
