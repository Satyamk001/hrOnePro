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
  | "Full Leave"
  | "Earned Leave"
  | "Holiday"
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
 * Aggregate metrics computed across all records
 */
export interface AggregateMetrics {
  totalDays: number;
  statusCounts: Record<DayStatus, number>;
  totalWorkingMinutes: number;
  totalExtraMinutes: number;
  totalShortfallMinutes: number;
  averageWorkMinutes: number;
  workedDayCount: number;
  lateCount: number;
  latePercentage: number;
  earliestTimeIn: string | undefined;
  latestTimeIn: string | undefined;
  earliestTimeout: string | undefined;
  latestTimeout: string | undefined;
  longestDay: { date: string; minutes: number } | undefined;
  shortestDay: { date: string; minutes: number } | undefined;
  lateByShiftCount: number;
}

/**
 * Dashboard display model — extends AggregateMetrics with formatted strings
 */
export interface DashboardMetrics extends AggregateMetrics {
  formattedTotalHours: string;
  formattedExtraHours: string;
  formattedShortfall: string;
  formattedAverage: string;
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
}
