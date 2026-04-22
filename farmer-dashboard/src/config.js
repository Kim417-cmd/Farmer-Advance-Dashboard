// ─── config.js ────────────────────────────────────────────────────────────────
// Update SHEET_ID if your Google Sheet URL ever changes.
// Each entry in TABS must match the exact tab name inside the spreadsheet.
// ──────────────────────────────────────────────────────────────────────────────

export const SHEET_ID = "1L00xHD1waVGrxwtU2ZtfOeoczcSgz2enBVCU5wJe-0I";

export const TABS = [
  { name: "Advance 2026",  year: 2026, layout: "standard2026" },
  { name: "ADVANCE 2025",  year: 2025, layout: "standard"     },
  { name: "ADVANCE 2024",  year: 2024, layout: "withDistrict"  },
  { name: "ADVANCE-2023",  year: 2023, layout: "withOpeningBal"},
];

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
