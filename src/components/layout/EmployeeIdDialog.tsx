import { useEffect, useRef, useState, type FormEvent } from "react";

/** Replaces window.prompt(): inline, validated, keyboard- and screen-reader-friendly. */
export default function EmployeeIdDialog({ onSubmit, onCancel }: { onSubmit: (id: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!/^\d{1,10}$/.test(trimmed) || Number(trimmed) <= 0) {
      setError("Enter the numeric Employee ID from your HROne profile (digits only).");
      return;
    }
    onSubmit(Number(trimmed));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dialog-backdrop" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="empid-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-hairline bg-canvas p-6 shadow-card"
      >
        <h2 id="empid-title" className="font-display text-xl font-medium text-ink">Your Employee ID</h2>
        <p className="text-sm text-slate mt-1">Needed once to fetch attendance from HROne. Stored only in this browser.</p>
        <label htmlFor="empid-input" className="block text-xs font-medium text-steel uppercase tracking-wide mt-5 mb-1.5">Employee ID</label>
        <input
          id="empid-input"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "empid-error" : "empid-hint"}
          placeholder="e.g. 12345"
          className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {error ? (
          <p id="empid-error" className="text-xs text-error mt-1.5">{error}</p>
        ) : (
          <p id="empid-hint" className="text-xs text-steel mt-1.5">HROne → My Profile. It's the number, not your employee code.</p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            Save & sync
          </button>
        </div>
      </form>
    </div>
  );
}
