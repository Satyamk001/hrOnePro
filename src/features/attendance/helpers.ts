/**
 * Pure helpers for the attendance domain: month derivation, record
 * normalization, and "today" / "last working day" resolution.
 */
import type {
  AttendanceRecord,
  EnrichedRecord,
  RawPunch,
  SavedEntry,
  TodayAttendance,
} from "../../types";
import { classifyRecord } from "../../utils/classifier";
import { computeRecordMetrics } from "../../utils/timeCalculator";
import { localDateDaysAgo, localDateString } from "../../utils/liveTime";

/** Key "YYYY-MM" of the month with the most records. */
export function deriveMonthKey(records: AttendanceRecord[]): string {
  const monthCounts: Record<string, number> = {};
  for (const r of records) {
    const dateOnly = r.attendanceDate.split("T")[0];
    const monthKey = dateOnly.substring(0, 7);
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  }
  let maxKey = "", maxCount = 0;
  for (const [key, count] of Object.entries(monthCounts)) {
    if (count > maxCount) { maxCount = count; maxKey = key; }
  }
  return maxKey;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Strip any time part from attendanceDate so keys/joins stay date-only. */
export function normalizeRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return records.map((r) => ({ ...r, attendanceDate: r.attendanceDate.split("T")[0] }));
}

/**
 * Derive today's live attendance from raw HROne punches. Shared by both the
 * extension (TodayPunchesFromExtension event) and the bookmarklet (postMessage
 * with todayPunches) so the "Today" card behaves identically for both paths.
 * Returns null when there are no usable punches for today.
 */
export function deriveTodayAttendance(rawPunches: RawPunch[]): TodayAttendance | null {
  if (!Array.isArray(rawPunches) || rawPunches.length === 0) return null;
  const punches = rawPunches
    .filter((p) => !p.isPunchExcluded)
    .sort((a, b) => a.punchDateTime.localeCompare(b.punchDateTime));
  if (punches.length === 0) return null;

  const firstPunch = punches[0].punchDateTime;
  const lastPunch = punches[punches.length - 1].punchDateTime;
  const firstTime = new Date(firstPunch);
  const lastTime = new Date(lastPunch);
  const now = new Date();
  // Only treat these as "today" if the punches are from today — compared in
  // LOCAL time, not UTC. HROne punch timestamps read as the user's local day;
  // a UTC comparison wrongly rejects valid punches near the day boundary
  // (e.g. evening in IST is already the next day in UTC).
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const date = localDate(firstTime);
  if (date !== localDate(now)) return null;
  // Worked so far = from first punch to now (regardless of punch count)
  const workedMs = now.getTime() - firstTime.getTime();
  const workedMinutesSoFar = Math.max(0, Math.floor(workedMs / 60000));
  // Still "in" when there's an odd number of punches
  const isStillIn = punches.length % 2 !== 0;

  const formatHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return {
    date,
    firstPunch: formatHHMM(firstTime),
    lastPunch: formatHHMM(lastTime),
    punchCount: punches.length,
    workedMinutesSoFar,
    isStillIn,
    rawPunches: punches,
  };
}

/**
 * localStorage decode for today's punches — only accept data actually stored
 * for today (LOCAL date), so stale punches from a previous day don't linger.
 */
export function decodeStoredToday(raw: string): TodayAttendance | null {
  try {
    const stored = JSON.parse(raw) as TodayAttendance;
    return stored.date === localDateString() ? stored : null;
  } catch {
    return null;
  }
}

/** Records with a timeIn — the "punched" count used in sync/undo messages. */
export function countPunchedDays(records: AttendanceRecord[]): number {
  return records.filter((r) => r.timeIn).length;
}

const NON_WORKING_STATUSES = new Set(["Week Off", "Holiday"]);

/** Walk backwards from yesterday up to 7 days to find the most recent working day record */
export function findLastWorkingDayRecord(
  enrichedRecords: EnrichedRecord[] | null,
  allEntries: SavedEntry[],
  now: Date = new Date()
): { record: EnrichedRecord; date: string; daysAgo: number } | null {
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    // Local date — UTC would point at the wrong day before 05:30 IST.
    const dateStr = localDateDaysAgo(daysBack, now);

    let rec: EnrichedRecord | undefined;

    if (enrichedRecords) {
      rec = enrichedRecords.find((r) => r.attendanceDate === dateStr);
    }

    if (!rec && allEntries.length > 0) {
      for (const entry of allEntries) {
        const match = entry.records
          .map((r) => ({ ...r, attendanceDate: r.attendanceDate.split("T")[0] }))
          .find((r) => r.attendanceDate === dateStr);
        if (match) { rec = computeRecordMetrics(classifyRecord(match)); break; }
      }
    }

    if (!rec) continue;
    // If this day is a non-working day, skip and keep looking
    if (NON_WORKING_STATUSES.has(rec.status)) continue;
    return { record: rec, date: dateStr, daysAgo: daysBack };
  }
  return null;
}
