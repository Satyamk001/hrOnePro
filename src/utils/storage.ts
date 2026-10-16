/**
 * Thin typed helpers over localStorage.
 *
 * Reads are exception-safe: a missing key, corrupt JSON, or unavailable
 * storage yields null instead of crashing the app.
 */
import { EMP_ID_KEY } from "./config";

/** JSON-parsed value under `key`, or null when missing/corrupt. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Raw string value under `key`, or null when missing. */
export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Persist a raw string value (e.g. a timestamp or plain preference). */
export function writeString(key: string, value: string): void {
  localStorage.setItem(key, value);
}

/** Persist a JSON-serializable value. */
export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Remove a key, ignoring failures (e.g. storage disabled). */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** The stored HROne employee id, or 0 when never saved. */
export function readEmpId(): number {
  return parseInt(readString(EMP_ID_KEY) || "0") || 0;
}
