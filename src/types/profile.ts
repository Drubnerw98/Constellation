import type { MediaType } from "./graph";

export type Pacing = "slow-burn" | "propulsive" | "variable";
export type Complexity = "layered" | "focused" | "epic";

export interface TasteTheme {
  label: string;
  weight: number;
  evidence: string;
}

export interface TasteArchetype {
  label: string;
  attraction: string;
}

export interface NarrativePreferences {
  pacing: Pacing;
  complexity: Complexity;
  tone: string[];
  endings: string;
}

export interface MediaAffinity {
  format: MediaType;
  comfort: number;
  favorites: string[];
}

export interface TasteProfile {
  themes: TasteTheme[];
  archetypes: TasteArchetype[];
  narrativePrefs: NarrativePreferences;
  mediaAffinities: MediaAffinity[];
  avoidances: string[];
  dislikedTitles?: string[];
}

export interface LibraryItem {
  id: string;
  title: string;
  mediaType: MediaType;
  year: number | null;
  rating: number | null;
  source: "library";
  /** Optional explicit theme/archetype tags. When present, used directly to
   * place the title in clusters. When absent, the graph builder falls back to
   * scanning theme `evidence` strings for the title. The Resonance API will
   * eventually return these per-item; until then, we set them by hand on the
   * sample profile so every library title clusters correctly. */
  tasteTags?: string[];
}

export type RecommendationStatus =
  | "pending"
  | "saved"
  | "rated"
  | "plan_to";

export interface RecommendationItem {
  id: string;
  title: string;
  mediaType: MediaType;
  year: number | null;
  matchScore: number;
  tasteTags: string[];
  status: RecommendationStatus;
  rating: number | null;
}
