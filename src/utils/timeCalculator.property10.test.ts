// Feature: attendance-insights, Property 10: Extra/deficit computation correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeRecordMetrics, parseHHMM } from './timeCalculator';
import type { ClassifiedRecord } from '../types';

/**
 * Validates: Requirements 3.2, 3.3
 *
 * For any Worked_Day record with valid calculatedWorkingHours and shift times,
 * the extra/deficit SHALL equal parseHHMM(calculatedWorkingHours) minus
 * (parseHHMM(shiftEndTime) - parseHHMM(shiftStartTime)).
 */

/** Generate a valid HH:MM time string from hour and minute ranges */
function arbTimeHHMM(minH: number, maxH: number) {
  return fc
    .tuple(fc.integer({ min: minH, max: maxH }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

/** Generate shift start and end times ensuring end > start */
const arbShiftTimes = fc
  .tuple(
    fc.integer({ min: 0, max: 20 }),  // start hour (0-20 to leave room for end)
    fc.integer({ min: 0, max: 59 }),  // start minute
    fc.integer({ min: 1, max: 12 })   // shift duration in hours (1-12)
  )
  .filter(([startH, , durationH]) => startH + durationH <= 23)
  .map(([startH, startM, durationH]) => {
    const endH = startH + durationH;
    const endM = startM; // keep same minute for simplicity
    return {
      shiftStartTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      shiftEndTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    };
  });

/** Generate a valid calculatedWorkingHours as HH:MM (0-23 hours) */
const arbWorkingHours = arbTimeHHMM(0, 23);

/** Generate a worked-day status: "Present" or "Half Day" */
const arbWorkedStatus = fc.constantFrom('Present' as const, 'Half Day' as const);

/** Generate a ClassifiedRecord representing a worked day */
const arbWorkedDayRecord: fc.Arbitrary<ClassifiedRecord> = fc
  .tuple(
    fc.integer({ min: 1, max: 100000 }),
    fc.integer({ min: 1, max: 1000 }),
    arbShiftTimes,
    arbWorkingHours,
    arbWorkedStatus,
    fc.constantFrom('Present', 'Late', 'Absent', 'On Duty'),
    fc.boolean(),
    fc
      .tuple(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 })
      )
      .map(
        ([y, m, d]) =>
          `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      )
  )
  .map(
    ([employeeId, shiftId, shiftTimes, calcHours, status, presentStatus, isLate, date]) => ({
      employeeId,
      shiftId,
      timeIn: shiftTimes.shiftStartTime,
      timeout: shiftTimes.shiftEndTime,
      presentStatus,
      calculatedWorkingHours: calcHours,
      isLeave: 0,
      shiftStartTime: shiftTimes.shiftStartTime,
      shiftEndTime: shiftTimes.shiftEndTime,
      shiftCode: 'GS',
      attendanceDate: date,
      updatedFirstHalfStatus: 'P',
      updatedSecondHalfStatus: status === 'Present' ? 'P' : 'HD',
      status,
      isLateArrival: isLate,
    })
  );

describe('Property 10: Extra/deficit computation correctness', () => {
  it('extraDeficitMinutes equals parseHHMM(calculatedWorkingHours) - (parseHHMM(shiftEndTime) - parseHHMM(shiftStartTime)) for worked days', () => {
    fc.assert(
      fc.property(arbWorkedDayRecord, (record) => {
        const result = computeRecordMetrics(record);

        const expectedWorkedMinutes = parseHHMM(record.calculatedWorkingHours);
        const expectedShiftDuration =
          parseHHMM(record.shiftEndTime) - parseHHMM(record.shiftStartTime);
        const expectedExtraDeficit = expectedWorkedMinutes - expectedShiftDuration;

        expect(result.extraDeficitMinutes).toBe(expectedExtraDeficit);
      }),
      { numRuns: 100 }
    );
  });

  it('isWorkedDay is true for "Present" records', () => {
    fc.assert(
      fc.property(
        arbWorkedDayRecord.map((r) => ({
          ...r,
          status: 'Present' as const,
          updatedFirstHalfStatus: 'P',
          updatedSecondHalfStatus: 'P',
        })),
        (record) => {
          const result = computeRecordMetrics(record);
          expect(result.isWorkedDay).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isWorkedDay is true for "Half Day" records', () => {
    fc.assert(
      fc.property(
        arbWorkedDayRecord.map((r) => ({
          ...r,
          status: 'Half Day' as const,
          updatedFirstHalfStatus: 'P',
          updatedSecondHalfStatus: 'HD',
        })),
        (record) => {
          const result = computeRecordMetrics(record);
          expect(result.isWorkedDay).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extra/deficit is positive when worked hours exceed shift duration', () => {
    fc.assert(
      fc.property(
        arbShiftTimes.chain((shiftTimes) => {
          const shiftDuration =
            parseHHMM(shiftTimes.shiftEndTime) - parseHHMM(shiftTimes.shiftStartTime);
          // Generate working hours greater than shift duration
          const minExtraMinutes = shiftDuration + 1;
          const maxMinutes = Math.min(23 * 60 + 59, shiftDuration + 180); // at most 3h extra
          if (minExtraMinutes > maxMinutes) return fc.constant(null);
          return fc.integer({ min: minExtraMinutes, max: maxMinutes }).map((mins) => ({
            shiftTimes,
            calcHours: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
          }));
        }).filter((v): v is NonNullable<typeof v> => v !== null),
        ({ shiftTimes, calcHours }) => {
          const record: ClassifiedRecord = {
            employeeId: 1,
            shiftId: 1,
            timeIn: shiftTimes.shiftStartTime,
            timeout: shiftTimes.shiftEndTime,
            presentStatus: 'Present',
            calculatedWorkingHours: calcHours,
            isLeave: 0,
            shiftStartTime: shiftTimes.shiftStartTime,
            shiftEndTime: shiftTimes.shiftEndTime,
            shiftCode: 'GS',
            attendanceDate: '2024-01-15',
            updatedFirstHalfStatus: 'P',
            updatedSecondHalfStatus: 'P',
            status: 'Present',
            isLateArrival: false,
          };
          const result = computeRecordMetrics(record);
          expect(result.extraDeficitMinutes).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extra/deficit is negative when worked hours are less than shift duration', () => {
    fc.assert(
      fc.property(
        arbShiftTimes.chain((shiftTimes) => {
          const shiftDuration =
            parseHHMM(shiftTimes.shiftEndTime) - parseHHMM(shiftTimes.shiftStartTime);
          // Generate working hours less than shift duration
          const maxDeficitMinutes = shiftDuration - 1;
          if (maxDeficitMinutes < 0) return fc.constant(null);
          return fc.integer({ min: 0, max: maxDeficitMinutes }).map((mins) => ({
            shiftTimes,
            calcHours: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
          }));
        }).filter((v): v is NonNullable<typeof v> => v !== null),
        ({ shiftTimes, calcHours }) => {
          const record: ClassifiedRecord = {
            employeeId: 1,
            shiftId: 1,
            timeIn: shiftTimes.shiftStartTime,
            timeout: shiftTimes.shiftEndTime,
            presentStatus: 'Present',
            calculatedWorkingHours: calcHours,
            isLeave: 0,
            shiftStartTime: shiftTimes.shiftStartTime,
            shiftEndTime: shiftTimes.shiftEndTime,
            shiftCode: 'GS',
            attendanceDate: '2024-01-15',
            updatedFirstHalfStatus: 'P',
            updatedSecondHalfStatus: 'P',
            status: 'Present',
            isLateArrival: false,
          };
          const result = computeRecordMetrics(record);
          expect(result.extraDeficitMinutes).toBeLessThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
