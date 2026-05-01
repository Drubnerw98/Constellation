import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";

interface Props {
  graph: Graph;
}

const CANVAS_W = 1200;
const CANVAS_H = 800;
const NODE_RADIUS = 7;

function seededStars(count: number): { x: number; y: number; r: number; o: number }[] {
  const out: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  for (let i = 0; i < count; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 0.4 + rand() * 1.1,
      o: 0.18 + rand() * 0.5,
    });
  }
  return out;
}

export function ConstellationCanvas({ graph }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [, setTick] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const stars = useMemo(() => seededStars(120), []);

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
    const { nodes, edges, clusters } = graph;
    const clusterByLabel = new Map(clusters.map((c) => [c.label, c]));

    const targetFor = (d: GraphNode): { x: number; y: number } => {
      let primary: (typeof clusters)[number] | null = null;
      for (const t of d.themes) {
        const c = clusterByLabel.get(t);
        if (!c) continue;
        if (!primary || c.weight > primary.weight) primary = c;
      }
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
      .on("tick", () => setTick((t) => t + 1));

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graph]);

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
  const hoveredNode = hoveredNodeId
    ? (nodes.find((n) => n.id === hoveredNodeId) ?? null)
    : null;
  const hoverNeighbors = hoveredNodeId
    ? (neighbors.get(hoveredNodeId) ?? new Set<string>())
    : new Set<string>();

  const isDimmed = (id: string): boolean =>
    hoveredNodeId !== null && id !== hoveredNodeId && !hoverNeighbors.has(id);
  const isEdgeActive = (s: string, t: string): boolean =>
    hoveredNodeId !== null && (s === hoveredNodeId || t === hoveredNodeId);
  const isEdgeDimmed = (s: string, t: string): boolean =>
    hoveredNodeId !== null && !isEdgeActive(s, t);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
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
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
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

      <g className="cluster-labels">
        {clusters.map((c) => (
          <text
            key={c.label}
            x={c.centerX}
            y={c.centerY + c.radius + 18}
            textAnchor="middle"
            fill={c.color}
            opacity={0.42}
            fontSize={11}
            style={{ pointerEvents: "none", letterSpacing: "0.04em" }}
          >
            {c.label}
          </text>
        ))}
      </g>

      <g className="edges">
        {edges.map((e, i) => {
          const s = e.source as GraphNode;
          const t = e.target as GraphNode;
          if (typeof s !== "object" || typeof t !== "object") return null;
          const active = isEdgeActive(s.id, t.id);
          const dimmed = isEdgeDimmed(s.id, t.id);
          const opacity = active ? 0.85 : dimmed ? 0.05 : 0.22;
          const stroke = active ? "#fef3c7" : "#9aa4b2";
          const width = (0.5 + e.strength * 1.5) * (active ? 1.6 : 1);
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

      <g className="nodes">
        {nodes.map((n) => {
          const dimmed = isDimmed(n.id);
          const isHover = n.id === hoveredNodeId;
          const isNeighbor = hoverNeighbors.has(n.id);
          const r = isHover
            ? NODE_RADIUS * 1.6
            : isNeighbor
              ? NODE_RADIUS * 1.2
              : NODE_RADIUS;
          const opacity = dimmed ? 0.35 : 1;
          return (
            <circle
              key={n.id}
              data-id={n.id}
              className="node cursor-grab active:cursor-grabbing"
              cx={n.x ?? 0}
              cy={n.y ?? 0}
              r={r}
              fill={isHover ? "#fef3c7" : "#f5f7fa"}
              stroke="#0b1020"
              strokeWidth={1}
              opacity={opacity}
              filter={isHover ? "url(#node-glow)" : undefined}
              onMouseEnter={() => setHoveredNodeId(n.id)}
              onMouseLeave={() =>
                setHoveredNodeId((cur) => (cur === n.id ? null : cur))
              }
            />
          );
        })}
      </g>

      {hoveredNode && (
        <foreignObject
          x={(hoveredNode.x ?? 0) + 14}
          y={(hoveredNode.y ?? 0) - 10}
          width={280}
          height={220}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div
            className="rounded-md border border-white/10 bg-[#0b0f1a]/95 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-xl backdrop-blur"
            style={{ width: "fit-content", maxWidth: 260 }}
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
            {hoveredNode.themes.length > 0 && (
              <div className="mt-2 text-[11px] text-zinc-300">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  Themes
                </div>
                <ul className="space-y-0.5">
                  {hoveredNode.themes.map((t) => (
                    <li key={t}>· {t}</li>
                  ))}
                </ul>
              </div>
            )}
            {hoveredNode.archetypes.length > 0 && (
              <div className="mt-2 text-[11px] text-zinc-300">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  Archetypes
                </div>
                <ul className="space-y-0.5">
                  {hoveredNode.archetypes.map((a) => (
                    <li key={a}>· {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
