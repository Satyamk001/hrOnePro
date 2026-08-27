import type { AttendanceRecord, ClassifiedRecord } from "../types";

/**
 * Classifies an attendance record into a status category based on
 * defined precedence rules and sets the late arrival flag independently.
 *
 * Classification precedence (first match wins):
 * 1. isLeave === 1 → "Leave"
 * 2. Both halves "HO" → "Holiday"
 * 3. Both halves "WO" → "Week Off"
 * 4. Both halves "P" → "Present"
 * 5. One half "P", other in {"FL","EL","HD"} → "Half Day"
 * 6. Either half "FL", neither "P" → "Full Leave"
 * 7. Either half "EL", neither "P" → "Earned Leave"
 * 8. Both halves "-" → "Pending" (future/unprocessed days in HROne)
 * 9. timeIn === null && timeout === null → "Missing"
 * 10. Otherwise → "Other"
 */
export function classifyRecord(record: AttendanceRecord): ClassifiedRecord {
  const firstHalf = record.updatedFirstHalfStatus;
  const secondHalf = record.updatedSecondHalfStatus;

  // Late flag is independent of primary classification
  const isLateArrival = record.presentStatus === "Late";

  // 1. Check half-day combinations FIRST (one half P + other leave type)
  //    This takes priority over isLeave flag because isLeave=1 can be set for half-days too
  const halfDayCodes = new Set(["FL", "EL", "HD"]);
  if (
    (firstHalf === "P" && halfDayCodes.has(secondHalf)) ||
    (secondHalf === "P" && halfDayCodes.has(firstHalf))
  ) {
    return { ...record, status: "Half Day", isLateArrival };
  }

  // 2. isLeave === 1 AND not a half-day → full day leave
  if (record.isLeave === 1) {
    return { ...record, status: "Leave", isLateArrival };
  }

  // 3. Both halves "HO" → "Holiday"
  if (firstHalf === "HO" && secondHalf === "HO") {
    return { ...record, status: "Holiday", isLateArrival };
  }

  // 4. Both halves "WO" → "Week Off"
  if (firstHalf === "WO" && secondHalf === "WO") {
    return { ...record, status: "Week Off", isLateArrival };
  }

  // 5. Both halves "P" → "Present"
  if (firstHalf === "P" && secondHalf === "P") {
    return { ...record, status: "Present", isLateArrival };
  }

  // 6. Either half "FL", neither "P" → "Flexi Leave"
  if (
    (firstHalf === "FL" || secondHalf === "FL") &&
    firstHalf !== "P" &&
    secondHalf !== "P"
  ) {
    return { ...record, status: "Flexi Leave", isLateArrival };
  }

  // 7. Either half "EL", neither "P" → "Earned Leave"
  if (
    (firstHalf === "EL" || secondHalf === "EL") &&
    firstHalf !== "P" &&
    secondHalf !== "P"
  ) {
    return { ...record, status: "Earned Leave", isLateArrival };
  }

  // 8. Both halves "-" → "Pending" (future/unprocessed days)
  if (firstHalf === "-" && secondHalf === "-") {
    return { ...record, status: "Pending", isLateArrival };
  }

  // 8b. Either half "A" (Absent) → "Absent"
  if (firstHalf === "A" || secondHalf === "A") {
    return { ...record, status: "Absent", isLateArrival };
  }

  // 9. timeIn === null && timeout === null → "Missing"
  if (record.timeIn === null && record.timeout === null) {
    return { ...record, status: "Missing", isLateArrival };
  }

  // 10. Otherwise → "Other" (include both half-status values in otherDetail)
  return {
    ...record,
    status: "Other",
    otherDetail: `${firstHalf}/${secondHalf}`,
    isLateArrival,
  };
}
