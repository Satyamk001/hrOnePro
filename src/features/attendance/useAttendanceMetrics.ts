import { useMemo } from "react";
import type {
  DashboardMetrics,
  EnrichedRecord,
  SavedEntry,
  TodayAttendance,
} from "../../types";
import { classifyRecord } from "../../utils/classifier";
import {
  computeAggregateMetrics,
  computeRecordMetrics,
  formatMinutes,
} from "../../utils/timeCalculator";
import { DEFAULT_SHIFT_MINUTES, shiftLengthMinutes } from "../../utils/liveTime";
import { findLastWorkingDayRecord } from "./helpers";

interface Params {
  entries: SavedEntry[];
  activeKey: string | null;
  /** Local "YYYY-MM-DD" for today — a dependency so midnight re-derives. */
  today: string;
  todayAttendance: TodayAttendance | null;
  showAllDays: boolean;
}

/**
 * Everything derived from the selected month's records: classification,
 * enrichment, aggregate + table data, and the "today"/"yesterday" views.
 */
export function useAttendanceMetrics({
  entries,
  activeKey,
  today,
  todayAttendance,
  showAllDays,
}: Params) {
  const attendanceData = useMemo(() => {
    if (!activeKey) return null;
    return entries.find((e) => e.key === activeKey)?.records ?? null;
  }, [activeKey, entries]);

  const classifiedRecords = useMemo(() => attendanceData?.map(classifyRecord) ?? null, [attendanceData]);
  const enrichedRecords = useMemo(() => classifiedRecords?.map(computeRecordMetrics) ?? null, [classifiedRecords]);
  const dashboardMetrics = useMemo<DashboardMetrics | null>(() => {
    if (!classifiedRecords) return null;
    const a = computeAggregateMetrics(classifiedRecords);
    return { ...a, formattedTotalHours: formatMinutes(a.totalWorkingMinutes), formattedExtraHours: formatMinutes(a.totalExtraMinutes), formattedShortfall: formatMinutes(a.totalShortfallMinutes), formattedAverage: formatMinutes(a.averageWorkMinutes) };
  }, [classifiedRecords]);

  const tableRecords = useMemo(() => {
    if (!enrichedRecords) return null;
    return showAllDays ? enrichedRecords : enrichedRecords.filter((r) => r.isWorkedDay);
  }, [enrichedRecords, showAllDays]);

  const activeLabel = entries.find((e) => e.key === activeKey)?.label;

  // Compute last working day record for the profile panel
  const yesterdayRecord = useMemo<EnrichedRecord | null>(() => {
    const result = findLastWorkingDayRecord(enrichedRecords, entries, new Date());
    return result ? result.record : null;
    // `today` re-runs this at midnight so "yesterday" moves forward.
  }, [enrichedRecords, entries, today]);

  // Today's record straight from the Calendar data (today's row is included in
  // the monthly records). This is the fallback source for the "Today" card when
  // there's no live RawPunch data (e.g. the bookmarklet path, or before punches
  // load). Prefer the live `todayAttendance` when available since it updates
  // intraday; otherwise synthesize a TodayAttendance from today's record.
  const todayRecord = useMemo<EnrichedRecord | null>(() => {
    if (enrichedRecords) {
      const rec = enrichedRecords.find((r) => r.attendanceDate === today);
      if (rec) return rec;
    }
    // Today may live in a different month entry than the one being viewed.
    for (const entry of entries) {
      const match = entry.records.find((r) => r.attendanceDate.split("T")[0] === today);
      if (match) return computeRecordMetrics(classifyRecord({ ...match, attendanceDate: today }));
    }
    return null;
  }, [enrichedRecords, entries, today]);

  const effectiveTodayAttendance = useMemo<TodayAttendance | null>(() => {
    if (todayAttendance && todayAttendance.date === today) return todayAttendance;
    const rec = todayRecord;
    // Only show a Today card if the person actually punched in today.
    if (!rec || !rec.timeIn) return null;
    return {
      date: today,
      firstPunch: rec.timeIn,
      lastPunch: rec.timeout ?? rec.timeIn,
      punchCount: rec.timeout ? 2 : 1,
      workedMinutesSoFar: rec.workedMinutes,
      isStillIn: !rec.timeout,
    };
  }, [todayAttendance, todayRecord, today]);

  // Shift length for "Can leave at": today's scheduled shift from HROne, else
  // the most recent day that has shift times, else the 9h GEN default.
  const todayShiftMinutes = useMemo<number>(() => {
    const fromToday = todayRecord ? shiftLengthMinutes(todayRecord.shiftStartTime, todayRecord.shiftEndTime) : null;
    if (fromToday) return fromToday;
    const all = entries
      .flatMap((e) => e.records)
      .filter((r) => r.shiftStartTime && r.shiftEndTime && r.attendanceDate.split("T")[0] <= today)
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
    for (const r of all) {
      const len = shiftLengthMinutes(r.shiftStartTime, r.shiftEndTime);
      if (len) return len;
    }
    return DEFAULT_SHIFT_MINUTES;
  }, [todayRecord, entries, today]);

  return {
    attendanceData,
    classifiedRecords,
    enrichedRecords,
    dashboardMetrics,
    tableRecords,
    activeLabel,
    yesterdayRecord,
    todayRecord,
    effectiveTodayAttendance,
    todayShiftMinutes,
  };
}
