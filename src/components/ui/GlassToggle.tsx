import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { cn } from "../../utils/cn";

interface GlassToggleProps {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
  /** Width of the toggle track (default: 72) */
  width?: number;
  /** Height of the toggle track (default: 32) */
  height?: number;
  /** Size of the sliding orb (default: 28) */
  orbSize?: number;
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

/**
 * GlassToggle — A glass-morphism capsule toggle with a sliding orb.
 * Uses existing CSS variable tokens for both light and dark modes.
 *
 * Light mode: warm cream/orange track with sunny orb
 * Dark mode: deep warm-dark track with cool moon orb
 */
export function GlassToggle({
  isDark,
  onToggle,
  className,
  width = 72,
  height = 32,
  orbSize = 28,
}: GlassToggleProps) {
  const padding = 2;
  const travelDistance = width - orbSize - padding * 2;

  const transitionConfig: Transition = {
    type: "spring",
    stiffness: 300,
    damping: 20,
  };

  // Use CSS variable token values that match the existing color palette
  // Light track: warm cream/sunshine tones (--color-cream, --color-sunshine-300)
  // Dark track: deep warm dark tones (--color-canvas dark, --color-hairline-soft dark)
  const trackLight =
    "linear-gradient(90deg, var(--color-cream), var(--color-cream-deeper))";
  const trackDark =
    "linear-gradient(90deg, var(--color-hairline-soft), var(--color-hairline))";

  // Orb glow
  // Light/sun: warm orange glow (--color-primary based)
  const orbGlowLight =
    "radial-gradient(circle at 35% 35%, var(--color-primary) 0%, transparent 70%)";
  // Dark/moon: cool steel glow
  const orbGlowDark =
    "radial-gradient(circle at 65% 35%, var(--color-steel) 0%, transparent 70%)";

  return (
    <div
      onClick={onToggle}
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
      style={{ width, height }}
    >
      {/* Background capsule track — uses theme tokens */}
      <motion.div
        className="absolute inset-0 rounded-full border"
        animate={{
          background: isDark ? trackDark : trackLight,
          borderColor: isDark
            ? "var(--color-hairline)"
            : "var(--color-beige-deep)",
        }}
        transition={{ duration: 0.5 }}
        style={{
          boxShadow: `inset 1px 1px 2px rgba(255, 255, 255, 0.1),
            inset -1px -1px 2px rgba(0, 0, 0, 0.15),
            0 2px 8px -2px rgba(0,0,0,0.2)`,
        }}
      />

      {/* Sliding orb */}
      <motion.div
        className="absolute rounded-full z-10 flex items-center justify-center"
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
        {/* Orb base — uses canvas/surface token for the sphere background */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            background: isDark
              ? "var(--color-surface)"
              : "var(--color-canvas)",
            borderColor: isDark
              ? "var(--color-hairline)"
              : "var(--color-beige-deep)",
          }}
          style={{
            border: "1px solid",
            boxShadow: `inset 1px 1px 3px rgba(255,255,255,0.2),
              inset -1px -1px 3px rgba(0,0,0,0.1),
              0 3px 8px rgba(0,0,0,0.15)`,
          }}
        />

        {/* Orb glow — state-specific color from theme tokens */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-60"
          animate={{
            background: isDark ? orbGlowDark : orbGlowLight,
          }}
        />

        {/* Icon — uses ink color for visibility in both modes */}
        <motion.div
          className="relative z-10 "
          style={{ color: "var(--color-ink)" }}
          animate={{
            scale: [1, 0.85, 1],
            rotate: isDark ? -10 : 0,
          }}
          transition={{ duration: 0.35 }}
        >
          {isDark ? (
            <MoonIcon size={orbSize * 0.5} />
          ) : (
            <SunIcon size={orbSize * 0.5} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default GlassToggle;
