import { useRef } from "react";
import type { SavedEntry } from "../../types";
import { scrollBehavior, useSidebarCarousel } from "../../hooks/useSidebarCarousel";

interface Props {
  sortedEntries: SavedEntry[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}

/** Cinematic episode selector — one card per stored month. */
export default function EpisodeSidebar({ sortedEntries, activeKey, onSelect }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useSidebarCarousel({ containerRef: scrollContainerRef, itemsRef, activeItemRef, entries: sortedEntries, activeKey });

  return (
    <aside className="w-full xl:w-[22%] xl:max-w-[340px] lg:w-[25%] lg:max-w-[320px] md:w-[30%] md:max-w-[300px] shrink-0 flex flex-col overflow-hidden z-10 max-md:h-auto max-md:min-h-[100px] max-md:max-h-[60vh] md:h-full relative">
      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {sortedEntries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate text-center">No data yet</p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hidden relative max-md:max-h-[35vh] sidebar-carousel-mask sidebar-scroll-container"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="flex flex-col items-center w-full gap-[8px]">
              {sortedEntries.map((entry, index) => {
                const isActive = activeKey === entry.key;

                return (
                  <button
                    key={entry.key}
                    ref={(el) => {
                      if (isActive) activeItemRef.current = el;
                      itemsRef.current[index] = el;
                    }}
                    onClick={(e) => {
                      onSelect(entry.key);
                      e.currentTarget.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
                    }}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={`${entry.label}${isActive ? " (selected)" : ""}`}
                    className="sidebar-episode-btn cursor-pointer block text-left rounded-lg snap-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    style={{
                      width: '72%',
                      maxWidth: '230px',
                      transformOrigin: 'center center',
                      willChange: 'transform, opacity',
                    }}
                  >
                    <div
                      data-active={isActive ? "true" : "false"}
                      className={`sidebar-card relative rounded-lg overflow-hidden border w-full max-w-full active:scale-[0.98] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out ${
                        isActive
                          ? "border-primary shadow-lg shadow-primary/20"
                          : "border-hairline hover:border-hairline-strong hover:bg-surface/50"
                      }`}
                    >
                      <div
                        className={`px-3 py-2 flex items-start gap-x-2.5 w-full min-w-0 transition-colors duration-200 ${
                          isActive ? "bg-primary/20" : "bg-canvas/50"
                        }`}
                      >
                        {/* Number badge */}
                        <div
                          className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center font-bold text-[12px] mt-0.5 transition-colors duration-200 ${
                            isActive
                              ? "bg-primary text-white"
                              : "bg-hairline-soft text-steel"
                          }`}
                        >
                          {index + 1}
                        </div>
                        {/* Title + date */}
                        <div className="flex-1 min-w-0 overflow-hidden text-left">
                          <h4
                            className={`text-[12px] font-semibold leading-snug transition-colors duration-200 ${
                              isActive
                                ? "line-clamp-none whitespace-normal break-words text-ink"
                                : "line-clamp-1 truncate text-slate"
                            }`}
                          >
                            {entry.label}
                          </h4>
                          <p className="text-[10px] text-stone mt-0.5 truncate">
                            {entry.key}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
