/**
 * Central app configuration — storage keys, protocol versions, and sync
 * timeouts.
 *
 * Storage keys must stay stable: users' data lives in localStorage under
 * these exact names.
 */

// ── localStorage keys ──────────────────────────────────────────────────────
/** Saved month entries (`SavedEntry[]`). */
export const STORAGE_KEY = "attendance-insights-data";
export const USER_KEY = "attendance-insights-user";
export const PROFILE_KEY = "attendance-insights-profile";
export const TODAY_KEY = "attendance-insights-today";
export const LAST_SYNCED_KEY = "attendance-last-synced";
export const EMP_ID_KEY = "attendance-empId";
export const THEME_KEY = "theme";
export const APP_VERSION_KEY = "attendance-app-version";
export const EXTENSION_VERSION_KEY = "attendance-extension-version";
export const BOOKMARKLET_VERSION_KEY = "attendance-bookmarklet-version";

// ── Protocol versions ──────────────────────────────────────────────────────
/**
 * EXTENSION_VERSION must match extension/manifest.json — enforced by
 * scripts/zip-extension.mjs. Bump BOOKMARKLET_VERSION whenever the generated
 * bookmarklet code changes so users get the "re-drag" prompt.
 */
export const BOOKMARKLET_VERSION = "6";
export const EXTENSION_VERSION = "2.7.0";
export const APP_VERSION = __APP_VERSION__; // from package.json via vite define

// ── Sync timing ────────────────────────────────────────────────────────────
/** Give up on a sync request after this long with no response. */
export const SYNC_TIMEOUT_MS = 15000;
/**
 * A sync failure arriving within this window after data was received is an
 * overlapping/duplicate request, not a real error.
 */
export const STALE_FAILURE_WINDOW_MS = 30000;
