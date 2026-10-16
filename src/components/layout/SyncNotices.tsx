interface SyncErrorNoticeProps {
  error: string;
  syncing: boolean;
  extensionAvailable: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Inline "sync failed" banner with retry + dismiss. */
export function SyncErrorNotice({ error, syncing, extensionAvailable, onRetry, onDismiss }: SyncErrorNoticeProps) {
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg notice notice-error px-4 py-3">
      <svg className="w-5 h-5 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">Sync failed: {error}</p>
        <p className="text-xs text-steel mt-0.5">
          Make sure you're logged in at{" "}
          <a href="https://app.hrone.cloud/app/myprofile/calendar" target="_blank" rel="noopener noreferrer" className="text-link underline">HROne</a>
          {" "}in this browser, then retry. Your saved data is unchanged.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onRetry}
          disabled={syncing || !extensionAvailable}
          className="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {syncing ? "Retrying…" : "Retry"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
  onKeep: () => void;
}

/** "A re-sync returned fewer days" banner offering Undo / Keep new data. */
export function UndoNotice({ message, onUndo, onKeep }: UndoNoticeProps) {
  return (
    <div role="status" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg notice notice-warning px-4 py-3">
      <p className="flex-1 text-sm text-ink">
        <span className="font-medium">Fewer days than before.</span> {message}
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          className="px-3 py-1.5 rounded-md border border-hairline-strong bg-canvas text-ink text-sm font-medium hover:bg-hairline-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-steel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Keep new data
        </button>
      </div>
    </div>
  );
}
