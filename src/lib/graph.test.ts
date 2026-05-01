import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
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
        tasteTags: ["beta", "wandering ronin"],
      },
    ];
    const { nodes } = buildGraph(baseProfile, lib, []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.themes).toEqual(["beta"]);
    expect(nodes[0]!.archetypes).toEqual(["wandering ronin"]);
  });

  it("falls back to evidence substring matching when tasteTags absent", () => {
    const lib: LibraryItem[] = [
      {
        id: "l1",
        title: "Foo Movie",
        mediaType: "movie",
        year: 2020,
        rating: 5,
        source: "library",
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
        tasteTags: ["alpha"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
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
        tasteTags: ["alpha", "beta", "gamma", "wandering ronin", "broken cop"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
        tasteTags: ["alpha"],
      },
    ];
    const { edges } = buildGraph(baseProfile, lib, []);
    // shared = 1, max = 5 → strength 0.2, below 0.25 threshold
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
        tasteTags: ["alpha", "beta"],
      },
      {
        id: "b",
        title: "B",
        mediaType: "tv",
        year: 2001,
        rating: 5,
        source: "library",
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
});
