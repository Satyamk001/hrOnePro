// Feature: attendance-insights, Property 11: Non-worked day exclusion from aggregates
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeAggregateMetrics } from './timeCalculator';
import type { ClassifiedRecord } from '../types';

/**
 * Validates: Requirements 3.4
 *
 * Property 11: Non-worked day exclusion from aggregates
 * For any set of ClassifiedRecords, adding or removing records classified as
 * non-Worked_Days (Week Off, Leave, Full Leave, Earned Leave, Missing) SHALL NOT
 * change the values of total working hours, total extra time, total shortfall,
 * or average work duration.
 */

/** Non-worked day statuses that should be excluded from aggregates */
const nonWorkedStatuses = ['Week Off', 'Leave', 'Full Leave', 'Earned Leave', 'Missing'] as const;

/** Worked day statuses */
const workedStatuses = ['Present', 'Half Day'] as const;

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a shift pair where end > start (valid shift) */
const arbShiftPair = fc
  .tuple(
    fc.integer({ min: 0, max: 16 }),  // shift start hour (0-16)
    fc.integer({ min: 0, max: 59 }),  // shift start minute
    fc.integer({ min: 1, max: 8 })    // shift duration hours
  )
  .map(([startH, startM, durationH]) => {
    const endH = Math.min(startH + durationH, 23);
    return {
      shiftStartTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      shiftEndTime: `${String(endH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
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

/** Generate a worked-day ClassifiedRecord (Present or Half Day) */
const arbWorkedDayRecord: fc.Arbitrary<ClassifiedRecord> = fc
  .tuple(
    fc.integer({ min: 1, max: 100000 }),
    fc.integer({ min: 1, max: 1000 }),
    arbTimeHHMM,
    arbTimeHHMM,
    fc.constantFrom(...workedStatuses),
    arbShiftPair,
    arbTimeHHMM,
    arbDate,
    fc.boolean()
  )
  .map(([employeeId, shiftId, timeIn, timeout, status, shift, workHours, date, isLate]) => ({
    employeeId,
    shiftId,
    timeIn,
    timeout,
    presentStatus: isLate ? 'Late' : 'Present',
    calculatedWorkingHours: workHours,
    isLeave: 0,
    shiftStartTime: shift.shiftStartTime,
    shiftEndTime: shift.shiftEndTime,
    shiftCode: 'GS',
    attendanceDate: date,
    updatedFirstHalfStatus: 'P',
    updatedSecondHalfStatus: status === 'Present' ? 'P' : 'HD',
    status,
    isLateArrival: isLate,
  }));

/** Generate a non-worked-day ClassifiedRecord */
const arbNonWorkedDayRecord: fc.Arbitrary<ClassifiedRecord> = fc
  .tuple(
    fc.integer({ min: 1, max: 100000 }),
    fc.integer({ min: 1, max: 1000 }),
    fc.constantFrom(...nonWorkedStatuses),
    arbShiftPair,
    arbTimeHHMM,
    arbDate
  )
  .map(([employeeId, shiftId, status, shift, workHours, date]) => ({
    employeeId,
    shiftId,
    timeIn: null,
    timeout: null,
    presentStatus: 'Absent',
    calculatedWorkingHours: workHours,
    isLeave: status === 'Leave' ? 1 : 0,
    shiftStartTime: shift.shiftStartTime,
    shiftEndTime: shift.shiftEndTime,
    shiftCode: 'GS',
    attendanceDate: date,
    updatedFirstHalfStatus: 'WO',
    updatedSecondHalfStatus: 'WO',
    status,
    isLateArrival: false,
  }));

describe('Property 11: Non-worked day exclusion from aggregates', () => {
  it('adding non-worked-day records does not change totalWorkingMinutes, totalExtraMinutes, totalShortfallMinutes, or averageWorkMinutes', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayRecord, { minLength: 1, maxLength: 20 }),
        fc.array(arbNonWorkedDayRecord, { minLength: 1, maxLength: 20 }),
        (workedRecords, nonWorkedRecords) => {
          // Compute aggregates from only worked-day records
          const baseAggregates = computeAggregateMetrics(workedRecords);

          // Compute aggregates after appending non-worked-day records
          const combinedRecords = [...workedRecords, ...nonWorkedRecords];
          const combinedAggregates = computeAggregateMetrics(combinedRecords);

          // Assert the key metrics remain unchanged
          expect(combinedAggregates.totalWorkingMinutes).toBe(baseAggregates.totalWorkingMinutes);
          expect(combinedAggregates.totalExtraMinutes).toBe(baseAggregates.totalExtraMinutes);
          expect(combinedAggregates.totalShortfallMinutes).toBe(baseAggregates.totalShortfallMinutes);
          expect(combinedAggregates.averageWorkMinutes).toBe(baseAggregates.averageWorkMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removing non-worked-day records from a mixed set does not change aggregate metrics', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayRecord, { minLength: 1, maxLength: 20 }),
        fc.array(arbNonWorkedDayRecord, { minLength: 1, maxLength: 20 }),
        (workedRecords, nonWorkedRecords) => {
          // Start with combined (mixed) records
          const combinedRecords = [...workedRecords, ...nonWorkedRecords];
          const combinedAggregates = computeAggregateMetrics(combinedRecords);

          // Remove non-worked-day records (keep only worked days)
          const onlyWorkedAggregates = computeAggregateMetrics(workedRecords);

          // Assert the key metrics remain unchanged
          expect(combinedAggregates.totalWorkingMinutes).toBe(onlyWorkedAggregates.totalWorkingMinutes);
          expect(combinedAggregates.totalExtraMinutes).toBe(onlyWorkedAggregates.totalExtraMinutes);
          expect(combinedAggregates.totalShortfallMinutes).toBe(onlyWorkedAggregates.totalShortfallMinutes);
          expect(combinedAggregates.averageWorkMinutes).toBe(onlyWorkedAggregates.averageWorkMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('aggregates are identical regardless of how many non-worked-day records are present', () => {
    fc.assert(
      fc.property(
        fc.array(arbWorkedDayRecord, { minLength: 1, maxLength: 15 }),
        fc.array(arbNonWorkedDayRecord, { minLength: 1, maxLength: 10 }),
        fc.array(arbNonWorkedDayRecord, { minLength: 1, maxLength: 10 }),
        (workedRecords, nonWorkedSet1, nonWorkedSet2) => {
          // Compute aggregates with first set of non-worked records
          const set1Records = [...workedRecords, ...nonWorkedSet1];
          const set1Aggregates = computeAggregateMetrics(set1Records);

          // Compute aggregates with second (different) set of non-worked records
          const set2Records = [...workedRecords, ...nonWorkedSet2];
          const set2Aggregates = computeAggregateMetrics(set2Records);

          // Assert key metrics are the same regardless of which non-worked records are present
          expect(set1Aggregates.totalWorkingMinutes).toBe(set2Aggregates.totalWorkingMinutes);
          expect(set1Aggregates.totalExtraMinutes).toBe(set2Aggregates.totalExtraMinutes);
          expect(set1Aggregates.totalShortfallMinutes).toBe(set2Aggregates.totalShortfallMinutes);
          expect(set1Aggregates.averageWorkMinutes).toBe(set2Aggregates.averageWorkMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
