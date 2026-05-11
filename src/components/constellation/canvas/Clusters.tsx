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
  // Greedy angular placement. Pure vertical pushing couldn't resolve
  // clusters stacked in the same vertical band — both labels wanted the
  // same Y zone and the margins limited how far they could push. New
  // approach: each label picks a position AROUND its cluster's perimeter
  // by trying the outward-radial direction first, then rotated
  // alternatives. Heaviest clusters claim space first so important
  // labels get the best slot.
  const lineHeight = 16;
  const labelGap = 16;
  const topMargin = 80;
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

  // Rectangle-intersect with a buffer on each axis. Bounding box is
  // centered at (x, y) — text-anchor doesn't affect collision because
  // halfWidth measures the box from its center.
  const intersects = (a: Placed, b: Placed): boolean =>
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + 10 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 8;

  // Process clusters heaviest-first so the dominant label gets the best
  // position. Lighter clusters' labels flex around what's already placed.
  const order = clusters
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight);

  // Angular candidates: outward-radial direction first, then ±15°, ±30°,
  // ±45°, ±60°, ±90°, ±120°, ±150°, 180°. Eighteen options around the
  // cluster — enough to find clear space in any realistic profile.
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

    let chosen: Placed | null = null;
    let fallback: Placed | null = null;
    let fallbackCollisions = Infinity;

    for (const delta of angleDeltas) {
      const angle = outwardAngle + delta;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Offset is cluster radius + a small gap, padded by halfWidth /
      // halfHeight in the relevant axis so the label's nearest edge sits
      // outside the cluster glow rather than overlapping it. The padding
      // tapers smoothly as the angle rotates between horizontal and
      // vertical via |cosA| / |sinA|.
      const offset =
        c.radius +
        labelGap +
        halfWidth * Math.abs(cosA) +
        halfHeight * Math.abs(sinA);
      let x = c.centerX + cosA * offset;
      let y = c.centerY + sinA * offset;
      // Clamp center so the bounding box stays inside the safe canvas.
      x = Math.max(sideMargin + halfWidth, Math.min(CANVAS_W - sideMargin - halfWidth, x));
      y = Math.max(topMargin + halfHeight, Math.min(CANVAS_H - bottomMargin - halfHeight, y));

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

      let collisions = 0;
      for (const p of placedSparse) {
        if (p && intersects(p, candidate)) collisions++;
      }
      if (collisions === 0) {
        chosen = candidate;
        break;
      }
      if (collisions < fallbackCollisions) {
        fallbackCollisions = collisions;
        fallback = candidate;
      }
    }

    placedSparse[i] = chosen ?? fallback!;
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
