import type {
  TasteProfile,
  LibraryItem,
  RecommendationItem,
} from "../types/profile";
import type {
  Graph,
  GraphEdge,
  GraphNode,
  ThemeCluster,
} from "../types/graph";
import { colorForThemeIndex } from "./colors";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const MIN_EDGE_STRENGTH = 0.4;
const MAX_EDGES_PER_NODE = 4;

function normalize(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function themesForLibraryTitle(title: string, profile: TasteProfile): string[] {
  const needle = normalize(title);
  return profile.themes
    .filter((t) => normalize(t.evidence).includes(needle))
    .map((t) => t.label);
}

function archetypesForLibraryTitle(
  title: string,
  profile: TasteProfile,
): string[] {
  const needle = normalize(title);
  return profile.archetypes
    .filter((a) => normalize(a.attraction).includes(needle))
    .map((a) => a.label);
}

export function buildGraph(
  profile: TasteProfile,
  library: LibraryItem[],
  recommendations: RecommendationItem[],
): Graph {
  const themeLabels = new Set(profile.themes.map((t) => t.label));
  const archetypeLabels = new Set(profile.archetypes.map((a) => a.label));
  const nodesByTitle = new Map<string, GraphNode>();

  for (const item of library) {
    const tagged = item.tasteTags ?? [];
    const themes = tagged.length
      ? tagged.filter((t) => themeLabels.has(t))
      : themesForLibraryTitle(item.title, profile);
    const archetypes = tagged.length
      ? tagged.filter((t) => archetypeLabels.has(t))
      : archetypesForLibraryTitle(item.title, profile);
    nodesByTitle.set(normalize(item.title), {
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      year: item.year,
      rating: item.rating,
      matchScore: null,
      status: "library",
      themes,
      archetypes,
      source: "library",
    });
  }

  for (const rec of recommendations) {
    const key = normalize(rec.title);
    if (nodesByTitle.has(key)) continue;
    const themes = rec.tasteTags.filter((t) => themeLabels.has(t));
    const archetypes = rec.tasteTags.filter((t) => archetypeLabels.has(t));
    nodesByTitle.set(key, {
      id: rec.id,
      title: rec.title,
      mediaType: rec.mediaType,
      year: rec.year,
      rating: rec.rating,
      matchScore: rec.matchScore,
      status: rec.status,
      themes,
      archetypes,
      source: "recommendation",
    });
  }

  const nodes = Array.from(nodesByTitle.values());

  const candidates: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const sharedThemes = a.themes.filter((t) => b.themes.includes(t));
      const sharedArchetypes = a.archetypes.filter((x) =>
        b.archetypes.includes(x),
      );
      const shared = sharedThemes.length + sharedArchetypes.length;
      if (shared === 0) continue;
      const maxPossible = Math.max(
        a.themes.length + a.archetypes.length,
        b.themes.length + b.archetypes.length,
      );
      const strength = maxPossible === 0 ? 0 : shared / maxPossible;
      if (strength < MIN_EDGE_STRENGTH) continue;
      candidates.push({
        source: a.id,
        target: b.id,
        sharedThemes,
        sharedArchetypes,
        strength,
      });
    }
  }

  // Cap edges per node to the top-K strongest. An edge survives if it falls in
  // either endpoint's top-K — biases the visible graph toward the connections
  // each node "cares about most" while still preserving asymmetric ties.
  const sorted = [...candidates].sort((x, y) => y.strength - x.strength);
  const perNodeCount = new Map<string, number>();
  const edges: GraphEdge[] = [];
  for (const e of sorted) {
    const sId = typeof e.source === "string" ? e.source : e.source.id;
    const tId = typeof e.target === "string" ? e.target : e.target.id;
    const sCount = perNodeCount.get(sId) ?? 0;
    const tCount = perNodeCount.get(tId) ?? 0;
    if (sCount >= MAX_EDGES_PER_NODE && tCount >= MAX_EDGES_PER_NODE) continue;
    perNodeCount.set(sId, sCount + 1);
    perNodeCount.set(tId, tCount + 1);
    edges.push(e);
  }

  const clusters: ThemeCluster[] = profile.themes.map((theme, i) => {
    const angle = (i / profile.themes.length) * Math.PI * 2 - Math.PI / 2;
    const orbitRadius = Math.min(CANVAS_W, CANVAS_H) * 0.32;
    const memberNodeIds = nodes
      .filter((n) => n.themes.includes(theme.label))
      .map((n) => n.id);
    return {
      label: theme.label,
      weight: theme.weight,
      color: colorForThemeIndex(i),
      centerX: CANVAS_W / 2 + Math.cos(angle) * orbitRadius,
      centerY: CANVAS_H / 2 + Math.sin(angle) * orbitRadius,
      radius: 60 + theme.weight * 90,
      memberNodeIds,
    };
  });

  return { nodes, edges, clusters };
}
