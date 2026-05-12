import type { ThemeCluster } from "../../../types/graph";
import { CANVAS_H, wrapClusterLabel } from "./helpers";

/**
 * Cluster glow circles + hit zone. The visible glow uses `cluster-grad-N`
 * from `<Defs>`. Hit zone is purely interactive — a transparent circle at
 * `cluster.radius` (slightly inside the visible glow so it doesn't overlap
 * adjacent clusters' hit zones, but much larger than the original 55px so
 * cluster clicks land reliably). Painted before nodes so node hit areas
 * (radius ~30) sit on top in the dense member area; the empty negative
 * space at cluster center catches taps that would otherwise miss between
 * nodes.
 */
export function ClusterGlows({
  clusters,
  focusedClusterLabel,
  hoveredClusterLabel,
  inGalaxyMode,
  prefersReducedMotion,
  onFocusCluster,
  onClusterEnter,
  onClusterLeave,
}: {
  clusters: ThemeCluster[];
  focusedClusterLabel: string | null;
  hoveredClusterLabel: string | null;
  inGalaxyMode: boolean;
  prefersReducedMotion: boolean;
  onFocusCluster: (label: string) => void;
  onClusterEnter: (label: string) => void;
  onClusterLeave: (label: string) => void;
}) {
  return (
    <g className="clusters">
      {clusters.map((c, i) => {
        const dim =
          focusedClusterLabel !== null && c.label !== focusedClusterLabel;
        const isFocused = c.label === focusedClusterLabel;
        const isHovered = !inGalaxyMode && c.label === hoveredClusterLabel;
        const visualR =
          c.radius * (isFocused ? 1.9 : isHovered ? 1.75 : 1.6);
        // Glow opacity ramp: nearly invisible by default (the constellation
        // lines now carry cluster identity), brightening on hover for a
        // focus hint, full at focus when galaxy mode is active. Replaces
        // the previous always-visible bubble that made the canvas read as
        // a blob chart instead of a star chart.
        // Glow opacity ramp. After Kevin's "messy when many nodes" pass on
        // 2026-05-11, the default baseline was raised so glow carries
        // cluster identity (quiet color zone) instead of relying solely
        // on the MST lines, which read as a tangled web at high node
        // counts. MSTs now whisper underneath.
        const baseOpacity = isFocused
          ? 1
          : isHovered
            ? 0.55
            : dim
              ? 0.04
              : 0.22;
        return (
          <g key={c.label}>
            <circle
              cx={c.centerX}
              cy={c.centerY}
              r={visualR}
              fill={`url(#cluster-grad-${i})`}
              opacity={baseOpacity}
              style={{
                pointerEvents: "none",
                // Decisive ease + slower duration so glow growth on hover
                // reads as deliberate rather than springy. The cluster IS
                // the visual subject so its transition is the longest.
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 380ms cubic-bezier(0.2, 0.8, 0.2, 1), r 380ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />
            <circle
              cx={c.centerX}
              cy={c.centerY}
              r={c.radius}
              fill="transparent"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onFocusCluster(c.label);
              }}
              onMouseEnter={() => onClusterEnter(c.label)}
              onMouseLeave={() => onClusterLeave(c.label)}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Single hover-revealed cluster label. Always-visible labels were dropped
 * after three rounds of placement heuristics couldn't keep them off other
 * clusters' glows on arbitrary profile shapes. Hover-only means we only
 * ever render ONE label at a time — collision resolution disappears as a
 * problem.
 *
 * Anchored below the hovered cluster (above when near the bottom edge),
 * wrapped to two lines if long. Lives inside the zoom layer so it tracks
 * pan/zoom with its cluster.
 */
export function HoverClusterLabel({
  cluster,
}: {
  cluster: ThemeCluster | null;
}) {
  if (!cluster) return null;
  const lineHeight = 16;
  const labelGap = 18;
  const lines = wrapClusterLabel(cluster.label);
  const halfBlock = ((lines.length - 1) * lineHeight) / 2;
  const wantBelow = cluster.centerY < CANVAS_H * 0.72;
  const visualR = cluster.radius * 1.75;
  const baseY = wantBelow
    ? cluster.centerY + visualR + labelGap
    : cluster.centerY - visualR - labelGap;
  return (
    <text
      x={cluster.centerX}
      y={baseY}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={cluster.color}
      fontSize={18}
      fontStyle="italic"
      fontWeight={400}
      filter="url(#label-shadow)"
      style={{
        fontFamily:
          '"Iowan Old Style", Charter, Georgia, "Times New Roman", serif',
        letterSpacing: "0.08em",
        paintOrder: "stroke fill",
        stroke: "#05060a",
        strokeWidth: 6,
        strokeLinejoin: "round",
        pointerEvents: "none",
      }}
    >
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={cluster.centerX}
          dy={i === 0 ? -halfBlock : lineHeight}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
