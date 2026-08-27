import { useState, useEffect } from "react";
import type { EmployeeProfile, EnrichedRecord, TodayAttendance } from "../types";
import { formatMinutes, parseHHMM } from "../utils/timeCalculator";

interface ProfilePanelProps {
  profile: EmployeeProfile;
  yesterdayRecord: EnrichedRecord | null;
  todayAttendance: TodayAttendance | null;
}

export default function ProfilePanel({ profile, yesterdayRecord, todayAttendance }: ProfilePanelProps) {
  const initials = profile.employeeName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="w-64 shrink-0 border-l border-hairline bg-surface overflow-y-auto">
      <div className="sticky top-0 p-5 space-y-6">
        {/* Employee Card */}
        <div className="rounded-lg bg-cream border border-beige-deep p-5 text-center">
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

          <h3 className="font-display text-lg font-medium text-ink tracking-heading">
            {profile.employeeName}
          </h3>
          <p className="text-xs text-steel mt-0.5">{profile.employeeCode}</p>

          {profile.designation && (
            <p className="text-sm text-charcoal mt-2">{profile.designation}</p>
          )}
          {profile.department && (
            <p className="text-xs text-steel">{profile.department}</p>
          )}
        </div>

        {/* Profile Details */}
        <div className="space-y-3">
          {profile.email && (
            <ProfileField label="Email" value={profile.email} />
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

        {/* Today's Attendance (from raw punches) */}
        {todayAttendance ? (
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">Today</p>
            <TodayAttendanceLive todayAttendance={todayAttendance} />
          </div>
        ) : yesterdayRecord ? (
          <div className="rounded-lg border border-hairline bg-canvas p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">Last Working Day</p>
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
              <p className="text-xs text-slate">{yesterdayRecord.status} — not a working day</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function TodayAttendanceLive({ todayAttendance }: { todayAttendance: TodayAttendance }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // update every second
    return () => clearInterval(timer);
  }, []);

  // Compute worked so far live: from first punch to now
  const [h, m] = todayAttendance.firstPunch.split(":").map(Number);
  const firstPunchMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const workedSoFar = Math.max(0, nowMinutes - firstPunchMinutes);

  // Can leave at: first punch + 9 hours
  const leaveMinutes = firstPunchMinutes + 540;
  const leaveH = Math.floor(leaveMinutes / 60);
  const leaveM = leaveMinutes % 60;
  const canLeaveAt = `${String(leaveH).padStart(2, "0")}:${String(leaveM).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-xs text-steel">First Punch</span>
        <span className="text-xs font-mono text-ink">{todayAttendance.firstPunch}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-steel">Last Punch</span>
        <span className="text-xs font-mono text-ink">{todayAttendance.lastPunch}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-steel">Worked So Far</span>
        <span className="text-xs font-mono font-medium text-ink">{formatMinutes(workedSoFar)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-xs text-steel">Punches</span>
        <span className="text-xs text-ink">{todayAttendance.punchCount}</span>
      </div>
      <div className="flex justify-between pt-1 border-t border-hairline">
        <span className="text-xs text-steel">Can leave at</span>
        <span className="text-xs font-mono font-medium text-primary">{canLeaveAt}</span>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-steel uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink truncate" title={value}>{value}</p>
    </div>
  );
}
