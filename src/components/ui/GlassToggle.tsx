import React from "react";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { cn } from "../../utils/cn";

interface GlassToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;

  // Dimensions
  width?: number;
  height?: number;
  orbSize?: number;

  // Configuration
  labels?: {
    on?: string;
    off?: string;
  };
  icons?: {
    on?: React.ReactNode;
    off?: React.ReactNode;
  };

  easing?: string | number[]; // "easeInOut", "linear" or cubic-bezier array
  showText?: boolean;
}

function SunIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  );
}

function MoonIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  );
}

export function GlassToggle({
  isDark,
  onToggle,
  className,

  width = 72,
  height = 32,
  orbSize = 28,

  labels,
  icons,

  easing = "anticipate",
  showText = false, // Disabled by default for 72x32 size
}: GlassToggleProps) {
  // Existing Theme Colors
  const trackLight =
    "linear-gradient(90deg, var(--color-cream), var(--color-cream-deeper))";
  const trackDark =
    "linear-gradient(90deg, var(--color-hairline-soft), var(--color-hairline))";

  const orbLight =
    "radial-gradient(circle at 35% 35%, var(--color-primary) 0%, transparent 70%)";
  const orbDark =
    "radial-gradient(circle at 65% 35%, var(--color-steel) 0%, transparent 70%)";

  const handleToggle = () => {
    onToggle();
  };

  // Calculate Layout proportionally based on the provided 300x100 reference
  const padding = width * 0.0533; // 16 / 300
  const travelDistance = width - orbSize - padding * 2;
  const trackInsetX = width * 0.106; // 32 / 300
  const trackInsetY = height * 0.08; // 8 / 100

  // Transition Config
  const isSpring = easing === "spring" || easing === "bouncy";
  const transitionConfig: Transition = isSpring
    ? {
        type: "spring",
        stiffness: 300,
        damping: 20,
      }
    : {
        type: "tween",
        ease: easing as any,
        duration: 0.6,
      };

  return (
    <div
      onClick={handleToggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle theme"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "relative flex cursor-pointer items-center transition-transform duration-300 hover:scale-105",
        className
      )}
      style={{
        width,
        height,
      }}
    >
      {/* Background Capsule - The Track */}
      <div
        className="absolute rounded-full transition-all duration-700 ease-out border border-white/10"
        style={{
          left: trackInsetX,
          right: trackInsetX,
          top: trackInsetY,
          bottom: trackInsetY,
          background: isDark ? trackDark : trackLight,
          backdropFilter: "blur(12px)",
          boxShadow: `
                inset 1px 1px 2px rgba(255, 255, 255, 0.2),
                inset -1px -1px 2px rgba(0, 0, 0, 0.3),
                0 ${height * 0.1}px ${height * 0.4}px -${height * 0.1}px rgba(0,0,0,0.4)
            `,
        }}
      ></div>

      {/* Text Labels */}
      {showText && labels && (
        <div
          className="absolute inset-0 flex items-center justify-between pointer-events-none z-10"
          style={{ paddingLeft: width * 0.22, paddingRight: width * 0.22 }}
        >
          {/* Off Label (Sleep/Dark) */}
          <div className="relative flex items-center justify-center">
            <motion.span
              initial={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              animate={{
                opacity: isDark ? 0 : 1,
                x: isDark ? -20 : 0,
                filter: isDark ? "blur(10px)" : "blur(0px)",
              }}
              transition={{ duration: 0.5 }}
              className="absolute whitespace-nowrap font-semibold tracking-wide mix-blend-overlay"
              style={{ fontSize: width * 0.1, color: "var(--color-steel)" }}
            >
              {labels.off}
            </motion.span>
          </div>

          {/* On Label (Work/Light) */}
          <div className="relative flex items-center justify-center">
            <motion.span
              initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
              animate={{
                opacity: isDark ? 1 : 0,
                x: isDark ? 0 : 20,
                filter: isDark ? "blur(0px)" : "blur(10px)",
              }}
              transition={{ duration: 0.5 }}
              className="absolute whitespace-nowrap font-semibold tracking-wide mix-blend-overlay"
              style={{ fontSize: width * 0.1, color: "var(--color-primary)" }}
            >
              {labels.on}
            </motion.span>
          </div>
        </div>
      )}

      {/* The Orb - Floating sphere that moves */}
      <motion.div
        className="absolute rounded-full z-20 flex items-center justify-center"
        initial={false}
        animate={{
          x: isDark ? padding + travelDistance : padding,
        }}
        transition={transitionConfig}
        style={{
          width: orbSize,
          height: orbSize,
          left: 0,
        }}
      >
        {/* ORB GLASS LAYER 1 */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.0) 100%)",
            backdropFilter: "blur(5px)",
            border: "1px solid rgba(255,255,255,0.3)",
            boxShadow: `
                    inset ${orbSize * 0.04}px ${orbSize * 0.04}px ${orbSize * 0.1}px rgba(255,255,255,0.3),
                    inset -${orbSize * 0.04}px -${orbSize * 0.04}px ${orbSize * 0.1}px rgba(0,0,0,0.1),
                    0 ${orbSize * 0.15}px ${orbSize * 0.4}px rgba(0,0,0,0.3)
                `,
          }}
        />

        {/* ORB GLOW - Specific to state */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-80"
          animate={{
            background: isDark ? orbDark : orbLight,
          }}
        />

        {/* ORB REFLECTIONS */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute -left-2 -top-2 h-2/3 w-2/3 rounded-full bg-gradient-to-br from-white to-transparent opacity-40 blur-md" />
          <div className="absolute right-4 bottom-4 h-1/3 w-1/3 rounded-full bg-gradient-to-tl from-white/20 to-transparent opacity-30 blur-lg" />
        </div>

        {/* ICON CONTAINER */}
        <motion.div
          className="relative z-10 drop-shadow-md"
          style={{ color: "var(--color-ink)" }}
          animate={{
            scale: [1, 0.8, 1],
            rotate: isDark ? 0 : -10,
          }}
          transition={{ duration: 0.4 }}
        >
          {isDark
            ? icons?.off || <MoonIcon size={orbSize * 0.5} />
            : icons?.on || <SunIcon size={orbSize * 0.5} />}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default GlassToggle;
