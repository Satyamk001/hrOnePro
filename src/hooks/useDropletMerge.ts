import { useEffect, useRef, useCallback } from "react";

interface DropletMergeOptions {
  mainRef: React.RefObject<HTMLElement | null>;
  clockPillRef: React.RefObject<HTMLElement | null>;
  placeholderRef: React.RefObject<HTMLDivElement | null>;
  morphingRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  sheenRef: React.RefObject<HTMLDivElement | null>;
  active?: boolean;
}

interface Geometry {
  clockCenterX: number;
  clockCenterY: number;
  clockWidth: number;
  clockHeight: number;
  cardCenterX: number;
  cardCenterY0: number;
  cardWidth: number;
  cardHeight: number;
  threshold: number;
}

export function useDropletMerge({
  mainRef,
  clockPillRef,
  placeholderRef,
  morphingRef,
  contentRef,
  sheenRef,
  active = true,
}: DropletMergeOptions) {
  const geometryRef = useRef<Geometry | null>(null);
  const rafIdRef = useRef<number>(0);
  const isReducedMotionRef = useRef<boolean>(false);

  const measure = useCallback(() => {
    if (!mainRef.current || !clockPillRef.current || !placeholderRef.current) {
      geometryRef.current = null;
      return;
    }

    const mainEl = mainRef.current;
    const clockEl = clockPillRef.current;
    const placeholderEl = placeholderRef.current;

    const clockRect = clockEl.getBoundingClientRect();
    const placeholderRect = placeholderEl.getBoundingClientRect();
    const scrollTop = mainEl.scrollTop;

    // Clock center in viewport coordinates
    const clockCenterX = clockRect.left + clockRect.width / 2;
    const clockCenterY = clockRect.top + clockRect.height / 2;

    // Card center at scrollTop = 0 in viewport coordinates
    const cardCenterX = placeholderRect.left + placeholderRect.width / 2;
    const cardCenterY0 = placeholderRect.top + scrollTop + placeholderRect.height / 2;

    // Dynamic scroll threshold: calibrated to when card reaches topbar
    const distanceToClock = cardCenterY0 - clockCenterY;
    const threshold = Math.max(150, Math.min(280, distanceToClock + 10));

    geometryRef.current = {
      clockCenterX,
      clockCenterY,
      clockWidth: clockRect.width,
      clockHeight: clockRect.height,
      cardCenterX,
      cardCenterY0,
      cardWidth: placeholderRect.width,
      cardHeight: placeholderRect.height,
      threshold,
    };
  }, [mainRef, clockPillRef, placeholderRef]);

  const resetStyles = useCallback(() => {
    const morphingEl = morphingRef.current;
    const contentEl = contentRef.current;
    const sheenEl = sheenRef.current;
    const clockPillEl = clockPillRef.current;

    if (morphingEl) {
      morphingEl.style.transform = "none";
      morphingEl.style.borderRadius = "";
      morphingEl.style.opacity = "1";
      morphingEl.style.pointerEvents = "auto";
      morphingEl.style.zIndex = "";
    }
    if (contentEl) {
      contentEl.style.opacity = "1";
      contentEl.style.transform = "none";
    }
    if (sheenEl) {
      sheenEl.style.opacity = "0";
    }
    if (clockPillEl) {
      clockPillEl.style.transform = "none";
      clockPillEl.style.boxShadow = "";
      clockPillEl.style.setProperty("--expand-p", "0");
      clockPillEl.style.setProperty("--compact-opacity", "1");
      clockPillEl.style.setProperty("--metric-1-op", "0");
      clockPillEl.style.setProperty("--metric-2-op", "0");
      clockPillEl.style.setProperty("--metric-3-op", "0");
      clockPillEl.style.setProperty("--metric-4-op", "0");
    }
  }, [morphingRef, contentRef, sheenRef, clockPillRef]);

  const updateAnimation = useCallback(() => {
    rafIdRef.current = 0;

    if (isReducedMotionRef.current) {
      resetStyles();
      return;
    }

    const mainEl = mainRef.current;
    const morphingEl = morphingRef.current;
    const contentEl = contentRef.current;
    const sheenEl = sheenRef.current;
    const clockPillEl = clockPillRef.current;

    if (!mainEl || !morphingEl || !contentEl || !clockPillEl) return;

    if (!geometryRef.current) {
      measure();
      if (!geometryRef.current) return;
    }

    const geo = geometryRef.current;
    const scrollTop = mainEl.scrollTop;
    const progress = Math.min(1, Math.max(0, scrollTop / geo.threshold));

    if (progress <= 0) {
      resetStyles();
      return;
    }

    // Current unshifted card center in viewport coordinates
    const currentCardCenterX = geo.cardCenterX;
    const currentCardCenterY = geo.cardCenterY0 - scrollTop;

    const deltaX = geo.clockCenterX - currentCardCenterX;
    const deltaY = geo.clockCenterY - currentCardCenterY;

    const scaleXFinal = Math.max(0.1, geo.clockWidth / geo.cardWidth);
    const scaleYFinal = Math.max(0.1, geo.clockHeight / geo.cardHeight);

    // =========================================================================
    // PHASE 1: 0.00 – 0.30 (Today Card Content Dissolves & Detaches)
    // =========================================================================
    const contentP = Math.min(1, progress / 0.28);
    const contentOpacity = Math.max(0, 1 - contentP);
    const contentScale = 1 - contentP * 0.15;

    // =========================================================================
    // PHASE 2: 0.00 – 0.70 (Droplet Shapes & Travels Toward Clock Pill)
    // =========================================================================
    // Flight progress normalized to 0.00 -> 0.70
    const flightProgress = Math.min(1, Math.max(0, progress / 0.70));
    const moveP = flightProgress < 0.5
      ? 4 * flightProgress * flightProgress * flightProgress
      : 1 - Math.pow(-2 * flightProgress + 2, 3) / 2;

    const translateX = deltaX * moveP;
    const translateY = deltaY * moveP;

    // Horizontal scale: narrows progressively as it travels upward
    const scaleX = 1 - (1 - scaleXFinal) * Math.pow(flightProgress, 1.15);

    // Vertical scale: Liquid Stretch / Teardrop Elongation
    let scaleY: number;
    if (flightProgress <= 0.45) {
      const t = flightProgress / 0.45;
      scaleY = 1.0 + 0.16 * Math.sin(t * (Math.PI / 2));
    } else {
      const t = (flightProgress - 0.45) / 0.55;
      const easeSnap = t * t * (3 - 2 * t);
      scaleY = 1.16 - (1.16 - scaleYFinal) * easeSnap;
    }

    // Border radius: leading top edge domes faster into droplet apex
    const topT = Math.min(1, Math.pow(flightProgress / 0.45, 2));
    const bottomT = Math.min(1, Math.pow(flightProgress / 0.65, 2));
    const topR = Math.round(8 + (9999 - 8) * topT);
    const bottomR = Math.round(8 + (9999 - 8) * bottomT);
    const borderRadius = `${topR}px ${topR}px ${bottomR}px ${bottomR}px`;

    // Sheen is visible during flight
    let sheenOpacity = 0;
    if (progress < 0.70) {
      sheenOpacity = Math.min(1, progress * 3.5);
    } else if (progress < 0.82) {
      sheenOpacity = Math.max(0, (0.82 - progress) / 0.12);
    }

    // =========================================================================
    // PHASE 3: 0.70 – 0.82 (Absorption & Clock Pill Impact Compression)
    // =========================================================================
    let dropletOpacity = 1;
    if (progress < 0.70) {
      dropletOpacity = 1;
    } else if (progress < 0.82) {
      const absorb = (progress - 0.70) / 0.12;
      dropletOpacity = Math.max(0, 1 - absorb);
    } else {
      dropletOpacity = 0;
    }

    // Impact compression on clock pill
    if (progress >= 0.70 && progress < 0.82) {
      const u = (progress - 0.70) / 0.12;
      const impactWave = Math.sin(u * Math.PI);
      const pillScaleX = 1.0 + 0.05 * impactWave;
      const pillScaleY = 1.0 - 0.04 * impactWave;
      clockPillEl.style.transform = `scale(${pillScaleX.toFixed(4)}, ${pillScaleY.toFixed(4)})`;

      const glowAlpha = (0.38 * impactWave).toFixed(3);
      const glowRadius = Math.round(18 * impactWave);
      clockPillEl.style.boxShadow = `0 0 ${glowRadius}px rgba(217, 119, 6, ${glowAlpha}), 0 4px 16px rgba(0, 0, 0, 0.08)`;
    } else {
      clockPillEl.style.transform = "none";
      clockPillEl.style.boxShadow = "";
    }

    // =========================================================================
    // PHASE 4: 0.82 – 1.00 (Clock Pill Horizontally Expands & Reveals Today Metrics)
    // =========================================================================
    let expandP = 0;
    let compactOpacity = 1;

    if (progress >= 0.82) {
      const e = (progress - 0.82) / 0.18;
      // Smooth cubic expansion
      expandP = e * e * (3 - 2 * e);
      compactOpacity = 0;
    } else if (progress >= 0.70) {
      const u = (progress - 0.70) / 0.12;
      compactOpacity = Math.max(0, 1 - u * 1.5);
    }

    // Staggered metric groups reveal:
    // 1. Worked so far: 0.00 -> 0.35
    // 2. Punches: 0.20 -> 0.55
    // 3. Shift: 0.40 -> 0.75
    // 4. Can leave at: 0.60 -> 0.95
    const m1 = Math.min(1, Math.max(0, (expandP - 0.00) / 0.35));
    const m2 = Math.min(1, Math.max(0, (expandP - 0.20) / 0.35));
    const m3 = Math.min(1, Math.max(0, (expandP - 0.40) / 0.35));
    const m4 = Math.min(1, Math.max(0, (expandP - 0.60) / 0.35));

    clockPillEl.style.setProperty("--expand-p", expandP.toFixed(4));
    clockPillEl.style.setProperty("--compact-opacity", compactOpacity.toFixed(3));
    clockPillEl.style.setProperty("--metric-1-op", m1.toFixed(3));
    clockPillEl.style.setProperty("--metric-2-op", m2.toFixed(3));
    clockPillEl.style.setProperty("--metric-3-op", m3.toFixed(3));
    clockPillEl.style.setProperty("--metric-4-op", m4.toFixed(3));

    // =========================================================================
    // Apply Styles to Morphing Droplet
    // =========================================================================
    morphingEl.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    morphingEl.style.borderRadius = borderRadius;
    morphingEl.style.opacity = dropletOpacity.toFixed(3);
    morphingEl.style.zIndex = "25";
    morphingEl.style.pointerEvents = progress > 0.2 ? "none" : "auto";

    contentEl.style.opacity = contentOpacity.toFixed(3);
    contentEl.style.transform = `scale(${contentScale.toFixed(4)})`;

    if (sheenEl) {
      sheenEl.style.opacity = sheenOpacity.toFixed(3);
    }
  }, [mainRef, morphingRef, contentRef, sheenRef, clockPillRef, measure, resetStyles]);

  const onScroll = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(updateAnimation);
  }, [updateAnimation]);

  useEffect(() => {
    if (!active) {
      resetStyles();
      return;
    }

    // Check prefers-reduced-motion
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotionRef.current = mql.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      isReducedMotionRef.current = e.matches;
      if (e.matches) resetStyles();
      else updateAnimation();
    };
    mql.addEventListener("change", onMotionChange);

    // Initial measurement
    const timer = setTimeout(measure, 50);

    const mainEl = mainRef.current;
    if (mainEl) {
      mainEl.addEventListener("scroll", onScroll, { passive: true });
    }

    const onResize = () => {
      measure();
      updateAnimation();
    };
    window.addEventListener("resize", onResize, { passive: true });

    // ResizeObserver for dynamic layout shifts
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        measure();
        updateAnimation();
      });
      if (placeholderRef.current) ro.observe(placeholderRef.current);
      if (clockPillRef.current) ro.observe(clockPillRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      mql.removeEventListener("change", onMotionChange);
      if (mainEl) {
        mainEl.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
      resetStyles();
    };
  }, [active, mainRef, placeholderRef, clockPillRef, measure, onScroll, updateAnimation, resetStyles]);

  return { measure, updateAnimation };
}
