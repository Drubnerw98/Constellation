import type { GraphEdge, GraphNode, ThemeCluster } from "../../../types/graph";
import {
  NODE_RADIUS,
  nodeSizeMultiplier,
  type ConstellationEdge,
} from "./helpers";
import { nodeGlyph } from "./glyph";

interface ConstellationLinesProps {
  /** Per-cluster MST edges, keyed by cluster label. */
  linesByCluster: Map<string, ConstellationEdge[]>;
  /** Look up live node positions by id. */
  nodeById: Map<string, GraphNode>;
  /** Per-cluster color, keyed by cluster label. */
  colorByCluster: Map<string, string>;
  focusedClusterLabel: string | null;
  hoveredClusterLabel: string | null;
  inGalaxyMode: boolean;
  /** When the user has the "show all connections" toggle on, the cross-
   * cluster edge web takes over as primary visual; MST lines yield to it
   * so the two layers don't compete. */
  showAllConnections: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Constellation lines — per-theme MST drawn under the member stars. These
 * are the structural visual: each theme becomes a connected figure (like
 * Orion or the Big Dipper) instead of a colored cluster blob. Lines track
 * current node positions every render so they follow the slow drift of the
 * force-simulation; the MST topology itself is computed upstream and held
 * stable so the figure shape doesn't twitch on every tick.
 *
 * Stroke is the cluster's color at low opacity; line width tapers to a
 * hairline so multiple lines per cluster don't collectively overwhelm the
 * star field. Focused cluster brightens; other clusters dim — same visual
 * grammar as the original cluster-glow state.
 */
export function ConstellationLines({
  linesByCluster,
  nodeById,
  colorByCluster,
  focusedClusterLabel,
  hoveredClusterLabel,
  inGalaxyMode,
  showAllConnections,
  prefersReducedMotion,
}: ConstellationLinesProps) {
  return (
    <g className="constellation-lines" style={{ pointerEvents: "none" }}>
      {Array.from(linesByCluster.entries()).flatMap(([label, edges]) => {
        const color = colorByCluster.get(label) ?? "#9aa4b2";
        const isFocused = label === focusedClusterLabel;
        const isHovered = !inGalaxyMode && label === hoveredClusterLabel;
        const dim = focusedClusterLabel !== null && !isFocused;
        let opacity = isFocused
          ? 0.7
          : isHovered
            ? 0.55
            : dim
              ? 0.08
              : 0.38;
        // When the cross-cluster web is the active display mode, recess
        // the constellation lines so the two layers don't fight. The
        // figure shape is still visible (~0.18), but cross-cluster takes
        // the primary role.
        if (showAllConnections && !isFocused && !isHovered) {
          opacity = 0.18;
        }
        return edges.map((edge, i) => {
          const s = nodeById.get(edge.sourceId);
          const t = nodeById.get(edge.targetId);
          if (!s || !t || s.x === undefined || t.x === undefined) return null;
          return (
            <line
              key={`${label}-${i}`}
              x1={s.x}
              y1={s.y ?? 0}
              x2={t.x}
              y2={t.y ?? 0}
              stroke={color}
              strokeOpacity={opacity}
              strokeWidth={1}
              strokeLinecap="round"
              style={{
                transition: prefersReducedMotion
                  ? "none"
                  : "stroke-opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />
          );
        });
      })}
    </g>
  );
}

interface EdgesProps {
  edges: GraphEdge[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  hoveredClusterLabel: string | null;
  showAllConnections: boolean;
  inGalaxyMode: boolean;
  clusterByLabel: Map<string, ThemeCluster>;
  isEdgeActive: (s: string, t: string) => boolean;
  isEdgeDimmed: (s: string, t: string) => boolean;
  inFocusedCluster: (id: string) => boolean;
  inHoveredCluster: (id: string) => boolean;
  matchesFormat: (id: string) => boolean;
  /** Node-pair keys already drawn by the constellation-line MST layer.
   * Cross-cluster bezier edges skip these pairs in default state to avoid
   * drawing two lines (one straight MST, one curved bezier) between the
   * same nodes. Active edges (selected/hovered focus) still render to
   * preserve the highlight. */
  mstPairs: Set<string>;
  prefersReducedMotion: boolean;
}

/**
 * Edge layer — quadratic-bezier paths between connected nodes. Edge color
 * tints with the strongest shared theme; opacity reflects active / dimmed /
 * cluster-focus / format-filter state. When `showAllConnections` is false,
 * only edges touching the focused (selected or hovered) node render at all.
 */
export function Edges({
  edges,
  selectedNodeId,
  hoveredNodeId,
  hoveredClusterLabel,
  showAllConnections,
  inGalaxyMode,
  clusterByLabel,
  isEdgeActive,
  isEdgeDimmed,
  inFocusedCluster,
  inHoveredCluster,
  matchesFormat,
  mstPairs,
  prefersReducedMotion,
}: EdgesProps) {
  return (
    <g className="edges" style={{ pointerEvents: "none" }}>
      {edges.map((e, i) => {
        const s = e.source as GraphNode;
        const t = e.target as GraphNode;
        if (typeof s !== "object" || typeof t !== "object") return null;
        if (!showAllConnections) {
          const focusId = selectedNodeId ?? hoveredNodeId;
          if (focusId === null || (s.id !== focusId && t.id !== focusId)) {
            return null;
          }
        }
        const active = isEdgeActive(s.id, t.id);
        const dimmed = isEdgeDimmed(s.id, t.id);
        // Skip drawing a curved bezier when the constellation MST already
        // draws a straight line between this same pair — unless the edge
        // is actively highlighted (selected/hovered focus), in which case
        // the highlight needs the bezier to render on top of everything.
        const pairKey =
          s.id < t.id ? `${s.id}--${t.id}` : `${t.id}--${s.id}`;
        if (!active && mstPairs.has(pairKey)) return null;
        const galaxyDim =
          inGalaxyMode &&
          !(inFocusedCluster(s.id) && inFocusedCluster(t.id));
        let opacity = active ? 0.85 : dimmed ? 0.04 : 0.14;
        if (galaxyDim) opacity *= 0.2;
        if (!matchesFormat(s.id) || !matchesFormat(t.id)) opacity *= 0.05;
        const clusterHoverDim =
          hoveredClusterLabel !== null &&
          !inGalaxyMode &&
          !(inHoveredCluster(s.id) && inHoveredCluster(t.id));
        if (clusterHoverDim) opacity *= 0.25;
        let themeColor: string | null = null;
        let bestWeight = -1;
        for (const themeLabel of e.sharedThemes) {
          const cluster = clusterByLabel.get(themeLabel);
          if (cluster && cluster.weight > bestWeight) {
            bestWeight = cluster.weight;
            themeColor = cluster.color;
          }
        }
        const stroke = active ? "#fef3c7" : (themeColor ?? "#9aa4b2");
        const width = (0.5 + e.strength * 1.4) * (active ? 1.6 : 1);
        const x1 = s.x ?? 0;
        const y1 = s.y ?? 0;
        const x2 = t.x ?? 0;
        const y2 = t.y ?? 0;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const curveAmt = len * 0.09;
        const cx = (x1 + x2) / 2 + (-dy / len) * curveAmt;
        const cy = (y1 + y2) / 2 + (dx / len) * curveAmt;
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={width}
            strokeLinecap="round"
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "stroke-opacity 200ms ease",
            }}
          />
        );
      })}
    </g>
  );
}

interface NodeLayerProps {
  nodes: GraphNode[];
  focusId: string | null;
  focusNeighbors: Set<string>;
  hoveredClusterLabel: string | null;
  loadedNodeIds: Set<string>;
  inGalaxyMode: boolean;
  activeFormats: Set<GraphNode["mediaType"]>;
  nodeColor: Map<string, string>;
  isDimmed: (id: string) => boolean;
  inFocusedCluster: (id: string) => boolean;
  inHoveredCluster: (id: string) => boolean;
  prefersReducedMotion: boolean;
}

/** Blurred glow circles painted behind the actual node glyphs.
 * Pointer-events disabled — they're decorative. */
export function NodeHalos(props: NodeLayerProps) {
  const {
    nodes,
    focusId,
    focusNeighbors,
    hoveredClusterLabel,
    loadedNodeIds,
    inGalaxyMode,
    activeFormats,
    nodeColor,
    isDimmed,
    inFocusedCluster,
    inHoveredCluster,
    prefersReducedMotion,
  } = props;
  return (
    <g className="node-halos" style={{ pointerEvents: "none" }}>
      {nodes.map((n) => {
        const dimmed = isDimmed(n.id);
        const isFocus = n.id === focusId;
        const isNeighbor = focusNeighbors.has(n.id);
        const sizeMul = nodeSizeMultiplier(n);
        const baseR = NODE_RADIUS * sizeMul;
        const r = isFocus
          ? baseR * 4.2
          : isNeighbor
            ? baseR * 3.2
            : baseR * 2.6;
        let opacity = dimmed ? 0.1 : isFocus ? 0.85 : 0.55;
        if (inGalaxyMode && !inFocusedCluster(n.id)) opacity *= 0.15;
        if (!activeFormats.has(n.mediaType)) opacity *= 0.1;
        if (
          hoveredClusterLabel !== null &&
          !inGalaxyMode &&
          !inHoveredCluster(n.id)
        )
          opacity *= 0.3;
        if (!loadedNodeIds.has(n.id)) opacity = 0;
        return (
          <circle
            key={n.id}
            cx={n.x ?? 0}
            cy={n.y ?? 0}
            r={r}
            fill={nodeColor.get(n.id) ?? "#cbd5e1"}
            opacity={opacity}
            filter="url(#node-halo)"
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "opacity 600ms ease, r 200ms ease",
            }}
          />
        );
      })}
    </g>
  );
}

interface NodesProps extends NodeLayerProps {
  onNodeEnter: (id: string) => void;
  onNodeLeave: (id: string) => void;
  onNodeClick: (id: string, e: React.MouseEvent) => void;
}

/** Interactive node glyphs. Each is a `<g class="node">` with `data-id`
 * (drag attachment hooks into this), an invisible 30+ unit hit circle for
 * touch reliability, and a per-format glyph painted on top. */
export function Nodes(props: NodesProps) {
  const {
    nodes,
    focusId,
    focusNeighbors,
    hoveredClusterLabel,
    loadedNodeIds,
    inGalaxyMode,
    activeFormats,
    nodeColor,
    isDimmed,
    inFocusedCluster,
    inHoveredCluster,
    prefersReducedMotion,
    onNodeEnter,
    onNodeLeave,
    onNodeClick,
  } = props;
  return (
    <g className="nodes">
      {nodes.map((n) => {
        const dimmed = isDimmed(n.id);
        const isFocus = n.id === focusId;
        const isNeighbor = focusNeighbors.has(n.id);
        const sizeMul = nodeSizeMultiplier(n);
        const r =
          (isFocus
            ? NODE_RADIUS * 1.55
            : isNeighbor
              ? NODE_RADIUS * 1.2
              : NODE_RADIUS) * sizeMul;
        let opacity = dimmed ? 0.4 : 1;
        if (inGalaxyMode && !inFocusedCluster(n.id)) opacity *= 0.15;
        const filteredOut = !activeFormats.has(n.mediaType);
        if (filteredOut) opacity *= 0.1;
        if (
          hoveredClusterLabel !== null &&
          !inGalaxyMode &&
          !inHoveredCluster(n.id)
        )
          opacity *= 0.3;
        if (!loadedNodeIds.has(n.id)) opacity = 0;
        const color = nodeColor.get(n.id) ?? "#cbd5e1";
        return (
          <g
            key={n.id}
            data-id={n.id}
            className="node cursor-pointer"
            transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
            opacity={opacity}
            filter={isFocus ? "url(#node-glow-strong)" : undefined}
            style={{
              transition: prefersReducedMotion ? "none" : "opacity 600ms ease",
              pointerEvents: filteredOut ? "none" : undefined,
            }}
            onMouseEnter={() => onNodeEnter(n.id)}
            onMouseLeave={() => onNodeLeave(n.id)}
            onClick={(e) => onNodeClick(n.id, e)}
          >
            <circle cx={0} cy={0} r={Math.max(30, r * 2)} fill="transparent" />
            {nodeGlyph(n.mediaType, r, "#fefce8", color, isFocus ? 2 : 1.4)}
          </g>
        );
      })}
    </g>
  );
}
