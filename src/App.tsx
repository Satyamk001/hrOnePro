import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import type { AttendanceRecord, EmployeeProfile, SavedEntry, TodayAttendance } from "./types";
import { formatMinutes } from "./utils/timeCalculator";
import { generateBookmarkletCode } from "./bookmarklet";
import Dashboard from "./components/Dashboard";
import DayTable from "./components/DayTable";
import ProfilePanel from "./components/ProfilePanel";
import TodayCard from "./components/TodayCard";
import PrivacyPage from "./components/PrivacyPage";
import AmbientBackground from "./components/AmbientBackground";
import { GlassToggle } from "./components/ui/GlassToggle";
import { SplashButton } from "./components/ui/SplashButton";
import { ClickRipple } from "./components/ui/ClickRipple";
import AnimatedCounter from "./components/ui/AnimatedCounter";
import { useNow } from "./hooks/useNow";
import { useDropletMerge } from "./hooks/useDropletMerge";
import { useToast } from "./hooks/useToast";
import { useTheme } from "./hooks/useTheme";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useSavedEntries } from "./features/attendance/useSavedEntries";
import { useAttendanceMetrics } from "./features/attendance/useAttendanceMetrics";
import { countPunchedDays, decodeStoredToday, deriveTodayAttendance } from "./features/attendance/helpers";
import {
  formatRelativeAge,
  getFreshness,
  leaveAtMinutes,
  localDateString,
  minutesToHHMM,
} from "./utils/liveTime";
import {
  APP_VERSION,
  APP_VERSION_KEY,
  BOOKMARKLET_VERSION,
  BOOKMARKLET_VERSION_KEY,
  EMP_ID_KEY,
  EXTENSION_VERSION,
  EXTENSION_VERSION_KEY,
  LAST_SYNCED_KEY,
  PROFILE_KEY,
  STALE_FAILURE_WINDOW_MS,
  SYNC_TIMEOUT_MS,
  TODAY_KEY,
  USER_KEY,
} from "./utils/config";
import { readEmpId, readString, writeString } from "./utils/storage";
import {
  dispatchSyncRequest,
  EXTENSION_EVENTS,
  isBookmarkletMessage,
  isExtensionReadyFlagSet,
  type AttendanceDataDetail,
  type ProfileDataDetail,
  type SyncStatusDetail,
  type TodayPunchesDetail,
} from "./features/sync/protocol";

// Module-level so React StrictMode's double-invoked effects (dev) and
// remounts can't fire two auto-syncs that race each other in the extension.
let autoSyncRequested = false;

/** Smooth scrolling unless the user asked the OS for reduced motion. */
function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
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
  const {
    entries: savedEntries,
    sortedEntries,
    activeKey,
    setActiveKey,
    upsertMonth,
    restoreEntry,
  } = useSavedEntries();
  const [userName, setUserName] = useLocalStorageState(USER_KEY, "", {
    decode: (raw) => raw,
    encode: (v) => v,
  });
  const [showAllDays, setShowAllDays] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { toast, showToast } = useToast();
  const [lastSynced, setLastSynced] = useLocalStorageState<string | null>(LAST_SYNCED_KEY, null, {
    decode: (raw) => raw,
    encode: (v) => v,
  });
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
  const [todayAttendance, setTodayAttendance, { clear: clearTodayAttendance }] = useLocalStorageState<TodayAttendance | null>(
    TODAY_KEY,
    null,
    { decode: decodeStoredToday }
  );
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useLocalStorageState<EmployeeProfile | null>(PROFILE_KEY, null);

  // Version check — detect new app/extension versions and prompt update
  useEffect(() => {
    const storedAppVersion = readString(APP_VERSION_KEY);
    const storedExtVersion = readString(EXTENSION_VERSION_KEY);
    if (storedAppVersion && storedAppVersion !== APP_VERSION) {
      setHasUpdate(true);
      setShowOnboarding(true);
    }
    if (storedExtVersion && storedExtVersion !== EXTENSION_VERSION) {
      setHasUpdate(true);
    }
    // Save current versions
    writeString(APP_VERSION_KEY, APP_VERSION);
    writeString(EXTENSION_VERSION_KEY, EXTENSION_VERSION);
  }, []);

  // Midnight rollover: yesterday's live punches must not keep showing as "Today".
  useEffect(() => {
    if (todayAttendance && todayAttendance.date !== today) {
      clearTodayAttendance();
    }
  }, [today, todayAttendance, clearTodayAttendance]);

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

  const finishSync = useCallback(() => {
    syncingRef.current = false;
    setSyncing(false);
    window.clearTimeout(syncTimeoutRef.current);
  }, []);

  const handleDataParsed = useCallback((data: AttendanceRecord[]) => {
    const result = upsertMonth(data);
    if (!result) return;

    // Save employee ID for future Sync Now use
    if (data[0].employeeId) {
      writeString(EMP_ID_KEY, String(data[0].employeeId));
    }

    setLastSynced(new Date().toISOString());

    if (result.shrank && result.previous) {
      setUndoEntry({
        entry: result.previous,
        message: `Re-sync replaced ${result.label}: ${countPunchedDays(result.previous.records)} → ${result.punchedCount} punched days.`,
      });
    } else {
      setUndoEntry(null);
      showToast(`Synced ${result.label} — ${result.recordCount} days`);
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
  }, [upsertMonth, showToast, finishSync]);

  const handleUndoResync = useCallback(() => {
    if (!undoEntry) return;
    const { entry } = undoEntry;
    restoreEntry(entry);
    setUndoEntry(null);
    showToast(`Restored previous ${entry.label} data`);
  }, [undoEntry, restoreEntry, showToast]);

  useEffect(() => {
    const h = (event: Event) => { const e = event as CustomEvent<AttendanceDataDetail>; if (e.detail?.records) handleDataParsed(e.detail.records); };
    window.addEventListener(EXTENSION_EVENTS.attendanceData, h);
    return () => window.removeEventListener(EXTENSION_EVENTS.attendanceData, h);
  }, [handleDataParsed]);

  // Listen for profile data from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<ProfileDataDetail>;
      if (e.detail?.profile) {
        setEmployeeProfile(e.detail.profile);
        if (e.detail.profile.employeeName) {
          setUserName(e.detail.profile.employeeName);
        }
      }
    };
    window.addEventListener(EXTENSION_EVENTS.profileData, h);
    return () => window.removeEventListener(EXTENSION_EVENTS.profileData, h);
  }, []);

  // Listen for today's punch data from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<TodayPunchesDetail>;
      const todayData = deriveTodayAttendance(e.detail?.punches ?? []);
      if (todayData) {
        setTodayAttendance(todayData);
      }
    };
    window.addEventListener(EXTENSION_EVENTS.todayPunches, h);
    return () => window.removeEventListener(EXTENSION_EVENTS.todayPunches, h);
  }, []);

  // Detect extension availability
  useEffect(() => {
    let readyHandled = false;
    const onReady = () => {
      if (readyHandled) return;
      readyHandled = true;
      setExtensionAvailable(true);
      // Auto-sync on page load if employee ID exists
      let empId = readEmpId();
      if (!empId && savedEntries.length > 0) {
        const firstRecord = savedEntries[0].records[0];
        if (firstRecord) {
          empId = firstRecord.employeeId;
          writeString(EMP_ID_KEY, String(empId));
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
        dispatchSyncRequest({ employeeId: empId, month: now.getMonth() + 1, year: now.getFullYear() });
      }
    };
    window.addEventListener(EXTENSION_EVENTS.ready, onReady);
    // Check if already set (extension loaded before React)
    if (isExtensionReadyFlagSet()) {
      onReady();
    }
    // Belt-and-suspenders: receiver.js may set the flag slightly after this
    // effect runs (programmatic injection on non-manifest hosts, or a reload
    // race). Poll briefly so a late flag still enables the button, even if the
    // one-shot event was missed. Stops as soon as it's detected.
    let polls = 0;
    const poll = window.setInterval(() => {
      polls++;
      if (isExtensionReadyFlagSet()) {
        onReady();
        window.clearInterval(poll);
      } else if (polls >= 20) {
        window.clearInterval(poll);
      }
    }, 250);
    return () => {
      window.removeEventListener(EXTENSION_EVENTS.ready, onReady);
      window.clearInterval(poll);
    };
  }, []);

  // Listen for sync status from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<SyncStatusDetail>;
      if (e.detail && !e.detail.success) {
        if (Date.now() - lastDataAtRef.current < STALE_FAILURE_WINDOW_MS) {
          console.info("[Attendance] Ignoring sync failure from an overlapping request:", e.detail.error);
        } else {
          setSyncError(e.detail.error || "HROne didn't return any data.");
        }
      }
      finishSync();
    };
    window.addEventListener(EXTENSION_EVENTS.syncStatus, h);
    return () => window.removeEventListener(EXTENSION_EVENTS.syncStatus, h);
  }, [finishSync]);

  const resolveEmpId = useCallback((): number => {
    let empId = readEmpId();
    if (!empId && employeeProfile) empId = employeeProfile.employeeId;
    if (!empId && savedEntries.length > 0) {
      const firstRecord = savedEntries[0].records[0];
      if (firstRecord) empId = firstRecord.employeeId;
    }
    return empId || 0;
  }, [employeeProfile, savedEntries]);

  const startSync = useCallback((empId: number) => {
    writeString(EMP_ID_KEY, String(empId));
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
    dispatchSyncRequest({ employeeId: empId, month: syncMonth, year: syncYear });
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
      if (!isBookmarkletMessage(event)) return;
      const { records, userName: incomingName, profile, todayPunches, v } = event.data;
      handleDataParsed(records);
      if (incomingName) { setUserName(incomingName); }
      // Handle profile data
      if (profile) {
        setEmployeeProfile(profile);
      }
      // Track bookmarklet version
      if (v) {
        writeString(BOOKMARKLET_VERSION_KEY, v);
      }
      // Today's live attendance (bookmarklet parity with the extension).
      // Without this, todayAttendance stays null and the ProfilePanel always
      // shows "Last Working Day" even when today's punches exist in HROne.
      if (Array.isArray(todayPunches)) {
        const todayData = deriveTodayAttendance(todayPunches);
        if (todayData) {
          setTodayAttendance(todayData);
        }
      }
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [handleDataParsed]);

  const {
    attendanceData,
    enrichedRecords,
    dashboardMetrics,
    tableRecords,
    activeLabel,
    yesterdayRecord,
    effectiveTodayAttendance,
    todayShiftMinutes,
  } = useAttendanceMetrics({ entries: savedEntries, activeKey, today, todayAttendance, showAllDays });

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
      {/* Ambient Multi-Layer Atmospheric Canvas */}
      <AmbientBackground />

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
              onToggle={toggleTheme}
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
