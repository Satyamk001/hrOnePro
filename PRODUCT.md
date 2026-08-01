# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, Vite 6, TypeScript, TailwindCSS 3. Static SPA with no backend — all computation client-side. Data persistence via localStorage. Data ingestion via Chrome Extension (Manifest V3) and bookmarklet.

## Users

Employees at MapmyIndia (and potentially any company using HROne) who need visibility into their attendance patterns. They are software engineers and office workers who check their hours periodically to ensure they meet shift requirements and plan time adjustments. Usage is typically once daily or a few times per month.

## Product Purpose

Transform raw JSON attendance data from HROne into clear, actionable analytics — showing worked hours, overtime, shortfall, net balance, day-by-day breakdown, and yesterday's quick summary — so employees can plan their future work duration without manually calculating from the portal.

## Positioning

Zero-install analytics layer on top of HROne's existing attendance system. Where HROne shows a calendar grid, this tool shows the numbers that matter: how much time you have in hand, how much you owe, and your daily patterns. Data flows automatically via extension or one-click bookmarklet — no copy-paste required.

## Operating Context

- Users are logged into HROne at `app.hrone.cloud` during work hours
- The tool runs on a local server or internal deployment accessible on the same network
- Data syncs when a user visits the HROne calendar and clicks the bookmarklet (or via the auto-intercepting extension)
- Multiple months accumulate over time and are selectable from a sidebar
- No authentication in the tool itself — data is per-browser via localStorage

## Capabilities and Constraints

**Capabilities:**
- Automatic data capture from HROne via Chrome extension or bookmarklet
- Day classification: Present, Week Off, Leave, Holiday, Half Day, Full Leave, Earned Leave, Pending, Missing
- Time calculations: shift duration, worked hours, extra/deficit per day
- Aggregate metrics: total hours, overtime, shortfall, net balance, averages, late counts
- Yesterday's summary card for quick daily check
- Sortable day-by-day table with color-coded extra/deficit and row highlights
- Multi-month localStorage persistence with sidebar navigation
- Personalized header showing employee name (extracted from HROne page)

**Constraints:**
- No backend server — purely client-side
- JWT cookie is HttpOnly, so direct API calls from the tool are blocked by CORS
- Data accuracy depends on HROne's `calculatedWorkingHours` field
- HROne uses "-" for future/unprocessed days and "HO" for holidays

**Terminology:**
- Worked_Day: Present or Half Day status
- Standard_Shift_Duration: shiftEndTime − shiftStartTime
- Net Balance: Overtime − Shortfall (positive = time in hand)

## Evidence on Hand

- Live HROne API endpoint: `POST /api/timeoffice/attendance/Calendar`
- Sample response data for July and August 2026
- Employee ID extraction from JWT payload (`LogOnId` field)
- Shift: 09:30–18:30 (GEN shift code), 9 hours standard

## Product Principles

1. **Instant clarity** — the most important number (net balance) is visible in seconds, not minutes of manual calculation
2. **Zero friction** — data arrives without copy-paste; one-click bookmarklet for colleagues, auto-sync extension for power users
3. **Trust the source** — never fabricate or estimate; display exactly what HROne reports, classified transparently
4. **Accumulate quietly** — months of data build up in localStorage automatically; the user never manages files or exports
5. **Respect privacy** — all data stays in the user's browser; no server, no telemetry, no sharing
