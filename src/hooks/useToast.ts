import { useCallback, useEffect, useRef, useState } from "react";

/** Transient status message with auto-dismiss (default 3s). */
export function useToast(defaultMs = 3000) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const showToast = useCallback(
    (msg: string, ms = defaultMs) => {
      window.clearTimeout(timerRef.current);
      setToast(msg);
      timerRef.current = window.setTimeout(() => setToast(null), ms);
    },
    [defaultMs]
  );

  // Cancel a pending dismissal when the app unmounts.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { toast, showToast };
}
