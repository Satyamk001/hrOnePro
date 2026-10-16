import { useState, useEffect } from "react";
import type { EmployeeProfile, EnrichedRecord } from "../types";
import { formatMinutes, parseHHMM } from "../utils/timeCalculator";
import { localDateDaysAgo } from "../utils/liveTime";
import { useNow } from "../hooks/useNow";
import { BlurReveal } from "./ui/BlurReveal";
import { GlowCard } from "./ui/GlowCard";

interface ProfilePanelProps {
  profile: EmployeeProfile;
  /** Most recent working day before today (shown as the "Yesterday" card). */
  yesterdayRecord: EnrichedRecord | null;
  appVersion: string;
  /** Drawer state below the `lg` breakpoint; ignored on desktop. */
  open: boolean;
  onClose: () => void;
  onOpenPrivacy: () => void;
}

export default function ProfilePanel({ profile, yesterdayRecord, appVersion, open, onClose, onOpenPrivacy }: ProfilePanelProps) {
  // Re-render at midnight so the "Yesterday" label stays correct.
  const now = useNow(30000);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const initials = profile.employeeName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
    {/* Backdrop — drawer mode only (< lg) */}
    {open && <div className="lg:hidden fixed inset-0 z-40 dialog-backdrop" onClick={onClose} aria-hidden="true" />}
    <aside
      id="profile-panel"
      aria-label="Profile and yesterday's attendance"
      className={`w-72 max-w-[85vw] shrink-0 flex flex-col overflow-hidden bg-canvas
        fixed top-0 right-0 bottom-0 z-50 shadow-card transition-transform duration-300 motion-reduce:transition-none
        ${open ? "translate-x-0" : "translate-x-full max-lg:invisible"}
        lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:bg-transparent lg:max-w-none lg:mt-14 lg:h-[calc(100%-3.5rem)]`}
    >
      <div className="lg:hidden flex justify-end px-3 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile panel"
          className="p-2 rounded-md text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Employee Card */}
        <GlowCard className="rounded-lg p-5 text-center">
          {/* Avatar */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-3">
            {profile.profileImageUrl ? (
              <img
                src={profile.profileImageUrl}
                alt={profile.employeeName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-white">{initials}</span>
            )}
          </div>

          <BlurReveal
            text={profile.employeeName}
            className="font-display text-lg font-medium text-ink tracking-heading justify-center"
          />
          <p className="text-xs text-steel mt-0.5">{profile.employeeCode}</p>

          {profile.designation && (
            <p className="text-sm text-charcoal mt-2">{profile.designation}</p>
          )}
          {profile.department && (
            <p className="text-xs text-steel">{profile.department}</p>
          )}
        </GlowCard>

        {/* Profile Details */}
        <div className="space-y-3">
          {profile.email && (
            <ProfileField label="Email" value={profile.email} copyable />
          )}
          {profile.dateOfJoining && (
            <ProfileField
              label="Joined"
              value={new Date(profile.dateOfJoining).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            />
          )}
          {profile.reportingManager && (
            <ProfileField label="Reports to" value={profile.reportingManager} />
          )}
        </div>

        {/* Last working day (Today lives in the main column) */}
        {yesterdayRecord ? (
          <div className="rounded-lg border border-hairline p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">
              {yesterdayRecord.attendanceDate === localDateDaysAgo(1, now)
                ? "Yesterday"
                : `Last Working Day · ${new Date(yesterdayRecord.attendanceDate + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
            </p>
            {yesterdayRecord.isWorkedDay ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-steel">Status</span>
                  <span className="text-xs font-medium text-ink">{yesterdayRecord.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-steel">In</span>
                  <span className="text-xs font-mono text-ink">{yesterdayRecord.timeIn ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-steel">Out</span>
                  <span className="text-xs font-mono text-ink">{yesterdayRecord.timeout ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-steel">Worked</span>
                  <span className="text-xs font-mono text-ink">{formatMinutes(yesterdayRecord.workedMinutes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-steel">Shift</span>
                  <span className="text-xs font-mono text-ink">
                    {formatMinutes(parseHHMM(yesterdayRecord.shiftEndTime) - parseHHMM(yesterdayRecord.shiftStartTime))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-steel">+/− Shift</span>
                  <span className={`text-xs font-mono font-medium ${
                    yesterdayRecord.extraDeficitMinutes > 0 ? "text-primary" :
                    yesterdayRecord.extraDeficitMinutes < 0 ? "text-error" : "text-ink"
                  }`}>
                    {yesterdayRecord.extraDeficitMinutes < 0 ? "-" : "+"}
                    {formatMinutes(Math.abs(yesterdayRecord.extraDeficitMinutes))}
                  </span>
                </div>
                {yesterdayRecord.isLateArrival && (
                  <div className="flex justify-between">
                    <span className="text-xs text-steel">Late</span>
                    <span className="text-xs font-medium text-warning">Yes</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate">
                {yesterdayRecord.status === "Absent"
                  ? "Absent — no attendance recorded"
                  : yesterdayRecord.status === "Flexi Leave" || yesterdayRecord.status === "Earned Leave" || yesterdayRecord.status === "Leave"
                    ? `${yesterdayRecord.status} — on leave`
                    : `${yesterdayRecord.status} — not a working day`}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-hairline p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-1">Yesterday</p>
            <p className="text-xs text-slate">No working day in the last 7 days.</p>
          </div>
        )}

      </div>

      <div className="p-5 pt-4 border-t border-hairline/50 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={onOpenPrivacy}
            className="text-xs font-medium text-steel hover:text-ink transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Privacy & Data Safety
          </button>
          <span className="text-[10px] text-stone font-mono">v{appVersion}</span>
        </div>
      </div>
    </aside>
    </>
  );
}

function ProfileField({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for insecure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!copyable) {
    return (
      <div>
        <p className="text-[10px] text-steel uppercase tracking-wide">{label}</p>
        <p className="text-sm text-ink truncate" title={value}>{value}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-steel uppercase tracking-wide">{label}</p>
        <span
          className={`text-[10px] font-medium transition-opacity ${copied ? "text-primary opacity-100" : "opacity-0"}`}
          aria-hidden={!copied}
        >
          Copied
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title={`Click to copy ${label.toLowerCase()}`}
        aria-label={`Copy ${label.toLowerCase()}: ${value}`}
        className="group w-full text-left text-sm text-ink hover:text-primary transition-colors [overflow-wrap:anywhere] cursor-pointer"
      >
        {value}
      </button>
    </div>
  );
}
