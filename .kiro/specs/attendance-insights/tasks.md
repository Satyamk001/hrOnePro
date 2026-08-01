# Implementation Plan: Attendance Insights

## Overview

This plan implements a client-side React 19 + Vite + TailwindCSS single-page application that parses raw JSON attendance data and renders comprehensive analytics. The implementation follows the pipeline architecture: Parser → Classifier → TimeCalculator → Presentation Components. Each task builds incrementally, wiring modules together as they are completed.

## Tasks

- [x] 1. Set up project structure and core type definitions
  - [x] 1.1 Initialize Vite + React 19 + TypeScript project with TailwindCSS and recharts
    - Run `npm create vite@latest` with React+TypeScript template
    - Install dependencies: tailwindcss, postcss, autoprefixer, recharts, fast-check (dev), vitest (dev), @testing-library/react (dev), @testing-library/jest-dom (dev), jsdom (dev)
    - Configure TailwindCSS (tailwind.config.js, postcss.config.js, index.css with @tailwind directives)
    - Configure Vitest in vite.config.ts with jsdom environment
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.2 Define core TypeScript interfaces and types
    - Create `src/types/index.ts` with AttendanceRecord, DayStatus, ClassifiedRecord, EnrichedRecord, RecordMetrics, AggregateMetrics, DashboardMetrics, ParseResult interfaces
    - Ensure DayStatus is a union type: "Present" | "Week Off" | "Leave" | "Half Day" | "Full Leave" | "Earned Leave" | "Missing" | "Other"
    - _Requirements: 2.1, 3.1, 9.1_

  - [x] 1.3 Create directory structure for utils and components
    - Create `src/utils/` for parser.ts, classifier.ts, timeCalculator.ts
    - Create `src/components/` for InputPanel.tsx, Dashboard.tsx, Charts.tsx, DayTable.tsx
    - Create `src/__tests__/` for integration tests
    - _Requirements: 8.6_

- [x] 2. Implement Parser module
  - [x] 2.1 Implement parseAttendanceData function in src/utils/parser.ts
    - Export `parseAttendanceData(input: string): ParseResult`
    - Step 1: Trim input; if empty/whitespace-only return error "No input provided. Please paste your attendance JSON data."
    - Step 2: Try JSON.parse; on catch return error "Invalid JSON: {message}"
    - Step 3: If parsed result is not object/array, return error about data structure
    - Step 4: Normalize single object to array
    - Step 5: Validate each element is a plain object
    - Step 6: Check required fields (timeIn, timeout, attendanceDate, shiftStartTime, shiftEndTime, calculatedWorkingHours, updatedFirstHalfStatus, updatedSecondHalfStatus, isLeave) on each object; list missing ones
    - Return `{ success: true, data: AttendanceRecord[] }` on success
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 9.1, 9.2, 9.3, 9.4_

  - [x] 2.2 Write unit tests for parser
    - Test empty string input returns error
    - Test whitespace-only input returns error
    - Test invalid JSON returns syntax error
    - Test valid JSON primitive (number, boolean, null) returns structure error
    - Test single object normalization to array
    - Test array input accepted as-is
    - Test missing required fields lists exactly the missing ones
    - Test valid input preserves all fields, nulls, and types
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 9.1, 9.2, 9.3, 9.4_

  - [x] 2.3 Write property test for parser round-trip (Property 1)
    - **Property 1: Parser round-trip preserves all fields**
    - Generate arbitrary valid AttendanceRecord arrays, serialize to JSON, parse, and assert all fields match
    - **Validates: Requirements 9.1, 1.3, 1.4**

  - [x] 2.4 Write property test for parser array length (Property 2)
    - **Property 2: Parser preserves array length**
    - Generate arrays of 1–50 valid records, parse, assert output length equals input length
    - **Validates: Requirements 9.2**

  - [x] 2.5 Write property test for parser type and null fidelity (Property 3)
    - **Property 3: Parser type and null fidelity**
    - Generate records with null timeIn/timeout, verify nulls preserved as null, numbers as numbers, strings as strings
    - **Validates: Requirements 9.3, 9.4**

  - [x] 2.6 Write property test for whitespace-only input rejection (Property 4)
    - **Property 4: Whitespace-only input rejection**
    - Generate strings of only spaces, tabs, newlines; assert error result
    - **Validates: Requirements 1.5**

  - [x] 2.7 Write property test for non-object/array JSON rejection (Property 5)
    - **Property 5: Non-object/array JSON rejection**
    - Generate primitive JSON values (numbers, booleans, strings, null); assert error result
    - **Validates: Requirements 1.7**

  - [x] 2.8 Write property test for missing required fields detection (Property 6)
    - **Property 6: Missing required fields detection**
    - Generate objects missing random subsets of required fields; assert error lists exactly those fields
    - **Validates: Requirements 1.8**

- [x] 3. Implement Classifier module
  - [x] 3.1 Implement classifyRecord function in src/utils/classifier.ts
    - Export `classifyRecord(record: AttendanceRecord): ClassifiedRecord`
    - Implement classification precedence (top to bottom, first match wins):
      1. isLeave === 1 → "Leave"
      2. Both halves "WO" → "Week Off"
      3. Both halves "P" → "Present"
      4. One half "P", other in {"FL","EL","HD"} → "Half Day"
      5. Either half "FL", neither "P" → "Full Leave"
      6. Either half "EL", neither "P" → "Earned Leave"
      7. timeIn === null && timeout === null → "Missing"
      8. Otherwise → "Other" (include both half-status values in otherDetail)
    - Set isLateArrival = presentStatus === "Late" (independent of primary status)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.2 Write unit tests for classifier
    - Test one example per classification rule
    - Test that isLeave=1 always overrides other codes
    - Test late flag set independently from primary status
    - Test "Other" includes raw codes in otherDetail
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.3 Write property test for classification precedence (Property 7)
    - **Property 7: Classification precedence correctness**
    - Generate records with various combinations of isLeave, half-statuses, timeIn/timeout; verify correct status assigned per precedence rules
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

  - [x] 3.4 Write property test for late flag independence (Property 8)
    - **Property 8: Late flag independence from primary status**
    - Generate records with presentStatus="Late" and verify isLateArrival is true AND primary status is unchanged from what would be assigned without "Late"
    - **Validates: Requirements 2.10**

- [x] 4. Implement Time Calculator module
  - [x] 4.1 Implement time calculation functions in src/utils/timeCalculator.ts
    - Export `parseHHMM(s: string): number` — convert "HH:MM" to total minutes
    - Export `formatMinutes(m: number): string` — convert minutes to "Xh Ym"
    - Export `computeRecordMetrics(record: ClassifiedRecord): EnrichedRecord`
      - shiftDurationMinutes = parseHHMM(shiftEndTime) - parseHHMM(shiftStartTime)
      - workedMinutes = parseHHMM(calculatedWorkingHours)
      - extraDeficitMinutes = workedMinutes - shiftDurationMinutes
      - isWorkedDay = status is "Present" or "Half Day"
    - Export `computeAggregateMetrics(records: ClassifiedRecord[]): AggregateMetrics`
      - Filter to Worked_Days only for all aggregate computations
      - Compute totalWorkingMinutes, totalExtraMinutes, totalShortfallMinutes
      - Compute averageWorkMinutes (floor division, 0 if no worked days)
      - Compute earliestTimeIn, latestTimeIn, earliestTimeout, latestTimeout from non-null values
      - Compute longestDay, shortestDay (earliest date on tie)
      - Compute lateCount, latePercentage, lateByShiftCount
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

  - [x] 4.2 Write unit tests for time calculator
    - Test parseHHMM with various valid "HH:MM" strings
    - Test formatMinutes with boundary values (0, 59, 60, 600)
    - Test computeRecordMetrics with known input/output
    - Test computeAggregateMetrics with zero worked days (expect "0h 0m")
    - Test aggregate with all-null timeIn/timeout (expect undefined min/max)
    - Test tied longest/shortest day selects earliest date
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

  - [x] 4.3 Write property test for time format round-trip (Property 9)
    - **Property 9: Time format round-trip**
    - Generate non-negative integers, format to "Xh Ym", parse back, assert equality
    - **Validates: Requirements 3.1, 3.13**

  - [x] 4.4 Write property test for extra/deficit computation (Property 10)
    - **Property 10: Extra/deficit computation correctness**
    - Generate valid worked-day records with known calculatedWorkingHours and shift times, verify extra/deficit equals the difference
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.5 Write property test for non-worked day exclusion (Property 11)
    - **Property 11: Non-worked day exclusion from aggregates**
    - Generate mixed records, compute aggregates, add/remove non-worked-day records, assert aggregates unchanged
    - **Validates: Requirements 3.4**

  - [x] 4.6 Write property test for aggregate totals (Property 12)
    - **Property 12: Aggregate totals correctness**
    - Generate sets with at least one worked day, verify total hours = sum of calculatedWorkingHours, extra = sum of positives, shortfall = abs sum of negatives
    - **Validates: Requirements 3.5, 3.6, 3.7**

  - [x] 4.7 Write property test for average correctness (Property 13)
    - **Property 13: Average work duration correctness**
    - Generate non-empty sets of worked days, verify average = floor(total / count)
    - **Validates: Requirements 3.9**

  - [x] 4.8 Write property test for min/max time identification (Property 14)
    - **Property 14: Min/max time identification**
    - Generate sets with non-null timeIn/timeout values, verify earliestTimeIn is the minimum and latestTimeIn is the maximum
    - **Validates: Requirements 3.10, 3.11**

- [x] 5. Checkpoint - Core logic modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement InputPanel component
  - [x] 6.1 Create InputPanel component in src/components/InputPanel.tsx
    - Textarea accepting large text (1,000,000+ chars)
    - "Analyze" button triggers parsing via props callback
    - Display inline error messages below textarea on validation failure
    - Clear error when textarea content changes
    - Show only one error at a time (first validation failure)
    - Props: `onDataParsed: (data: AttendanceRecord[]) => void`
    - Use TailwindCSS utility classes exclusively
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8_

- [x] 7. Implement Dashboard component
  - [x] 7.1 Create Dashboard component in src/components/Dashboard.tsx
    - Render a responsive card grid using TailwindCSS
    - Display cards for: total days, status counts (Present, Week Off, Leave, Half Day, Missing), total working hours, overtime, shortfall, average hours, late count/percentage, longest day, shortest day
    - Format all hour values as "Xh Ym"
    - Late percentage rounded to one decimal place
    - Show longest/shortest day only when 2+ worked days exist
    - Handle zero worked days gracefully (show "0h 0m")
    - Props: `metrics: DashboardMetrics`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 8. Implement Charts component
  - [x] 8.1 Create Charts component in src/components/Charts.tsx
    - Bar chart: daily worked hours vs Standard_Shift_Duration (Worked_Days only) using recharts
    - Line chart: daily timeIn/timeout vs shift times (Worked_Days with non-null times) using recharts; hide with message if all times are null
    - Pie/Donut chart: percentage breakdown of all status categories; omit zero-count categories
    - Weekly aggregation chart: average hours per ISO week (show only when data spans 2+ ISO weeks)
    - Handle single-day data (single-bar, single-point, single-segment)
    - Props: `records: ClassifiedRecord[], metrics: TimeMetrics` (or enriched records)
    - Use TailwindCSS for layout, recharts for chart rendering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9. Implement DayTable component
  - [x] 9.1 Create DayTable component in src/components/DayTable.tsx
    - Display columns: Date, Day of Week, Status, Time In, Time Out, Worked Hours, Shift Hours, Extra/Deficit, Late Flag
    - Implement column header click sorting (ascending on first click, toggle on same column, reset on new column)
    - Green color coding for positive Extra/Deficit, red for negative, no color for zero
    - Display "—" for non-Worked_Day Extra/Deficit cells and null timeIn/timeout
    - Late row highlight with distinct background color
    - Shortfall (non-late) row highlight with different distinct background color
    - Late+shortfall combined uses late highlight
    - Props: `records: EnrichedRecord[]`
    - Use TailwindCSS exclusively for styling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.6_

- [x] 10. Checkpoint - All components implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Wire everything together in App component
  - [x] 11.1 Implement App component with full data pipeline
    - Create `src/App.tsx` as the root state holder
    - State: `attendanceData: AttendanceRecord[] | null`
    - Empty state: display prompt with example JSON shape when no data loaded
    - On data parsed: store in state, run classifier on all records, compute time metrics, compute dashboard metrics
    - Render InputPanel always; render Dashboard, Charts, DayTable only when data is loaded
    - Ensure all computation completes and renders within 1 second of parse
    - No data persistence (no localStorage, no backend calls)
    - Responsive layout: single-column below 768px, multi-column at 768px+
    - _Requirements: 1.9, 1.10, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.6, 8.7_

  - [x] 11.2 Write integration tests for full data flow
    - Test: paste valid JSON → parse → classify → compute → verify Dashboard renders expected metrics
    - Test: paste invalid JSON → verify error displayed inline
    - Test: verify empty state shows prompt and example JSON
    - Test: verify single-day data renders all components
    - _Requirements: 1.2, 1.5, 4.1, 7.3, 7.5_

- [-] 12. Final checkpoint - Verify production build
  - Ensure all tests pass and `npm run build` completes without errors or warnings, ask the user if questions arise.
  - _Requirements: 8.8_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All styling uses TailwindCSS utility classes exclusively (no inline styles, no CSS files)
- The app uses TypeScript throughout with strict type checking
- recharts handles all chart rendering; no custom SVG/canvas drawing
- fast-check is the PBT library for all property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "3.2", "3.3", "3.4", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8"] },
    { "id": 4, "tasks": ["6.1", "7.1", "8.1", "9.1"] },
    { "id": 5, "tasks": ["11.1"] },
    { "id": 6, "tasks": ["11.2"] }
  ]
}
```
netsh interface portproxy add v4tov4 listenport=3333 listenaddress=0.0.0.0 connectport=3333 connectaddress=172.20.181192 