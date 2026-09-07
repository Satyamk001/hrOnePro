// Feature: attendance-insights, Property 12: Aggregate totals correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeAggregateMetrics, parseHHMM } from './timeCalculator';
import type { ClassifiedRecord } from '../types';

/**
 * Validates: Requirements 3.5, 3.6, 3.7
 *
 * Property 12: Aggregate totals correctness
 * For any set of ClassifiedRecords containing at least one Worked_Day,
 * total working hours SHALL equal the sum of calculatedWorkingHours across Worked_Days,
 * total extra SHALL equal the sum of positive extra/deficit values,
 * and total shortfall SHALL equal the absolute sum of negative extra/deficit values.
 */

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a shift start/end pair where start < end (valid shift) */
const arbShiftPair = fc
  .tuple(
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 1, max: 3 })
  )
  .map(([startH, startM, durationH]) => {
    const endH = Math.min(startH + durationH, 23);
    return {
      start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      end: `${String(endH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
    };
  });

/** Generate a nullable HH:MM time string */
const arbNullableTime = fc.option(arbTimeHHMM, { nil: null });

/** Generate a unique attendance date */
const arbDate = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(
    ([y, m, d]) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  );

/** Generate a ClassifiedRecord that is a worked day (status "Present" or "Half Day") */
const arbWorkedDayRecord = fc
  .tuple(arbShiftPair, arbTimeHHMM, arbNullableTime, arbNullableTime, arbDate)
  .map(([shift, calcHours, timeIn, timeout, date]): ClassifiedRecord => ({
    employeeId: 1,
    shiftId: 1,
    timeIn,
    timeout,
    presentStatus: fc.sample(fc.constantFrom('Present', 'Late'), 1)[0],
    calculatedWorkingHours: calcHours,
    isLeave: 0,
    shiftStartTime: shift.start,
    shiftEndTime: shift.end,
    shiftCode: 'GS',
    attendanceDate: date,
    updatedFirstHalfStatus: 'P',
    updatedSecondHalfStatus: 'P',
    status: 'Present',
    isLateArrival: false,
  }));

/** Generate a ClassifiedRecord that is a worked day with status "Half Day" */
const arbHalfDayRecord = fc
  .tuple(arbShiftPair, arbTimeHHMM, arbNullableTime, arbNullableTime, arbDate)
  .map(([shift, calcHours, timeIn, timeout, date]): ClassifiedRecord => ({
    employeeId: 1,
    shiftId: 1,
    timeIn,
    timeout,
    presentStatus: 'Present',
    calculatedWorkingHours: calcHours,
    isLeave: 0,
    shiftStartTime: shift.start,
    shiftEndTime: shift.end,
    shiftCode: 'GS',
    attendanceDate: date,
    updatedFirstHalfStatus: 'P',
    updatedSecondHalfStatus: 'FL',
    status: 'Half Day',
    isLateArrival: false,
  }));

/** Generate a ClassifiedRecord that is NOT a worked day */
const arbNonWorkedDayRecord = fc
  .tuple(arbShiftPair, arbTimeHHMM, arbDate, fc.constantFrom('Week Off', 'Leave', 'Full Leave', 'Earned Leave', 'Missing', 'Other') as fc.Arbitrary<'Week Off' | 'Leave' | 'Full Leave' | 'Earned Leave' | 'Missing' | 'Other'>)
  .map(([shift, calcHours, date, status]): ClassifiedRecord => ({
    employeeId: 1,
    shiftId: 1,
    timeIn: null,
    timeout: null,
    presentStatus: 'Absent',
    calculatedWorkingHours: calcHours,
    isLeave: status === 'Leave' ? 1 : 0,
    shiftStartTime: shift.start,
    shiftEndTime: shift.end,
    shiftCode: 'GS',
    attendanceDate: date,
    updatedFirstHalfStatus: 'WO',
    updatedSecondHalfStatus: 'WO',
    status,
    isLateArrival: false,
  }));

/** Generate a worked-day record (either Present or Half Day) */
const arbAnyWorkedDay = fc.oneof(arbWorkedDayRecord, arbHalfDayRecord);

/**
 * Generate an array of ClassifiedRecords with at least one worked day.
 * Mix of worked and non-worked days.
 */
const arbRecordsWithAtLeastOneWorkedDay = fc
  .tuple(
    fc.array(arbAnyWorkedDay, { minLength: 1, maxLength: 15 }),
    fc.array(arbNonWorkedDayRecord, { minLength: 0, maxLength: 10 })
  )
  .map(([worked, nonWorked]) => [...worked, ...nonWorked]);

describe('Property 12: Aggregate totals correctness', () => {
  it('totalWorkingMinutes equals sum of calculatedWorkingHours for worked days', () => {
    fc.assert(
      fc.property(arbRecordsWithAtLeastOneWorkedDay, (records) => {
        const result = computeAggregateMetrics(records);

        // Filter to worked days (status "Present" or "Half Day")
        const workedDays = records.filter(
          (r) => r.status === 'Present' || r.status === 'Half Day'
        );

        // Sum calculatedWorkingHours parsed as minutes
        const expectedTotalMinutes = workedDays.reduce(
          (sum, r) => sum + parseHHMM(r.calculatedWorkingHours),
          0
        );

        expect(result.totalWorkingMinutes).toBe(expectedTotalMinutes);
      }),
      { numRuns: 100 }
    );
  });

  it('totalExtraMinutes equals sum of positive extra/deficit values for worked days', () => {
    fc.assert(
      fc.property(arbRecordsWithAtLeastOneWorkedDay, (records) => {
        const result = computeAggregateMetrics(records);

        // Filter to worked days
        const workedDays = records.filter(
          (r) => r.status === 'Present' || r.status === 'Half Day'
        );

        // Compute per-record extra/deficit and sum positives
        // Half Day records use half the shift duration
        const expectedExtraMinutes = workedDays.reduce((sum, r) => {
          let shiftDuration =
            parseHHMM(r.shiftEndTime) - parseHHMM(r.shiftStartTime);
          if (r.status === 'Half Day') {
            shiftDuration = Math.floor(shiftDuration / 2);
          }
          const worked = parseHHMM(r.calculatedWorkingHours);
          const extraDeficit = worked - shiftDuration;
          return extraDeficit > 0 ? sum + extraDeficit : sum;
        }, 0);

        expect(result.totalExtraMinutes).toBe(expectedExtraMinutes);
      }),
      { numRuns: 100 }
    );
  });

  it('totalShortfallMinutes equals absolute sum of negative extra/deficit values for worked days', () => {
    fc.assert(
      fc.property(arbRecordsWithAtLeastOneWorkedDay, (records) => {
        const result = computeAggregateMetrics(records);

        // Filter to worked days
        const workedDays = records.filter(
          (r) => r.status === 'Present' || r.status === 'Half Day'
        );

        // Compute per-record extra/deficit and sum absolute negatives
        // Half Day records use half the shift duration
        const expectedShortfallMinutes = workedDays.reduce((sum, r) => {
          let shiftDuration =
            parseHHMM(r.shiftEndTime) - parseHHMM(r.shiftStartTime);
          if (r.status === 'Half Day') {
            shiftDuration = Math.floor(shiftDuration / 2);
          }
          const worked = parseHHMM(r.calculatedWorkingHours);
          const extraDeficit = worked - shiftDuration;
          return extraDeficit < 0 ? sum + Math.abs(extraDeficit) : sum;
        }, 0);

        expect(result.totalShortfallMinutes).toBe(expectedShortfallMinutes);
      }),
      { numRuns: 100 }
    );
  });
});
