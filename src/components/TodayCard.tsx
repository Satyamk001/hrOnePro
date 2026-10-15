import type { TodayAttendance } from "../types";
import { formatMinutes } from "../utils/timeCalculator";
import { leaveAtMinutes, minutesToHHMM } from "../utils/liveTime";
import { useNow } from "../hooks/useNow";

interface TodayCardProps {
  todayAttendance: TodayAttendance | null;
  /** Today's scheduled shift length in minutes (from HROne shift times). */
  shiftMinutes: number;
}

/** Live "Today" summary for the main column — ticks every second. */
export default function TodayCard({ todayAttendance, shiftMinutes }: TodayCardProps) {
  const now = useNow(1000);
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  if (!todayAttendance) {
    return (
      <div className="rounded-lg border border-hairline bg-cream p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">Today · {dateLabel}</p>
        <p className="text-sm text-slate mt-1">No punches recorded yet today. Sync after you punch in.</p>
      </div>
    );
  }

  const [h, m] = todayAttendance.firstPunch.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const workedSoFar = Math.max(0, nowMinutes - (h * 60 + m));
  const leaveMinutes = leaveAtMinutes(todayAttendance.firstPunch, shiftMinutes);
  const canLeaveAt = leaveMinutes === null ? "—" : minutesToHHMM(leaveMinutes);
  const remaining = leaveMinutes === null ? null : leaveMinutes - nowMinutes;

  return (
    <div className="rounded-lg border border-beige-deep bg-cream p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-steel">Today · {dateLabel}</p>
        {todayAttendance.isStillIn && (
          <span className="text-xs font-medium text-charcoal bg-cream-deeper px-2 py-0.5 rounded-full">
            Punched in
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        <Stat label="First Punch" value={todayAttendance.firstPunch} mono />
        <Stat label="Last Punch" value={todayAttendance.lastPunch} mono />
        <Stat label="Worked So Far" value={formatMinutes(workedSoFar)} mono />
        <Stat label="Punches" value={String(todayAttendance.punchCount)} />
        <Stat label="Shift" value={formatMinutes(shiftMinutes)} mono />
        <Stat
          label="Can Leave At"
          value={canLeaveAt}
          mono
          color="text-primary"
          sub={remaining === null ? undefined : remaining > 0 ? `${formatMinutes(remaining)} left` : `+${formatMinutes(-remaining)} extra`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, mono, color, sub }: { label: string; value: string; mono?: boolean; color?: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] text-steel uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${color || "text-ink"}`}>{value}</p>
      {sub && <p className="text-[10px] text-steel mt-0.5">{sub}</p>}
    </div>
  );
}
