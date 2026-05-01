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
    <div className="absolute left-4 top-4 z-10 w-[260px]">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        // Delay blur so click on a match registers before the dropdown unmounts.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="Search titles…"
        className="w-full rounded-md border border-white/10 bg-[#0b0f1a]/85 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 backdrop-blur-md transition-colors focus:border-white/25 focus:outline-none"
      />
      {open && matches.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-md border border-white/10 bg-[#0b0f1a]/95 shadow-xl backdrop-blur-md">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // Prevent input blur from firing before the click handler.
                  e.preventDefault();
                  onPick(m.id);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
              >
                <div className="text-zinc-200">{m.title}</div>
                <div className="text-[10px] text-zinc-500">
                  {m.mediaType}
                  {m.year ? ` · ${m.year}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && matches.length === 0 && (
        <div className="mt-1 rounded-md border border-white/10 bg-[#0b0f1a]/95 px-3 py-2 text-xs italic text-zinc-500 backdrop-blur-md">
          No matches
        </div>
      )}
    </div>
  );
}
