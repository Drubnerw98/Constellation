import { useEffect, useState } from "react";
import type { ThemeCluster } from "../../types/graph";

const STORAGE_KEY = "constellation:legend-open";

/**
 * Collapsible legend listing every theme cluster with a color swatch and
 * label. Replaces always-visible on-canvas labels: at-a-glance "what are
 * my themes?" without paying the placement tax that made on-canvas labels
 * unworkable on arbitrary profile shapes.
 *
 * Positioned top-left below the search input (md+ only — mobile uses the
 * cluster panel for theme info). Was previously top-right but that
 * collided with the Constellation wordmark. Collapsible via a chevron so
 * the legend can step out of the way when the user wants the unobstructed
 * canvas. Open state persists in localStorage.
 *
 * Click a row to flyToCluster; hover to highlight on canvas via the same
 * `hoveredClusterLabel` pathway clusters use.
 */
export function ClusterLegend({
  clusters,
  focusedClusterLabel,
  hoveredClusterLabel,
  inGalaxyMode,
  onFocusCluster,
  onClusterEnter,
  onClusterLeave,
}: {
  clusters: ThemeCluster[];
  focusedClusterLabel: string | null;
  hoveredClusterLabel: string | null;
  inGalaxyMode: boolean;
  onFocusCluster: (label: string) => void;
  onClusterEnter: (label: string) => void;
  onClusterLeave: (label: string) => void;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  if (clusters.length === 0) return null;

  return (
    <div className="pointer-events-none absolute top-16 left-4 z-10 hidden w-[280px] md:block">
      <div className="pointer-events-auto rounded-md border border-white/10 bg-[var(--color-surface)]/85 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="cluster-legend-list"
          className="flex w-full items-center justify-between px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase transition-colors hover:text-zinc-300"
        >
          <span>Themes ({clusters.length})</span>
          <Chevron open={open} />
        </button>
        {open && (
          <ul
            id="cluster-legend-list"
            className="space-y-0.5 border-t border-white/10 p-2"
          >
            {clusters.map((c) => {
              const isFocused = c.label === focusedClusterLabel;
              const isHovered =
                !inGalaxyMode && c.label === hoveredClusterLabel;
              const dim = focusedClusterLabel !== null && !isFocused;
              return (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusCluster(c.label);
                    }}
                    onMouseEnter={() => onClusterEnter(c.label)}
                    onMouseLeave={() => onClusterLeave(c.label)}
                    className={
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-[12px] leading-snug transition-colors " +
                      (isFocused || isHovered
                        ? "bg-white/8 text-zinc-100"
                        : dim
                          ? "text-zinc-500 hover:text-zinc-300"
                          : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100")
                    }
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: c.color,
                        boxShadow: `0 0 8px ${c.color}40`,
                      }}
                    />
                    <span className="font-display italic">{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 180ms ease",
      }}
    >
      <path d="M2 3.5 5 6.5 8 3.5" />
    </svg>
  );
}
