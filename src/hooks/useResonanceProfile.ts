import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { fetchProfileExport, ApiError, type ProfileExport } from "../lib/api";

export type ProfileStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: ProfileExport }
  | { state: "no-profile" }
  | { state: "error"; message: string };

type FetchResult =
  | { state: "loading" }
  | { state: "ready"; data: ProfileExport }
  | { state: "no-profile" }
  | { state: "error"; message: string };

/**
 * Fetches the signed-in user's TasteProfile + library + recommendations from
 * the Resonance API. Returns "idle" when signed out (caller decides whether
 * to render a landing page or sample fallback). Returns "no-profile" when
 * the user is signed in but hasn't completed Resonance onboarding yet —
 * a friendlier surface than treating it as an error.
 *
 * Auth-derived states ("idle") fall out of render naturally; the effect
 * runs only when there's actual async work to do.
 */
export function useResonanceProfile(): ProfileStatus {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [fetched, setFetched] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    // Synchronous "loading" before kicking off async work is the canonical
    // useEffect data-fetch pattern — the lint rule is overly strict here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetched({ state: "loading" });
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setFetched(null);
          return;
        }
        const data = await fetchProfileExport(token);
        if (!cancelled) setFetched({ state: "ready", data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setFetched({ state: "no-profile" });
            return;
          }
          setFetched({ state: "error", message: err.message });
          return;
        }
        // fetch throws TypeError on network failure / CORS / DNS — the raw
        // message is browser-vendor specific ("NetworkError when attempting
        // to fetch resource." in Firefox, "Failed to fetch" in Chrome).
        // Normalize to one banner-friendly string.
        setFetched({ state: "error", message: "Resonance is unreachable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) return { state: "idle" };
  if (!isSignedIn) return { state: "idle" };
  return fetched ?? { state: "loading" };
}
