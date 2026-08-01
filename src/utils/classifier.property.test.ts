// Feature: attendance-insights, Property 7: Classification precedence correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyRecord } from './classifier';
import type { AttendanceRecord } from '../types';

/**
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
 *
 * Classification precedence (first match wins):
 * 1. isLeave === 1 → "Leave"
 * 2. Both halves "WO" → "Week Off"
 * 3. Both halves "P" → "Present"
 * 4. One half "P", other in {"FL","EL","HD"} → "Half Day"
 * 5. Either half "FL", neither "P" → "Full Leave"
 * 6. Either half "EL", neither "P" → "Earned Leave"
 * 7. timeIn === null && timeout === null → "Missing"
 * 8. Otherwise → "Other"
 */

/** Valid half-status codes used in attendance records */
const halfStatusCodes = ['P', 'WO', 'FL', 'EL', 'HD', 'A'] as const;

/** Generate a valid HH:MM time string */
const arbTimeHHMM = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

/** Generate a nullable HH:MM time string */
const arbNullableTime = fc.option(arbTimeHHMM, { nil: null });

/** Generate a valid AttendanceRecord with arbitrary combinations */
const arbAttendanceRecord: fc.Arbitrary<AttendanceRecord> = fc.record({
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
  updatedFirstHalfStatus: fc.constantFrom(...halfStatusCodes),
  updatedSecondHalfStatus: fc.constantFrom(...halfStatusCodes),
});

/**
 * Reference implementation of classification precedence logic.
 * Used to independently compute the expected status for comparison.
 */
function expectedStatus(record: AttendanceRecord): string {
  const firstHalf = record.updatedFirstHalfStatus;
  const secondHalf = record.updatedSecondHalfStatus;
  const halfDayCodes = new Set(['FL', 'EL', 'HD']);

  // 1. isLeave === 1 → "Leave"
  if (record.isLeave === 1) return 'Leave';

  // 2. Both halves "WO" → "Week Off"
  if (firstHalf === 'WO' && secondHalf === 'WO') return 'Week Off';

  // 3. Both halves "P" → "Present"
  if (firstHalf === 'P' && secondHalf === 'P') return 'Present';

  // 4. One half "P", other in {"FL","EL","HD"} → "Half Day"
  if (
    (firstHalf === 'P' && halfDayCodes.has(secondHalf)) ||
    (secondHalf === 'P' && halfDayCodes.has(firstHalf))
  ) {
    return 'Half Day';
  }

  // 5. Either half "FL", neither "P" → "Full Leave"
  if (
    (firstHalf === 'FL' || secondHalf === 'FL') &&
    firstHalf !== 'P' &&
    secondHalf !== 'P'
  ) {
    return 'Full Leave';
  }

  // 6. Either half "EL", neither "P" → "Earned Leave"
  if (
    (firstHalf === 'EL' || secondHalf === 'EL') &&
    firstHalf !== 'P' &&
    secondHalf !== 'P'
  ) {
    return 'Earned Leave';
  }

  // 7. timeIn === null && timeout === null → "Missing"
  if (record.timeIn === null && record.timeout === null) return 'Missing';

  // 8. Otherwise → "Other"
  return 'Other';
}

describe('Property 7: Classification precedence correctness', () => {
  it('classifyRecord assigns the correct status per precedence rules for any valid record', () => {
    fc.assert(
      fc.property(arbAttendanceRecord, (record) => {
        const result = classifyRecord(record);
        const expected = expectedStatus(record);
        expect(result.status).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('isLeave=1 always produces "Leave" regardless of half-statuses', () => {
    fc.assert(
      fc.property(
        arbAttendanceRecord.map((r) => ({ ...r, isLeave: 1 as const })),
        (record) => {
          const result = classifyRecord(record);
          expect(result.status).toBe('Leave');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('precedence is respected: "WO"/"WO" with isLeave=0 yields "Week Off", not "Missing"', () => {
    fc.assert(
      fc.property(
        arbAttendanceRecord.map((r) => ({
          ...r,
          isLeave: 0 as const,
          updatedFirstHalfStatus: 'WO' as const,
          updatedSecondHalfStatus: 'WO' as const,
          timeIn: null,
          timeout: null,
        })),
        (record) => {
          const result = classifyRecord(record);
          // Even though timeIn and timeout are null, "WO"/"WO" takes precedence over "Missing"
          expect(result.status).toBe('Week Off');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('precedence is respected: "P"/"P" with isLeave=0 yields "Present", not lower rules', () => {
    fc.assert(
      fc.property(
        arbAttendanceRecord.map((r) => ({
          ...r,
          isLeave: 0 as const,
          updatedFirstHalfStatus: 'P' as const,
          updatedSecondHalfStatus: 'P' as const,
        })),
        (record) => {
          const result = classifyRecord(record);
          expect(result.status).toBe('Present');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('"Half Day" is assigned when one half is "P" and other is in {FL, EL, HD}', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbAttendanceRecord,
          fc.constantFrom('FL', 'EL', 'HD'),
          fc.boolean()
        ).map(([r, otherCode, firstIsP]) => ({
          ...r,
          isLeave: 0 as const,
          updatedFirstHalfStatus: firstIsP ? 'P' : otherCode,
          updatedSecondHalfStatus: firstIsP ? otherCode : 'P',
        })),
        (record) => {
          const result = classifyRecord(record);
          expect(result.status).toBe('Half Day');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('"Full Leave" when either half is "FL" and neither is "P", with isLeave=0', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          arbAttendanceRecord,
          fc.constantFrom('WO', 'FL', 'EL', 'HD', 'A'),
          fc.boolean()
        ).map(([r, otherCode, flFirst]) => ({
          ...r,
          isLeave: 0 as const,
          updatedFirstHalfStatus: flFirst ? 'FL' : otherCode,
          updatedSecondHalfStatus: flFirst ? otherCode : 'FL',
        })),
        (record) => {
          const result = classifyRecord(record);
          // "FL" in either half with neither being "P" → "Full Leave"
          expect(result.status).toBe('Full Leave');
        }
      ),
      { numRuns: 100 }
    );
  });
});
