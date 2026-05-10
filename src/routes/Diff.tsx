import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { UserButton, useAuth } from "@clerk/clerk-react";
import { SiteMark } from "../components/SiteMark";
import { DiffCanvas } from "../components/constellation/DiffCanvas";
import {
  ApiError,
  fetchVersionExport,
  fetchVersions,
  type ProfileVersion,
} from "../lib/api";
import { buildDiffGraph, type DiffGraph } from "../lib/diffGraph";

type State =
  | { kind: "loading-versions" }
  | { kind: "single-version" }
  | {
      kind: "loading-exports";
      versions: ProfileVersion[];
      fromId: ProfileVersion["id"];
      toId: ProfileVersion["id"];
    }
  | {
      kind: "ready";
      versions: ProfileVersion[];
      fromId: ProfileVersion["id"];
      toId: ProfileVersion["id"];
      diff: DiffGraph;
    }
  | { kind: "error"; message: string };

/** Format an ISO date for the picker. Compact (mar 3, 2024) so two pickers
 * fit a desktop header without truncation. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function triggerBadge(trigger: ProfileVersion["trigger"]): string {
  switch (trigger) {
    case "onboarding":
      return "onboarding";
    case "feedback_batch":
      return "refined from feedback";
    case "manual_edit":
      return "manual edit";
  }
}

/**
 * Animated diff between two profile versions. Pulls the user's version list,
 * defaults to the latest two, fetches their exports, builds a diff graph,
 * and renders an animated layout morph driven by a scrub slider.
 *
 * Single-version users get a friendly empty state — diff has nothing to
 * show. Mobile users get a "compare on a larger screen" hint; the slider
 * + canvas combo isn't usable at narrow widths and the architecture is
 * desktop-first.
 */
export function Diff() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [state, setState] = useState<State>({ kind: "loading-versions" });
  const [scrub, setScrub] = useState(1); // start at "to" — newest layout.

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Fetch the version list on mount.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const versions = await fetchVersions(token);
        if (cancelled) return;
        // Sort by createdAt desc — most recent first. The API claims this
        // ordering but defense-in-depth: sort here too.
        const sorted = [...versions].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        if (sorted.length < 2) {
          setState({ kind: "single-version" });
          return;
        }
        // Default: from = second-newest (N-1), to = newest (N).
        const toV = sorted[0]!;
        const fromV = sorted[1]!;
        setState({
          kind: "loading-exports",
          versions: sorted,
          fromId: fromV.id,
          toId: toV.id,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setState({ kind: "error", message: err.message });
        } else {
          setState({ kind: "error", message: "Resonance is unreachable" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  // Fetch the two exports whenever fromId/toId in state are present. We
  // key the effect on the ids so changing a picker selection re-fetches.
  const fromId =
    state.kind === "loading-exports" || state.kind === "ready"
      ? state.fromId
      : null;
  const toId =
    state.kind === "loading-exports" || state.kind === "ready"
      ? state.toId
      : null;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (fromId === null || toId === null) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        // Parallel fetch — Promise.all is fine here because if either
        // version is unavailable the diff can't render anyway, so one
        // failure should fail the pair. We catch + surface 404 as a
        // friendly "Version unavailable" message in the error branch.
        const [fromExp, toExp] = await Promise.all([
          fetchVersionExport(token, fromId),
          fetchVersionExport(token, toId),
        ]);
        if (cancelled) return;
        const diff = buildDiffGraph(fromExp, toExp);
        // Reset scrub each time the diff input changes so the user sees
        // the entry animation from 0 → 1.
        setScrub(0);
        setState((prev) => {
          if (prev.kind !== "loading-exports" && prev.kind !== "ready")
            return prev;
          return {
            kind: "ready",
            versions: prev.versions,
            fromId,
            toId,
            diff,
          };
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError && err.status === 404
            ? "Version unavailable — it may have been deleted."
            : err instanceof ApiError
              ? err.message
              : "Resonance is unreachable";
        setState({ kind: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, toId, isLoaded, isSignedIn]);

  // Drive the auto-play from 0 → 1 once the diff lands. The user can
  // grab the slider at any time and override.
  useEffect(() => {
    if (state.kind !== "ready") return;
    if (prefersReducedMotion) {
      // Snap to final state on entry under reduced motion. The lint rule
      // guards against cascading renders but this is the intentional
      // "skip the animation" branch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrub(1);
      return;
    }
    // Idempotent autoplay: only triggers on entry to "ready" — restart
    // via the From/To buttons or re-selecting versions.
    let raf = 0;
    let start: number | null = null;
    const DURATION_MS = 2400;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start;
      const next = Math.min(1, elapsed / DURATION_MS);
      setScrub(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.kind, prefersReducedMotion]);

  const handleSelect = useCallback(
    (which: "from" | "to", id: ProfileVersion["id"]) => {
      setState((prev) => {
        if (prev.kind !== "ready" && prev.kind !== "loading-exports")
          return prev;
        const nextFromId = which === "from" ? id : prev.fromId;
        const nextToId = which === "to" ? id : prev.toId;
        // Guard: don't allow picking the same version on both sides — the
        // diff would be empty. Snap the other side to a different version
        // if collision detected.
        if (nextFromId === nextToId) {
          const other = prev.versions.find((v) => v.id !== id);
          if (!other) return prev;
          return {
            kind: "loading-exports",
            versions: prev.versions,
            fromId: which === "from" ? id : other.id,
            toId: which === "to" ? id : other.id,
          };
        }
        return {
          kind: "loading-exports",
          versions: prev.versions,
          fromId: nextFromId,
          toId: nextToId,
        };
      });
    },
    [],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060a] text-white">
      <DiffSurface
        state={state}
        scrub={scrub}
        onScrubChange={setScrub}
        prefersReducedMotion={prefersReducedMotion}
        onSelectVersion={handleSelect}
      />

      <div className="pointer-events-none absolute top-4 right-4 z-10 flex items-center gap-3">
        <SiteMark />
        <div className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 p-1 backdrop-blur-md">
          <UserButton
            appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute top-4 left-4 z-10">
        <Link
          to="/"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#0b0f1a]/85 px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-zinc-400 uppercase backdrop-blur-md transition-colors hover:text-zinc-100"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          <span>Back to constellation</span>
        </Link>
      </div>
    </div>
  );
}

interface DiffSurfaceProps {
  state: State;
  scrub: number;
  onScrubChange: (v: number) => void;
  prefersReducedMotion: boolean;
  onSelectVersion: (which: "from" | "to", id: ProfileVersion["id"]) => void;
}

function DiffSurface({
  state,
  scrub,
  onScrubChange,
  prefersReducedMotion,
  onSelectVersion,
}: DiffSurfaceProps) {
  if (state.kind === "loading-versions") {
    return <CenteredCaption text="Loading versions…" />;
  }
  if (state.kind === "single-version") {
    return (
      <CenteredCaption text="Profile has only one version — diff appears once you've had at least one refinement." />
    );
  }
  if (state.kind === "error") {
    return <CenteredCaption text={state.message} tone="error" />;
  }

  // loading-exports + ready both share the picker chrome. Only ready
  // renders the canvas + slider.
  const fromVersion = state.versions.find((v) => v.id === state.fromId);
  const toVersion = state.versions.find((v) => v.id === state.toId);

  return (
    <>
      {/* Mobile fallback. The diff canvas + slider is desktop-first; below
          768px we hide the canvas and surface a hint instead. */}
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05060a] px-8 text-center md:hidden">
        <div className="max-w-xs">
          <p className="font-mono text-[10px] tracking-[0.28em] text-zinc-500 uppercase">
            Constellation · Diff
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-zinc-300">
            The version diff is a desktop experience.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
            Open this on a larger screen to compare your profile across
            refinements.
          </p>
        </div>
      </div>

      {/* Desktop canvas + chrome */}
      <div className="absolute inset-0 hidden md:block">
        {state.kind === "ready" && (
          <DiffCanvas
            diff={state.diff}
            scrub={scrub}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
        {state.kind === "loading-exports" && (
          <CenteredCaption text="Loading versions…" />
        )}

        {/* Version pickers — top center */}
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-stretch gap-2 rounded-md border border-white/10 bg-[#0b0f1a]/85 px-2 py-1.5 backdrop-blur-md">
            <VersionPicker
              label="From"
              versions={state.versions}
              selected={fromVersion}
              disabledId={state.toId}
              onSelect={(id) => onSelectVersion("from", id)}
            />
            <div className="self-center font-mono text-[10px] tracking-[0.22em] text-zinc-600 uppercase">
              →
            </div>
            <VersionPicker
              label="To"
              versions={state.versions}
              selected={toVersion}
              disabledId={state.fromId}
              onSelect={(id) => onSelectVersion("to", id)}
            />
          </div>
        </div>

        {/* Scrub control — bottom center */}
        {state.kind === "ready" && (
          <ScrubControl
            scrub={scrub}
            onChange={onScrubChange}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </div>
    </>
  );
}

interface VersionPickerProps {
  label: string;
  versions: ProfileVersion[];
  selected: ProfileVersion | undefined;
  disabledId: ProfileVersion["id"];
  onSelect: (id: ProfileVersion["id"]) => void;
}

function VersionPicker({
  label,
  versions,
  selected,
  disabledId,
  onSelect,
}: VersionPickerProps) {
  return (
    <label className="flex items-center gap-2 rounded-sm px-2 py-1">
      <span className="font-mono text-[10px] tracking-[0.22em] text-zinc-500 uppercase">
        {label}
      </span>
      <select
        value={selected ? String(selected.id) : ""}
        onChange={(e) => {
          // Resonance ids are number | string; preserve type when round-tripping.
          const raw = e.target.value;
          const found = versions.find((v) => String(v.id) === raw);
          if (found) onSelect(found.id);
        }}
        className="cursor-pointer rounded-sm border border-white/10 bg-transparent px-2 py-1 text-[12px] text-zinc-200 outline-none focus:border-white/30"
      >
        {versions.map((v) => (
          <option
            key={String(v.id)}
            value={String(v.id)}
            disabled={v.id === disabledId}
            className="bg-[#0b0f1a]"
          >
            {fmtDate(v.createdAt)} — {triggerBadge(v.trigger)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ScrubControlProps {
  scrub: number;
  onChange: (v: number) => void;
  prefersReducedMotion: boolean;
}

/** Bottom-center scrub. Under prefers-reduced-motion the slider is hidden
 * in favor of From / To snap buttons — same code path drives the canvas,
 * just discrete instead of continuous. */
function ScrubControl({
  scrub,
  onChange,
  prefersReducedMotion,
}: ScrubControlProps) {
  if (prefersReducedMotion) {
    return (
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0f1a]/85 px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => onChange(0)}
            className={`cursor-pointer rounded-sm px-3 py-1 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors ${
              scrub === 0
                ? "text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-pressed={scrub === 0}
          >
            From
          </button>
          <button
            type="button"
            onClick={() => onChange(1)}
            className={`cursor-pointer rounded-sm px-3 py-1 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors ${
              scrub === 1
                ? "text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-pressed={scrub === 1}
          >
            To
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-[min(640px,90vw)] -translate-x-1/2">
      <div className="pointer-events-auto rounded-full border border-white/10 bg-[#0b0f1a]/85 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.22em] text-zinc-500 uppercase">
            From
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={scrub}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-zinc-200"
            aria-label="Scrub between profile versions"
          />
          <span className="font-mono text-[10px] tracking-[0.22em] text-zinc-500 uppercase">
            To
          </span>
        </div>
      </div>
    </div>
  );
}

function CenteredCaption({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center px-8">
      <div
        className={`max-w-md text-center text-[13px] leading-relaxed ${
          tone === "error" ? "text-rose-200/85" : "text-zinc-400"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
