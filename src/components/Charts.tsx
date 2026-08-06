import type { EnrichedRecord, DayStatus } from '../types';
import { formatMinutes, parseHHMM } from '../utils/timeCalculator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface ChartsProps {
  records: EnrichedRecord[];
}

const STATUS_COLORS: Record<DayStatus, string> = {
  Present: '#22c55e',
  'Week Off': '#a855f7',
  Leave: '#f97316',
  'Half Day': '#eab308',
  'Flexi Leave': '#ef4444',
  'Earned Leave': '#3b82f6',
  Holiday: '#8b5cf6',
  Absent: '#dc2626',
  Pending: '#d1d5db',
  Missing: '#6b7280',
  Other: '#14b8a6',
};

/**
 * Get ISO week number from a YYYY-MM-DD date string.
 */
function getISOWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const temp = new Date(date.getTime());
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const firstThursday = new Date(temp.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const weekNumber = 1 + Math.round(
    ((temp.getTime() - firstThursday.getTime()) / 86400000 - 3 +
      ((firstThursday.getDay() + 6) % 7)) / 7
  );
  return weekNumber;
}

/**
 * Get ISO year for week computation (year of the Thursday of that week).
 */
function getISOWeekYear(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const temp = new Date(date.getTime());
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  return temp.getFullYear();
}

export default function Charts({ records }: ChartsProps) {
  // --- Bar Chart Data: worked days with hours ---
  const workedDays = records.filter((r) => r.isWorkedDay);
  const barData = workedDays.map((r) => ({
    date: r.attendanceDate,
    worked: +(r.workedMinutes / 60).toFixed(2),
    shift: +(r.shiftDurationMinutes / 60).toFixed(2),
  }));

  // --- Line Chart Data: worked days with non-null timeIn and timeout ---
  const lineRecords = workedDays.filter(
    (r) => r.timeIn !== null && r.timeout !== null
  );
  const allTimesNull = lineRecords.length === 0;
  const lineData = lineRecords.map((r) => ({
    date: r.attendanceDate,
    timeIn: parseHHMM(r.timeIn!),
    timeout: parseHHMM(r.timeout!),
    shiftStart: parseHHMM(r.shiftStartTime),
    shiftEnd: parseHHMM(r.shiftEndTime),
  }));

  // --- Pie Chart Data: count each DayStatus, omit zero-count ---
  const statusCounts: Record<DayStatus, number> = {
    Present: 0,
    'Week Off': 0,
    Leave: 0,
    'Half Day': 0,
    'Flexi Leave': 0,
    'Earned Leave': 0,
    Holiday: 0,
    Absent: 0,
    Pending: 0,
    Missing: 0,
    Other: 0,
  };
  for (const r of records) {
    statusCounts[r.status]++;
  }
  const pieData = (Object.entries(statusCounts) as [DayStatus, number][])
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  // --- Weekly Aggregation: group by ISO week, compute average hours ---
  const weeklyMap = new Map<string, { totalMinutes: number; count: number }>();
  for (const r of workedDays) {
    const year = getISOWeekYear(r.attendanceDate);
    const week = getISOWeek(r.attendanceDate);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    const existing = weeklyMap.get(key);
    if (existing) {
      existing.totalMinutes += r.workedMinutes;
      existing.count++;
    } else {
      weeklyMap.set(key, { totalMinutes: r.workedMinutes, count: 1 });
    }
  }
  const weeklyData = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { totalMinutes, count }]) => ({
      week,
      avgHours: +(totalMinutes / count / 60).toFixed(2),
    }));
  const showWeeklyChart = weeklyData.length >= 2;

  // --- Custom tooltip formatter for line chart (minutes -> HH:MM) ---
  const formatTimeTooltip = (value: number) => {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart: Daily Worked Hours vs Shift Duration */}
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Daily Worked Hours vs Shift Duration
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatMinutes(Math.round(value * 60)),
                name === 'worked' ? 'Worked' : 'Shift',
              ]}
            />
            <Legend />
            <Bar dataKey="worked" name="Worked Hours" fill="#3b82f6" />
            <Bar dataKey="shift" name="Shift Duration" fill="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart: Daily TimeIn/Timeout vs Shift Times */}
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Clock-In/Out vs Shift Times
        </h3>
        {allTimesNull ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            Insufficient clock-in/clock-out data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={formatTimeTooltip}
                label={{ value: 'Time', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip formatter={(value: number) => formatTimeTooltip(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="timeIn"
                name="Time In"
                stroke="#22c55e"
                dot
              />
              <Line
                type="monotone"
                dataKey="timeout"
                name="Time Out"
                stroke="#ef4444"
                dot
              />
              <Line
                type="monotone"
                dataKey="shiftStart"
                name="Shift Start"
                stroke="#22c55e"
                strokeDasharray="5 5"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="shiftEnd"
                name="Shift End"
                stroke="#ef4444"
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie/Donut Chart: Status Breakdown */}
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">
          Status Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
            >
              {pieData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={STATUS_COLORS[entry.name as DayStatus]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} days`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Aggregation Chart */}
      {showWeeklyChart && (
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Average Hours per Week
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis
                label={{ value: 'Avg Hours', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: number) => [`${value}h`, 'Avg Hours']}
              />
              <Legend />
              <Bar dataKey="avgHours" name="Avg Worked Hours" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
