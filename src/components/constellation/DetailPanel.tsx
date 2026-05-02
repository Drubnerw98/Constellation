import { useState } from "react";
import type { Graph, GraphNode } from "../../types/graph";

interface Props {
  node: GraphNode | null;
  isOpen: boolean;
  graph: Graph;
  onClose: () => void;
  onSelectConnected: (id: string) => void;
}

interface ConnectedTitle {
  node: GraphNode;
  sharedThemes: string[];
  sharedArchetypes: string[];
  strength: number;
}

function connectedTitlesFor(graph: Graph, nodeId: string): ConnectedTitle[] {
  const out: ConnectedTitle[] = [];
  for (const e of graph.edges) {
    const sId = typeof e.source === "string" ? e.source : e.source.id;
    const tId = typeof e.target === "string" ? e.target : e.target.id;
    if (sId !== nodeId && tId !== nodeId) continue;
    const otherId = sId === nodeId ? tId : sId;
    const other = graph.nodes.find((n) => n.id === otherId);
    if (!other) continue;
    out.push({
      node: other,
      sharedThemes: e.sharedThemes,
      sharedArchetypes: e.sharedArchetypes,
      strength: e.strength,
    });
  }
  return out.sort((a, b) => b.strength - a.strength);
}

const STATUS_LABEL: Record<GraphNode["status"], string> = {
  library: "in your library",
  watchlist: "on your watchlist",
  favorite: "favorite",
  pending: "recommended for you",
  saved: "saved",
  rated: "rated",
  plan_to: "plan to",
};

const SOURCE_LABEL: Record<GraphNode["source"], string> = {
  library: "from your library",
  recommendation: "recommendation",
};

export function DetailPanel({
  node,
  isOpen,
  graph,
  onClose,
  onSelectConnected,
}: Props) {
  // Keep the last non-null node so the panel can finish its slide-out
  // animation after `node` flips to null. Derived during render rather than
  // mirrored via useEffect — guard ensures setState only fires on actual
  // change.
  const [displayNode, setDisplayNode] = useState<GraphNode | null>(node);
  if (node !== null && node.id !== displayNode?.id) {
    setDisplayNode(node);
  }

  const shown = displayNode;

  const clusterColor = (label: string): string =>
    graph.clusters.find((c) => c.label === label)?.color ?? "#9ca3af";

  const accentColor = shown?.primaryTheme
    ? clusterColor(shown.primaryTheme)
    : "transparent";

  const connected = shown ? connectedTitlesFor(graph, shown.id) : [];

  // Mobile: bottom sheet (slide up from bottom). md+: side sheet from
  // right. Tailwind transform utilities, not inline style, so the
  // responsive override at md works.
  const transformClasses = isOpen
    ? "translate-y-0 md:translate-x-0"
    : "translate-y-full md:translate-y-0 md:translate-x-full";

  return (
    <aside
      className={`pointer-events-auto absolute right-0 bottom-0 left-0 z-20 flex max-h-[82vh] flex-col rounded-t-xl bg-[var(--color-surface-solid)]/95 backdrop-blur-md transition-transform duration-300 ease-out md:top-0 md:bottom-auto md:left-auto md:h-full md:max-h-none md:w-[420px] md:rounded-none ${transformClasses}`}
      style={{
        borderTop: "1px solid rgb(255 255 255 / 0.08)",
        borderLeft: "1px solid rgb(255 255 255 / 0.08)",
        // Accent stripe in the clicked node's primary theme color —
        // visual continuity between canvas and panel. Top edge on mobile,
        // left edge on desktop.
        boxShadow: `inset 0 2px 0 0 ${accentColor}, inset 2px 0 0 0 ${accentColor}`,
      }}
      aria-hidden={!isOpen}
    >
      {shown && (
        <>
          <header className="flex items-start justify-between gap-3 border-b border-white/5 px-6 pt-6 pb-5">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                {SOURCE_LABEL[shown.source]}
              </div>
              <h2 className="mt-2 text-2xl leading-snug font-semibold text-white">
                {shown.title}
              </h2>
              <div className="mt-2 font-mono text-[11px] tracking-wide text-zinc-400">
                <span className="text-zinc-300">{shown.mediaType}</span>
                {shown.year ? <span> · {shown.year}</span> : null}
                {shown.rating !== null ? (
                  <span> · {shown.rating}★</span>
                ) : shown.matchScore !== null ? (
                  <span> · {Math.round(shown.matchScore * 100)}% match</span>
                ) : null}
                <span> · {STATUS_LABEL[shown.status]}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="-mt-2 -mr-2 cursor-pointer rounded p-3 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close"
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
            {/* Per-item AI rationale (rec.explanation / library.fitNote) is
                deliberately not surfaced here. It only exists for ~20% of
                items; rendering it inconsistently read as broken. Cluster-
                level evidence (cluster panel during galaxy mode) carries
                the "why" surface instead. */}
            {shown.themes.length > 0 && (
              <Section title="Themes">
                <ul className="space-y-2">
                  {shown.themes.map((label) => (
                    <li
                      key={label}
                      className="flex items-baseline gap-2.5 leading-relaxed"
                    >
                      <span
                        aria-hidden
                        className="mt-[5px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: clusterColor(label) }}
                      />
                      <span className="font-serif text-[14px] text-zinc-200 italic">
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {shown.archetypes.length > 0 && (
              <Section title="Archetypes">
                <ul className="space-y-2">
                  {shown.archetypes.map((label) => (
                    <li
                      key={label}
                      className="font-serif text-[14px] leading-relaxed text-zinc-200 italic"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {connected.length > 0 && (
              <Section title="Connected titles">
                <ul className="-mx-2 space-y-0.5">
                  {connected.map(
                    ({ node: n, sharedThemes, sharedArchetypes }) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onSelectConnected(n.id)}
                          className="w-full cursor-pointer rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-[14px] leading-snug text-zinc-100">
                              {n.title}
                            </div>
                            <div className="shrink-0 font-mono text-[10px] tracking-wide text-zinc-500">
                              {n.mediaType}
                              {n.year ? ` · ${n.year}` : ""}
                            </div>
                          </div>
                          <div className="mt-1 font-mono text-[10px] tracking-wide text-zinc-500">
                            shares{" "}
                            {[...sharedThemes, ...sharedArchetypes].join(" · ")}
                          </div>
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </Section>
            )}

            {connected.length === 0 && (
              <div className="font-mono text-[11px] tracking-wide text-zinc-500 italic">
                No strong connections to other titles in this constellation.
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
