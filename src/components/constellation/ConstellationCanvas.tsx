import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import type {
  Graph,
  GraphNode,
  GraphEdge,
  ThemeCluster,
} from "../../types/graph";

interface Props {
  graph: Graph;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  activeFormats: Set<GraphNode["mediaType"]>;
  /** Fired whenever galaxy-mode focus changes — when the user clicks a
   * cluster label, zooms in past the threshold, or exits galaxy mode.
   * View consumes this to render the cluster info panel. */
  onFocusedClusterChange?: (label: string | null) => void;
}

export interface ConstellationCanvasHandle {
  panToNode: (id: string) => void;
  /** Exit galaxy mode: clear focused cluster + reset zoom to identity.
   * Called from the cluster info panel's close button. */
  clearClusterFocus: () => void;
}

const CANVAS_W = 1200;
const CANVAS_H = 800;
const NODE_RADIUS = 6;

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  fill: string;
}

// Mostly white with a sprinkle of warm/cool tints. Real night-sky stars
// vary in temperature; uniform white reads as a UI dot pattern instead of
// stars. Tints are subtle — only a handful of stars per frame should look
// noticeably non-white.
const STAR_FILLS = [
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#fde6c8", // warm
  "#fcd7b2", // warm
  "#d4def8", // cool
  "#cbd6f5", // cool
];

// Three layers for depth: distant tiny stars (densest, dimmest),
// midfield, and a sprinkle of brighter "anchor" stars. Multiple layers
// at different sizes give the page a parallax/dimensional feel rather
// than a single uniform scatter.
function seededStars(
  distantCount: number,
  midCount: number,
  anchorCount: number,
): Star[] {
  const out: Star[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  const pickFill = () =>
    STAR_FILLS[Math.floor(rand() * STAR_FILLS.length)] ?? "#e9ecf2";
  // Distant layer: tiny, low opacity, dense
  for (let i = 0; i < distantCount; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 0.3 + rand() * 0.5,
      o: 0.12 + rand() * 0.2,
      fill: pickFill(),
    });
  }
  // Midfield: moderate size + opacity (the previous default layer)
  for (let i = 0; i < midCount; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 0.5 + rand() * 0.9,
      o: 0.22 + rand() * 0.4,
      fill: pickFill(),
    });
  }
  // Anchor stars: bright, varied, sparse
  for (let i = 0; i < anchorCount; i++) {
    out.push({
      x: rand() * CANVAS_W,
      y: rand() * CANVAS_H,
      r: 1.6 + rand() * 1.0,
      o: 0.6 + rand() * 0.3,
      fill: pickFill(),
    });
  }
  return out;
}

function primaryClusterFor(
  d: GraphNode,
  byLabel: Map<string, ThemeCluster>,
): ThemeCluster | null {
  if (!d.primaryTheme) return null;
  return byLabel.get(d.primaryTheme) ?? null;
}

/**
 * Split a long cluster label into at most two lines, breaking at the word
 * boundary closest to the midpoint character count. Single-word or short
 * labels stay one line.
 */
function wrapClusterLabel(label: string): string[] {
  if (label.length <= 22) return [label];
  const words = label.split(" ");
  if (words.length <= 1) return [label];
  const mid = label.length / 2;
  let bestIdx = 1;
  let bestDist = Infinity;
  let cum = 0;
  for (let i = 0; i < words.length - 1; i++) {
    cum += words[i]!.length + 1;
    const d = Math.abs(cum - mid);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i + 1;
    }
  }
  return [words.slice(0, bestIdx).join(" "), words.slice(bestIdx).join(" ")];
}

/**
 * Subtle visual hierarchy: scale node size by quality signal. Highly-rated
 * library items and high-matchScore recs sit slightly larger than the
 * baseline; unrated/low-score ones slightly smaller. Range is intentionally
 * narrow (~0.85x to 1.2x) so the variation is felt, not announced.
 */
function nodeSizeMultiplier(n: GraphNode): number {
  if (n.source === "library") {
    if (n.rating != null) return 0.85 + (n.rating / 5) * 0.35;
    return 1.0;
  }
  if (n.matchScore != null) return 0.85 + n.matchScore * 0.35;
  return 1.0;
}

/**
 * Per-format node glyph. All shapes are roughly equal in visual area so
 * differentiation reads as identity, not size. Drawn at origin (0,0); the
 * parent <g> handles positioning via transform.
 *
 *   movie  → circle
 *   tv     → rounded square (boxy screen)
 *   anime  → hexagon
 *   game   → diamond
 *   manga  → tall rectangle (page)
 *   book   → taller, narrower rectangle (book spine)
 */
function nodeGlyph(
  mediaType: GraphNode["mediaType"],
  r: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  const common = { fill, stroke, strokeWidth };
  switch (mediaType) {
    case "movie":
      return <circle cx={0} cy={0} r={r} {...common} />;
    case "tv":
      return (
        <rect
          x={-r * 1.05}
          y={-r * 0.8}
          width={r * 2.1}
          height={r * 1.6}
          rx={r * 0.3}
          {...common}
        />
      );
    case "anime": {
      const h = r * 1.05;
      const w = h * 0.866;
      const pts = [
        [0, -h],
        [w, -h * 0.5],
        [w, h * 0.5],
        [0, h],
        [-w, h * 0.5],
        [-w, -h * 0.5],
      ]
        .map((p) => `${p[0]},${p[1]}`)
        .join(" ");
      return <polygon points={pts} {...common} />;
    }
    case "game": {
      const d = r * 1.2;
      return <polygon points={`0,-${d} ${d},0 0,${d} -${d},0`} {...common} />;
    }
    case "manga":
      return (
        <rect
          x={-r * 0.85}
          y={-r * 1.2}
          width={r * 1.7}
          height={r * 2.4}
          {...common}
        />
      );
    case "book":
      return (
        <rect
          x={-r * 0.7}
          y={-r * 1.4}
          width={r * 1.4}
          height={r * 2.8}
          {...common}
        />
      );
  }
}

export const ConstellationCanvas = forwardRef<ConstellationCanvasHandle, Props>(
  function ConstellationCanvas(
    { graph, selectedNodeId, onSelect, activeFormats, onFocusedClusterChange },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<
      SVGSVGElement,
      unknown
    > | null>(null);
    const dragBehaviorRef = useRef<d3.DragBehavior<
      SVGGraphicsElement,
      unknown,
      GraphNode | null
    > | null>(null);
    const [, setTick] = useState(0);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredClusterLabel, setHoveredClusterLabel] = useState<
      string | null
    >(null);
    const [transform, setTransform] = useState<d3.ZoomTransform>(
      d3.zoomIdentity,
    );
    const [focusedClusterLabel, setFocusedClusterLabel] = useState<
      string | null
    >(null);
    const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(
      () => new Set(),
    );
    const [starfieldLit, setStarfieldLit] = useState(false);

    const prefersReducedMotion = useMemo(() => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);

    const stars = useMemo(() => seededStars(180, 90, 18), []);

    // Staggered fade-in on first load: stars come up first as a backdrop, then
    // each title star twinkles in. Skipped under prefers-reduced-motion so
    // accessibility users see the final state immediately.
    useEffect(() => {
      if (prefersReducedMotion) {
        setStarfieldLit(true);
        setLoadedNodeIds(new Set(graph.nodes.map((n) => n.id)));
        return;
      }
      setStarfieldLit(false);
      setLoadedNodeIds(new Set());
      const fieldTimer = setTimeout(() => setStarfieldLit(true), 80);
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
            // Weak link force: present so connected nodes drift slightly
            // toward each other but doesn't override the cluster pull.
            // Reduced from 0.015+s*0.05 because min-normalized edges create
            // many strength-1.0 connections that were biasing single-tag
            // favorites toward their connected partners and off-center
            // within their primary cluster.
            .strength((d) => 0.005 + d.strength * 0.02),
        )
        .force("charge", d3.forceManyBody<GraphNode>().strength(-420))
        .force(
          "collide",
          d3
            .forceCollide<GraphNode>()
            .radius(NODE_RADIUS + 8)
            .strength(0.95),
        )
        // Bumped from 0.4 to 0.55. Stronger pull to primary cluster center
        // so nodes stay visibly inside their glow instead of drifting toward
        // edge-connected partners in other clusters.
        .force("x", d3.forceX<GraphNode>((d) => targetFor(d).x).strength(0.55))
        .force("y", d3.forceY<GraphNode>((d) => targetFor(d).y).strength(0.55))
        .alpha(1)
        .alphaDecay(prefersReducedMotion ? 0.05 : 0.02)
        // alphaTarget keeps the simulation ticking gently forever (drift-on-
        // rest). Constellation should feel like stars in slow orbital motion,
        // not a frozen graph. 0 when prefers-reduced-motion so the layout
        // settles and stays still for users who opted out of motion.
        .alphaTarget(prefersReducedMotion ? 0 : 0.012)
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
          setTick((t) => t + 1);
        });

      simRef.current = sim;
      return () => {
        sim.stop();
        simRef.current = null;
      };
    }, [graph, clusterByLabel, prefersReducedMotion]);

    // Build the drag behavior once per graph. Stored in a ref so the
    // re-attachment effect below can use it without re-creating the closures.
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
            simRef.current?.alphaTarget(prefersReducedMotion ? 0 : 0.012);
          subject.fx = null;
          subject.fy = null;
        });
    }, [graph, prefersReducedMotion]);

    // Attach the drag behavior to whatever .node elements are currently in
    // the DOM. Runs after every render — d3's .call(drag) is idempotent so
    // re-attaching is cheap, and this guards against React reconciliation
    // remounting nodes (which silently drops the previous binding). Selector
    // is `.node` (not `circle.node`) because node shapes vary by mediaType:
    // <g class="node"> wrapper hosts circle / rect / polygon glyphs.
    useEffect(() => {
      const svg = svgRef.current;
      if (!svg || !dragBehaviorRef.current) return;
      d3.select(svg)
        .selectAll<SVGGraphicsElement, unknown>(".node")
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
          return target.closest(".node") === null;
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
        clearClusterFocus: () => resetView(),
      }),
      [graph],
    );

    // Mirror focused cluster state up to the parent so it can render the
    // cluster info panel. Fires on every change including clears.
    useEffect(() => {
      onFocusedClusterChange?.(focusedClusterLabel);
    }, [focusedClusterLabel, onFocusedClusterChange]);

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
    const inHoveredCluster = (id: string): boolean => {
      if (!hoveredClusterLabel) return false;
      const node = nodes.find((n) => n.id === id);
      return node?.themes.includes(hoveredClusterLabel) ?? false;
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
          <filter
            id="node-glow-strong"
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Soft nebula gradients — cosmos depth without noise. Three
              large, low-opacity blobs in cool/warm tints anchored in the
              dead-space corners between cluster glows. Drawn underneath
              the starfield so stars sit on top. */}
          <radialGradient id="nebula-deep-blue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b4a8a" stopOpacity={0.18} />
            <stop offset="50%" stopColor="#3b4a8a" stopOpacity={0.06} />
            <stop offset="100%" stopColor="#3b4a8a" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="nebula-purple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6b3a8a" stopOpacity={0.14} />
            <stop offset="50%" stopColor="#6b3a8a" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#6b3a8a" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="nebula-warm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8a5a3b" stopOpacity={0.1} />
            <stop offset="50%" stopColor="#8a5a3b" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#8a5a3b" stopOpacity={0} />
          </radialGradient>
        </defs>

        <g className="zoom-layer" transform={transform.toString()}>
          {/* Nebula layer — drawn first so stars + clusters sit on top.
              Three big soft blobs in opposing corners give the canvas
              cosmic depth without competing with the constellation. */}
          <g
            className="nebula"
            opacity={starfieldLit ? 1 : 0}
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "opacity 1800ms ease-out",
            }}
          >
            <ellipse
              cx={CANVAS_W * 0.18}
              cy={CANVAS_H * 0.22}
              rx={CANVAS_W * 0.42}
              ry={CANVAS_H * 0.5}
              fill="url(#nebula-deep-blue)"
            />
            <ellipse
              cx={CANVAS_W * 0.85}
              cy={CANVAS_H * 0.78}
              rx={CANVAS_W * 0.38}
              ry={CANVAS_H * 0.45}
              fill="url(#nebula-purple)"
            />
            <ellipse
              cx={CANVAS_W * 0.75}
              cy={CANVAS_H * 0.18}
              rx={CANVAS_W * 0.32}
              ry={CANVAS_H * 0.4}
              fill="url(#nebula-warm)"
            />
          </g>
          <g
            className="starfield"
            opacity={starfieldLit ? 1 : 0}
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "opacity 1400ms ease-out",
            }}
          >
            {stars.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={s.fill}
                opacity={s.o}
              />
            ))}
          </g>

          <g className="clusters">
            {clusters.map((c, i) => {
              const dim =
                focusedClusterLabel !== null && c.label !== focusedClusterLabel;
              const isFocused = c.label === focusedClusterLabel;
              const isHovered =
                !inGalaxyMode && c.label === hoveredClusterLabel;
              const visualR =
                c.radius * (isFocused ? 1.9 : isHovered ? 1.75 : 1.6);
              // Hit area is intentionally smaller than the visual gradient: the
              // gradient bleeds far past the cluster's actual node cloud, and big
              // overlapping hit areas were thrashing the hovered-cluster state on
              // every mouse move. 110px keeps adjacent clusters from overlapping
              // even at the highest theme weight.
              const hitR = Math.min(c.radius, 110);
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
                    r={hitR}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      flyToCluster(c.label);
                    }}
                    onMouseEnter={() => setHoveredClusterLabel(c.label)}
                    onMouseLeave={() =>
                      setHoveredClusterLabel((cur) =>
                        cur === c.label ? null : cur,
                      )
                    }
                  />
                </g>
              );
            })}
          </g>

          <g className="edges" style={{ pointerEvents: "none" }}>
            {edges.map((e, i) => {
              const s = e.source as GraphNode;
              const t = e.target as GraphNode;
              if (typeof s !== "object" || typeof t !== "object") return null;
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
              // Theme-tint: pick color of strongest shared theme. Otherwise
              // fall back to neutral gray. Active state always uses the warm
              // highlight so it reads as "this is the connection you're
              // looking at" regardless of theme.
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
              // Gentle quadratic curve via control point perpendicular to the
              // chord midpoint. Magnitude scales with chord length so short
              // edges stay near-straight, long edges arc visibly.
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

          <g className="cluster-labels">
            {clusters.map((c) => {
              const lines = wrapClusterLabel(c.label);
              const lineHeight = 14;
              // Position labels radially outward from canvas center — past the
              // glow, anchored away from the middle. Cluster centers lie on a
              // ring around (CANVAS_W/2, CANVAS_H/2), so the unit vector from
              // center → cluster is also the direction to push the label.
              const dx = c.centerX - CANVAS_W / 2;
              const dy = c.centerY - CANVAS_H / 2;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const labelDist = dist + c.radius + 14;
              const margin = 16;
              let labelX = CANVAS_W / 2 + ux * labelDist;
              let labelY = CANVAS_H / 2 + uy * labelDist;
              // Clamp to canvas — corner clusters may radially push off-canvas;
              // the stroke-bg paintOrder keeps the label readable even when it
              // ends up over a glow.
              const halfBlock = ((lines.length - 1) * lineHeight) / 2;
              if (labelY - halfBlock < margin) labelY = margin + halfBlock;
              if (labelY + halfBlock > CANVAS_H - margin)
                labelY = CANVAS_H - margin - halfBlock;
              if (labelX < margin + 80) labelX = margin + 80;
              if (labelX > CANVAS_W - margin - 80)
                labelX = CANVAS_W - margin - 80;
              // Anchor: text grows away from canvas center horizontally.
              const textAnchor =
                ux > 0.4 ? "start" : ux < -0.4 ? "end" : "middle";
              const isFocused = c.label === focusedClusterLabel;
              const isHovered =
                !inGalaxyMode && c.label === hoveredClusterLabel;
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
                  fontSize={isFocused || isHovered ? 13 : 11}
                  style={{
                    pointerEvents: "none",
                    letterSpacing: "0.05em",
                    paintOrder: "stroke fill",
                    stroke: "#05060a",
                    strokeWidth: 3,
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
                    transition: prefersReducedMotion
                      ? "none"
                      : "opacity 600ms ease",
                    pointerEvents: filteredOut ? "none" : undefined,
                  }}
                  onMouseEnter={() => setHoveredNodeId(n.id)}
                  onMouseLeave={() =>
                    setHoveredNodeId((cur) => (cur === n.id ? null : cur))
                  }
                  onClick={(e) => handleNodeClick(n.id, e)}
                >
                  {nodeGlyph(
                    n.mediaType,
                    r,
                    "#fefce8",
                    color,
                    isFocus ? 2 : 1.4,
                  )}
                </g>
              );
            })}
          </g>
        </g>

        {selectedNode && (
          <circle
            cx={transform.applyX(selectedNode.x ?? 0)}
            cy={transform.applyY(selectedNode.y ?? 0)}
            r={
              NODE_RADIUS * 2.4 * nodeSizeMultiplier(selectedNode) * transform.k
            }
            fill="none"
            stroke={nodeColor.get(selectedNode.id) ?? "#fefce8"}
            strokeWidth={1}
            strokeOpacity={0.6}
            strokeDasharray="3 3"
            style={{ pointerEvents: "none" }}
          />
        )}

        {hoveredNode &&
          (() => {
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
  },
);
