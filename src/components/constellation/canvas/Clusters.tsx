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
        return (
          <g key={c.label}>
            <circle
              cx={c.centerX}
              cy={c.centerY}
              r={visualR}
              fill={`url(#cluster-grad-${i})`}
              opacity={dim ? 0.18 : 1}
              style={{
                pointerEvents: "none",
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 220ms ease, r 220ms ease",
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
  return (
    <g className="cluster-labels">
      {clusters.map((c) => {
        const lines = wrapClusterLabel(c.label);
        const lineHeight = 14;
        const dx = c.centerX - CANVAS_W / 2;
        const dy = c.centerY - CANVAS_H / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const labelDist = dist + c.radius + 36;
        const margin = 16;
        let labelX = CANVAS_W / 2 + ux * labelDist;
        let labelY = CANVAS_H / 2 + uy * labelDist;
        const halfBlock = ((lines.length - 1) * lineHeight) / 2;
        if (labelY - halfBlock < margin) labelY = margin + halfBlock;
        if (labelY + halfBlock > CANVAS_H - margin)
          labelY = CANVAS_H - margin - halfBlock;
        if (labelX < margin + 80) labelX = margin + 80;
        if (labelX > CANVAS_W - margin - 80)
          labelX = CANVAS_W - margin - 80;
        const textAnchor =
          ux > 0.4 ? "start" : ux < -0.4 ? "end" : "middle";
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
            fontSize={isFocused || isHovered ? 17 : 15}
            fontStyle="italic"
            fontWeight={400}
            className="cursor-pointer"
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
              strokeWidth: 4,
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
