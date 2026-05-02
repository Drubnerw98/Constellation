import type {
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";

export interface ProfileExport {
  profile: TasteProfile;
  library: LibraryItem[];
  recommendations: RecommendationItem[];
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

const apiBase = import.meta.env.VITE_RESONANCE_API_URL ?? "";

// Resonance's recommendation enum includes "pending" and "seen" (pre-
// engagement, no signal) and "skipped" (active rejection — also no positive
// signal for a constellation that maps what you're drawn to). Drop all
// three; only the user-affirmed subset is renderable.
const RENDERABLE_STATUSES = new Set([
  "saved",
  "rated",
  "plan_to",
]);

interface RawRecommendation {
  id: string;
  title: string;
  mediaType: RecommendationItem["mediaType"];
  year: number | null;
  matchScore: number;
  tasteTags: string[];
  status: string;
  rating: number | null;
}

export async function fetchProfileExport(
  token: string,
): Promise<ProfileExport> {
  if (!apiBase) {
    throw new ApiError("VITE_RESONANCE_API_URL is not configured", 0);
  }
  const res = await fetch(`${apiBase}/api/profile/export`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
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
  const raw = (await res.json()) as {
    profile: TasteProfile;
    library: LibraryItem[];
    recommendations: RawRecommendation[];
  };
  return {
    profile: raw.profile,
    library: raw.library,
    recommendations: raw.recommendations
      .filter((r) => RENDERABLE_STATUSES.has(r.status))
      .map((r) => ({ ...r, status: r.status as RecommendationItem["status"] })),
  };
}
