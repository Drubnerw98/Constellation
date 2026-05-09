import type {
  Avoidance,
  Favorite,
  LibraryItem,
  LibraryItemStatus,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";

export interface ProfileExport {
  profile: TasteProfile;
  library: LibraryItem[];
  recommendations: RecommendationItem[];
  favorites: Favorite[];
  avoidances: Avoidance[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Read at call time (not module load) so tests can stub the env var via
// vi.stubEnv after imports have been hoisted.
function getApiBase(): string {
  return import.meta.env.VITE_RESONANCE_API_URL ?? "";
}

// Constellation maps what you're drawn to. "pending" recs are the AI's
// prediction of fit, generated from your profile — that IS taste signal,
// even before you've engaged. "saved" / "rated" / "plan_to" are positive
// engagement on top of that. We drop "skipped" (active rejection — no
// positive signal) and "seen" (shown without action — neither here nor
// there).
const RENDERABLE_STATUSES = new Set(["pending", "saved", "rated", "plan_to"]);

interface RawLibraryItem {
  id: string;
  title: string;
  mediaType: LibraryItem["mediaType"];
  year: number | null;
  rating: number | null;
  source: "library";
  status: LibraryItemStatus;
  fitNote: string | null;
  tasteTags: string[];
}

interface RawRecommendation {
  id: string;
  title: string;
  mediaType: RecommendationItem["mediaType"];
  year: number | null;
  matchScore: number;
  tasteTags: string[];
  status: string;
  rating: number | null;
  explanation?: string | null;
}

interface RawFavorite {
  title: string;
  mediaType: Favorite["mediaType"];
  themes: string[];
  archetypes: string[];
}

interface RawAvoidance {
  description: string;
  kind: Avoidance["kind"];
}

interface RawProfileExport {
  profile: TasteProfile;
  library: RawLibraryItem[];
  recommendations: RawRecommendation[];
  // Server-side rolled out separately; treat as optional during the brief
  // window where the deployed Resonance version may not yet include them.
  favorites?: RawFavorite[];
  avoidances?: RawAvoidance[];
}

export async function fetchProfileExport(
  token: string,
): Promise<ProfileExport> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new ApiError("VITE_RESONANCE_API_URL is not configured", 0);
  }
  const res = await fetch(`${apiBase}/api/profile/export`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let message = `Resonance API returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // body wasn't JSON; keep the default message
    }
    throw new ApiError(message, res.status);
  }
  const raw = (await res.json()) as RawProfileExport;
  return {
    profile: raw.profile,
    library: raw.library,
    recommendations: raw.recommendations
      .filter((r) => RENDERABLE_STATUSES.has(r.status))
      .map((r) => ({
        ...r,
        status: r.status as RecommendationItem["status"],
        explanation: r.explanation ?? null,
      })),
    favorites: raw.favorites ?? [],
    avoidances: raw.avoidances ?? [],
  };
}
