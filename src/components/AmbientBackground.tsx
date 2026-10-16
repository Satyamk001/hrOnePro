import React from "react";

/**
 * AmbientBackground
 *
 * Provides a fixed, multi-layered atmospheric canvas behind the app:
 * 1. Ambient dawn/amber radial mesh glow that provides chromatic depth for floating glass pills.
 * 2. Precision 24px geometric dot-matrix grid with radial vignette masking.
 * 3. Tactile matte film grain overlay that eliminates digital gradient banding.
 *
 * Runs exclusively in a fixed, non-scrolling layer (z-0, pointer-events-none) to ensure zero GPU
 * repaint overhead during main content or sidebar scrolling.
 */
export const AmbientBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Ambient Aurora Mesh Orbs */}
      <div className="ambient-glow-top" />
      <div className="ambient-glow-bottom-right" />

      {/* 2. Precision Dot-Matrix Grid */}
      <div className="ambient-dot-grid" />

      {/* 3. Subtle Film Grain / Noise */}
      <div className="ambient-noise" />
    </div>
  );
};

export default AmbientBackground;
