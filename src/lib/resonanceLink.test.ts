import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildResonancePrompt,
  buildResonanceRecommendationsUrl,
  evidenceExcerpt,
} from "./resonanceLink";

beforeEach(() => {
  vi.stubEnv("VITE_RESONANCE_FRONTEND_URL", "https://resonance-client.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("evidenceExcerpt", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(evidenceExcerpt(null)).toBe("");
    expect(evidenceExcerpt(undefined)).toBe("");
    expect(evidenceExcerpt("")).toBe("");
    expect(evidenceExcerpt("   ")).toBe("");
  });

  it("returns the whole string when under the cap and has no period", () => {
    expect(evidenceExcerpt("Short evidence with no period")).toBe(
      "Short evidence with no period",
    );
  });

  it("returns the whole string when under the cap even with a period", () => {
    expect(evidenceExcerpt("First. Second.")).toBe("First. Second.");
  });

  it("takes the first sentence when the full string is over the cap", () => {
    const long =
      "First sentence here. " +
      "Second sentence with lots more padding ".repeat(20);
    expect(evidenceExcerpt(long)).toBe("First sentence here");
  });

  it("hard-truncates when no clean sentence boundary exists in range", () => {
    const long = "x".repeat(400);
    const result = evidenceExcerpt(long);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});

describe("buildResonancePrompt", () => {
  it("prefers summary + anchors when present", () => {
    expect(
      buildResonancePrompt("Burden-carrying protagonists", {
        label: "Burden-carrying protagonists",
        weight: 0.9,
        summary: "Heroes who choose the harder right thing under accumulating cost.",
        anchors: [
          { title: "The Wire", mediaType: "tv" },
          { title: "Disco Elysium", mediaType: "game" },
        ],
        reinforcedBy: [],
      }),
    ).toBe(
      'Generate recommendations anchored to my "Burden-carrying protagonists" theme — Heroes who choose the harder right thing under accumulating cost. — anchored in The Wire, Disco Elysium',
    );
  });

  it("uses summary alone when anchors are empty", () => {
    expect(
      buildResonancePrompt("Existential dread", {
        label: "Existential dread",
        weight: 0.8,
        summary: "Stuff about meaninglessness.",
        anchors: [],
        reinforcedBy: [],
      }),
    ).toBe(
      'Generate recommendations anchored to my "Existential dread" theme — Stuff about meaninglessness.',
    );
  });

  it("falls back to legacy evidence when summary and anchors are missing", () => {
    expect(
      buildResonancePrompt("Old theme", {
        label: "Old theme",
        weight: 0.5,
        evidence: "Legacy evidence text from before the redesign.",
      }),
    ).toBe(
      'Generate recommendations anchored to my "Old theme" theme — Legacy evidence text from before the redesign.',
    );
  });

  it("falls back to bare period when theme is null or empty", () => {
    expect(buildResonancePrompt("Empty theme", null)).toBe(
      'Generate recommendations anchored to my "Empty theme" theme.',
    );
    expect(
      buildResonancePrompt("Empty theme", {
        label: "Empty theme",
        weight: 0.5,
      }),
    ).toBe('Generate recommendations anchored to my "Empty theme" theme.');
  });

  it("caps total length at 500 chars", () => {
    const huge = "x".repeat(800);
    const result = buildResonancePrompt("Theme", {
      label: "Theme",
      weight: 0.5,
      evidence: huge,
    });
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

describe("buildResonanceRecommendationsUrl", () => {
  it("builds the URL against the configured frontend host", () => {
    const url = buildResonanceRecommendationsUrl("hello world");
    expect(url).toBe(
      "https://resonance-client.example/recommendations?prompt=hello+world",
    );
  });

  it("URL-encodes special characters in the prompt", () => {
    const url = buildResonanceRecommendationsUrl(
      'My "theme" — with em dash & ampersand',
    );
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/recommendations");
    expect(parsed.searchParams.get("prompt")).toBe(
      'My "theme" — with em dash & ampersand',
    );
  });

  it("falls back with a console.warn when env var is missing", () => {
    vi.stubEnv("VITE_RESONANCE_FRONTEND_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = buildResonanceRecommendationsUrl("hi");
    expect(
      url.startsWith("https://resonance-client.vercel.app/recommendations"),
    ).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
  });
});
