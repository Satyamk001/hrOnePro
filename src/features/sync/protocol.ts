/**
 * Wire protocol between the app and its two data sources:
 *
 *  - Chrome extension (v2.7.0): DOM CustomEvents on `window`, dispatched by
 *    extension/receiver.js. Keep names and payload shapes in sync with the
 *    extension (receiver.js / background.js).
 *  - Bookmarklet (v6): `postMessage` from the HROne tab, generated in
 *    src/bookmarklet.ts.
 *
 * These names are a public contract — renaming them breaks already-installed
 * extensions and bookmarks, so treat them as frozen.
 */
import type { AttendanceRecord, EmployeeProfile, RawPunch } from "../../types";

export const EXTENSION_EVENTS = {
  /** Extension → app: a month of attendance records. */
  attendanceData: "AttendanceDataFromExtension",
  /** Extension → app: the logged-in employee's profile. */
  profileData: "ProfileDataFromExtension",
  /** Extension → app: today's raw punches for the live Today card. */
  todayPunches: "TodayPunchesFromExtension",
  /** Extension → app: outcome of a requested sync (success/error). */
  syncStatus: "ExtensionSyncStatus",
  /** App → extension: ask the background worker to fetch a month. */
  requestSync: "RequestAttendanceSync",
  /** Extension → app: content script is alive (re-fired for late mounts). */
  ready: "AttendanceExtensionReady",
} as const;

export interface AttendanceDataDetail {
  records: AttendanceRecord[];
}
export interface ProfileDataDetail {
  profile: EmployeeProfile;
}
export interface TodayPunchesDetail {
  punches: RawPunch[];
}
export interface SyncStatusDetail {
  success: boolean;
  error?: string;
}
export interface SyncRequestDetail {
  employeeId: number;
  month: number;
  year: number;
}

/** Bookmarklet v6 `postMessage` payload. */
export interface BookmarkletMessage {
  type: "ATTENDANCE_DATA";
  records: AttendanceRecord[];
  userName?: string;
  profile?: EmployeeProfile;
  todayPunches?: RawPunch[];
  /** Bookmarklet code version, tracked to prompt users to re-drag. */
  v?: string;
}

/** Ask the extension's background worker to fetch one month. */
export function dispatchSyncRequest(detail: SyncRequestDetail): void {
  window.dispatchEvent(new CustomEvent(EXTENSION_EVENTS.requestSync, { detail }));
}

/** Type guard for bookmarklet messages: trusted origin + v6 envelope. */
export function isBookmarkletMessage(
  event: MessageEvent
): event is MessageEvent<BookmarkletMessage> {
  if (event.origin !== window.location.origin && !event.origin.includes("hrone.cloud")) {
    return false;
  }
  const data = event.data as BookmarkletMessage | undefined;
  return data?.type === "ATTENDANCE_DATA" && Array.isArray(data.records);
}

/**
 * Best-effort hint that receiver.js is injected. A content script runs in an
 * isolated world, so the page's `window` only sees this flag for some builds —
 * the AttendanceExtensionReady event is the reliable signal; the flag covers
 * the case where the event fired before React mounted.
 */
export function isExtensionReadyFlagSet(): boolean {
  return !!(window as unknown as { __attendanceExtensionReady?: boolean }).__attendanceExtensionReady;
}
