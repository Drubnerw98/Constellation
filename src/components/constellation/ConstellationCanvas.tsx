import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import type { Graph, GraphNode, GraphEdge, ThemeCluster } from "../../types/graph";

interface Props {
  graph: Graph;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  activeFormats: Set<GraphNode["mediaType"]>;
}

export interface ConstellationCanvasHandle {
  panToNode: (id: string) => void;
}

const CANVAS_W = 1200;
const CANVAS_H = 800;
const NODE_RADIUS = 6;

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

function seededStars(count: number, anchorCount: number): Star[] {
  const out: Star[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  for (let i = 0; i < count; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 0.4 + rand() * 1.0,
      o: 0.18 + rand() * 0.45,
    });
  }
  for (let i = 0; i < anchorCount; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 1.6 + rand() * 1.0,
      o: 0.6 + rand() * 0.3,
    });
  }
  return out;
}

function primaryClusterFor(
  d: GraphNode,
  byLabel: Map<string, ThemeCluster>,
): ThemeCluster | null {
  let primary: ThemeCluster | null = null;
  for (const t of d.themes) {
    const c = byLabel.get(t);
    if (!c) continue;
    if (!primary || c.weight > primary.weight) primary = c;
  }
  return primary;
}

export const ConstellationCanvas = forwardRef<
  ConstellationCanvasHandle,
  Props
>(function ConstellationCanvas(
  { graph, selectedNodeId, onSelect, activeFormats },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);
  const dragBehaviorRef = useRef<d3.DragBehavior<
    SVGCircleElement,
    unknown,
    GraphNode | null
  > | null>(null);
  const [, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(
    d3.zoomIdentity,
  );
  const [focusedClusterLabel, setFocusedClusterLabel] = useState<string | null>(
    null,
  );

  const stars = useMemo(() => seededStars(110, 14), []);

  const clusterByLabel = useMemo(
    () => new Map(graph.clusters.map((c) => [c.label, c])),
    [graph.clusters],
  );

  const nodeColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of graph.nodes) {
      const c = primaryClusterFor(n, clusterByLabel);
      map.set(n.id, c?.color ?? "#cbd5e1");
    }
    return map;
  }, [graph.nodes, clusterByLabel]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of graph.nodes) map.set(n.id, new Set());
    for (const e of graph.edges) {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      map.get(s)?.add(t);
      map.get(t)?.add(s);
    }
    return map;
  }, [graph]);

  useEffect(() => {
    const { nodes, edges } = graph;

    const targetFor = (d: GraphNode): { x: number; y: number } => {
      const primary = primaryClusterFor(d, clusterByLabel);
      return primary
        ? { x: primary.centerX, y: primary.centerY }
        : { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    };

    const sim = d3
      .forceSimulation<GraphNode, GraphEdge>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance((d) => 140 + (1 - d.strength) * 160)
          .strength((d) => 0.015 + d.strength * 0.05),
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-420))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 8).strength(0.95),
      )
      .force(
        "x",
        d3.forceX<GraphNode>((d) => targetFor(d).x).strength(0.4),
      )
      .force(
        "y",
        d3.forceY<GraphNode>((d) => targetFor(d).y).strength(0.4),
      )
      .alpha(1)
      .alphaDecay(0.02)
      .on("tick", () => {
        // Clamp node positions inside the viewBox so halos never crop at the
        // edges. Padding accounts for the largest halo radius (focused state).
        const padding = NODE_RADIUS * 4.5;
        for (const n of nodes) {
          if (n.x !== undefined) {
            if (n.x < padding) n.x = padding;
            else if (n.x > CANVAS_W - padding) n.x = CANVAS_W - padding;
          }
          if (n.y !== undefined) {
            if (n.y < padding) n.y = padding;
            else if (n.y > CANVAS_H - padding) n.y = CANVAS_H - padding;
          }
        }
        setTick((t) => t + 1);
      });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graph, clusterByLabel]);

  // Build the drag behavior once per graph. Stored in a ref so the
  // re-attachment effect below can use it without re-creating the closures.
  useEffect(() => {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    dragBehaviorRef.current = d3
      .drag<SVGCircleElement, unknown, GraphNode | null>()
      .subject(function () {
        const id = (this as SVGCircleElement).getAttribute("data-id");
        return id ? (nodeById.get(id) ?? null) : null;
      })
      .on("start", (event) => {
        const subject = event.subject as GraphNode | null;
        if (!subject) return;
        if (!event.active) simRef.current?.alphaTarget(0.3).restart();
        subject.fx = subject.x;
        subject.fy = subject.y;
      })
      .on("drag", (event) => {
        const subject = event.subject as GraphNode | null;
        if (!subject) return;
        subject.fx = event.x;
        subject.fy = event.y;
      })
      .on("end", (event) => {
        const subject = event.subject as GraphNode | null;
        if (!subject) return;
        if (!event.active) simRef.current?.alphaTarget(0);
        subject.fx = null;
        subject.fy = null;
      });
  }, [graph]);

  // Attach the drag behavior to whatever circle.node elements are currently
  // in the DOM. Runs after every render — d3's .call(drag) is idempotent so
  // re-attaching is cheap, and this guards against React reconciliation
  // remounting circle nodes (which silently drops the previous binding).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !dragBehaviorRef.current) return;
    d3.select(svg)
      .selectAll<SVGCircleElement, unknown>("circle.node")
      .call(dragBehaviorRef.current);
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 4])
      .translateExtent([
        [-CANVAS_W * 0.5, -CANVAS_H * 0.5],
        [CANVAS_W * 1.5, CANVAS_H * 1.5],
      ])
      .filter((event: Event) => {
        // Wheel zoom always allowed. For drag-pan, skip if the gesture starts
        // on a node so node-drag wins, and skip on right-click.
        if (event.type === "wheel") return true;
        if ((event as MouseEvent).button !== 0 && event.type !== "touchstart")
          return false;
        const target = event.target as Element | null;
        if (!target) return true;
        return target.closest("circle.node") === null;
      })
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom).on("dblclick.zoom", null);
    // Wire double-click to reset to identity instead of d3-zoom's default
    // double-click behavior (which zooms in 2x).
    d3.select(svg).on("dblclick", (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("circle.node")) return;
      d3.select(svg)
        .transition()
        .duration(450)
        .call(zoom.transform, d3.zoomIdentity);
    });
    return () => {
      d3.select(svg).on(".zoom", null).on("dblclick", null);
      zoomBehaviorRef.current = null;
    };
  }, []);

  const { nodes, edges, clusters } = graph;
  // Hover wins over selection for visual highlights — lets the user preview
  // other nodes' connections while the detail panel still shows the pinned one.
  const focusId = hoveredNodeId ?? selectedNodeId;
  const focusNeighbors = focusId
    ? (neighbors.get(focusId) ?? new Set<string>())
    : new Set<string>();
  const hoveredNode = hoveredNodeId
    ? (nodes.find((n) => n.id === hoveredNodeId) ?? null)
    : null;
  const selectedNode = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  const isDimmed = (id: string): boolean =>
    focusId !== null && id !== focusId && !focusNeighbors.has(id);
  const isEdgeActive = (s: string, t: string): boolean =>
    focusId !== null && (s === focusId || t === focusId);
  const isEdgeDimmed = (s: string, t: string): boolean =>
    focusId !== null && !isEdgeActive(s, t);

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(selectedNodeId === id ? null : id);
  };

  const handleBackgroundClick = () => {
    onSelect(null);
  };

  const resetView = () => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    if (!svg || !zoom) return;
    setFocusedClusterLabel(null);
    d3.select(svg)
      .transition()
      .duration(700)
      .call(zoom.transform, d3.zoomIdentity);
  };

  useImperativeHandle(
    ref,
    () => ({
      panToNode: (id: string) => {
        const svg = svgRef.current;
        const zoom = zoomBehaviorRef.current;
        const node = graph.nodes.find((n) => n.id === id);
        if (!svg || !zoom || !node) return;
        const k = 1.8;
        const tx = CANVAS_W / 2 - (node.x ?? CANVAS_W / 2) * k;
        const ty = CANVAS_H / 2 - (node.y ?? CANVAS_H / 2) * k;
        const next = d3.zoomIdentity.translate(tx, ty).scale(k);
        setFocusedClusterLabel(null);
        d3.select(svg).transition().duration(700).call(zoom.transform, next);
      },
    }),
    [graph],
  );

  const flyToCluster = (label: string) => {
    const svg = svgRef.current;
    const zoom = zoomBehaviorRef.current;
    const target = clusters.find((c) => c.label === label);
    if (!svg || !zoom || !target) return;
    if (focusedClusterLabel === label) {
      // Clicking the focused cluster again exits galaxy mode.
      resetView();
      return;
    }
    const k = Math.min(CANVAS_W, CANVAS_H) / (target.radius * 4.2);
    const tx = CANVAS_W / 2 - target.centerX * k;
    const ty = CANVAS_H / 2 - target.centerY * k;
    const next = d3.zoomIdentity.translate(tx, ty).scale(k);
    setFocusedClusterLabel(label);
    d3.select(svg).transition().duration(800).call(zoom.transform, next);
  };

  const isZoomed =
    transform.k !== 1 || transform.x !== 0 || transform.y !== 0;
  const inGalaxyMode = focusedClusterLabel !== null;
  const inFocusedCluster = (id: string): boolean => {
    if (!focusedClusterLabel) return true;
    const node = nodes.find((n) => n.id === id);
    return node?.themes.includes(focusedClusterLabel) ?? false;
  };
  const matchesFormat = (id: string): boolean => {
    const node = nodes.find((n) => n.id === id);
    return node ? activeFormats.has(node.mediaType) : true;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      onClick={handleBackgroundClick}
    >
      <defs>
        {clusters.map((c, i) => (
          <radialGradient
            key={c.label}
            id={`cluster-grad-${i}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor={c.color} stopOpacity={0.55} />
            <stop offset="35%" stopColor={c.color} stopOpacity={0.28} />
            <stop offset="70%" stopColor={c.color} stopOpacity={0.08} />
            <stop offset="100%" stopColor={c.color} stopOpacity={0} />
          </radialGradient>
        ))}
        <filter id="node-halo" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="node-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="zoom-layer" transform={transform.toString()}>

      <g className="starfield">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#e9ecf2"
            opacity={s.o}
          />
        ))}
      </g>

      <g className="clusters">
        {clusters.map((c, i) => {
          const dim =
            focusedClusterLabel !== null && c.label !== focusedClusterLabel;
          const isFocused = c.label === focusedClusterLabel;
          return (
            <circle
              key={c.label}
              cx={c.centerX}
              cy={c.centerY}
              r={c.radius * (isFocused ? 1.9 : 1.6)}
              fill={`url(#cluster-grad-${i})`}
              opacity={dim ? 0.18 : 1}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                flyToCluster(c.label);
              }}
            />
          );
        })}
      </g>

      <g className="edges">
        {edges.map((e, i) => {
          const s = e.source as GraphNode;
          const t = e.target as GraphNode;
          if (typeof s !== "object" || typeof t !== "object") return null;
          const active = isEdgeActive(s.id, t.id);
          const dimmed = isEdgeDimmed(s.id, t.id);
          const galaxyDim =
            inGalaxyMode &&
            !(inFocusedCluster(s.id) && inFocusedCluster(t.id));
          let opacity = active ? 0.85 : dimmed ? 0.04 : 0.1;
          if (galaxyDim) opacity *= 0.2;
          if (!matchesFormat(s.id) || !matchesFormat(t.id)) opacity *= 0.05;
          const stroke = active ? "#fef3c7" : "#9aa4b2";
          const width = (0.5 + e.strength * 1.4) * (active ? 1.6 : 1);
          return (
            <line
              key={i}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
              stroke={stroke}
              strokeOpacity={opacity}
              strokeWidth={width}
            />
          );
        })}
      </g>

      <g className="cluster-labels">
        {clusters.map((c) => {
          const belowY = c.centerY + c.radius + 18;
          const aboveY = c.centerY - c.radius - 8;
          const labelY = belowY > CANVAS_H - 8 ? aboveY : belowY;
          const isFocused = c.label === focusedClusterLabel;
          const dim =
            focusedClusterLabel !== null && !isFocused;
          const opacity = isFocused ? 0.95 : dim ? 0.2 : 0.65;
          return (
            <text
              key={c.label}
              x={c.centerX}
              y={labelY}
              textAnchor="middle"
              fill={c.color}
              opacity={opacity}
              fontSize={isFocused ? 13 : 11}
              style={{
                pointerEvents: "none",
                letterSpacing: "0.05em",
                paintOrder: "stroke fill",
                stroke: "#05060a",
                strokeWidth: 3,
                strokeLinejoin: "round",
              }}
            >
              {c.label}
            </text>
          );
        })}
      </g>

      <g className="node-halos" style={{ pointerEvents: "none" }}>
        {nodes.map((n) => {
          const dimmed = isDimmed(n.id);
          const isFocus = n.id === focusId;
          const isNeighbor = focusNeighbors.has(n.id);
          const baseR = NODE_RADIUS;
          const r = isFocus ? baseR * 4.2 : isNeighbor ? baseR * 3.2 : baseR * 2.6;
          let opacity = dimmed ? 0.1 : isFocus ? 0.85 : 0.55;
          if (inGalaxyMode && !inFocusedCluster(n.id)) opacity *= 0.15;
          if (!activeFormats.has(n.mediaType)) opacity *= 0.1;
          return (
            <circle
              key={n.id}
              cx={n.x ?? 0}
              cy={n.y ?? 0}
              r={r}
              fill={nodeColor.get(n.id) ?? "#cbd5e1"}
              opacity={opacity}
              filter="url(#node-halo)"
            />
          );
        })}
      </g>

      <g className="nodes">
        {nodes.map((n) => {
          const dimmed = isDimmed(n.id);
          const isFocus = n.id === focusId;
          const isNeighbor = focusNeighbors.has(n.id);
          const r = isFocus
            ? NODE_RADIUS * 1.55
            : isNeighbor
              ? NODE_RADIUS * 1.2
              : NODE_RADIUS;
          let opacity = dimmed ? 0.4 : 1;
          if (inGalaxyMode && !inFocusedCluster(n.id)) opacity *= 0.15;
          const filteredOut = !activeFormats.has(n.mediaType);
          if (filteredOut) opacity *= 0.1;
          const color = nodeColor.get(n.id) ?? "#cbd5e1";
          return (
            <circle
              key={n.id}
              data-id={n.id}
              className="node cursor-pointer"
              cx={n.x ?? 0}
              cy={n.y ?? 0}
              r={r}
              fill="#fefce8"
              stroke={color}
              strokeWidth={isFocus ? 2 : 1.4}
              opacity={opacity}
              filter={isFocus ? "url(#node-glow-strong)" : undefined}
              style={filteredOut ? { pointerEvents: "none" } : undefined}
              onMouseEnter={() => setHoveredNodeId(n.id)}
              onMouseLeave={() =>
                setHoveredNodeId((cur) => (cur === n.id ? null : cur))
              }
              onClick={(e) => handleNodeClick(n.id, e)}
            />
          );
        })}
      </g>

      </g>

      {selectedNode && (
        <circle
          cx={transform.applyX(selectedNode.x ?? 0)}
          cy={transform.applyY(selectedNode.y ?? 0)}
          r={NODE_RADIUS * 2.4 * transform.k}
          fill="none"
          stroke={nodeColor.get(selectedNode.id) ?? "#fefce8"}
          strokeWidth={1}
          strokeOpacity={0.6}
          strokeDasharray="3 3"
          style={{ pointerEvents: "none" }}
        />
      )}

      {hoveredNode && (() => {
        const TOOLTIP_W = 220;
        const TOOLTIP_H = 60;
        const OFFSET = 14;
        const nx = transform.applyX(hoveredNode.x ?? 0);
        const ny = transform.applyY(hoveredNode.y ?? 0);
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
              <div className="text-sm font-medium text-white">
                {hoveredNode.title}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                {hoveredNode.mediaType}
                {hoveredNode.year ? ` · ${hoveredNode.year}` : ""}
                {hoveredNode.rating !== null
                  ? ` · ${hoveredNode.rating}★`
                  : hoveredNode.matchScore !== null
                    ? ` · ${Math.round(hoveredNode.matchScore * 100)}% match`
                    : ""}
              </div>
            </div>
          </foreignObject>
        );
      })()}

      {(isZoomed || inGalaxyMode) && (
        <foreignObject x={20} y={CANVAS_H - 56} width={240} height={40}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetView();
            }}
            className="rounded-md border border-white/10 bg-[#0b0f1a]/95 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-md transition-colors hover:bg-white/10"
          >
            {inGalaxyMode ? "← Back to constellation" : "↺ Reset view"}
          </button>
        </foreignObject>
      )}
    </svg>
  );
});
