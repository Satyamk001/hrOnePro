import { describe, it, expect } from "vitest";
import {
  formatRelativeAge,
  getFreshness,
  leaveAtMinutes,
  localDateDaysAgo,
  localDateString,
  minutesToHHMM,
  shiftLengthMinutes,
} from "./liveTime";

describe("shiftLengthMinutes", () => {
  it("computes a standard 9h shift", () => {
    expect(shiftLengthMinutes("09:30", "18:30")).toBe(540);
  });
  it("computes an 8.5h shift with seconds", () => {
    expect(shiftLengthMinutes("10:00:00", "18:30:00")).toBe(510);
  });
  it("handles overnight shifts", () => {
    expect(shiftLengthMinutes("22:00", "06:00")).toBe(480);
  });
  it("returns null for missing/invalid input", () => {
    expect(shiftLengthMinutes(null, "18:30")).toBeNull();
    expect(shiftLengthMinutes("ab", "18:30")).toBeNull();
    expect(shiftLengthMinutes("09:00", "09:00")).toBeNull();
  });
});

describe("leave time", () => {
  it("adds the actual shift length, not a fixed 9h", () => {
    expect(minutesToHHMM(leaveAtMinutes("09:45", 510)!)).toBe("18:15");
    expect(minutesToHHMM(leaveAtMinutes("09:45", 540)!)).toBe("18:45");
  });
  it("wraps past midnight", () => {
    expect(minutesToHHMM(leaveAtMinutes("20:00", 480)!)).toBe("04:00");
  });
});

describe("local dates", () => {
  it("uses local, not UTC, date", () => {
    const d = new Date(2026, 9, 15, 0, 30); // 00:30 local
    expect(localDateString(d)).toBe("2026-10-15");
    expect(localDateDaysAgo(1, d)).toBe("2026-10-14");
  });
});

describe("freshness", () => {
  const now = new Date(2026, 9, 15, 17, 0);
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();

  it("classifies by age and day", () => {
    expect(getFreshness(ago(10), now)).toBe("fresh");
    expect(getFreshness(ago(180), now)).toBe("aging");
    expect(getFreshness(ago(9 * 60), now)).toBe("stale");
    expect(getFreshness(new Date(2026, 9, 14, 23, 50).toISOString(), now)).toBe("stale");
    expect(getFreshness(null, now)).toBe("stale");
  });

  it("formats relative age", () => {
    expect(formatRelativeAge(ago(0), now)).toBe("just now");
    expect(formatRelativeAge(ago(12), now)).toBe("12 min ago");
    expect(formatRelativeAge(ago(185), now)).toBe("3 h ago");
    expect(formatRelativeAge(new Date(2026, 9, 14, 9, 0).toISOString(), now)).toBe("yesterday");
    expect(formatRelativeAge(new Date(2026, 9, 11, 17, 0).toISOString(), now)).toBe("4 days ago");
  });
});
