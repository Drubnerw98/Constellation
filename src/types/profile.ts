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

export type LibraryItemStatus = "consumed" | "watchlist";

export interface LibraryItem {
  id: string;
  title: string;
  mediaType: MediaType;
  year: number | null;
  rating: number | null;
  source: "library";
  /** "consumed" = user has read/watched/played; "watchlist" = plan-to-consume.
   * Watchlist items skip AI annotation server-side (no experience to ground a
   * fit note in), so they arrive with `fitNote: null` and `tasteTags: []` —
   * the graph builder falls back to title-substring matching against profile
   * evidence to position them. */
  status: LibraryItemStatus;
  /** AI-generated 1-2 sentence rationale for why THIS title fits THIS profile,
   * written specifically for this item. Null for watchlist items and any rows
   * still pending the post-rollout backfill. */
  fitNote: string | null;
  /** Canonical theme/archetype labels from the profile that this item
   * exemplifies. Server-side validated against `profile.themes[].label ∪
   * profile.archetypes[].label`; AI-generated tags that don't match are
   * dropped before the row is written. Empty for watchlist + pre-backfill. */
  tasteTags: string[];
}

/** Derived from `profile.mediaAffinities[].favorites` — the user's explicit
 * "I love this" titles extracted during onboarding. Resonance pre-computes
 * `themes`/`archetypes` by checking which profile evidence/attraction strings
 * mention the title. Has no per-item AI rationale (favorites predate the
 * annotation pipeline). */
export interface Favorite {
  title: string;
  mediaType: MediaType;
  themes: string[];
  archetypes: string[];
}

/** Negative-space layer: things outside the user's taste. `pattern` items are
 * abstract avoidances ("Mary Sue protagonists"); `title` items are specific
 * disliked works ("The Last of Us"). Surfaced for future "anti-stars"
 * rendering — currently shipped through the type chain but not visualized. */
export interface Avoidance {
  description: string;
  kind: "pattern" | "title";
}

export type RecommendationStatus = "pending" | "saved" | "rated" | "plan_to";

export interface RecommendationItem {
  id: string;
  title: string;
  mediaType: MediaType;
  year: number | null;
  matchScore: number;
  tasteTags: string[];
  status: RecommendationStatus;
  rating: number | null;
  /** Per-item AI verdict from Resonance — 1-2 sentences specific to this
   * title, distinct from profile-wide theme.evidence. Always present from
   * the API but typed nullable so older snapshots / sample data don't have
   * to populate it. */
  explanation: string | null;
}
