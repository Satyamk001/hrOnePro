# Attendance Insights — Project Documentation

## Project Goal

Attendance Insights is a zero-install analytics and real-time attendance tracking dashboard for HROne users. It transforms raw attendance records and intraday biometric/web punch data into actionable metrics — displaying live shift duration, earliest departure targets ("Can leave at"), overtime, shortfall, cumulative net balance, day-by-day breakdowns, and yesterday's summary.

Data flows into the client application without manual copy-pasting through three primary methods:
1. **Active One-Click Sync**: The dashboard "Sync" button commands the Chrome extension to open HROne headlessly in a background tab, fetch latest data, and self-close without interrupting the user.
2. **Passive Interception**: The Chrome extension automatically captures attendance records, employee profiles, and raw punches as the user navigates HROne in their browser.
3. **One-Click Bookmarklet**: A drag-and-drop bookmarklet enables instant sync for colleagues without installing the extension.

---

## Technology Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend Framework** | React 19 + TypeScript | Component tree, state management, hooks |
| **Build Tool & Bundler** | Vite 6 | Development server, code splitting, asset pipeline |
| **Styling** | TailwindCSS 3 + CSS Variables | Mistral-inspired design tokens, glassmorphism, warm dark mode |
| **Motion & UI Primitives** | Framer Motion + Lucide-style SVG | Glass toggles, splash buttons, click ripples, animated counters, blur reveals |
| **Charting** | Recharts 2 | Attendance visualization and trend components |
| **Testing** | Vitest 3 + fast-check + Testing Library | Unit tests, property-based tests, component tests |
| **Persistence** | Browser `localStorage` + `storage` events | Multi-month record storage, settings, real-time cross-tab synchronization |
| **Data Ingestion** | Chrome Extension (Manifest V3, v2.7.0) | Network interception (fetch + XHR monkey patching), headless background tab sync |
| **Zero-Install Fallback** | Bookmarklet v6 | Multi-endpoint parallel fetch with `postMessage` bridge |
| **Distribution / CLI** | Node.js (`bin/serve.mjs`) / Vercel | `npx attendance-insights` local server or cloud deployment (`hronepro.vercel.app`) |

---

## Design System & Interface Architecture

The interface follows a warm, Mistral AI-inspired aesthetic with dark/light themes, glassmorphism navigation pills, and signature sunset gradients.

### 1. Theme & Color Tokens (`src/index.css`)

CSS custom properties dynamically adapt between light and warm-dark mode:

| Token | Light Value | Dark Value | Purpose |
|-------|-------------|------------|---------|
| `--color-canvas` | `#ffffff` | `#0f0e0c` | Base application background |
| `--color-surface` | `#fafaf9` | `#171614` | Sidebar and subtle card surfaces |
| `--color-cream` | `#fef9ec` | `#292218` | Hero cards, highlighted sections |
| `--color-cream-deeper`| `#fbf2db` | `#382f22` | Badges, nested highlights |
| `--color-primary` | `#f97316` | `#fb923c` | Active accents, CTAs, positive indicators |
| `--color-ink` | `#1c1917` | `#fafaf9` | Headings, primary text |
| `--color-charcoal` | `#44403c` | `#d6d3d1` | Body copy emphasis |
| `--color-steel` | `#78716c` | `#78716c` | Metadata, subtitles, column headers |
| `--color-hairline` | `#e7e5e4` | `#2e2a26` | Subtle structural borders |
| `--color-hairline-strong`| `#d6d3d1` | `#44403c` | Interactive element borders |
| `--color-beige-deep` | `#e5d5b0` | `#4a3f2a` | Cream container borders |
| `--color-error` | `#dc2626` | `#f87171` | Deficit / shortfall values |
| `--color-warning` | `#d97706` | `#fbbf24` | Late arrivals, alerts |

### 2. Glassmorphism Three-Pill Header (`src/App.tsx`)

A floating topbar composed of three frosted-glass pills:
- **Left (`brand-pill`)**: Application title ("Attendance Insights") and employee name badge.
- **Center (`clock-pill`)**: `LiveClock` displaying the current local time with individual animated rolling digit counters (`AnimatedCounter`), accompanied by a live overtime/shortfall badge (e.g. `2h 15m left` or `+0h 45m extra`).
- **Right (`action-pill`)**:
  - Setup & Help button (`showOnboarding` toggle with update notification indicator dot).
  - Theme switcher (`GlassToggle` with smooth transition orb).
  - One-click Sync button (`SplashButton` with interactive ripple, disabled when sync is running or extension unavailable).

### 3. Sidebar Episode Selector (`src/App.tsx`)

A vertical, scroll-centered month selector:
- Centered on the active month with scale and opacity falloffs (3D cinematic feel).
- Number badges and month labels (`August 2026`).
- Automatically scrolls active month into view upon selection.

### 4. Main Dashboard Area

- **Freshness & Status Bar**: Displays month title, relative sync age chip (`fresh`, `aging`, `stale`), "Sync now" / "Refresh via HROne" action, and mobile profile drawer button.
- **`TodayCard` (`src/components/TodayCard.tsx`)**:
  - First punch & last punch timestamps.
  - Live ticking worked duration so far (`useNow(1000)`).
  - Total punch count and scheduled shift duration.
  - "Can Leave At" calculation with live remaining time countdown or accumulated overtime.
  - Punch log chip timeline showing all raw punch events with terminal source codes (`BIO`, `WEB`) and live pulsing indicator for active check-ins.
- **`Dashboard` (`src/components/Dashboard.tsx`)**:
  - Hero card: Cumulative Net Balance (Overtime − Shortfall) with dynamic color styling (`text-primary` for surplus, `text-error` for deficit).
  - Metrics Grid: Overtime, Shortfall, Total Working Hours, Raw HROne Hours, Average Daily Work Duration, Total Working Days, and Late Arrival count.
  - Status breakdown pills: Present, Half Day, Leave, Holiday, Week Off, Flexi Leave, Earned Leave, Absent, Pending.
- **`DayTable` (`src/components/DayTable.tsx`)**:
  - Full day-by-day table with sorting on all key columns (Date, Status, Time In, Time Out, Worked, +/− Shift, Late).
  - Toggle between "Worked Days Only" and "All Days".
  - Color-coded +/− shift differences and late arrival badges.
- **Sunset Stripe Band**: Signature horizontal gradient stripe anchoring the base of the content area.

### 5. Profile Panel & Drawer (`src/components/ProfilePanel.tsx`)

- Persistent desktop sidebar or slide-over drawer on mobile screens.
- `GlowCard` with profile photo or fallback initials, `BlurReveal` name, employee code, designation, and department.
- One-click copyable email address with clipboard fallback and "Copied" toast feedback.
- Reporting manager and date of joining.
- **Last Working Day Card**: Automatically walks backwards up to 7 days from yesterday, skipping Week Offs and Holidays to display the most recent worked day summary.
- In-app link to `PrivacyPage`.

---

## System Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               DATA INGESTION                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [Chrome Extension v2.7.0]                          [Bookmarklet v6]             │
│  Active Headless Sync / Passive Sniffing            One-Click Drag-and-Drop      │
│  ├── pageWorld.js (Monkey-patches fetch & XHR)      └── Parallel fetch:          │
│  ├── content.js (Event bridge & sync coordinator)       ├── Profile              │
│  └── background.js (Tabs, storage, router)              ├── RawPunch (Local Date)│
│                                                         └── Calendar             │
│                                                                                  │
│           │ CustomEvents / chrome.runtime                        │ postMessage   │
└───────────┼──────────────────────────────────────────────────────┼───────────────┘
            │                                                      │
            ▼                                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               REACT APPLICATION                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  receiver.js (Self-gating content script on app page)                            │
│  ├── Dispatches: AttendanceDataFromExtension                                     │
│  ├── Dispatches: ProfileDataFromExtension                                        │
│  ├── Dispatches: TodayPunchesFromExtension                                       │
│  └── Dispatches: AttendanceExtensionReady                                        │
│                                                                                  │
│  App.tsx State & Coordination                                                    │
│  ├── deriveTodayAttendance() ──► TodayCard & LiveClock                           │
│  ├── normalizeRecords() ──────► deriveMonthKey() ──► savedEntries                │
│  ├── undoEntry ───────────────► Rollback safeguard if sync response shrinks      │
│  └── localStorage ────────────► Persistent multi-month storage + cross-tab sync  │
│                                                                                  │
│  Processing Pipeline                                                             │
│  ├── classifier.ts ───────────► classifyRecord() ──► DayStatus & LateArrival     │
│  ├── timeCalculator.ts ───────► computeRecordMetrics() & computeAggregateMetrics()│
│  └── liveTime.ts ─────────────► Pure temporal math, leave time, freshness        │
│                                                                                  │
│  Presentation Layer                                                              │
│  ├── Three-Pill Header (LiveClock + GlassToggle + SplashButton)                  │
│  ├── Episode Selector Sidebar                                                    │
│  ├── TodayCard (Live intraday punches & departure target)                        │
│  ├── Dashboard (Hero Net Balance & aggregate grid)                               │
│  ├── DayTable (Sortable monthly records)                                         │
│  └── ProfilePanel (Employee card & last working day summary)                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Ingestion Workflows

### 1. Active Headless Sync (Dashboard "Sync" Button)

Allows the user to sync without navigating to HROne:
1. User clicks **Sync** (`SplashButton`) in the web app.
2. `App.tsx` dispatches `RequestAttendanceSync` with employee ID, target month, and year.
3. `receiver.js` intercepts and sends `FETCH_ATTENDANCE_REQUEST` to `background.js`.
4. `background.js`:
   - Checks if an active HROne tab already exists.
   - If not, opens a background tab via `chrome.tabs.create({ url: "https://app.hrone.cloud/app/myprofile/calendar", active: false })`.
   - Records tab ID in `syncOwnedTabs` to guarantee cleanup.
   - Monitors tab status; if redirected to login/SSO, reports friendly error and closes tab.
5. In the HROne context, `content.js` receives `FETCH_ATTENDANCE_NOW`:
   - Formulates local date string `YYYY-MM-DD` (avoiding UTC day-boundary drift).
   - Concurrently executes three fetches with `credentials: 'include'`:
     - `GET /api/workforce/Employee/EmployeeInformation/{id}`
     - `GET /api/timeoffice/attendance/RawPunch/{id}/{YYYY-MM-DD}/true`
     - `POST /api/timeoffice/attendance/Calendar`
   - Dispatches profile and raw punch payloads, then completes attendance records.
   - Uses `Promise.all` coordination to prevent early tab termination before punches and profile are transmitted.
6. `background.js` caches results in `chrome.storage.local`, waits a 500ms safety buffer, safely closes the background tab, and routes payloads to app tabs.
7. `receiver.js` receives payloads and dispatches `AttendanceDataFromExtension`, `ProfileDataFromExtension`, and `TodayPunchesFromExtension`.
8. `App.tsx` processes the records, persists them, updates UI state, and triggers a confirmation toast.

### 2. Passive Network Sniffing (Extension)

1. `content.js` injects `pageWorld.js` into the page's execution world at `document_start`.
2. `pageWorld.js` wraps both `window.fetch` and `XMLHttpRequest.prototype.open` / `send`.
3. Intercepts calls matching:
   - `attendance/Calendar`
   - `Employee/EmployeeInformation`
   - `attendance/RawPunch`
4. Dispatches DOM custom events (`InterceptedAttendanceData`, `InterceptedProfileData`, `InterceptedTodayPunches`).
5. `content.js` forwards events to `background.js`.
6. Stored in `chrome.storage.local` and forwarded to open dashboard tabs.

### 3. Bookmarklet Ingestion (v6)

1. Generated via `src/bookmarklet.ts` with embedded target app URL and version flag.
2. User clicks bookmarklet on the HROne calendar page.
3. Automatically identifies month and year from page DOM elements or body text.
4. Reads or prompts for Employee ID (saved to HROne's localStorage for subsequent runs).
5. Concurrently fetches Employee Information, Raw Punches (using local date), and Calendar attendance.
6. `trySend()` waits for all three fetches with safety timeout fallbacks.
7. Opens or focuses the app tab via `window.open` and transmits data via `postMessage`.

---

## HROne API Contracts

### 1. Attendance Calendar
- **Endpoint**: `POST https://app.hrone.cloud/api/timeoffice/attendance/Calendar`
- **Headers**:
  ```http
  Content-Type: application/json
  Accept: application/json, text/plain, */*
  domaincode: mapmyindia
  accessmode: W
  x-requested-with: https://app.hrone.cloud
  ```
- **Body**:
  ```json
  {
    "attendanceYear": 2026,
    "attendanceMonth": 10,
    "employeeId": 1168,
    "calendarViewType": "C"
  }
  ```
- **Response**: Array of `AttendanceRecord` objects with date, shift times, punch times, calculated working hours, present status, and leave flags.

### 2. Raw Punches (Intraday Real-Time)
- **Endpoint**: `GET https://app.hrone.cloud/api/timeoffice/attendance/RawPunch/{employeeId}/{YYYY-MM-DD}/true`
- **Response**: Array of `RawPunch` objects:
  ```json
  [
    {
      "employeeId": 1168,
      "punchDateTime": "2026-10-16T08:14:52",
      "punchSource": "Biometric.",
      "punchSourceCode": "BIO",
      "isPunchExcluded": false
    }
  ]
  ```

### 3. Employee Profile
- **Endpoint**: `GET https://app.hrone.cloud/api/workforce/Employee/EmployeeInformation/{employeeId}`
- **Response**: Array with employee info: `employeeCode`, `employeeName`, `designation`, `department`, `officialEmail`, `mobileNo`, `dateOfJoining`, `reportingManager`, `imageVirtualPath`.

---

## Core Business Logic & Algorithms

### 1. Day Classification Precedence (`src/utils/classifier.ts`)

Records are evaluated in strict priority order:
1. **Half Day**: One half is `"P"` and the other is in `{"FL", "EL", "HD"}`.
2. **Leave**: `isLeave === 1` and not a half day.
3. **Holiday**: Both halves are `"HO"`.
4. **Week Off**: Both halves are `"WO"`.
5. **Present**: Both halves are `"P"`.
6. **Flexi Leave**: Either half is `"FL"`, neither is `"P"`.
7. **Earned Leave**: Either half is `"EL"`, neither is `"P"`.
8. **Pending**: Both halves are `"-"`.
9. **Absent**: `timeIn` is null, `timeout` is null, and calculated hours are zero/empty.
10. **Other**: Fallback status.
*Late Arrival*: Flagged when `presentStatus === "Late"`.

### 2. Time Calculations (`src/utils/timeCalculator.ts`)

- `parseHHMM(s)`: Parses `"HH:MM"` or `"HH:MM:SS"` into integer minutes.
- `formatMinutes(m)`: Formats minutes into `"Xh Ym"` (or `"—"` when zero/empty).
- `computeRecordMetrics(record)`:
  - Determines expected shift length (`shiftEndTime - shiftStartTime`).
  - **Half Day Halving**: Expected shift duration is divided by 2.
  - Computes `workedMinutes` from `calculatedWorkingHours`.
  - Calculates `extraDeficitMinutes = workedMinutes - shiftDurationMinutes`.
  - Sets `isWorkedDay = true` for Present and Half Day statuses.
- `computeAggregateMetrics(records)`:
  - Calculates total working minutes, total raw HROne minutes, overtime, shortfall, and average daily duration over worked days.

### 3. Live Temporal Functions (`src/utils/liveTime.ts`)

- `localDateString(d)`: Returns `YYYY-MM-DD` in local system time (critical for IST UTC+5:30).
- `shiftLengthMinutes(start, end)`: Calculates duration; handles overnight shifts wrapping past midnight.
- `leaveAtMinutes(firstPunch, shiftMinutes)`: Adds scheduled shift duration to first punch time.
- `minutesToHHMM(total)`: Converts minutes since midnight back into 24-hour `"HH:MM"`.
- `getFreshness(syncedIso, now)`:
  - `"fresh"`: Synced within <= 60 minutes.
  - `"aging"`: Synced today within <= 8 hours.
  - `"stale"`: Synced > 8 hours ago or on a previous date.

---

## Repository Structure

```
attendance-tracker/
├── bin/
│   └── serve.mjs                 # CLI entry point for npx attendance-insights
├── extension/                    # Chrome Extension v2.7.0 (Manifest V3)
│   ├── manifest.json             # Manifest configuration, host permissions, script bindings
│   ├── background.js             # Service worker: background sync tab lifecycle, routing, storage
│   ├── content.js                # HROne content script: injection bridge & active sync execution
│   ├── pageWorld.js              # Main world script: monkey-patches fetch & XHR for 3 endpoints
│   └── receiver.js               # Dashboard content script: event dispatcher & storage hydration
├── public/
│   ├── attendance-extension.zip  # Packaged extension zip ready for user download
│   ├── favicon.svg               # Application icon
│   └── vite.svg                  # Vite asset
├── scripts/
│   └── zip-extension.mjs         # Dependency-free extension packaging script
├── src/
│   ├── __tests__/                # Integration test suites
│   ├── components/
│   │   ├── ui/                   # Reusable glassmorphism & motion components
│   │   │   ├── AnimatedCounter.tsx  # Rolling digit counter animation
│   │   │   ├── BlurReveal.tsx       # Text blur/fade reveal animation
│   │   │   ├── ClickRipple.tsx      # Click ripple visual feedback
│   │   │   ├── GlassToggle.tsx      # Frosted glass theme toggle switch
│   │   │   ├── GlowCard.tsx         # Card with mouse-following hover glow
│   │   │   ├── ShinyButton.tsx      # Shimmer button primitive
│   │   │   └── SplashButton.tsx     # Animated sync button with splash feedback
│   │   ├── Charts.tsx            # Attendance distribution charts
│   │   ├── Dashboard.tsx         # Hero net balance & metric grid cards
│   │   ├── DayTable.tsx          # Multi-column sortable table with worked-day filter
│   │   ├── InputPanel.tsx        # Fallback manual input panel
│   │   ├── PrivacyPage.tsx       # In-app Privacy & Data Safety documentation page
│   │   ├── ProfilePanel.tsx      # Employee profile sidebar / drawer & last working day
│   │   └── TodayCard.tsx         # Live intraday punches, departure target, punch log
│   ├── hooks/
│   │   └── useNow.ts             # Live interval timer hook (updates on tick & window focus)
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces (AttendanceRecord, RawPunch, TodayAttendance, etc.)
│   ├── utils/
│   │   ├── classifier.ts         # Day classification rules & status mapping
│   │   ├── cn.ts                 # ClassName utility
│   │   ├── liveTime.ts           # Pure temporal utilities (local date, shift math, freshness)
│   │   ├── parser.ts             # Raw data validation & normalization
│   │   └── timeCalculator.ts     # Time arithmetic, formatting, and metrics aggregation
│   ├── App.tsx                   # Main application root, state manager, listeners
│   ├── bookmarklet.ts            # Bookmarklet v6 code generator
│   ├── index.css                 # Tailwind directives, theme variables, glass styling
│   ├── main.tsx                  # React entry point
│   └── vite-env.d.ts             # Vite global type definitions
├── PRODUCT.md                    # Product specification and principles
├── agent.md                      # This technical documentation file
├── index.html                    # Root HTML with Google Fonts & instant theme bootstrapper
├── package.json                  # Scripts, dependencies, and CLI configuration
├── tailwind.config.js            # Custom colors, font families, shadows, animations
├── tsconfig.json                 # TypeScript project configuration
└── vite.config.ts                # Vite build and test configuration
```

---

## Build, Test & Deployment Commands

```bash
# Development server (runs on port 3333, accessible over local network)
npm run dev

# Full production build (packages extension zip, runs type-check, builds Vite dist)
npm run build

# Package extension zip independently
npm run zip-ext

# Execute test suite
npm test

# Run tests in watch mode
npx vitest

# Preview production build locally
npm run preview

# Run local CLI server
npm start
```
