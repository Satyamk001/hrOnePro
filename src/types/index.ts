/**
 * Core type definitions for Attendance Insights
 */

/**
 * Raw input shape matching JSON from HR system
 */
export interface AttendanceRecord {
  employeeId: number;
  shiftId: number;
  timeIn: string | null;
  timeout: string | null;
  presentStatus: string | null;
  calculatedWorkingHours: string;
  isLeave: number;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftCode: string;
  attendanceDate: string;
  updatedFirstHalfStatus: string;
  updatedSecondHalfStatus: string;
}

/**
 * Status categories for classified attendance days
 */
export type DayStatus =
  | "Present"
  | "Week Off"
  | "Leave"
  | "Half Day"
  | "Flexi Leave"
  | "Earned Leave"
  | "Holiday"
  | "Absent"
  | "Pending"
  | "Missing"
  | "Other";

/**
 * After classification — extends AttendanceRecord with status and late flag
 */
export interface ClassifiedRecord extends AttendanceRecord {
  status: DayStatus;
  otherDetail?: string;
  isLateArrival: boolean;
}

/**
 * After time computation — extends ClassifiedRecord with per-record metrics
 */
export interface EnrichedRecord extends ClassifiedRecord {
  shiftDurationMinutes: number;
  workedMinutes: number;
  extraDeficitMinutes: number;
  isWorkedDay: boolean;
}

/**
 * Per-record computed metrics
 */
export interface RecordMetrics {
  shiftDurationMinutes: number;
  workedMinutes: number;
  extraDeficitMinutes: number;
  isWorkedDay: boolean;
}

/**
 * A representative worked day (longest / shortest) with everything the
 * month summary shows about it.
 */
export interface DayExtreme {
  date: string;
  minutes: number;
  timeIn: string | null;
  timeout: string | null;
  /** Worked minutes − shift duration for that day. */
  extraDeficitMinutes: number;
}

/**
 * Aggregate metrics computed across all records
 */
export interface AggregateMetrics {
  totalDays: number;
  /** Scheduled working days = totalDays − Week Off − Holiday */
  scheduledWorkingDays: number;
  statusCounts: Record<DayStatus, number>;
  totalWorkingMinutes: number;
  totalHrOneMinutes: number;
  totalExtraMinutes: number;
  totalShortfallMinutes: number;
  averageWorkMinutes: number;
  /**
   * Most common full-shift length across Present days — the benchmark the
   * average is read against. Falls back to DEFAULT_SHIFT_MINUTES (9h).
   */
  standardShiftMinutes: number;
  workedDayCount: number;
  lateCount: number;
  latePercentage: number;
  earliestTimeIn: string | undefined;
  latestTimeIn: string | undefined;
  earliestTimeout: string | undefined;
  latestTimeout: string | undefined;
  longestDay: DayExtreme | undefined;
  shortestDay: DayExtreme | undefined;
  lateByShiftCount: number;
}

/**
 * Discriminated union for parse results
 */
export type ParseResult =
  | { success: true; data: AttendanceRecord[] }
  | { success: false; error: string };

/**
 * Employee profile data from HROne API
 */
export interface EmployeeProfile {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  dateOfJoining: string;
  reportingManager: string;
  profileImageUrl: string | null;
}

/**
 * Raw punch entry from HROne RawPunch API
 */
export interface RawPunch {
  employeeId: number;
  punchDateTime: string;
  punchSource: string;
  punchSourceCode: string;
  isPunchExcluded: boolean;
}

/**
 * Today's attendance derived from raw punches
 */
export interface TodayAttendance {
  date: string;
  firstPunch: string;
  lastPunch: string;
  punchCount: number;
  workedMinutesSoFar: number;
  isStillIn: boolean;
  rawPunches?: RawPunch[];
}

/**
 * One stored month of attendance — the unit of the sidebar / localStorage.
 */
export interface SavedEntry {
  /** Human label, e.g. "January 2026". */
  label: string;
  /** Month key "YYYY-MM". */
  key: string;
  records: AttendanceRecord[];
}
