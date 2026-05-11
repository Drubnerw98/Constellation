import type { ThemeCluster } from "../../types/graph";

/**
 * Corner legend listing every theme cluster with a color swatch and label.
 * Replaces always-visible on-canvas labels: at-a-glance "what are my
 * themes?" without paying the collision-resolution tax that made the
 * on-canvas labels unsuitable for arbitrary profile shapes.
 *
 * Clicking a row mirrors clicking the cluster's glow (flies into galaxy
 * mode). Hover on a row highlights the corresponding cluster on the
 * canvas via the same `hoveredClusterLabel` pathway clusters use.
 *
 * Positioned as an HTML overlay (top-right, mirroring the bottom-left
 * Reset button) so it doesn't scale with the viewBox.
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
  if (clusters.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 max-w-[280px] md:right-4 md:top-4">
      <div className="pointer-events-auto rounded-md border border-white/10 bg-[var(--color-surface)]/85 p-2 backdrop-blur-md">
        <div className="px-1 pb-1 font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase">
          Themes
        </div>
        <ul className="space-y-0.5">
          {clusters.map((c) => {
            const isFocused = c.label === focusedClusterLabel;
            const isHovered = !inGalaxyMode && c.label === hoveredClusterLabel;
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
      </div>
    </div>
  );
}
