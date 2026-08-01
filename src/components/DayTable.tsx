import React, { useState } from "react";
import type { EnrichedRecord } from "../types";
import { formatMinutes } from "../utils/timeCalculator";

interface DayTableProps {
  records: EnrichedRecord[];
}

type SortState = {
  column: string | null;
  direction: "asc" | "desc";
};

const COLUMNS = [
  { key: "attendanceDate", label: "Date" },
  { key: "dayOfWeek", label: "Day" },
  { key: "status", label: "Status" },
  { key: "timeIn", label: "In" },
  { key: "timeout", label: "Out" },
  { key: "workedMinutes", label: "Worked" },
  { key: "shiftDurationMinutes", label: "Shift" },
  { key: "extraDeficitMinutes", label: "Extra/Deficit" },
  { key: "isLateArrival", label: "Late" },
];

function getDayOfWeek(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
}

function getSortValue(record: EnrichedRecord, column: string): string | number {
  switch (column) {
    case "attendanceDate": return record.attendanceDate;
    case "dayOfWeek": return new Date(record.attendanceDate).getDay();
    case "status": return record.status;
    case "timeIn": return record.timeIn ?? "";
    case "timeout": return record.timeout ?? "";
    case "workedMinutes": return record.workedMinutes;
    case "shiftDurationMinutes": return record.shiftDurationMinutes;
    case "extraDeficitMinutes": return record.extraDeficitMinutes;
    case "isLateArrival": return record.isLateArrival ? 1 : 0;
    default: return "";
  }
}

function renderExtraDeficit(record: EnrichedRecord): React.ReactNode {
  if (!record.isWorkedDay) return <span className="text-faint">—</span>;
  const value = record.extraDeficitMinutes;
  if (value === 0) return <span className="text-mute">0h 0m</span>;
  if (value > 0) return <span className="text-[#0070f3] font-medium">+{formatMinutes(value)}</span>;
  return <span className="text-error font-medium">-{formatMinutes(Math.abs(value))}</span>;
}

export default function DayTable({ records }: DayTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: "asc" });

  function handleColumnClick(columnKey: string) {
    setSortState((prev) => {
      if (prev.column === columnKey) {
        return { column: columnKey, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column: columnKey, direction: "asc" };
    });
  }

  const sortedRecords = [...records].sort((a, b) => {
    if (!sortState.column) return 0;
    const aVal = getSortValue(a, sortState.column);
    const bVal = getSortValue(b, sortState.column);
    let comparison = 0;
    if (typeof aVal === "number" && typeof bVal === "number") comparison = aVal - bVal;
    else comparison = String(aVal).localeCompare(String(bVal));
    return sortState.direction === "asc" ? comparison : -comparison;
  });

  function getSortIndicator(columnKey: string): string {
    if (sortState.column !== columnKey) return "";
    return sortState.direction === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-hairline">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-[11px] font-medium text-mute uppercase tracking-wide cursor-pointer select-none hover:text-ink transition-colors whitespace-nowrap"
                onClick={() => handleColumnClick(col.key)}
              >
                {col.label}{getSortIndicator(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record, idx) => (
            <tr
              key={`${record.attendanceDate}-${idx}`}
              className={`border-b border-hairline transition-colors ${
                record.isLateArrival
                  ? "bg-[#fff8e1]"
                  : record.extraDeficitMinutes < 0 && record.isWorkedDay
                  ? "bg-[#fff5f5]"
                  : "hover:bg-hairline-soft"
              }`}
            >
              <td className="px-4 py-2.5 text-sm text-ink font-medium whitespace-nowrap">{record.attendanceDate}</td>
              <td className="px-4 py-2.5 text-sm text-body whitespace-nowrap">{getDayOfWeek(record.attendanceDate)}</td>
              <td className="px-4 py-2.5 text-sm text-body whitespace-nowrap">{record.status}</td>
              <td className="px-4 py-2.5 text-sm text-body whitespace-nowrap font-mono">{record.timeIn ?? <span className="text-faint">—</span>}</td>
              <td className="px-4 py-2.5 text-sm text-body whitespace-nowrap font-mono">{record.timeout ?? <span className="text-faint">—</span>}</td>
              <td className="px-4 py-2.5 text-sm text-ink whitespace-nowrap font-mono">{formatMinutes(record.workedMinutes)}</td>
              <td className="px-4 py-2.5 text-sm text-mute whitespace-nowrap font-mono">{formatMinutes(record.shiftDurationMinutes)}</td>
              <td className="px-4 py-2.5 text-sm whitespace-nowrap font-mono">{renderExtraDeficit(record)}</td>
              <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                {record.isLateArrival ? <span className="text-warning font-medium">Late</span> : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
