import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as d3 from "d3";
import type { Graph, GraphNode } from "../../types/graph";
import type { Avoidance } from "../../types/profile";
import {
  AntiStars,
  Defs,
  NebulaLayer,
  Starfield,
  StarFlares,
} from "./canvas/BackgroundLayers";
import { ClusterGlows, ClusterLabels } from "./canvas/Clusters";
import { Edges, NodeHalos, Nodes } from "./canvas/Graph";
import { NodeTooltip, ResetButton, SelectedRing } from "./canvas/Overlays";
import {
  CANVAS_H,
  CANVAS_W,
  primaryClusterFor,
  seededStars,
  useAntiStars,
} from "./canvas/helpers";
import {
  useForceSimulation,
  useNodeDrag,
  useStarfieldFadeIn,
  useZoomBehavior,
} from "./canvas/hooks";

interface Props {
  graph: Graph;
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  activeFormats: Set<GraphNode["mediaType"]>;
  /** Fired whenever galaxy-mode focus changes — when the user clicks a
   * cluster label, zooms in past the threshold, or exits galaxy mode.
   * View consumes this to render the cluster info panel. */
  onFocusedClusterChange?: (label: string | null) => void;
  /** When false, only edges connected to the selected node are rendered. */
  showAllConnections?: boolean;
  /** Disliked titles render as anti-stars at the perimeter. Patterns aren't
   * surfaced visually. */
  avoidances?: Avoidance[];
}

export interface ConstellationCanvasHandle {
  panToNode: (id: string) => void;
  /** Exit galaxy mode + restore the pre-focus zoom snapshot if one exists,
   * else reset to identity. */
  clearClusterFocus: () => void;
}

/**
 * Canvas orchestrator — owns the DOM ref, transient view state, and the
 * lifecycle wiring between hooks (simulation, drag, zoom, fade-in) and
 * layer subcomponents (background, clusters, graph, overlays). Pure
 * helpers live in `./canvas/helpers`; D3 lifecycle in `./canvas/hooks`;
 * each render layer in its own file under `./canvas/`.
 */
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
    // Snapshot of the user's transform right before they entered galaxy
    // mode. Restored on exit so resetting from a cluster returns to where
    // they were exploring, not all the way back to identity.
    const preFocusTransformRef = useRef<d3.ZoomTransform | null>(null);

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

    const prefersReducedMotion = useMemo(() => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);

    // Background data (static for the lifetime of the component).
    const stars = useMemo(() => seededStars(800, 320, 80), []);
    const flareStars = useMemo(
      () =>
        stars
          .filter((s) => s.r > 1.8 && s.o > 0.7)
          .sort((a, b) => b.r - a.r)
          .slice(0, 8),
      [stars],
    );
    const antiStars = useAntiStars(avoidances);

    // Graph-derived lookup maps.
    const clusterByLabel = useMemo(
      () => new Map(graph.clusters.map((c) => [c.label, c])),
      [graph.clusters],
    );
    const nodeById = useMemo(
      () => new Map(graph.nodes.map((n) => [n.id, n])),
      [graph.nodes],
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

    // D3 lifecycle hooks.
    const { starfieldLit, loadedNodeIds } = useStarfieldFadeIn(
      graph,
      prefersReducedMotion,
    );
    const { simRef } = useForceSimulation(
      graph,
      clusterByLabel,
      prefersReducedMotion,
    );
    useNodeDrag(svgRef, simRef, graph, prefersReducedMotion);
    const { zoomBehaviorRef } = useZoomBehavior(svgRef, setTransform);

    // Mirror focused cluster state up to the parent so it can render the
    // cluster info panel.
    useEffect(() => {
      onFocusedClusterChange?.(focusedClusterLabel);
    }, [focusedClusterLabel, onFocusedClusterChange]);

    const { nodes, edges, clusters } = graph;
    // Hover wins over selection for visual highlights — lets the user
    // preview other nodes' connections while the detail panel still shows
    // the pinned one.
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
    const inFocusedCluster = (id: string): boolean => {
      if (!focusedClusterLabel) return true;
      const node = nodeById.get(id);
      return node?.themes.includes(focusedClusterLabel) ?? false;
    };
    const inHoveredCluster = (id: string): boolean => {
      if (!hoveredClusterLabel) return false;
      const node = nodeById.get(id);
      return node?.themes.includes(hoveredClusterLabel) ?? false;
    };
    const matchesFormat = (id: string): boolean => {
      const node = nodeById.get(id);
      return node ? activeFormats.has(node.mediaType) : true;
    };

    const isZoomed =
      transform.k !== 1 || transform.x !== 0 || transform.y !== 0;
    const inGalaxyMode = focusedClusterLabel !== null;

    // Hover handlers guard against the "leave fires after enter on a
    // different node" race — only clear if we're still the current hover.
    const handleNodeEnter = useCallback(
      (id: string) => setHoveredNodeId(id),
      [],
    );
    const handleNodeLeave = useCallback(
      (id: string) =>
        setHoveredNodeId((cur) => (cur === id ? null : cur)),
      [],
    );
    const handleClusterEnter = useCallback(
      (label: string) => setHoveredClusterLabel(label),
      [],
    );
    const handleClusterLeave = useCallback(
      (label: string) =>
        setHoveredClusterLabel((cur) => (cur === label ? null : cur)),
      [],
    );

    const handleNodeClick = useCallback(
      (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(selectedNodeId === id ? null : id);
      },
      [onSelect, selectedNodeId],
    );
    const handleBackgroundClick = useCallback(() => onSelect(null), [onSelect]);

    const resetView = useCallback(() => {
      const svg = svgRef.current;
      const zoom = zoomBehaviorRef.current;
      if (!svg || !zoom) return;
      const target = preFocusTransformRef.current ?? d3.zoomIdentity;
      preFocusTransformRef.current = null;
      setFocusedClusterLabel(null);
      d3.select(svg).transition().duration(700).call(zoom.transform, target);
    }, [zoomBehaviorRef]);

    const flyToCluster = useCallback(
      (label: string) => {
        const svg = svgRef.current;
        const zoom = zoomBehaviorRef.current;
        const target = clusters.find((c) => c.label === label);
        if (!svg || !zoom || !target) return;
        if (focusedClusterLabel === label) {
          resetView();
          return;
        }
        if (focusedClusterLabel === null) {
          preFocusTransformRef.current = d3.zoomTransform(svg);
        }
        const k = Math.min(CANVAS_W, CANVAS_H) / (target.radius * 4.2);
        const tx = CANVAS_W / 2 - target.centerX * k;
        const ty = CANVAS_H / 2 - target.centerY * k;
        const next = d3.zoomIdentity.translate(tx, ty).scale(k);
        setFocusedClusterLabel(label);
        d3.select(svg)
          .transition()
          .duration(800)
          .call(zoom.transform, next);
      },
      [clusters, focusedClusterLabel, resetView, zoomBehaviorRef],
    );

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
      [graph, resetView, zoomBehaviorRef],
    );

    const nodeLayerProps = {
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
          <Defs clusters={clusters} />

          <g className="zoom-layer" transform={transform.toString()}>
            <NebulaLayer
              starfieldLit={starfieldLit}
              prefersReducedMotion={prefersReducedMotion}
            />
            <StarFlares
              flareStars={flareStars}
              starfieldLit={starfieldLit}
              prefersReducedMotion={prefersReducedMotion}
            />
            <Starfield
              stars={stars}
              starfieldLit={starfieldLit}
              prefersReducedMotion={prefersReducedMotion}
            />
            <AntiStars
              antiStars={antiStars}
              starfieldLit={starfieldLit}
              inGalaxyMode={inGalaxyMode}
              prefersReducedMotion={prefersReducedMotion}
            />
            <ClusterGlows
              clusters={clusters}
              focusedClusterLabel={focusedClusterLabel}
              hoveredClusterLabel={hoveredClusterLabel}
              inGalaxyMode={inGalaxyMode}
              prefersReducedMotion={prefersReducedMotion}
              onFocusCluster={flyToCluster}
              onClusterEnter={handleClusterEnter}
              onClusterLeave={handleClusterLeave}
            />
            <Edges
              edges={edges}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              hoveredClusterLabel={hoveredClusterLabel}
              showAllConnections={showAllConnections}
              inGalaxyMode={inGalaxyMode}
              clusterByLabel={clusterByLabel}
              isEdgeActive={isEdgeActive}
              isEdgeDimmed={isEdgeDimmed}
              inFocusedCluster={inFocusedCluster}
              inHoveredCluster={inHoveredCluster}
              matchesFormat={matchesFormat}
              prefersReducedMotion={prefersReducedMotion}
            />
            <ClusterLabels
              clusters={clusters}
              focusedClusterLabel={focusedClusterLabel}
              hoveredClusterLabel={hoveredClusterLabel}
              inGalaxyMode={inGalaxyMode}
              prefersReducedMotion={prefersReducedMotion}
              onFocusCluster={flyToCluster}
              onClusterEnter={handleClusterEnter}
              onClusterLeave={handleClusterLeave}
            />
            <NodeHalos {...nodeLayerProps} />
            <Nodes
              {...nodeLayerProps}
              onNodeEnter={handleNodeEnter}
              onNodeLeave={handleNodeLeave}
              onNodeClick={handleNodeClick}
            />
          </g>

          <SelectedRing
            node={selectedNode}
            transform={transform}
            color={
              selectedNode
                ? (nodeColor.get(selectedNode.id) ?? "#fefce8")
                : "#fefce8"
            }
          />
          <NodeTooltip node={hoveredNode} transform={transform} />
        </svg>

        <ResetButton
          visible={isZoomed || inGalaxyMode}
          inGalaxyMode={inGalaxyMode}
          onReset={resetView}
        />
      </div>
    );
  },
);
