// Feature: attendance-insights, Property 14: Min/max time identification
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeAggregateMetrics } from './timeCalculator';
import type { ClassifiedRecord } from '../types';

/**
 * Validates: Requirements 3.10, 3.11
 *
 * Property 14: Min/max time identification
 * For any set of records containing Worked_Days with non-null timeIn values,
 * earliestTimeIn SHALL equal the minimum timeIn and latestTimeIn SHALL equal
 * the maximum timeIn among those records. The same SHALL hold for timeout values.
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

/** Generate a worked day status ("Present" or "Half Day") */
const arbWorkedStatus = fc.constantFrom('Present', 'Half Day') as fc.Arbitrary<'Present' | 'Half Day'>;

/**
 * Generate a ClassifiedRecord that is a worked day with non-null timeIn and timeout.
 * This ensures we always have values to compare for min/max identification.
 */
const arbWorkedDayWithTimes = fc
  .tuple(arbShiftPair, arbTimeHHMM, arbTimeHHMM, arbTimeHHMM, arbDate, arbWorkedStatus)
  .map(([shift, calcHours, timeIn, timeout, date, status]): ClassifiedRecord => ({
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
    updatedFirstHalfStatus: status === 'Present' ? 'P' : 'P',
    updatedSecondHalfStatus: status === 'Present' ? 'P' : 'FL',
    status,
    isLateArrival: false,
  }));

describe('Property 14: Min/max time identification', () => {
  it('earliestTimeIn equals the minimum timeIn among worked days with non-null timeIn', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayWithTimes, { minLength: 1, maxLength: 20 }),
        (records) => {
          const result = computeAggregateMetrics(records);

          // Independently find min timeIn among worked days with non-null timeIn
          const workedDays = records.filter(
            (r) => r.status === 'Present' || r.status === 'Half Day'
          );
          const timeInValues = workedDays
            .filter((r) => r.timeIn !== null)
            .map((r) => r.timeIn!);

          if (timeInValues.length > 0) {
            const expectedMin = timeInValues.reduce((min, t) => (t < min ? t : min), timeInValues[0]);
            expect(result.earliestTimeIn).toBe(expectedMin);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('latestTimeIn equals the maximum timeIn among worked days with non-null timeIn', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayWithTimes, { minLength: 1, maxLength: 20 }),
        (records) => {
          const result = computeAggregateMetrics(records);

          // Independently find max timeIn among worked days with non-null timeIn
          const workedDays = records.filter(
            (r) => r.status === 'Present' || r.status === 'Half Day'
          );
          const timeInValues = workedDays
            .filter((r) => r.timeIn !== null)
            .map((r) => r.timeIn!);

          if (timeInValues.length > 0) {
            const expectedMax = timeInValues.reduce((max, t) => (t > max ? t : max), timeInValues[0]);
            expect(result.latestTimeIn).toBe(expectedMax);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('earliestTimeout equals the minimum timeout among worked days with non-null timeout', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayWithTimes, { minLength: 1, maxLength: 20 }),
        (records) => {
          const result = computeAggregateMetrics(records);

          // Independently find min timeout among worked days with non-null timeout
          const workedDays = records.filter(
            (r) => r.status === 'Present' || r.status === 'Half Day'
          );
          const timeoutValues = workedDays
            .filter((r) => r.timeout !== null)
            .map((r) => r.timeout!);

          if (timeoutValues.length > 0) {
            const expectedMin = timeoutValues.reduce((min, t) => (t < min ? t : min), timeoutValues[0]);
            expect(result.earliestTimeout).toBe(expectedMin);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('latestTimeout equals the maximum timeout among worked days with non-null timeout', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayWithTimes, { minLength: 1, maxLength: 20 }),
        (records) => {
          const result = computeAggregateMetrics(records);

          // Independently find max timeout among worked days with non-null timeout
          const workedDays = records.filter(
            (r) => r.status === 'Present' || r.status === 'Half Day'
          );
          const timeoutValues = workedDays
            .filter((r) => r.timeout !== null)
            .map((r) => r.timeout!);

          if (timeoutValues.length > 0) {
            const expectedMax = timeoutValues.reduce((max, t) => (t > max ? t : max), timeoutValues[0]);
            expect(result.latestTimeout).toBe(expectedMax);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
