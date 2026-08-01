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
      <div className="border border-hairline rounded-md p-6 bg-elevated">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-mute mb-2">
          Net Balance
        </p>
        <p className={`text-5xl font-semibold tracking-display ${
          isPositive ? "text-[#0070f3]" : isNegative ? "text-error" : "text-ink"
        }`}>
          {netBalanceFormatted}
        </p>
        <p className="text-sm text-body mt-2">
          {isPositive
            ? "You can leave early today"
            : isNegative
            ? "You owe time — plan to stay longer."
            : "Exactly on target."}
        </p>
        <div className="flex gap-8 mt-4 pt-4 border-t border-hairline">
          <div>
            <p className="text-[11px] text-mute">Overtime</p>
            <p className="text-sm font-medium text-ink">{formatMinutes(metrics.totalExtraMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-mute">Shortfall</p>
            <p className="text-sm font-medium text-ink">{formatMinutes(metrics.totalShortfallMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-mute">Average / Day</p>
            <p className="text-sm font-medium text-ink">{formatMinutes(metrics.averageWorkMinutes)}</p>
          </div>
          <div>
            <p className="text-[11px] text-mute">Total Hours</p>
            <p className="text-sm font-medium text-ink">{formatMinutes(metrics.totalWorkingMinutes)}</p>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline rounded-md overflow-hidden">
        <Cell label="Worked Days" value={String(metrics.workedDayCount)} sub={`of ${metrics.totalDays}`} />
        <Cell label="Present" value={String(metrics.statusCounts["Present"])} />
        <Cell label="Late" value={`${metrics.lateCount}`} sub={`${metrics.latePercentage.toFixed(1)}%`} />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-hairline border border-hairline rounded-md overflow-hidden">
          {metrics.longestDay && (
            <div className="bg-elevated p-4">
              <p className="text-[11px] text-mute mb-1">Longest Day</p>
              <p className="text-sm font-medium text-ink">{metrics.longestDay.date}</p>
              <p className="text-xs text-body">{formatMinutes(metrics.longestDay.minutes)}</p>
            </div>
          )}
          {metrics.shortestDay && (
            <div className="bg-elevated p-4">
              <p className="text-[11px] text-mute mb-1">Shortest Day</p>
              <p className="text-sm font-medium text-ink">{metrics.shortestDay.date}</p>
              <p className="text-xs text-body">{formatMinutes(metrics.shortestDay.minutes)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-elevated p-4">
      <p className="text-[11px] text-mute mb-1">{label}</p>
      <p className="text-lg font-semibold text-ink tracking-subheading">{value}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}
