import { useCallback, useMemo, useState } from "react";
import { ConstellationCanvas } from "./components/constellation/ConstellationCanvas";
import { DetailPanel } from "./components/constellation/DetailPanel";
import { FilterBar } from "./components/controls/FilterBar";
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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <ConstellationCanvas
        graph={graph}
        selectedNodeId={selectedNodeId}
        onSelect={setSelectedNodeId}
        activeFormats={activeFormats}
      />
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
