import type { MediaType } from "../../types/graph";

const FORMATS: { id: MediaType; label: string }[] = [
  { id: "movie", label: "Movies" },
  { id: "tv", label: "TV" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
  { id: "game", label: "Games" },
  { id: "book", label: "Books" },
];

interface Props {
  activeFormats: Set<MediaType>;
  onToggle: (format: MediaType) => void;
  onReset: () => void;
}

export function FilterBar({ activeFormats, onToggle, onReset }: Props) {
  const allActive = FORMATS.every((f) => activeFormats.has(f.id));
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#0b0f1a]/85 px-1.5 py-1 text-xs backdrop-blur-md">
      {FORMATS.map((f) => {
        const active = activeFormats.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle(f.id)}
            className={`pointer-events-auto rounded-full px-3 py-1 transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            aria-pressed={active}
          >
            {f.label}
          </button>
        );
      })}
      {!allActive && (
        <button
          type="button"
          onClick={onReset}
          className="pointer-events-auto ml-1 rounded-full px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          reset
        </button>
      )}
    </div>
  );
}
