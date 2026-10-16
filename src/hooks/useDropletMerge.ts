import { useEffect, useRef, useCallback } from "react";

interface DropletMergeOptions {
  mainRef: React.RefObject<HTMLElement | null>;
  headerRef?: React.RefObject<HTMLElement | null>;
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
  headerRef,
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

  const initialClockWidthRef = useRef<number>(0);

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

    // Cache the compact clock width before expansion so scale calculations stay consistent
    if (scrollTop < 10 || initialClockWidthRef.current === 0) {
      initialClockWidthRef.current = clockRect.width;
    }
    const compactClockWidth = initialClockWidthRef.current || clockRect.width;

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
      clockWidth: compactClockWidth,
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

    if (headerRef?.current) {
      headerRef.current.setAttribute("data-scrolled", "false");
    }

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
      contentEl.style.filter = "none";
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
  }, [morphingRef, contentRef, sheenRef, clockPillRef, headerRef]);

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

    // Toggle topbar glass elevation based on scroll depth (> 10px)
    if (headerRef?.current) {
      const isScrolled = scrollTop > 10;
      const currentScrolled = headerRef.current.getAttribute("data-scrolled") === "true";
      if (currentScrolled !== isScrolled) {
        headerRef.current.setAttribute("data-scrolled", isScrolled ? "true" : "false");
      }
    }

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
    // PHASE 1: 0.00 – 0.28 (Today Card Dissolves into Fluid Core)
    // Blur-before-move & context fade per ui-animation craft standards
    // =========================================================================
    const contentP = Math.min(1, progress / 0.24);
    const contentOpacity = Math.max(0, 1 - Math.pow(contentP, 1.4));
    const contentScale = 1 - contentP * 0.12;
    const contentBlur = (contentP * 2.5).toFixed(1);

    // =========================================================================
    // PHASE 2: 0.00 – 0.72 (Liquid Droplet Flight & Anisotropic Stretch)
    // Sigmoidal power curve: decisive acceleration and gentle cushioning
    // =========================================================================
    const flightProgress = Math.min(1, Math.max(0, progress / 0.72));
    const moveP =
      flightProgress <= 0
        ? 0
        : flightProgress >= 1
        ? 1
        : Math.pow(flightProgress, 1.5) /
          (Math.pow(flightProgress, 1.5) + Math.pow(1 - flightProgress, 1.5));

    const translateX = deltaX * moveP;
    const translateY = deltaY * moveP;

    // Horizontal narrowing
    const scaleX = 1 - (1 - scaleXFinal) * Math.pow(flightProgress, 1.25);

    // Vertical elongation: dynamic fluid stretch peaking mid-flight
    let scaleY: number;
    if (flightProgress <= 0.42) {
      const t = flightProgress / 0.42;
      scaleY = 1.0 + 0.22 * Math.sin(t * (Math.PI / 2));
    } else {
      const t = (flightProgress - 0.42) / 0.58;
      const easeSnap = t * t * (3 - 2 * t);
      scaleY = 1.22 - (1.22 - scaleYFinal) * easeSnap;
    }

    // Teardrop morphology: leading top edge domes into apex
    const topT = Math.min(1, Math.pow(flightProgress / 0.38, 1.6));
    const bottomT = Math.min(1, Math.pow(flightProgress / 0.58, 1.6));
    const topR = Math.round(8 + (9999 - 8) * topT);
    const bottomR = Math.round(8 + (9999 - 8) * bottomT);
    const borderRadius = `${topR}px ${topR}px ${bottomR}px ${bottomR}px`;

    // Glass sheen: reflects light during flight, dissolves on absorption
    let sheenOpacity = 0;
    if (progress < 0.20) {
      sheenOpacity = progress / 0.20;
    } else if (progress < 0.66) {
      sheenOpacity = 1;
    } else if (progress < 0.78) {
      sheenOpacity = Math.max(0, (0.78 - progress) / 0.12);
    }

    // =========================================================================
    // PHASE 3: 0.66 – 0.82 (Momentum Transfer: Impact Squash & Meniscus Glow)
    // Continuous kinetic handoff — no dead zone before expansion
    // =========================================================================
    let dropletOpacity = 1;
    if (progress < 0.66) {
      dropletOpacity = 1;
    } else if (progress < 0.78) {
      const absorb = (progress - 0.66) / 0.12;
      dropletOpacity = Math.max(0, 1 - absorb);
    } else {
      dropletOpacity = 0;
    }

    let pillScaleX = 1.0;
    let pillScaleY = 1.0;
    let glowAlpha = 0;
    let glowRadius = 0;

    if (progress >= 0.66 && progress < 0.82) {
      const u = (progress - 0.66) / 0.16;
      const impactWave = Math.sin(u * Math.PI);
      pillScaleX = 1.0 + 0.05 * impactWave;
      pillScaleY = 1.0 - 0.045 * impactWave;
      glowAlpha = 0.36 * impactWave;
      glowRadius = Math.round(18 * impactWave);
    }

    if (pillScaleX !== 1.0 || pillScaleY !== 1.0) {
      clockPillEl.style.transform = `scale3d(${pillScaleX.toFixed(4)}, ${pillScaleY.toFixed(4)}, 1)`;
    } else {
      clockPillEl.style.transform = "none";
    }

    if (glowRadius > 0) {
      clockPillEl.style.boxShadow = `0 0 ${glowRadius}px rgba(217, 119, 6, ${glowAlpha.toFixed(3)}), 0 4px 16px rgba(0, 0, 0, 0.08)`;
    } else {
      clockPillEl.style.boxShadow = "";
    }

    // =========================================================================
    // PHASE 4: 0.72 – 1.00 (Elastic Pill Expansion & Wave Metric Unpacking)
    // Expansion launches directly out of peak impact compression
    // =========================================================================
    let compactOpacity = 1;
    if (progress >= 0.62 && progress < 0.74) {
      compactOpacity = Math.max(0, 1 - (progress - 0.62) / 0.12);
    } else if (progress >= 0.74) {
      compactOpacity = 0;
    }

    let expandP = 0;
    if (progress >= 0.72) {
      const e = (progress - 0.72) / 0.28;
      expandP = Math.min(1, Math.max(0, e * e * (3 - 2 * e)));
    }

    // Staggered wave unpacking with cubic ease-out
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    const r1 = Math.min(1, Math.max(0, (expandP - 0.00) / 0.38));
    const r2 = Math.min(1, Math.max(0, (expandP - 0.18) / 0.38));
    const r3 = Math.min(1, Math.max(0, (expandP - 0.36) / 0.38));
    const r4 = Math.min(1, Math.max(0, (expandP - 0.54) / 0.38));

    const m1 = easeOutCubic(r1);
    const m2 = easeOutCubic(r2);
    const m3 = easeOutCubic(r3);
    const m4 = easeOutCubic(r4);

    clockPillEl.style.setProperty("--expand-p", expandP.toFixed(4));
    clockPillEl.style.setProperty("--compact-opacity", compactOpacity.toFixed(3));
    clockPillEl.style.setProperty("--metric-1-op", m1.toFixed(3));
    clockPillEl.style.setProperty("--metric-2-op", m2.toFixed(3));
    clockPillEl.style.setProperty("--metric-3-op", m3.toFixed(3));
    clockPillEl.style.setProperty("--metric-4-op", m4.toFixed(3));

    // =========================================================================
    // Apply Styles to Morphing Droplet
    // =========================================================================
    morphingEl.style.transform = `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale3d(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)}, 1)`;
    morphingEl.style.borderRadius = borderRadius;
    morphingEl.style.opacity = dropletOpacity.toFixed(3);
    morphingEl.style.zIndex = "25";
    morphingEl.style.pointerEvents = progress > 0.15 ? "none" : "auto";

    contentEl.style.opacity = contentOpacity.toFixed(3);
    contentEl.style.transform = `scale3d(${contentScale.toFixed(4)}, ${contentScale.toFixed(4)}, 1)`;
    contentEl.style.filter = contentP > 0.04 ? `blur(${contentBlur}px)` : "none";

    if (sheenEl) {
      sheenEl.style.opacity = sheenOpacity.toFixed(3);
    }
  }, [mainRef, headerRef, morphingRef, contentRef, sheenRef, clockPillRef, measure, resetStyles]);

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
