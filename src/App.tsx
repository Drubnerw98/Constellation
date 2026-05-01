import { useCallback, useMemo, useRef, useState } from "react";
import {
  ConstellationCanvas,
  type ConstellationCanvasHandle,
} from "./components/constellation/ConstellationCanvas";
import { DetailPanel } from "./components/constellation/DetailPanel";
import { FilterBar } from "./components/controls/FilterBar";
import { SearchInput } from "./components/controls/SearchInput";
import {
  sampleProfile,
  sampleLibrary,
  sampleRecommendations,
} from "./data/sampleProfile";
import { buildGraph } from "./lib/graph";
import type { MediaType } from "./types/graph";

const ALL_FORMATS: MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "game",
  "book",
];

export function App() {
  const graph = useMemo(
    () => buildGraph(sampleProfile, sampleLibrary, sampleRecommendations),
    [],
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
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
        profile={sampleProfile}
        onClose={() => setSelectedNodeId(null)}
        onSelectConnected={setSelectedNodeId}
      />
    </div>
  );
}
