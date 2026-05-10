import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  fetchProfileExport,
  fetchVersionExport,
  fetchVersions,
  type ProfileExport,
} from "./api";
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

describe("fetchVersions", () => {
  it("returns coerced versions array on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { id: 1, trigger: "onboarding", createdAt: "2024-01-01T00:00:00Z" },
        {
          id: 2,
          trigger: "feedback_batch",
          createdAt: "2024-02-01T00:00:00Z",
        },
        {
          id: 3,
          trigger: "manual_edit",
          createdAt: "2024-03-01T00:00:00Z",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const versions = await fetchVersions("tok");

    expect(versions).toHaveLength(3);
    expect(versions[0]!.trigger).toBe("onboarding");
    expect(versions[2]!.trigger).toBe("manual_edit");
  });

  it("drops versions with unrecognized trigger values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { id: 1, trigger: "onboarding", createdAt: "2024-01-01T00:00:00Z" },
        {
          id: 2,
          trigger: "future_unknown_trigger",
          createdAt: "2024-02-01T00:00:00Z",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const versions = await fetchVersions("tok");

    expect(versions).toHaveLength(1);
    expect(versions[0]!.id).toBe(1);
  });

  it("attaches the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchVersions("xyz-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe("Bearer xyz-token");
  });

  it("throws ApiError on non-2xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVersions("tok")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "boom",
    });
  });
});

describe("fetchVersionExport", () => {
  it("returns the same shape as fetchProfileExport for a historical version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        profile: minimalProfile,
        library: [],
        recommendations: [
          {
            id: "1",
            title: "kept",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "saved",
            rating: null,
          },
          {
            id: "2",
            title: "dropped",
            mediaType: "movie",
            year: 2020,
            matchScore: 0.8,
            tasteTags: [],
            status: "skipped",
            rating: null,
          },
        ],
        favorites: [],
        avoidances: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchVersionExport("tok", 42);

    expect(result.recommendations.map((r) => r.title)).toEqual(["kept"]);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/profile/versions/42/export");
  });

  it("url-encodes the version id", async () => {
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

    await fetchVersionExport("tok", "v 1/2");

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/profile/versions/v%201%2F2/export");
  });

  it("propagates 404 when a version was deleted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVersionExport("tok", 99)).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
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
