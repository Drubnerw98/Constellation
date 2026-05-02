import { Link } from "react-router-dom";
import { SignInButton } from "@clerk/clerk-react";

/**
 * Signed-out landing for /. Hero copy + dual CTAs (sign-in opens the Clerk
 * modal, view-demo routes to /demo). Decorative starfield bg sets the tone
 * without committing to the full canvas — keeps the load fast.
 */
export function Landing() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05060a] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 12% 20%, rgba(255,255,255,0.6) 50%, transparent 100%),
            radial-gradient(1px 1px at 80% 35%, rgba(255,255,255,0.45) 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 45% 70%, rgba(180,200,255,0.55) 50%, transparent 100%),
            radial-gradient(1px 1px at 65% 85%, rgba(255,255,255,0.4) 50%, transparent 100%),
            radial-gradient(1px 1px at 25% 55%, rgba(255,200,180,0.5) 50%, transparent 100%),
            radial-gradient(1px 1px at 92% 12%, rgba(255,255,255,0.45) 50%, transparent 100%),
            radial-gradient(1px 1px at 35% 8%, rgba(255,255,255,0.4) 50%, transparent 100%),
            radial-gradient(1.5px 1.5px at 70% 60%, rgba(220,200,255,0.5) 50%, transparent 100%),
            radial-gradient(1px 1px at 8% 88%, rgba(255,255,255,0.35) 50%, transparent 100%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center px-8 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
          Constellation
        </p>
        <h1 className="mt-3 text-5xl font-light leading-tight text-zinc-100 sm:text-6xl">
          Your taste,
          <br />
          <span className="text-zinc-400">mapped as a sky.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400">
          Constellation reads your Resonance profile — the themes you respond
          to, the archetypes you keep returning to — and renders them as a
          galaxy. Stars are titles you've engaged with. Clusters are the
          themes that pull them together.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm text-zinc-100 transition-colors hover:bg-white/10"
            >
              Sign in to see yours
            </button>
          </SignInButton>
          <Link
            to="/demo"
            className="rounded-full px-6 py-2.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            View demo →
          </Link>
        </div>
        <p className="mt-16 max-w-xl text-xs leading-relaxed text-zinc-600">
          Companion to Resonance, an AI recommendation engine that builds your
          taste profile from what you watch, read, and play.
        </p>
      </div>
    </div>
  );
}
