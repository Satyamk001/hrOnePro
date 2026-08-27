import { cn } from "../../utils/cn";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  active?: boolean;
  disabled?: boolean;
}

/**
 * GlowCard — A simplified adaptation from meet-ui extracting only the hover glow border concept.
 *
 * - Hover state: box-shadow glow using CSS variable token
 * - Active state: persistent glow without needing hover (no hover scale/glow effects)
 * - Disabled state: suppresses all hover effects
 * - Inactive hover: scale(1.02) + border glow with 200ms transition
 * - Active/disabled: no hover scale/glow effects applied
 */
export function GlowCard({
  children,
  className,
  glowColor = "var(--color-primary)",
  active = false,
  disabled = false,
}: GlowCardProps) {
  return (
    <div
      className={cn(
        "glow-card",
        "relative rounded-lg transition-all duration-300",
        active && "glow-card--active",
        !active && !disabled && "glow-card--interactive",
        disabled && "glow-card--disabled",
        className
      )}
      style={{ "--glow": glowColor } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default GlowCard;
