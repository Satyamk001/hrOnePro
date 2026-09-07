import type {
  ClassifiedRecord,
  EnrichedRecord,
  AggregateMetrics,
  DayStatus,
} from "../types";

/**
 * Convert "HH:MM" string to total minutes. Returns 0 for null/undefined/invalid input.
 */
export function parseHHMM(s: string | null | undefined): number {
  if (!s || !s.includes(":")) return 0;
  const [hours, minutes] = s.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Convert total minutes to "Xh Ym" format string.
 */
export function formatMinutes(m: number): string {
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Compute per-record time metrics from a ClassifiedRecord.
 * Falls back to timeIn/timeout calculation only if calculatedWorkingHours is
 * genuinely missing (no colon, e.g., "0" or empty), NOT if it's "00:00".
 * For Half Day records, shift duration is halved.
 */
export function computeRecordMetrics(record: ClassifiedRecord): EnrichedRecord {
  let shiftDurationMinutes =
    parseHHMM(record.shiftEndTime) - parseHHMM(record.shiftStartTime);

  // Half day: expected shift is half the full shift
  if (record.status === "Half Day") {
    shiftDurationMinutes = Math.floor(shiftDurationMinutes / 2);
  }

  let workedMinutes = parseHHMM(record.calculatedWorkingHours);

  // Fallback: only when calculatedWorkingHours has no colon (e.g., "0", "", null)
  // meaning HROne didn't provide a valid HH:MM value at all
  const hasValidCalcHours = record.calculatedWorkingHours && record.calculatedWorkingHours.includes(":");
  if (!hasValidCalcHours && record.timeIn && record.timeout) {
    const inMinutes = parseHHMM(record.timeIn);
    const outMinutes = parseHHMM(record.timeout);
    if (inMinutes > 0 && outMinutes > 0 && outMinutes > inMinutes) {
      workedMinutes = outMinutes - inMinutes;
    }
  }

  const extraDeficitMinutes = workedMinutes - shiftDurationMinutes;
  const isWorkedDay =
    record.status === "Present" || record.status === "Half Day";

  return {
    ...record,
    shiftDurationMinutes,
    workedMinutes,
    extraDeficitMinutes,
    isWorkedDay,
  };
}

/**
 * Compute aggregate metrics across all records.
 * Only Worked_Days (Present or Half Day) are included in aggregate computations.
 */
export function computeAggregateMetrics(
  records: ClassifiedRecord[]
): AggregateMetrics {
  // Enrich all records with per-record metrics
  const enrichedRecords = records.map(computeRecordMetrics);

  // Filter to worked days only
  const workedDays = enrichedRecords.filter((r) => r.isWorkedDay);

  // Count statuses
  const statusCounts: Record<DayStatus, number> = {
    Present: 0,
    "Week Off": 0,
    Leave: 0,
    "Half Day": 0,
    "Flexi Leave": 0,
    "Earned Leave": 0,
    Holiday: 0,
    Absent: 0,
    Pending: 0,
    Missing: 0,
    Other: 0,
  };
  for (const record of enrichedRecords) {
    statusCounts[record.status]++;
  }

  const workedDayCount = workedDays.length;

  // Compute total working minutes, extra, and shortfall
  let totalWorkingMinutes = 0;
  let totalExtraMinutes = 0;
  let totalShortfallMinutes = 0;
  let totalHrOneMinutes = 0; // Sum of raw calculatedWorkingHours from HROne

  for (const day of workedDays) {
    totalWorkingMinutes += day.workedMinutes;
    totalHrOneMinutes += parseHHMM(day.calculatedWorkingHours);
    if (day.extraDeficitMinutes > 0) {
      totalExtraMinutes += day.extraDeficitMinutes;
    } else if (day.extraDeficitMinutes < 0) {
      totalShortfallMinutes += Math.abs(day.extraDeficitMinutes);
    }
  }

  // Average work minutes — shift-weighted so a Half Day counts as 0.5 of a day.
  // This prevents a short half-day (e.g. 4h40m) from dragging down the per-day
  // pace, which is measured against a full 9h shift.
  // Exclude days with 0 worked minutes from the average (unprocessed days).
  const daysWithHours = workedDays.filter((d) => d.workedMinutes > 0);
  const effectiveDayCount = daysWithHours.reduce(
    (sum, d) => sum + (d.status === "Half Day" ? 0.5 : 1),
    0
  );
  const averageWorkMinutes =
    effectiveDayCount > 0 ? Math.floor(totalWorkingMinutes / effectiveDayCount) : 0;

  // Late count: records where isLateArrival is true (among worked days)
  const lateCount = workedDays.filter((r) => r.isLateArrival).length;

  // Late percentage: (lateCount / workedDayCount) * 100, rounded to 1 decimal
  const latePercentage =
    workedDayCount > 0
      ? Math.round((lateCount / workedDayCount) * 1000) / 10
      : 0;

  // Late by shift count: timeIn > shiftStartTime (string comparison, HH:MM is lexicographic)
  const lateByShiftCount = workedDays.filter(
    (r) => r.timeIn !== null && r.timeIn > r.shiftStartTime
  ).length;

  // Earliest/latest timeIn among worked days with non-null timeIn
  const workedWithTimeIn = workedDays.filter((r) => r.timeIn !== null);
  const earliestTimeIn =
    workedWithTimeIn.length > 0
      ? workedWithTimeIn.reduce((min, r) =>
          r.timeIn! < min ? r.timeIn! : min
        , workedWithTimeIn[0].timeIn!)
      : undefined;
  const latestTimeIn =
    workedWithTimeIn.length > 0
      ? workedWithTimeIn.reduce((max, r) =>
          r.timeIn! > max ? r.timeIn! : max
        , workedWithTimeIn[0].timeIn!)
      : undefined;

  // Earliest/latest timeout among worked days with non-null timeout
  const workedWithTimeout = workedDays.filter((r) => r.timeout !== null);
  const earliestTimeout =
    workedWithTimeout.length > 0
      ? workedWithTimeout.reduce((min, r) =>
          r.timeout! < min ? r.timeout! : min
        , workedWithTimeout[0].timeout!)
      : undefined;
  const latestTimeout =
    workedWithTimeout.length > 0
      ? workedWithTimeout.reduce((max, r) =>
          r.timeout! > max ? r.timeout! : max
        , workedWithTimeout[0].timeout!)
      : undefined;

  // Longest day: max workedMinutes among worked days; earliest date on tie
  let longestDay: { date: string; minutes: number } | undefined = undefined;
  if (workedDays.length > 0) {
    longestDay = workedDays.reduce(
      (best, r) => {
        if (
          r.workedMinutes > best.minutes ||
          (r.workedMinutes === best.minutes && r.attendanceDate < best.date)
        ) {
          return { date: r.attendanceDate, minutes: r.workedMinutes };
        }
        return best;
      },
      { date: workedDays[0].attendanceDate, minutes: workedDays[0].workedMinutes }
    );
  }

  // Shortest day: min workedMinutes among worked days; earliest date on tie
  let shortestDay: { date: string; minutes: number } | undefined = undefined;
  if (workedDays.length > 0) {
    shortestDay = workedDays.reduce(
      (best, r) => {
        if (
          r.workedMinutes < best.minutes ||
          (r.workedMinutes === best.minutes && r.attendanceDate < best.date)
        ) {
          return { date: r.attendanceDate, minutes: r.workedMinutes };
        }
        return best;
      },
      { date: workedDays[0].attendanceDate, minutes: workedDays[0].workedMinutes }
    );
  }

  return {
    totalDays: records.length,
    statusCounts,
    totalWorkingMinutes,
    totalHrOneMinutes,
    totalExtraMinutes,
    totalShortfallMinutes,
    averageWorkMinutes,
    workedDayCount,
    lateCount,
    latePercentage,
    earliestTimeIn,
    latestTimeIn,
    earliestTimeout,
    latestTimeout,
    longestDay,
    shortestDay,
    lateByShiftCount,
  };
}
