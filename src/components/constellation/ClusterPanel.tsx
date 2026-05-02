import { useState } from "react";
import type { ThemeCluster } from "../../types/graph";
import type { TasteProfile } from "../../types/profile";

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

  return (
    <aside
      className="pointer-events-auto absolute top-0 left-0 z-10 flex h-full w-[420px] flex-col bg-[var(--color-surface-solid)]/95 backdrop-blur-md transition-transform duration-300 ease-out"
      style={{
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        borderRight: "1px solid rgb(255 255 255 / 0.08)",
        boxShadow: shown
          ? `inset -2px 0 0 0 ${shown.color}`
          : "inset -2px 0 0 0 transparent",
      }}
      aria-hidden={!isOpen}
    >
      {shown && (
        <>
          <header className="flex items-start justify-between gap-3 border-b border-white/5 px-6 pt-6 pb-5">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                Theme
              </div>
              <h2
                className="mt-2 font-serif text-xl leading-snug italic"
                style={{ color: shown.color }}
              >
                {shown.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-1 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
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
              <section className="mb-7">
                <h3 className="mb-3 font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                  Evidence
                </h3>
                <p className="text-[13px] leading-relaxed text-zinc-300">
                  {theme.evidence}
                </p>
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
