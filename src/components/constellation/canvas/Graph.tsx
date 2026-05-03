import type { GraphEdge, GraphNode, ThemeCluster } from "../../../types/graph";
import { NODE_RADIUS, nodeSizeMultiplier } from "./helpers";
import { nodeGlyph } from "./glyph";

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
