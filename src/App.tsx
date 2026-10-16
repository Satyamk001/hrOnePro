import { useState, useMemo, useEffect, useCallback, useRef, type FormEvent } from "react";
import type { AttendanceRecord, DashboardMetrics, EnrichedRecord, EmployeeProfile, TodayAttendance, RawPunch } from "./types";
import { classifyRecord } from "./utils/classifier";
import {
  computeRecordMetrics,
  computeAggregateMetrics,
  formatMinutes,
} from "./utils/timeCalculator";
import { generateBookmarkletCode } from "./bookmarklet";
import Dashboard from "./components/Dashboard";
import DayTable from "./components/DayTable";
import ProfilePanel from "./components/ProfilePanel";
import TodayCard from "./components/TodayCard";
import PrivacyPage from "./components/PrivacyPage";
import { GlassToggle } from "./components/ui/GlassToggle";
import { SplashButton } from "./components/ui/SplashButton";
import { ClickRipple } from "./components/ui/ClickRipple";
import AnimatedCounter from "./components/ui/AnimatedCounter";
import { useNow } from "./hooks/useNow";
import { useDropletMerge } from "./hooks/useDropletMerge";
import {
  DEFAULT_SHIFT_MINUTES,
  formatRelativeAge,
  getFreshness,
  leaveAtMinutes,
  localDateDaysAgo,
  localDateString,
  minutesToHHMM,
  shiftLengthMinutes,
} from "./utils/liveTime";

const STORAGE_KEY = "attendance-insights-data";
const USER_KEY = "attendance-insights-user";
const PROFILE_KEY = "attendance-insights-profile";
const TODAY_KEY = "attendance-insights-today";
const LAST_SYNCED_KEY = "attendance-last-synced";
const EMP_ID_KEY = "attendance-empId";
const BOOKMARKLET_VERSION = "6";
const BOOKMARKLET_VERSION_KEY = "attendance-bookmarklet-version";
const EXTENSION_VERSION = "2.7.0";
const EXTENSION_VERSION_KEY = "attendance-extension-version";
const APP_VERSION_KEY = "attendance-app-version";
const APP_VERSION = __APP_VERSION__; // from package.json via vite define
const SYNC_TIMEOUT_MS = 15000;
const STALE_FAILURE_WINDOW_MS = 30000;
// Module-level so React StrictMode's double-invoked effects (dev) and
// remounts can't fire two auto-syncs that race each other in the extension.
let autoSyncRequested = false;
interface SavedEntry { label: string; key: string; records: AttendanceRecord[]; }

function deriveMonthKey(records: AttendanceRecord[]): string {
  const monthCounts: Record<string, number> = {};
  for (const r of records) {
    const dateOnly = r.attendanceDate.split("T")[0];
    const monthKey = dateOnly.substring(0, 7);
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  }
  let maxKey = "", maxCount = 0;
  for (const [key, count] of Object.entries(monthCounts)) {
    if (count > maxCount) { maxCount = count; maxKey = key; }
  }
  return maxKey;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function normalizeRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return records.map((r) => ({ ...r, attendanceDate: r.attendanceDate.split("T")[0] }));
}

/**
 * Derive today's live attendance from raw HROne punches. Shared by both the
 * extension (TodayPunchesFromExtension event) and the bookmarklet (postMessage
 * with todayPunches) so the "Today" card behaves identically for both paths.
 * Returns null when there are no usable punches for today.
 */
function deriveTodayAttendance(rawPunches: RawPunch[]): TodayAttendance | null {
  if (!Array.isArray(rawPunches) || rawPunches.length === 0) return null;
  const punches = rawPunches
    .filter((p) => !p.isPunchExcluded)
    .sort((a, b) => a.punchDateTime.localeCompare(b.punchDateTime));
  if (punches.length === 0) return null;

  const firstPunch = punches[0].punchDateTime;
  const lastPunch = punches[punches.length - 1].punchDateTime;
  const firstTime = new Date(firstPunch);
  const lastTime = new Date(lastPunch);
  const now = new Date();
  // Only treat these as "today" if the punches are from today — compared in
  // LOCAL time, not UTC. HROne punch timestamps read as the user's local day;
  // a UTC comparison wrongly rejects valid punches near the day boundary
  // (e.g. evening in IST is already the next day in UTC).
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const date = localDate(firstTime);
  if (date !== localDate(now)) return null;
  // Worked so far = from first punch to now (regardless of punch count)
  const workedMs = now.getTime() - firstTime.getTime();
  const workedMinutesSoFar = Math.max(0, Math.floor(workedMs / 60000));
  // Still "in" when there's an odd number of punches
  const isStillIn = punches.length % 2 !== 0;

  const formatHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return {
    date,
    firstPunch: formatHHMM(firstTime),
    lastPunch: formatHHMM(lastTime),
    punchCount: punches.length,
    workedMinutesSoFar,
    isStillIn,
    rawPunches: punches,
  };
}

function loadSavedEntries(): SavedEntry[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveTolocalStorage(entries: SavedEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

/** Smooth scrolling unless the user asked the OS for reduced motion. */
function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

const NON_WORKING_STATUSES = new Set(["Week Off", "Holiday"]);

/** Walk backwards from yesterday up to 7 days to find the most recent working day record */
function findLastWorkingDayRecord(
  enrichedRecords: EnrichedRecord[] | null,
  allEntries: SavedEntry[],
  now: Date = new Date()
): { record: EnrichedRecord; date: string; daysAgo: number } | null {
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    // Local date — UTC would point at the wrong day before 05:30 IST.
    const dateStr = localDateDaysAgo(daysBack, now);

    let rec: EnrichedRecord | undefined;

    if (enrichedRecords) {
      rec = enrichedRecords.find((r) => r.attendanceDate === dateStr);
    }

    if (!rec && allEntries.length > 0) {
      for (const entry of allEntries) {
        const match = entry.records
          .map((r) => ({ ...r, attendanceDate: r.attendanceDate.split("T")[0] }))
          .find((r) => r.attendanceDate === dateStr);
        if (match) { rec = computeRecordMetrics(classifyRecord(match)); break; }
      }
    }

    if (!rec) continue;
    // If this day is a non-working day, skip and keep looking
    if (NON_WORKING_STATUSES.has(rec.status)) continue;
    return { record: rec, date: dateStr, daysAgo: daysBack };
  }
  return null;
}

function PaddedCounter({ value, ...props }: { value: number; duration: number; continuous: boolean; separator: boolean; className?: string }) {
  const tens = Math.floor(value / 10);
  const units = value % 10;
  return (
    <>
      <AnimatedCounter value={tens} duration={props.duration} continuous={props.continuous} separator={props.separator} className={props.className} />
      <AnimatedCounter value={units} duration={props.duration} continuous={props.continuous} separator={props.separator} className={props.className} />
    </>
  );
}

function LiveClock({ todayAttendance, shiftMinutes }: { todayAttendance: TodayAttendance | null; shiftMinutes: number }) {
  const now = useNow(1000);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Calculate Today attendance metrics matching TodayCard
  let timeLeftDisplay: string | null = null;
  let shiftComplete = false;
  let workedValueDisplay: string | null = null;
  let canLeaveDisplay: string | null = null;

  if (todayAttendance?.firstPunch) {
    const [h, m] = todayAttendance.firstPunch.split(":").map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const workedSoFar = Math.max(0, nowMinutes - (h * 60 + m));
    workedValueDisplay = formatMinutes(workedSoFar);

    const leaveMinutes = leaveAtMinutes(todayAttendance.firstPunch, shiftMinutes);
    if (leaveMinutes !== null) {
      canLeaveDisplay = minutesToHHMM(leaveMinutes);
      const diff = leaveMinutes - nowMinutes;

      if (diff <= 0) {
        const extra = Math.abs(diff);
        const extraH = Math.floor(extra / 60);
        const extraM = extra % 60;
        shiftComplete = true;
        timeLeftDisplay = `+${extraH}h ${extraM}m extra`;
      } else {
        const hoursLeft = Math.floor(diff / 60);
        const minsLeft = diff % 60;
        timeLeftDisplay = `${hoursLeft}h ${minsLeft}m left`;
      }
    }
  }

  return (
    <>
      {/* Clock icon */}
      <svg className="w-3.5 h-3.5 text-steel shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span
        className="font-mono text-sm font-semibold text-ink tabular-nums inline-flex items-center clock-time shrink-0"
        role="timer"
        aria-label={`Current time ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`}
      >
        <span aria-hidden="true" className="inline-flex items-center">
          <PaddedCounter value={hours} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
          <span className="text-steel">:</span>
          <PaddedCounter value={minutes} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
          <span className="text-steel">:</span>
          <PaddedCounter value={seconds} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
        </span>
      </span>

      {/* COMPACT STATE: visible at rest & low scroll */}
      {timeLeftDisplay && (
        <span className="clock-compact-section inline-flex items-center">
          <div className="pill-divider" />
          <span
            className={`clock-status text-xs font-medium ${shiftComplete ? "status-complete" : "status"}`}
            title={`Based on a ${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60}m shift`}
          >
            {timeLeftDisplay}
          </span>
        </span>
      )}

      {/* EXPANDED TODAY SUMMARY: reveals progressively as clock pill absorbs Today card */}
      {todayAttendance?.firstPunch && (
        <span className="clock-expanded-section inline-flex items-center">
          {/* Metric 1: Punch in (shown first) */}
          <span className="clock-expanded-item clock-item-punchin inline-flex items-center shrink-0">
            <span className="clock-pill-divider" aria-hidden="true" />
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${
                todayAttendance.isStillIn
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                  : "bg-steel/60"
              }`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-steel font-normal mr-1.5 hidden min-[440px]:inline">
              Punch in :
            </span>
            <span className="text-[11px] text-steel font-normal mr-1 min-[440px]:hidden">
              In :
            </span>
            <span className="text-xs font-mono font-semibold text-ink tabular-nums">
              {todayAttendance.firstPunch}
            </span>
          </span>

          {/* Metric 2: Time left in shift */}
          {timeLeftDisplay && (
            <span className="clock-expanded-item clock-item-left inline-flex items-center shrink-0">
              <span className="clock-pill-divider" aria-hidden="true" />
              <span
                className={`text-xs font-mono font-semibold tabular-nums ${
                  shiftComplete
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-primary"
                }`}
              >
                {timeLeftDisplay}
              </span>
            </span>
          )}

          {/* Metric 3: Worked so far (Tablet + Desktop) */}
          {workedValueDisplay && (
            <span className="clock-expanded-item clock-item-worked hidden sm:inline-flex items-center shrink-0">
              <span className="clock-pill-divider" aria-hidden="true" />
              <span className="text-xs font-mono font-semibold text-ink tabular-nums">
                {workedValueDisplay}
              </span>
              <span className="text-[11px] text-steel font-normal ml-1">worked</span>
            </span>
          )}

          {/* Metric 4: Can leave at (Desktop) */}
          {canLeaveDisplay && (
            <span className="clock-expanded-item clock-item-leave hidden md:inline-flex items-center shrink-0">
              <span className="clock-pill-divider" aria-hidden="true" />
              <span className="text-[11px] text-steel font-normal mr-1">leave</span>
              <span
                className={`text-xs font-mono font-semibold tabular-nums ${
                  shiftComplete
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-primary"
                }`}
                title={timeLeftDisplay ? `${timeLeftDisplay} (shift target ${canLeaveDisplay})` : undefined}
              >
                {canLeaveDisplay}
              </span>
            </span>
          )}
        </span>
      )}
    </>
  );
}

function App() {
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>(loadSavedEntries);
  const [activeKey, setActiveKey] = useState<string | null>(() => {
    const entries = loadSavedEntries();
    if (!entries.length) return null;
    return [...entries].sort((a, b) => b.key.localeCompare(a.key))[0].key;
  });
  const sortedEntries = useMemo(() => {
    return savedEntries.slice().sort((a, b) => b.key.localeCompare(a.key));
  }, [savedEntries]);
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_KEY) || "");
  const [showAllDays, setShowAllDays] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string, ms = 3000) => {
    window.clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const [lastSynced, setLastSynced] = useState<string | null>(() => localStorage.getItem(LAST_SYNCED_KEY));
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Droplet Merge — Liquid sticky header animation refs
  const mainRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const clockPillRef = useRef<HTMLDivElement>(null);
  const todayCardPlaceholderRef = useRef<HTMLDivElement>(null);
  const morphingDropletRef = useRef<HTMLDivElement>(null);
  const cardContentRef = useRef<HTMLDivElement>(null);
  const dropletSheenRef = useRef<HTMLDivElement>(null);
  // When records last arrived. A failure status that arrives right after a
  // success comes from a duplicate/overlapping request and must not show an error.
  const lastDataAtRef = useRef(0);
  const syncTimeoutRef = useRef<number | undefined>(undefined);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Previous version of a month that a re-sync just shrank — offered as Undo.
  const [undoEntry, setUndoEntry] = useState<{ entry: SavedEntry; message: string } | null>(null);
  const [empIdDialogOpen, setEmpIdDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Ticks every 30s (and on tab focus) so "Today", "Yesterday" and
  // "synced X ago" roll over without a reload.
  const now = useNow(30000);
  const today = localDateString(now);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(() => {
    // Rehydrate today's punches from the last successful sync — but only if the
    // stored data is actually for today (LOCAL date), so stale punches from a
    // previous day don't linger.
    try {
      const raw = localStorage.getItem(TODAY_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as TodayAttendance;
      return stored.date === localDateString() ? stored : null;
    } catch {
      return null;
    }
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(() => {
    try { const raw = localStorage.getItem(PROFILE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  // Version check — detect new app/extension versions and prompt update
  useEffect(() => {
    const storedAppVersion = localStorage.getItem(APP_VERSION_KEY);
    const storedExtVersion = localStorage.getItem(EXTENSION_VERSION_KEY);
    if (storedAppVersion && storedAppVersion !== APP_VERSION) {
      setHasUpdate(true);
      setShowOnboarding(true);
    }
    if (storedExtVersion && storedExtVersion !== EXTENSION_VERSION) {
      setHasUpdate(true);
    }
    // Save current versions
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    localStorage.setItem(EXTENSION_VERSION_KEY, EXTENSION_VERSION);
  }, []);

  // Midnight rollover: yesterday's live punches must not keep showing as "Today".
  useEffect(() => {
    if (todayAttendance && todayAttendance.date !== today) {
      setTodayAttendance(null);
      try { localStorage.removeItem(TODAY_KEY); } catch { /* ignore */ }
    }
  }, [today, todayAttendance]);

  // Cross-tab sync: a sync (or theme change) in another tab updates this one.
  // The `storage` event only fires in OTHER tabs and only when the value
  // actually changes, so writing back the same data can't loop.
  useEffect(() => {
    const parse = <T,>(v: string | null): T | null => {
      if (!v) return null;
      try { return JSON.parse(v) as T; } catch { return null; }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      switch (e.key) {
        case STORAGE_KEY: {
          const entries = parse<SavedEntry[]>(e.newValue) ?? [];
          setSavedEntries(entries);
          setActiveKey((prev) =>
            prev && entries.some((x) => x.key === prev)
              ? prev
              : entries.length ? [...entries].sort((a, b) => b.key.localeCompare(a.key))[0].key : null
          );
          break;
        }
        case LAST_SYNCED_KEY: setLastSynced(e.newValue); break;
        case PROFILE_KEY: setEmployeeProfile(parse<EmployeeProfile>(e.newValue)); break;
        case USER_KEY: setUserName(e.newValue || ""); break;
        case TODAY_KEY: {
          const t = parse<TodayAttendance>(e.newValue);
          setTodayAttendance(t && t.date === localDateString() ? t : null);
          break;
        }
        case "theme": {
          const dark = e.newValue === "dark";
          document.documentElement.classList.toggle("dark", dark);
          setIsDark(dark);
          break;
        }
        case null: // localStorage.clear() in another tab
          setSavedEntries([]); setActiveKey(null); setLastSynced(null);
          setEmployeeProfile(null); setTodayAttendance(null);
          break;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const appUrl = window.location.origin;
  const bookmarkletCode = generateBookmarkletCode(appUrl, BOOKMARKLET_VERSION);

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (bookmarkletRef.current) bookmarkletRef.current.setAttribute("href", bookmarkletCode); }, [bookmarkletCode]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      itemsRef.current.forEach((item) => {
        if (!item) return;
        item.style.transform = "none";
        item.style.opacity = "1";
        item.style.zIndex = "1";
      });
      return;
    }

    const updatePadding = () => {
      const containerRect = container.getBoundingClientRect();
      const halfHeight = containerRect.height / 2;
      if (halfHeight > 0) {
        container.style.paddingTop = `${halfHeight}px`;
        container.style.paddingBottom = `${halfHeight}px`;
      }
    };

    const updateVisuals = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      itemsRef.current.forEach((item) => {
        if (!item) return;
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;

        const pixelDistance = Math.abs(itemCenter - containerCenter);
        const itemHeight = item.offsetHeight || 50;
        const itemSpacing = itemHeight + 8; // approx 8px gap
        if (itemSpacing === 0) return;

        const positionDistance = pixelDistance / itemSpacing;

        // Smooth continuous Gaussian curve (eliminates piecewise robotic steps)
        const falloff = Math.exp(-0.45 * positionDistance * positionDistance);
        const scale = 0.82 + 0.24 * falloff;
        const opacity = 0.15 + 0.85 * falloff;
        const zIndex = Math.round(10 + 90 * falloff);

        item.style.transform = `scale3d(${scale.toFixed(4)}, ${scale.toFixed(4)}, 1)`;
        item.style.opacity = opacity.toFixed(3);
        item.style.zIndex = zIndex.toString();
      });
    };

    updatePadding();
    updateVisuals();

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateVisuals();
          ticking = false;
        });
        ticking = true;
      }
    };

    const onResize = () => {
      updatePadding();
      updateVisuals();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const t1 = setTimeout(updateVisuals, 50);
    const t2 = setTimeout(updateVisuals, 300);

    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sortedEntries, activeKey]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    }
  }, [activeKey]);

  const attendanceData = useMemo(() => {
    if (!activeKey) return null;
    return savedEntries.find((e) => e.key === activeKey)?.records ?? null;
  }, [activeKey, savedEntries]);

  useEffect(() => { saveTolocalStorage(savedEntries); }, [savedEntries]);
  const savedEntriesRef = useRef(savedEntries);
  savedEntriesRef.current = savedEntries;

  const finishSync = useCallback(() => {
    syncingRef.current = false;
    setSyncing(false);
    window.clearTimeout(syncTimeoutRef.current);
  }, []);

  const handleDataParsed = useCallback((data: AttendanceRecord[]) => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!data[0].attendanceDate) return;

    // Save employee ID for future Sync Now use
    if (data[0].employeeId) {
      localStorage.setItem(EMP_ID_KEY, String(data[0].employeeId));
    }

    const normalized = normalizeRecords(data);
    const monthKey = deriveMonthKey(normalized);
    const label = formatMonthLabel(monthKey);

    // Re-syncing replaces the stored month. If the new data has fewer days or
    // fewer punched days (e.g. HROne returned a partial response), keep the
    // previous copy so the user can undo instead of silently losing data.
    const previous = savedEntriesRef.current.find((e) => e.key === monthKey);
    const punched = (rs: AttendanceRecord[]) => rs.filter((r) => r.timeIn).length;
    const shrank = previous && (
      normalized.length < previous.records.length || punched(normalized) < punched(previous.records)
    );

    setSavedEntries((prev) => {
      const idx = prev.findIndex((e) => e.key === monthKey);
      if (idx >= 0) { const u = [...prev]; u[idx] = { label, key: monthKey, records: normalized }; return u; }
      return [...prev, { label, key: monthKey, records: normalized }];
    });
    setActiveKey(monthKey);

    const syncedAt = new Date().toISOString();
    setLastSynced(syncedAt);
    localStorage.setItem(LAST_SYNCED_KEY, syncedAt);

    if (shrank && previous) {
      setUndoEntry({
        entry: previous,
        message: `Re-sync replaced ${label}: ${punched(previous.records)} → ${punched(normalized)} punched days.`,
      });
    } else {
      setUndoEntry(null);
      showToast(`Synced ${label} — ${normalized.length} days`);
    }
    setSyncError(null);
    lastDataAtRef.current = Date.now();
    finishSync();
    // Receiving data from the extension is proof it's installed and active.
    // The AttendanceExtensionReady signal can be missed on load (e.g. when the
    // extension is reloaded while this tab is already open, or injected
    // programmatically for a non-manifest host), which would otherwise leave
    // the Sync button disabled even though sync just succeeded.
    setExtensionAvailable(true);
  }, [showToast, finishSync]);

  const handleUndoResync = useCallback(() => {
    if (!undoEntry) return;
    const { entry } = undoEntry;
    setSavedEntries((prev) => prev.map((e) => (e.key === entry.key ? entry : e)));
    setActiveKey(entry.key);
    setUndoEntry(null);
    showToast(`Restored previous ${entry.label} data`);
  }, [undoEntry, showToast]);

  useEffect(() => {
    const h = (event: Event) => { const e = event as CustomEvent<{ records: AttendanceRecord[] }>; if (e.detail?.records) handleDataParsed(e.detail.records); };
    window.addEventListener("AttendanceDataFromExtension", h);
    return () => window.removeEventListener("AttendanceDataFromExtension", h);
  }, [handleDataParsed]);

  // Listen for profile data from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<{ profile: EmployeeProfile }>;
      if (e.detail?.profile) {
        setEmployeeProfile(e.detail.profile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(e.detail.profile));
        if (e.detail.profile.employeeName) {
          setUserName(e.detail.profile.employeeName);
          localStorage.setItem(USER_KEY, e.detail.profile.employeeName);
        }
      }
    };
    window.addEventListener("ProfileDataFromExtension", h);
    return () => window.removeEventListener("ProfileDataFromExtension", h);
  }, []);

  // Listen for today's punch data from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<{ punches: RawPunch[] }>;
      const todayData = deriveTodayAttendance(e.detail?.punches ?? []);
      if (todayData) {
        setTodayAttendance(todayData);
        // Persist so the "Today" card survives reloads and HROne slowness
        try { localStorage.setItem(TODAY_KEY, JSON.stringify(todayData)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("TodayPunchesFromExtension", h);
    return () => window.removeEventListener("TodayPunchesFromExtension", h);
  }, []);

  // Detect extension availability
  useEffect(() => {
    let readyHandled = false;
    const onReady = () => {
      if (readyHandled) return;
      readyHandled = true;
      setExtensionAvailable(true);
      // Auto-sync on page load if employee ID exists
      let empId = parseInt(localStorage.getItem("attendance-empId") || "0");
      if (!empId && savedEntries.length > 0) {
        const firstRecord = savedEntries[0].records[0];
        if (firstRecord) {
          empId = firstRecord.employeeId;
          localStorage.setItem("attendance-empId", String(empId));
        }
      }
      if (empId && !autoSyncRequested) {
        autoSyncRequested = true;
        syncingRef.current = true;
        setSyncing(true);
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = window.setTimeout(() => {
          syncingRef.current = false;
          setSyncing(false);
        }, SYNC_TIMEOUT_MS);
        const now = new Date();
        window.dispatchEvent(new CustomEvent("RequestAttendanceSync", {
          detail: { employeeId: empId, month: now.getMonth() + 1, year: now.getFullYear() }
        }));
      }
    };
    window.addEventListener("AttendanceExtensionReady", onReady);
    // Check if already set (extension loaded before React)
    if ((window as unknown as { __attendanceExtensionReady?: boolean }).__attendanceExtensionReady) {
      onReady();
    }
    // Belt-and-suspenders: receiver.js may set the flag slightly after this
    // effect runs (programmatic injection on non-manifest hosts, or a reload
    // race). Poll briefly so a late flag still enables the button, even if the
    // one-shot event was missed. Stops as soon as it's detected.
    let polls = 0;
    const poll = window.setInterval(() => {
      polls++;
      if ((window as unknown as { __attendanceExtensionReady?: boolean }).__attendanceExtensionReady) {
        onReady();
        window.clearInterval(poll);
      } else if (polls >= 20) {
        window.clearInterval(poll);
      }
    }, 250);
    return () => {
      window.removeEventListener("AttendanceExtensionReady", onReady);
      window.clearInterval(poll);
    };
  }, []);

  // Listen for sync status from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<{ success: boolean; error?: string }>;
      if (e.detail && !e.detail.success) {
        if (Date.now() - lastDataAtRef.current < STALE_FAILURE_WINDOW_MS) {
          console.info("[Attendance] Ignoring sync failure from an overlapping request:", e.detail.error);
        } else {
          setSyncError(e.detail.error || "HROne didn't return any data.");
        }
      }
      finishSync();
    };
    window.addEventListener("ExtensionSyncStatus", h);
    return () => window.removeEventListener("ExtensionSyncStatus", h);
  }, [finishSync]);

  const resolveEmpId = useCallback((): number => {
    let empId = parseInt(localStorage.getItem(EMP_ID_KEY) || "0");
    if (!empId && employeeProfile) empId = employeeProfile.employeeId;
    if (!empId && savedEntries.length > 0) {
      const firstRecord = savedEntries[0].records[0];
      if (firstRecord) empId = firstRecord.employeeId;
    }
    return empId || 0;
  }, [employeeProfile, savedEntries]);

  const startSync = useCallback((empId: number) => {
    localStorage.setItem(EMP_ID_KEY, String(empId));
    const current = new Date();
    // Sync the month currently selected in the sidebar (activeKey is "YYYY-MM").
    // Fall back to the current month when nothing is selected (first-time user).
    let syncMonth = current.getMonth() + 1;
    let syncYear = current.getFullYear();
    if (activeKey) {
      const [y, m] = activeKey.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        syncYear = y;
        syncMonth = m;
      }
    }
    setSyncError(null);
    syncingRef.current = true;
    setSyncing(true);
    window.dispatchEvent(new CustomEvent("RequestAttendanceSync", {
      detail: { employeeId: empId, month: syncMonth, year: syncYear }
    }));
    // No response at all → say so instead of silently re-enabling the button.
    window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      if (!syncingRef.current) return;
      finishSync();
      setSyncError("No response from HROne after 15 seconds.");
    }, SYNC_TIMEOUT_MS);
  }, [activeKey, finishSync]);

  // Sync Now handler
  const handleSyncNow = useCallback(() => {
    // One request at a time — overlapping requests race over the same HROne tab.
    if (syncingRef.current) return;
    const empId = resolveEmpId();
    if (!empId) { setEmpIdDialogOpen(true); return; }
    startSync(empId);
  }, [resolveEmpId, startSync]);

  useEffect(() => {
    const h = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && !event.origin.includes("hrone.cloud")) return;
      if (event.data?.type === "ATTENDANCE_DATA" && Array.isArray(event.data.records)) {
        handleDataParsed(event.data.records);
        if (event.data.userName) { setUserName(event.data.userName); localStorage.setItem(USER_KEY, event.data.userName); }
        // Handle profile data
        if (event.data.profile) {
          setEmployeeProfile(event.data.profile);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(event.data.profile));
        }
        // Track bookmarklet version
        if (event.data.v) {
          localStorage.setItem(BOOKMARKLET_VERSION_KEY, event.data.v);
        }
        // Today's live attendance (bookmarklet parity with the extension).
        // Without this, todayAttendance stays null and the ProfilePanel always
        // shows "Last Working Day" even when today's punches exist in HROne.
        if (Array.isArray(event.data.todayPunches)) {
          const todayData = deriveTodayAttendance(event.data.todayPunches);
          if (todayData) {
            setTodayAttendance(todayData);
            try { localStorage.setItem(TODAY_KEY, JSON.stringify(todayData)); } catch { /* ignore */ }
          }
        }
      }
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [handleDataParsed]);

  const classifiedRecords = useMemo(() => attendanceData?.map(classifyRecord) ?? null, [attendanceData]);
  const enrichedRecords = useMemo(() => classifiedRecords?.map(computeRecordMetrics) ?? null, [classifiedRecords]);
  const dashboardMetrics = useMemo<DashboardMetrics | null>(() => {
    if (!classifiedRecords) return null;
    const a = computeAggregateMetrics(classifiedRecords);
    return { ...a, formattedTotalHours: formatMinutes(a.totalWorkingMinutes), formattedExtraHours: formatMinutes(a.totalExtraMinutes), formattedShortfall: formatMinutes(a.totalShortfallMinutes), formattedAverage: formatMinutes(a.averageWorkMinutes) };
  }, [classifiedRecords]);

  const tableRecords = useMemo(() => {
    if (!enrichedRecords) return null;
    return showAllDays ? enrichedRecords : enrichedRecords.filter((r) => r.isWorkedDay);
  }, [enrichedRecords, showAllDays]);

  const activeLabel = savedEntries.find((e) => e.key === activeKey)?.label;

  // Compute last working day record for the profile panel
  const yesterdayRecord = useMemo<EnrichedRecord | null>(() => {
    const result = findLastWorkingDayRecord(enrichedRecords, savedEntries, new Date());
    return result ? result.record : null;
    // `today` re-runs this at midnight so "yesterday" moves forward.
  }, [enrichedRecords, savedEntries, today]);

  // Today's record straight from the Calendar data (today's row is included in
  // the monthly records). This is the fallback source for the "Today" card when
  // there's no live RawPunch data (e.g. the bookmarklet path, or before punches
  // load). Prefer the live `todayAttendance` when available since it updates
  // intraday; otherwise synthesize a TodayAttendance from today's record.
  const todayRecord = useMemo<EnrichedRecord | null>(() => {
    if (enrichedRecords) {
      const rec = enrichedRecords.find((r) => r.attendanceDate === today);
      if (rec) return rec;
    }
    // Today may live in a different month entry than the one being viewed.
    for (const entry of savedEntries) {
      const match = entry.records.find((r) => r.attendanceDate.split("T")[0] === today);
      if (match) return computeRecordMetrics(classifyRecord({ ...match, attendanceDate: today }));
    }
    return null;
  }, [enrichedRecords, savedEntries, today]);

  const effectiveTodayAttendance = useMemo<TodayAttendance | null>(() => {
    if (todayAttendance && todayAttendance.date === today) return todayAttendance;
    const rec = todayRecord;
    // Only show a Today card if the person actually punched in today.
    if (!rec || !rec.timeIn) return null;
    return {
      date: today,
      firstPunch: rec.timeIn,
      lastPunch: rec.timeout ?? rec.timeIn,
      punchCount: rec.timeout ? 2 : 1,
      workedMinutesSoFar: rec.workedMinutes,
      isStillIn: !rec.timeout,
    };
  }, [todayAttendance, todayRecord, today]);

  // Shift length for "Can leave at": today's scheduled shift from HROne, else
  // the most recent day that has shift times, else the 9h GEN default.
  const todayShiftMinutes = useMemo<number>(() => {
    const fromToday = todayRecord ? shiftLengthMinutes(todayRecord.shiftStartTime, todayRecord.shiftEndTime) : null;
    if (fromToday) return fromToday;
    const all = savedEntries
      .flatMap((e) => e.records)
      .filter((r) => r.shiftStartTime && r.shiftEndTime && r.attendanceDate.split("T")[0] <= today)
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
    for (const r of all) {
      const len = shiftLengthMinutes(r.shiftStartTime, r.shiftEndTime);
      if (len) return len;
    }
    return DEFAULT_SHIFT_MINUTES;
  }, [todayRecord, savedEntries, today]);

  const freshness = getFreshness(lastSynced, now);
  const syncedAgo = formatRelativeAge(lastSynced, now);

  useDropletMerge({
    mainRef,
    headerRef,
    clockPillRef,
    placeholderRef: todayCardPlaceholderRef,
    morphingRef: morphingDropletRef,
    contentRef: cardContentRef,
    sheenRef: dropletSheenRef,
    active: !!enrichedRecords,
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-canvas relative">
      {/* Glassmorphism Three-Pill Navigation */}
      <header ref={headerRef} className="topbar absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="topbar-shell pointer-events-auto">

          {/* Pill 1 — Brand / User (Left) */}
          <div className="glass-pill brand-pill">
            <span className="brand-title">
              Attendance Insights
            </span>
            {userName && (
              <span className="brand-user">
                / {userName}
              </span>
            )}
          </div>

          {/* Pill 2 — Time / Status (Center) */}
          <div className="glass-pill clock-pill" ref={clockPillRef}>
            <LiveClock todayAttendance={effectiveTodayAttendance} shiftMinutes={todayShiftMinutes} />
          </div>

          {/* Pill 3 — Actions (Right) */}
          <div className="glass-pill action-pill">
            {/* Help button */}
            <ClickRipple>
              <button
                onClick={() => setShowOnboarding(!showOnboarding)}
                className="topbar-action relative"
                data-active={showOnboarding ? "true" : "false"}
                aria-label="Setup & Downloads"
                title="Setup & Downloads"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {hasUpdate && (
                  <span className="update-dot" />
                )}
              </button>
            </ClickRipple>

            {/* Divider */}
            <div className="pill-divider" />

            {/* Theme toggle */}
            <GlassToggle
              isDark={isDark}
              width={56}
              height={28}
              orbSize={24}
              onToggle={() => {
                const html = document.documentElement;
                html.classList.add("theme-transitioning");
                const newDark = !isDark;
                if (newDark) { html.classList.add("dark"); } else { html.classList.remove("dark"); }
                localStorage.setItem("theme", newDark ? "dark" : "light");
                setIsDark(newDark);
                setTimeout(() => html.classList.remove("theme-transitioning"), 500);
              }}
            />

            {/* Divider */}
            <div className="pill-divider" />

            {/* Sync button */}
            <SplashButton
              className="action-pill-splash"
              onClick={handleSyncNow}
              disabled={syncing || !extensionAvailable}
              loading={syncing}
              title={extensionAvailable ? (activeLabel ? `Sync ${activeLabel} from HROne` : "Fetch latest data from HROne") : "Install the extension to use Sync"}
              text="Sync"
              width={130}
              height={40}
            />
          </div>

        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden mt-0">
        {/* Toast notification — always-mounted live region so screen readers announce it */}
        <div role="status" aria-live="polite" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          {toast && (
            <div className="px-5 py-2.5 bg-ink text-canvas text-xs font-medium rounded-full shadow-card animate-[fadeIn_0.2s_ease-out]">
              {toast}
            </div>
          )}
        </div>

        {/* Sidebar — Cinematic episode selector */}
        <aside className="w-full xl:w-[22%] xl:max-w-[340px] lg:w-[25%] lg:max-w-[320px] md:w-[30%] md:max-w-[300px] shrink-0 flex flex-col overflow-hidden z-10 max-md:h-auto max-md:min-h-[100px] max-md:max-h-[60vh] md:h-full relative">
          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {savedEntries.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate text-center">No data yet</p>
            ) : (
              <div
                ref={scrollContainerRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hidden relative max-md:max-h-[35vh] sidebar-carousel-mask sidebar-scroll-container"
                style={{ overscrollBehavior: 'contain' }}
              >
                <div className="flex flex-col items-center w-full gap-[8px]">
                  {sortedEntries.map((entry, index) => {
                    const isActive = activeKey === entry.key;

                    return (
                      <button
                        key={entry.key}
                        ref={(el) => {
                          if (isActive) activeItemRef.current = el;
                          itemsRef.current[index] = el;
                        }}
                        onClick={(e) => {
                          setActiveKey(entry.key);
                          e.currentTarget.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
                        }}
                        aria-current={isActive ? "true" : undefined}
                        aria-label={`${entry.label}${isActive ? " (selected)" : ""}`}
                        className="sidebar-episode-btn cursor-pointer block text-left rounded-lg snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        style={{
                          width: '72%',
                          maxWidth: '230px',
                          transformOrigin: 'center center',
                          willChange: 'transform, opacity',
                        }}
                      >
                        <div
                          data-active={isActive ? "true" : "false"}
                          className={`sidebar-card relative rounded-lg overflow-hidden border w-full max-w-full active:scale-[0.98] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out ${
                            isActive
                              ? "border-primary shadow-lg shadow-primary/20"
                              : "border-hairline hover:border-hairline-strong hover:bg-surface/50"
                          }`}
                        >
                          <div
                            className={`px-3 py-2 flex items-start gap-x-2.5 w-full min-w-0 transition-colors duration-200 ${
                              isActive ? "bg-primary/20" : "bg-canvas/50"
                            }`}
                          >
                            {/* Number badge */}
                            <div
                              className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-bold text-[12px] mt-0.5 transition-colors duration-200 ${
                                isActive
                                  ? "bg-primary text-white"
                                  : "bg-hairline-soft text-steel"
                              }`}
                            >
                              {index + 1}
                            </div>
                            {/* Title + date */}
                            <div className="flex-1 min-w-0 overflow-hidden text-left">
                              <h4
                                className={`text-[12px] font-semibold leading-snug transition-colors duration-200 ${
                                  isActive
                                    ? "line-clamp-none whitespace-normal break-words text-ink"
                                    : "line-clamp-1 truncate text-slate"
                                }`}
                              >
                                {entry.label}
                              </h4>
                              <p className="text-[10px] text-stone mt-0.5 truncate">
                                {entry.key}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hidden pt-10 top-aperture-fade">
          {showPrivacy ? (
            <PrivacyPage onBack={() => setShowPrivacy(false)} />
          ) : (
            <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 max-w-[1280px]">
              {syncError && (
                <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg notice notice-error px-4 py-3">
                  <svg className="w-5 h-5 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">Sync failed: {syncError}</p>
                    <p className="text-xs text-steel mt-0.5">
                      Make sure you're logged in at{" "}
                      <a href="https://app.hrone.cloud/app/myprofile/calendar" target="_blank" rel="noopener noreferrer" className="text-link underline">HROne</a>
                      {" "}in this browser, then retry. Your saved data is unchanged.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={syncing || !extensionAvailable}
                      className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      {syncing ? "Retrying…" : "Retry"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncError(null)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {undoEntry && (
                <div role="status" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg notice notice-warning px-4 py-3">
                  <p className="flex-1 text-sm text-ink">
                    <span className="font-medium">Fewer days than before.</span> {undoEntry.message}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleUndoResync}
                      className="px-3 py-1.5 rounded-md border border-hairline-strong bg-canvas text-ink text-sm font-medium hover:bg-hairline-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => setUndoEntry(null)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Keep new data
                    </button>
                  </div>
                </div>
              )}
              {(!attendanceData || showOnboarding) ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 text-center">
                  {showOnboarding && attendanceData && (
                    <button
                      onClick={() => { setShowOnboarding(false); setHasUpdate(false); }}
                      className="mb-6 text-sm text-link hover:underline font-medium"
                    >
                      ← Back to dashboard
                    </button>
                  )}
                  {hasUpdate && (
                    <div className="mb-6 px-5 py-3 rounded-lg bg-cream border border-beige-deep text-sm text-charcoal max-w-lg w-full leading-relaxed">
                      <strong className="text-ink">Update available!</strong> Download the latest extension (v{EXTENSION_VERSION}) and re-drag the bookmarklet (v{BOOKMARKLET_VERSION}).
                    </div>
                  )}
                  <div className="mb-8 sm:mb-10 px-1">
                    <h2 className="font-display text-[2rem] leading-[1.1] sm:text-4xl font-medium text-ink tracking-display mb-3 text-balance">
                      Know your hours in seconds
                    </h2>
                    <p className="text-[15px] sm:text-base text-slate max-w-md mx-auto leading-relaxed">
                      See overtime, shortfall, and net balance from your HROne attendance — no manual calculation needed.
                    </p>
                  </div>

                  <div className="rounded-lg bg-cream border border-beige-deep p-6 sm:p-8 max-w-lg w-full text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-5">
                      Get started in 30 seconds
                    </p>
                    <div className="space-y-5">
                      <div className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">1</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">Drag this button to your bookmarks bar:</p>
                          <a
                            ref={bookmarkletRef}
                            href="#"
                            className="mt-2 px-4 py-2 max-w-full inline-flex items-center gap-2 bg-primary text-white rounded-md text-sm font-medium cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                            onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar.\nThen click it on the HROne calendar page."); }}
                          >
                            Sync Attendance
                            <span className="text-[10px] opacity-70 font-mono">v{BOOKMARKLET_VERSION}</span>
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">2</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            Open{" "}
                            <a href="https://app.hrone.cloud/app/myprofile/calendar" target="_blank" rel="noopener noreferrer" className="text-link hover:underline break-words">
                              HROne Calendar
                            </a>
                          </p>
                          <p className="text-xs text-steel mt-0.5">Log in if needed, then select the month you want</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">3</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">Click the bookmark — data appears here</p>
                          <p className="text-xs text-steel mt-0.5">First time you'll enter your Employee ID (from your HROne profile)</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-5 border-t border-beige-deep text-center space-y-2">
                      <a
                        href="/attendance-extension.zip"
                        download="attendance-extension.zip"
                        className="inline-flex items-center gap-2 px-4 py-2 border border-hairline-strong bg-canvas text-ink rounded-md text-sm font-medium hover:bg-hairline-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download Extension
                      </a>
                      <p className="text-[11px] text-stone leading-relaxed px-2 text-balance">
                        Unzip → chrome://extensions → Developer mode → Load unpacked
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {activeLabel && (
                      <h2 className="font-display text-3xl font-medium text-ink tracking-display">{activeLabel}</h2>
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className={`freshness-chip freshness-${freshness}`}
                        title={lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : "Never synced"}
                      >
                        <span className="freshness-dot" aria-hidden="true" />
                        {freshness === "stale" ? "Data may be outdated · " : ""}
                        Synced {syncedAgo}
                      </span>
                      {freshness !== "fresh" && (
                        extensionAvailable ? (
                          <button
                            type="button"
                            onClick={handleSyncNow}
                            disabled={syncing}
                            className="text-sm font-medium text-link hover:underline disabled:opacity-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {syncing ? "Syncing…" : "Sync now"}
                          </button>
                        ) : (
                          <a
                            href="https://app.hrone.cloud/app/myprofile/calendar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-link hover:underline"
                            title="Open HROne and click your Sync Attendance bookmark"
                          >
                            Refresh via HROne
                          </a>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => setProfileOpen(true)}
                        aria-expanded={profileOpen}
                        aria-controls="profile-panel"
                        className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline-strong text-sm font-medium text-ink hover:bg-hairline-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
                        </svg>
                        Profile & yesterday
                      </button>
                    </div>
                  </div>

                  {enrichedRecords && (
                    <TodayCard
                      todayAttendance={effectiveTodayAttendance}
                      shiftMinutes={todayShiftMinutes}
                      placeholderRef={todayCardPlaceholderRef}
                      morphingRef={morphingDropletRef}
                      contentRef={cardContentRef}
                      sheenRef={dropletSheenRef}
                    />
                  )}
                  {dashboardMetrics && <Dashboard metrics={dashboardMetrics} />}

                  {tableRecords && (
                    <section>
                      <div className="sticky top-[58px] z-20 flex items-center justify-between mb-2 py-2 px-3 -mx-3 rounded-lg backdrop-blur-md bg-canvas/85 border border-transparent table-dock-header">
                        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
                          {showAllDays ? "All Days" : "Worked Days"}
                        </p>
                        <button
                          onClick={() => setShowAllDays(!showAllDays)}
                          className="text-sm text-link hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        >
                          {showAllDays ? "Show worked only" : "Show all days"}
                        </button>
                      </div>
                      <div className="rounded-lg border border-hairline bg-canvas shadow-card">
                        <DayTable records={tableRecords} />
                      </div>
                    </section>
                  )}

                  {/* Sunset stripe band */}
                  <div className="sunset-stripe h-2 rounded-full mt-12" aria-hidden="true" />
                </>
              )}
            </div>
          )}
        </main>

        {/* Right Profile Panel — only visible after first sync */}
        {attendanceData && (
          <ProfilePanel
            profile={employeeProfile || {
              employeeId: 0,
              employeeCode: "",
              employeeName: userName || "Employee",
              designation: "",
              department: "",
              email: "",
              phone: "",
              dateOfJoining: "",
              reportingManager: "",
              profileImageUrl: null,
            }}
            yesterdayRecord={yesterdayRecord}
            appVersion={APP_VERSION}
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            onOpenPrivacy={() => { setProfileOpen(false); setShowPrivacy(true); }}
          />
        )}
      </div>

      {empIdDialogOpen && (
        <EmployeeIdDialog
          onCancel={() => setEmpIdDialogOpen(false)}
          onSubmit={(id) => { setEmpIdDialogOpen(false); startSync(id); }}
        />
      )}
    </div>
  );
}

/** Replaces window.prompt(): inline, validated, keyboard- and screen-reader-friendly. */
function EmployeeIdDialog({ onSubmit, onCancel }: { onSubmit: (id: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!/^\d{1,10}$/.test(trimmed) || Number(trimmed) <= 0) {
      setError("Enter the numeric Employee ID from your HROne profile (digits only).");
      return;
    }
    onSubmit(Number(trimmed));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dialog-backdrop" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="empid-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-hairline bg-canvas p-6 shadow-card"
      >
        <h2 id="empid-title" className="font-display text-xl font-medium text-ink">Your Employee ID</h2>
        <p className="text-sm text-slate mt-1">Needed once to fetch attendance from HROne. Stored only in this browser.</p>
        <label htmlFor="empid-input" className="block text-xs font-medium text-steel uppercase tracking-wide mt-5 mb-1.5">Employee ID</label>
        <input
          id="empid-input"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "empid-error" : "empid-hint"}
          placeholder="e.g. 12345"
          className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error ? (
          <p id="empid-error" className="text-xs text-error mt-1.5">{error}</p>
        ) : (
          <p id="empid-hint" className="text-xs text-steel mt-1.5">HROne → My Profile. It's the number, not your employee code.</p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            Save & sync
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
