import { ECOSYSTEM, type EcosystemApp } from "../lib/ecosystem";

interface Props {
  current: EcosystemApp;
  size?: "sm" | "md";
}

/**
 * Named chip trio identifying the three sibling apps. The current app is
 * dimmed and non-clickable ("you are here"); the other two are clickable
 * destinations. This avoids the visual doubling of the current app's name
 * being repeated alongside the wordmark elsewhere in chrome.
 */
export function EcosystemSwitcher({ current, size = "sm" }: Props) {
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
              <span aria-hidden className="text-zinc-800">
                ·
              </span>
            )}
            {isCurrent ? (
              <span aria-current="page" className="text-zinc-700">
                {entry.name}
              </span>
            ) : (
              <a
                href={entry.url}
                className="text-zinc-400 transition-colors hover:text-zinc-100"
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
