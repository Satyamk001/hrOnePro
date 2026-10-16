import { useEffect, type RefObject } from "react";
import type { SavedEntry } from "../types";

/** Smooth scrolling unless the user asked the OS for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

interface Params {
  containerRef: RefObject<HTMLDivElement | null>;
  itemsRef: RefObject<(HTMLButtonElement | null)[]>;
  activeItemRef: RefObject<HTMLButtonElement | null>;
  entries: SavedEntry[];
  activeKey: string | null;
}

/**
 * Cinematic episode-selector physics: a smooth Gaussian scale/opacity falloff
 * around the vertical center of the scroll container, plus auto-centering the
 * active item. DOM-geometry-coupled by design — reads rects on scroll/resize.
 */
export function useSidebarCarousel({ containerRef, itemsRef, activeItemRef, entries, activeKey }: Params): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      itemsRef.current.forEach((item) => {
        if (!item) return;
        item.style.transform = "none";
        item.style.opacity = "1";
        item.style.zIndex = "1";
      });
      return;
    }

    const updatePadding = () => {
      const containerRect = container.getBoundingClientRect();
      const halfHeight = containerRect.height / 2;
      if (halfHeight > 0) {
        container.style.paddingTop = `${halfHeight}px`;
        container.style.paddingBottom = `${halfHeight}px`;
      }
    };

    const updateVisuals = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      itemsRef.current.forEach((item) => {
        if (!item) return;
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;

        const pixelDistance = Math.abs(itemCenter - containerCenter);
        const itemHeight = item.offsetHeight || 50;
        const itemSpacing = itemHeight + 8; // approx 8px gap
        if (itemSpacing === 0) return;

        const positionDistance = pixelDistance / itemSpacing;

        // Smooth continuous Gaussian curve (eliminates piecewise robotic steps)
        const falloff = Math.exp(-0.45 * positionDistance * positionDistance);
        const scale = 0.82 + 0.24 * falloff;
        const opacity = 0.15 + 0.85 * falloff;
        const zIndex = Math.round(10 + 90 * falloff);

        item.style.transform = `scale3d(${scale.toFixed(4)}, ${scale.toFixed(4)}, 1)`;
        item.style.opacity = opacity.toFixed(3);
        item.style.zIndex = zIndex.toString();
      });
    };

    updatePadding();
    updateVisuals();

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateVisuals();
          ticking = false;
        });
        ticking = true;
      }
    };

    const onResize = () => {
      updatePadding();
      updateVisuals();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const t1 = setTimeout(updateVisuals, 50);
    const t2 = setTimeout(updateVisuals, 300);

    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [containerRef, itemsRef, entries, activeKey]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    }
  }, [activeItemRef, activeKey]);
}
