import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `intervalMs` and immediately whenever the tab
 * becomes visible again (after sleep / tab switch), so date-dependent UI such
 * as "Today" and "synced X ago" never sits on a stale value.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);

  return now;
}
