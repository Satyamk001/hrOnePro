import type { DashboardMetrics } from "../types";
import { formatMinutes } from "../utils/timeCalculator";

interface DashboardProps {
  metrics: DashboardMetrics;
}

export default function Dashboard({ metrics }: DashboardProps) {
  const netBalanceMinutes = metrics.totalExtraMinutes - metrics.totalShortfallMinutes;
  const netBalanceSign = netBalanceMinutes >= 0 ? "+" : "-";
  const netBalanceFormatted = `${netBalanceSign}${formatMinutes(Math.abs(netBalanceMinutes))}`;
  const isPositive = netBalanceMinutes > 0;
  const isNegative = netBalanceMinutes < 0;

  return (
    <div className="space-y-6">
      {/* Hero: Net Balance */}
      <div className="rounded-lg border border-beige-deep bg-cream p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-3">
          Net Balance
        </p>
        <p className={`font-display text-5xl font-medium tracking-display ${
          isPositive ? "text-primary" : isNegative ? "text-error" : "text-ink"
        }`}>
          {netBalanceFormatted}
        </p>
        <p className="text-sm text-charcoal mt-3">
          {isPositive
            ? "You have time in hand this month."
            : isNegative
            ? "You're short this month."
            : "Exactly on target."}
        </p>
        <div className="flex gap-10 mt-5 pt-5 border-t border-beige-deep">
          <div>
            <p className="text-[11px] text-steel uppercase tracking-wide">Overtime</p>
            <p className="text-sm font-medium text-ink mt-0.5">{formatMinutes(metrics.totalExtraMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-steel uppercase tracking-wide">Shortfall</p>
            <p className="text-sm font-medium text-ink mt-0.5">{formatMinutes(metrics.totalShortfallMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-steel uppercase tracking-wide">Average / Day</p>
            <p className="text-sm font-medium text-ink mt-0.5">{formatMinutes(metrics.averageWorkMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-steel uppercase tracking-wide">Total Hours</p>
            <p className="text-sm font-medium text-ink mt-0.5">{formatMinutes(metrics.totalWorkingMinutes)}</p>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Cell label="Worked Days" value={String(metrics.workedDayCount)} sub={`of ${metrics.totalDays} days in month`} />
        <Cell label="Present" value={String(metrics.statusCounts["Present"])} />
        <Cell label="Late" value={`${metrics.lateCount}`} sub={`${metrics.latePercentage.toFixed(1)}% of worked days`} />
        <Cell label="Week Off" value={String(metrics.statusCounts["Week Off"])} />
        <Cell label="Holiday" value={String(metrics.statusCounts["Holiday"])} />
        <Cell label="Leave" value={String(metrics.statusCounts["Leave"] + metrics.statusCounts["Full Leave"] + metrics.statusCounts["Earned Leave"])} />
        <Cell label="Half Day" value={String(metrics.statusCounts["Half Day"])} />
        <Cell
          label="Pending"
          value={String(metrics.statusCounts["Pending"])}
          sub={metrics.statusCounts["Missing"] > 0 ? `${metrics.statusCounts["Missing"]} missing` : undefined}
        />
      </div>

      {/* Longest / Shortest */}
      {metrics.workedDayCount >= 2 && (metrics.longestDay || metrics.shortestDay) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.longestDay && (
            <div className="rounded-lg border border-hairline bg-canvas p-5 shadow-subtle">
              <p className="text-[11px] text-steel uppercase tracking-wide mb-1">Longest Day</p>
              <p className="text-sm font-medium text-ink">{metrics.longestDay.date}</p>
              <p className="text-xs text-slate mt-0.5">{formatMinutes(metrics.longestDay.minutes)}</p>
            </div>
          )}
          {metrics.shortestDay && (
            <div className="rounded-lg border border-hairline bg-canvas p-5 shadow-subtle">
              <p className="text-[11px] text-steel uppercase tracking-wide mb-1">Shortest Day</p>
              <p className="text-sm font-medium text-ink">{metrics.shortestDay.date}</p>
              <p className="text-xs text-slate mt-0.5">{formatMinutes(metrics.shortestDay.minutes)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-4 shadow-subtle">
      <p className="text-[11px] text-steel uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl font-medium text-ink tracking-heading">{value}</p>
      {sub && <p className="text-[11px] text-stone mt-0.5">{sub}</p>}
    </div>
  );
}
