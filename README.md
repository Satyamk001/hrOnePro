# Attendance Insights

See your overtime, shortfall, and net balance from HROne — no manual calculation needed.

## Quick Start

```bash
npx attendance-insights@latest
```

Opens at http://localhost:3333. Custom port: `npx attendance-insights@latest --port 4000`

## What It Does

- Shows **net balance** (overtime − shortfall) for the selected month
- **Day-by-day table** with worked hours, shift deviation, and late arrivals
- **Today's live status** — first punch, worked so far, and when you can leave
- **Multi-month history** — data accumulates in your browser automatically
- **Dark mode** with a warm palette

## How Data Gets In

### Option 1: Chrome Extension (automatic)

1. Download the extension from the app's setup page (or from the `extension/` folder)
2. Go to `chrome://extensions` → enable Developer Mode → Load unpacked → select the folder
3. Visit HROne — data syncs automatically. Click "Sync Now" in the app anytime.

### Option 2: Bookmarklet (one-click, no install)

1. Open the app in your browser
2. Drag the "Sync Attendance" button to your bookmarks bar
3. Go to HROne Calendar page → click the bookmarklet
4. First time you'll enter your Employee ID (remembered after that)

## Privacy

All data stays in your browser's localStorage. No server, no database, no analytics, no tracking. The developer cannot see your data. Full details in the app's Privacy page.

## For Developers

```bash
git clone <repo>
cd attendance-tracker
npm install
npm run dev          # Dev server on :3333
npm test             # Run tests
npm run build        # Production build
npm start            # Serve production build locally
```

## Updating

Users always get the latest by running `npx attendance-insights@latest`. If you installed globally:

```bash
npm update -g attendance-insights
```

## License

MIT
