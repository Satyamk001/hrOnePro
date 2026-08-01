import { describe, it, expect } from "vitest";
import {
  parseHHMM,
  formatMinutes,
  computeRecordMetrics,
  computeAggregateMetrics,
} from "./timeCalculator";
import type { ClassifiedRecord } from "../types";

/**
 * Helper to build a ClassifiedRecord with sensible defaults for testing.
 */
function makeRecord(overrides: Partial<ClassifiedRecord> = {}): ClassifiedRecord {
  return {
    employeeId: 1,
    shiftId: 1,
    timeIn: "09:00",
    timeout: "18:00",
    presentStatus: "Present",
    calculatedWorkingHours: "09:00",
    isLeave: 0,
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    shiftCode: "GEN",
    attendanceDate: "2024-01-01",
    updatedFirstHalfStatus: "P",
    updatedSecondHalfStatus: "P",
    status: "Present",
    isLateArrival: false,
    ...overrides,
  };
}

describe("parseHHMM", () => {
  it('converts "09:30" to 570 minutes', () => {
    expect(parseHHMM("09:30")).toBe(570);
  });

  it('converts "00:00" to 0 minutes', () => {
    expect(parseHHMM("00:00")).toBe(0);
  });

  it('converts "23:59" to 1439 minutes', () => {
    expect(parseHHMM("23:59")).toBe(1439);
  });

  it('converts "01:00" to 60 minutes', () => {
    expect(parseHHMM("01:00")).toBe(60);
  });

  it('converts "12:30" to 750 minutes', () => {
    expect(parseHHMM("12:30")).toBe(750);
  });
});

describe("formatMinutes", () => {
  it('formats 0 as "0h 0m"', () => {
    expect(formatMinutes(0)).toBe("0h 0m");
  });

  it('formats 59 as "0h 59m"', () => {
    expect(formatMinutes(59)).toBe("0h 59m");
  });

  it('formats 60 as "1h 0m"', () => {
    expect(formatMinutes(60)).toBe("1h 0m");
  });

  it('formats 600 as "10h 0m"', () => {
    expect(formatMinutes(600)).toBe("10h 0m");
  });

  it('formats 125 as "2h 5m"', () => {
    expect(formatMinutes(125)).toBe("2h 5m");
  });
});

describe("computeRecordMetrics", () => {
  it("computes correct metrics for a record with extra time", () => {
    const record = makeRecord({
      shiftStartTime: "09:00",
      shiftEndTime: "18:00",
      calculatedWorkingHours: "10:00",
    });

    const result = computeRecordMetrics(record);

    // Shift duration: 18:00 - 09:00 = 540 minutes
    expect(result.shiftDurationMinutes).toBe(540);
    // Worked: 10:00 = 600 minutes
    expect(result.workedMinutes).toBe(600);
    // Extra: 600 - 540 = 60 minutes
    expect(result.extraDeficitMinutes).toBe(60);
    // Present → isWorkedDay
    expect(result.isWorkedDay).toBe(true);
  });

  it("computes negative extra/deficit for shortfall", () => {
    const record = makeRecord({
      shiftStartTime: "09:00",
      shiftEndTime: "18:00",
      calculatedWorkingHours: "08:00",
    });

    const result = computeRecordMetrics(record);

    // Worked: 480 minutes, Shift: 540 → deficit = -60
    expect(result.extraDeficitMinutes).toBe(-60);
  });

  it("marks non-worked days correctly", () => {
    const record = makeRecord({
      status: "Week Off",
    });

    const result = computeRecordMetrics(record);
    expect(result.isWorkedDay).toBe(false);
  });

  it("marks Half Day as a worked day", () => {
    const record = makeRecord({
      status: "Half Day",
    });

    const result = computeRecordMetrics(record);
    expect(result.isWorkedDay).toBe(true);
  });
});

describe("computeAggregateMetrics", () => {
  it("returns averageWorkMinutes=0 when there are zero worked days", () => {
    const records: ClassifiedRecord[] = [
      makeRecord({ status: "Week Off" }),
      makeRecord({ status: "Leave" }),
      makeRecord({ status: "Missing" }),
    ];

    const result = computeAggregateMetrics(records);

    expect(result.averageWorkMinutes).toBe(0);
    expect(result.workedDayCount).toBe(0);
    expect(result.totalWorkingMinutes).toBe(0);
  });

  it("returns undefined min/max times when all timeIn/timeout are null", () => {
    const records: ClassifiedRecord[] = [
      makeRecord({ timeIn: null, timeout: null }),
      makeRecord({ timeIn: null, timeout: null }),
    ];

    const result = computeAggregateMetrics(records);

    expect(result.earliestTimeIn).toBeUndefined();
    expect(result.latestTimeIn).toBeUndefined();
    expect(result.earliestTimeout).toBeUndefined();
    expect(result.latestTimeout).toBeUndefined();
  });

  it("selects earliest date when longest day is tied", () => {
    const records: ClassifiedRecord[] = [
      makeRecord({
        attendanceDate: "2024-01-05",
        calculatedWorkingHours: "10:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
      }),
      makeRecord({
        attendanceDate: "2024-01-02",
        calculatedWorkingHours: "10:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
      }),
    ];

    const result = computeAggregateMetrics(records);

    // Both have 600 minutes worked; earliest date (2024-01-02) should be chosen
    expect(result.longestDay).toEqual({ date: "2024-01-02", minutes: 600 });
  });

  it("selects earliest date when shortest day is tied", () => {
    const records: ClassifiedRecord[] = [
      makeRecord({
        attendanceDate: "2024-01-10",
        calculatedWorkingHours: "07:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
      }),
      makeRecord({
        attendanceDate: "2024-01-03",
        calculatedWorkingHours: "07:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
      }),
    ];

    const result = computeAggregateMetrics(records);

    // Both have 420 minutes worked; earliest date (2024-01-03) should be chosen
    expect(result.shortestDay).toEqual({ date: "2024-01-03", minutes: 420 });
  });

  it("computes correct aggregate metrics for known inputs", () => {
    const records: ClassifiedRecord[] = [
      makeRecord({
        attendanceDate: "2024-01-01",
        calculatedWorkingHours: "10:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        timeIn: "08:50",
        timeout: "19:00",
      }),
      makeRecord({
        attendanceDate: "2024-01-02",
        calculatedWorkingHours: "08:00",
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        timeIn: "09:10",
        timeout: "17:30",
        presentStatus: "Late",
        isLateArrival: true,
      }),
    ];

    const result = computeAggregateMetrics(records);

    expect(result.totalDays).toBe(2);
    expect(result.workedDayCount).toBe(2);
    // Total working: 600 + 480 = 1080
    expect(result.totalWorkingMinutes).toBe(1080);
    // Extra: day1 has 600-540=60 extra; day2 has 480-540=-60 shortfall
    expect(result.totalExtraMinutes).toBe(60);
    expect(result.totalShortfallMinutes).toBe(60);
    // Average: floor(1080 / 2) = 540
    expect(result.averageWorkMinutes).toBe(540);
    // Earliest timeIn: "08:50", latest: "09:10"
    expect(result.earliestTimeIn).toBe("08:50");
    expect(result.latestTimeIn).toBe("09:10");
    // Earliest timeout: "17:30", latest: "19:00"
    expect(result.earliestTimeout).toBe("17:30");
    expect(result.latestTimeout).toBe("19:00");
    // Longest day: 2024-01-01 with 600 min
    expect(result.longestDay).toEqual({ date: "2024-01-01", minutes: 600 });
    // Shortest day: 2024-01-02 with 480 min
    expect(result.shortestDay).toEqual({ date: "2024-01-02", minutes: 480 });
    // Late count: 1 (presentStatus "Late")
    expect(result.lateCount).toBe(1);
    // Late percentage: (1/2)*100 = 50.0
    expect(result.latePercentage).toBe(50.0);
  });
});
