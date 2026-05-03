import type { ThemeCluster } from "../../../types/graph";
import { CANVAS_H, CANVAS_W, type Star } from "./helpers";

/**
 * SVG `<defs>` block: per-cluster radial gradients (referenced by id from
 * the cluster glow circles), node halo + glow filters, and three nebula
 * gradients (deep blue, purple, warm) used by `<NebulaLayer>`.
 */
export function Defs({ clusters }: { clusters: ThemeCluster[] }) {
  return (
    <defs>
      {clusters.map((c, i) => (
        <radialGradient
          key={c.label}
          id={`cluster-grad-${i}`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor={c.color} stopOpacity={0.55} />
          <stop offset="35%" stopColor={c.color} stopOpacity={0.28} />
          <stop offset="70%" stopColor={c.color} stopOpacity={0.08} />
          <stop offset="100%" stopColor={c.color} stopOpacity={0} />
        </radialGradient>
      ))}
      <filter id="node-halo" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter
        id="node-glow-strong"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient id="nebula-deep-blue" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#3b4a8a" stopOpacity={0.18} />
        <stop offset="50%" stopColor="#3b4a8a" stopOpacity={0.06} />
        <stop offset="100%" stopColor="#3b4a8a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="nebula-purple" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#6b3a8a" stopOpacity={0.14} />
        <stop offset="50%" stopColor="#6b3a8a" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#6b3a8a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="nebula-warm" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#8a5a3b" stopOpacity={0.1} />
        <stop offset="50%" stopColor="#8a5a3b" stopOpacity={0.04} />
        <stop offset="100%" stopColor="#8a5a3b" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}

/**
 * Soft nebula gradient blobs distributed across the extended background
 * bounds. Three in-bounds (cool blue + purple + warm) sit behind the
 * constellation; four out-of-bounds extend the cosmos past the viewBox so
 * users zoomed out still see colored space, not a black void.
 */
export function NebulaLayer({
  starfieldLit,
  prefersReducedMotion,
}: {
  starfieldLit: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <g
      className="nebula"
      opacity={starfieldLit ? 1 : 0}
      style={{
        transition: prefersReducedMotion ? "none" : "opacity 1800ms ease-out",
      }}
    >
      <ellipse
        cx={CANVAS_W * 0.18}
        cy={CANVAS_H * 0.22}
        rx={CANVAS_W * 0.42}
        ry={CANVAS_H * 0.5}
        fill="url(#nebula-deep-blue)"
      />
      <ellipse
        cx={CANVAS_W * 0.85}
        cy={CANVAS_H * 0.78}
        rx={CANVAS_W * 0.38}
        ry={CANVAS_H * 0.45}
        fill="url(#nebula-purple)"
      />
      <ellipse
        cx={CANVAS_W * 0.75}
        cy={CANVAS_H * 0.18}
        rx={CANVAS_W * 0.32}
        ry={CANVAS_H * 0.4}
        fill="url(#nebula-warm)"
      />
      <ellipse
        cx={-CANVAS_W * 0.25}
        cy={CANVAS_H * 0.55}
        rx={CANVAS_W * 0.5}
        ry={CANVAS_H * 0.6}
        fill="url(#nebula-purple)"
      />
      <ellipse
        cx={CANVAS_W * 1.3}
        cy={CANVAS_H * 0.35}
        rx={CANVAS_W * 0.5}
        ry={CANVAS_H * 0.55}
        fill="url(#nebula-deep-blue)"
      />
      <ellipse
        cx={CANVAS_W * 0.4}
        cy={-CANVAS_H * 0.3}
        rx={CANVAS_W * 0.55}
        ry={CANVAS_H * 0.45}
        fill="url(#nebula-warm)"
      />
      <ellipse
        cx={CANVAS_W * 0.6}
        cy={CANVAS_H * 1.35}
        rx={CANVAS_W * 0.6}
        ry={CANVAS_H * 0.5}
        fill="url(#nebula-deep-blue)"
      />
    </g>
  );
}

/** The brightest 8 anchor stars get cross-flares — thin radiating lines
 * that read as starlight diffraction. Limited to 8 for cost. */
export function StarFlares({
  flareStars,
  starfieldLit,
  prefersReducedMotion,
}: {
  flareStars: Star[];
  starfieldLit: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <g
      className="star-flares"
      opacity={starfieldLit ? 1 : 0}
      style={{
        transition: prefersReducedMotion ? "none" : "opacity 1800ms ease-out",
      }}
    >
      {flareStars.map((s, i) => {
        const len = s.r * 8;
        return (
          <g key={`flare-${i}`} opacity={0.5}>
            <line
              x1={s.x - len}
              y1={s.y}
              x2={s.x + len}
              y2={s.y}
              stroke={s.fill}
              strokeWidth={0.5}
            />
            <line
              x1={s.x}
              y1={s.y - len}
              x2={s.x}
              y2={s.y + len}
              stroke={s.fill}
              strokeWidth={0.5}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Three-layer starfield: distant + mid + anchor. Faded in via opacity
 * transition controlled by `starfieldLit`. */
export function Starfield({
  stars,
  starfieldLit,
  prefersReducedMotion,
}: {
  stars: Star[];
  starfieldLit: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <g
      className="starfield"
      opacity={starfieldLit ? 1 : 0}
      style={{
        transition: prefersReducedMotion ? "none" : "opacity 1400ms ease-out",
      }}
    >
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.fill}
          opacity={s.o}
        />
      ))}
    </g>
  );
}

/** Disliked titles as muted X marks around the canvas perimeter. Painted
 * between starfield and clusters so they read as negative space markers —
 * visible but secondary to the constellation. */
export function AntiStars({
  antiStars,
  starfieldLit,
  inGalaxyMode,
  prefersReducedMotion,
}: {
  antiStars: { title: string; x: number; y: number }[];
  starfieldLit: boolean;
  inGalaxyMode: boolean;
  prefersReducedMotion: boolean;
}) {
  if (antiStars.length === 0) return null;
  return (
    <g
      className="anti-stars"
      opacity={starfieldLit ? (inGalaxyMode ? 0.15 : 0.5) : 0}
      style={{
        transition: prefersReducedMotion ? "none" : "opacity 600ms ease",
      }}
    >
      {antiStars.map((a, i) => (
        <g key={i} transform={`translate(${a.x},${a.y})`}>
          <circle cx={0} cy={0} r={22} fill="transparent">
            <title>{`✗ ${a.title} — outside your taste`}</title>
          </circle>
          <line
            x1={-7}
            y1={-7}
            x2={7}
            y2={7}
            stroke="#a1a8b3"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <line
            x1={-7}
            y1={7}
            x2={7}
            y2={-7}
            stroke="#a1a8b3"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}
