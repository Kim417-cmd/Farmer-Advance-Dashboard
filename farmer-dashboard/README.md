# 🌾 Farmer Advance Tracker Dashboard

A live dashboard that pulls data directly from your Google Sheets and auto-refreshes every 5 minutes.

---

## ✅ Prerequisites

- A computer with internet access
- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account

---

## 🚀 Step-by-Step Deployment Guide

### STEP 1 — Install Node.js (one time only)
1. Go to **https://nodejs.org**
2. Download the **LTS version** and install it
3. Open your terminal / command prompt and confirm:
   ```
   node --version
   ```

---

### STEP 2 — Set Up the Project on Your Computer

1. Download and unzip this project folder
2. Open your terminal and navigate into it:
   ```bash
   cd farmer-dashboard
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run locally to test:
   ```bash
   npm run dev
   ```
5. Open your browser at **http://localhost:5173** — you should see the live dashboard!

---

### STEP 3 — Push to GitHub

1. Create a new repository on **https://github.com/new**
   - Name it: `farmer-advance-dashboard`
   - Set it to **Private**
   - Click **Create repository**

2. In your terminal (inside the project folder):
   ```bash
   git init
   git add .
   git commit -m "Initial dashboard"
   git remote add origin https://github.com/YOUR-USERNAME/farmer-advance-dashboard.git
   git push -u origin main
   ```

---

### STEP 4 — Deploy on Vercel (Free Hosting)

1. Go to **https://vercel.com** and sign up with your GitHub account
2. Click **"Add New Project"**
3. Import your `farmer-advance-dashboard` repository
4. Vercel auto-detects it as a Vite project — just click **Deploy**
5. In ~60 seconds you'll get a live URL like:
   ```
   https://farmer-advance-dashboard.vercel.app
   ```
6. Share this URL with anyone who needs access!

---

## 🔄 How Updates Work

- **Data updates automatically** — the dashboard fetches fresh data from Google Sheets every 5 minutes
- **No redeployment needed** when farmers add new data to the sheet
- If you push code changes to GitHub, Vercel auto-redeploys in seconds

---

## ⚙️ Changing the Google Sheet

If you ever change your Sheet ID or add new tabs, edit this file:

```
src/config.js
```

Update the `SHEET_ID` and `TABS` array, then push to GitHub — Vercel will auto-redeploy.

---

## 🔒 Important: Keep the Sheet Shared

Make sure your Google Sheet stays set to **"Anyone with the link can view"**.  
If you change it to private, the dashboard will show an error.

---

## 📁 Project Structure

```
farmer-dashboard/
├── src/
│   ├── main.jsx        ← React entry point
│   ├── App.jsx         ← Main dashboard UI
│   ├── sheets.js       ← Google Sheets fetcher & parser
│   └── config.js       ← Sheet ID and tab configuration
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| Dashboard shows "Failed to load" | Check the sheet is set to "Anyone with link can view" |
| Data looks wrong | Check tab names in `config.js` match exactly (including caps) |
| Local dev not working | Run `npm install` again |
| Vercel deploy fails | Make sure you pushed all files including `vite.config.js` |
