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

/**
 * Top-center control bar. Just the format filters; the previous "View"
 * group (cluster scale + edge visibility toggles) was removed after the
 * 2026-05-10 DNA change made both irrelevant — cluster radius no longer
 * carries visual weight now that glow bubbles are hidden by default, and
 * the all-edges view never read well alongside the constellation lines.
 */
export function FilterBar({
  activeFormats,
  onToggle,
  onReset,
}: Props) {
  const allActive = FORMATS.every((f) => activeFormats.has(f.id));
  return (
    <div className="pointer-events-none absolute top-16 right-3 left-3 z-10 flex flex-col items-stretch gap-2 text-[12px] md:top-4 md:right-auto md:left-1/2 md:flex-row md:items-stretch md:gap-2.5 md:-translate-x-1/2">
      <Group caption="Media">
        {FORMATS.map((f) => {
          const active = activeFormats.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onToggle(f.id)}
              className={`pointer-events-auto flex-1 cursor-pointer rounded-sm px-2 py-1 tracking-wide whitespace-nowrap transition-colors md:flex-initial md:px-2.5 ${
                active ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-300"
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
            className="pointer-events-auto ml-1 cursor-pointer rounded-sm border-l border-white/10 pl-2.5 font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase transition-colors hover:text-zinc-300"
          >
            reset
          </button>
        )}
      </Group>
    </div>
  );
}

function Group({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto relative flex items-center gap-1 rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-1.5 backdrop-blur-md">
      <span className="absolute -top-2 left-3 bg-[var(--color-bg)] px-1 font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
        {caption}
      </span>
      {children}
    </div>
  );
}
