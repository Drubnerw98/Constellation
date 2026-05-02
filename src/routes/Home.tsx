import { useMemo } from "react";
import { UserButton } from "@clerk/clerk-react";
import { ConstellationView } from "../components/ConstellationView";
import { SiteMark } from "../components/SiteMark";
import {
  sampleProfile,
  sampleLibrary,
  sampleRecommendations,
} from "../data/sampleProfile";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import { deriveFavorites } from "../lib/graph";
import type {
  Favorite,
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";

interface ResolvedData {
  profile: TasteProfile;
  library: LibraryItem[];
  recommendations: RecommendationItem[];
  favorites: Favorite[];
  bannerMessage: string | null;
}

/**
 * Signed-in landing — fetches the user's Resonance profile and renders the
 * real constellation. Falls back to the sample data with an amber banner
 * for "no profile yet" or transient API failures so the surface never goes
 * blank.
 */
export function Home() {
  const profileStatus = useResonanceProfile();

  const data = useMemo<ResolvedData>(() => {
    const sampleFallback = {
      profile: sampleProfile,
      library: sampleLibrary,
      recommendations: sampleRecommendations,
      favorites: deriveFavorites(sampleProfile),
    };
    switch (profileStatus.state) {
      case "ready": {
        // Cap volume — the simulation + visual density are tuned for tens
        // of nodes, not the hundreds a long-time Resonance user has. Pick
        // the highest-signal subset: library by rating desc (loved most),
        // recommendations by matchScore desc (best fit). The visualization
        // intent is "what you're drawn to", not "everything you logged".
        // Favorites pass through uncapped — typical user has ~25-30 and
        // they dedupe heavily against library/recs in the graph builder.
        const LIBRARY_CAP = 40;
        const RECS_CAP = 25;
        const library = [...profileStatus.data.library]
          .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
          .slice(0, LIBRARY_CAP);
        const recommendations = [...profileStatus.data.recommendations]
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, RECS_CAP);
        return {
          profile: profileStatus.data.profile,
          library,
          recommendations,
          favorites: profileStatus.data.favorites,
          bannerMessage: null,
        };
      }
      case "no-profile":
        return {
          ...sampleFallback,
          bannerMessage:
            "No Resonance profile yet — showing the sample. Finish onboarding in Resonance to see yours.",
        };
      case "error":
        return {
          ...sampleFallback,
          bannerMessage: `Couldn't load your profile (${profileStatus.message}). Showing the sample.`,
        };
      case "loading":
      case "idle":
      default:
        return {
          ...sampleFallback,
          bannerMessage: null,
        };
    }
  }, [profileStatus]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <ConstellationView
        profile={data.profile}
        library={data.library}
        recommendations={data.recommendations}
        favorites={data.favorites}
      />
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-3">
        <SiteMark />
        <div className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 p-1 backdrop-blur-md">
          <UserButton
            appearance={{
              elements: { userButtonAvatarBox: "h-7 w-7" },
            }}
          />
        </div>
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
    </div>
  );
}
