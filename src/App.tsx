import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { AttendanceRecord, DashboardMetrics, EnrichedRecord, EmployeeProfile, TodayAttendance, RawPunch } from "./types";
import { classifyRecord } from "./utils/classifier";
import {
  computeRecordMetrics,
  computeAggregateMetrics,
  formatMinutes,
  parseHHMM,
} from "./utils/timeCalculator";
import { generateBookmarkletCode } from "./bookmarklet";
import Dashboard from "./components/Dashboard";
import DayTable from "./components/DayTable";
import ProfilePanel from "./components/ProfilePanel";
import PrivacyPage from "./components/PrivacyPage";
import { GlassToggle } from "./components/ui/GlassToggle";
import { SplashButton } from "./components/ui/SplashButton";
import { ClickRipple } from "./components/ui/ClickRipple";
import AnimatedCounter from "./components/ui/AnimatedCounter";

const STORAGE_KEY = "attendance-insights-data";
const USER_KEY = "attendance-insights-user";
const PROFILE_KEY = "attendance-insights-profile";
const BOOKMARKLET_VERSION = "3";
const BOOKMARKLET_VERSION_KEY = "attendance-bookmarklet-version";
const EXTENSION_VERSION = "2.0.0";
const EXTENSION_VERSION_KEY = "attendance-extension-version";
const APP_VERSION_KEY = "attendance-app-version";
const APP_VERSION = "1.4.0"; // Bump this on each release
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

function loadSavedEntries(): SavedEntry[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveTolocalStorage(entries: SavedEntry[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

function getYesterdayDate(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0];
}

const NON_WORKING_STATUSES = new Set(["Week Off", "Holiday"]);

/** Walk backwards from yesterday up to 7 days to find the most recent working day record */
function findLastWorkingDayRecord(
  enrichedRecords: EnrichedRecord[] | null,
  allEntries: SavedEntry[]
): { record: EnrichedRecord; date: string; daysAgo: number } | null {
  for (let daysBack = 1; daysBack <= 7; daysBack++) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dateStr = d.toISOString().split("T")[0];

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

function YesterdaySummary({ records, allEntries }: { records: EnrichedRecord[]; allEntries: SavedEntry[] }) {
  const result = findLastWorkingDayRecord(records, allEntries);
  if (!result) {
    const yesterday = getYesterdayDate();
    return (
      <div className="rounded-lg border border-hairline bg-cream p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">Last Working Day</p>
        <p className="text-sm text-slate mt-1">No recent working day data ({new Date(yesterday).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})</p>
      </div>
    );
  }

  const rec = result.record;
  const dateLabel = new Date(result.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const shift = parseHHMM(rec.shiftEndTime) - parseHHMM(rec.shiftStartTime);
  const ed = rec.extraDeficitMinutes;

  return (
    <div className="rounded-lg border border-beige-deep bg-cream p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">
          {result.daysAgo === 1 ? "Yesterday" : dateLabel}
        </p>
        <span className="text-xs font-medium text-charcoal bg-cream-deeper px-2 py-0.5 rounded-full">{rec.status}</span>
      </div>
      {rec.isWorkedDay ? (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          <Stat label="In" value={rec.timeIn ?? "—"} mono />
          <Stat label="Out" value={rec.timeout ?? "—"} mono />
          <Stat label="Worked" value={formatMinutes(rec.workedMinutes)} mono />
          <Stat label="Shift" value={formatMinutes(shift)} mono />
          <Stat
            label="+/− Shift"
            value={`${ed < 0 ? "-" : "+"}${formatMinutes(Math.abs(ed))}`}
            mono
            color={ed > 0 ? "text-primary" : ed < 0 ? "text-error" : undefined}
          />
          <Stat label="Late" value={rec.isLateArrival ? "Yes" : "No"} color={rec.isLateArrival ? "text-warning" : undefined} />
        </div>
      ) : (
        <p className="text-sm text-charcoal">
          {rec.status === "Absent"
            ? "Absent — no attendance recorded"
            : rec.status === "Flexi Leave" || rec.status === "Earned Leave" || rec.status === "Leave"
            ? `${rec.status} — on leave`
            : `${rec.status} — not a working day`}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-steel uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${color || "text-ink"}`}>{value}</p>
    </div>
  );
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

function LiveClock({ todayAttendance }: { todayAttendance: TodayAttendance | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Calculate time left if we have today's punch data
  let timeLeftDisplay: string | null = null;
  let shiftComplete = false;

  if (todayAttendance && todayAttendance.firstPunch) {
    const [h, m] = todayAttendance.firstPunch.split(":").map(Number);
    const leaveMinutes = h * 60 + m + 540; // first punch + 9 hours
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

  return (
    <>
      {/* Clock icon */}
      <svg className="w-3.5 h-3.5 text-steel shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-sm font-semibold text-ink tabular-nums inline-flex items-center">
        <PaddedCounter value={hours} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
        <span className="text-steel">:</span>
        <PaddedCounter value={minutes} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
        <span className="text-steel">:</span>
        <PaddedCounter value={seconds} duration={0.3} continuous separator={false} className="text-sm font-mono text-ink" />
      </span>
      {timeLeftDisplay && (
        <>
          <div className="w-px h-4 bg-hairline" />
          <span className={`text-xs font-medium ${shiftComplete ? "text-success" : "text-primary"}`}>
            {timeLeftDisplay}
          </span>
        </>
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
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_KEY) || "");
  const [showAllDays, setShowAllDays] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [toast, setToast] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(() => localStorage.getItem("attendance-last-synced"));
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
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

  const appUrl = window.location.origin;
  const bookmarkletCode = generateBookmarkletCode(appUrl, BOOKMARKLET_VERSION);

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (bookmarkletRef.current) bookmarkletRef.current.setAttribute("href", bookmarkletCode); }, [bookmarkletCode]);

  // Center-focus the active history item when selection changes
  const activeItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeKey]);

  const attendanceData = useMemo(() => {
    if (!activeKey) return null;
    return savedEntries.find((e) => e.key === activeKey)?.records ?? null;
  }, [activeKey, savedEntries]);

  useEffect(() => { saveTolocalStorage(savedEntries); }, [savedEntries]);

  const handleDataParsed = useCallback((data: AttendanceRecord[]) => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!data[0].attendanceDate) return;

    // Save employee ID for future Sync Now use
    if (data[0].employeeId) {
      localStorage.setItem("attendance-empId", String(data[0].employeeId));
    }

    const normalized = normalizeRecords(data);
    const monthKey = deriveMonthKey(normalized);
    const label = formatMonthLabel(monthKey);
    setSavedEntries((prev) => {
      const idx = prev.findIndex((e) => e.key === monthKey);
      if (idx >= 0) { const u = [...prev]; u[idx] = { label, key: monthKey, records: normalized }; return u; }
      return [...prev, { label, key: monthKey, records: normalized }];
    });
    setActiveKey(monthKey);

    const now = new Date().toISOString();
    setLastSynced(now);
    localStorage.setItem("attendance-last-synced", now);

    setToast(`Synced ${label} — ${normalized.length} days`);
    setTimeout(() => setToast(null), 3000);
    setSyncing(false);
  }, []);

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
      if (e.detail?.punches && e.detail.punches.length > 0) {
        const punches = e.detail.punches
          .filter(p => !p.isPunchExcluded)
          .sort((a, b) => a.punchDateTime.localeCompare(b.punchDateTime));
        if (punches.length > 0) {
          const firstPunch = punches[0].punchDateTime;
          const lastPunch = punches[punches.length - 1].punchDateTime;
          const firstTime = new Date(firstPunch);
          const lastTime = new Date(lastPunch);
          const now = new Date();
          // Worked so far = from first punch to now (regardless of how many punches)
          const workedMs = now.getTime() - firstTime.getTime();
          const workedMinutesSoFar = Math.max(0, Math.floor(workedMs / 60000));
          // Still in if odd number of punches
          const isStillIn = punches.length % 2 !== 0;

          setTodayAttendance({
            date: firstPunch.split("T")[0],
            firstPunch: firstTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
            lastPunch: lastTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
            punchCount: punches.length,
            workedMinutesSoFar,
            isStillIn,
          });
        }
      }
    };
    window.addEventListener("TodayPunchesFromExtension", h);
    return () => window.removeEventListener("TodayPunchesFromExtension", h);
  }, []);

  // Detect extension availability
  useEffect(() => {
    const onReady = () => {
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
      if (empId) {
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
    return () => window.removeEventListener("AttendanceExtensionReady", onReady);
  }, []);

  // Listen for sync status from extension
  useEffect(() => {
    const h = (event: Event) => {
      const e = event as CustomEvent<{ success: boolean; error?: string }>;
      if (e.detail && !e.detail.success && e.detail.error) {
        setToast(`Sync failed: ${e.detail.error}`);
        setTimeout(() => setToast(null), 4000);
      }
      setSyncing(false);
    };
    window.addEventListener("ExtensionSyncStatus", h);
    return () => window.removeEventListener("ExtensionSyncStatus", h);
  }, []);

  // Sync Now handler
  const handleSyncNow = useCallback(() => {
    // Try to get employee ID from: localStorage, stored profile, or existing records
    let empId = parseInt(localStorage.getItem("attendance-empId") || "0");
    if (!empId && employeeProfile) empId = employeeProfile.employeeId;
    if (!empId && savedEntries.length > 0) {
      const firstRecord = savedEntries[0].records[0];
      if (firstRecord) empId = firstRecord.employeeId;
    }
    if (!empId) {
      const input = prompt("Enter your Employee ID (find it in your HROne profile):");
      empId = parseInt(input || "0");
      if (!empId) {
        setToast("Employee ID is required for syncing.");
        setTimeout(() => setToast(null), 4000);
        return;
      }
    }
    localStorage.setItem("attendance-empId", String(empId));
    const now = new Date();
    setSyncing(true);
    window.dispatchEvent(new CustomEvent("RequestAttendanceSync", {
      detail: { employeeId: empId, month: now.getMonth() + 1, year: now.getFullYear() }
    }));
    // Timeout fallback — if no response in 15s
    setTimeout(() => setSyncing(false), 15000);
  }, [employeeProfile, savedEntries]);

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
    const result = findLastWorkingDayRecord(enrichedRecords, savedEntries);
    return result ? result.record : null;
  }, [enrichedRecords, savedEntries]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-canvas relative">
      {/* Glassmorphism Three-Pill Navigation */}
      <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 sm:gap-5 lg:gap-8 pointer-events-auto">

          {/* Pill 1 — Brand / User (Left) */}
          <div className="glass-pill flex items-center gap-2.5 px-4 sm:px-5 py-2.5 min-w-0">
            <span className="font-display text-base sm:text-lg font-semibold text-ink tracking-display truncate">
              Attendance Insights
            </span>
            {userName && (
              <span className="text-xs sm:text-sm text-steel font-normal truncate">
                / {userName}
              </span>
            )}
          </div>

          {/* Pill 2 — Time / Status (Center) */}
          <div className="glass-pill flex items-center gap-2.5 px-4 py-2.5 shrink-0">
            <LiveClock todayAttendance={todayAttendance} />
          </div>

          {/* Pill 3 — Actions (Right) */}
          <div className="glass-pill flex items-center gap-2 px-3 py-2.5 shrink-0">
            {/* Help button */}
            <ClickRipple>
              <button
                onClick={() => setShowOnboarding(!showOnboarding)}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg text-charcoal hover:text-ink hover:bg-hairline-soft/50 transition-all duration-200 relative ${showOnboarding ? "text-primary" : ""}`}
                aria-label="Setup & Downloads"
                title="Setup & Downloads"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {hasUpdate && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </button>
            </ClickRipple>

            {/* Divider */}
            <div className="w-px h-5 bg-hairline" />

            {/* Theme toggle */}
            <GlassToggle
              isDark={isDark}
              width={56}
              height={28}
              orbSize={24}
              onToggle={() => {
                const html = document.documentElement;
                const newDark = !isDark;
                if (newDark) { html.classList.add("dark"); } else { html.classList.remove("dark"); }
                localStorage.setItem("theme", newDark ? "dark" : "light");
                setIsDark(newDark);
              }}
            />

            {/* Divider */}
            <div className="w-px h-5 bg-hairline" />

            {/* Sync button */}
            <SplashButton
              onClick={handleSyncNow}
              disabled={syncing || !extensionAvailable}
              title={extensionAvailable ? "Fetch latest data from HROne" : "Install the extension to use Sync"}
              text={syncing ? "Syncing…" : "Sync"}
              width={100}
              height={34}
              fontSize={13}
            />
          </div>

        </div>
      </header>

      <div className="flex flex-1 overflow-hidden pt-14">
        {/* Toast notification */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-ink text-canvas text-xs font-medium rounded-full shadow-card animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Sidebar — Cinematic episode selector */}
        <aside className="w-56 bg-surface shrink-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 flex flex-col gap-y-2 px-4 py-4 bg-surface/80 backdrop-blur-xl border-b border-hairline">
            <h1 className="text-[14px] font-bold text-ink">History</h1>
          </div>
          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {savedEntries.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate text-center">No data yet</p>
            ) : (
              <div
                className="w-full h-full overflow-y-scroll overflow-x-hidden scrollbar-hidden flex flex-col items-center"
                style={{ paddingTop: '40%', paddingBottom: '40%', overscrollBehavior: 'contain' }}
              >
                <div className="flex flex-col items-center w-full gap-y-2">
                  {savedEntries.slice().sort((a, b) => b.key.localeCompare(a.key)).map((entry, index) => {
                    const isActive = activeKey === entry.key;
                    const sortedEntries = savedEntries.slice().sort((a, b) => b.key.localeCompare(a.key));
                    const activeIndex = sortedEntries.findIndex(e => e.key === activeKey);
                    const distance = Math.abs(index - activeIndex);

                    // Distance-based scale + opacity (matching the reference pattern)
                    let scale = 1.05;
                    let opacity = 1;
                    let zIndex = 100;

                    if (!isActive) {
                      if (distance === 1) { scale = 0.95; opacity = 0.6; zIndex = 49; }
                      else if (distance === 2) { scale = 0.88; opacity = 0.35; zIndex = 48; }
                      else if (distance === 3) { scale = 0.82; opacity = 0.2; zIndex = 47; }
                      else { scale = 0.78; opacity = 0.1; zIndex = Math.max(20, 46 - distance); }
                    }

                    return (
                      <button
                        key={entry.key}
                        ref={isActive ? activeItemRef : undefined}
                        onClick={() => setActiveKey(entry.key)}
                        className="cursor-pointer transition-all duration-300 ease-out will-change-transform"
                        style={{
                          zIndex,
                          transform: `scale(${scale})`,
                          transformOrigin: 'center center',
                          opacity,
                          width: '72%',
                          maxWidth: '200px',
                        }}
                      >
                        <div className={`relative rounded-lg overflow-hidden border transition-colors duration-300 w-full ${
                          isActive
                            ? "border-primary shadow-lg shadow-primary/20"
                            : "border-hairline hover:border-hairline-strong"
                        }`}>
                          <div className={`px-3 py-2 flex items-start gap-x-2.5 w-full min-w-0 ${
                            isActive ? "bg-primary/20" : "bg-canvas/50"
                          }`}>
                            {/* Number badge */}
                            <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-bold text-[12px] mt-0.5 ${
                              isActive
                                ? "bg-primary text-white"
                                : "bg-hairline-soft text-steel"
                            }`}>
                              {index + 1}
                            </div>
                            {/* Title + date */}
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <h4 className={`text-[12px] font-semibold leading-snug transition-all duration-300 ${
                                isActive
                                  ? "whitespace-normal break-words text-ink"
                                  : "truncate text-slate"
                              }`}>
                                {entry.label}
                              </h4>
                              <p className="text-[10px] text-stone mt-0.5 truncate">
                                {entry.key}
                              </p>
                            </div>
                          </div>
                          {/* Progress bar — only on active */}
                          {isActive && (
                            <div className="h-[3px] w-full bg-hairline">
                              <div className="h-full bg-primary" style={{ width: '100%' }} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Footer */}
          <div className="shrink-0 px-4 py-3 border-t border-hairline">
            {lastSynced && (
              <p className="text-[10px] text-stone mb-1">
                Last synced: {new Date(lastSynced).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-[10px] text-steel hover:text-slate transition-colors"
            >
              Privacy & Data Safety
            </button>
            <p className="mt-0.5 text-[9px] text-muted font-mono">v{APP_VERSION}</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto scrollbar-hidden">
          {showPrivacy ? (
            <PrivacyPage onBack={() => setShowPrivacy(false)} />
          ) : (
          <div className="px-8 py-8 space-y-8 max-w-[1280px]">
            {(!attendanceData || showOnboarding) ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {showOnboarding && attendanceData && (
                  <button
                    onClick={() => { setShowOnboarding(false); setHasUpdate(false); }}
                    className="mb-6 text-sm text-link hover:underline font-medium"
                  >
                    ← Back to dashboard
                  </button>
                )}
                {hasUpdate && (
                  <div className="mb-6 px-5 py-3 rounded-lg bg-cream border border-beige-deep text-sm text-charcoal">
                    <strong className="text-ink">Update available!</strong> Download the latest extension (v{EXTENSION_VERSION}) and re-drag the bookmarklet (v{BOOKMARKLET_VERSION}).
                  </div>
                )}
                <div className="mb-10">
                  <h2 className="font-display text-4xl font-medium text-ink tracking-display mb-3">
                    Know your hours in seconds
                  </h2>
                  <p className="text-base text-slate max-w-md leading-relaxed">
                    See overtime, shortfall, and net balance from your HROne attendance — no manual calculation needed.
                  </p>
                </div>

                <div className="rounded-lg bg-cream border border-beige-deep p-8 max-w-lg w-full text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-5">
                    Get started in 30 seconds
                  </p>
                  <div className="space-y-5">
                    <div className="flex gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">1</span>
                      <div>
                        <p className="text-sm font-medium text-ink">Drag this button to your bookmarks bar:</p>
                        <a
                          ref={bookmarkletRef}
                          href="#"
                          className="mt-2 px-4 py-2 inline-flex items-center gap-2 bg-primary text-white rounded-md text-sm font-medium cursor-grab active:cursor-grabbing"
                          onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar.\nThen click it on the HROne calendar page."); }}
                        >
                          Sync Attendance
                          <span className="text-[10px] opacity-70 font-mono">v{BOOKMARKLET_VERSION}</span>
                        </a>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">2</span>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          Open{" "}
                          <a href="https://app.hrone.cloud/app/myprofile/calendar" target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
                            HROne Calendar
                          </a>
                        </p>
                        <p className="text-xs text-steel mt-0.5">Log in if needed, then select the month you want</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">3</span>
                      <div>
                        <p className="text-sm font-medium text-ink">Click the bookmark — data appears here</p>
                        <p className="text-xs text-steel mt-0.5">First time you'll enter your Employee ID (from your HROne profile)</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-beige-deep text-center space-y-2">
                    <a
                      href="/attendance-extension.zip"
                      download="attendance-extension.zip"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-hairline-strong bg-canvas text-ink rounded-md text-sm font-medium hover:bg-hairline-soft transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download Extension
                    </a>
                    <p className="text-[11px] text-stone">
                      Unzip → chrome://extensions → Developer mode → Load unpacked
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {activeLabel && (
                  <h2 className="font-display text-3xl font-medium text-ink tracking-display">{activeLabel}</h2>
                )}

                {enrichedRecords && <YesterdaySummary records={enrichedRecords} allEntries={savedEntries} />}
                {dashboardMetrics && <Dashboard metrics={dashboardMetrics} />}

                {tableRecords && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">
                        {showAllDays ? "All Days" : "Worked Days"}
                      </p>
                      <button
                        onClick={() => setShowAllDays(!showAllDays)}
                        className="text-sm text-link hover:underline font-medium"
                      >
                        {showAllDays ? "Show worked only" : "Show all days"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-hairline overflow-hidden bg-canvas shadow-card">
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
            todayAttendance={todayAttendance}
          />
        )}
      </div>
    </div>
  );
}

export default App;
