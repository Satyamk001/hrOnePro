// Feature: attendance-insights, Property 9: Time format round-trip
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseHHMM, formatMinutes } from './timeCalculator';

/**
 * Validates: Requirements 3.1, 3.13
 *
 * Property 9: Time format round-trip
 * For any non-negative integer representing minutes, formatting it as "Xh Ym"
 * and then parsing that string back to minutes SHALL produce the original integer.
 * Conversely, for any valid "HH:MM" string, parsing to minutes and then formatting
 * SHALL produce a string representing the same total time.
 */

describe('Property 9: Time format round-trip', () => {
  it('formatMinutes produces "Xh Ym" pattern and round-trips back to original minutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        (minutes) => {
          const formatted = formatMinutes(minutes);

          // Verify format matches "Xh Ym" pattern
          const match = formatted.match(/^(\d+)h (\d+)m$/);
          expect(match).not.toBeNull();

          // Parse back from the formatted string
          const hours = Number(match![1]);
          const mins = Number(match![2]);
          const roundTripped = hours * 60 + mins;

          // Assert equality after round-trip
          expect(roundTripped).toBe(minutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('parseHHMM followed by formatMinutes preserves total time for valid "HH:MM" strings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, mins) => {
          const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

          // Parse "HH:MM" to total minutes
          const totalMinutes = parseHHMM(timeStr);
          expect(totalMinutes).toBe(hours * 60 + mins);

          // Format back to "Xh Ym"
          const formatted = formatMinutes(totalMinutes);

          // Parse the formatted string to verify same total minutes
          const match = formatted.match(/^(\d+)h (\d+)m$/);
          expect(match).not.toBeNull();

          const formattedHours = Number(match![1]);
          const formattedMins = Number(match![2]);
          const reconstructed = formattedHours * 60 + formattedMins;

          // The total minutes should be preserved through the round-trip
          expect(reconstructed).toBe(totalMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
