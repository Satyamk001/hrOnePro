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
  { key: "extraDeficitMinutes", label: "+/− Shift" },
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
  if (!record.isWorkedDay) return <span className="text-stone">—</span>;
  const value = record.extraDeficitMinutes;
  if (value === 0) return <span className="text-steel">0h 0m</span>;
  if (value > 0) return <span className="text-primary font-medium">+{formatMinutes(value)}</span>;
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

  function getAriaSort(columnKey: string): "ascending" | "descending" | "none" {
    if (sortState.column !== columnKey) return "none";
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-hairline bg-surface">
            {COLUMNS.map((col) => {
              const isActive = sortState.column === col.key;
              const isAsc = isActive && sortState.direction === "asc";
              const isDesc = isActive && sortState.direction === "desc";
              return (
                <th
                  key={col.key}
                  className="px-4 py-3 text-[11px] font-semibold text-steel uppercase tracking-wide cursor-pointer select-none hover:text-ink transition-colors whitespace-nowrap group"
                  onClick={() => handleColumnClick(col.key)}
                  aria-sort={getAriaSort(col.key)}
                  title={`Sort by ${col.label}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <svg
                      className={`w-3 h-3 shrink-0 transition-colors ${isActive ? "text-primary" : "text-stone opacity-0 group-hover:opacity-100"}`}
                      viewBox="0 0 10 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 1L9 5H1L5 1Z"
                        fill={isAsc ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.2"
                        className={isAsc ? "" : isActive ? "opacity-40" : ""}
                      />
                      <path
                        d="M5 13L1 9H9L5 13Z"
                        fill={isDesc ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.2"
                        className={isDesc ? "" : isActive ? "opacity-40" : ""}
                      />
                    </svg>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRecords.map((record, idx) => (
            <tr
              key={`${record.attendanceDate}-${idx}`}
              className={`border-b border-hairline transition-colors ${
                record.isLateArrival
                  ? "bg-[#fef9ec] dark:bg-[#2a2000]"
                  : record.extraDeficitMinutes < 0 && record.isWorkedDay
                  ? "bg-[#fef2f2] dark:bg-[#2a0000]"
                  : "hover:bg-hairline-soft"
              }`}
            >
              <td className="px-4 py-3 text-sm text-ink font-medium whitespace-nowrap">{record.attendanceDate}</td>
              <td className="px-4 py-3 text-sm text-charcoal whitespace-nowrap">{getDayOfWeek(record.attendanceDate)}</td>
              <td className="px-4 py-3 text-sm text-charcoal whitespace-nowrap">{record.status}</td>
              <td className="px-4 py-3 text-sm text-charcoal whitespace-nowrap font-mono">{record.timeIn ?? <span className="text-stone">—</span>}</td>
              <td className="px-4 py-3 text-sm text-charcoal whitespace-nowrap font-mono">{record.timeout ?? <span className="text-stone">—</span>}</td>
              <td className="px-4 py-3 text-sm text-ink whitespace-nowrap font-mono">{formatMinutes(record.workedMinutes)}</td>
              <td className="px-4 py-3 text-sm text-steel whitespace-nowrap font-mono">{formatMinutes(record.shiftDurationMinutes)}</td>
              <td className="px-4 py-3 text-sm whitespace-nowrap font-mono">{renderExtraDeficit(record)}</td>
              <td className="px-4 py-3 text-sm whitespace-nowrap">
                {record.isLateArrival ? <span className="text-warning font-medium">Late</span> : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
