import React from "react";
import { cn } from "../../utils/cn";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * ShinyButton — A button with an animated shimmer sweep on hover.
 * Simplified adaptation of meet-ui's shiny-cta component.
 * Uses a span overlay with CSS transition for the shimmer effect.
 */
export function ShinyButton({
  children,
  className,
  disabled,
  ...props
}: ShinyButtonProps) {
  return (
    <button
      className={cn(
        "group relative overflow-hidden",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {/* Shimmer overlay span */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -translate-x-full",
          "bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]",
          "transition-transform duration-700 ease-in-out",
          !disabled && "group-hover:translate-x-full"
        )}
      />
      {/* Button content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
