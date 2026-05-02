import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/clerk-react";
import { SiteMark } from "../components/SiteMark";

/**
 * Signed-out landing for /. Editorial hero with a decorative constellation
 * glyph echoing the in-canvas star chart aesthetic. Same typography
 * vocabulary as the panels — mono captions, serif italic accents, sans
 * body — so the brand identity carries through from /landing → /demo →
 * signed-in app.
 */
export function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--color-bg)] text-zinc-100">
      <Backdrop />

      <div className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-3">
        <SiteMark />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8 py-20 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="font-mono text-[11px] tracking-[0.28em] text-zinc-500 uppercase">
              Constellation · Taste Atlas
            </p>

            <h1 className="mt-6 font-serif text-5xl leading-[1.05] font-light text-zinc-100 italic sm:text-6xl lg:text-7xl">
              The shape
              <br />
              of your taste,
              <br />
              <span className="text-zinc-400">mapped as a sky.</span>
            </h1>

            <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-zinc-400">
              Constellation reads your Resonance profile — the themes you
              respond to, the archetypes you keep returning to — and renders
              them as a galaxy. Stars are titles you've engaged with. Clusters
              are the themes that pull them together.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-5">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-6 py-3 text-[13px] font-medium tracking-wide text-zinc-900 transition-colors hover:bg-white"
                >
                  <span>Sign in to see yours</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden
                    className="translate-x-0 transition-transform group-hover:translate-x-0.5"
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
              </SignInButton>
              <Link
                to="/demo"
                className="group inline-flex cursor-pointer items-center gap-2 px-1 font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase transition-colors hover:text-zinc-100"
              >
                <span>View demo</span>
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>

            <div className="mt-20 max-w-md border-l border-white/10 pl-5">
              <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-600 uppercase">
                Companion to
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
                <span className="text-zinc-300">Resonance</span> — an AI
                recommendation engine that builds your taste profile from what
                you watch, read, and play.
              </p>
            </div>
          </div>

          <HeroGlyph />
        </div>
      </main>
    </div>
  );
}

/** Deep starfield + soft nebula gradients for hero atmosphere. Tighter than
 * the canvas's full cosmos — this is set dressing, not the constellation
 * itself. */
function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 8% 12%, rgba(255,255,255,0.55) 50%, transparent 100%),
            radial-gradient(1px 1px at 16% 78%, rgba(220,220,255,0.45) 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 38% 22%, rgba(255,230,200,0.5) 50%, transparent 100%),
            radial-gradient(1px 1px at 48% 64%, rgba(255,255,255,0.55) 50%, transparent 100%),
            radial-gradient(1px 1px at 62% 18%, rgba(200,210,255,0.5) 50%, transparent 100%),
            radial-gradient(1px 1px at 72% 82%, rgba(255,255,255,0.4) 50%, transparent 100%),
            radial-gradient(1px 1px at 84% 36%, rgba(255,220,200,0.5) 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 92% 76%, rgba(255,255,255,0.45) 50%, transparent 100%),
            radial-gradient(1px 1px at 30% 50%, rgba(255,255,255,0.35) 50%, transparent 100%),
            radial-gradient(1px 1px at 56% 92%, rgba(220,200,255,0.45) 50%, transparent 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 30% 40%, rgba(80,90,160,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(140,80,160,0.08) 0%, transparent 60%)",
        }}
      />
    </>
  );
}

/** Hero glyph — scaled-up version of the same 5-star asterism used in
 * the favicon + SiteMark, with halos + the cross-flare on the anchor
 * star explicit at this size. Brand identity is consistent across
 * tab → corner → hero. */
function HeroGlyph() {
  // Same canonical layout as the favicon (32×32 viewBox), scaled into
  // a 320×320 hero canvas. Points 0–4 trace the W. Anchor (point 2) is
  // the brightest with a visible cross-flare and a wider halo.
  const points: { x: number; y: number; r: number; halo: number }[] = [
    { x: 40, y: 220, r: 4, halo: 0.5 },
    { x: 100, y: 90, r: 6, halo: 0.7 },
    { x: 160, y: 180, r: 9, halo: 1.0 },
    { x: 220, y: 80, r: 6, halo: 0.7 },
    { x: 280, y: 210, r: 4, halo: 0.5 },
  ];
  const lines: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
  ];
  const anchor = points[2]!;
  return (
    <div className="relative hidden aspect-square w-full max-w-md self-center lg:block">
      <svg
        viewBox="0 0 320 320"
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity={0.55} />
            <stop offset="60%" stopColor="#fef3c7" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="hero-anchor-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity={0.7} />
            <stop offset="50%" stopColor="#fef3c7" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* Anchor halo (drawn first, behind everything) */}
        <circle
          cx={anchor.x}
          cy={anchor.y}
          r={70}
          fill="url(#hero-anchor-halo)"
        />
        {/* Connecting lines */}
        {lines.map(([a, b], i) => {
          const pa = points[a]!;
          const pb = points[b]!;
          return (
            <line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="#fef3c7"
              strokeOpacity={0.32}
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}
        {/* Anchor cross-flare — visible at hero size */}
        <line
          x1={anchor.x - 60}
          y1={anchor.y}
          x2={anchor.x + 60}
          y2={anchor.y}
          stroke="#fef3c7"
          strokeOpacity={0.4}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
        <line
          x1={anchor.x}
          y1={anchor.y - 50}
          x2={anchor.x}
          y2={anchor.y + 50}
          stroke="#fef3c7"
          strokeOpacity={0.4}
          strokeWidth={0.6}
          strokeLinecap="round"
        />
        {/* Star halos + bodies */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r * 5}
              fill="url(#hero-halo)"
              opacity={p.halo}
            />
            <circle cx={p.x} cy={p.y} r={p.r} fill="#fef3c7" />
          </g>
        ))}
      </svg>
    </div>
  );
}
