// Feature: attendance-insights, Property 5: Non-object/array JSON rejection
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseAttendanceData } from './parser';

/**
 * Validates: Requirements 1.7
 *
 * For any valid JSON value that is a primitive (number, string, boolean, null),
 * the Parser SHALL return an error result indicating the data must be an object
 * or array of objects.
 */
describe('Property 5: Non-object/array JSON rejection', () => {
  it('should reject any JSON primitive value (numbers, booleans, strings, null)', () => {
    const arbPrimitive = fc.oneof(
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.boolean(),
      fc.constant(null),
      fc.string()
    );

    fc.assert(
      fc.property(arbPrimitive, (primitiveValue) => {
        const json = JSON.stringify(primitiveValue);
        const result = parseAttendanceData(json);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain(
            'Input must be a single attendance record object'
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
