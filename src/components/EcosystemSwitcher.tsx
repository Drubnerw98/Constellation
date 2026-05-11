import { ECOSYSTEM, type EcosystemApp } from "../lib/ecosystem";

interface Props {
  current: EcosystemApp;
  /** Accent class for the current-app entry. Per-app convention: Resonance
   * = emerald, Constellation = amber, Ensemble = saffron. */
  accentClassName?: string;
  size?: "sm" | "md";
}

/**
 * Named chip trio that names the three sibling apps and marks the current
 * one. Shared chrome pattern across Resonance / Constellation / Ensemble.
 * The trio appears in headers and footers and uses the same Plex Mono
 * tracked-caps treatment in all three apps.
 */
export function EcosystemSwitcher({
  current,
  accentClassName = "text-amber-300",
  size = "sm",
}: Props) {
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  return (
    <nav
      aria-label="Sibling apps"
      className={`pointer-events-auto flex items-center gap-1.5 font-['IBM_Plex_Mono'] ${textSize} tracking-[0.22em] uppercase`}
    >
      {ECOSYSTEM.map((entry, i) => {
        const isCurrent = entry.key === current;
        return (
          <span key={entry.key} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-zinc-700">
                ·
              </span>
            )}
            {isCurrent ? (
              <span aria-current="page" className={accentClassName}>
                {entry.name}
              </span>
            ) : (
              <a
                href={entry.url}
                className="text-zinc-500 transition-colors hover:text-zinc-200"
              >
                {entry.name}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
