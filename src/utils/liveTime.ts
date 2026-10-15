/**
 * Helpers for values that depend on "now": local dates, leave time, and
 * data freshness. Kept pure (take `now` as an argument) so they are testable
 * and so callers re-evaluate them on every tick instead of caching stale results.
 */

/** Fallback when no shift data is available at all (HROne GEN shift). */
export const DEFAULT_SHIFT_MINUTES = 9 * 60;

/** YYYY-MM-DD in the user's LOCAL timezone (not UTC — IST is +5:30). */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local date string for `days` before `from`. */
export function localDateDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return localDateString(d);
}

/**
 * Full shift length from start/end ("HH:MM" or "HH:MM:SS").
 * Handles overnight shifts (end before start). Returns null when unusable.
 */
export function shiftLengthMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const parse = (s: string | null | undefined) => {
    if (!s) return null;
    const [h, m] = s.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const s = parse(start);
  const e = parse(end);
  if (s === null || e === null) return null;
  const len = e >= s ? e - s : e + 1440 - s;
  return len > 0 ? len : null;
}

/** "HH:MM" first punch + shift length → leave time as minutes since midnight. */
export function leaveAtMinutes(firstPunch: string, shiftMinutes: number): number | null {
  const [h, m] = firstPunch.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m + shiftMinutes;
}

/** Minutes since midnight → "HH:MM" (wraps past midnight). */
export function minutesToHHMM(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export type Freshness = "fresh" | "aging" | "stale";

/**
 * fresh: synced within the last hour
 * aging: synced earlier today (local), within 8 hours
 * stale: older than 8 hours, or synced on a previous day
 */
export function getFreshness(syncedIso: string | null, now: Date = new Date()): Freshness {
  if (!syncedIso) return "stale";
  const synced = new Date(syncedIso);
  if (Number.isNaN(synced.getTime())) return "stale";
  const ageMin = (now.getTime() - synced.getTime()) / 60000;
  if (localDateString(synced) !== localDateString(now)) return "stale";
  if (ageMin <= 60) return "fresh";
  if (ageMin <= 8 * 60) return "aging";
  return "stale";
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago". */
export function formatRelativeAge(syncedIso: string | null, now: Date = new Date()): string {
  if (!syncedIso) return "never";
  const synced = new Date(syncedIso);
  if (Number.isNaN(synced.getTime())) return "unknown";
  const min = Math.max(0, Math.floor((now.getTime() - synced.getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24 && localDateString(synced) === localDateString(now)) return `${hours} h ago`;
  if (localDateString(synced) === localDateDaysAgo(1, now)) return "yesterday";
  const days = Math.max(1, Math.round(min / 1440));
  return `${days} days ago`;
}
