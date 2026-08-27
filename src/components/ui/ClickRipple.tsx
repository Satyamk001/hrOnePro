import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface ClickRippleProps {
  children: React.ReactNode;
  /** Size of the ripple ring at full expansion (default: 60, fits 32px button) */
  rippleSize?: number;
  /** Duration of ripple animation in ms (default: 600) */
  duration?: number;
  /** Color of the ripple ring (default: "var(--color-primary)") */
  color?: string;
  /** Whether ripple is disabled */
  disabled?: boolean;
}

export const ClickRipple = ({
  children,
  rippleSize = 60,
  duration = 600,
  color = "var(--color-primary)",
  disabled = false,
}: ClickRippleProps) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idCounterRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const id = idCounterRef.current++;
      const newRipple: Ripple = { id, x, y };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, duration + 100);
    },
    [disabled, duration]
  );

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: duration / 1000,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              position: "absolute",
              left: ripple.x - rippleSize / 2,
              top: ripple.y - rippleSize / 2,
              width: rippleSize,
              height: rippleSize,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              boxShadow: `0 0 20px ${color}60, inset 0 0 20px ${color}30`,
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
