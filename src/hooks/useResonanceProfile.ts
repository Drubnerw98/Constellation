import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { fetchProfileExport, ApiError, type ProfileExport } from "../lib/api";

export type ProfileStatus =
  | { state: "idle" }
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
 */
export function useResonanceProfile(): ProfileStatus {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [status, setStatus] = useState<ProfileStatus>({ state: "idle" });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus({ state: "idle" });
      return;
    }

    let cancelled = false;
    setStatus({ state: "loading" });
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setStatus({ state: "idle" });
          return;
        }
        const data = await fetchProfileExport(token);
        if (!cancelled) setStatus({ state: "ready", data });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setStatus({ state: "no-profile" });
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unable to reach Resonance";
        setStatus({ state: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  return status;
}
