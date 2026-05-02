import { useCallback, useMemo, useRef, useState } from "react";
import {
  ConstellationCanvas,
  type ConstellationCanvasHandle,
} from "./constellation/ConstellationCanvas";
import { ClusterPanel } from "./constellation/ClusterPanel";
import { DetailPanel } from "./constellation/DetailPanel";
import { FilterBar } from "./controls/FilterBar";
import { SearchInput } from "./controls/SearchInput";
import { buildGraph, type ClusterScaleMode } from "../lib/graph";
import type { MediaType } from "../types/graph";
import type {
  Favorite,
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";

const ALL_FORMATS: MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "game",
  "book",
];

interface Props {
  profile: TasteProfile;
  library: LibraryItem[];
  recommendations: RecommendationItem[];
  favorites: Favorite[];
}

/**
 * Owns the constellation rendering surface — canvas, detail panel, search,
 * filter — and the per-view state (selection, format toggles). Routes wrap
 * this with their own corner UI (auth pill, banners, demo indicator).
 */
export function ConstellationView({
  profile,
  library,
  recommendations,
  favorites,
}: Props) {
  const [clusterScaleMode, setClusterScaleMode] =
    useState<ClusterScaleMode>("weight");
  // Default to "selected" — declutter mode. The full edge mesh is visually
  // busy at this node count; one-title-at-a-time is the better default for
  // exploring a constellation.
  const [showAllConnections, setShowAllConnections] = useState(false);

  const graph = useMemo(
    () =>
      buildGraph(
        profile,
        library,
        recommendations,
        favorites,
        clusterScaleMode,
      ),
    [profile, library, recommendations, favorites, clusterScaleMode],
  );

  const canvasRef = useRef<ConstellationCanvasHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Panel visibility is decoupled from node selection so closing the panel
  // doesn't deselect the node — keeps connection lines visible after
  // dismissing the panel (so the user can navigate via the canvas).
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<MediaType>>(
    () => new Set(ALL_FORMATS),
  );
  const [focusedClusterLabel, setFocusedClusterLabel] = useState<string | null>(
    null,
  );

  const selectedNode = selectedNodeId
    ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;
  const focusedCluster = focusedClusterLabel
    ? (graph.clusters.find((c) => c.label === focusedClusterLabel) ?? null)
    : null;

  // Tap-to-toggle: tapping a different node selects + opens panel; tapping
  // the same already-selected node toggles the panel; tapping null
  // (background) clears both.
  const handleSelect = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedNodeId(null);
        setDetailPanelOpen(false);
        return;
      }
      if (id === selectedNodeId) {
        setDetailPanelOpen((cur) => !cur);
        return;
      }
      setSelectedNodeId(id);
      setDetailPanelOpen(true);
    },
    [selectedNodeId],
  );

  const toggleFormat = useCallback((format: MediaType) => {
    setActiveFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }, []);

  const resetFormats = useCallback(() => {
    setActiveFormats(new Set(ALL_FORMATS));
  }, []);

  const handleSearchPick = useCallback((id: string) => {
    setSelectedNodeId(id);
    setDetailPanelOpen(true);
    canvasRef.current?.panToNode(id);
  }, []);

  return (
    <>
      <ConstellationCanvas
        ref={canvasRef}
        graph={graph}
        selectedNodeId={selectedNodeId}
        onSelect={handleSelect}
        activeFormats={activeFormats}
        onFocusedClusterChange={setFocusedClusterLabel}
        showAllConnections={showAllConnections}
      />
      <SearchInput graph={graph} onPick={handleSearchPick} />
      <FilterBar
        activeFormats={activeFormats}
        onToggle={toggleFormat}
        onReset={resetFormats}
        clusterScaleMode={clusterScaleMode}
        onClusterScaleModeChange={setClusterScaleMode}
        showAllConnections={showAllConnections}
        onShowAllConnectionsChange={setShowAllConnections}
      />
      <ClusterPanel
        cluster={focusedCluster}
        profile={profile}
        onClose={() => canvasRef.current?.clearClusterFocus()}
      />
      <DetailPanel
        node={selectedNode}
        isOpen={detailPanelOpen && selectedNode !== null}
        graph={graph}
        // Closing the panel does NOT deselect the node — keeps connection
        // lines visible so the user can follow them on the canvas. To
        // fully clear, click the canvas background or pick a different
        // node and toggle.
        onClose={() => setDetailPanelOpen(false)}
        onSelectConnected={(id) => {
          setSelectedNodeId(id);
          setDetailPanelOpen(true);
        }}
      />
    </>
  );
}
