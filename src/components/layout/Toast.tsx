/** Toast notification — always-mounted live region so screen readers announce it. */
export default function Toast({ toast }: { toast: string | null }) {
  return (
    <div role="status" aria-live="polite" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      {toast && (
        <div className="px-5 py-2.5 bg-ink text-canvas text-xs font-medium rounded-full shadow-card animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
}
