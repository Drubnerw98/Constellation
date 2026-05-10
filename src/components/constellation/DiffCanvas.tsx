import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { DiffGraph } from "../../lib/diffGraph";
import type {
  Graph,
  GraphEdge,
  GraphNode,
  ThemeCluster,
} from "../../types/graph";
import {
  AntiStars,
  Defs,
  NebulaLayer,
  Starfield,
  StarFlares,
} from "./canvas/BackgroundLayers";
import { wrapClusterLabel } from "./canvas/helpers";
import { nodeGlyph } from "./canvas/glyph";
import {
  CANVAS_H,
  CANVAS_W,
  NODE_RADIUS,
  primaryClusterFor,
  seededStars,
} from "./canvas/helpers";

/** ease-in-out cubic — feels right for the categorical fades (added/removed
 * nodes appear/disappear in the second half of the scrub when the layout is
 * already shifting visibly). */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Run a force simulation to equilibrium synchronously — same forces as the
 * live canvas's useForceSimulation but without the React render loop. The
 * diff renderer reads `n.x` / `n.y` after this returns and never re-runs
 * the sim, so we can dial alphaTarget to 0 and use more ticks for a tighter
 * settle. */
function settleSimulation(
  graph: Graph,
  clusterByLabel: Map<string, ThemeCluster>,
): void {
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
        .strength((d) => 0.005 + d.strength * 0.02),
    )
    .force("charge", d3.forceManyBody<GraphNode>().strength(-420))
    .force(
      "collide",
      d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 8).strength(0.95),
    )
    .force("x", d3.forceX<GraphNode>((d) => targetFor(d).x).strength(0.55))
    .force("y", d3.forceY<GraphNode>((d) => targetFor(d).y).strength(0.55))
    .alpha(1)
    .alphaDecay(0.025)
    .alphaTarget(0)
    .stop();

  // 350 ticks is enough for the 30-70 node range to settle. Per-tick
  // boundary clamp matches the live canvas's behavior.
  const padding = NODE_RADIUS * 4.5;
  for (let i = 0; i < 350; i++) {
    sim.tick();
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
  }
}

interface PositionedNode {
  /** Node payload — we always render the `to` version's metadata (mediaType,
   * title) when a node is stable, since the renderer uses `to` as canonical
   * for shared identities. */
  node: GraphNode;
  /** Diff-relative class — drives color override + opacity ramp. */
  kind: "stable" | "added" | "removed";
  /** Snapshot positions captured after settleSimulation. We snapshot
   * eagerly so the slider's render loop doesn't read live sim state
   * (the simulations have alphaTarget=0; they're frozen, but reading
   * a snapshot is one less indirection). */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** When stable, primaryTheme on each side — used to surface
   * cluster-migration via halo color shift. Currently informational; the
   * renderer doesn't override color for migrants but we record it for
   * potential future surfacing. */
  primaryThemeFrom: string | null;
  primaryThemeTo: string | null;
}

interface PositionedCluster {
  cluster: ThemeCluster;
  kind: "shared" | "added" | "removed";
  /** Snapshot from `fromGraph.clusters[label]` for shared clusters; null
   * for added (no prior position). */
  fromX: number | null;
  fromY: number | null;
  fromRadius: number | null;
  toX: number;
  toY: number;
  toRadius: number;
}

interface Props {
  diff: DiffGraph;
  /** 0 = from-version layout, 1 = to-version layout. */
  scrub: number;
  prefersReducedMotion: boolean;
}

/** Visual accents for added/removed clusters. Saffron amber for "added"
 * (warm, signals new arrival) and a faded crimson for "removed" (cool
 * fade-out). These override the per-theme color from buildGraph for the
 * categorical clusters since "what changed" is the headline signal. */
const ADDED_ACCENT = "#f59e0b";
const REMOVED_ACCENT = "#ef4444";

/**
 * Renders an animated diff between two profile versions on a single canvas.
 * Two simulations are settled offscreen at mount; the slider drives a lerp
 * between captured positions for stable nodes plus opacity ramps for
 * added/removed nodes and clusters.
 *
 * Edge handling: we render only the "from" graph's edges when scrub < 0.5
 * and the "to" graph's edges when scrub >= 0.5, with a symmetric
 * cross-fade in the band around 0.5. Trying to interpolate per-edge
 * positions for stable-node edges and fade in/out delta edges separately
 * was three layers of complexity for marginal visual gain — the
 * cross-fade reads as a layout settling moment in the middle of the
 * scrub, which is honest about what happened.
 */
export function DiffCanvas({ diff, scrub, prefersReducedMotion }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const prefersRM = prefersReducedMotion;

  const stars = useMemo(() => seededStars(800, 320, 80), []);
  const flareStars = useMemo(
    () =>
      stars
        .filter((s) => s.r > 1.8 && s.o > 0.7)
        .sort((a, b) => b.r - a.r)
        .slice(0, 8),
    [stars],
  );

  // Settle both simulations and capture positions. Re-runs whenever the
  // diff input identity changes (new pair of versions selected).
  const { positionedNodes, positionedClusters, fromGraph, toGraph, allClusters } =
    useMemo(() => {
      const fromClusterByLabel = new Map(
        diff.fromGraph.clusters.map((c) => [c.label, c]),
      );
      const toClusterByLabel = new Map(
        diff.toGraph.clusters.map((c) => [c.label, c]),
      );

      settleSimulation(diff.fromGraph, fromClusterByLabel);
      settleSimulation(diff.toGraph, toClusterByLabel);

      const fromNodeByTitle = new Map(
        diff.fromGraph.nodes.map((n) => [n.title, n]),
      );
      const toNodeByTitle = new Map(
        diff.toGraph.nodes.map((n) => [n.title, n]),
      );

      const positioned: PositionedNode[] = [];
      // Stable: lerp between snapshots.
      for (const s of diff.nodes.stable) {
        const fromN = fromNodeByTitle.get(s.from.title) ?? s.from;
        const toN = toNodeByTitle.get(s.to.title) ?? s.to;
        positioned.push({
          node: toN,
          kind: "stable",
          fromX: fromN.x ?? CANVAS_W / 2,
          fromY: fromN.y ?? CANVAS_H / 2,
          toX: toN.x ?? CANVAS_W / 2,
          toY: toN.y ?? CANVAS_H / 2,
          primaryThemeFrom: fromN.primaryTheme,
          primaryThemeTo: toN.primaryTheme,
        });
      }
      // Added: pinned at the to-position; opacity ramps in.
      for (const n of diff.nodes.added) {
        positioned.push({
          node: n,
          kind: "added",
          fromX: n.x ?? CANVAS_W / 2,
          fromY: n.y ?? CANVAS_H / 2,
          toX: n.x ?? CANVAS_W / 2,
          toY: n.y ?? CANVAS_H / 2,
          primaryThemeFrom: null,
          primaryThemeTo: n.primaryTheme,
        });
      }
      // Removed: pinned at the from-position; opacity ramps out.
      for (const n of diff.nodes.removed) {
        positioned.push({
          node: n,
          kind: "removed",
          fromX: n.x ?? CANVAS_W / 2,
          fromY: n.y ?? CANVAS_H / 2,
          toX: n.x ?? CANVAS_W / 2,
          toY: n.y ?? CANVAS_H / 2,
          primaryThemeFrom: n.primaryTheme,
          primaryThemeTo: null,
        });
      }

      // Cluster diff: shared clusters lerp center+radius. Added pinned at
      // their to-position. Removed pinned at their from-position.
      const positionedClustersOut: PositionedCluster[] = [];
      // Shared: match by normalized label across the two graphs to find
      // the from-side counterpart.
      const norm = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[-_/]+/g, " ")
          .replace(/[^a-z0-9 ]/g, "")
          .replace(/\s+/g, " ");
      const fromByNorm = new Map(
        diff.fromGraph.clusters.map((c) => [norm(c.label), c]),
      );
      for (const sharedC of diff.clusters.shared) {
        const fromC = fromByNorm.get(norm(sharedC.label));
        positionedClustersOut.push({
          cluster: sharedC,
          kind: "shared",
          fromX: fromC?.centerX ?? sharedC.centerX,
          fromY: fromC?.centerY ?? sharedC.centerY,
          fromRadius: fromC?.radius ?? sharedC.radius,
          toX: sharedC.centerX,
          toY: sharedC.centerY,
          toRadius: sharedC.radius,
        });
      }
      for (const c of diff.clusters.addedTo) {
        positionedClustersOut.push({
          cluster: c,
          kind: "added",
          fromX: null,
          fromY: null,
          fromRadius: null,
          toX: c.centerX,
          toY: c.centerY,
          toRadius: c.radius,
        });
      }
      for (const c of diff.clusters.removedFrom) {
        positionedClustersOut.push({
          cluster: c,
          kind: "removed",
          fromX: c.centerX,
          fromY: c.centerY,
          fromRadius: c.radius,
          toX: c.centerX,
          toY: c.centerY,
          toRadius: c.radius,
        });
      }

      // The Defs layer paints one radialGradient per cluster keyed by
      // `cluster-grad-${i}`. We need ALL clusters present so every
      // PositionedCluster has a gradient to reference. Build a combined
      // unique-by-label list with the categorical clusters' base color
      // overridden via the saffron/crimson palette.
      const allByLabel = new Map<string, ThemeCluster>();
      for (const c of diff.clusters.shared) allByLabel.set(c.label, c);
      for (const c of diff.clusters.addedTo)
        allByLabel.set(c.label, { ...c, color: ADDED_ACCENT });
      for (const c of diff.clusters.removedFrom)
        allByLabel.set(c.label, { ...c, color: REMOVED_ACCENT });

      return {
        positionedNodes: positioned,
        positionedClusters: positionedClustersOut,
        fromGraph: diff.fromGraph,
        toGraph: diff.toGraph,
        allClusters: Array.from(allByLabel.values()),
      };
    }, [diff]);

  // Edge cross-fade: the from edges fade out from scrub 0.4..0.5 and the
  // to edges fade in from 0.5..0.6. Outside that band only one set is
  // visible. Captured live so each render uses the current scrub.
  const scrubLerp = useMemo(() => ease(scrub), [scrub]);

  // Fade-in handling — the diff canvas snaps in fully visible (no
  // staggered per-node twinkle from the live canvas) since the scrub
  // animation IS the entry experience. Reduced-motion users get the
  // same instant-on, so this is just a flag for the static layers.
  const [layersLit, setLayersLit] = useState(false);
  useEffect(() => {
    // Synchronous reset on prop change to re-prime the fade-in. Matches the
    // pattern used in canvas/hooks.ts:useStarfieldFadeIn — the lint rule
    // is overly strict for animation-prime effects.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (prefersRM) {
      setLayersLit(true);
      return;
    }
    const t = setTimeout(() => setLayersLit(true), 60);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => clearTimeout(t);
  }, [prefersRM]);

  // Index for cluster-grad-N lookup so each cluster references the same
  // gradient regardless of categorical reshuffling.
  const gradIndexByLabel = useMemo(() => {
    const m = new Map<string, number>();
    allClusters.forEach((c, i) => m.set(c.label, i));
    return m;
  }, [allClusters]);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <Defs clusters={allClusters} />

        <NebulaLayer
          starfieldLit={layersLit}
          prefersReducedMotion={prefersRM}
        />
        <StarFlares
          flareStars={flareStars}
          starfieldLit={layersLit}
          prefersReducedMotion={prefersRM}
        />
        <Starfield
          stars={stars}
          starfieldLit={layersLit}
          prefersReducedMotion={prefersRM}
        />
        <AntiStars
          antiStars={[]}
          starfieldLit={layersLit}
          inGalaxyMode={false}
          prefersReducedMotion={prefersRM}
        />

        <DiffClusters
          positioned={positionedClusters}
          gradIndexByLabel={gradIndexByLabel}
          scrub={scrubLerp}
        />

        <DiffEdges
          fromGraph={fromGraph}
          toGraph={toGraph}
          scrub={scrub}
        />

        <DiffNodes positioned={positionedNodes} scrub={scrubLerp} />

        <DiffClusterLabels
          positioned={positionedClusters}
          scrub={scrubLerp}
        />
      </svg>
    </div>
  );
}

interface DiffClustersProps {
  positioned: PositionedCluster[];
  gradIndexByLabel: Map<string, number>;
  scrub: number;
}

/** Cluster glow circles. Shared clusters lerp center+radius; added clusters
 * fade in via opacity; removed clusters fade out. Saffron/crimson tints
 * applied via the pre-overridden gradient ids. */
function DiffClusters({
  positioned,
  gradIndexByLabel,
  scrub,
}: DiffClustersProps) {
  return (
    <g className="diff-clusters" style={{ pointerEvents: "none" }}>
      {positioned.map((p) => {
        const idx = gradIndexByLabel.get(p.cluster.label) ?? 0;
        let cx: number;
        let cy: number;
        let r: number;
        let opacity: number;
        if (p.kind === "shared") {
          cx = lerp(p.fromX!, p.toX, scrub);
          cy = lerp(p.fromY!, p.toY, scrub);
          r = lerp(p.fromRadius!, p.toRadius, scrub) * 1.6;
          opacity = 1;
        } else if (p.kind === "added") {
          cx = p.toX;
          cy = p.toY;
          r = p.toRadius * 1.6;
          // Hold near 0 until the second half, then ramp up — keeps the
          // first half of the scrub honest about the "from" world.
          opacity = Math.max(0, scrub * 1.4 - 0.3);
        } else {
          cx = p.fromX!;
          cy = p.fromY!;
          r = p.fromRadius! * 1.6;
          opacity = Math.max(0, 1 - scrub * 1.4);
        }
        return (
          <g key={p.cluster.label}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={`url(#cluster-grad-${idx})`}
              opacity={Math.min(1, opacity)}
            />
          </g>
        );
      })}
    </g>
  );
}

interface DiffClusterLabelsProps {
  positioned: PositionedCluster[];
  scrub: number;
}

/** Cluster labels rendered radially-out. Removed clusters get a strikethrough
 * via a `<line>` overlay; added get the saffron accent + a "new" caption.
 * Position lerps for shared, pinned for categorical. */
function DiffClusterLabels({ positioned, scrub }: DiffClusterLabelsProps) {
  return (
    <g className="diff-cluster-labels">
      {positioned.map((p) => {
        let cx: number;
        let cy: number;
        let opacity: number;
        let labelColor: string;
        let badge: "added" | "removed" | null = null;
        if (p.kind === "shared") {
          cx = lerp(p.fromX!, p.toX, scrub);
          cy = lerp(p.fromY!, p.toY, scrub);
          opacity = 0.75;
          labelColor = p.cluster.color;
        } else if (p.kind === "added") {
          cx = p.toX;
          cy = p.toY;
          opacity = Math.max(0, scrub * 1.4 - 0.3);
          labelColor = ADDED_ACCENT;
          badge = "added";
        } else {
          cx = p.fromX!;
          cy = p.fromY!;
          opacity = Math.max(0, 1 - scrub * 1.4);
          labelColor = REMOVED_ACCENT;
          badge = "removed";
        }
        const lines = wrapClusterLabel(p.cluster.label);
        const lineHeight = 14;
        const dx = cx - CANVAS_W / 2;
        const dy = cy - CANVAS_H / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const labelDist =
          dist + (p.kind === "shared" ? p.toRadius : p.fromRadius ?? p.toRadius) +
          70;
        // Top margin reserves space for the From/To pickers + back link +
        // SiteMark + UserButton chrome strip; bottom margin reserves space
        // for the scrub control. Without these reservations, cluster labels
        // render through the chrome on initial layout.
        const topMargin = 80;
        const bottomMargin = 80;
        const sideMargin = 16;
        let labelX = CANVAS_W / 2 + ux * labelDist;
        let labelY = CANVAS_H / 2 + uy * labelDist;
        const halfBlock = ((lines.length - 1) * lineHeight) / 2;
        if (labelY - halfBlock < topMargin) labelY = topMargin + halfBlock;
        if (labelY + halfBlock > CANVAS_H - bottomMargin)
          labelY = CANVAS_H - bottomMargin - halfBlock;
        if (labelX < sideMargin + 80) labelX = sideMargin + 80;
        if (labelX > CANVAS_W - sideMargin - 80)
          labelX = CANVAS_W - sideMargin - 80;
        const textAnchor =
          ux > 0.4 ? "start" : ux < -0.4 ? "end" : "middle";
        return (
          <g key={p.cluster.label} opacity={opacity}>
            <text
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fill={labelColor}
              fontSize={15}
              fontStyle="italic"
              fontWeight={400}
              style={{
                fontFamily:
                  '"Iowan Old Style", Charter, Georgia, "Times New Roman", serif',
                letterSpacing: "0.08em",
                paintOrder: "stroke fill",
                stroke: "#05060a",
                strokeWidth: 4,
                strokeLinejoin: "round",
                textDecoration: badge === "removed" ? "line-through" : "none",
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
            {badge !== null && (
              <text
                x={labelX}
                y={labelY + halfBlock + lineHeight + 4}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                fill={labelColor}
                fontSize={9}
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  paintOrder: "stroke fill",
                  stroke: "#05060a",
                  strokeWidth: 3,
                }}
              >
                {badge === "added" ? "new" : "removed"}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

interface DiffNodesProps {
  positioned: PositionedNode[];
  scrub: number;
}

function DiffNodes({ positioned, scrub }: DiffNodesProps) {
  return (
    <g className="diff-nodes" style={{ pointerEvents: "none" }}>
      {positioned.map((p) => {
        let x: number;
        let y: number;
        let opacity: number;
        let strokeColor = "#cbd5e1";
        if (p.kind === "stable") {
          x = lerp(p.fromX, p.toX, scrub);
          y = lerp(p.fromY, p.toY, scrub);
          opacity = 1;
        } else if (p.kind === "added") {
          x = p.toX;
          y = p.toY;
          opacity = Math.max(0, scrub * 1.4 - 0.3);
          strokeColor = ADDED_ACCENT;
        } else {
          x = p.fromX;
          y = p.fromY;
          opacity = Math.max(0, 1 - scrub * 1.4);
          strokeColor = REMOVED_ACCENT;
        }
        const r = NODE_RADIUS;
        return (
          <g
            key={`${p.kind}-${p.node.id}`}
            transform={`translate(${x},${y})`}
            opacity={opacity}
          >
            {nodeGlyph(p.node.mediaType, r, "#fefce8", strokeColor, 1.4)}
          </g>
        );
      })}
    </g>
  );
}

interface DiffEdgesProps {
  fromGraph: Graph;
  toGraph: Graph;
  scrub: number;
}

/** Edge cross-fade: from-edges fade out 0.4..0.6, to-edges fade in 0.4..0.6.
 * Edges are pinned to their respective layout's positions — interpolating
 * stable-edge endpoints would require matching edges by endpoint titles
 * (not ids), and the visual gain isn't worth the complexity. The crossfade
 * reads as the layout settling into a new shape, which is honest. */
function DiffEdges({ fromGraph, toGraph, scrub }: DiffEdgesProps) {
  const fromOpacity = Math.max(0, Math.min(1, (0.6 - scrub) / 0.2));
  const toOpacity = Math.max(0, Math.min(1, (scrub - 0.4) / 0.2));
  return (
    <g className="diff-edges" style={{ pointerEvents: "none" }}>
      {fromOpacity > 0.01 && (
        <EdgeSet
          graph={fromGraph}
          opacity={fromOpacity}
          baseStroke="#9aa4b2"
        />
      )}
      {toOpacity > 0.01 && (
        <EdgeSet graph={toGraph} opacity={toOpacity} baseStroke="#9aa4b2" />
      )}
    </g>
  );
}

interface EdgeSetProps {
  graph: Graph;
  opacity: number;
  baseStroke: string;
}

function EdgeSet({ graph, opacity, baseStroke }: EdgeSetProps) {
  const clusterByLabel = useMemo(
    () => new Map(graph.clusters.map((c) => [c.label, c])),
    [graph.clusters],
  );
  return (
    <g>
      {graph.edges.map((e, i) => {
        const s = e.source as GraphNode;
        const t = e.target as GraphNode;
        if (typeof s !== "object" || typeof t !== "object") return null;
        let themeColor: string | null = null;
        let bestWeight = -1;
        for (const themeLabel of e.sharedThemes) {
          const cluster = clusterByLabel.get(themeLabel);
          if (cluster && cluster.weight > bestWeight) {
            bestWeight = cluster.weight;
            themeColor = cluster.color;
          }
        }
        const stroke = themeColor ?? baseStroke;
        const width = 0.5 + e.strength * 1.4;
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
            strokeOpacity={opacity * 0.3}
            strokeWidth={width}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
