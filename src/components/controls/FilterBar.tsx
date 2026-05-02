import type { MediaType } from "../../types/graph";
import type { ClusterScaleMode } from "../../lib/graph";

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
  clusterScaleMode: ClusterScaleMode;
  onClusterScaleModeChange: (mode: ClusterScaleMode) => void;
  showAllConnections: boolean;
  onShowAllConnectionsChange: (value: boolean) => void;
}

/**
 * Top-center control bar. Two distinct surfaces side by side:
 *   1. Format filters (MEDIA), toggleable
 *   2. View settings (VIEW) — cluster scale + connection visibility
 *
 * Replaces the previous everything-is-a-rounded-pill layout. Borders +
 * dividers communicate structure; mono caption labels signal "settings"
 * vs the sans format labels.
 */
export function FilterBar({
  activeFormats,
  onToggle,
  onReset,
  clusterScaleMode,
  onClusterScaleModeChange,
  showAllConnections,
  onShowAllConnectionsChange,
}: Props) {
  const allActive = FORMATS.every((f) => activeFormats.has(f.id));
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-stretch gap-2.5 text-[12px]">
      <Group caption="Media">
        {FORMATS.map((f) => {
          const active = activeFormats.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onToggle(f.id)}
              className={`pointer-events-auto cursor-pointer rounded-sm px-2.5 py-1 tracking-wide transition-colors ${
                active
                  ? "text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-300"
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

      <Group caption="View">
        <Toggle
          label="scale by"
          value={clusterScaleMode === "weight" ? "weight" : "titles"}
          onClick={() =>
            onClusterScaleModeChange(
              clusterScaleMode === "weight" ? "members" : "weight",
            )
          }
          title="Cluster size: theme weight (default) vs. number of titles in the cluster"
        />
        <span aria-hidden className="self-stretch border-l border-white/10" />
        <Toggle
          label="connections"
          value={showAllConnections ? "all" : "selected"}
          onClick={() => onShowAllConnectionsChange(!showAllConnections)}
          title="Show all connections vs. only the connections of the selected title"
        />
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

function Toggle({
  label,
  value,
  onClick,
  title,
}: {
  label: string;
  value: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="pointer-events-auto cursor-pointer rounded-sm px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase transition-colors hover:text-zinc-300"
    >
      {label} <span className="text-zinc-200">{value}</span>
    </button>
  );
}
