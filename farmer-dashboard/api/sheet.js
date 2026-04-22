// api/sheet.js
// Vercel serverless function — runs on the SERVER, not the browser.
// This bypasses CORS because the request comes from Vercel's servers,
// not from the user's browser.

export default async function handler(req, res) {
  // Allow requests from any origin (your deployed frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { sheet, sheetId } = req.query;

  if (!sheet || !sheetId) {
    return res.status(400).json({ error: "Missing 'sheet' or 'sheetId' query param" });
  }

  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;

  try {
    const response = await fetch(url, {
      headers: {
        // Mimic a browser request so Google doesn't reject it
        "User-Agent": "Mozilla/5.0 (compatible; FarmerDashboard/1.0)",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Google Sheets returned ${response.status}`,
        hint: "Make sure the sheet is shared as 'Anyone with the link can view'",
      });
    }

    const text = await response.text();
    // Return raw text — the frontend will parse it
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
