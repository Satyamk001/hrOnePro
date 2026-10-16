import type { RefObject } from "react";
import type { TodayAttendance } from "../../types";
import LiveClock from "./LiveClock";
import { GlassToggle } from "../ui/GlassToggle";
import { SplashButton } from "../ui/SplashButton";
import { ClickRipple } from "../ui/ClickRipple";

interface Props {
  userName: string;
  isDark: boolean;
  onToggleTheme: () => void;
  syncing: boolean;
  extensionAvailable: boolean;
  activeLabel?: string;
  hasUpdate: boolean;
  showOnboarding: boolean;
  onToggleOnboarding: () => void;
  onSyncNow: () => void;
  clockPillRef: RefObject<HTMLDivElement | null>;
  todayAttendance: TodayAttendance | null;
  shiftMinutes: number;
  headerRef: RefObject<HTMLElement | null>;
}

/** Glassmorphism three-pill navigation: brand, clock, actions. */
export default function TopBar({
  userName,
  isDark,
  onToggleTheme,
  syncing,
  extensionAvailable,
  activeLabel,
  hasUpdate,
  showOnboarding,
  onToggleOnboarding,
  onSyncNow,
  clockPillRef,
  todayAttendance,
  shiftMinutes,
  headerRef,
}: Props) {
  return (
    <header ref={headerRef} className="topbar absolute top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="topbar-shell pointer-events-auto">

        {/* Pill 1 — Brand / User (Left) */}
        <div className="glass-pill brand-pill">
          <span className="brand-title">
            Attendance Insights
          </span>
          {userName && (
            <span className="brand-user">
              / {userName}
            </span>
          )}
        </div>

        {/* Pill 2 — Time / Status (Center) */}
        <div className="glass-pill clock-pill" ref={clockPillRef}>
          <LiveClock todayAttendance={todayAttendance} shiftMinutes={shiftMinutes} />
        </div>

        {/* Pill 3 — Actions (Right) */}
        <div className="glass-pill action-pill">
          {/* Help button */}
          <ClickRipple>
            <button
              onClick={onToggleOnboarding}
              className="topbar-action relative"
              data-active={showOnboarding ? "true" : "false"}
              aria-label="Setup & Downloads"
              title="Setup & Downloads"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              {hasUpdate && (
                <span className="update-dot" />
              )}
            </button>
          </ClickRipple>

          {/* Divider */}
          <div className="pill-divider" />

          {/* Theme toggle */}
          <GlassToggle
            isDark={isDark}
            width={56}
            height={28}
            orbSize={24}
            onToggle={onToggleTheme}
          />

          {/* Divider */}
          <div className="pill-divider" />

          {/* Sync button */}
          <SplashButton
            className="action-pill-splash"
            onClick={onSyncNow}
            disabled={syncing || !extensionAvailable}
            loading={syncing}
            title={extensionAvailable ? (activeLabel ? `Sync ${activeLabel} from HROne` : "Fetch latest data from HROne") : "Install the extension to use Sync"}
            text="Sync"
            width={130}
            height={40}
          />
        </div>

      </div>
    </header>
  );
}
