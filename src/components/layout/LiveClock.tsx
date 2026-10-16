import type { TodayAttendance } from "../../types";
import { formatMinutes } from "../../utils/timeCalculator";
import { leaveAtMinutes, minutesToHHMM } from "../../utils/liveTime";
import { useNow } from "../../hooks/useNow";
import AnimatedCounter from "../ui/AnimatedCounter";

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

/**
 * The center pill: live clock, compact "time left" status, and the expanded
 * today-summary metrics that reveal as the clock pill absorbs the Today card.
 */
export default function LiveClock({ todayAttendance, shiftMinutes }: { todayAttendance: TodayAttendance | null; shiftMinutes: number }) {
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
