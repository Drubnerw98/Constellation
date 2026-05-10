import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClusterPanel } from "./ClusterPanel";
import type { ThemeCluster } from "../../types/graph";
import type { TasteProfile } from "../../types/profile";

const cluster: ThemeCluster = {
  label: "Existential dread",
  weight: 1,
  color: "#ff00aa",
  centerX: 0,
  centerY: 0,
  radius: 100,
  memberNodeIds: [],
};

const profile: TasteProfile = {
  themes: [
    {
      label: "Existential dread",
      weight: 1,
      evidence:
        "You gravitate toward stories about meaninglessness and the void. Recurring across your favorites.",
    },
  ],
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

beforeEach(() => {
  vi.stubEnv("VITE_RESONANCE_FRONTEND_URL", "https://resonance-client.example");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("<ClusterPanel/> Resonance deep link", () => {
  it("renders the generate-batch button when a cluster is focused", () => {
    render(
      <ClusterPanel cluster={cluster} profile={profile} onClose={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /generate a batch from this theme/i }),
    ).toBeTruthy();
  });

  it("opens Resonance with a prompt URL composed from theme + evidence", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ClusterPanel cluster={cluster} profile={profile} onClose={() => {}} />,
    );
    screen
      .getByRole("button", { name: /generate a batch from this theme/i })
      .click();

    expect(openSpy).toHaveBeenCalledOnce();
    const [rawUrl, target, features] = openSpy.mock.calls[0]!;
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");

    const url = new URL(rawUrl as string);
    expect(url.origin).toBe("https://resonance-client.example");
    expect(url.pathname).toBe("/recommendations");
    expect(url.searchParams.get("prompt")).toBe(
      'Generate recommendations anchored to my "Existential dread" theme — You gravitate toward stories about meaninglessness and the void. Recurring across your favorites.',
    );
  });

  it("omits the evidence clause when no theme evidence exists", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const profileNoEvidence: TasteProfile = {
      ...profile,
      themes: [{ label: "Existential dread", weight: 1, evidence: "" }],
    };
    render(
      <ClusterPanel
        cluster={cluster}
        profile={profileNoEvidence}
        onClose={() => {}}
      />,
    );
    screen
      .getByRole("button", { name: /generate a batch from this theme/i })
      .click();

    const url = new URL(openSpy.mock.calls[0]![0] as string);
    expect(url.searchParams.get("prompt")).toBe(
      'Generate recommendations anchored to my "Existential dread" theme.',
    );
  });
});
