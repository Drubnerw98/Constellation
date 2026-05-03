import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock both Clerk + the api client. The hook is the unit under test;
// these are external dependencies.
const mockUseAuth = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockFetchProfileExport = vi.fn();
vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>(
    "../lib/api",
  );
  return {
    ...actual,
    fetchProfileExport: (...args: unknown[]) => mockFetchProfileExport(...args),
  };
});

import { useResonanceProfile } from "./useResonanceProfile";
import { ApiError } from "../lib/api";

beforeEach(() => {
  mockUseAuth.mockReset();
  mockFetchProfileExport.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useResonanceProfile", () => {
  it("returns idle while Clerk hasn't loaded", () => {
    mockUseAuth.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      getToken: vi.fn(),
    });

    const { result } = renderHook(() => useResonanceProfile());

    expect(result.current.state).toBe("idle");
    expect(mockFetchProfileExport).not.toHaveBeenCalled();
  });

  it("returns idle when Clerk is loaded but signed out", () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      getToken: vi.fn(),
    });

    const { result } = renderHook(() => useResonanceProfile());

    expect(result.current.state).toBe("idle");
    expect(mockFetchProfileExport).not.toHaveBeenCalled();
  });

  it("transitions loading → ready when fetch succeeds", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok"),
    });
    const data = {
      profile: {
        themes: [],
        archetypes: [],
        narrativePrefs: {
          pacing: "slow-burn" as const,
          complexity: "layered" as const,
          tone: [],
          endings: "",
        },
        mediaAffinities: [],
        avoidances: [],
      },
      library: [],
      recommendations: [],
      favorites: [],
      avoidances: [],
    };
    mockFetchProfileExport.mockResolvedValue(data);

    const { result } = renderHook(() => useResonanceProfile());

    // First render: loading
    expect(result.current.state).toBe("loading");

    await waitFor(() =>
      expect(result.current.state).toBe("ready"),
    );
    if (result.current.state === "ready") {
      expect(result.current.data).toEqual(data);
    }
  });

  it("maps 404 ApiError to no-profile", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok"),
    });
    mockFetchProfileExport.mockRejectedValue(
      new ApiError("no profile yet", 404),
    );

    const { result } = renderHook(() => useResonanceProfile());

    await waitFor(() => expect(result.current.state).toBe("no-profile"));
  });

  it("maps non-404 ApiError to error with the API message", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok"),
    });
    mockFetchProfileExport.mockRejectedValue(
      new ApiError("internal", 500),
    );

    const { result } = renderHook(() => useResonanceProfile());

    await waitFor(() => expect(result.current.state).toBe("error"));
    if (result.current.state === "error") {
      expect(result.current.message).toBe("internal");
    }
  });

  it("normalizes network failures (TypeError) to 'Resonance is unreachable'", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue("tok"),
    });
    mockFetchProfileExport.mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const { result } = renderHook(() => useResonanceProfile());

    await waitFor(() => expect(result.current.state).toBe("error"));
    if (result.current.state === "error") {
      expect(result.current.message).toBe("Resonance is unreachable");
    }
  });

  it("does not call the API when getToken returns null", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue(null),
    });

    const { result } = renderHook(() => useResonanceProfile());

    // Wait for any pending async work to settle. Current behavior: hook
    // stays in "loading" because the null-token branch resets fetched to
    // null and the derived state falls back to loading. Worth fixing —
    // either map to a specific error state or to idle. For now the test
    // pins current behavior + verifies the API was never called.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockFetchProfileExport).not.toHaveBeenCalled();
    expect(["loading", "idle"]).toContain(result.current.state);
  });
});
