import type * as d3 from "d3";
import type { GraphNode } from "../../../types/graph";
import { CANVAS_H, CANVAS_W, NODE_RADIUS, nodeSizeMultiplier } from "./helpers";

/**
 * Dashed ring around the selected node. Lives outside the zoom layer so
 * its size and stroke stay constant in screen pixels — it tracks the
 * zoomed node position via `transform.applyX/Y` but doesn't scale.
 */
export function SelectedRing({
  node,
  transform,
  color,
}: {
  node: GraphNode | null;
  transform: d3.ZoomTransform;
  color: string;
}) {
  if (!node) return null;
  return (
    <circle
      cx={transform.applyX(node.x ?? 0)}
      cy={transform.applyY(node.y ?? 0)}
      r={NODE_RADIUS * 2.4 * nodeSizeMultiplier(node) * transform.k}
      fill="none"
      stroke={color}
      strokeWidth={1}
      strokeOpacity={0.6}
      strokeDasharray="3 3"
      style={{ pointerEvents: "none" }}
    />
  );
}

/**
 * Hover tooltip with title, format/year, rating or match score. Same
 * out-of-zoom-layer pattern as `<SelectedRing>`. Auto-flips placement to
 * keep the tooltip on-canvas.
 */
export function NodeTooltip({
  node,
  transform,
}: {
  node: GraphNode | null;
  transform: d3.ZoomTransform;
}) {
  if (!node) return null;
  const TOOLTIP_W = 220;
  const TOOLTIP_H = 60;
  const OFFSET = 14;
  const nx = transform.applyX(node.x ?? 0);
  const ny = transform.applyY(node.y ?? 0);
  const placeRight = nx < CANVAS_W / 2;
  const placeBelow = ny < CANVAS_H / 2;
  const tx = placeRight ? nx + OFFSET : nx - OFFSET - TOOLTIP_W;
  const ty = placeBelow ? ny + OFFSET : ny - OFFSET - TOOLTIP_H;
  return (
    <foreignObject
      x={tx}
      y={ty}
      width={TOOLTIP_W}
      height={TOOLTIP_H}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <div
        className="rounded-md border border-white/10 bg-[#0b0f1a]/95 px-3 py-1.5 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur"
        style={{ width: "fit-content", maxWidth: 220 }}
      >
        <div className="text-sm font-medium text-white">{node.title}</div>
        <div className="mt-0.5 text-[11px] text-zinc-400">
          {node.mediaType}
          {node.year ? ` · ${node.year}` : ""}
          {node.rating !== null
            ? ` · ${node.rating}★`
            : node.matchScore !== null
              ? ` · ${Math.round(node.matchScore * 100)}% match`
              : ""}
        </div>
      </div>
    </foreignObject>
  );
}

/**
 * Reset View button + double-tap hint, HTML overlay (not foreignObject)
 * so they don't scale with the viewBox. Mobile: top-left (bottom-sheet
 * panels would cover bottom positions). md+: bottom-left.
 */
export function ResetButton({
  visible,
  inGalaxyMode,
  onReset,
}: {
  visible: boolean;
  inGalaxyMode: boolean;
  onReset: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-30 flex items-center gap-2 md:top-auto md:bottom-4 md:left-4">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
        className="pointer-events-auto cursor-pointer rounded-md border border-white/10 bg-[var(--color-surface)] px-3.5 py-2.5 font-mono text-[11px] tracking-[0.18em] text-zinc-300 uppercase backdrop-blur-md transition-colors hover:border-white/20 hover:text-zinc-100"
      >
        {inGalaxyMode ? "← Back" : "↺ Reset"}
      </button>
      <span className="font-mono text-[9px] tracking-[0.2em] text-zinc-600 uppercase">
        or 2× tap
      </span>
    </div>
  );
}
