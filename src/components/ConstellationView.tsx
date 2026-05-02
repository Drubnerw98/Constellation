import { useCallback, useMemo, useRef, useState } from "react";
import {
  ConstellationCanvas,
  type ConstellationCanvasHandle,
} from "./constellation/ConstellationCanvas";
import { DetailPanel } from "./constellation/DetailPanel";
import { FilterBar } from "./controls/FilterBar";
import { SearchInput } from "./controls/SearchInput";
import { buildGraph } from "../lib/graph";
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
  const graph = useMemo(
    () => buildGraph(profile, library, recommendations, favorites),
    [profile, library, recommendations, favorites],
  );

  const canvasRef = useRef<ConstellationCanvasHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<MediaType>>(
    () => new Set(ALL_FORMATS),
  );

  const selectedNode = selectedNodeId
    ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

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
    canvasRef.current?.panToNode(id);
  }, []);

  return (
    <>
      <ConstellationCanvas
        ref={canvasRef}
        graph={graph}
        selectedNodeId={selectedNodeId}
        onSelect={setSelectedNodeId}
        activeFormats={activeFormats}
      />
      <SearchInput graph={graph} onPick={handleSearchPick} />
      <FilterBar
        activeFormats={activeFormats}
        onToggle={toggleFormat}
        onReset={resetFormats}
      />
      <DetailPanel
        node={selectedNode}
        graph={graph}
        onClose={() => setSelectedNodeId(null)}
        onSelectConnected={setSelectedNodeId}
      />
    </>
  );
}
