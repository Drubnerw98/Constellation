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
  // Greedy angular placement with multi-axis scoring. Each cluster tries
  // ~17 candidate angles around its perimeter and picks the one with the
  // best score across THREE penalties:
  //
  //   1. Label-label collision (already-placed labels) — hardest weight.
  //   2. Cluster overlap (the label's box sits over another cluster's
  //      glow/nodes — what was happening before this rewrite).
  //   3. Off-canvas (box would spill past the safe area) — soft weight,
  //      and we also bias toward the outward-radial direction so labels
  //      naturally fan out from the spiral.
  //
  // Heaviest clusters claim space first so the dominant labels get the
  // best slot. Labels stay at a fixed offset from their cluster so the
  // label-to-cluster association is unambiguous.
  const lineHeight = 16;
  const labelGap = 24;
  const topMargin = 70;
  const sideMargin = 60;
  const bottomMargin = 60;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  type Placed = {
    cluster: ThemeCluster;
    lines: string[];
    halfBlock: number;
    x: number;
    y: number;
    height: number;
    halfWidth: number;
    textAnchor: "start" | "middle" | "end";
  };

  const intersectsLabel = (a: Placed, b: Placed): boolean =>
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + 10 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 8;

  // True when a label's bounding box overlaps a cluster's glow circle.
  // Uses circle-rect distance: the closest point on the rect to the
  // cluster center is within the cluster radius (plus a small pad).
  const overlapsClusterGlow = (
    x: number,
    y: number,
    halfWidth: number,
    halfHeight: number,
    other: ThemeCluster,
    pad: number,
  ): boolean => {
    const closestX = Math.max(x - halfWidth, Math.min(x + halfWidth, other.centerX));
    const closestY = Math.max(y - halfHeight, Math.min(y + halfHeight, other.centerY));
    const dx = closestX - other.centerX;
    const dy = closestY - other.centerY;
    const r = other.radius + pad;
    return dx * dx + dy * dy < r * r;
  };

  // Process clusters heaviest-first.
  const order = clusters
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight);

  // Angular candidates: outward direction first, then ±15°, ±30°, ±45°,
  // ±60°, ±90°, ±120°, ±150°, 180°. Seventeen options around the cluster.
  const angleDeltas: number[] = [0];
  for (let step = 1; step <= 8; step++) {
    angleDeltas.push((step * Math.PI) / 12);
    angleDeltas.push(-(step * Math.PI) / 12);
  }
  angleDeltas.push(Math.PI);

  const placedSparse: (Placed | undefined)[] = new Array(clusters.length);
  for (const { c, i } of order) {
    const lines = wrapClusterLabel(c.label);
    const halfBlock = ((lines.length - 1) * lineHeight) / 2;
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    const halfWidth = (longest * 11) / 2;
    const height = halfBlock * 2 + lineHeight;
    const halfHeight = height / 2;

    const outwardAngle = Math.atan2(c.centerY - cy, c.centerX - cx);

    let bestScore = Infinity;
    let bestCandidate: Placed | null = null;

    for (const delta of angleDeltas) {
      const angle = outwardAngle + delta;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Offset along the chosen direction. The padding terms
      // (halfWidth * |cos|, halfHeight * |sin|) keep the nearest edge of
      // the label box outside the cluster glow regardless of angle.
      const offset =
        c.radius +
        labelGap +
        halfWidth * Math.abs(cosA) +
        halfHeight * Math.abs(sinA);
      const x = c.centerX + cosA * offset;
      const y = c.centerY + sinA * offset;

      // Off-canvas penalty (in pixels of overflow on each axis).
      const offLeft = Math.max(0, sideMargin + halfWidth - x);
      const offRight = Math.max(0, x + halfWidth - (CANVAS_W - sideMargin));
      const offTop = Math.max(0, topMargin + halfHeight - y);
      const offBottom = Math.max(0, y + halfHeight - (CANVAS_H - bottomMargin));
      const offCanvasPenalty = offLeft + offRight + offTop + offBottom;

      const textAnchor: "start" | "middle" | "end" =
        Math.abs(cosA) > 0.6
          ? cosA > 0
            ? "start"
            : "end"
          : "middle";

      const candidate: Placed = {
        cluster: c,
        lines,
        halfBlock,
        x,
        y,
        height,
        halfWidth,
        textAnchor,
      };

      let labelCollisions = 0;
      for (const p of placedSparse) {
        if (p && intersectsLabel(p, candidate)) labelCollisions++;
      }

      let clusterOverlaps = 0;
      for (const other of clusters) {
        if (other === c) continue;
        if (overlapsClusterGlow(x, y, halfWidth, halfHeight, other, 8))
          clusterOverlaps++;
      }

      // Score: label-on-label is the worst (10000), cluster overlap next
      // (4000 each), off-canvas pixels are linear (2 per px), and a
      // small angular-deviation bonus prefers the outward direction so
      // the figure reads as a coherent radial layout.
      const score =
        labelCollisions * 10000 +
        clusterOverlaps * 4000 +
        offCanvasPenalty * 2 +
        Math.abs(delta) * 3;

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        if (score < Math.abs(delta) * 3 + 0.5) break; // perfect fit
      }
    }

    placedSparse[i] = bestCandidate!;
  }

  const placedByLabel = new Map(
    placedSparse
      .filter((p): p is Placed => p !== undefined)
      .map((p) => [p.cluster.label, p]),
  );

  return (
    <g className="cluster-labels">
      {clusters.map((c) => {
        const p = placedByLabel.get(c.label)!;
        const { lines, halfBlock, textAnchor } = p;
        const labelX = p.x;
        const labelY = p.y;
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
