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
import type { Avoidance } from "../../types/profile";

interface Props {
  graph: Graph;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  activeFormats: Set<GraphNode["mediaType"]>;
  /** Fired whenever galaxy-mode focus changes — when the user clicks a
   * cluster label, zooms in past the threshold, or exits galaxy mode.
   * View consumes this to render the cluster info panel. */
  onFocusedClusterChange?: (label: string | null) => void;
  /** When false, only edges connected to the selected node are rendered.
   * Lets users declutter the canvas to focus on one title at a time.
   * When true (default), all edges render with the existing opacity rules. */
  showAllConnections?: boolean;
  /** Profile-level avoidances — disliked titles render as anti-stars
   * (X marks) at the canvas perimeter; pattern avoidances are not yet
   * surfaced visually. */
  avoidances?: Avoidance[];
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

// Extended bounds for the background starfield + nebulae. The constellation
// itself lives within [0..CANVAS_W] × [0..CANVAS_H], but at minimum zoom
// level (0.6×) the viewport sees roughly 2× the canvas in each dimension.
// The starfield + nebulae are generated across this larger box so the
// background always covers what the user can see — no awkward black void
// past the cluster orbit.
const BG_X_MIN = -CANVAS_W * 0.6;
const BG_X_MAX = CANVAS_W * 1.6;
const BG_Y_MIN = -CANVAS_H * 0.6;
const BG_Y_MAX = CANVAS_H * 1.6;
const BG_X_RANGE = BG_X_MAX - BG_X_MIN;
const BG_Y_RANGE = BG_Y_MAX - BG_Y_MIN;

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
  const x = () => BG_X_MIN + rand() * BG_X_RANGE;
  const y = () => BG_Y_MIN + rand() * BG_Y_RANGE;
  // Distant layer: tiny, low opacity, dense
  for (let i = 0; i < distantCount; i++) {
    out.push({
      x: x(),
      y: y(),
      r: 0.3 + rand() * 0.5,
      o: 0.12 + rand() * 0.2,
      fill: pickFill(),
    });
  }
  // Midfield: moderate size + opacity
  for (let i = 0; i < midCount; i++) {
    out.push({
      x: x(),
      y: y(),
      r: 0.5 + rand() * 0.9,
      o: 0.22 + rand() * 0.4,
      fill: pickFill(),
    });
  }
  // Anchor stars: bright, varied, sparse
  for (let i = 0; i < anchorCount; i++) {
    out.push({
      x: x(),
      y: y(),
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

function pointsFromCoords(coords: number[][]): string {
  return coords.map((p) => `${p[0]},${p[1]}`).join(" ");
}

function starPoints(
  count: number,
  outerR: number,
  innerR: number,
): string {
  const coords: number[][] = [];
  const total = count * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    coords.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return pointsFromCoords(coords);
}

/**
 * Per-format node glyph. All shapes are roughly equal in visual area so
 * differentiation reads as identity, not size. Drawn at origin (0,0); the
 * parent <g> handles positioning via transform.
 *
 *   movie  → circle (round, classic)
 *   tv     → triangle pointing up (bold geometric)
 *   anime  → hexagon (six-sided)
 *   game   → diamond (rotated square)
 *   manga  → 5-point star (the constellation primitive)
 *   book   → 4-point sparkle star (compass / burst)
 *
 * Squares and rectangles read as UI chrome, not stars; the previous TV
 * rounded-square and manga/book rectangles felt off at this scale.
 * Replaced with shapes that all read as celestial objects.
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
    case "tv": {
      // Equilateral triangle pointing up. Slightly bigger r to compensate
      // for the visual-area difference vs a circle of the same r.
      const h = r * 1.2;
      const w = h * 0.866;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -h * 0.85],
            [w, h * 0.55],
            [-w, h * 0.55],
          ])}
          strokeLinejoin="round"
          {...common}
        />
      );
    }
    case "anime": {
      const h = r * 1.05;
      const w = h * 0.866;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -h],
            [w, -h * 0.5],
            [w, h * 0.5],
            [0, h],
            [-w, h * 0.5],
            [-w, -h * 0.5],
          ])}
          {...common}
        />
      );
    }
    case "game": {
      const d = r * 1.2;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -d],
            [d, 0],
            [0, d],
            [-d, 0],
          ])}
          {...common}
        />
      );
    }
    case "manga":
      return (
        <polygon
          points={starPoints(5, r * 1.25, r * 0.5)}
          strokeLinejoin="round"
          {...common}
        />
      );
    case "book":
      return (
        <polygon
          points={starPoints(4, r * 1.3, r * 0.42)}
          strokeLinejoin="round"
          {...common}
        />
      );
  }
}

export const ConstellationCanvas = forwardRef<ConstellationCanvasHandle, Props>(
  function ConstellationCanvas(
    {
      graph,
      selectedNodeId,
      onSelect,
      activeFormats,
      onFocusedClusterChange,
      showAllConnections = true,
      avoidances = [],
    },
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
    // Snapshot of the user's transform right before they entered galaxy
    // mode. Restored on exit so resetting from a cluster returns to where
    // they were exploring, not all the way back to identity. Cleared
    // after restore so subsequent Reset View clicks go to identity.
    const preFocusTransformRef = useRef<d3.ZoomTransform | null>(null);
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

    const stars = useMemo(() => seededStars(800, 320, 80), []);
    // The brightest 8 anchor stars get cross-flares — thin radiating
    // lines that read as starlight diffraction. Expensive at large counts,
    // so we limit to a handful of the brightest.
    const flareStars = useMemo(
      () =>
        stars
          .filter((s) => s.r > 1.8 && s.o > 0.7)
          .sort((a, b) => b.r - a.r)
          .slice(0, 8),
      [stars],
    );

    // Anti-stars: disliked titles rendered as muted X glyphs around the
    // canvas perimeter, in the negative space outside the cluster orbits.
    // Visualizes "what's outside your taste" — completes the portrait
    // alongside the (positive) constellation. Pattern avoidances are
    // skipped here; they're abstract and would need a different surface.
    // Positions are seeded per profile so the same disliked set always
    // lays out the same way.
    const antiStars = useMemo(() => {
      const titles = avoidances
        .filter((a) => a.kind === "title")
        .map((a) => a.description);
      if (titles.length === 0)
        return [] as { title: string; x: number; y: number }[];
      let seed = 7919;
      for (const t of titles)
        for (let i = 0; i < t.length; i++) {
          seed = ((seed * 31) ^ t.charCodeAt(i)) | 0;
        }
      const rand = () => {
        seed = ((seed * 1664525) + 1013904223) | 0;
        return ((seed >>> 0) % 1_000_000) / 1_000_000;
      };
      const baseR = Math.min(CANVAS_W, CANVAS_H) * 0.46;
      const margin = 40;
      return titles.map((title, i) => {
        const evenAngle = (i / titles.length) * Math.PI * 2 - Math.PI / 4;
        const jitter = (rand() - 0.5) * (Math.PI / titles.length) * 0.7;
        const angle = evenAngle + jitter;
        const r = baseR + (rand() - 0.5) * 40;
        let x = CANVAS_W / 2 + Math.cos(angle) * r;
        let y = CANVAS_H / 2 + Math.sin(angle) * r;
        x = Math.max(margin, Math.min(CANVAS_W - margin, x));
        y = Math.max(margin, Math.min(CANVAS_H - margin, y));
        return { title, x, y };
      });
    }, [avoidances]);

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
        // settles and stays still for users who opted out of motion. Bumped
        // from 0.012 to 0.03 — drift was technically active before but too
        // subtle to read as motion at this node count.
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
            simRef.current?.alphaTarget(prefersReducedMotion ? 0 : 0.03);
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
      // If we entered galaxy mode from a non-identity zoom, restore that
      // pre-focus transform instead of jumping all the way to identity —
      // less disorienting for users who were already exploring zoomed in.
      // Falls back to identity when no snapshot exists.
      const target = preFocusTransformRef.current ?? d3.zoomIdentity;
      preFocusTransformRef.current = null;
      setFocusedClusterLabel(null);
      d3.select(svg).transition().duration(700).call(zoom.transform, target);
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
      // Snapshot the user's current transform before entering galaxy mode
      // — only when not already in one. Switching between clusters keeps
      // the original snapshot so "Back" returns to the original spot, not
      // the previous cluster.
      if (focusedClusterLabel === null) {
        preFocusTransformRef.current = d3.zoomTransform(svg);
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
      <div className="relative h-full w-full">
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
              Soft blobs distributed across the extended background bounds
              so the cosmos extends past the constellation viewBox; user
              sees nebula at any zoom level. */}
          <g
            className="nebula"
            opacity={starfieldLit ? 1 : 0}
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "opacity 1800ms ease-out",
            }}
          >
            {/* In-bounds nebulae (sit behind the constellation itself) */}
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
            {/* Out-of-bounds nebulae (cover what user sees when zoomed
                out past the viewBox) */}
            <ellipse
              cx={-CANVAS_W * 0.25}
              cy={CANVAS_H * 0.55}
              rx={CANVAS_W * 0.5}
              ry={CANVAS_H * 0.6}
              fill="url(#nebula-purple)"
            />
            <ellipse
              cx={CANVAS_W * 1.3}
              cy={CANVAS_H * 0.35}
              rx={CANVAS_W * 0.5}
              ry={CANVAS_H * 0.55}
              fill="url(#nebula-deep-blue)"
            />
            <ellipse
              cx={CANVAS_W * 0.4}
              cy={-CANVAS_H * 0.3}
              rx={CANVAS_W * 0.55}
              ry={CANVAS_H * 0.45}
              fill="url(#nebula-warm)"
            />
            <ellipse
              cx={CANVAS_W * 0.6}
              cy={CANVAS_H * 1.35}
              rx={CANVAS_W * 0.6}
              ry={CANVAS_H * 0.5}
              fill="url(#nebula-deep-blue)"
            />
          </g>
          <g
            className="star-flares"
            opacity={starfieldLit ? 1 : 0}
            style={{
              transition: prefersReducedMotion
                ? "none"
                : "opacity 1800ms ease-out",
            }}
          >
            {flareStars.map((s, i) => {
              const len = s.r * 8;
              return (
                <g key={`flare-${i}`} opacity={0.5}>
                  <line
                    x1={s.x - len}
                    y1={s.y}
                    x2={s.x + len}
                    y2={s.y}
                    stroke={s.fill}
                    strokeWidth={0.5}
                  />
                  <line
                    x1={s.x}
                    y1={s.y - len}
                    x2={s.x}
                    y2={s.y + len}
                    stroke={s.fill}
                    strokeWidth={0.5}
                  />
                </g>
              );
            })}
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

          {/* Anti-stars layer — disliked titles as X marks around the
              perimeter. Painted between starfield and clusters so they
              read as "negative space markers" — visible but secondary
              to the constellation itself. Dim further in galaxy mode
              to focus attention on the active cluster. */}
          {antiStars.length > 0 && (
            <g
              className="anti-stars"
              opacity={
                starfieldLit ? (focusedClusterLabel !== null ? 0.15 : 0.5) : 0
              }
              style={{
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 600ms ease",
              }}
            >
              {antiStars.map((a, i) => (
                <g
                  key={i}
                  transform={`translate(${a.x},${a.y})`}
                >
                  <circle cx={0} cy={0} r={22} fill="transparent">
                    <title>{`✗ ${a.title} — outside your taste`}</title>
                  </circle>
                  <line
                    x1={-7}
                    y1={-7}
                    x2={7}
                    y2={7}
                    stroke="#a1a8b3"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                  <line
                    x1={-7}
                    y1={7}
                    x2={7}
                    y2={-7}
                    stroke="#a1a8b3"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </g>
          )}

          <g className="clusters">
            {clusters.map((c, i) => {
              const dim =
                focusedClusterLabel !== null && c.label !== focusedClusterLabel;
              const isFocused = c.label === focusedClusterLabel;
              const isHovered =
                !inGalaxyMode && c.label === hoveredClusterLabel;
              const visualR =
                c.radius * (isFocused ? 1.9 : isHovered ? 1.75 : 1.6);
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
                  {/* Inner tap zone for cluster focus. 22 on mobile felt
                      cramped on PC; 55 gives a healthy click target while
                      staying smaller than typical adjacent-cluster spacing
                      so zones don't overlap. Painted before nodes — node
                      hit areas (radius ~30) sit on top in the dense
                      member area, so star clicks still win there. The
                      empty negative space at cluster center catches taps
                      that would otherwise miss between nodes. */}
                  <circle
                    cx={c.centerX}
                    cy={c.centerY}
                    r={55}
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
              // Connection visibility toggle: when "off", only render edges
              // connected to the currently selected/hovered node. With no
              // selection, show nothing — clean canvas. Existing opacity
              // rules below still apply on top of this gate.
              if (!showAllConnections) {
                const focusId = selectedNodeId ?? hoveredNodeId;
                if (
                  focusId === null ||
                  (s.id !== focusId && t.id !== focusId)
                ) {
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
              // Label distance: project past the cluster's outer edge plus
              // a generous margin so labels don't overlap adjacent cluster
              // glows in the force-directed layout. Was 14; bumped to 36.
              const labelDist = dist + c.radius + 36;
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
                  fontSize={isFocused || isHovered ? 17 : 15}
                  fontStyle="italic"
                  fontWeight={400}
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
                  style={{
                    fontFamily:
                      '"Iowan Old Style", Charter, Georgia, "Times New Roman", serif',
                    letterSpacing: "0.08em",
                    paintOrder: "stroke fill",
                    stroke: "#05060a",
                    strokeWidth: 4,
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
                  {/* Invisible hit area, sized for touch. The 6-12px visible
                      glyph is too small for finger taps once the SVG scales
                      to a phone viewport (~1.9px on screen). 30 viewBox
                      units = ~9px touch on a 375px phone — still small but
                      meaningfully better. */}
                  <circle cx={0} cy={0} r={Math.max(30, r * 2)} fill="transparent" />
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

      </svg>

      {/* Reset View button + double-tap hint, HTML overlay (not
          foreignObject) so they don't scale with the viewBox.
          Mobile: top-left (bottom is covered by bottom-sheet panels).
          md+: bottom-left (where it lives on desktop). */}
      {(isZoomed || inGalaxyMode) && (
        <div className="pointer-events-none absolute top-3 left-3 z-30 flex items-center gap-2 md:top-auto md:bottom-4 md:left-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetView();
            }}
            className="pointer-events-auto cursor-pointer rounded-md border border-white/10 bg-[var(--color-surface)] px-3.5 py-2.5 font-mono text-[11px] tracking-[0.18em] text-zinc-300 uppercase backdrop-blur-md transition-colors hover:border-white/20 hover:text-zinc-100"
          >
            {inGalaxyMode ? "← Back" : "↺ Reset"}
          </button>
          <span className="font-mono text-[9px] tracking-[0.2em] text-zinc-600 uppercase">
            or 2× tap
          </span>
        </div>
      )}
      </div>
    );
  },
);
