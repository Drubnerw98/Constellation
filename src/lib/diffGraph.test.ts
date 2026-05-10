import { describe, it, expect } from "vitest";
import { buildDiffGraph } from "./diffGraph";
import type { ProfileExport } from "./api";
import type {
  LibraryItem,
  RecommendationItem,
  TasteProfile,
} from "../types/profile";

function makeExport(
  themes: TasteProfile["themes"],
  archetypes: TasteProfile["archetypes"],
  library: LibraryItem[],
  recommendations: RecommendationItem[] = [],
): ProfileExport {
  return {
    profile: {
      themes,
      archetypes,
      narrativePrefs: {
        pacing: "slow-burn",
        complexity: "layered",
        tone: [],
        endings: "ambiguous",
      },
      mediaAffinities: [],
      avoidances: [],
    },
    library,
    recommendations,
    favorites: [],
    avoidances: [],
  };
}

function makeLibrary(
  id: string,
  title: string,
  tasteTags: string[] = [],
): LibraryItem {
  return {
    id,
    title,
    mediaType: "movie",
    year: 2020,
    rating: 5,
    source: "library",
    status: "consumed",
    fitNote: null,
    tasteTags,
  };
}

const baseThemes = [
  { label: "alpha", weight: 0.9, evidence: "Foo carries this." },
  { label: "beta", weight: 0.7, evidence: "Bar shows this too." },
];
const baseArchetypes = [
  { label: "wandering ronin", attraction: "Foo's drifter." },
];

describe("buildDiffGraph", () => {
  it("identical profiles produce zero added/removed and all stable nodes", () => {
    const exp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("l1", "Foo Movie", ["alpha"]),
      makeLibrary("l2", "Bar Show", ["beta"]),
    ]);
    const diff = buildDiffGraph(exp, exp);

    expect(diff.nodes.added).toHaveLength(0);
    expect(diff.nodes.removed).toHaveLength(0);
    expect(diff.nodes.stable).toHaveLength(2);
    expect(diff.clusters.addedTo).toHaveLength(0);
    expect(diff.clusters.removedFrom).toHaveLength(0);
    expect(diff.clusters.shared).toHaveLength(2);
  });

  it("dropping a theme between versions surfaces it in removedFrom + node moves to removed", () => {
    const fromExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("l1", "Beta Only", ["beta"]),
    ]);
    // `to` version drops the "beta" theme entirely (and the title that
    // anchored to it falls out — no archetype anchor either).
    const toExp = makeExport(
      baseThemes.filter((t) => t.label !== "beta"),
      baseArchetypes,
      [],
    );
    const diff = buildDiffGraph(fromExp, toExp);

    expect(diff.clusters.removedFrom.map((c) => c.label)).toEqual(["beta"]);
    expect(diff.clusters.addedTo).toHaveLength(0);
    expect(diff.clusters.shared.map((c) => c.label)).toEqual(["alpha"]);
    expect(diff.nodes.removed.map((n) => n.title)).toEqual(["Beta Only"]);
    expect(diff.nodes.added).toHaveLength(0);
    expect(diff.nodes.stable).toHaveLength(0);
  });

  it("adding a theme between versions surfaces it in addedTo + new node in added", () => {
    const fromExp = makeExport(
      baseThemes.filter((t) => t.label !== "beta"),
      baseArchetypes,
      [],
    );
    const toExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("l1", "Beta Only", ["beta"]),
    ]);
    const diff = buildDiffGraph(fromExp, toExp);

    expect(diff.clusters.addedTo.map((c) => c.label)).toEqual(["beta"]);
    expect(diff.clusters.removedFrom).toHaveLength(0);
    expect(diff.nodes.added.map((n) => n.title)).toEqual(["Beta Only"]);
    expect(diff.nodes.removed).toHaveLength(0);
  });

  it("a node migrating clusters between versions appears in stable with differing primaryTheme", () => {
    // Same title, same themes available — but the tasteTags differ
    // between versions, so primaryTheme assignment lands in different
    // clusters.
    const fromExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("l1", "Migrant Title", ["alpha"]),
    ]);
    const toExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("l1", "Migrant Title", ["beta"]),
    ]);
    const diff = buildDiffGraph(fromExp, toExp);

    expect(diff.nodes.stable).toHaveLength(1);
    const stable = diff.nodes.stable[0]!;
    expect(stable.from.primaryTheme).toBe("alpha");
    expect(stable.to.primaryTheme).toBe("beta");
    expect(stable.from.title).toBe(stable.to.title);
  });

  it("matches stable nodes by title even when underlying ids differ", () => {
    // Different db ids, same canonicalized title — diff should pair them.
    const fromExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("old-id-7", "Foo Movie", ["alpha"]),
    ]);
    const toExp = makeExport(baseThemes, baseArchetypes, [
      makeLibrary("new-id-42", "Foo Movie", ["alpha"]),
    ]);
    const diff = buildDiffGraph(fromExp, toExp);

    expect(diff.nodes.stable).toHaveLength(1);
    expect(diff.nodes.added).toHaveLength(0);
    expect(diff.nodes.removed).toHaveLength(0);
    expect(diff.nodes.stable[0]!.from.id).toBe("old-id-7");
    expect(diff.nodes.stable[0]!.to.id).toBe("new-id-42");
  });
});
