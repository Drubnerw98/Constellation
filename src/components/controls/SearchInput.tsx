import { useMemo, useState } from "react";
import type { Graph, GraphNode } from "../../types/graph";

interface Props {
  graph: Graph;
  onPick: (id: string) => void;
}

export function SearchInput({ graph, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo<GraphNode[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return graph.nodes
      .filter((n) => n.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, graph.nodes]);

  const open = focused && query.trim().length > 0;

  return (
    // Hidden on mobile — the FilterBar already takes the top of the
    // screen there, and search is a power-user feature. Comes back at
    // md+ where there's horizontal room.
    <div className="absolute top-4 left-4 z-10 hidden w-[280px] md:block">
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L13.5 13.5" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delay blur so click on a match registers before unmount.
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Search titles"
          className="w-full rounded-md border border-white/10 bg-[var(--color-surface)] py-2 pr-3 pl-8 text-[13px] text-zinc-100 backdrop-blur-md transition-colors placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-md border border-white/10 bg-[var(--color-surface-solid)]/95 shadow-xl backdrop-blur-md">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(m.id);
                  setQuery("");
                }}
                className="w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <div className="text-[13px] text-zinc-100">{m.title}</div>
                <div className="mt-0.5 font-mono text-[10px] tracking-wide text-zinc-500">
                  {m.mediaType}
                  {m.year ? ` · ${m.year}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && matches.length === 0 && (
        <div className="mt-1.5 rounded-md border border-white/10 bg-[var(--color-surface-solid)]/95 px-3 py-2 font-mono text-[11px] tracking-wide text-zinc-500 italic backdrop-blur-md">
          no matches
        </div>
      )}
    </div>
  );
}
