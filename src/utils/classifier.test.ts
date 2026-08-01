import { describe, it, expect } from "vitest";
import { classifyRecord } from "./classifier";
import type { AttendanceRecord } from "../types";

/**
 * Helper to build a minimal valid AttendanceRecord for testing.
 * Override any fields via the partial parameter.
 */
function buildRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    employeeId: 1,
    shiftId: 100,
    timeIn: "09:00",
    timeout: "18:00",
    presentStatus: "Present",
    calculatedWorkingHours: "09:00",
    isLeave: 0,
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    shiftCode: "GEN",
    attendanceDate: "2024-01-15",
    updatedFirstHalfStatus: "P",
    updatedSecondHalfStatus: "P",
    ...overrides,
  };
}

describe("classifyRecord", () => {
  describe("classification rules", () => {
    it('1. isLeave=1 → "Leave"', () => {
      const record = buildRecord({ isLeave: 1 });
      const result = classifyRecord(record);
      expect(result.status).toBe("Leave");
    });

    it('2. Both halves "WO" → "Week Off"', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "WO",
        updatedSecondHalfStatus: "WO",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Week Off");
    });

    it('3. Both halves "P" → "Present"', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "P",
        updatedSecondHalfStatus: "P",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Present");
    });

    it('4. One half "P", other "FL" → "Half Day"', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "P",
        updatedSecondHalfStatus: "FL",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Half Day");
    });

    it('5. Both halves "FL" → "Full Leave"', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "FL",
        updatedSecondHalfStatus: "FL",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Full Leave");
    });

    it('6. Both halves "EL" → "Earned Leave"', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "EL",
        updatedSecondHalfStatus: "EL",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Earned Leave");
    });

    it('7. timeIn=null, timeout=null, halves not WO → "Missing"', () => {
      const record = buildRecord({
        timeIn: null,
        timeout: null,
        updatedFirstHalfStatus: "A",
        updatedSecondHalfStatus: "A",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Missing");
    });

    it('8. Unknown codes → "Other" with otherDetail', () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "XY",
        updatedSecondHalfStatus: "ZZ",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Other");
      expect(result.otherDetail).toBe("XY/ZZ");
    });
  });

  describe("isLeave=1 override", () => {
    it('isLeave=1 overrides even when both halves are "P"', () => {
      const record = buildRecord({
        isLeave: 1,
        updatedFirstHalfStatus: "P",
        updatedSecondHalfStatus: "P",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Leave");
    });
  });

  describe("late flag independence", () => {
    it("presentStatus='Late' sets isLateArrival=true regardless of status", () => {
      const record = buildRecord({
        presentStatus: "Late",
        updatedFirstHalfStatus: "P",
        updatedSecondHalfStatus: "P",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Present");
      expect(result.isLateArrival).toBe(true);
    });

    it("presentStatus='Present' sets isLateArrival=false", () => {
      const record = buildRecord({
        presentStatus: "Present",
        updatedFirstHalfStatus: "WO",
        updatedSecondHalfStatus: "WO",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Week Off");
      expect(result.isLateArrival).toBe(false);
    });
  });

  describe('"Other" includes raw codes', () => {
    it("otherDetail contains firstHalf/secondHalf codes", () => {
      const record = buildRecord({
        updatedFirstHalfStatus: "CO",
        updatedSecondHalfStatus: "RH",
      });
      const result = classifyRecord(record);
      expect(result.status).toBe("Other");
      expect(result.otherDetail).toBe("CO/RH");
    });
  });
});
