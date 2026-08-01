// Feature: attendance-insights, Property 8: Late flag independence from primary status
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyRecord } from './classifier';
import type { AttendanceRecord } from '../types';

/**
 * Validates: Requirements 2.10
 *
 * For any AttendanceRecord with presentStatus equal to "Late", the Classifier
 * SHALL set isLateArrival to true AND the primary status SHALL be identical
 * to the status that would be assigned if presentStatus were not "Late".
 *
 * Converse: presentStatus !== "Late" → isLateArrival === false
 */

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a nullable HH:MM time string (for timeIn/timeout) */
const arbNullableTime = fc.option(arbTimeHHMM, { nil: null });

/** Generate a valid AttendanceRecord with presentStatus="Late" */
const arbRecordWithLate = fc.record({
  employeeId: fc.integer({ min: 1, max: 100000 }),
  shiftId: fc.integer({ min: 1, max: 1000 }),
  timeIn: arbNullableTime,
  timeout: arbNullableTime,
  presentStatus: fc.constant('Late'),
  calculatedWorkingHours: arbTimeHHMM,
  isLeave: fc.constantFrom(0, 1),
  shiftStartTime: arbTimeHHMM,
  shiftEndTime: arbTimeHHMM,
  shiftCode: fc.constantFrom('GS', 'MS', 'ES', 'NS', 'A1', 'B2'),
  attendanceDate: fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(
      ([y, m, d]) =>
        `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    ),
  updatedFirstHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
  updatedSecondHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
});

/** Generate a non-"Late" presentStatus */
const arbNonLateStatus = fc.constantFrom('Present', 'Absent', 'On Duty', 'Half Day');

/** Generate a valid AttendanceRecord with presentStatus !== "Late" */
const arbRecordWithoutLate = fc.record({
  employeeId: fc.integer({ min: 1, max: 100000 }),
  shiftId: fc.integer({ min: 1, max: 1000 }),
  timeIn: arbNullableTime,
  timeout: arbNullableTime,
  presentStatus: arbNonLateStatus,
  calculatedWorkingHours: arbTimeHHMM,
  isLeave: fc.constantFrom(0, 1),
  shiftStartTime: arbTimeHHMM,
  shiftEndTime: arbTimeHHMM,
  shiftCode: fc.constantFrom('GS', 'MS', 'ES', 'NS', 'A1', 'B2'),
  attendanceDate: fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(
      ([y, m, d]) =>
        `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    ),
  updatedFirstHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
  updatedSecondHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
});

describe('Classifier Property 8: Late flag independence from primary status', () => {
  it('presentStatus="Late" → isLateArrival is true AND primary status unchanged', () => {
    fc.assert(
      fc.property(arbRecordWithLate, (record) => {
        // Step 1: Classify the record with presentStatus="Late"
        const classifiedWithLate = classifyRecord(record);

        // Verify isLateArrival is true
        expect(classifiedWithLate.isLateArrival).toBe(true);

        // Step 2: Create a copy with presentStatus set to something other than "Late"
        const recordWithoutLate: AttendanceRecord = {
          ...record,
          presentStatus: 'Present',
        };

        // Step 3: Classify the copy
        const classifiedWithoutLate = classifyRecord(recordWithoutLate);

        // Step 4: Verify the primary STATUS is the same
        // This proves the late flag doesn't affect primary classification
        expect(classifiedWithLate.status).toBe(classifiedWithoutLate.status);
      }),
      { numRuns: 100 }
    );
  });

  it('presentStatus !== "Late" → isLateArrival is false', () => {
    fc.assert(
      fc.property(arbRecordWithoutLate, (record) => {
        const classified = classifyRecord(record);

        // When presentStatus is not "Late", isLateArrival must be false
        expect(classified.isLateArrival).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
