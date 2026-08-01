# Requirements Document

## Introduction

"Attendance Insights" is a single-page web application that allows users to paste raw JSON attendance data exported from a biometric/HR system and view comprehensive analytics. The app computes status classifications, time metrics, summary statistics, visualizations, and a sortable day-by-day table — all client-side with no backend or persistent storage.

## Glossary

- **App**: The Attendance Insights single-page web application built with React 19, Vite, and TailwindCSS
- **Attendance_Record**: A JSON object representing one day of attendance data containing fields: employeeId, shiftId, timeIn, timeout, presentStatus, calculatedWorkingHours, isLeave, shiftStartTime, shiftEndTime, shiftCode, attendanceDate, updatedFirstHalfStatus, updatedSecondHalfStatus
- **Input_Area**: The textarea component where users paste raw JSON attendance data
- **Parser**: The module responsible for validating and parsing pasted JSON into Attendance_Record objects
- **Classifier**: The module that derives a per-day status from half-status fields, isLeave, and presentStatus
- **Time_Calculator**: The module that performs all time arithmetic (converting HH:MM to minutes, computing extras/deficits)
- **Dashboard**: The summary card grid displayed at the top of the page after data is loaded
- **Chart_Panel**: The section containing recharts-based visualizations
- **Day_Table**: The sortable day-by-day table displayed below charts
- **Worked_Day**: A day classified as Present or Half Day (not Week Off, Leave, or Missing)
- **Standard_Shift_Duration**: The difference between shiftEndTime and shiftStartTime for a given day, expressed in minutes

## Requirements

### Requirement 1: JSON Input and Validation

**User Story:** As a user, I want to paste raw JSON attendance data and have it validated instantly, so that I can quickly load my data without worrying about format issues.

#### Acceptance Criteria

1. THE App SHALL display an Input_Area (textarea) capable of accepting pasted JSON text of at least 1,000,000 characters
2. WHEN the user clicks the "Analyze" button, THE Parser SHALL validate the pasted text as valid JSON
3. WHEN the pasted JSON is a single Attendance_Record object, THE Parser SHALL normalize the input into an array containing that single object and update the internal structure representation to reflect the normalized array
4. WHEN the pasted JSON is an array of Attendance_Record objects, THE Parser SHALL accept the input as-is for further validation
5. IF the pasted text is empty or contains only whitespace when the user clicks "Analyze", THEN THE App SHALL display an inline error message indicating that no input was provided
6. IF the pasted text is not valid JSON, THEN THE App SHALL display an inline error message indicating the nature of the JSON syntax error
7. IF the parsed JSON is valid but is neither an object nor an array of objects, THEN THE App SHALL display an inline error message indicating that the data must be a single Attendance_Record object or an array of Attendance_Record objects
8. IF the parsed JSON objects are missing required fields (timeIn, timeout, attendanceDate, shiftStartTime, shiftEndTime, calculatedWorkingHours, updatedFirstHalfStatus, updatedSecondHalfStatus, isLeave), THEN THE App SHALL display an inline error message listing the missing fields
9. WHEN data passes all validation checks (valid JSON, correct structure, and all required fields present), THE App SHALL store the Attendance_Record array in component state for use across all views without requiring re-pasting
10. THE App SHALL NOT persist data to any backend service or browser localStorage

### Requirement 2: Status Classification

**User Story:** As a user, I want each day automatically classified into a clear status category, so that I can see my attendance pattern at a glance.

#### Acceptance Criteria

1. THE Classifier SHALL evaluate classification rules in the following precedence order (highest to lowest): isLeave check (criterion 3), Week Off (criterion 4), Present (criterion 2), Half Day (criterion 5), Full Leave (criterion 6), Earned Leave (criterion 7), Missing (criterion 8), Other (criterion 9)
2. WHEN updatedFirstHalfStatus is "P" and updatedSecondHalfStatus is "P" and isLeave equals 0, THE Classifier SHALL assign the status "Present"
3. WHEN isLeave equals 1, THE Classifier SHALL assign the status "Leave" regardless of half-status values
4. WHEN updatedFirstHalfStatus is "WO" and updatedSecondHalfStatus is "WO" and isLeave equals 0, THE Classifier SHALL assign the status "Week Off"
5. WHEN one of updatedFirstHalfStatus or updatedSecondHalfStatus is "P" and the other is one of "FL", "EL", or "HD", and isLeave equals 0, THE Classifier SHALL assign the status "Half Day"
6. WHEN updatedFirstHalfStatus is "FL" or updatedSecondHalfStatus is "FL", and isLeave equals 0, and neither half-status is "P", THE Classifier SHALL assign the status "Full Leave"
7. WHEN updatedFirstHalfStatus is "EL" or updatedSecondHalfStatus is "EL", and isLeave equals 0, and neither half-status is "P", THE Classifier SHALL assign the status "Earned Leave"
8. WHEN timeIn is null and timeout is null and the day is not classified as "Week Off" or "Leave", THE Classifier SHALL assign the status "Missing"
9. WHEN updatedFirstHalfStatus or updatedSecondHalfStatus contains a code not in the set {"P", "WO", "FL", "EL", "HD"}, THE Classifier SHALL assign the status "Other" and include both the updatedFirstHalfStatus and updatedSecondHalfStatus values in the status output
10. WHEN presentStatus equals "Late", THE Classifier SHALL flag the day as a late arrival as a secondary attribute without changing the primary status assigned by criteria 2–9

### Requirement 3: Time Calculations

**User Story:** As a user, I want accurate time computations showing overtime, shortfall, and averages, so that I can track my working hours precisely.

#### Acceptance Criteria

1. THE Time_Calculator SHALL convert all HH:MM time strings to minutes by computing (hours × 60) + minutes for internal arithmetic
2. THE Time_Calculator SHALL compute Standard_Shift_Duration as shiftEndTime minus shiftStartTime in minutes for each Attendance_Record
3. WHEN a day is classified as a Worked_Day, THE Time_Calculator SHALL compute the extra/deficit as calculatedWorkingHours minus Standard_Shift_Duration in minutes
4. WHEN a day is not classified as a Worked_Day (Week Off, Leave, Full Leave, Earned Leave, or Missing), THE Time_Calculator SHALL exclude that day from all aggregate time computations (total working hours, extra time, shortfall, and averages)
5. THE Time_Calculator SHALL compute total working hours as the sum of calculatedWorkingHours across all Worked_Days
6. THE Time_Calculator SHALL compute total extra time as the sum of positive extra/deficit values across all Worked_Days
7. THE Time_Calculator SHALL compute total shortfall as the absolute value of the sum of negative extra/deficit values across all Worked_Days
8. IF the count of Worked_Days is zero, THEN THE Time_Calculator SHALL report average work duration as "0h 0m" rather than producing a division error
9. WHEN the count of Worked_Days is greater than zero, THE Time_Calculator SHALL compute average work duration as total working hours divided by the count of Worked_Days, rounded down to the nearest minute
10. THE Time_Calculator SHALL identify the earliest and latest timeIn values across all Worked_Days that have non-null timeIn values; WHEN no Worked_Days have non-null timeIn values, THE Time_Calculator SHALL leave earliest and latest timeIn as undefined
11. THE Time_Calculator SHALL identify the earliest and latest timeout values across all Worked_Days that have non-null timeout values; WHEN no Worked_Days have non-null timeout values, THE Time_Calculator SHALL leave earliest and latest timeout as undefined
12. THE Time_Calculator SHALL count late arrivals using both criteria independently: (a) presentStatus equals "Late", and (b) timeIn is later than shiftStartTime, reporting both counts if they differ
13. THE Time_Calculator SHALL format computed hour values in "Xh Ym" format for display (e.g., "182h 45m"), where X is the integer hours and Y is the remaining minutes

### Requirement 4: Summary Dashboard

**User Story:** As a user, I want a visual summary dashboard with key metrics displayed as cards, so that I can get a quick overview of my attendance.

#### Acceptance Criteria

1. WHEN data is loaded, THE Dashboard SHALL display a card grid at the top of the page
2. WHEN data is loaded, THE Dashboard SHALL display the total number of days loaded
3. WHEN data is loaded, THE Dashboard SHALL display counts for each status category: Present, Week Off, Leave, Half Day, and Missing
4. WHEN data is loaded, THE Dashboard SHALL display total working hours formatted as "Xh Ym"
5. WHEN data is loaded, THE Dashboard SHALL display total overtime hours formatted as "Xh Ym"
6. WHEN data is loaded, THE Dashboard SHALL display total shortfall hours formatted as "Xh Ym"
7. WHEN the count of Worked_Days is greater than zero, THE Dashboard SHALL display average working hours per Worked_Day formatted as "Xh Ym"
8. IF the count of Worked_Days is zero, THEN THE Dashboard SHALL display "0h 0m" for the average working hours card regardless of whether data has been loaded
9. WHEN data is loaded, THE Dashboard SHALL display the count and percentage of late arrivals relative to total Worked_Days, with the percentage rounded to one decimal place
10. WHEN there are two or more Worked_Days, THE Dashboard SHALL display the longest working day with its date and duration
11. WHEN there are two or more Worked_Days, THE Dashboard SHALL display the shortest working day with its date and duration
12. IF multiple Worked_Days share the same longest (or shortest) duration, THEN THE Dashboard SHALL display the earliest date among the tied days

### Requirement 5: Visualizations

**User Story:** As a user, I want charts showing daily patterns and breakdowns, so that I can visually identify trends in my attendance.

#### Acceptance Criteria

1. WHEN data is loaded, THE Chart_Panel SHALL render a bar chart showing daily working hours alongside Standard_Shift_Duration for each date using recharts, including only Worked_Days
2. WHEN data is loaded, THE Chart_Panel SHALL render a line chart plotting daily timeIn and timeout values against the shift start and end times using recharts, including only Worked_Days that have non-null timeIn and timeout values
3. WHEN data is loaded, THE Chart_Panel SHALL render a pie or donut chart showing the percentage breakdown of all classified day types (Present, Week Off, Leave, Full Leave, Earned Leave, Half Day, Missing, Other) using recharts, omitting categories with zero count; WHEN all categories have zero count, THE Chart_Panel SHALL display an empty pie chart
4. WHEN the loaded data spans two or more ISO weeks, THE Chart_Panel SHALL render a weekly aggregation view showing average working hours per ISO week, computed from Worked_Days only
5. WHEN only a single day is loaded, THE Chart_Panel SHALL display single-data-point versions of all applicable charts (single-bar for bar chart, single-point for line chart, single-segment for pie chart) instead of hiding any chart
6. IF all loaded records have null timeIn and null timeout, THEN THE Chart_Panel SHALL hide the line chart and display a message indicating insufficient clock-in/clock-out data

### Requirement 6: Day-by-Day Table

**User Story:** As a user, I want a detailed sortable table of each day, so that I can inspect individual day records and spot issues.

#### Acceptance Criteria

1. WHEN data is loaded, THE Day_Table SHALL display one row per Attendance_Record with columns: Date, Day of Week, Status, Time In, Time Out, Worked Hours, Shift Hours, Extra/Deficit, Late Flag
2. WHEN the user clicks a column header, THE Day_Table SHALL sort all rows by that column in ascending order; WHEN the user clicks the same column header again, THE Day_Table SHALL toggle the sort to descending order; WHEN the user clicks a different column header, THE Day_Table SHALL sort by the new column starting in ascending order
3. WHEN the Extra/Deficit value is positive (overtime), THE Day_Table SHALL display the cell with green color coding
4. WHEN the Extra/Deficit value is negative (shortfall), THE Day_Table SHALL display the cell with red color coding
5. WHEN the Extra/Deficit value is exactly zero, THE Day_Table SHALL display "0h 0m" with no color coding applied
6. WHEN a day is classified as a non-Worked_Day (Week Off, Leave, or Missing), THE Day_Table SHALL display "—" in the Extra/Deficit cell and apply no color coding
7. WHEN a day is flagged as late, THE Day_Table SHALL highlight the entire row with a distinct background color to distinguish it from non-late rows
8. WHEN a day has a shortfall and is not flagged as late, THE Day_Table SHALL highlight the entire row with a distinct background color different from the late-arrival highlight
9. WHEN a day is both flagged as late and has a shortfall, THE Day_Table SHALL apply the late-arrival row highlight

### Requirement 7: User Experience and Responsiveness

**User Story:** As a user, I want a clean, modern, and responsive interface, so that I can use the app comfortably on any device.

#### Acceptance Criteria

1. THE App SHALL use TailwindCSS utility classes exclusively for styling (no inline styles)
2. THE App SHALL render all content without horizontal overflow or text truncation on viewport widths from 320px (mobile) to 1920px (desktop), adapting layout from single-column on viewports below 768px to multi-column on viewports 768px and above
3. WHILE no data is loaded, THE App SHALL display an empty state containing a text prompt instructing the user to paste JSON data, and a code block showing an example of the expected JSON shape matching the Attendance_Record structure
4. WHEN data parsing completes, THE App SHALL render the Dashboard, Chart_Panel, and Day_Table within 1 second of the Parser returning validated data
5. IF a single day of data is loaded, THEN THE App SHALL display the Dashboard and Day_Table, and display single-data-point versions of charts; WHEN multiple days are loaded, THE App SHALL display regular multi-point charts
6. IF an Attendance_Record contains null timeIn or null timeout for a Worked_Day, THEN THE App SHALL display "—" in the corresponding table cell AND exclude the record from clock-in/clock-out statistics; both behaviors are required together and partial compliance SHALL be rejected

### Requirement 8: Technology Stack

**User Story:** As a developer, I want the app built with specific modern technologies, so that it is lightweight, fast, and maintainable.

#### Acceptance Criteria

1. THE App SHALL be built using React 19 as the UI framework
2. THE App SHALL use Vite as the build tool and development server
3. THE App SHALL use TailwindCSS for all styling
4. THE App SHALL use recharts for all chart visualizations
5. THE App SHALL use date-fns or native JavaScript Date API for date manipulation
6. THE App SHALL be organized into separate React component files for at minimum Input, Dashboard, Charts, and Table concerns, with no single component file exceeding 300 lines of code
7. THE App SHALL operate as a single-page client-side application with no backend server, no database, and no localStorage, keeping all state in-memory
8. THE App SHALL produce a production build via Vite that completes without errors or warnings

### Requirement 9: JSON Parser Round-Trip Integrity

**User Story:** As a user, I want confidence that my pasted data is preserved accurately through parsing, so that all computed insights reflect the original data.

#### Acceptance Criteria

1. FOR ALL valid JSON input strings representing Attendance_Record arrays, WHEN the Parser processes the input, THE Parser SHALL produce an internal array where each element contains all fields from the corresponding original JSON object with identical values
2. WHEN the Parser receives valid input, THE Parser SHALL produce an output array whose length equals the number of objects in the original input (1 for a single object, N for an array of N objects)
3. WHEN the Parser receives valid input containing null field values, THE Parser SHALL preserve those null values in the internal data structure without converting them to undefined, empty strings, or default values
4. WHEN the Parser receives valid input, THE Parser SHALL preserve all numeric fields (employeeId, shiftId, isLeave) as numbers and all string fields (timeIn, timeout, presentStatus, calculatedWorkingHours, shiftStartTime, shiftEndTime, shiftCode, attendanceDate, updatedFirstHalfStatus, updatedSecondHalfStatus) as strings in the internal data structure
