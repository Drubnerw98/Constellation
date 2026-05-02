import { useEffect, useState } from "react";
import type { Graph, GraphNode } from "../../types/graph";
import type { TasteProfile } from "../../types/profile";

interface Props {
  node: GraphNode | null;
  graph: Graph;
  profile: TasteProfile;
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
  pending: "recommended for you",
  saved: "saved",
  rated: "rated",
  plan_to: "plan to",
};

export function DetailPanel({
  node,
  graph,
  profile,
  onClose,
  onSelectConnected,
}: Props) {
  const [displayNode, setDisplayNode] = useState<GraphNode | null>(node);
  useEffect(() => {
    if (node) setDisplayNode(node);
  }, [node]);

  const isOpen = node !== null;
  const shown = displayNode;

  const themesWithEvidence = shown
    ? shown.themes
        .map((label) => profile.themes.find((t) => t.label === label))
        .filter((t): t is TasteProfile["themes"][number] => t !== undefined)
    : [];
  const archetypesWithAttraction = shown
    ? shown.archetypes
        .map((label) => profile.archetypes.find((a) => a.label === label))
        .filter(
          (a): a is TasteProfile["archetypes"][number] => a !== undefined,
        )
    : [];
  const connected = shown ? connectedTitlesFor(graph, shown.id) : [];

  return (
    <aside
      className="pointer-events-auto absolute right-0 top-0 z-10 flex h-full w-[400px] flex-col border-l border-white/10 bg-[#0a0d18]/95 backdrop-blur-md transition-transform duration-300 ease-out"
      style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      aria-hidden={!isOpen}
    >
      {shown && (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {shown.source === "library"
                  ? "from your library"
                  : "recommendation"}
              </div>
              <h2 className="mt-0.5 text-lg font-medium leading-tight text-white">
                {shown.title}
              </h2>
              <div className="mt-1 text-xs text-zinc-400">
                {shown.mediaType}
                {shown.year ? ` · ${shown.year}` : ""}
                {shown.rating !== null
                  ? ` · ${shown.rating}★`
                  : shown.matchScore !== null
                    ? ` · ${Math.round(shown.matchScore * 100)}% match`
                    : ""}
                {" · "}
                {STATUS_LABEL[shown.status]}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
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
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-zinc-300">
            {themesWithEvidence.length > 0 && (
              <section className="mb-5">
                <h3 className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  Themes
                </h3>
                <ul className="space-y-3">
                  {themesWithEvidence.map((t) => (
                    <li key={t.label}>
                      <div className="font-medium text-zinc-200">{t.label}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {t.evidence}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {archetypesWithAttraction.length > 0 && (
              <section className="mb-5">
                <h3 className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  Archetypes
                </h3>
                <ul className="space-y-3">
                  {archetypesWithAttraction.map((a) => (
                    <li key={a.label}>
                      <div className="font-medium text-zinc-200">{a.label}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {a.attraction}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {connected.length > 0 && (
              <section className="mb-5">
                <h3 className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  Connected titles
                </h3>
                <ul className="space-y-1.5">
                  {connected.map(({ node: n, sharedThemes, sharedArchetypes }) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onSelectConnected(n.id)}
                        className="w-full rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="font-medium text-zinc-200">
                            {n.title}
                          </div>
                          <div className="shrink-0 text-[10px] text-zinc-500">
                            {n.mediaType}
                            {n.year ? ` · ${n.year}` : ""}
                          </div>
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500">
                          shares{" "}
                          {[...sharedThemes, ...sharedArchetypes].join(" · ")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {connected.length === 0 && (
              <div className="text-xs italic text-zinc-500">
                No strong connections to other titles in this constellation.
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
