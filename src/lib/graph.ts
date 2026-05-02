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
  return title
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

// Minimum length on the shorter side of a substring match. Stops trivial
// matches like tag "a" inside theme label "abandonment" — the AI sometimes
// emits very short tags and we'd otherwise cluster everything under one
// theme.
const FUZZY_MIN_LEN = 4;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "as", "is", "in", "on", "to",
  "for", "with", "without", "into", "through", "from", "by", "at",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "their", "its", "his", "her", "they", "them", "this", "that", "these",
  "those", "it", "we", "you", "he", "she",
  "who", "whom", "what", "which", "where", "when", "why", "how",
  "own", "not", "no", "yes",
]);

function contentTokens(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Reconcile an AI-generated tag against a set of canonical labels.
 *
 * The AI is *instructed* to emit theme/archetype labels verbatim, but in
 * practice it paraphrases or shortens ("sacrifice" for "earned sacrifice
 * through sustained commitment"). Three tiers of matching:
 *
 *   1. Exact normalized match — the happy path.
 *   2. Full-string substring (4+ chars on shorter side) — catches concise
 *      forms of long labels.
 *   3. Content-word overlap with bidirectional within-token substring —
 *      catches single-word tags ("burden") against multi-word labels
 *      ("burden-carrying protagonist...") and morphology drift ("noble"
 *      vs. "nobility").
 *
 * Returns the canonical label string when matched, so downstream code
 * (cluster member lookups, edge sharing) compares against canonical labels.
 */
function matchLabel(tag: string, labels: Set<string>): string | null {
  const norm = normalize(tag);
  if (!norm) return null;

  for (const label of labels) {
    if (norm === normalize(label)) return label;
  }
  for (const label of labels) {
    const labelNorm = normalize(label);
    const shorter = Math.min(norm.length, labelNorm.length);
    if (shorter < FUZZY_MIN_LEN) continue;
    if (labelNorm.includes(norm) || norm.includes(labelNorm)) return label;
  }

  const tagTokens = contentTokens(norm);
  if (tagTokens.length === 0) return null;
  let bestLabel: string | null = null;
  let bestScore = 0;
  for (const label of labels) {
    const labelTokens = contentTokens(normalize(label));
    let score = 0;
    for (const tt of tagTokens) {
      for (const lt of labelTokens) {
        if (
          tt === lt ||
          (tt.length >= 4 && lt.includes(tt)) ||
          (lt.length >= 4 && tt.includes(lt))
        ) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }
  return bestScore > 0 ? bestLabel : null;
}

function matchLabelsFromTags(tags: string[], labels: Set<string>): string[] {
  const matched = new Set<string>();
  for (const tag of tags) {
    const m = matchLabel(tag, labels);
    if (m) matched.add(m);
  }
  return Array.from(matched);
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
      ? matchLabelsFromTags(tagged, themeLabels)
      : themesForLibraryTitle(item.title, profile);
    const archetypes = tagged.length
      ? matchLabelsFromTags(tagged, archetypeLabels)
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
    const themes = matchLabelsFromTags(rec.tasteTags, themeLabels);
    const archetypes = matchLabelsFromTags(rec.tasteTags, archetypeLabels);
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

  // Drop nodes with no theme AND no archetype anchor. An unanchored node
  // has nothing pulling it toward a cluster center, so it falls to (and
  // piles up at) the canvas-center fallback in the simulation. Visually
  // it's noise — a star with no narrative connection to the constellation.
  const nodes = Array.from(nodesByTitle.values()).filter(
    (n) => n.themes.length > 0 || n.archetypes.length > 0,
  );

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
