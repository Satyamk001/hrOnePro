import type { AttendanceRecord, ParseResult } from "../types";

/**
 * Required fields that must be present on each attendance record object.
 * Note: timeIn and timeout are checked for key presence, not non-null value.
 */
const REQUIRED_FIELDS: (keyof AttendanceRecord)[] = [
  "timeIn",
  "timeout",
  "attendanceDate",
  "shiftStartTime",
  "shiftEndTime",
  "calculatedWorkingHours",
  "updatedFirstHalfStatus",
  "updatedSecondHalfStatus",
  "isLeave",
];

/**
 * Checks whether a value is a plain object (not null, not an array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Parses and validates raw JSON attendance data input.
 *
 * Steps:
 * 1. Trim input; reject if empty/whitespace-only
 * 2. JSON.parse; catch syntax errors
 * 3. Reject primitives (not object/array)
 * 4. Normalize single object to array
 * 5. Validate each element is a plain object
 * 6. Check required fields on each object
 *
 * @param input - Raw JSON string from the user
 * @returns ParseResult - success with data or failure with error message
 */
export function parseAttendanceData(input: string): ParseResult {
  // Step 1: Trim and reject empty/whitespace-only input
  const trimmed = input.trim();
  if (trimmed === "") {
    return {
      success: false,
      error: "No input provided. Please paste your attendance JSON data.",
    };
  }

  // Step 2: Try JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `Invalid JSON: ${message}`,
    };
  }

  // Step 3: Reject non-object/array primitives
  if (typeof parsed !== "object" || parsed === null) {
    return {
      success: false,
      error:
        "Input must be a single attendance record object or an array of attendance record objects.",
    };
  }

  // Step 4: Normalize single object to array
  let records: unknown[];
  if (Array.isArray(parsed)) {
    records = parsed;
  } else {
    records = [parsed];
  }

  // Step 5: Validate each element is a plain object
  for (let i = 0; i < records.length; i++) {
    if (!isPlainObject(records[i])) {
      return {
        success: false,
        error:
          "Input must be a single attendance record object or an array of attendance record objects.",
      };
    }
  }

  // Step 6: Check required fields on each object
  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, unknown>;
    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !(field in record)
    );

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      };
    }
  }

  // All validations passed
  return {
    success: true,
    data: records as AttendanceRecord[],
  };
}
