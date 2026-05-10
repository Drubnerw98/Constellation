// Deep links from Constellation back into Resonance's `/recommendations`
// route, pre-filling the generate-batch prompt input. The Resonance side
// owns the `?prompt=` URL-param handler; both sides build to that contract.

// Cap matches Resonance's prompt-input ceiling. Keeping it here as a
// constant so trimming logic is co-located with the contract assumption.
const PROMPT_MAX_CHARS = 500;

// Evidence excerpt cap — first sentence, but bounded so an essay-length
// evidence string can't blow the prompt budget on its own.
const EVIDENCE_EXCERPT_MAX = 200;

/** First sentence of `evidence` (split on `.`), trimmed and capped. Returns
 * the whole string when it's short enough. Empty input → empty string. */
export function evidenceExcerpt(evidence: string | null | undefined): string {
  if (!evidence) return "";
  const trimmed = evidence.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length <= EVIDENCE_EXCERPT_MAX) return trimmed;
  // Split on the first period that's followed by whitespace or end — avoids
  // breaking mid-decimal or mid-abbreviation. Falls back to hard truncation
  // when no clean sentence boundary exists in range.
  const firstSentence = trimmed.split(/\.(?:\s|$)/, 1)[0]?.trim() ?? "";
  if (
    firstSentence.length > 0 &&
    firstSentence.length <= EVIDENCE_EXCERPT_MAX
  ) {
    return firstSentence;
  }
  return trimmed.slice(0, EVIDENCE_EXCERPT_MAX).trim();
}

/** Compose the prompt template Resonance pre-fills its generate-batch input
 * with. When evidence is missing/empty, omit the second clause entirely
 * rather than emitting a dangling em-dash. */
export function buildResonancePrompt(
  themeName: string,
  evidence: string | null | undefined,
): string {
  const excerpt = evidenceExcerpt(evidence);
  const base = `Generate recommendations anchored to my "${themeName}" theme`;
  const full = excerpt ? `${base} — ${excerpt}` : `${base}.`;
  // Defense-in-depth against the 500-char contract — a future theme name +
  // evidence combo shouldn't be able to overflow Resonance's input.
  return full.length <= PROMPT_MAX_CHARS
    ? full
    : full.slice(0, PROMPT_MAX_CHARS);
}

// Fallback exists so local dev doesn't silently break when someone forgets
// to set VITE_RESONANCE_FRONTEND_URL — they get a console.warn + the prod
// URL, which still demonstrates the deep-link flow. Production deploys MUST
// set the env var explicitly (Vercel envs documented in README).
const RESONANCE_FRONTEND_FALLBACK = "https://resonance-client.vercel.app";

/** Build the absolute URL that opens Resonance's `/recommendations` route
 * with the prompt pre-filled. Reads `VITE_RESONANCE_FRONTEND_URL` at call
 * time so tests can stub it. */
export function buildResonanceRecommendationsUrl(prompt: string): string {
  const configured = import.meta.env.VITE_RESONANCE_FRONTEND_URL;
  let base: string;
  if (configured && configured.length > 0) {
    base = configured;
  } else {
    console.warn(
      "VITE_RESONANCE_FRONTEND_URL is not set; falling back to production URL. Set it in .env.local for local dev.",
    );
    base = RESONANCE_FRONTEND_FALLBACK;
  }
  const url = new URL("/recommendations", base);
  url.search = new URLSearchParams({ prompt }).toString();
  return url.toString();
}
