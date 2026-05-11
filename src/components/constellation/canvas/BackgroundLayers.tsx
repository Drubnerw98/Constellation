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
      {/* Cosmic nebula palette — richened 2026-05-10 Phase 4. The originals
          were too muted to read through the cluster glows; these are more
          saturated and bumped opacities ~50% so the void between clusters
          actually has atmosphere. */}
      <radialGradient id="nebula-twilight" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#3a3aaa" stopOpacity={0.28} />
        <stop offset="50%" stopColor="#3a3aaa" stopOpacity={0.1} />
        <stop offset="100%" stopColor="#3a3aaa" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="nebula-aurora" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7a3aaa" stopOpacity={0.22} />
        <stop offset="50%" stopColor="#7a3aaa" stopOpacity={0.08} />
        <stop offset="100%" stopColor="#7a3aaa" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="nebula-teal" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#2a8a9a" stopOpacity={0.2} />
        <stop offset="50%" stopColor="#2a8a9a" stopOpacity={0.07} />
        <stop offset="100%" stopColor="#2a8a9a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="nebula-warm" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#9a6a3a" stopOpacity={0.16} />
        <stop offset="50%" stopColor="#9a6a3a" stopOpacity={0.06} />
        <stop offset="100%" stopColor="#9a6a3a" stopOpacity={0} />
      </radialGradient>
      {/* Vignette — radial darkening that pulls the eye inward toward the
          constellation. Transparent through the inner 45% so cluster glows
          aren't dimmed; ramps to 80% bg darkness at the corners. */}
      <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
        <stop offset="35%" stopColor="#05060a" stopOpacity={0} />
        <stop offset="75%" stopColor="#05060a" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#05060a" stopOpacity={0.8} />
      </radialGradient>
      {/* Label shadow — soft dark halo painted behind cluster labels so they
          punch through nodes when force-sim drifts a member on top of the
          label. Used in addition to the stroke. */}
      <filter
        id="label-shadow"
        x="-30%"
        y="-30%"
        width="160%"
        height="160%"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
        <feFlood floodColor="#05060a" floodOpacity="0.85" />
        <feComposite in2="SourceAlpha" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/**
 * Soft nebula gradient blobs distributed across the extended background
 * bounds. Four palettes (twilight indigo, aurora purple, cosmic teal,
 * warm amber) are distributed both in-bounds and beyond the viewBox so
 * the void between clusters has color atmosphere and users zoomed out
 * see colored space instead of pure black.
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
      {/* In-bounds blobs — these sit behind the visible constellation and
          provide direct atmospheric color between clusters. */}
      <ellipse
        cx={CANVAS_W * 0.18}
        cy={CANVAS_H * 0.22}
        rx={CANVAS_W * 0.42}
        ry={CANVAS_H * 0.5}
        fill="url(#nebula-twilight)"
      />
      <ellipse
        cx={CANVAS_W * 0.82}
        cy={CANVAS_H * 0.78}
        rx={CANVAS_W * 0.4}
        ry={CANVAS_H * 0.48}
        fill="url(#nebula-aurora)"
      />
      <ellipse
        cx={CANVAS_W * 0.75}
        cy={CANVAS_H * 0.18}
        rx={CANVAS_W * 0.32}
        ry={CANVAS_H * 0.4}
        fill="url(#nebula-warm)"
      />
      <ellipse
        cx={CANVAS_W * 0.5}
        cy={CANVAS_H * 0.55}
        rx={CANVAS_W * 0.35}
        ry={CANVAS_H * 0.42}
        fill="url(#nebula-teal)"
      />
      <ellipse
        cx={CANVAS_W * 0.3}
        cy={CANVAS_H * 0.75}
        rx={CANVAS_W * 0.28}
        ry={CANVAS_H * 0.36}
        fill="url(#nebula-aurora)"
      />
      {/* Out-of-bounds blobs — extend the cosmos so panning/zooming-out
          reveals more color rather than empty black. */}
      <ellipse
        cx={-CANVAS_W * 0.25}
        cy={CANVAS_H * 0.55}
        rx={CANVAS_W * 0.5}
        ry={CANVAS_H * 0.6}
        fill="url(#nebula-aurora)"
      />
      <ellipse
        cx={CANVAS_W * 1.3}
        cy={CANVAS_H * 0.35}
        rx={CANVAS_W * 0.5}
        ry={CANVAS_H * 0.55}
        fill="url(#nebula-twilight)"
      />
      <ellipse
        cx={CANVAS_W * 1.25}
        cy={CANVAS_H * 0.9}
        rx={CANVAS_W * 0.42}
        ry={CANVAS_H * 0.5}
        fill="url(#nebula-teal)"
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
        fill="url(#nebula-twilight)"
      />
    </g>
  );
}

/**
 * Edge-darkening vignette that pulls the eye toward the constellation.
 * Rendered outside the zoom-layer in the SVG so it stays anchored to the
 * viewport regardless of pan/zoom level — corner darkness reads as "we're
 * looking through a porthole", which deepens the cosmic feel.
 */
export function Vignette() {
  return (
    <rect
      x={0}
      y={0}
      width={CANVAS_W}
      height={CANVAS_H}
      fill="url(#vignette)"
      pointerEvents="none"
    />
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
        // Flares get a more visible breath — they're the bright stars
        // that anchor the visual hierarchy of the field. Slower cycle
        // than the dim starfield to read as deliberate, not flickering.
        const delay = `${(i * 211) % 6000}ms`;
        const duration = `${7000 + ((i * 419) % 4000)}ms`;
        return (
          <g
            key={`flare-${i}`}
            className={prefersReducedMotion ? "" : "flare-breath"}
            style={
              prefersReducedMotion
                ? { opacity: 0.5 }
                : ({
                    animationDelay: delay,
                    animationDuration: duration,
                    opacity: 0.5,
                  } as React.CSSProperties)
            }
          >
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
      {stars.map((s, i) => {
        // Each star gets a pseudo-random phase + speed so they don't pulse
        // in lockstep. The animation breathes opacity between 75% and 100%
        // of the star's base opacity — dim stars breathe imperceptibly,
        // bright stars get a visible shimmer. Scaled by base opacity via
        // the --star-base CSS var.
        const delay = `${(i * 137) % 5000}ms`;
        const duration = `${5000 + ((i * 311) % 3000)}ms`;
        return (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={s.fill}
            className={prefersReducedMotion ? "" : "star-breath"}
            style={
              prefersReducedMotion
                ? { opacity: s.o }
                : ({
                    "--star-base": s.o,
                    animationDelay: delay,
                    animationDuration: duration,
                    opacity: s.o,
                  } as React.CSSProperties)
            }
          />
        );
      })}
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
