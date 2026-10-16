import { useEffect, useRef } from "react";
import { BOOKMARKLET_VERSION, EXTENSION_VERSION } from "../../utils/config";

interface Props {
  hasUpdate: boolean;
  /** Rendered when the user opened onboarding while a dashboard exists. */
  showBack: boolean;
  onBack: () => void;
  bookmarkletCode: string;
}

/** Empty state / setup panel: bookmarklet drag + extension download. */
export default function Onboarding({ hasUpdate, showBack, onBack, bookmarkletCode }: Props) {
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (bookmarkletRef.current) bookmarkletRef.current.setAttribute("href", bookmarkletCode); }, [bookmarkletCode]);

  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 text-center">
      {showBack && (
        <button
          onClick={onBack}
          className="mb-6 text-sm text-link hover:underline font-medium"
        >
          ← Back to dashboard
        </button>
      )}
      {hasUpdate && (
        <div className="mb-6 px-5 py-3 rounded-lg bg-cream border border-beige-deep text-sm text-charcoal max-w-lg w-full leading-relaxed">
          <strong className="text-ink">Update available!</strong> Download the latest extension (v{EXTENSION_VERSION}) and re-drag the bookmarklet (v{BOOKMARKLET_VERSION}).
        </div>
      )}
      <div className="mb-8 sm:mb-10 px-1">
        <h2 className="font-display text-[2rem] leading-[1.1] sm:text-4xl font-medium text-ink tracking-display mb-3 text-balance">
          Know your hours in seconds
        </h2>
        <p className="text-[15px] sm:text-base text-slate max-w-md mx-auto leading-relaxed">
          See overtime, shortfall, and net balance from your HROne attendance — no manual calculation needed.
        </p>
      </div>

      <div className="rounded-lg bg-cream border border-beige-deep p-6 sm:p-8 max-w-lg w-full text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-steel mb-5">
          Get started in 30 seconds
        </p>
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">1</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Drag this button to your bookmarks bar:</p>
              <a
                ref={bookmarkletRef}
                href="#"
                className="mt-2 px-4 py-2 max-w-full inline-flex items-center gap-2 bg-primary text-white rounded-md text-sm font-medium cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                onClick={(e) => { e.preventDefault(); alert("Drag this button to your bookmarks bar.\nThen click it on the HROne calendar page."); }}
              >
                Sync Attendance
                <span className="text-[10px] opacity-70 font-mono">v{BOOKMARKLET_VERSION}</span>
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">2</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                Open{" "}
                <a href="https://app.hrone.cloud/app/myprofile/calendar" target="_blank" rel="noopener noreferrer" className="text-link hover:underline break-words">
                  HROne Calendar
                </a>
              </p>
              <p className="text-xs text-steel mt-0.5">Log in if needed, then select the month you want</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">3</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Click the bookmark — data appears here</p>
              <p className="text-xs text-steel mt-0.5">First time you'll enter your Employee ID (from your HROne profile)</p>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-beige-deep text-center space-y-2">
          <a
            href="/attendance-extension.zip"
            download="attendance-extension.zip"
            className="inline-flex items-center gap-2 px-4 py-2 border border-hairline-strong bg-canvas text-ink rounded-md text-sm font-medium hover:bg-hairline-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Extension
          </a>
          <p className="text-[11px] text-stone leading-relaxed px-2 text-balance">
            Unzip → chrome://extensions → Developer mode → Load unpacked
          </p>
        </div>
      </div>
    </div>
  );
}
