import { useMemo } from "react";
import type { GraphNode, ThemeCluster } from "../../../types/graph";
import type { Avoidance } from "../../../types/profile";

// Canvas dimensions in viewBox units. The constellation lives within
// [0..CANVAS_W] × [0..CANVAS_H]. SVG scales the whole viewBox to the
// container's actual pixel size.
export const CANVAS_W = 1200;
export const CANVAS_H = 800;
export const NODE_RADIUS = 6;

// Extended bounds for the background starfield + nebulae. At minimum
// zoom (0.6×) the viewport sees roughly 2× the canvas in each dimension.
// The starfield + nebulae are generated across this larger box so the
// background always covers what the user can see — no awkward black void
// past the cluster orbit.
export const BG_X_MIN = -CANVAS_W * 0.6;
export const BG_X_MAX = CANVAS_W * 1.6;
export const BG_Y_MIN = -CANVAS_H * 0.6;
export const BG_Y_MAX = CANVAS_H * 1.6;
export const BG_X_RANGE = BG_X_MAX - BG_X_MIN;
export const BG_Y_RANGE = BG_Y_MAX - BG_Y_MIN;

// Star fill palette — mostly white with a sprinkle of warm/cool tints.
// Uniform white reads as a UI dot pattern; a handful of off-whites breaks
// the uniformity without overcommitting to color.
export const STAR_FILLS = [
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#e9ecf2",
  "#fde6c8", // warm
  "#fcd7b2", // warm
  "#d4def8", // cool
  "#cbd6f5", // cool
];

export interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  fill: string;
}

/**
 * Three-layer seeded starfield: distant tiny stars (densest, dimmest),
 * a midfield, and a sprinkle of brighter "anchor" stars. Multiple layers
 * at different sizes give a parallax/dimensional feel rather than a single
 * uniform scatter. Generated across the extended background bounds.
 */
export function seededStars(
  distantCount: number,
  midCount: number,
  anchorCount: number,
): Star[] {
  const out: Star[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  const pickFill = () =>
    STAR_FILLS[Math.floor(rand() * STAR_FILLS.length)] ?? "#e9ecf2";
  const x = () => BG_X_MIN + rand() * BG_X_RANGE;
  const y = () => BG_Y_MIN + rand() * BG_Y_RANGE;
  for (let i = 0; i < distantCount; i++) {
    out.push({
      x: x(),
      y: y(),
      r: 0.3 + rand() * 0.5,
      o: 0.12 + rand() * 0.2,
      fill: pickFill(),
    });
  }
  for (let i = 0; i < midCount; i++) {
    out.push({
      x: x(),
      y: y(),
      r: 0.5 + rand() * 0.9,
      o: 0.22 + rand() * 0.4,
      fill: pickFill(),
    });
  }
  for (let i = 0; i < anchorCount; i++) {
    out.push({
      x: x(),
      y: y(),
      r: 1.6 + rand() * 1.0,
      o: 0.6 + rand() * 0.3,
      fill: pickFill(),
    });
  }
  return out;
}

/** Theme cluster lookup by primary-theme label. */
export function primaryClusterFor(
  d: GraphNode,
  byLabel: Map<string, ThemeCluster>,
): ThemeCluster | null {
  if (!d.primaryTheme) return null;
  return byLabel.get(d.primaryTheme) ?? null;
}

/**
 * Split a long cluster label into at most two lines, breaking at the word
 * boundary closest to the midpoint character count.
 */
export function wrapClusterLabel(label: string): string[] {
  if (label.length <= 22) return [label];
  const words = label.split(" ");
  if (words.length <= 1) return [label];
  const mid = label.length / 2;
  let bestIdx = 1;
  let bestDist = Infinity;
  let cum = 0;
  for (let i = 0; i < words.length - 1; i++) {
    cum += words[i]!.length + 1;
    const d = Math.abs(cum - mid);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i + 1;
    }
  }
  return [words.slice(0, bestIdx).join(" "), words.slice(bestIdx).join(" ")];
}

/**
 * Subtle visual hierarchy: scale node size by quality signal. Highly-rated
 * library items + high-matchScore recs sit slightly larger than baseline.
 * Range is ~0.85x to 1.2x — felt, not announced.
 */
export function nodeSizeMultiplier(n: GraphNode): number {
  if (n.source === "library") {
    if (n.rating != null) return 0.85 + (n.rating / 5) * 0.35;
    return 1.0;
  }
  if (n.matchScore != null) return 0.85 + n.matchScore * 0.35;
  return 1.0;
}

/**
 * Compute deterministic positions for disliked-title anti-stars. Distributed
 * roughly evenly around a perimeter ring with seeded jitter so the same
 * disliked set always lays out the same way. Skips pattern avoidances —
 * those are abstract and would need a different surface.
 */
export function useAntiStars(
  avoidances: Avoidance[],
): { title: string; x: number; y: number }[] {
  return useMemo(() => {
    const titles = avoidances
      .filter((a) => a.kind === "title")
      .map((a) => a.description);
    if (titles.length === 0) return [];
    let seed = 7919;
    for (const t of titles)
      for (let i = 0; i < t.length; i++) {
        seed = ((seed * 31) ^ t.charCodeAt(i)) | 0;
      }
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) | 0;
      return ((seed >>> 0) % 1_000_000) / 1_000_000;
    };
    const baseR = Math.min(CANVAS_W, CANVAS_H) * 0.46;
    const margin = 40;
    return titles.map((title, i) => {
      const evenAngle = (i / titles.length) * Math.PI * 2 - Math.PI / 4;
      const jitter = (rand() - 0.5) * (Math.PI / titles.length) * 0.7;
      const angle = evenAngle + jitter;
      const r = baseR + (rand() - 0.5) * 40;
      let x = CANVAS_W / 2 + Math.cos(angle) * r;
      let y = CANVAS_H / 2 + Math.sin(angle) * r;
      x = Math.max(margin, Math.min(CANVAS_W - margin, x));
      y = Math.max(margin, Math.min(CANVAS_H - margin, y));
      return { title, x, y };
    });
  }, [avoidances]);
}
