import { describe, it, expect } from "vitest";
import {
  assignPrimaryThemes,
  buildGraph,
  deriveAvoidances,
  deriveFavorites,
  matchLabel,
  titleAppearsIn,
} from "./graph";
import type { GraphNode } from "../types/graph";
import type {
  TasteProfile,
  LibraryItem,
  RecommendationItem,
} from "../types/profile";

const baseProfile: TasteProfile = {
  themes: [
    { label: "alpha", weight: 0.9, evidence: "Foo Movie carries this." },
    { label: "beta", weight: 0.7, evidence: "Bar Show as well." },
    { label: "gamma", weight: 0.5, evidence: "Nothing here." },
  ],
  archetypes: [
    { label: "wandering ronin", attraction: "Foo Movie's lonely traveler." },
    { label: "broken cop", attraction: "abstract pattern only." },
  ],
  narrativePrefs: {
    pacing: "slow-burn",
    complexity: "layered",
    tone: ["melancholic"],
    endings: "ambiguous",
  },
  mediaAffinities: [],
  avoidances: [],
};

describe("buildGraph", () => {
  it("uses explicit tasteTags on library items when present", () => {
    const lib: LibraryItem[] = [
      {
        id: "l1",
        title: "Foo Movie",
        mediaType: "movie",
        year: 2020,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["beta", "wandering ronin"],
      },
    ];
    const { nodes } = buildGraph(baseProfile, lib, []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.themes).toEqual(["beta"]);
    expect(nodes[0]!.archetypes).toEqual(["wandering ronin"]);
  });

  it("falls back to evidence substring matching when tasteTags empty", () => {
    const lib: LibraryItem[] = [
      {
        id: "l1",
        title: "Foo Movie",
        mediaType: "movie",
        year: 2020,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: [],
      },
    ];
    const { nodes } = buildGraph(baseProfile, lib, []);
    expect(nodes[0]!.themes).toEqual(["alpha"]);
    expect(nodes[0]!.archetypes).toEqual(["wandering ronin"]);
  });

  it("filters recommendation tasteTags down to known theme/archetype labels", () => {
    const recs: RecommendationItem[] = [
      {
        id: "r1",
        title: "New Title",
        mediaType: "tv",
        year: 2024,
        matchScore: 0.8,
        tasteTags: ["alpha", "broken cop", "ghost-tag-not-in-profile"],
        status: "saved",
        rating: null,
        explanation: null,
      },
    ];
    const { nodes } = buildGraph(baseProfile, [], recs);
    expect(nodes[0]!.themes).toEqual(["alpha"]);
    expect(nodes[0]!.archetypes).toEqual(["broken cop"]);
  });

  it("dedupes a recommendation that matches a library title (library wins)", () => {
    const lib: LibraryItem[] = [
      {
        id: "lib-foo",
        title: "Foo Movie",
        mediaType: "movie",
        year: 2020,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha"],
      },
    ];
    const recs: RecommendationItem[] = [
      {
        id: "rec-foo",
        title: "FOO movie",
        mediaType: "movie",
        year: 2020,
        matchScore: 0.5,
        tasteTags: ["beta"],
        status: "saved",
        rating: null,
        explanation: null,
      },
    ];
    const { nodes } = buildGraph(baseProfile, lib, recs);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.id).toBe("lib-foo");
    expect(nodes[0]!.source).toBe("library");
  });

  it("creates an edge between titles sharing a theme above the strength threshold", () => {
    const lib: LibraryItem[] = [
      {
        id: "a",
        title: "A",
        mediaType: "movie",
        year: 2000,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha"],
      },
    ];
    const { edges } = buildGraph(baseProfile, lib, []);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.sharedThemes).toEqual(["alpha"]);
    expect(edges[0]!.strength).toBe(1);
  });

  it("drops edges below the minimum strength threshold", () => {
    const lib: LibraryItem[] = [
      {
        id: "a",
        title: "A",
        mediaType: "movie",
        year: 2000,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha", "wandering ronin", "broken cop"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha", "beta", "gamma"],
      },
    ];
    const { edges } = buildGraph(baseProfile, lib, []);
    // shared = 1, min(3, 3) = 3 → strength 0.33, below 0.4 threshold
    expect(edges).toHaveLength(0);
  });

  it("builds one cluster per theme with member ids", () => {
    const lib: LibraryItem[] = [
      {
        id: "a",
        title: "A",
        mediaType: "movie",
        year: 2000,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["alpha", "beta"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: null,
        tasteTags: ["beta"],
      },
    ];
    const { clusters } = buildGraph(baseProfile, lib, []);
    expect(clusters).toHaveLength(3);
    expect(clusters.find((c) => c.label === "alpha")!.memberNodeIds).toEqual([
      "a",
    ]);
    expect(
      clusters.find((c) => c.label === "beta")!.memberNodeIds.sort(),
    ).toEqual(["a", "b"]);
    expect(clusters.find((c) => c.label === "gamma")!.memberNodeIds).toEqual(
      [],
    );
  });

  it("scales cluster radius by theme weight", () => {
    const { clusters } = buildGraph(baseProfile, [], []);
    const alpha = clusters.find((c) => c.label === "alpha")!;
    const gamma = clusters.find((c) => c.label === "gamma")!;
    expect(alpha.radius).toBeGreaterThan(gamma.radius);
  });

  it("caps the edge mesh via the top-K-per-node rule", () => {
    // 6 titles all sharing one theme. Without a cap the graph is the complete
    // graph K6 = 15 edges. With MAX_EDGES_PER_NODE=4 the densest pair drops
    // because both endpoints have already filled their slack. Asserting on the
    // shape (count strictly less than complete + every node still connected)
    // rather than an exact integer keeps the test robust to algorithm tweaks.
    const lib: LibraryItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`,
      title: `Title ${i}`,
      mediaType: "movie" as const,
      year: 2000 + i,
      rating: 5,
      source: "library" as const,
      status: "consumed" as const,
      fitNote: null,
      tasteTags: ["alpha"],
    }));
    const { edges, nodes } = buildGraph(baseProfile, lib, []);
    expect(edges.length).toBeLessThan(15);
    expect(edges.length).toBeGreaterThan(0);
    const degree = new Map<string, number>();
    for (const e of edges) {
      const s = typeof e.source === "string" ? e.source : e.source.id;
      const t = typeof e.target === "string" ? e.target : e.target.id;
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    }
    for (const n of nodes) {
      expect(degree.get(n.id) ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("matchLabel", () => {
  // Tier 1: exact normalized match.
  it("matches exact label after normalization", () => {
    const labels = new Set(["earned sacrifice", "wandering ronin"]);
    // Punctuation stripped, case folded.
    expect(matchLabel("Earned-Sacrifice!", labels)).toBe("earned sacrifice");
  });

  it("returns null when nothing matches in any tier", () => {
    const labels = new Set(["earned sacrifice", "wandering ronin"]);
    expect(matchLabel("space opera", labels)).toBeNull();
  });

  // Tier 2: full-string substring with min-4-char floor.
  it("matches substring containment when shorter side is 4+ chars", () => {
    const labels = new Set([
      "earned sacrifice through sustained commitment",
    ]);
    // "earned sacrifice" (16 chars) contained inside the longer canonical.
    expect(matchLabel("earned sacrifice", labels)).toBe(
      "earned sacrifice through sustained commitment",
    );
  });

  it("rejects substring matches under the 4-char floor", () => {
    const labels = new Set(["abandonment"]);
    // "a" appears in "abandonment" but is below FUZZY_MIN_LEN=4.
    // The single-character tag also has no content tokens (length>=3),
    // so tier 3 returns null too.
    expect(matchLabel("a", labels)).toBeNull();
  });

  // Tier 3: content-token overlap with bidirectional within-token substring.
  // Constructed so tier 2 (full-string substring) cannot fire — neither
  // full normalized form is a substring of the other — forcing the match
  // to come from per-token overlap with morphology drift ("burden" inside
  // "burdens").
  it("matches via content-token within-token substring (morphology drift)", () => {
    expect(
      matchLabel(
        "burden carrying",
        new Set(["burdens of memory and time"]),
      ),
    ).toBe("burdens of memory and time");
  });

  it("excludes stopwords from token overlap", () => {
    // Tag is purely stopwords + a too-short word; no content tokens.
    // Tier 3 returns null because tagTokens is empty.
    expect(matchLabel("the of as", new Set(["earned sacrifice"]))).toBeNull();
  });
});

describe("titleAppearsIn", () => {
  it("matches via direct normalized substring", () => {
    expect(
      titleAppearsIn("Aftersun", "loved Aftersun for its quiet grief"),
    ).toBe(true);
  });

  it("matches via 2+ content-token overlap when direct substring fails", () => {
    expect(
      titleAppearsIn(
        "The Assassination of Jesse James by the Coward Robert Ford",
        "evidence text mentions Jesse James and Robert frankly",
      ),
    ).toBe(true);
  });

  it("does NOT match on 1-token overlap (threshold is 2)", () => {
    expect(
      titleAppearsIn(
        "The Assassination of Jesse James by the Coward Robert Ford",
        "evidence mentions assassination only and nothing else relevant",
      ),
    ).toBe(false);
  });
});

describe("assignPrimaryThemes", () => {
  it("picks a less-populated theme over a higher-weight one when tiebreak applies", () => {
    // Naive (highest-weight wins) would put both nodes on alpha because
    // alpha.weight > beta.weight. Load-balanced should put the second
    // node on beta because alpha already has one resident.
    const themes: TasteProfile["themes"] = [
      { label: "alpha", weight: 0.9, evidence: "" },
      { label: "beta", weight: 0.5, evidence: "" },
    ];
    const nodes: GraphNode[] = [
      makeNode("n1", ["alpha", "beta"]),
      makeNode("n2", ["alpha", "beta"]),
    ];
    assignPrimaryThemes(nodes, themes);
    const primaries = nodes.map((n) => n.primaryTheme).sort();
    // Naive baseline would yield ["alpha", "alpha"]; load-balanced
    // spreads them.
    expect(primaries).toEqual(["alpha", "beta"]);
  });

  it("seats single-theme nodes first (most-constrained-first)", () => {
    // n1 is single-theme on alpha; n2 multi-theme on alpha+beta. With
    // ascending sort by candidate count, n1 claims alpha first, pushing
    // n2 to beta even though alpha is heavier.
    const themes: TasteProfile["themes"] = [
      { label: "alpha", weight: 0.9, evidence: "" },
      { label: "beta", weight: 0.4, evidence: "" },
    ];
    const nodes: GraphNode[] = [
      makeNode("multi", ["alpha", "beta"]),
      makeNode("only-alpha", ["alpha"]),
    ];
    assignPrimaryThemes(nodes, themes);
    expect(nodes.find((n) => n.id === "only-alpha")!.primaryTheme).toBe(
      "alpha",
    );
    expect(nodes.find((n) => n.id === "multi")!.primaryTheme).toBe("beta");
  });
});

describe("deriveFavorites", () => {
  it("tags a favorite via evidence substring match", () => {
    const profile: TasteProfile = {
      themes: [
        {
          label: "quiet grief",
          weight: 0.8,
          evidence: "Aftersun cuts deep — quiet, slow.",
        },
      ],
      archetypes: [
        { label: "drifter", attraction: "Paterson's bus driver." },
      ],
      narrativePrefs: {
        pacing: "slow-burn",
        complexity: "layered",
        tone: ["melancholic"],
        endings: "ambiguous",
      },
      mediaAffinities: [
        { format: "movie", comfort: 0.9, favorites: ["Aftersun"] },
      ],
      avoidances: [],
    };
    const favs = deriveFavorites(profile);
    expect(favs).toHaveLength(1);
    expect(favs[0]!.title).toBe("Aftersun");
    expect(favs[0]!.themes).toEqual(["quiet grief"]);
    expect(favs[0]!.archetypes).toEqual([]);
  });

  it("passes a favorite through with empty themes/archetypes when nothing matches", () => {
    const profile: TasteProfile = {
      themes: [
        { label: "quiet grief", weight: 0.8, evidence: "Aftersun cuts deep." },
      ],
      archetypes: [
        { label: "drifter", attraction: "Paterson's bus driver." },
      ],
      narrativePrefs: {
        pacing: "slow-burn",
        complexity: "layered",
        tone: ["melancholic"],
        endings: "ambiguous",
      },
      mediaAffinities: [
        { format: "tv", comfort: 0.5, favorites: ["Unrelated Show"] },
      ],
      avoidances: [],
    };
    const favs = deriveFavorites(profile);
    expect(favs).toHaveLength(1);
    expect(favs[0]!.title).toBe("Unrelated Show");
    expect(favs[0]!.themes).toEqual([]);
    expect(favs[0]!.archetypes).toEqual([]);
  });
});

describe("deriveAvoidances", () => {
  it("emits kind: pattern entries from profile.avoidances", () => {
    const profile: TasteProfile = {
      themes: [],
      archetypes: [],
      narrativePrefs: {
        pacing: "slow-burn",
        complexity: "layered",
        tone: [],
        endings: "ambiguous",
      },
      mediaAffinities: [],
      avoidances: ["Mary Sue protagonists"],
    };
    expect(deriveAvoidances(profile)).toEqual([
      { description: "Mary Sue protagonists", kind: "pattern" },
    ]);
  });

  it("emits kind: title entries from profile.dislikedTitles", () => {
    const profile: TasteProfile = {
      themes: [],
      archetypes: [],
      narrativePrefs: {
        pacing: "slow-burn",
        complexity: "layered",
        tone: [],
        endings: "ambiguous",
      },
      mediaAffinities: [],
      avoidances: [],
      dislikedTitles: ["The Last of Us"],
    };
    expect(deriveAvoidances(profile)).toEqual([
      { description: "The Last of Us", kind: "title" },
    ]);
  });
});

function makeNode(id: string, themes: string[]): GraphNode {
  return {
    id,
    title: id,
    mediaType: "movie",
    year: null,
    rating: null,
    matchScore: null,
    status: "library",
    themes,
    archetypes: [],
    source: "library",
    primaryTheme: null,
    explanation: null,
  };
}
