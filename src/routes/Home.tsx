import { useMemo } from "react";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { ConstellationView } from "../components/ConstellationView";
import { SiteFooter } from "../components/SiteFooter";
import { SiteMark } from "../components/SiteMark";
import {
  sampleProfile,
  sampleLibrary,
  sampleRecommendations,
} from "../data/sampleProfile";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import { deriveAvoidances, deriveFavorites } from "../lib/graph";
import type {
  Avoidance,
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
  avoidances: Avoidance[];
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
      avoidances: deriveAvoidances(sampleProfile),
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
          avoidances: profileStatus.data.avoidances,
          bannerMessage: null,
        };
      }
      case "no-profile":
        return {
          ...sampleFallback,
          bannerMessage:
            "No Resonance profile yet. Showing the sample. Finish onboarding in Resonance to see yours.",
        };
      case "error":
        return {
          ...sampleFallback,
          bannerMessage: `Couldn't load your profile (${profileStatus.message}). Showing the sample.`,
        };
      case "loading":
      case "idle":
        return {
          ...sampleFallback,
          bannerMessage: null,
        };
      default: {
        const _exhaustive: never = profileStatus;
        return _exhaustive;
      }
    }
  }, [profileStatus]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <ConstellationView
        profile={data.profile}
        library={data.library}
        recommendations={data.recommendations}
        favorites={data.favorites}
        avoidances={data.avoidances}
      />
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-3">
        <SiteMark />
        {/* /diff lives behind the same auth gate as /. Surfaced as a quiet
            mono caption — the diff is a stretch feature, not the main
            attraction. */}
        <Link
          to="/diff"
          className="pointer-events-auto hidden font-mono text-[10px] tracking-[0.22em] text-zinc-500 uppercase transition-colors hover:text-zinc-200 md:inline-flex"
        >
          Compare versions →
        </Link>
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
      {profileStatus.state === "loading" && <LoadingOverlay />}
      <SiteFooter />
    </div>
  );
}

/**
 * Cosmic loading state. Sits centered over the canvas while the user's
 * profile is fetched. Replaces the bare "Loading your constellation…"
 * pill with the SiteMark asterism + a tracked-caps caption underneath.
 * The asterism is already the brand glyph; pulsing it slowly here makes
 * the loading state read as a deliberate cosmic moment, not generic
 * "spinner over content."
 */
function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="loading-pulse text-zinc-300">
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" aria-hidden>
            <line x1="4" y1="22" x2="10" y2="9" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />
            <line x1="10" y1="9" x2="16" y2="18" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />
            <line x1="16" y1="18" x2="22" y2="8" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />
            <line x1="22" y1="8" x2="28" y2="21" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.45" />
            <circle cx="4" cy="22" r="1.4" fill="currentColor" />
            <circle cx="10" cy="9" r="2.1" fill="currentColor" />
            <circle cx="16" cy="18" r="2.8" fill="currentColor" />
            <circle cx="22" cy="8" r="2.1" fill="currentColor" />
            <circle cx="28" cy="21" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <p className="font-['IBM_Plex_Mono'] text-[10px] tracking-[0.28em] text-zinc-500 uppercase">
          Charting your constellation
        </p>
      </div>
    </div>
  );
}
