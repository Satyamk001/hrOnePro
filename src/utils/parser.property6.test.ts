// Feature: attendance-insights, Property 6: Missing required fields detection
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseAttendanceData } from './parser';

/**
 * Validates: Requirements 1.8
 *
 * For any JSON object that is missing one or more required fields
 * (timeIn, timeout, attendanceDate, shiftStartTime, shiftEndTime,
 * calculatedWorkingHours, updatedFirstHalfStatus, updatedSecondHalfStatus, isLeave),
 * the Parser SHALL return an error listing exactly the missing fields.
 */

/** Required fields in the order they appear in the REQUIRED_FIELDS constant in parser.ts */
const REQUIRED_FIELDS = [
  'timeIn',
  'timeout',
  'attendanceDate',
  'shiftStartTime',
  'shiftEndTime',
  'calculatedWorkingHours',
  'updatedFirstHalfStatus',
  'updatedSecondHalfStatus',
  'isLeave',
] as const;

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a full valid record object (with all required + optional fields) */
const arbFullRecord = fc.record({
  employeeId: fc.integer({ min: 1, max: 100000 }),
  shiftId: fc.integer({ min: 1, max: 1000 }),
  timeIn: fc.option(arbTimeHHMM, { nil: null }),
  timeout: fc.option(arbTimeHHMM, { nil: null }),
  presentStatus: fc.constantFrom('Present', 'Late', 'Absent', 'On Duty'),
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

/**
 * Generate a non-empty subset of indices into REQUIRED_FIELDS.
 * We use subsetOf to pick at least 1 field to delete.
 */
const arbFieldsToDelete = fc
  .subarray([...REQUIRED_FIELDS], { minLength: 1, maxLength: REQUIRED_FIELDS.length })

describe('Property 6: Missing required fields detection', () => {
  it('should return error listing exactly the deleted required fields', () => {
    fc.assert(
      fc.property(
        arbFullRecord,
        arbFieldsToDelete,
        (fullRecord, fieldsToDelete) => {
          // Create a copy and delete the selected fields
          const record: Record<string, unknown> = { ...fullRecord };
          for (const field of fieldsToDelete) {
            delete record[field];
          }

          // Serialize and parse
          const json = JSON.stringify(record);
          const result = parseAttendanceData(json);

          // Must fail
          expect(result.success).toBe(false);
          if (result.success) return;

          // Error must start with the expected prefix
          expect(result.error).toMatch(/^Missing required fields: /);

          // Extract the listed fields from the error message
          const listedFieldsStr = result.error.replace('Missing required fields: ', '');
          const listedFields = listedFieldsStr.split(', ');

          // The expected missing fields in REQUIRED_FIELDS order
          const expectedFields = REQUIRED_FIELDS.filter((f) =>
            fieldsToDelete.includes(f)
          );

          // Must list exactly the deleted fields in the REQUIRED_FIELDS order
          expect(listedFields).toEqual(expectedFields);
        }
      ),
      { numRuns: 100 }
    );
  });
});
