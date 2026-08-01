import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { AttendanceRecord, DashboardMetrics, EnrichedRecord } from "./types";
import { classifyRecord } from "./utils/classifier";
import {
  computeRecordMetrics,
  computeAggregateMetrics,
  formatMinutes,
  parseHHMM,
} from "./utils/timeCalculator";
import Dashboard from "./components/Dashboard";
import DayTable from "./components/DayTable";

const STORAGE_KEY = "attendance-insights-data";
const USER_KEY = "attendance-insights-user";
const BOOKMARKLET_VERSION = "2";
const BOOKMARKLET_VERSION_KEY = "attendance-bookmarklet-version";

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

function YesterdaySummary({ records, allEntries }: { records: EnrichedRecord[]; allEntries: SavedEntry[] }) {
  const yesterday = getYesterdayDate();
  let rec = records.find((r) => r.attendanceDate === yesterday);
  if (!rec && allEntries.length > 0) {
    for (const entry of allEntries) {
      const match = entry.records.map((r) => ({ ...r, attendanceDate: r.attendanceDate.split("T")[0] })).find((r) => r.attendanceDate === yesterday);
      if (match) { rec = computeRecordMetrics(classifyRecord(match)); break; }
    }
  }
  if (!rec) {
    return (
      <div className="rounded-lg border border-hairline bg-cream p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">Yesterday</p>
        <p className="text-sm text-slate mt-1">No data for yesterday ({new Date(yesterday).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})</p>
      </div>
    );
  }

  const shift = parseHHMM(rec.shiftEndTime) - parseHHMM(rec.shiftStartTime);
  const ed = rec.extraDeficitMinutes;

  return (
    <div className="rounded-lg border border-beige-deep bg-cream p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">Yesterday</p>
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
        <p className="text-sm text-charcoal">{rec.status} — not a working day</p>
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
  const [bookmarkletOutdated, setBookmarkletOutdated] = useState(false);

  const appUrl = window.location.origin;
  const bookmarkletCode = `javascript:void((function(){var BV='${BOOKMARKLET_VERSION}';var u='${appUrl}';if(!location.hostname.includes('hrone.cloud')){alert('Run this on HROne portal');return}var y,m;try{var sel=document.querySelector('select[class*=month],select[class*=attendance],.ant-select-selection-item,[class*=CalendarDropdown] select');if(sel){var txt=sel.value||sel.textContent||sel.innerText;var parts=txt.match(/(\\w+)[,\\s]+(\\d{4})/);if(parts){var months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};m=months[parts[1].toLowerCase().substring(0,3)];y=parseInt(parts[2])}}if(!m||!y){var allText=document.body.innerText;var match=allText.match(/Attendance for[:\\s]*(\\w+)[,\\s]+(\\d{4})/i);if(match){var months2={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};m=months2[match[1].toLowerCase().substring(0,3)];y=parseInt(match[2])}}}catch(e){}if(!m||!y){var d=new Date();y=d.getFullYear();m=d.getMonth()+1}var eid=0;try{eid=parseInt(localStorage.getItem('attendance-empId'))||0;if(!eid){var keys=Object.keys(localStorage);for(var k=0;k<keys.length;k++){var v=localStorage.getItem(keys[k]);if(v&&v.indexOf('employeeId')>-1){try{var o=JSON.parse(v);eid=parseInt(o.employeeId||o.EmployeeId)||0}catch(e){}}if(eid)break}}if(!eid)eid=parseInt(prompt('Enter your Employee ID (find it in HROne profile):')||'0')}catch(e){eid=parseInt(prompt('Enter your Employee ID:')||'0')}if(!eid){alert('Employee ID required');return}localStorage.setItem('attendance-empId',String(eid));var userName='';try{var nameEl=document.body.innerText.match(/([A-Z][a-z]+ [A-Z][a-z]+)\\s*\\(#[A-Z0-9]+\\)/);if(nameEl)userName=nameEl[1];if(!userName){var h=document.querySelector('h1,h2,h3,.employee-name,.user-name,[class*=employeeName],[class*=userName]');if(h)userName=h.textContent.trim().split('(')[0].trim()}}catch(e){}fetch(location.origin+'/api/timeoffice/attendance/Calendar',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/plain, */*','domaincode':'mapmyindia','accessmode':'W','x-requested-with':location.origin,'cache-control':'no-cache','pragma':'no-cache'},credentials:'include',body:JSON.stringify({attendanceYear:y,attendanceMonth:m,employeeId:eid,calendarViewType:'C'})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(text){if(!text)throw new Error('Empty response');var data=JSON.parse(text);var records=Array.isArray(data)?data:(data.data||data.result||[]);if(!records.length){alert('No records found for '+m+'/'+y);return}var w=window.open(u,'attendance-insights');var i=0;var s=function(){i++;try{w.postMessage({type:'ATTENDANCE_DATA',records:records,userName:userName,employeeId:eid,v:BV},'*')}catch(e){}if(i<15)setTimeout(s,500)};setTimeout(s,1000)}).catch(function(e){alert('Error: '+e.message+'\\n\\nMake sure you are logged in to HROne.')})})())`;

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (bookmarkletRef.current) bookmarkletRef.current.setAttribute("href", bookmarkletCode); }, [bookmarkletCode]);

  const attendanceData = useMemo(() => {
    if (!activeKey) return null;
    return savedEntries.find((e) => e.key === activeKey)?.records ?? null;
  }, [activeKey, savedEntries]);

  useEffect(() => { saveTolocalStorage(savedEntries); }, [savedEntries]);

  const handleDataParsed = useCallback((data: AttendanceRecord[]) => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!data[0].attendanceDate) return;

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
  }, []);

  useEffect(() => {
    const h = (event: Event) => { const e = event as CustomEvent<{ records: AttendanceRecord[] }>; if (e.detail?.records) handleDataParsed(e.detail.records); };
    window.addEventListener("AttendanceDataFromExtension", h);
    return () => window.removeEventListener("AttendanceDataFromExtension", h);
  }, [handleDataParsed]);

  useEffect(() => {
    const h = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && !event.origin.includes("hrone.cloud")) return;
      if (event.data?.type === "ATTENDANCE_DATA" && Array.isArray(event.data.records)) {
        handleDataParsed(event.data.records);
        if (event.data.userName) { setUserName(event.data.userName); localStorage.setItem(USER_KEY, event.data.userName); }
        const incomingVersion = event.data.v;
        if (!incomingVersion || incomingVersion !== BOOKMARKLET_VERSION) {
          setBookmarkletOutdated(true);
          localStorage.setItem(BOOKMARKLET_VERSION_KEY, incomingVersion || "0");
        } else {
          setBookmarkletOutdated(false);
          localStorage.setItem(BOOKMARKLET_VERSION_KEY, incomingVersion);
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-canvas">
      {/* Nav */}
      <header className="bg-canvas border-b border-hairline-soft shrink-0">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-medium text-ink tracking-display">Attendance Insights</span>
            {userName && <span className="text-sm text-steel">/ {userName}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const html = document.documentElement;
                const newDark = !isDark;
                if (newDark) { html.classList.add("dark"); } else { html.classList.remove("dark"); }
                localStorage.setItem("theme", newDark ? "dark" : "light");
                setIsDark(newDark);
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-hairline-strong bg-canvas text-charcoal hover:bg-hairline-soft transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <a
              ref={bookmarkletRef}
              href="#"
              className="px-4 h-9 inline-flex items-center gap-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-deep transition-colors cursor-grab active:cursor-grabbing"
              onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar.\nThen click it on the HROne calendar page."); }}
            >
              Sync Attendance
              <span className="text-[10px] opacity-70 font-mono">v{BOOKMARKLET_VERSION}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Bookmarklet update banner */}
      {bookmarkletOutdated && (
        <div className="bg-cream border-b border-beige-deep px-6 py-2.5 flex items-center justify-between shrink-0">
          <p className="text-xs text-charcoal">
            Your bookmarklet is outdated. Drag the new <strong className="text-ink">Sync Attendance v{BOOKMARKLET_VERSION}</strong> button to update.
          </p>
          <button
            onClick={() => setBookmarkletOutdated(false)}
            className="text-steel hover:text-ink ml-4 shrink-0 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Toast notification */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-ink text-on-dark text-xs font-medium rounded-md shadow-card animate-[fadeIn_0.2s_ease-out]">
            {toast}
          </div>
        )}

        {/* Sidebar */}
        <aside className="w-52 bg-surface border-r border-hairline py-6 shrink-0 overflow-y-auto">
          <p className="px-5 text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">History</p>
          {savedEntries.length === 0 ? (
            <p className="px-5 text-sm text-stone">No data yet</p>
          ) : (
            <nav className="px-3 space-y-0.5">
              {savedEntries.slice().sort((a, b) => b.key.localeCompare(a.key)).map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setActiveKey(entry.key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeKey === entry.key
                      ? "bg-cream text-ink font-medium border border-beige-deep"
                      : "text-charcoal hover:text-ink hover:bg-hairline-soft"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </nav>
          )}
          {lastSynced && (
            <p className="px-5 mt-5 pt-4 border-t border-hairline text-[11px] text-stone">
              Last synced: {new Date(lastSynced).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 space-y-8 max-w-[1280px]">
            {!attendanceData ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
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
                        <p className="text-sm font-medium text-ink">Drag the button above to your bookmarks bar</p>
                        <p className="text-xs text-steel mt-0.5">Look for "Sync Attendance" in the top-right corner</p>
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
                  <div className="mt-6 pt-5 border-t border-beige-deep">
                    <p className="text-xs text-stone text-center">
                      Have the Chrome extension? Just visit HROne and data syncs automatically.
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
        </main>
      </div>
    </div>
  );
}

export default App;
