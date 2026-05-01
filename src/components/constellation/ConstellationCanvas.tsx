import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";

interface Props {
  graph: Graph;
}

const NODE_RADIUS = 8;

export function ConstellationCanvas({ graph }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const { nodes, edges, clusters } = graph;
    const clusterByLabel = new Map(clusters.map((c) => [c.label, c]));

    const sim = d3
      .forceSimulation<GraphNode, GraphEdge>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance((d) => 80 + (1 - d.strength) * 120)
          .strength((d) => 0.2 + d.strength * 0.4),
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-180))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 4).strength(0.9),
      )
      .force(
        "x",
        d3
          .forceX<GraphNode>((d) => {
            const primary = d.themes[0];
            return primary
              ? (clusterByLabel.get(primary)?.centerX ?? 600)
              : 600;
          })
          .strength(0.08),
      )
      .force(
        "y",
        d3
          .forceY<GraphNode>((d) => {
            const primary = d.themes[0];
            return primary
              ? (clusterByLabel.get(primary)?.centerY ?? 400)
              : 400;
          })
          .strength(0.08),
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

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
    >
      <g className="clusters">
        {clusters.map((c) => (
          <circle
            key={c.label}
            cx={c.centerX}
            cy={c.centerY}
            r={c.radius}
            fill={c.color}
            opacity={0.06}
          />
        ))}
      </g>

      <g className="edges" stroke="#9aa4b2" strokeOpacity={0.25}>
        {edges.map((e, i) => {
          const s = e.source as GraphNode;
          const t = e.target as GraphNode;
          if (typeof s !== "object" || typeof t !== "object") return null;
          return (
            <line
              key={i}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
              strokeWidth={0.5 + e.strength * 1.5}
            />
          );
        })}
      </g>

      <g className="nodes">
        {nodes.map((n) => (
          <circle
            key={n.id}
            data-id={n.id}
            className="node cursor-grab active:cursor-grabbing"
            cx={n.x ?? 0}
            cy={n.y ?? 0}
            r={NODE_RADIUS}
            fill="#f5f7fa"
            stroke="#0b1020"
            strokeWidth={1}
          >
            <title>{n.title}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}
