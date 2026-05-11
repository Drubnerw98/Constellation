import type { ThemeCluster } from "../../../types/graph";
import { CANVAS_H, CANVAS_W, wrapClusterLabel } from "./helpers";

/**
 * Cluster glow circles + small center hit zone. The visible glow uses
 * `cluster-grad-N` from `<Defs>`. Hit zone is purely interactive — a 55-
 * radius transparent circle giving a healthy click target while staying
 * smaller than typical adjacent-cluster spacing so zones don't overlap.
 * Painted before nodes so node hit areas (radius ~30) sit on top in the
 * dense member area; the empty negative space at cluster center catches
 * taps that would otherwise miss between nodes.
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
        const baseOpacity = isFocused
          ? 1
          : isHovered
            ? 0.55
            : dim
              ? 0.02
              : 0.1;
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
              r={55}
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
 * Cluster labels positioned radially outward from canvas center — past the
 * glow's outer edge, anchored away from the middle. Long labels wrap to
 * two lines via `wrapClusterLabel`. Clickable (galaxy mode trigger),
 * hoverable (cluster member highlight). Stroke-bg paintOrder keeps them
 * readable when force-directed layout pushes a label inside another
 * cluster's glow.
 */
export function ClusterLabels({
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
  // Pre-compute every label's anchor position once per render, then run
  // a quick collision-resolution pass so labels that landed on top of
  // each other in the original geometry nudge apart vertically.
  const lineHeight = 16;
  const labelGap = 28;
  const topMargin = 80;
  const sideMargin = 80;
  type Placed = {
    cluster: ThemeCluster;
    lines: string[];
    halfBlock: number;
    x: number;
    y: number;
    height: number;
    halfWidth: number;
  };
  const placed: Placed[] = clusters.map((c) => {
    const lines = wrapClusterLabel(c.label);
    const halfBlock = ((lines.length - 1) * lineHeight) / 2;
    const wantBelow = c.centerY < CANVAS_H * 0.72;
    const baseY = wantBelow
      ? c.centerY + c.radius + labelGap
      : c.centerY - c.radius - labelGap;
    let y = baseY;
    if (y - halfBlock < topMargin) y = topMargin + halfBlock;
    if (y + halfBlock > CANVAS_H - 60) y = CANVAS_H - 60 - halfBlock;
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    // Rough width estimate at 17px italic serif: ~9px per character. Good
    // enough for collision detection; we don't need exact text metrics.
    const halfWidth = (longest * 9) / 2;
    return {
      cluster: c,
      lines,
      halfBlock,
      x: c.centerX,
      y,
      height: halfBlock * 2 + lineHeight,
      halfWidth,
    };
  });
  // Iterative pass: nudge labels apart when their boxes overlap. Two
  // sweeps is usually plenty at typical cluster counts (6-8).
  for (let pass = 0; pass < 3; pass++) {
    placed.sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      const a = placed[i - 1]!;
      const b = placed[i]!;
      const dx = Math.abs(a.x - b.x);
      const horizontalOverlap = dx < a.halfWidth + b.halfWidth + 6;
      if (!horizontalOverlap) continue;
      const need = (a.height + b.height) / 2 + 4;
      const dy = b.y - a.y;
      if (dy < need) {
        const push = (need - dy) / 2;
        a.y = Math.max(topMargin + a.halfBlock, a.y - push);
        b.y = Math.min(CANVAS_H - 60 - b.halfBlock, b.y + push);
      }
    }
  }
  const placedByLabel = new Map(placed.map((p) => [p.cluster.label, p]));

  return (
    <g className="cluster-labels">
      {clusters.map((c) => {
        const p = placedByLabel.get(c.label)!;
        const { lines, halfBlock } = p;
        const labelX = p.x;
        const labelY = p.y;
        const textAnchor: "start" | "middle" | "end" =
          labelX < sideMargin
            ? "start"
            : labelX > CANVAS_W - sideMargin
              ? "end"
              : "middle";
        const isFocused = c.label === focusedClusterLabel;
        const isHovered = !inGalaxyMode && c.label === hoveredClusterLabel;
        const dim = focusedClusterLabel !== null && !isFocused;
        const opacity = isFocused
          ? 0.95
          : isHovered
            ? 0.95
            : dim
              ? 0.2
              : 0.65;
        return (
          <text
            key={c.label}
            x={labelX}
            y={labelY}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fill={c.color}
            opacity={opacity}
            fontSize={isFocused || isHovered ? 19 : 17}
            fontStyle="italic"
            fontWeight={400}
            className="cursor-pointer"
            filter="url(#label-shadow)"
            onClick={(e) => {
              e.stopPropagation();
              onFocusCluster(c.label);
            }}
            onMouseEnter={() => onClusterEnter(c.label)}
            onMouseLeave={() => onClusterLeave(c.label)}
            style={{
              fontFamily:
                '"Iowan Old Style", Charter, Georgia, "Times New Roman", serif',
              letterSpacing: "0.08em",
              paintOrder: "stroke fill",
              stroke: "#05060a",
              // Stroke bumped from 4 to 6 (2026-05-10) so the label punches
              // through when force-sim pushes a node directly over the text
              // in dense clusters. Combined with the label-shadow filter,
              // labels stay readable regardless of node overlay.
              strokeWidth: 6,
              strokeLinejoin: "round",
              transition: prefersReducedMotion
                ? "none"
                : "opacity 220ms ease, font-size 220ms ease",
            }}
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={labelX}
                dy={i === 0 ? -halfBlock : lineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
  );
}
