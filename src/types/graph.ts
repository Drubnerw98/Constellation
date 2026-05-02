import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";

export type MediaType = "movie" | "tv" | "anime" | "manga" | "game" | "book";

export type NodeStatus =
  | "library" // consumed manual library item
  | "watchlist" // plan-to-consume manual library item
  | "favorite" // mediaAffinities.favorites entry, no per-item annotation
  | "pending"
  | "saved"
  | "rated"
  | "plan_to";

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  mediaType: MediaType;
  year: number | null;
  rating: number | null;
  matchScore: number | null;
  status: NodeStatus;
  themes: string[];
  archetypes: string[];
  source: "library" | "recommendation";
  /** Theme label this node is positioned at. Picked via load-balanced greedy
   * across the node's `themes`, so weaker themes still get residents instead
   * of the highest-weight theme absorbing every multi-tag node. Distinct
   * from `themes` (full membership, used for hover highlight + edges). */
  primaryTheme: string | null;
  /** Per-item rationale. For recommendations, this is `r.explanation`; for
   * library items, it's `library.fitNote`. Same UI surface ("Why this fits"
   * in the detail panel) — distinct from profile-wide theme.evidence which
   * cites every supporting title for the theme. Null for favorites (no AI
   * rationale exists) and watchlist items (no engagement to ground one in). */
  explanation: string | null;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  sharedThemes: string[];
  sharedArchetypes: string[];
  strength: number;
}

export interface ThemeCluster {
  label: string;
  weight: number;
  color: string;
  centerX: number;
  centerY: number;
  radius: number;
  memberNodeIds: string[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: ThemeCluster[];
}
