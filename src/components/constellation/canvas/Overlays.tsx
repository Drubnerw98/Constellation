import type * as d3 from "d3";
import type { GraphNode } from "../../../types/graph";
import { NODE_RADIUS, nodeSizeMultiplier } from "./helpers";

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
 * In-canvas hover labels for the focused node and its connected neighbors.
 *
 * Kevin's UX feedback on 2026-05-11: the previous tooltip floated to the
 * canvas corner (foreignObject + corner-snap) which read as detached when
 * the hovered node sat anywhere except near a corner. This implementation
 * renders SVG text right next to each node so the title visually attaches
 * to its star, and surfaces the connected neighbors' titles at the same
 * time so the user can scan a node's web without opening the side panel.
 *
 * Rendered INSIDE the zoom layer so labels track pan/zoom with their
 * nodes. Painted last in the layer order so labels sit on top of every
 * other element.
 */
export function HoverLabels({
  hoveredNode,
  selectedNode,
  neighborIds,
  nodeById,
}: {
  hoveredNode: GraphNode | null;
  selectedNode: GraphNode | null;
  neighborIds: ReadonlySet<string>;
  nodeById: ReadonlyMap<string, GraphNode>;
}) {
  // Hover wins over selection — when the user is actively pointing at a
  // node, that's the conversation; selection is the persistent pin.
  const primary = hoveredNode ?? selectedNode;
  if (!primary) return null;

  const neighbors: GraphNode[] = [];
  for (const id of neighborIds) {
    const n = nodeById.get(id);
    if (n) neighbors.push(n);
  }

  return (
    <g style={{ pointerEvents: "none" }}>
      {neighbors.map((n) => (
        <NodeLabel key={`neighbor-${n.id}`} node={n} variant="neighbor" />
      ))}
      <NodeLabel node={primary} variant="primary" />
    </g>
  );
}

/**
 * One node's hover label. Anchored just to the right of the node and
 * vertically centered. Falls back to the left side when the node sits in
 * the right third of the canvas so a label near the edge doesn't get
 * clipped. Filtered by a label-shadow for legibility against any color
 * underneath.
 */
function NodeLabel({
  node,
  variant,
}: {
  node: GraphNode;
  variant: "primary" | "neighbor";
}) {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const r = NODE_RADIUS * 2 * nodeSizeMultiplier(node);
  // Place label to the right by default; flip to the left when the node
  // sits past 75% of canvas width.
  const placeLeft = nx > 900;
  const tx = nx + (placeLeft ? -r - 6 : r + 6);
  const anchor: "start" | "end" = placeLeft ? "end" : "start";
  return (
    <text
      x={tx}
      y={ny}
      textAnchor={anchor}
      dominantBaseline="central"
      filter="url(#label-shadow)"
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: variant === "primary" ? 13 : 11,
        fontWeight: variant === "primary" ? 600 : 400,
        fill: variant === "primary" ? "#f8fafc" : "#cbd5e1",
        paintOrder: "stroke",
        stroke: "rgba(5, 6, 10, 0.85)",
        strokeWidth: variant === "primary" ? 4 : 3,
        strokeLinejoin: "round",
      }}
    >
      {node.title}
    </text>
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
