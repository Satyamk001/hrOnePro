# Attendance Insights — Project Documentation

## Project Goal

Attendance Insights is an internal tool that transforms raw attendance data from HROne (the company's HR portal) into actionable analytics. It provides employees a clear view of their working hours, overtime, shortfall, net balance, and day-by-day attendance details — helping them plan their work duration and track patterns.

The tool is designed for zero-friction usage: data flows automatically from HROne via a Chrome extension or a one-click bookmarklet, with no manual copy-paste required.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | TailwindCSS 3 with CSS custom properties (dark/light theme) |
| Design System | Geist-inspired: ink-on-white, hairline borders, Inter/JetBrains Mono fonts |
| Testing | Vitest + fast-check (property-based testing) + @testing-library/react |
| Data Persistence | localStorage (client-side, no backend) |
| Data Ingestion | Chrome Extension (Manifest V3) + Bookmarklet + postMessage |
| Deployment | Static files served via Nginx on WSL or `npx serve` |

## Design System (Geist-Inspired)

The UI follows a Vercel/Geist-inspired design language:

### Colors (CSS Variables — auto-switch with theme)
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-canvas` | #fafafa | #0a0a0a | Page background |
| `--color-elevated` | #ffffff | #171717 | Cards, surfaces |
| `--color-ink` | #171717 | #ededed | Headings, primary text |
| `--color-body` | #4d4d4d | #a1a1a1 | Body copy |
| `--color-mute` | #8f8f8f | #6b6b6b | Captions, labels |
| `--color-faint` | #a1a1a1 | #4d4d4d | Placeholders |
| `--color-hairline` | #ebebeb | #2e2e2e | Borders, dividers |
| `--color-hairline-soft` | #f2f2f2 | #1a1a1a | Hover backgrounds |

### Typography
- **Sans**: Inter (fallback: Geist Sans, Arial)
- **Mono**: JetBrains Mono (fallback: Geist Mono) — used for eyebrow labels, time values
- **Headings**: font-semibold with negative letter-spacing (-0.04em to -0.05em)
- **Eyebrows**: 11px monospace uppercase with wide tracking

### Surfaces & Depth
- Cards: `bg-elevated` with 1px `border-hairline` — no shadows
- Metrics grid: `gap-px bg-hairline` creates structural hairline grid
- Hover states: `bg-hairline-soft` (subtle fill change)

### Dark/Light Theme
- Toggled via `.dark` class on `<html>`
- Persists to localStorage under key `"theme"`
- Respects `prefers-color-scheme: dark` as initial fallback
- No flash: inline script in `index.html` applies theme before React loads

### Custom Scrollbar
- 6px thin scrollbar using CSS variables
- Thumb: `var(--color-hairline)`, hover: `var(--color-mute)`
- Works in Firefox (`scrollbar-width: thin`) and Webkit (`::-webkit-scrollbar`)

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │ Chrome Extension  │    │ Bookmarklet      │                    │
│  │ (auto-intercept)  │    │ (one-click)      │                    │
│  └────────┬─────────┘    └────────┬─────────┘                    │
│           │ CustomEvent           │ postMessage                    │
└───────────┼───────────────────────┼────────────────────────────────┘
            │                       │
            ▼                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                     REACT APPLICATION                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    App.tsx (State Manager)                    │  │
│  │                                                             │  │
│  │  • Receives data from extension (CustomEvent) or            │  │
│  │    bookmarklet (postMessage)                                │  │
│  │  • Normalizes dates (strips T00:00:00)                      │  │
│  │  • Derives month key, saves to localStorage                 │  │
│  │  • Manages sidebar month selection (defaults to latest)     │  │
│  │  • Stores/displays employee name                            │  │
│  │  • Toggles dark/light theme                                 │  │
│  └─────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              DATA PROCESSING PIPELINE                        │  │
│  │                                                             │  │
│  │  AttendanceRecord[] → Classifier → ClassifiedRecord[]       │  │
│  │  ClassifiedRecord[] → TimeCalculator → EnrichedRecord[]     │  │
│  │  ClassifiedRecord[] → Aggregator → DashboardMetrics         │  │
│  └─────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              PRESENTATION LAYER                              │  │
│  │                                                             │  │
│  │  ┌────────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │YesterdaySummary│  │  Dashboard   │  │DayTable (sort)│  │  │
│  │  │(cross-month)   │  │(hero balance)│  │(filter toggle)│  │  │
│  │  └────────────────┘  └──────────────┘  └───────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────┐  SIDEBAR: Saved months — click to switch            │
│  │ HEADER   │  Theme toggle + Sync bookmarklet button             │
│  └──────────┘                                                      │
└────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
attendance-tracker/
├── src/
│   ├── App.tsx                    # Root component, state, theme, data listeners
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # TailwindCSS + CSS variables + custom scrollbar
│   ├── bookmarklet.js            # Bookmarklet source (reference, not bundled)
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces and types
│   ├── utils/
│   │   ├── parser.ts             # JSON validation and parsing
│   │   ├── classifier.ts         # Day status classification logic
│   │   └── timeCalculator.ts     # Time arithmetic and aggregation
│   ├── components/
│   │   ├── Dashboard.tsx          # Hero net balance + metrics grid + day breakdown
│   │   ├── DayTable.tsx           # Sortable table with mono time values
│   │   ├── Charts.tsx             # (unused — kept for reference)
│   │   └── InputPanel.tsx         # (unused — kept for reference)
│   ├── __tests__/
│   │   └── integration.test.tsx   # Full data flow integration tests
│   └── test/
│       └── setup.ts              # Vitest setup (jest-dom, ResizeObserver mock)
├── extension/                    # Chrome Extension v1.1.0
│   ├── manifest.json             # Manifest V3 — permissions: storage, tabs, scripting
│   ├── pageWorld.js              # Patches fetch + XHR on HROne page
│   ├── content.js                # Content script on HROne, relays intercepted data
│   ├── background.js             # Service worker, routes data, programmatic injection
│   └── receiver.js              # Content script on app tab, dispatches to React
├── dist/                         # Production build output
├── PRODUCT.md                    # Product context (Impeccable design system)
├── agent.md                      # This file
├── package.json
├── index.html                    # Entry HTML with theme initialization script
├── vite.config.ts
├── tailwind.config.js            # Geist tokens, CSS variable colors, dark mode
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── postcss.config.js
```

## Data Flow — Two Primary Ingestion Methods

### 1. Chrome Extension (Automatic — v1.1.0)

For power users who install the extension. Fully automatic, no clicks needed:

```
User visits HROne calendar (app.hrone.cloud/app/myprofile/calendar)
  → pageWorld.js intercepts fetch AND XHR to /api/timeoffice/attendance/Calendar
  → Handles New Relic interference (re-patches fetch multiple times)
  → content.js receives CustomEvent, sends to background.js
  → background.js stores in chrome.storage.local
  → background.js finds app tab (by URL or page title "Attendance Insights")
  → For non-localhost: programmatically injects receiver.js via chrome.scripting
  → receiver.js dispatches "AttendanceDataFromExtension" CustomEvent
  → React App useEffect listener picks it up
  → Data processed, saved to localStorage, rendered
```

**Extension features:**
- Intercepts both `fetch` and `XMLHttpRequest` (handles New Relic patching conflicts)
- Auto-detects app tab by URL pattern OR page title (works on any deployment)
- Programmatic injection of receiver.js on non-localhost deployments
- Auto-sends stored data to newly opened app tabs (10-minute window)
- Stores backup in `chrome.storage.local`

### 2. Bookmarklet (One-Click, Zero Install)

For colleagues who won't install an extension:

```
User drags "Sync Attendance" button to bookmarks bar (one time)
  → On HROne calendar page, clicks the bookmark
  → Bookmarklet detects selected month from page content
  → Extracts employeeId from localStorage (or prompts once)
  → Extracts user name from page heading
  → Calls HROne API with credentials:include (uses live session cookie)
  → Opens React app via window.open()
  → Sends records + userName via postMessage
  → React App "message" event listener picks it up
  → Data processed, saved to localStorage, rendered
```

**Bookmarklet features:**
- Detects which month is selected on HROne's calendar dropdown
- Extracts employeeId from localStorage (remembers after first prompt)
- Extracts employee name from page (e.g., "Satyam Kumar (#CE00172125)")
- Uses `credentials: 'include'` to piggyback on the live HROne session
- Sends data via `postMessage` — no paste needed
- Works for any HROne user (employee ID is per-user)

### 3. localStorage Persistence

All data persists to `localStorage` keyed by month (e.g., "2026-07"). On page load, the most recent month is automatically displayed. Users switch between saved months via the sidebar.

## Core Modules

### Classifier (`src/utils/classifier.ts`)

Assigns a status to each attendance record using precedence rules:

| Priority | Condition | Status |
|----------|-----------|--------|
| 1 | isLeave === 1 | Leave |
| 2 | Both halves "HO" | Holiday |
| 3 | Both halves "WO" | Week Off |
| 4 | Both halves "P" | Present |
| 5 | One half "P", other FL/EL/HD | Half Day |
| 6 | Either half "FL", neither "P" | Full Leave |
| 7 | Either half "EL", neither "P" | Earned Leave |
| 8 | Both halves "-" | Pending |
| 9 | timeIn null && timeout null | Missing |
| 10 | Otherwise | Other |

Late flag: `presentStatus === "Late"` (independent of primary status)

`presentStatus` can be null (HROne sends null for most records).

### Time Calculator (`src/utils/timeCalculator.ts`)

- `parseHHMM(s)` — "HH:MM" → total minutes (**null-safe**: returns 0 for null/undefined/invalid)
- `formatMinutes(m)` — minutes → "Xh Ym"
- `computeRecordMetrics(record)` — per-day: shift duration, worked minutes, extra/deficit
- `computeAggregateMetrics(records)` — totals, averages, min/max, late counts (worked days only)

### Dashboard Metrics

| Metric | Calculation |
|--------|-------------|
| Net Balance (hero) | Overtime - Shortfall. Blue if positive, red if negative |
| Total Working Hours | Sum of calculatedWorkingHours for all Worked_Days |
| Overtime | Sum of positive extra/deficit values |
| Shortfall | Absolute sum of negative extra/deficit values |
| Average / Day | floor(totalWorkingMinutes / workedDayCount) |
| Late Arrivals | Count + percentage among worked days |
| Longest/Shortest Day | Max/min workedMinutes (earliest date on tie, 2+ worked days) |

### Yesterday's Summary

- Searches across ALL saved months (not just active) to find yesterday's record
- Shows: Time In/Out, Worked, Shift, Extra/Deficit, Late status
- Color-coded: blue border (positive), red border (negative)
- Falls back to "No data for YYYY-MM-DD" if not found in any month

## HROne API Integration

### Endpoint
```
POST https://app.hrone.cloud/api/timeoffice/attendance/Calendar
```

### Request Body
```json
{
  "attendanceYear": 2026,
  "attendanceMonth": 8,
  "employeeId": 1168,
  "calendarViewType": "C"
}
```

### Key Notes
- `employeeId` is NOT 0 — each user has their own (e.g., 1168)
- `JwtTokenCookie` is HttpOnly — cannot be read by JavaScript
- But `credentials: 'include'` on same-origin (bookmarklet) sends it automatically
- `domaincode: mapmyindia` header is required
- Response is a flat JSON array (31 records for a month)

### HROne-Specific Status Codes
- `"P"` — Present
- `"WO"` — Week Off (Sat/Sun)
- `"HO"` — Holiday (Independence Day, etc.)
- `"FL"` — Full Leave
- `"EL"` — Earned Leave
- `"HD"` — Half Day
- `"-"` — Pending (future/unprocessed days)
- `null` — presentStatus is often null

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: "Attendance Insights / Satyam Kumar"  [☽] [Sync]       │
├─────────┬────────────────────────────────────────────────────────┤
│ HISTORY │                                                        │
│         │  August 2026  (month heading)                          │
│ Aug 26  │                                                        │
│ Jul 26  │  ┌─ Yesterday ─────────────────────────────────────┐  │
│         │  │ In: 09:43  Out: 18:45  Worked: 9h 2m  +32m     │  │
│         │  └──────────────────────────────────────────────────┘  │
│         │                                                        │
│         │  ┌─ NET BALANCE ────────────────────────────────────┐  │
│         │  │ +4h 32m                                          │  │
│         │  │ Overtime: 5h 10m  |  Shortfall: 0h 38m          │  │
│         │  │ Average/Day: 9h 12m  |  Total: 182h 45m         │  │
│         │  └──────────────────────────────────────────────────┘  │
│         │                                                        │
│         │  ┌─ Metrics Grid (hairline separated) ──────────────┐  │
│         │  │ Worked: 20  │ Present: 18  │ Late: 3  │ WO: 8   │  │
│         │  │ Holiday: 2  │ Leave: 1     │ Half: 0  │ Pend: 0 │  │
│         │  └──────────────────────────────────────────────────┘  │
│         │                                                        │
│         │  WORKED DAYS         [Show all days]                   │
│         │  ┌─ Table ─────────────────────────────────────────┐  │
│         │  │ Date  Day  Status  In    Out   Worked  +/-  Late│  │
│         │  │ ...rows with mono time values...                │  │
│         │  └──────────────────────────────────────────────────┘  │
│         │                                                        │
└─────────┴────────────────────────────────────────────────────────┘
```

## Key UX Features

- **No manual input** — data arrives via extension (auto) or bookmarklet (one click)
- **Default to latest month** on page load
- **Yesterday's Summary** searches across all saved months
- **Table defaults to worked days only** with toggle to show all
- **Dark/Light theme** toggle persists to localStorage, respects system preference
- **Employee name** extracted from HROne page and displayed in header
- **Custom scrollbar** matches the active theme
- **Sticky header + sidebar** — only main content scrolls

## Deployment

### Option A: Static file server (simplest, no admin needed)
```bash
npm run build
npx serve dist --listen tcp://0.0.0.0:3333
```

### Option B: Nginx on WSL
```nginx
server {
    listen 3333;
    server_name _;
    root /path/to/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

### Option C: Vite preview
```bash
npx vite preview --host 0.0.0.0 --port 3333
```

### Network Access (no admin)
Serve from Windows directly (not WSL) to avoid NAT. Other machines access via `http://<your-ip>:3333`.

## Sharing With Colleagues

### For automatic sync (extension):
1. Zip the `extension/` folder
2. They load it in `chrome://extensions/` (Developer mode → Load unpacked)
3. Done — data flows automatically when they visit HROne calendar

### For one-click sync (bookmarklet):
1. They open your deployed app
2. Drag "Sync Attendance" button to their bookmarks bar
3. On HROne calendar page, click the bookmarklet
4. First time: enter Employee ID (remembered after that)
5. Data appears in the app instantly

## Testing Strategy

- **78 tests** across 15 test files
- **Unit tests**: parser, classifier, timeCalculator
- **Property-based tests** (fast-check): 14 formal correctness properties, 100+ iterations
- **Integration tests**: full data flow from JSON to rendered UI

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # TypeScript check + production build
npm test          # Run all tests (vitest --run)
npm run preview   # Preview production build locally
```
