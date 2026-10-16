import type { ReactNode } from "react";
import type { AggregateMetrics, DayExtreme } from "../types";
import { formatMinutes } from "../utils/timeCalculator";

interface DashboardProps {
  metrics: AggregateMetrics;
  /** True when the selected month is the current calendar month. */
  isCurrentMonth: boolean;
  /** Scroll to a day's row in the month table and highlight it. */
  onLocateDay: (date: string) => void;
}

/** "Fri, Oct 9" — short human date, parsed at local midnight to avoid TZ drift. */
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "9h" / "9h 30m" — compact shift length for inline copy. */
function formatShift(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : formatMinutes(minutes);
}

/** "7 min" under an hour, "1h 12m" above — compact pace deltas. */
function formatDelta(minutes: number): string {
  const abs = Math.abs(minutes);
  return abs < 60 ? `${abs} min` : formatMinutes(abs);
}

export default function Dashboard({ metrics, isCurrentMonth, onLocateDay }: DashboardProps) {
  const netBalanceMinutes = metrics.totalExtraMinutes - metrics.totalShortfallMinutes;
  const isPositive = netBalanceMinutes > 0;
  const isNegative = netBalanceMinutes < 0;
  const hasWorkedDays = metrics.workedDayCount > 0;

  // Pending counts scheduled days not worked yet, so for the current month it
  // is the runway left to fix the balance.
  const daysLeft = metrics.statusCounts["Pending"];
  const isMidMonth = isCurrentMonth && hasWorkedDays && daysLeft > 0;
  const paceMinutesPerDay = isMidMonth ? Math.ceil(Math.abs(netBalanceMinutes) / daysLeft) : 0;

  // Mid-month months get runway + pace; finished months get the verdict.
  const heroState = !hasWorkedDays
    ? "empty"
    : isMidMonth
    ? isNegative
      ? "behind"
      : isPositive
      ? "ahead"
      : "on-pace"
    : "final";

  const chip: { label: string; dot: string } | null = {
    behind: { label: "Behind", dot: "bg-error" },
    ahead: { label: "Ahead", dot: "bg-success" },
    "on-pace": { label: "On track", dot: "bg-steel" },
    final: { label: "Final", dot: "bg-steel" },
    empty: null,
  }[heroState];

  const daysLeftLabel = `${daysLeft} working day${daysLeft === 1 ? "" : "s"} left`;
  const heroSentence = {
    empty: isCurrentMonth ? "No worked days recorded yet." : "No worked days recorded this month.",
    behind: `${daysLeftLabel} — ${paceMinutesPerDay} min/day extra to break even.`,
    ahead: `${daysLeftLabel} — ${paceMinutesPerDay} min/day to spare.`,
    "on-pace": `${daysLeftLabel} — exactly on target.`,
    final: isPositive
      ? "You have time in hand this month."
      : isNegative
      ? "You're short this month."
      : "Exactly on target.",
  }[heroState];

  const netBalanceSign = isPositive ? "+" : isNegative ? "\u2212" : "";
  const heroColor = isPositive
    ? "text-sunshine-900 dark:text-primary"
    : isNegative
    ? "text-error"
    : "text-ink";

  const leaveCount =
    metrics.statusCounts["Leave"] +
    metrics.statusCounts["Flexi Leave"] +
    metrics.statusCounts["Earned Leave"];
  const hrOneDiffers = metrics.totalHrOneMinutes !== metrics.totalWorkingMinutes;
  const averageDelta = metrics.averageWorkMinutes - metrics.standardShiftMinutes;
  const averageSub =
    averageDelta === 0
      ? `matches the ${formatShift(metrics.standardShiftMinutes)} shift`
      : `${formatDelta(averageDelta)} ${averageDelta > 0 ? "over" : "under"} the ${formatShift(metrics.standardShiftMinutes)} shift`;

  return (
    <section aria-label="Month summary" className="space-y-6">
      {/* Hero: Net Balance */}
      <div className="rounded-lg border border-beige-deep bg-cream p-8 shadow-card dark:shadow-none">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">Net Balance</p>
          {chip && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-beige-deep px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-charcoal">
              <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} aria-hidden="true" />
              {chip.label}
            </span>
          )}
        </div>
        <p className={`font-display text-5xl font-medium tracking-display tabular-nums ${heroColor}`}>
          {netBalanceSign}
          {formatMinutes(Math.abs(netBalanceMinutes))}
        </p>
        <p className="text-sm text-charcoal mt-3">{heroSentence}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 mt-5 pt-5 border-t border-beige-deep">
          <HeroStat label="Overtime" value={formatMinutes(metrics.totalExtraMinutes)} />
          <HeroStat label="Shortfall" value={formatMinutes(metrics.totalShortfallMinutes)} />
          <HeroStat label="Average / Day" value={formatMinutes(metrics.averageWorkMinutes)} />
          <HeroStat
            label="Total Hours"
            value={formatMinutes(metrics.totalWorkingMinutes)}
            note={hrOneDiffers ? `HROne reports ${formatMinutes(metrics.totalHrOneMinutes)}` : undefined}
          />
        </div>
      </div>

      {/* The month in three clusters: how much calendar is left, what came out
          of it, and whether anything went off-track. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricGroup label="Month">
          <MetricRow
            label={isCurrentMonth ? "Days Left" : "Pending"}
            value={String(daysLeft)}
            sub={`of ${metrics.scheduledWorkingDays} scheduled days`}
          />
          <MetricRow label="Week Off" value={String(metrics.statusCounts["Week Off"])} />
          <MetricRow label="Holiday" value={String(metrics.statusCounts["Holiday"])} />
          <MetricRow label="Leave" value={String(leaveCount)} />
        </MetricGroup>

        <MetricGroup label="Output">
          <MetricRow
            label="Worked Days"
            value={String(metrics.workedDayCount)}
            sub={`of ${metrics.scheduledWorkingDays} scheduled days`}
          />
          <MetricRow
            label="Total Hours"
            value={formatMinutes(metrics.totalWorkingMinutes)}
            sub={hrOneDiffers ? `HROne reports ${formatMinutes(metrics.totalHrOneMinutes)}` : undefined}
          />
          <MetricRow
            label="Average / Day"
            value={formatMinutes(metrics.averageWorkMinutes)}
            sub={averageSub}
          />
        </MetricGroup>

        <MetricGroup label="Discipline">
          <MetricRow
            label="Late"
            value={String(metrics.lateCount)}
            sub={
              metrics.lateCount === 0
                ? hasWorkedDays && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                      No late days
                    </span>
                  )
                : `${metrics.latePercentage.toFixed(1)}% of worked days`
            }
          />
          <MetricRow label="Half Day" value={String(metrics.statusCounts["Half Day"])} />
          {metrics.statusCounts["Absent"] > 0 && (
            <MetricRow label="Absent" value={String(metrics.statusCounts["Absent"])} />
          )}
          {metrics.statusCounts["Missing"] > 0 && (
            <MetricRow label="Missing" value={String(metrics.statusCounts["Missing"])} />
          )}
        </MetricGroup>
      </div>

      {/* Longest / Shortest — jump straight to the day in the table */}
      {metrics.workedDayCount >= 2 && (metrics.longestDay || metrics.shortestDay) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.longestDay && (
            <ExtremeDayCard kindLabel="Longest Day" day={metrics.longestDay} onLocateDay={onLocateDay} />
          )}
          {metrics.shortestDay && (
            <ExtremeDayCard kindLabel="Shortest Day" day={metrics.shortestDay} onLocateDay={onLocateDay} />
          )}
        </div>
      )}
    </section>
  );
}

function HeroStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5 tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-steel mt-0.5">{note}</p>}
    </div>
  );
}

function MetricGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="rounded-lg border border-hairline bg-canvas p-5 shadow-subtle">
      <h3 className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-1">{label}</h3>
      <dl className="divide-y divide-hairline-soft">{children}</dl>
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-slate">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block text-[15px] font-medium text-ink tabular-nums">{value}</span>
        {sub && <span className="block text-[11px] text-steel mt-0.5">{sub}</span>}
      </dd>
    </div>
  );
}

function ExtremeDayCard({
  kindLabel,
  day,
  onLocateDay,
}: {
  kindLabel: string;
  day: DayExtreme;
  onLocateDay: (date: string) => void;
}) {
  const dateLabel = formatDay(day.date);
  const times = day.timeIn && day.timeout ? `${day.timeIn}–${day.timeout}` : null;
  const deltaLabel =
    day.extraDeficitMinutes === 0
      ? "0h 0m vs shift"
      : `${day.extraDeficitMinutes > 0 ? "+" : "\u2212"}${formatMinutes(Math.abs(day.extraDeficitMinutes))} vs shift`;
  const details = [dateLabel, times, deltaLabel].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={() => onLocateDay(day.date)}
      aria-label={`${kindLabel}: ${dateLabel}, ${formatMinutes(day.minutes)} worked — show in the day table`}
      className="metric-cell group rounded-lg border border-hairline bg-canvas p-5 shadow-subtle text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span className="flex items-center justify-between gap-3 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-[1px] text-steel">{kindLabel}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-steel opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          View in table
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
          </svg>
        </span>
      </span>
      <span className="block font-display text-2xl font-medium tracking-heading text-ink tabular-nums">
        {formatMinutes(day.minutes)}
      </span>
      <span className="block text-[11px] text-steel mt-1">{details}</span>
    </button>
  );
}
