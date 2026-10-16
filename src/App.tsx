import { useState, useEffect, useCallback, useRef } from "react";
import type { AttendanceRecord, EmployeeProfile, SavedEntry, TodayAttendance } from "./types";
import { generateBookmarkletCode } from "./bookmarklet";
import Dashboard from "./components/Dashboard";
import DayTable from "./components/DayTable";
import ProfilePanel from "./components/ProfilePanel";
import TodayCard from "./components/TodayCard";
import PrivacyPage from "./components/PrivacyPage";
import AmbientBackground from "./components/AmbientBackground";
import TopBar from "./components/layout/TopBar";
import Toast from "./components/layout/Toast";
import EpisodeSidebar from "./components/layout/EpisodeSidebar";
import Onboarding from "./components/layout/Onboarding";
import EmployeeIdDialog from "./components/layout/EmployeeIdDialog";
import { SyncErrorNotice, UndoNotice } from "./components/layout/SyncNotices";
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
  localDateString,
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
  // Which day row the summary just jumped to in the table (brief highlight).
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | undefined>(undefined);
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

  // Jump from a summary card to the matching row in the month table.
  const handleLocateDay = useCallback((date: string) => {
    setHighlightDate(date);
    window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightDate(null), 2600);
    requestAnimationFrame(() => {
      const row = document.getElementById(`day-row-${date}`);
      if (!row) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    });
  }, []);

  // Clear the highlight timer if the app unmounts mid-highlight.
  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

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
      <AmbientBackground />

      <TopBar
        userName={userName}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        syncing={syncing}
        extensionAvailable={extensionAvailable}
        activeLabel={activeLabel}
        hasUpdate={hasUpdate}
        showOnboarding={showOnboarding}
        onToggleOnboarding={() => setShowOnboarding(!showOnboarding)}
        onSyncNow={handleSyncNow}
        clockPillRef={clockPillRef}
        todayAttendance={effectiveTodayAttendance}
        shiftMinutes={todayShiftMinutes}
        headerRef={headerRef}
      />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden mt-0">
        <Toast toast={toast} />

        <EpisodeSidebar sortedEntries={sortedEntries} activeKey={activeKey} onSelect={setActiveKey} />

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-hidden pt-10 top-aperture-fade">
          {showPrivacy ? (
            <PrivacyPage onBack={() => setShowPrivacy(false)} />
          ) : (
            <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 max-w-[1280px]">
              {syncError && (
                <SyncErrorNotice
                  error={syncError}
                  syncing={syncing}
                  extensionAvailable={extensionAvailable}
                  onRetry={handleSyncNow}
                  onDismiss={() => setSyncError(null)}
                />
              )}
              {undoEntry && (
                <UndoNotice
                  message={undoEntry.message}
                  onUndo={handleUndoResync}
                  onKeep={() => setUndoEntry(null)}
                />
              )}
              {(!attendanceData || showOnboarding) ? (
                <Onboarding
                  hasUpdate={hasUpdate}
                  showBack={showOnboarding && !!attendanceData}
                  onBack={() => { setShowOnboarding(false); setHasUpdate(false); }}
                  bookmarkletCode={bookmarkletCode}
                />
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
                  {dashboardMetrics && (
                    <Dashboard
                      metrics={dashboardMetrics}
                      isCurrentMonth={activeKey === today.slice(0, 7)}
                      onLocateDay={handleLocateDay}
                    />
                  )}

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
                        <DayTable records={tableRecords} highlightDate={highlightDate} />
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

export default App;
