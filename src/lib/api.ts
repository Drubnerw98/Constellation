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

// Constellation maps what you're drawn to. "pending" recs are the AI's
// prediction of fit, generated from your profile — that IS taste signal,
// even before you've engaged. "saved" / "rated" / "plan_to" are positive
// engagement on top of that. We drop "skipped" (active rejection — no
// positive signal) and "seen" (shown without action — neither here nor
// there).
const RENDERABLE_STATUSES = new Set(["pending", "saved", "rated", "plan_to"]);

interface RawRecommendation {
  id: string;
  title: string;
  mediaType: RecommendationItem["mediaType"];
  year: number | null;
  matchScore: number;
  tasteTags: string[];
  status: string;
  rating: number | null;
  // Server-side rolled out separately; treat as optional during the brief
  // window where the deployed Resonance version may not yet include it.
  explanation?: string | null;
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
      .map((r) => ({
        ...r,
        status: r.status as RecommendationItem["status"],
        explanation: r.explanation ?? null,
      })),
  };
}
