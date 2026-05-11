import { EcosystemSwitcher } from "./EcosystemSwitcher";

const GITHUB_URL = "https://github.com/Drubnerw98/Constellation";

/**
 * Slim bottom-right overlay. Sits on top of the canvas; non-blocking
 * (pointer-events-none) except where the EcosystemSwitcher / GitHub link
 * need to be clickable. Mirrors the shape of Resonance's footer so the
 * three sibling apps bracket their content with the same chrome.
 *
 * Positioned bottom-right so it doesn't collide with the centered banner
 * (loading toast, missing-profile fallback) or the /diff scrub control.
 *
 * Hidden on mobile because Constellation's mobile experience already
 * compresses chrome aggressively (cluster panel becomes a bottom sheet,
 * etc) — a permanent bottom bar would crowd the canvas at narrow widths.
 */
export function SiteFooter() {
  return (
    <div className="pointer-events-none absolute right-4 bottom-3 z-10 hidden md:block">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-[#0b0f1a]/85 px-3.5 py-1.5 backdrop-blur-md">
        <EcosystemSwitcher current="constellation" />
        <span aria-hidden className="text-zinc-800">
          ·
        </span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-['IBM_Plex_Mono'] text-[10px] tracking-[0.22em] text-zinc-500 uppercase transition-colors hover:text-zinc-200"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
