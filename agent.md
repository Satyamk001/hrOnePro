# Attendance Insights — Project Documentation

## Project Goal

Attendance Insights is an internal tool that transforms raw attendance data from HROne (the company's HR portal) into actionable analytics. It provides employees a clear view of their working hours, overtime, shortfall, net balance, and day-by-day attendance details — helping them plan their work duration and track patterns.

The tool is designed for zero-friction usage: data flows automatically from HROne via a Chrome extension or a one-click bookmarklet, with no manual copy-paste required.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | TailwindCSS 3 with CSS custom properties (Mistral-inspired warm theme) |
| Design System | Mistral-inspired: orange/cream palette, Playfair Display + Inter fonts, sunset stripe |
| Testing | Vitest + fast-check (property-based testing) + @testing-library/react |
| Data Persistence | localStorage (client-side, no backend) |
| Data Ingestion | Chrome Extension (Manifest V3) + Bookmarklet (v3) + postMessage |
| Deployment | Static files served via Nginx on WSL or `npx serve` |

## Design System (Mistral-Inspired)

The UI follows a Mistral AI-inspired design language with warm orange/cream tones:

### Colors (CSS Variables — auto-switch with theme)
| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--color-canvas` | #ffffff | #0f0e0c | Page background |
| `--color-surface` | #fafaf9 | #171614 | Sidebar, subtle backgrounds |
| `--color-cream` | #fef9ec | #292218 | Feature cards, form panels |
| `--color-primary` | #f97316 | #fb923c | CTA buttons, active states |
| `--color-ink` | #1c1917 | #fafaf9 | Headings, primary text |
| `--color-charcoal` | #44403c | #d6d3d1 | Body emphasis |
| `--color-steel` | #78716c | #78716c | Labels, captions |
| `--color-hairline` | #e7e5e4 | #2e2a26 | Borders, dividers |
| `--color-beige-deep` | #e5d5b0 | #4a3f2a | Cream surface borders |
| `--color-error` | #dc2626 | #f87171 | Deficit values |
| `--color-warning` | #d97706 | #fbbf24 | Late arrivals |

### Typography
- **Display**: Playfair Display (near-serif) — hero headings, month labels, stat numbers
- **Sans**: Inter — body, navigation, buttons, labels, captions
- **Mono**: JetBrains Mono — time values, code, version badges
- **Headings**: font-medium with negative letter-spacing (-0.02em to -0.04em)
- **Section eyebrows**: 11px semibold uppercase with 1px tracking

### Shapes & Elevation
- Buttons: `rounded-md` (8px)
- Cards: `rounded-lg` (12px)
- Shadows: `shadow-subtle` (1px), `shadow-card` (4px 12px) — flat by default
- Badges: `rounded-full` (pill shape, used sparingly)

### Signature Element
- **Sunset stripe band**: horizontal gradient (primary → sunshine-700 → sunshine-500 → yellow-saturated → cream) at the bottom of main content area

### Dark/Light Theme
- Toggled via `.dark` class on `<html>`
- Dark mode uses warm brown/charcoal tones (not cold blue-gray)
- Persists to localStorage under key `"theme"`
- Respects `prefers-color-scheme: dark` as initial fallback
- No flash: inline script in `index.html` applies theme before React loads

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │ Chrome Extension  │    │ Bookmarklet v3   │                    │
│  │ (auto-intercept)  │    │ (one-click)      │                    │
│  │ + profile capture │    │ + profile fetch  │                    │
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
│  │  • Receives profile from extension or bookmarklet           │  │
│  │  • Normalizes dates, derives month key, saves localStorage  │  │
│  │  • Manages sidebar month selection (defaults to latest)     │  │
│  │  • Bookmarklet version checking + outdated banner           │  │
│  │  • Dark/light theme toggle                                  │  │
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
│  │  │LastWorkingDay  │  │  Dashboard   │  │DayTable (sort)│  │  │
│  │  │(skips WO/Hol) │  │(hero balance)│  │(filter toggle)│  │  │
│  │  └────────────────┘  └──────────────┘  └───────────────┘  │  │
│  │                                                             │  │
│  │  ┌────────────────┐                                        │  │
│  │  │ ProfilePanel   │  Fixed right sidebar with employee      │  │
│  │  │ (always shown) │  info + last working day summary        │  │
│  │  └────────────────┘                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
attendance-tracker/
├── src/
│   ├── App.tsx                    # Root component, state, theme, data listeners
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # TailwindCSS + Mistral tokens + sunset stripe
│   ├── bookmarklet.ts            # Bookmarklet code generator (v3, with profile fetch)
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces (incl. EmployeeProfile)
│   ├── utils/
│   │   ├── parser.ts             # JSON validation and parsing
│   │   ├── classifier.ts         # Day status classification logic
│   │   └── timeCalculator.ts     # Time arithmetic and aggregation
│   ├── components/
│   │   ├── Dashboard.tsx          # Hero net balance + metrics grid + extremes
│   │   ├── DayTable.tsx           # Sortable table with chevron indicators
│   │   ├── ProfilePanel.tsx       # Right sidebar: employee card + last working day
│   │   ├── Charts.tsx             # (unused — kept for reference)
│   │   └── InputPanel.tsx         # (unused — kept for reference)
│   ├── __tests__/
│   │   └── integration.test.tsx   # Full data flow integration tests
│   └── test/
│       └── setup.ts              # Vitest setup (jest-dom, ResizeObserver mock)
├── extension/                    # Chrome Extension v2.0.0
│   ├── manifest.json             # Manifest V3 — permissions: storage, tabs, scripting
│   ├── pageWorld.js              # Patches fetch + XHR: intercepts attendance + profile
│   ├── content.js                # Content script: relays attendance + profile data
│   ├── background.js             # Service worker: routes data, stores profile
│   └── receiver.js              # Content script on app tab: dispatches both events
├── dist/                         # Production build output
├── PRODUCT.md                    # Product context (Impeccable design system)
├── agent.md                      # This file
├── package.json
├── index.html                    # Entry HTML with Google Fonts + theme init
├── vite.config.ts
├── tailwind.config.js            # Mistral tokens, Playfair Display, warm dark mode
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── postcss.config.js
```

## Data Flow — Three Ingestion Methods

### 1. Chrome Extension (Automatic — v2.0.0)

Fully automatic, intercepts both attendance AND profile API calls:

```
User visits HROne calendar or profile page
  → pageWorld.js intercepts:
    - /api/timeoffice/attendance/Calendar (attendance data)
    - /api/workforce/Employee/EmployeeInformation/{id} (profile data)
  → content.js receives CustomEvents, sends to background.js
  → background.js stores both in chrome.storage.local
  → background.js finds app tab, sends attendance + stored profile
  → receiver.js dispatches:
    - "AttendanceDataFromExtension" CustomEvent
    - "ProfileDataFromExtension" CustomEvent
  → React App useEffect listeners pick up both
  → Data processed, saved to localStorage, rendered
```

**Extension features:**
- Intercepts both `fetch` and `XMLHttpRequest`
- Captures profile data from `/api/workforce/Employee/EmployeeInformation/{id}`
- Profile persists in `chrome.storage.local` — sent with every attendance sync
- Auto-detects app tab by URL pattern OR page title
- Programmatic injection of receiver.js on non-localhost deployments
- Auto-sends stored data to newly opened app tabs (10-minute window)

### 2. Bookmarklet v3 (One-Click, Zero Install)

For colleagues who won't install an extension:

```
User drags "Sync Attendance v3" button to bookmarks bar
  → On HROne calendar page, clicks the bookmark
  → Bookmarklet fetches BOTH:
    - Employee profile (GET /api/workforce/Employee/EmployeeInformation/{id})
    - Attendance data (POST /api/timeoffice/attendance/Calendar)
  → Waits for both to complete (trySend pattern)
  → Opens React app via window.open()
  → Sends records + profile + version via postMessage
  → React app receives, stores profile, displays data
```

**Bookmarklet v3 features:**
- Fetches employee profile in parallel with attendance
- Uses `trySend()` pattern — waits for BOTH fetches before sending
- 5-second timeout on profile fetch (doesn't block if profile API fails)
- Version field (`v:'3'`) for outdated detection
- Console logging for debugging

### 3. localStorage Persistence

All data persists to `localStorage`:
- `attendance-insights-data` — month-keyed attendance records
- `attendance-insights-user` — employee name
- `attendance-insights-profile` — full employee profile object
- `attendance-bookmarklet-version` — last synced bookmarklet version
- `attendance-last-synced` — ISO timestamp of last sync

## HROne API Integration

### Attendance Endpoint
```
POST https://app.hrone.cloud/api/timeoffice/attendance/Calendar
```
Request body: `{ attendanceYear, attendanceMonth, employeeId, calendarViewType: "C" }`

### Employee Profile Endpoint
```
GET https://app.hrone.cloud/api/workforce/Employee/EmployeeInformation/{employeeId}
```
Response: Array with one object containing:
- `employeeId`, `employeeCode`, `employeeName`
- `designation`, `department`, `branch`
- `officialEmail`, `personalEmail`, `mobileNo`
- `reportingManager`, `dateOfJoining`
- `imageVirtualPath` (CDN URL for profile photo)
- `thumbnailFileName` (resized photo URL)

### Key Notes
- Both APIs use same-origin cookies (`credentials: 'include'`)
- `domaincode: mapmyindia` and `accessmode: W` headers required
- Profile API returns an array (take `[0]`)
- `JwtTokenCookie` is HttpOnly — sent automatically by browser

## UI Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Header: "Attendance Insights / Satyam Kumar"  [☽] [Sync Attendance v3] │
├──────────────────────────────────────────────────────────────────────────┤
│  (Outdated bookmarklet banner — shown only when version mismatch)        │
├─────────┬──────────────────────────────────────────────┬─────────────────┤
│ HISTORY │                                              │ PROFILE PANEL   │
│         │  August 2026  (Playfair Display heading)     │                 │
│ Aug 26  │                                              │  [Avatar]       │
│ Jul 26  │  ┌─ Last Working Day (cream card) ────────┐ │  Satyam Kumar   │
│         │  │ Fri, Aug 1: In 09:43  Worked 9h 2m     │ │  CE00172125     │
│         │  └─────────────────────────────────────────┘ │  Software Assoc │
│         │                                              │  SD - HD Map    │
│         │  ┌─ NET BALANCE (cream hero card) ─────────┐ │                 │
│         │  │ +4h 32m  (Playfair 5xl)                 │ │  Email          │
│         │  │ Overtime | Shortfall | Avg | Total      │ │  Joined         │
│         │  └─────────────────────────────────────────┘ │  Reports to     │
│         │                                              │                 │
│         │  ┌─ Metrics Grid (individual cards) ───────┐ │  ┌─ Last Day ─┐│
│         │  │ Worked │ Present │ Late │ Week Off      │ │  │ Status      ││
│         │  │ Holiday│ Leave   │ Half │ Pending       │ │  │ In / Out    ││
│         │  └─────────────────────────────────────────┘ │  │ Worked      ││
│         │                                              │  │ +/- Shift   ││
│         │  WORKED DAYS       [Show all days]           │  └─────────────┘│
│         │  ┌─ Table (sortable, chevron indicators) ──┐ │                 │
│         │  │ Date Day Status In Out Worked +/- Late  │ │                 │
│         │  └─────────────────────────────────────────┘ │                 │
│         │                                              │                 │
│         │  ═══ sunset stripe gradient ═══              │                 │
│         │                                              │                 │
└─────────┴──────────────────────────────────────────────┴─────────────────┘
```

## Key UX Features

- **No manual input** — data arrives via extension (auto) or bookmarklet (one click)
- **Employee profile panel** — fixed right sidebar showing photo, name, designation, department, manager, and last working day summary
- **Last Working Day** — skips Week Off and Holiday (walks back up to 7 days)
- **Bookmarklet versioning** — v3 badge visible in button; outdated banner shown on version mismatch
- **Sortable table** — chevron up/down indicators, visible on hover, highlighted when active (orange accent)
- **Dark mode** — warm palette (not cold gray), row highlights adapted for both themes
- **Sunset stripe band** — signature gradient at bottom of main content
- **Default to latest month** on page load
- **Table defaults to worked days only** with toggle to show all

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

### Time Calculator (`src/utils/timeCalculator.ts`)

- `parseHHMM(s)` — "HH:MM" → total minutes (null-safe: returns 0 for invalid)
- `formatMinutes(m)` — minutes → "Xh Ym"
- `computeRecordMetrics(record)` — per-day: shift duration, worked minutes, extra/deficit
- `computeAggregateMetrics(records)` — totals, averages, min/max, late counts

### Last Working Day Logic

`findLastWorkingDayRecord()` in App.tsx:
- Walks backwards from yesterday up to 7 days
- Skips records with status "Week Off" or "Holiday"
- Returns the first working day record found
- Used by both the inline YesterdaySummary and the ProfilePanel

## Deployment

### Option A: Static file server
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

## Sharing With Colleagues

### For automatic sync (extension):
1. Zip the `extension/` folder
2. They load it in `chrome://extensions/` (Developer mode → Load unpacked)
3. Visit HROne **profile page** once (to capture employee info)
4. Then visit calendar — data flows automatically

### For one-click sync (bookmarklet):
1. Open the deployed app
2. Drag "Sync Attendance v3" button to bookmarks bar
3. On HROne calendar page, click the bookmarklet
4. First time: enter Employee ID (remembered after that)
5. Profile + attendance data appears in the app

## Testing Strategy

- **78 tests** across 15 test files
- **Unit tests**: parser, classifier, timeCalculator
- **Property-based tests** (fast-check): 14 formal correctness properties
- **Integration tests**: full data flow from JSON to rendered UI

## Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # TypeScript check + production build
npm test          # Run all tests (vitest --run)
npm run preview   # Preview production build locally
```
