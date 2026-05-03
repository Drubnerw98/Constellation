import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchProfileExport, type ProfileExport } from "./api";
import type { TasteProfile } from "../types/profile";

const minimalProfile: TasteProfile = {
  themes: [],
  archetypes: [],
  narrativePrefs: {
    pacing: "slow-burn",
    complexity: "layered",
    tone: [],
    endings: "",
  },
  mediaAffinities: [],
  avoidances: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_RESONANCE_API_URL", "https://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchProfileExport", () => {
  it("returns parsed shape on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [],
        favorites: [],
        avoidances: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProfileExport("tok");

    expect(result.profile).toEqual(minimalProfile);
    expect(result.library).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.favorites).toEqual([]);
    expect(result.avoidances).toEqual([]);
  });

  it("attaches the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [],
        favorites: [],
        avoidances: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchProfileExport("xyz-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer xyz-token");
  });

  it("filters recommendations to RENDERABLE_STATUSES", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [
          {
            id: "1",
            title: "kept-pending",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "pending",
            rating: null,
          },
          {
            id: "2",
            title: "dropped-skipped",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "skipped",
            rating: null,
          },
          {
            id: "3",
            title: "dropped-seen",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "seen",
            rating: null,
          },
          {
            id: "4",
            title: "kept-saved",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "saved",
            rating: null,
          },
        ],
        favorites: [],
        avoidances: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProfileExport("tok");

    expect(result.recommendations.map((r) => r.title)).toEqual([
      "kept-pending",
      "kept-saved",
    ]);
  });

  it("normalizes missing explanation to null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [
          {
            id: "1",
            title: "no-explanation",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "saved",
            rating: null,
          },
        ],
        favorites: [],
        avoidances: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProfileExport("tok");

    expect(result.recommendations[0]!.explanation).toBeNull();
  });

  it("defaults missing favorites + avoidances to empty arrays", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [],
        // favorites + avoidances omitted — older Resonance deploy
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result: ProfileExport = await fetchProfileExport("tok");

    expect(result.favorites).toEqual([]);
    expect(result.avoidances).toEqual([]);
  });

  it("throws ApiError(404) when profile doesn't exist", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "no profile yet" }, 404),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProfileExport("tok")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "no profile yet",
    });
  });

  it("throws ApiError with status from non-2xx responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "internal" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProfileExport("tok")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
    });
  });

  it("falls back to default message when error body isn't JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProfileExport("tok")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Resonance API returned 500",
    });
  });

  it("propagates fetch TypeError on network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProfileExport("tok")).rejects.toThrow(TypeError);
  });

  it("throws when VITE_RESONANCE_API_URL is unset", async () => {
    vi.stubEnv("VITE_RESONANCE_API_URL", "");

    await expect(fetchProfileExport("tok")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
    });
  });
});

describe("ApiError", () => {
  it("preserves message + status", () => {
    const err = new ApiError("nope", 404);
    expect(err.message).toBe("nope");
    expect(err.status).toBe(404);
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});
