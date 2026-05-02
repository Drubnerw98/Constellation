import { useState } from "react";
import type { ThemeCluster } from "../../types/graph";
import type { TasteProfile } from "../../types/profile";

interface Props {
  cluster: ThemeCluster | null;
  profile: TasteProfile;
  onClose: () => void;
}

/**
 * Cluster info panel — slides in from the left when galaxy mode is active
 * (i.e., when a cluster has been focused via label click or zoom-in).
 *
 * Surfaces the theme's AI-generated `evidence` text — the right level of
 * granularity for "why does this cluster exist in your profile." This
 * replaces the per-item "Why this fits" surface that only existed for
 * ~20% of items; theme evidence exists for every cluster, so rendering
 * is consistent.
 */
export function ClusterPanel({ cluster, profile, onClose }: Props) {
  // Keep the last non-null cluster so the panel can finish its slide-out
  // animation after the focus is cleared. Same pattern as DetailPanel.
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
      className="pointer-events-auto absolute top-0 left-0 z-10 flex h-full w-[400px] flex-col border-r border-white/10 bg-[#0a0d18]/95 backdrop-blur-md transition-transform duration-300 ease-out"
      style={{ transform: isOpen ? "translateX(0)" : "translateX(-100%)" }}
      aria-hidden={!isOpen}
    >
      {shown && (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Theme
              </div>
              <h2
                className="mt-0.5 text-lg leading-tight font-medium text-white"
                style={{ color: shown.color }}
              >
                {shown.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-1 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
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
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-zinc-300">
            {theme && (
              <section className="mb-5">
                <h3 className="mb-2 text-[10px] tracking-wider text-zinc-500 uppercase">
                  Evidence
                </h3>
                <p className="text-xs leading-relaxed text-zinc-300">
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
