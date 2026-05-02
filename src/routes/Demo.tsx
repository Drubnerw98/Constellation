import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/clerk-react";
import { ConstellationView } from "../components/ConstellationView";
import {
  sampleProfile,
  sampleLibrary,
  sampleRecommendations,
} from "../data/sampleProfile";
import { deriveFavorites } from "../lib/graph";

/**
 * Stable demo URL backed by the curated sample profile. Always available,
 * regardless of auth state — this is the link to share with portfolio
 * viewers and the "View demo" CTA on the landing page.
 */
export function Demo() {
  // Derive favorites client-side for the demo path — Resonance's server-side
  // derivation isn't available without a network round-trip, but the same
  // titleAppearsIn logic produces identical output from the sample profile.
  const sampleFavorites = useMemo(
    () => deriveFavorites(sampleProfile),
    [],
  );
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <ConstellationView
        profile={sampleProfile}
        library={sampleLibrary}
        recommendations={sampleRecommendations}
        favorites={sampleFavorites}
      />
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-2">
        <Link
          to="/"
          className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 px-4 py-1.5 text-xs text-zinc-200 backdrop-blur-md transition-colors hover:bg-white/10"
        >
          ← Home
        </Link>
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 px-4 py-1.5 text-xs text-zinc-200 backdrop-blur-md transition-colors hover:bg-white/10"
            >
              Sign in to see yours
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 p-1 backdrop-blur-md">
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "h-7 w-7" },
              }}
            />
          </div>
        </SignedIn>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <div className="rounded-full border border-white/10 bg-[#0b0f1a]/85 px-4 py-1.5 text-[11px] text-zinc-400 backdrop-blur-md">
          Demo constellation — a fictional taste profile
        </div>
      </div>
    </div>
  );
}
