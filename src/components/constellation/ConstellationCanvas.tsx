import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph, GraphNode, GraphEdge, ThemeCluster } from "../../types/graph";

interface Props {
  graph: Graph;
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

export function ConstellationCanvas({ graph }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    const drag = d3
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

    d3.select(svg)
      .selectAll<SVGCircleElement, unknown>("circle.node")
      .call(drag);
  }, [graph]);

  const { nodes, edges, clusters } = graph;
  const focusId = pinnedNodeId ?? hoveredNodeId;
  const focusNode = focusId
    ? (nodes.find((n) => n.id === focusId) ?? null)
    : null;
  const focusNeighbors = focusId
    ? (neighbors.get(focusId) ?? new Set<string>())
    : new Set<string>();

  const isDimmed = (id: string): boolean =>
    focusId !== null && id !== focusId && !focusNeighbors.has(id);
  const isEdgeActive = (s: string, t: string): boolean =>
    focusId !== null && (s === focusId || t === focusId);
  const isEdgeDimmed = (s: string, t: string): boolean =>
    focusId !== null && !isEdgeActive(s, t);

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedNodeId((cur) => (cur === id ? null : id));
  };

  const handleBackgroundClick = () => {
    setPinnedNodeId(null);
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
        {clusters.map((c, i) => (
          <circle
            key={c.label}
            cx={c.centerX}
            cy={c.centerY}
            r={c.radius * 1.6}
            fill={`url(#cluster-grad-${i})`}
          />
        ))}
      </g>

      <g className="edges">
        {edges.map((e, i) => {
          const s = e.source as GraphNode;
          const t = e.target as GraphNode;
          if (typeof s !== "object" || typeof t !== "object") return null;
          const active = isEdgeActive(s.id, t.id);
          const dimmed = isEdgeDimmed(s.id, t.id);
          const opacity = active ? 0.85 : dimmed ? 0.04 : 0.1;
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
          return (
            <text
              key={c.label}
              x={c.centerX}
              y={labelY}
              textAnchor="middle"
              fill={c.color}
              opacity={0.65}
              fontSize={11}
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
          const opacity = dimmed ? 0.1 : isFocus ? 0.85 : 0.55;
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
          const opacity = dimmed ? 0.4 : 1;
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
              onMouseEnter={() => setHoveredNodeId(n.id)}
              onMouseLeave={() =>
                setHoveredNodeId((cur) => (cur === n.id ? null : cur))
              }
              onClick={(e) => handleNodeClick(n.id, e)}
            />
          );
        })}
      </g>

      {pinnedNodeId !== null && focusNode && (
        <circle
          cx={focusNode.x ?? 0}
          cy={focusNode.y ?? 0}
          r={NODE_RADIUS * 2.4}
          fill="none"
          stroke={nodeColor.get(focusNode.id) ?? "#fefce8"}
          strokeWidth={1}
          strokeOpacity={0.55}
          strokeDasharray="3 3"
          style={{ pointerEvents: "none" }}
        />
      )}

      {focusNode && (() => {
        const TOOLTIP_W = 260;
        const TOOLTIP_H = 240;
        const OFFSET = 14;
        const nx = focusNode.x ?? 0;
        const ny = focusNode.y ?? 0;
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
            className="rounded-md border border-white/10 bg-[#0b0f1a]/95 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur"
            style={{ width: "fit-content", maxWidth: 260 }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-medium text-white">
                {focusNode.title}
              </div>
              {pinnedNodeId !== null && (
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">
                  pinned
                </div>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400">
              {focusNode.mediaType}
              {focusNode.year ? ` · ${focusNode.year}` : ""}
              {focusNode.rating !== null
                ? ` · ${focusNode.rating}★`
                : focusNode.matchScore !== null
                  ? ` · ${Math.round(focusNode.matchScore * 100)}% match`
                  : ""}
            </div>
            {focusNode.themes.length > 0 && (
              <div className="mt-2 text-[11px] text-zinc-300">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  Themes
                </div>
                <ul className="space-y-0.5">
                  {focusNode.themes.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </div>
            )}
            {focusNode.archetypes.length > 0 && (
              <div className="mt-2 text-[11px] text-zinc-300">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  Archetypes
                </div>
                <ul className="space-y-0.5">
                  {focusNode.archetypes.map((a) => (
                    <li key={a}>· {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {pinnedNodeId === null && (
              <div className="mt-2 text-[10px] italic text-zinc-500">
                click to pin
              </div>
            )}
          </div>
        </foreignObject>
        );
      })()}
    </svg>
  );
}
