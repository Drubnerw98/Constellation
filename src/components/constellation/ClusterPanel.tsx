import { useState } from "react";
import type { ThemeCluster } from "../../types/graph";
import type { TasteProfile, TitleRef } from "../../types/profile";
import {
  buildResonancePrompt,
  buildResonanceRecommendationsUrl,
} from "../../lib/resonanceLink";

const FORMAT_GLYPH: Record<string, string> = {
  movie: "▶",
  tv: "■",
  anime: "★",
  manga: "❒",
  game: "◆",
  book: "❡",
};

function TitleChip({
  ref_,
  tone,
  accent,
}: {
  ref_: TitleRef;
  tone: "anchor" | "reinforce";
  accent: string;
}) {
  return (
    <li
      className={
        tone === "anchor"
          ? "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] text-zinc-200"
          : "inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-0.5 text-[11px] text-zinc-400"
      }
      style={
        tone === "anchor"
          ? { borderColor: `${accent}66`, backgroundColor: `${accent}10` }
          : undefined
      }
    >
      <span aria-hidden className="text-[10px] opacity-70">
        {FORMAT_GLYPH[ref_.mediaType] ?? "•"}
      </span>
      <span>{ref_.title}</span>
    </li>
  );
}

interface Props {
  cluster: ThemeCluster | null;
  profile: TasteProfile;
  onClose: () => void;
}

/**
 * Cluster info panel — slides in from the left when galaxy mode is active.
 * Surfaces the theme's AI-generated `evidence` text — the right level of
 * granularity for "why does this cluster exist in your profile."
 */
export function ClusterPanel({ cluster, profile, onClose }: Props) {
  const [displayCluster, setDisplayCluster] = useState<ThemeCluster | null>(
    cluster,
  );
  if (cluster !== null && cluster.label !== displayCluster?.label) {
    setDisplayCluster(cluster);
  }

  const isOpen = cluster !== null;
  const shown = displayCluster;
  const theme = shown
    ? profile.themes.find((t) => t.label === shown.label)
    : null;

  // Mobile: bottom sheet. md+: slide from left. ClusterPanel sits at
  // z-10; DetailPanel at z-20 so on mobile, opening a node detail
  // covers the cluster sheet (most-recent-action wins).
  const transformClasses = isOpen
    ? "translate-y-0 md:translate-x-0"
    : "translate-y-full md:translate-y-0 md:-translate-x-full";

  return (
    <aside
      className={`pointer-events-auto absolute right-0 bottom-0 left-0 z-10 flex max-h-[82vh] flex-col rounded-t-xl bg-[var(--color-surface-solid)]/95 backdrop-blur-md transition-transform duration-300 ease-out md:top-0 md:right-auto md:bottom-auto md:h-full md:max-h-none md:w-[420px] md:rounded-none ${transformClasses}`}
      style={{
        borderTop: "1px solid rgb(255 255 255 / 0.08)",
        borderRight: "1px solid rgb(255 255 255 / 0.08)",
        boxShadow: shown
          ? `inset 0 2px 0 0 ${shown.color}, inset -2px 0 0 0 ${shown.color}`
          : "inset 0 2px 0 0 transparent",
      }}
      aria-hidden={!isOpen}
    >
      {shown && (
        <>
          <header className="flex items-start justify-between gap-3 border-b border-white/5 px-6 pt-6 pb-5">
            <div key={`title-${shown.label}`} className="panel-rise min-w-0">
              <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                Theme
              </div>
              <h2
                className="mt-2 font-serif text-2xl leading-snug italic"
                style={{ color: shown.color }}
              >
                {shown.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="-mt-2 -mr-2 cursor-pointer rounded p-3 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="Exit galaxy mode"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-zinc-300">
            {theme && (
              // Key by label so the content remounts and the staggered
              // panel-rise animation re-fires when the user switches to a
              // different cluster.
              <section key={shown.label} className="mb-7 space-y-4">
                {(() => {
                  const summary = theme.summary && theme.summary.trim()
                    ? theme.summary
                    : theme.evidence ?? "";
                  const anchors = theme.anchors ?? [];
                  const reinforcedBy = theme.reinforcedBy ?? [];
                  return (
                    <>
                      {summary && (
                        <p
                          className="panel-rise text-[14px] leading-relaxed text-zinc-200"
                          style={{ animationDelay: "60ms" }}
                        >
                          {summary}
                        </p>
                      )}
                      {anchors.length > 0 && (
                        <div
                          className="panel-rise"
                          style={{ animationDelay: "160ms" }}
                        >
                          <h3 className="mb-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                            Anchored in
                          </h3>
                          <ul className="flex flex-wrap gap-1.5">
                            {anchors.map((a, i) => (
                              <TitleChip
                                key={`a-${i}`}
                                ref_={a}
                                tone="anchor"
                                accent={shown.color}
                              />
                            ))}
                          </ul>
                        </div>
                      )}
                      {reinforcedBy.length > 0 && (
                        <div
                          className="panel-rise"
                          style={{ animationDelay: "260ms" }}
                        >
                          <h3 className="mb-2 font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                            Reinforced by
                          </h3>
                          <ul className="flex flex-wrap gap-1.5">
                            {reinforcedBy.map((r, i) => (
                              <TitleChip
                                key={`r-${i}`}
                                ref_={r}
                                tone="reinforce"
                                accent={shown.color}
                              />
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>
            )}
          </div>

          <footer className="border-t border-white/5 px-6 py-5">
            <button
              type="button"
              onClick={() => {
                const prompt = buildResonancePrompt(shown.label, theme);
                const url = buildResonanceRecommendationsUrl(prompt);
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="group flex w-full cursor-pointer items-center justify-between rounded-md border border-white/10 px-4 py-3 text-left transition-colors hover:border-white/25 hover:bg-white/[0.04]"
              style={{ borderLeft: `2px solid ${shown.color}` }}
            >
              <span className="font-serif text-[14px] text-zinc-100 italic">
                Generate a batch from this theme
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase transition-colors group-hover:text-zinc-300">
                Resonance →
              </span>
            </button>
          </footer>
        </>
      )}
    </aside>
  );
}
