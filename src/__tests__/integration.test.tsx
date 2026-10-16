import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import App from "../App";
import type { AttendanceRecord, RawPunch } from "../types";

/**
 * Integration tests for the real ingestion flows:
 * - Chrome extension path: window CustomEvents dispatched by receiver.js
 * - Bookmarklet path: postMessage from the HROne tab
 * - Undo safeguard when a re-sync returns fewer records
 * - Intraday punch updates for the Today card
 */

function attendanceRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    employeeId: 1,
    shiftId: 100,
    timeIn: "09:30",
    timeout: "18:30",
    presentStatus: "Present",
    calculatedWorkingHours: "09:00",
    isLeave: 0,
    shiftStartTime: "09:30",
    shiftEndTime: "18:30",
    shiftCode: "GEN",
    attendanceDate: "2024-01-15",
    updatedFirstHalfStatus: "P",
    updatedSecondHalfStatus: "P",
    ...overrides,
  };
}

function dispatchAttendanceFromExtension(records: AttendanceRecord[]) {
  window.dispatchEvent(
    new CustomEvent("AttendanceDataFromExtension", { detail: { records } })
  );
}

function dispatchAttendanceFromBookmarklet(data: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent("message", { origin: window.location.origin, data })
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("Integration: empty state", () => {
  it("shows the onboarding panel when no data has been synced", () => {
    render(<App />);

    expect(screen.getByText("Know your hours in seconds")).toBeInTheDocument();
    expect(screen.getByText("Get started in 30 seconds")).toBeInTheDocument();
  });
});

describe("Integration: extension ingestion path", () => {
  it("renders the dashboard after AttendanceDataFromExtension arrives", () => {
    render(<App />);

    act(() => {
      dispatchAttendanceFromExtension([attendanceRecord()]);
    });

    // Dashboard hero + metric grid
    expect(screen.getByText("Net Balance")).toBeInTheDocument();
    expect(screen.getAllByText("Worked Days").length).toBeGreaterThanOrEqual(1);

    // Month label from deriveMonthKey, and the onboarding panel is gone
    expect(screen.getAllByText("January 2024").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Know your hours in seconds")).not.toBeInTheDocument();

    // Confirmation toast
    expect(screen.getByText(/Synced January 2024/)).toBeInTheDocument();
  });

  it("offers Undo when a re-sync returns fewer records, and restores the previous data", () => {
    render(<App />);

    const twoDays = [
      attendanceRecord({ attendanceDate: "2024-01-15" }),
      attendanceRecord({ attendanceDate: "2024-01-16" }),
    ];
    act(() => {
      dispatchAttendanceFromExtension(twoDays);
    });
    expect(screen.getByText("Net Balance")).toBeInTheDocument();

    // Re-sync with a shrunken payload (1 day instead of 2)
    act(() => {
      dispatchAttendanceFromExtension([attendanceRecord({ attendanceDate: "2024-01-15" })]);
    });

    expect(screen.getByText("Fewer days than before.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.queryByText("Fewer days than before.")).not.toBeInTheDocument();
    expect(screen.getByText("Restored previous January 2024 data")).toBeInTheDocument();
  });

  it("updates the Today card when TodayPunchesFromExtension arrives", () => {
    render(<App />);

    act(() => {
      dispatchAttendanceFromExtension([attendanceRecord()]);
    });

    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const punches: RawPunch[] = [
      {
        employeeId: 1,
        punchDateTime: `${ymd}T09:30:00`,
        punchSource: "Biometric.",
        punchSourceCode: "BIO",
        isPunchExcluded: false,
      },
    ];

    act(() => {
      window.dispatchEvent(
        new CustomEvent("TodayPunchesFromExtension", { detail: { punches } })
      );
    });

    expect(screen.getByText("Punched in")).toBeInTheDocument();
    expect(screen.getByText("First Punch")).toBeInTheDocument();
  });
});

describe("Integration: bookmarklet ingestion path", () => {
  it("renders the dashboard from an ATTENDANCE_DATA postMessage", () => {
    render(<App />);

    act(() => {
      dispatchAttendanceFromBookmarklet({
        type: "ATTENDANCE_DATA",
        records: [attendanceRecord()],
        userName: "Test User",
        v: "6",
      });
    });

    expect(screen.getByText("Net Balance")).toBeInTheDocument();
    // Employee name lands in the brand pill
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });
});
