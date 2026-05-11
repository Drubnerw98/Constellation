/**
 * Brand mark — 5-star asterism + wordmark. Same shape as `/favicon.svg`
 * and the Landing page hero glyph; tab, corner, and hero share one
 * visual identity. Anchor star (center) carries a subtle cross-flare
 * for diffraction-spike feel.
 *
 * Wordmark uses IBM Plex Sans Light per the 2026-05-10 chrome
 * harmonization — the three sibling apps share a Plex family treatment
 * in their wordmark slot while keeping their distinct content palettes.
 */
export function SiteMark() {
  return (
    <div className="pointer-events-none flex flex-col items-end gap-0.5 px-2">
      {/* Eyebrow caption — shared across the three sibling apps in their
          chrome so the family is legible at a glance. */}
      <span className="hidden font-['IBM_Plex_Mono'] text-[9px] tracking-[0.28em] text-zinc-500 uppercase sm:inline">
        Constellation
      </span>
      <div className="flex items-center gap-2.5">
        <Asterism size={22} />
        <span className="hidden font-['IBM_Plex_Sans'] text-[15px] font-light tracking-[0.04em] text-zinc-200 sm:inline">
          Constellation
        </span>
      </div>
    </div>
  );
}

interface AsterismProps {
  size?: number;
}

export function Asterism({ size = 22 }: AsterismProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <line
        x1="4"
        y1="22"
        x2="10"
        y2="9"
        stroke="#fef3c7"
        strokeWidth="0.7"
        strokeOpacity="0.45"
      />
      <line
        x1="10"
        y1="9"
        x2="16"
        y2="18"
        stroke="#fef3c7"
        strokeWidth="0.7"
        strokeOpacity="0.45"
      />
      <line
        x1="16"
        y1="18"
        x2="22"
        y2="8"
        stroke="#fef3c7"
        strokeWidth="0.7"
        strokeOpacity="0.45"
      />
      <line
        x1="22"
        y1="8"
        x2="28"
        y2="21"
        stroke="#fef3c7"
        strokeWidth="0.7"
        strokeOpacity="0.45"
      />
      <line
        x1="13"
        y1="18"
        x2="19"
        y2="18"
        stroke="#fef3c7"
        strokeWidth="0.4"
        strokeOpacity="0.55"
      />
      <line
        x1="16"
        y1="15"
        x2="16"
        y2="21"
        stroke="#fef3c7"
        strokeWidth="0.4"
        strokeOpacity="0.55"
      />
      <circle cx="4" cy="22" r="1.4" fill="#fef3c7" />
      <circle cx="10" cy="9" r="2.1" fill="#fef3c7" />
      <circle cx="16" cy="18" r="2.8" fill="#fef3c7" />
      <circle cx="22" cy="8" r="2.1" fill="#fef3c7" />
      <circle cx="28" cy="21" r="1.4" fill="#fef3c7" />
    </svg>
  );
}
