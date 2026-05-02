/**
 * Small constellation glyph + wordmark, sized for the top-right corner
 * next to the auth button. Same constellation shape as the favicon so the
 * page identity is consistent across browser tab + corner.
 */
export function SiteMark() {
  return (
    <div className="pointer-events-none flex items-center gap-2 px-2">
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
      >
        <line
          x1="4"
          y1="20"
          x2="10"
          y2="9"
          stroke="#fef3c7"
          strokeWidth="0.7"
          strokeOpacity="0.55"
        />
        <line
          x1="10"
          y1="9"
          x2="16"
          y2="17"
          stroke="#fef3c7"
          strokeWidth="0.7"
          strokeOpacity="0.55"
        />
        <line
          x1="16"
          y1="17"
          x2="22"
          y2="9"
          stroke="#fef3c7"
          strokeWidth="0.7"
          strokeOpacity="0.55"
        />
        <line
          x1="22"
          y1="9"
          x2="28"
          y2="20"
          stroke="#fef3c7"
          strokeWidth="0.7"
          strokeOpacity="0.55"
        />
        <circle cx="4" cy="20" r="1.6" fill="#fef3c7" />
        <circle cx="10" cy="9" r="2" fill="#fef3c7" />
        <circle cx="16" cy="17" r="2.3" fill="#fef3c7" />
        <circle cx="22" cy="9" r="2" fill="#fef3c7" />
        <circle cx="28" cy="20" r="1.6" fill="#fef3c7" />
      </svg>
      <span className="text-[11px] tracking-[0.18em] text-zinc-400 uppercase">
        Constellation
      </span>
    </div>
  );
}
