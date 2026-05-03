import type { GraphNode } from "../../../types/graph";

function pointsFromCoords(coords: number[][]): string {
  return coords.map((p) => `${p[0]},${p[1]}`).join(" ");
}

function starPoints(count: number, outerR: number, innerR: number): string {
  const coords: number[][] = [];
  const total = count * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    coords.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return pointsFromCoords(coords);
}

/**
 * Per-format node glyph. All shapes are roughly equal in visual area so
 * differentiation reads as identity, not size. Drawn at origin (0,0); the
 * parent <g> handles positioning via transform.
 *
 *   movie  → circle (round, classic)
 *   tv     → triangle pointing up (bold geometric)
 *   anime  → hexagon (six-sided)
 *   game   → diamond (rotated square)
 *   manga  → 5-point star (the constellation primitive)
 *   book   → 4-point sparkle star (compass / burst)
 */
export function nodeGlyph(
  mediaType: GraphNode["mediaType"],
  r: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  const common = { fill, stroke, strokeWidth };
  switch (mediaType) {
    case "movie":
      return <circle cx={0} cy={0} r={r} {...common} />;
    case "tv": {
      const h = r * 1.2;
      const w = h * 0.866;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -h * 0.85],
            [w, h * 0.55],
            [-w, h * 0.55],
          ])}
          strokeLinejoin="round"
          {...common}
        />
      );
    }
    case "anime": {
      const h = r * 1.05;
      const w = h * 0.866;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -h],
            [w, -h * 0.5],
            [w, h * 0.5],
            [0, h],
            [-w, h * 0.5],
            [-w, -h * 0.5],
          ])}
          {...common}
        />
      );
    }
    case "game": {
      const d = r * 1.2;
      return (
        <polygon
          points={pointsFromCoords([
            [0, -d],
            [d, 0],
            [0, d],
            [-d, 0],
          ])}
          {...common}
        />
      );
    }
    case "manga":
      return (
        <polygon
          points={starPoints(5, r * 1.25, r * 0.5)}
          strokeLinejoin="round"
          {...common}
        />
      );
    case "book":
      return (
        <polygon
          points={starPoints(4, r * 1.3, r * 0.42)}
          strokeLinejoin="round"
          {...common}
        />
      );
  }
}
