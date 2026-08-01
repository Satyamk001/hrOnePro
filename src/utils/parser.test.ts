import { describe, it, expect } from "vitest";
import { parseAttendanceData } from "./parser";

describe("parseAttendanceData", () => {
  describe("empty and whitespace input", () => {
    it("returns error for empty string input", () => {
      const result = parseAttendanceData("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "No input provided. Please paste your attendance JSON data."
        );
      }
    });

    it("returns error for whitespace-only input", () => {
      const result = parseAttendanceData("   \t\n  ");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "No input provided. Please paste your attendance JSON data."
        );
      }
    });
  });

  describe("invalid JSON", () => {
    it("returns syntax error for invalid JSON", () => {
      const result = parseAttendanceData("{not valid json}");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/^Invalid JSON: /);
      }
    });
  });

  describe("valid JSON primitives rejected", () => {
    it("rejects a number", () => {
      const result = parseAttendanceData("42");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "Input must be a single attendance record object or an array of attendance record objects."
        );
      }
    });

    it("rejects a boolean", () => {
      const result = parseAttendanceData("true");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "Input must be a single attendance record object or an array of attendance record objects."
        );
      }
    });

    it("rejects null", () => {
      const result = parseAttendanceData("null");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "Input must be a single attendance record object or an array of attendance record objects."
        );
      }
    });
  });

  describe("normalization", () => {
    it("normalizes a single object to an array with 1 element", () => {
      const record = {
        employeeId: 1,
        shiftId: 100,
        timeIn: "09:00",
        timeout: "18:00",
        presentStatus: "Present",
        calculatedWorkingHours: "9:00",
        isLeave: 0,
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        shiftCode: "GEN",
        attendanceDate: "2024-01-15",
        updatedFirstHalfStatus: "Present",
        updatedSecondHalfStatus: "Present",
      };
      const result = parseAttendanceData(JSON.stringify(record));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual(record);
      }
    });

    it("accepts array input as-is", () => {
      const records = [
        {
          employeeId: 1,
          shiftId: 100,
          timeIn: "09:00",
          timeout: "18:00",
          presentStatus: "Present",
          calculatedWorkingHours: "9:00",
          isLeave: 0,
          shiftStartTime: "09:00",
          shiftEndTime: "18:00",
          shiftCode: "GEN",
          attendanceDate: "2024-01-15",
          updatedFirstHalfStatus: "Present",
          updatedSecondHalfStatus: "Present",
        },
        {
          employeeId: 1,
          shiftId: 100,
          timeIn: "09:15",
          timeout: "18:30",
          presentStatus: "Present",
          calculatedWorkingHours: "9:15",
          isLeave: 0,
          shiftStartTime: "09:00",
          shiftEndTime: "18:00",
          shiftCode: "GEN",
          attendanceDate: "2024-01-16",
          updatedFirstHalfStatus: "Present",
          updatedSecondHalfStatus: "Present",
        },
      ];
      const result = parseAttendanceData(JSON.stringify(records));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data).toEqual(records);
      }
    });
  });

  describe("missing required fields", () => {
    it("lists exactly the missing required fields", () => {
      const incomplete = {
        employeeId: 1,
        shiftId: 100,
        presentStatus: "Present",
        shiftCode: "GEN",
      };
      const result = parseAttendanceData(JSON.stringify(incomplete));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          "Missing required fields: timeIn, timeout, attendanceDate, shiftStartTime, shiftEndTime, calculatedWorkingHours, updatedFirstHalfStatus, updatedSecondHalfStatus, isLeave"
        );
      }
    });
  });

  describe("valid input preserves all fields", () => {
    it("preserves all fields including nulls and types", () => {
      const record = {
        employeeId: 42,
        shiftId: 200,
        timeIn: null,
        timeout: null,
        presentStatus: "Absent",
        calculatedWorkingHours: "0:00",
        isLeave: 1,
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        shiftCode: "GEN",
        attendanceDate: "2024-02-01",
        updatedFirstHalfStatus: "Leave",
        updatedSecondHalfStatus: "Leave",
      };
      const result = parseAttendanceData(JSON.stringify(record));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].timeIn).toBeNull();
        expect(result.data[0].timeout).toBeNull();
        expect(result.data[0].employeeId).toBe(42);
        expect(result.data[0].isLeave).toBe(1);
        expect(typeof result.data[0].calculatedWorkingHours).toBe("string");
        expect(result.data[0].attendanceDate).toBe("2024-02-01");
      }
    });
  });
});
