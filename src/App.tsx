import { useCallback, useMemo, useRef, useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
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
import { useResonanceProfile } from "./hooks/useResonanceProfile";
import type { MediaType } from "./types/graph";
import type {
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "./types/profile";

const ALL_FORMATS: MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "game",
  "book",
];

interface ConstellationData {
  profile: TasteProfile;
  library: LibraryItem[];
  recommendations: RecommendationItem[];
  isSample: boolean;
  bannerMessage: string | null;
}

export function App() {
  const profileStatus = useResonanceProfile();

  const data = useMemo<ConstellationData>(() => {
    switch (profileStatus.state) {
      case "ready":
        return {
          profile: profileStatus.data.profile,
          library: profileStatus.data.library,
          recommendations: profileStatus.data.recommendations,
          isSample: false,
          bannerMessage: null,
        };
      case "no-profile":
        return {
          profile: sampleProfile,
          library: sampleLibrary,
          recommendations: sampleRecommendations,
          isSample: true,
          bannerMessage:
            "No Resonance profile yet — showing the sample constellation. Finish onboarding in Resonance to see yours.",
        };
      case "error":
        return {
          profile: sampleProfile,
          library: sampleLibrary,
          recommendations: sampleRecommendations,
          isSample: true,
          bannerMessage: `Couldn't load your profile (${profileStatus.message}). Showing the sample.`,
        };
      case "loading":
      case "idle":
      default:
        return {
          profile: sampleProfile,
          library: sampleLibrary,
          recommendations: sampleRecommendations,
          isSample: true,
          bannerMessage: null,
        };
    }
  }, [profileStatus]);

  const graph = useMemo(
    () => buildGraph(data.profile, data.library, data.recommendations),
    [data.profile, data.library, data.recommendations],
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
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2">
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 px-4 py-1.5 text-xs text-zinc-200 backdrop-blur-md transition-colors hover:bg-white/10"
            >
              Sign in to see your constellation
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 p-1 backdrop-blur-md">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-7 w-7",
                },
              }}
            />
          </div>
        </SignedIn>
      </div>
      {data.bannerMessage && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto rounded-full border border-amber-200/15 bg-[#0b0f1a]/90 px-4 py-1.5 text-[11px] text-amber-100/85 backdrop-blur-md">
            {data.bannerMessage}
          </div>
        </div>
      )}
      {profileStatus.state === "loading" && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-full border border-white/10 bg-[#0b0f1a]/90 px-4 py-1.5 text-[11px] text-zinc-300 backdrop-blur-md">
            Loading your constellation…
          </div>
        </div>
      )}
      <DetailPanel
        node={selectedNode}
        graph={graph}
        profile={data.profile}
        onClose={() => setSelectedNodeId(null)}
        onSelectConnected={setSelectedNodeId}
      />
    </div>
  );
}
