import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as d3 from "d3";
import type {
  Graph,
  GraphEdge,
  GraphNode,
  ThemeCluster,
} from "../../../types/graph";
import { CANVAS_H, CANVAS_W, NODE_RADIUS, primaryClusterFor } from "./helpers";

/**
 * D3 force simulation lifecycle. Re-creates the simulation whenever the
 * graph or cluster mapping changes; tears down on unmount. Returns a ref
 * to the simulation so other hooks (drag, fly-to) can poke at it. The
 * `tickKey` is a render-trigger — incrementing it on every tick is what
 * pulls the latest `n.x`/`n.y` into React's render output.
 */
export function useForceSimulation(
  graph: Graph,
  clusterByLabel: Map<string, ThemeCluster>,
  prefersReducedMotion: boolean,
): {
  simRef: React.MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>;
  tickKey: number;
} {
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const [tickKey, setTickKey] = useState(0);

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
          // Weak link force: present so connected nodes drift slightly
          // toward each other but doesn't override the cluster pull.
          .strength((d) => 0.005 + d.strength * 0.02),
      )
      .force("charge", d3.forceManyBody<GraphNode>().strength(-420))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 8).strength(0.95),
      )
      // Strong center pull (0.55) so nodes stay visibly inside their
      // cluster glow instead of drifting toward edge-connected partners.
      .force("x", d3.forceX<GraphNode>((d) => targetFor(d).x).strength(0.55))
      .force("y", d3.forceY<GraphNode>((d) => targetFor(d).y).strength(0.55))
      .alpha(1)
      .alphaDecay(prefersReducedMotion ? 0.05 : 0.02)
      // Drift-on-rest: gently ticks forever so nodes orbit slowly within
      // their clusters. 0 when prefers-reduced-motion.
      .alphaTarget(prefersReducedMotion ? 0 : 0.03)
      .on("tick", () => {
        const padding = NODE_RADIUS * 4.5;
        for (const n of nodes) {
          if (n.x !== undefined) {
            if (n.x < padding) {
              n.x = padding;
              n.vx = 0;
            } else if (n.x > CANVAS_W - padding) {
              n.x = CANVAS_W - padding;
              n.vx = 0;
            }
          }
          if (n.y !== undefined) {
            if (n.y < padding) {
              n.y = padding;
              n.vy = 0;
            } else if (n.y > CANVAS_H - padding) {
              n.y = CANVAS_H - padding;
              n.vy = 0;
            }
          }
        }
        setTickKey((t) => t + 1);
      });

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [graph, clusterByLabel, prefersReducedMotion]);

  return { simRef, tickKey };
}

/**
 * D3 drag behavior + per-render attachment. The behavior is built once per
 * graph (closures capture the simulation ref + node lookup); the
 * attachment runs after every render to handle React reconciliation
 * remounting node DOM elements (which would silently drop the binding).
 * Selector is `.node` because node shapes vary by mediaType — the wrapper
 * `<g class="node">` hosts whatever glyph element.
 */
export function useNodeDrag(
  svgRef: React.RefObject<SVGSVGElement | null>,
  simRef: React.MutableRefObject<d3.Simulation<GraphNode, GraphEdge> | null>,
  graph: Graph,
  prefersReducedMotion: boolean,
): void {
  const dragBehaviorRef = useRef<d3.DragBehavior<
    SVGGraphicsElement,
    unknown,
    GraphNode | null
  > | null>(null);

  useEffect(() => {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    dragBehaviorRef.current = d3
      .drag<SVGGraphicsElement, unknown, GraphNode | null>()
      .subject(function () {
        const id = (this as SVGGraphicsElement).getAttribute("data-id");
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
        if (!event.active)
          simRef.current?.alphaTarget(prefersReducedMotion ? 0 : 0.03);
        subject.fx = null;
        subject.fy = null;
      });
  }, [graph, prefersReducedMotion, simRef]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !dragBehaviorRef.current) return;
    d3.select(svg)
      .selectAll<SVGGraphicsElement, unknown>(".node")
      .call(dragBehaviorRef.current);
  });
}

/**
 * D3 zoom behavior + custom dblclick reset. Returns a ref to the zoom
 * behavior so the parent can call `.transform` for fly-to-cluster /
 * pan-to-node animations.
 */
export function useZoomBehavior(
  svgRef: React.RefObject<SVGSVGElement | null>,
  setTransform: Dispatch<SetStateAction<d3.ZoomTransform>>,
): {
  zoomBehaviorRef: React.MutableRefObject<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>;
} {
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null);

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
        // Wheel zoom always allowed. For drag-pan, skip if the gesture
        // starts on a node (so node-drag wins) and skip on right-click.
        if (event.type === "wheel") return true;
        if ((event as MouseEvent).button !== 0 && event.type !== "touchstart")
          return false;
        const target = event.target as Element | null;
        if (!target) return true;
        return target.closest(".node") === null;
      })
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom).on("dblclick.zoom", null);
    // Wire double-click to reset to identity instead of d3-zoom's default
    // double-click-to-zoom-in behavior.
    d3.select(svg).on("dblclick", (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".node")) return;
      d3.select(svg)
        .transition()
        .duration(450)
        .call(zoom.transform, d3.zoomIdentity);
    });
    return () => {
      d3.select(svg).on(".zoom", null).on("dblclick", null);
      zoomBehaviorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { zoomBehaviorRef };
}

/**
 * Staggered fade-in on first load: starfield comes up first, then each
 * title star twinkles in. Skipped under prefers-reduced-motion so users
 * who opted out of motion see the final state immediately.
 */
export function useStarfieldFadeIn(
  graph: Graph,
  prefersReducedMotion: boolean,
): { starfieldLit: boolean; loadedNodeIds: Set<string> } {
  const [starfieldLit, setStarfieldLit] = useState(false);
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    // Synchronous setState here is the canonical "reset on graph change"
    // pattern for an animation-state effect. The lint rule guards against
    // cascading renders, but here we're intentionally re-priming the
    // staggered fade-in whenever the graph changes.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (prefersReducedMotion) {
      setStarfieldLit(true);
      setLoadedNodeIds(new Set(graph.nodes.map((n) => n.id)));
      return;
    }
    setStarfieldLit(false);
    setLoadedNodeIds(new Set());
    const fieldTimer = setTimeout(() => setStarfieldLit(true), 80);
    /* eslint-enable react-hooks/set-state-in-effect */
    const nodeTimers = graph.nodes.map((n, i) =>
      setTimeout(
        () => {
          setLoadedNodeIds((prev) => {
            if (prev.has(n.id)) return prev;
            const next = new Set(prev);
            next.add(n.id);
            return next;
          });
        },
        350 + i * 55,
      ),
    );
    return () => {
      clearTimeout(fieldTimer);
      nodeTimers.forEach(clearTimeout);
    };
  }, [graph, prefersReducedMotion]);

  return { starfieldLit, loadedNodeIds };
}
