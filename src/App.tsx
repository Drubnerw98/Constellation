import { useMemo, useState } from "react";
import { ConstellationCanvas } from "./components/constellation/ConstellationCanvas";
import { DetailPanel } from "./components/constellation/DetailPanel";
import {
  sampleProfile,
  sampleLibrary,
  sampleRecommendations,
} from "./data/sampleProfile";
import { buildGraph } from "./lib/graph";

export function App() {
  const graph = useMemo(
    () => buildGraph(sampleProfile, sampleLibrary, sampleRecommendations),
    [],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId
    ? (graph.nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <ConstellationCanvas
        graph={graph}
        selectedNodeId={selectedNodeId}
        onSelect={setSelectedNodeId}
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
