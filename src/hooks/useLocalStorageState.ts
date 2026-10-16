import { useCallback, useEffect, useRef, useState } from "react";

export interface LocalStorageStateOptions<T> {
  /** Parse raw stored text. Throw → fallback is used. Defaults to JSON.parse. */
  decode?: (raw: string) => T;
  /** Serialize for storage. null/undefined removes the key. Defaults to JSON.stringify. */
  encode?: (value: T) => string | null | undefined;
}

/**
 * `useState` persisted under a localStorage key, kept in sync across tabs:
 *
 * - reads once on mount (missing/corrupt data → fallback);
 * - every update writes through to localStorage;
 * - `storage` events from other tabs (including `localStorage.clear()`)
 *   update the state here.
 */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  options: LocalStorageStateOptions<T> = {}
): [T, (update: T | ((prev: T) => T)) => void, { clear: () => void }] {
  // Refs keep the latest decode/encode/fallback without re-creating callbacks.
  const decodeRef = useRef(options.decode);
  decodeRef.current = options.decode;
  const encodeRef = useRef(options.encode);
  encodeRef.current = options.encode;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const decodeRaw = useCallback((raw: string): T => {
    return decodeRef.current ? decodeRef.current(raw) : (JSON.parse(raw) as T);
  }, []);

  const readInitial = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallbackRef.current : decodeRaw(raw);
    } catch {
      return fallbackRef.current;
    }
  }, [key, decodeRaw]);

  const [value, setValue] = useState<T>(readInitial);
  const valueRef = useRef(value);
  valueRef.current = value;

  const set = useCallback(
    (update: T | ((prev: T) => T)) => {
      const prev = valueRef.current;
      const next = typeof update === "function" ? (update as (p: T) => T)(prev) : update;
      valueRef.current = next;
      setValue(next);
      try {
        const raw = encodeRef.current ? encodeRef.current(next) : JSON.stringify(next);
        if (raw === null || raw === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, raw);
      } catch {
        /* storage unavailable — keep the in-memory value */
      }
    },
    [key]
  );

  const clear = useCallback(() => {
    valueRef.current = fallbackRef.current;
    setValue(fallbackRef.current);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      // e.key === null → localStorage.clear() in another tab
      if (e.key !== null && e.key !== key) return;
      if (e.newValue === null) {
        valueRef.current = fallbackRef.current;
        setValue(fallbackRef.current);
        return;
      }
      try {
        const next = decodeRaw(e.newValue);
        valueRef.current = next;
        setValue(next);
      } catch {
        /* corrupt update from another tab — keep the current value */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, decodeRaw]);

  return [value, set, { clear }];
}
