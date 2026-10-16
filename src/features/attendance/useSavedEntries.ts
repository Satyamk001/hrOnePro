import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttendanceRecord, SavedEntry } from "../../types";
import { STORAGE_KEY } from "../../utils/config";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { countPunchedDays, deriveMonthKey, formatMonthLabel, normalizeRecords } from "./helpers";

export interface MonthUpsertResult {
  monthKey: string;
  label: string;
  /** True when the incoming copy has fewer days or fewer punched days. */
  shrank: boolean;
  /** The replaced copy of this month, if one existed (for Undo). */
  previous: SavedEntry | null;
  recordCount: number;
  punchedCount: number;
}

function latestKey(entries: SavedEntry[]): string | null {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => b.key.localeCompare(a.key))[0].key;
}

/** Never throw on corrupt storage — fall back to an empty list. */
function decodeEntries(raw: string): SavedEntry[] {
  try {
    return (JSON.parse(raw) as SavedEntry[] | null) ?? [];
  } catch {
    return [];
  }
}

/**
 * The stored months and the sidebar selection. Owns:
 * - persistence + cross-tab sync of the entries (via useLocalStorageState);
 * - keeping the active month valid as entries change;
 * - the re-sync "upsert" with its shrink detection that powers Undo.
 */
export function useSavedEntries() {
  const [entries, setEntries] = useLocalStorageState<SavedEntry[]>(STORAGE_KEY, [], {
    decode: decodeEntries,
  });

  const [activeKey, setActiveKey] = useState<string | null>(() => latestKey(entries));

  const sortedEntries = useMemo(
    () => entries.slice().sort((a, b) => b.key.localeCompare(a.key)),
    [entries]
  );

  // Keep the selection valid: if the active month disappears (cross-tab
  // update or clear), fall back to the newest entry.
  useEffect(() => {
    setActiveKey((prev) =>
      prev && entries.some((e) => e.key === prev) ? prev : latestKey(entries)
    );
  }, [entries]);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const upsertMonth = useCallback(
    (records: AttendanceRecord[]): MonthUpsertResult | null => {
      if (!Array.isArray(records) || records.length === 0) return null;
      if (!records[0].attendanceDate) return null;

      const normalized = normalizeRecords(records);
      const monthKey = deriveMonthKey(normalized);
      const label = formatMonthLabel(monthKey);

      // Re-syncing replaces the stored month. If the new data has fewer days or
      // fewer punched days (e.g. HROne returned a partial response), keep the
      // previous copy so the user can undo instead of silently losing data.
      const previous = entriesRef.current.find((e) => e.key === monthKey) ?? null;
      const shrank = !!(
        previous &&
        (normalized.length < previous.records.length ||
          countPunchedDays(normalized) < countPunchedDays(previous.records))
      );

      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.key === monthKey);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { label, key: monthKey, records: normalized };
          return updated;
        }
        return [...prev, { label, key: monthKey, records: normalized }];
      });
      setActiveKey(monthKey);

      return {
        monthKey,
        label,
        shrank,
        previous,
        recordCount: normalized.length,
        punchedCount: countPunchedDays(normalized),
      };
    },
    [setEntries]
  );

  const restoreEntry = useCallback(
    (entry: SavedEntry) => {
      setEntries((prev) => prev.map((e) => (e.key === entry.key ? entry : e)));
      setActiveKey(entry.key);
    },
    [setEntries]
  );

  return { entries, sortedEntries, activeKey, setActiveKey, upsertMonth, restoreEntry };
}
