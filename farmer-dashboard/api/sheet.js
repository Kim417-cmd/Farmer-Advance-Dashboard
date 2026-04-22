// api/sheet.js — Vercel serverless proxy
// Uses the CSV export endpoint which is more reliable than gviz

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { sheet, sheetId, gid } = req.query;

  if (!sheetId) return res.status(400).json({ error: "Missing sheetId" });

  // Try CSV export — works reliably when sheet is public
  const csvUrl = gid
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheet || "")}`;

  try {
    const response = await fetch(csvUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Google returned HTTP ${response.status}`,
        url: csvUrl,
        hint: "Check that the sheet is shared as 'Anyone with the link can view'",
      });
    }

    const csv = await response.text();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return res.status(200).send(csv);

  } catch (err) {
    return res.status(500).json({ error: err.message, url: csvUrl });
  }
}
