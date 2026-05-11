import * as d3 from "d3";
import type {
  Avoidance,
  Favorite,
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";
import type { Graph, GraphEdge, GraphNode, ThemeCluster } from "../types/graph";
import { colorForThemeIndex } from "./colors";


const CANVAS_W = 1200;
const CANVAS_H = 800;
const MIN_EDGE_STRENGTH = 0.4;
// Tightened from 4 to 3 after min-normalization made many strength-1.0
// connections survive (single-tag favorites connecting to multiple
// well-tagged partners). At 4 the canvas read as a yarn-ball web; at 3
// the strongest connections still come through but the page reads as
// a constellation rather than a network diagram.
const MAX_EDGES_PER_NODE = 3;

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
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "as",
  "is",
  "in",
  "on",
  "to",
  "for",
  "with",
  "without",
  "into",
  "through",
  "from",
  "by",
  "at",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "their",
  "its",
  "his",
  "her",
  "they",
  "them",
  "this",
  "that",
  "these",
  "those",
  "it",
  "we",
  "you",
  "he",
  "she",
  "who",
  "whom",
  "what",
  "which",
  "where",
  "when",
  "why",
  "how",
  "own",
  "not",
  "no",
  "yes",
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
export function matchLabel(tag: string, labels: Set<string>): string | null {
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

/**
 * Match a library title against a piece of evidence/attraction text.
 *
 * AI-generated profile evidence references titles by their familiar short
 * form ("Jesse James", "First Law") rather than their canonical library
 * form ("The Assassination of Jesse James by the Coward Robert Ford",
 * "First Law Trilogy Boxed Set..."). Direct substring fails on long titles.
 *
 * Two-step: try the full normalized substring; if that misses and the title
 * has 2+ content tokens, accept a 2+ content-token overlap as a match.
 * The 2-token threshold prevents single common words like "the" or "story"
 * from triggering false matches.
 */
export function titleAppearsIn(title: string, text: string): boolean {
  const titleNorm = normalize(title);
  const textNorm = normalize(text);
  if (textNorm.includes(titleNorm)) return true;

  const titleTokens = contentTokens(titleNorm);
  if (titleTokens.length < 2) return false;
  const textTokens = new Set(contentTokens(textNorm));
  let overlap = 0;
  for (const tt of titleTokens) {
    if (textTokens.has(tt)) overlap++;
    if (overlap >= 2) return true;
  }
  return false;
}

/** Combine a theme's display + structured fields into one searchable string.
 * Post-2026-05-10 themes carry anchors/reinforcedBy as data; older ones
 * only have free-text evidence. Joining both shapes lets `titleAppearsIn`
 * stay shape-agnostic. */
function themeHaystack(theme: TasteProfile["themes"][number]): string {
  const refs = [...(theme.anchors ?? []), ...(theme.reinforcedBy ?? [])]
    .map((r) => r.title)
    .join(" · ");
  return [theme.summary ?? "", theme.evidence ?? "", refs]
    .filter((s) => s.length > 0)
    .join(" · ");
}

function themesForLibraryTitle(title: string, profile: TasteProfile): string[] {
  return profile.themes
    .filter((t) => titleAppearsIn(title, themeHaystack(t)))
    .map((t) => t.label);
}

function archetypesForLibraryTitle(
  title: string,
  profile: TasteProfile,
): string[] {
  return profile.archetypes
    .filter((a) => titleAppearsIn(title, a.attraction))
    .map((a) => a.label);
}

/**
 * True if `key` collides with an already-inserted node title — either via
 * exact normalized match, or via substring containment with a 4-char floor
 * on the shorter side. The substring case catches verbose vs short forms of
 * the same work ("First Law Trilogy" favorite vs "First Law Trilogy Boxed
 * Set The Blade Itself..." library entry). Earlier inserts win, so the
 * richer-data entry (library > rec > favorite) keeps its node.
 */
function titleAlreadyPresent(
  key: string,
  existing: Map<string, GraphNode>,
): boolean {
  if (existing.has(key)) return true;
  for (const existingKey of existing.keys()) {
    const shorter = key.length <= existingKey.length ? key : existingKey;
    const longer = key.length > existingKey.length ? key : existingKey;
    if (shorter.length >= 4 && longer.includes(shorter)) return true;
  }
  return false;
}

/**
 * Compute structured Avoidance[] from a TasteProfile by merging
 * profile.avoidances (kind: pattern) and profile.dislikedTitles (kind:
 * title). Mirrors Resonance's server-side derivation; used by sample/
 * demo paths where there's no network round-trip.
 */
export function deriveAvoidances(profile: TasteProfile): Avoidance[] {
  return [
    ...profile.avoidances.map((description) => ({
      description,
      kind: "pattern" as const,
    })),
    ...(profile.dislikedTitles ?? []).map((description) => ({
      description,
      kind: "title" as const,
    })),
  ];
}

/**
 * Compute favorites client-side from a TasteProfile by flattening
 * `mediaAffinities[].favorites` and tagging each title via title-substring
 * match against profile evidence/attraction.
 *
 * Mirrors Resonance's server-side derivation in `/api/profile/export` so
 * sample data (and any future no-network path) produces identical output
 * to the API. The real-data path uses the API-provided favorites array
 * directly — this is for fallback / sample / demo only.
 */
export function deriveFavorites(profile: TasteProfile): Favorite[] {
  return profile.mediaAffinities.flatMap((affinity) =>
    affinity.favorites.map((title) => ({
      title,
      mediaType: affinity.format,
      themes: profile.themes
        .filter((t) => titleAppearsIn(title, themeHaystack(t)))
        .map((t) => t.label),
      archetypes: profile.archetypes
        .filter((a) => titleAppearsIn(title, a.attraction))
        .map((a) => a.label),
    })),
  );
}

/**
 * Greedy load-balanced primary-theme assignment. Without this, the
 * highest-weight theme absorbs every multi-tag node (a rec tagged with
 * both [theme A weight 0.99, theme B weight 0.82] always picks A) and
 * weaker themes end up as empty cluster glows.
 *
 * Sort nodes by candidate count ascending — single-theme nodes claim
 * their seats first. On count-ties, prefer the LOWER-weight theme:
 * high-weight themes have more candidate nodes, so they'll fill up
 * through other nodes' choices anyway. Reserving early ties for
 * low-weight themes ensures every theme picks up at least one resident.
 *
 * Mutates `node.primaryTheme` in place.
 */
export function assignPrimaryThemes(
  nodes: GraphNode[],
  themes: TasteProfile["themes"],
): void {
  const themeWeight = new Map(themes.map((t) => [t.label, t.weight]));
  const memberCount = new Map<string, number>();
  for (const t of themes) memberCount.set(t.label, 0);
  const balancingOrder = [...nodes].sort(
    (a, b) => a.themes.length - b.themes.length,
  );
  for (const node of balancingOrder) {
    if (node.themes.length === 0) continue;
    let best: string | null = null;
    let bestCount = Infinity;
    let bestWeight = Infinity;
    for (const themeLabel of node.themes) {
      const count = memberCount.get(themeLabel) ?? 0;
      const weight = themeWeight.get(themeLabel) ?? 0;
      if (count < bestCount || (count === bestCount && weight < bestWeight)) {
        best = themeLabel;
        bestCount = count;
        bestWeight = weight;
      }
    }
    node.primaryTheme = best;
    if (best) memberCount.set(best, (memberCount.get(best) ?? 0) + 1);
  }
}

export function buildGraph(
  profile: TasteProfile,
  library: LibraryItem[],
  recommendations: RecommendationItem[],
  favorites: Favorite[] = [],
): Graph {
  const themeLabels = new Set(profile.themes.map((t) => t.label));
  const archetypeLabels = new Set(profile.archetypes.map((a) => a.label));
  const nodesByTitle = new Map<string, GraphNode>();

  // Insert order: library → recommendations → favorites. Earlier inserts
  // win on title collision since they carry richer per-item data (rating,
  // explicit user action, AI explanation). Favorites are flat title strings
  // with no id/year/rating, so they should never overwrite a library or rec.
  for (const item of library) {
    const themes = item.tasteTags.length
      ? matchLabelsFromTags(item.tasteTags, themeLabels)
      : themesForLibraryTitle(item.title, profile);
    const archetypes = item.tasteTags.length
      ? matchLabelsFromTags(item.tasteTags, archetypeLabels)
      : archetypesForLibraryTitle(item.title, profile);
    nodesByTitle.set(normalize(item.title), {
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      year: item.year,
      rating: item.rating,
      matchScore: null,
      status: item.status === "watchlist" ? "watchlist" : "library",
      themes,
      archetypes,
      source: "library",
      primaryTheme: null,
      // Library fitNote shares the detail-panel "Why this fits" surface
      // with rec.explanation. Same UI contract; different data origin.
      explanation: item.fitNote,
    });
  }

  for (const rec of recommendations) {
    const key = normalize(rec.title);
    if (titleAlreadyPresent(key, nodesByTitle)) continue;
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
      primaryTheme: null,
      explanation: rec.explanation,
    });
  }

  // Favorites come pre-tagged from Resonance with canonical theme +
  // archetype labels (server-side titleAppearsIn against profile evidence).
  // No fuzzy re-matching needed — they're already validated against the
  // canonical label set. Synthetic id "fav-<normalized>" since favorites
  // have no DB primary key (they live in profile JSONB).
  for (const fav of favorites) {
    const key = normalize(fav.title);
    if (titleAlreadyPresent(key, nodesByTitle)) continue;
    nodesByTitle.set(key, {
      id: `fav-${key.replace(/\s+/g, "-")}`,
      title: fav.title,
      mediaType: fav.mediaType,
      year: null,
      rating: null,
      matchScore: null,
      status: "favorite",
      themes: fav.themes,
      archetypes: fav.archetypes,
      source: "library",
      primaryTheme: null,
      explanation: null,
    });
  }

  // Drop nodes with no theme AND no archetype anchor. An unanchored node
  // has nothing pulling it toward a cluster center, so it falls to (and
  // piles up at) the canvas-center fallback in the simulation. Visually
  // it's noise — a star with no narrative connection to the constellation.
  const nodes = Array.from(nodesByTitle.values()).filter(
    (n) => n.themes.length > 0 || n.archetypes.length > 0,
  );

  assignPrimaryThemes(nodes, profile.themes);

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
      // Min-normalize: strength = shared / min(a.tagCount, b.tagCount).
      // Equivalent to max(shared/a.tagCount, shared/b.tagCount) — captures
      // "how well does the smaller node fit inside the larger's space."
      // Max-normalization (the previous formula) penalized sparse nodes:
      // a single-tag node sharing its only theme with a 5-tag node got
      // 1/5 = 0.2 and was always pruned, even though the connection is
      // total from the smaller node's perspective. The MAX_EDGES_PER_NODE
      // cap downstream prevents over-edging from this loosening.
      const minPossible = Math.min(
        a.themes.length + a.archetypes.length,
        b.themes.length + b.archetypes.length,
      );
      const strength = minPossible === 0 ? 0 : shared / minPossible;
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

  // Cluster radius derived from theme weight: 45px (low weight) to 100px
  // (top weight). The previous toggle between "weight" and "members" was
  // removed in the 2026-05-10 Phase 4 DNA change since cluster radius no
  // longer carries visual weight — the constellation lines and node tint
  // do that work now, and the radius only sets label distance and the
  // (hidden by default) glow size.
  const clusterRadiusFor = (theme: TasteProfile["themes"][number]): number => {
    return 45 + theme.weight * 55;
  };

  const placements = placeClusters(profile.themes, clusterRadiusFor);
  const placementByLabel = new Map(placements.map((p) => [p.label, p]));

  const clusters: ThemeCluster[] = profile.themes.map((theme, i) => {
    const memberNodeIds = nodes
      .filter((n) => n.themes.includes(theme.label))
      .map((n) => n.id);
    const p = placementByLabel.get(theme.label);
    return {
      label: theme.label,
      weight: theme.weight,
      color: colorForThemeIndex(i),
      centerX: p?.x ?? CANVAS_W / 2,
      centerY: p?.y ?? CANVAS_H / 2,
      radius: clusterRadiusFor(theme),
      memberNodeIds,
    };
  });

  return { nodes, edges, clusters };
}

/**
 * Force-directed cluster placement. Replaces the previous uniform circular
 * orbit. Each theme is a body in a small auxiliary simulation:
 *   - charge (repulsion) scales with theme.weight — heavier themes push
 *     harder, so they end up with more space around them.
 *   - collide enforces minimum spacing equal to each cluster's render
 *     radius plus margin so glows don't overlap.
 *   - center pulls everything toward canvas center.
 *
 * Initial positions are seeded by a hash of the theme labels, so the
 * layout is **deterministic per profile** — same set of themes always
 * produces the same layout. Different profiles get different layouts.
 */
interface ClusterPlacement extends d3.SimulationNodeDatum {
  label: string;
  weight: number;
  radius: number;
}

function placeClusters(
  themes: TasteProfile["themes"],
  radiusFor: (theme: TasteProfile["themes"][number]) => number,
): ClusterPlacement[] {
  if (themes.length === 0) return [];

  // Deterministic seed from the concatenated theme labels — same profile
  // → same layout across reloads, but a new theme shifts things.
  let seed = 1337;
  for (const t of themes) {
    for (let i = 0; i < t.label.length; i++) {
      seed = ((seed * 31) ^ t.label.charCodeAt(i)) | 0;
    }
  }
  const rand = () => {
    seed = ((seed * 1664525) + 1013904223) | 0;
    return ((seed >>> 0) % 1_000_000) / 1_000_000;
  };

  const placement: ClusterPlacement[] = themes.map((t) => ({
    label: t.label,
    weight: t.weight,
    radius: radiusFor(t),
    // Wider seed (0.85 vs prior 0.55) so initial positions span almost
    // the whole canvas. Combined with weaker center pull, clusters
    // settle into a more spread-out organic layout instead of bunching.
    x: CANVAS_W / 2 + (rand() - 0.5) * CANVAS_W * 0.85,
    y: CANVAS_H / 2 + (rand() - 0.5) * CANVAS_H * 0.85,
  }));

  const sim = d3
    .forceSimulation<ClusterPlacement>(placement)
    .force(
      "charge",
      d3
        .forceManyBody<ClusterPlacement>()
        .strength((d) => -1800 - d.weight * 1800),
    )
    .force(
      "collide",
      d3
        .forceCollide<ClusterPlacement>()
        // Larger margin (60 vs 28) — clusters end up with visible
        // negative space between them instead of glow-touching.
        .radius((d) => d.radius + 60)
        .strength(0.95),
    )
    .force(
      "center",
      // Weaker center pull (0.02 vs 0.04) lets clusters drift toward the
      // edges of the canvas instead of getting squished into the middle.
      d3.forceCenter(CANVAS_W / 2, CANVAS_H / 2).strength(0.02),
    )
    .stop();

  // Manual ticks (sim.stop() prevents auto-tick) plus per-tick clamp
  // so clusters stay inside canvas bounds even if forces would launch
  // them outside. More ticks (400 vs 320) so the layout fully settles
  // with the stronger repulsion + weaker center.
  for (let i = 0; i < 400; i++) {
    sim.tick();
    for (const c of placement) {
      const m = c.radius + 24;
      if (typeof c.x === "number") {
        c.x = Math.max(m, Math.min(CANVAS_W - m, c.x));
      }
      if (typeof c.y === "number") {
        c.y = Math.max(m, Math.min(CANVAS_H - m, c.y));
      }
    }
  }

  return placement;
}
