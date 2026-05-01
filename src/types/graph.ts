import type { SimulationNodeDatum, SimulationLinkDatum } from "d3";

export type MediaType = "movie" | "tv" | "anime" | "manga" | "game" | "book";

export type NodeStatus = "library" | "saved" | "skipped" | "rated" | "plan_to";

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
