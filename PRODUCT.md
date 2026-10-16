# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web SPA (desktop & mobile responsive), Chrome Extension (Manifest V3), and local CLI (`npx attendance-insights`).

## Stack

React 19, Vite 6, TypeScript, TailwindCSS 3, Framer Motion. Static SPA with no backend — all computation runs client-side. Data persistence via browser `localStorage`. Data ingestion via Chrome Extension (Manifest V3, v2.7.0) and Bookmarklet (v6).

## Users

Employees at MapmyIndia (and any organization using HROne) who need clear visibility into their daily attendance, working hours, and monthly overtime/shortfall balance. Users range from colleagues doing quick daily checks to verify shift completion to team members planning time adjustments across months.

## Product Purpose

Transform raw attendance and intraday punch data from HROne into clear, actionable analytics — showing live shift progress, departure target times ("Can leave at"), overtime, shortfall, net monthly balance, day-by-day history, and last working day summaries — eliminating manual calculation from the portal.

## Positioning

A zero-install analytics and live time-tracking layer on top of HROne. Where HROne presents a static monthly calendar grid with delayed processing, this tool provides real-time intraday punch visibility, live countdown to shift completion, and automated cumulative balance tracking. Data syncs headlessly in the background via the companion extension or through a single-click bookmarklet.

## Operating Context

- Users authenticate at `app.hrone.cloud` during normal work hours.
- The web application runs locally (`localhost:3333`), via npm package (`npx attendance-insights`), or deployed on network/cloud hosting (e.g., `https://hronepro.vercel.app`).
- Active sync executes directly from the dashboard: clicking "Sync" opens an automated headless background tab to HROne, retrieves latest data, and self-closes without interrupting the user.
- Passive sync automatically intercepts data whenever the user navigates HROne calendar or profile pages in their browser.
- Fallback sync via drag-and-drop bookmarklet enables zero-install access for colleagues.
- Multiple months accumulate persistently in browser `localStorage`, with real-time cross-tab synchronization.
- No central database or third-party tracking — all user and attendance records remain strictly local to the user's browser.

## Capabilities and Constraints

**Capabilities:**
- **Live Intraday Punch Tracking (`TodayCard`)**:
  - Direct consumption of HROne's raw punch API (`RawPunch`).
  - Displays First Punch, Last Punch, live ticking worked duration, punch count, and scheduled shift length.
  - Live "Can leave at" departure time estimation with dynamic remaining time or accumulated extra time.
  - Interactive punch log chips displaying each punch timestamp, source code (`BIO`, `WEB`), and live pulsing active indicator.
- **Header Live Time & Shift Indicator (`LiveClock`)**:
  - Glassmorphism topbar pill featuring a synchronized digital clock with smooth animated digit counters.
  - Real-time countdown badge indicating remaining shift time or accrued extra hours.
- **One-Click Headless Sync**:
  - Dashboard "Sync" button coordinates background tab fetch from HROne via extension service worker without page switching.
  - Auto-sync on page load when employee ID is present.
  - Strict tab lifecycle management (`syncOwnedTabs`) preventing lingering background tabs.
- **Automated Data Ingestion**:
  - Chrome Extension v2.7.0 monkey-patches `window.fetch` and `XMLHttpRequest` to capture attendance records, employee profiles, and raw punches.
  - Bookmarklet v6 with parallel multi-endpoint fetching and timeout resilience.
- **Intelligent Day Classification**:
  - Precedence classification: Present, Half Day, Leave, Holiday, Week Off, Flexi Leave, Earned Leave, Absent, Pending.
  - Half-day shift duration halving for accurate overtime/deficit calculations.
- **Comprehensive Aggregate Metrics (`Dashboard`)**:
  - Primary hero balance: Net Balance (Overtime − Shortfall).
  - Secondary metrics: Overtime, Shortfall, Total Working Hours, Raw HROne Hours, Average Daily Work Duration, Total Working Days, and Late Arrival count.
- **Sortable Day-by-Day Table (`DayTable`)**:
  - Full monthly breakdown with multi-column sorting (Date, Status, Time In, Time Out, Worked, +/− Shift, Late).
  - Quick toggle between "Worked Days Only" and "All Days".
- **Last Working Day Resolution (`ProfilePanel`)**:
  - Algorithmic backward walk up to 7 days from yesterday, skipping non-working days (Week Off, Holiday) to show the most recent worked day summary.
  - Profile card showing employee code, designation, department, reporting manager, join date, and one-click copyable email.
- **Resilience & Data Safety**:
  - Undo resync banner offering immediate restore if an HROne sync returns partial or fewer records.
  - Data freshness badges (`fresh`, `aging`, `stale`) with relative age tracking.
  - Midnight rollover automatically clearing yesterday's intraday live punches.
  - Local timezone alignment (IST UTC+5:30) preventing day-boundary discrepancies.
  - Embedded Privacy & Data Safety documentation page.

**Constraints:**
- No backend server: pure client-side execution; all state stored in browser `localStorage`.
- Direct cross-origin API calls from web app to HROne are blocked by browser CORS and HttpOnly authentication cookies; data ingestion must pass through the extension or bookmarklet.
- Monthly calendar API reflects processed records, whereas live intraday attendance relies on the dedicated `RawPunch` endpoint.

**Terminology:**
- Worked Day: Day classified as Present or Half Day with recorded working hours.
- Standard Shift Duration: `shiftEndTime` − `shiftStartTime` (defaults to 9 hours / 540 minutes if unspecified; halved for Half Day).
- Net Balance: Total Overtime Minutes − Total Shortfall Minutes.
- Raw Punch: Individual biometric or web punch event with exact timestamp and terminal source code.

## Evidence on Hand

- `POST https://app.hrone.cloud/api/timeoffice/attendance/Calendar` — Monthly calendar attendance records.
- `GET https://app.hrone.cloud/api/timeoffice/attendance/RawPunch/{employeeId}/{YYYY-MM-DD}/true` — Today's raw punch timestamps and sources.
- `GET https://app.hrone.cloud/api/workforce/Employee/EmployeeInformation/{employeeId}` — Full employee profile and photo.
- Required headers: `domaincode: mapmyindia`, `accessmode: W`, `credentials: include`.
- Standard corporate shift: 09:30–18:30 (GEN code, 9 hours).

## Product Principles

1. **Instant Clarity** — The numbers that dictate your day (net balance, time worked today, and exact time you can leave) are visible immediately without manual calculations.
2. **Zero Friction** — Data flows into the tool with zero typing or manual copy-pasting via background sync or one-click bookmarklet.
3. **Trust the Source** — Never fabricate or approximate attendance; faithfully represent HROne records and punches with transparent classification.
4. **Intraday Awareness** — Provide live feedback throughout the working day from the first morning punch to evening checkout.
5. **Absolute Privacy** — No telemetry, no external databases, no analytics trackers; all credentials and records remain strictly confined to the user's browser.
