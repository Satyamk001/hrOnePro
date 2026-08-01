// Feature: attendance-insights, Property 1: Parser round-trip preserves all fields
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseAttendanceData } from './parser';

/**
 * Validates: Requirements 9.1, 1.3, 1.4
 *
 * For any valid AttendanceRecord array, serializing it to a JSON string
 * and then passing that string through the Parser SHALL produce an output
 * array where each element contains all fields from the corresponding
 * original object with identical values.
 */

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a nullable HH:MM time string (for timeIn/timeout) */
const arbNullableTime = fc.option(arbTimeHHMM, { nil: null });

/** Generate a valid AttendanceRecord object */
const arbAttendanceRecord = fc.record({
  employeeId: fc.integer({ min: 1, max: 100000 }),
  shiftId: fc.integer({ min: 1, max: 1000 }),
  timeIn: arbNullableTime,
  timeout: arbNullableTime,
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

describe('Parser Property Tests', () => {
  it('Property 1: Parser round-trip preserves all fields (array input)', () => {
    fc.assert(
      fc.property(
        fc.array(arbAttendanceRecord, { minLength: 1, maxLength: 10 }),
        (records) => {
          const json = JSON.stringify(records);
          const result = parseAttendanceData(json);

          // Parser must succeed
          expect(result.success).toBe(true);
          if (!result.success) return;

          // Output array must have same length
          expect(result.data).toHaveLength(records.length);

          // Each record must preserve all fields identically
          for (let i = 0; i < records.length; i++) {
            const original = records[i];
            const parsed = result.data[i];

            expect(parsed.employeeId).toBe(original.employeeId);
            expect(parsed.shiftId).toBe(original.shiftId);
            expect(parsed.timeIn).toBe(original.timeIn);
            expect(parsed.timeout).toBe(original.timeout);
            expect(parsed.presentStatus).toBe(original.presentStatus);
            expect(parsed.calculatedWorkingHours).toBe(original.calculatedWorkingHours);
            expect(parsed.isLeave).toBe(original.isLeave);
            expect(parsed.shiftStartTime).toBe(original.shiftStartTime);
            expect(parsed.shiftEndTime).toBe(original.shiftEndTime);
            expect(parsed.shiftCode).toBe(original.shiftCode);
            expect(parsed.attendanceDate).toBe(original.attendanceDate);
            expect(parsed.updatedFirstHalfStatus).toBe(original.updatedFirstHalfStatus);
            expect(parsed.updatedSecondHalfStatus).toBe(original.updatedSecondHalfStatus);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: Single object round-trip preserves all fields (Requirement 1.3)', () => {
    fc.assert(
      fc.property(arbAttendanceRecord, (record) => {
        // Test single object normalization (Requirement 1.3)
        const json = JSON.stringify(record);
        const result = parseAttendanceData(json);

        expect(result.success).toBe(true);
        if (!result.success) return;

        // Single object should be normalized to array of length 1
        expect(result.data).toHaveLength(1);

        const parsed = result.data[0];
        expect(parsed.employeeId).toBe(record.employeeId);
        expect(parsed.shiftId).toBe(record.shiftId);
        expect(parsed.timeIn).toBe(record.timeIn);
        expect(parsed.timeout).toBe(record.timeout);
        expect(parsed.presentStatus).toBe(record.presentStatus);
        expect(parsed.calculatedWorkingHours).toBe(record.calculatedWorkingHours);
        expect(parsed.isLeave).toBe(record.isLeave);
        expect(parsed.shiftStartTime).toBe(record.shiftStartTime);
        expect(parsed.shiftEndTime).toBe(record.shiftEndTime);
        expect(parsed.shiftCode).toBe(record.shiftCode);
        expect(parsed.attendanceDate).toBe(record.attendanceDate);
        expect(parsed.updatedFirstHalfStatus).toBe(record.updatedFirstHalfStatus);
        expect(parsed.updatedSecondHalfStatus).toBe(record.updatedSecondHalfStatus);
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: attendance-insights, Property 4: Whitespace-only input rejection
describe("Property 4: Whitespace-only input rejection", () => {
  /**
   * Validates: Requirements 1.5
   *
   * For any string composed entirely of whitespace characters (spaces, tabs,
   * newlines), the Parser SHALL return an error result indicating no input
   * was provided.
   */

  it("should return error for any whitespace-only string", () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 50 })
          .map((chars) => chars.join("")),
        (whitespaceStr) => {
          const result = parseAttendanceData(whitespaceStr);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain("No input provided");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: attendance-insights, Property 2: Parser preserves array length
describe('Parser Property Tests - Array Length', () => {
  /**
   * Validates: Requirements 9.2
   *
   * For any valid JSON input representing N AttendanceRecord objects
   * (1 for a single object, N for an array of N objects), the Parser
   * SHALL produce an output array of exactly N elements.
   */

  /** Reuse the same record arbitrary from Property 1 */
  const attendanceRecordArb = fc.record({
    employeeId: fc.integer({ min: 1, max: 100000 }),
    shiftId: fc.integer({ min: 1, max: 1000 }),
    timeIn: fc.option(
      fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
        .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
      { nil: null }
    ),
    timeout: fc.option(
      fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
        .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
      { nil: null }
    ),
    presentStatus: fc.constantFrom('Present', 'Late', 'Absent', 'On Duty'),
    calculatedWorkingHours: fc.tuple(
      fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
    isLeave: fc.constantFrom(0, 1),
    shiftStartTime: fc.tuple(
      fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
    shiftEndTime: fc.tuple(
      fc.integer({ min: 13, max: 23 }), fc.integer({ min: 0, max: 59 })
    ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
    shiftCode: fc.constantFrom('GS', 'MS', 'ES', 'NS', 'A1', 'B2'),
    attendanceDate: fc.tuple(
      fc.integer({ min: 2020, max: 2025 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    ).map(([y, mo, d]) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
    updatedFirstHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
    updatedSecondHalfStatus: fc.constantFrom('P', 'WO', 'FL', 'EL', 'HD', 'A'),
  });

  it('Property 2: Parser preserves array length — output length equals input length', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceRecordArb, { minLength: 1, maxLength: 50 }),
        (records) => {
          const json = JSON.stringify(records);
          const result = parseAttendanceData(json);

          expect(result.success).toBe(true);
          if (!result.success) return;

          expect(result.data.length).toBe(records.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
