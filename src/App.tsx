import { ConstellationCanvas } from "./components/constellation/ConstellationCanvas";
import { sampleProfile, sampleLibrary, sampleRecommendations } from "./data/sampleProfile";
import { buildGraph } from "./lib/graph";

export function App() {
  const graph = buildGraph(sampleProfile, sampleLibrary, sampleRecommendations);

  return (
    <div className="h-screen w-screen bg-[#05060a] text-white overflow-hidden">
      <ConstellationCanvas graph={graph} />
    </div>
  );
}
