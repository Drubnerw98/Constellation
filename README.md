# Constellation

> An interactive force-directed map of your media taste. Themes become nebula clusters, titles become stars, and per-theme constellation lines trace the ground each cluster covers.

**Live demo: [constellation-alpha-eight.vercel.app](https://constellation-alpha-eight.vercel.app)**

A frontend-craft companion to [Resonance](https://github.com/Drubnerw98/Resonance), an AI recommendation engine that builds the structured taste profile this visualization renders. Both apps share a single Clerk OAuth instance; Constellation reads `/api/profile/export` from Resonance with a bearer token and transforms the response (a `TasteProfile` plus library items, recommendations, favorites, and avoidances) through a graph-builder pipeline before feeding it into a D3 force simulation rendered as SVG.

For the architectural deep-dive (the *why* behind every major decision) see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

![Signed-out landing](./screenshots/landing.jpg)

![A rendered taste constellation, six theme clusters connected by per-theme MST lines](./screenshots/canvas.jpg)

![Galaxy mode, focusing a cluster surfaces the AI-generated theme evidence](./screenshots/galaxy-focus.jpg)

## Features

- **Spiral cluster placement.** Themes are seeded on a Fibonacci spiral ordered by weight, then released into a D3 force simulation that settles the layout. Heavier themes land near the center; lighter ones rotate outward. The spiral breaks the grid-feel that uniform polar placement produces, and the weight ordering reads as gravity without saying so.
- **Per-theme constellation lines.** Each cluster draws a minimum spanning tree (Kruskal's plus union-find) connecting its member stars. The MST is what makes the canvas read as a star chart instead of a bubble chart. Edges to a focused node ride on top; the MST is the resting silhouette.
- **Three-tier fuzzy tag matching.** AI-generated `tasteTags` rarely match canonical theme labels verbatim. Three fallback tiers (exact match, then substring with a min-length floor, then content-token overlap with bidirectional within-token substring) reconcile drift like `"sacrifice"` against `"earned sacrifice through sustained commitment"`.
- **Load-balanced primary-theme assignment.** Naive "highest-weight wins" left lower-weight themes as empty clusters. Greedy load-balanced assignment with weight-ascending tiebreak ensures every cluster gets at least one resident.
- **Per-format glyph language.** Circle (movie), triangle (TV), hexagon (anime), diamond (game), 5-point star (manga), 4-point sparkle (book). All shapes carry equal visual area so differentiation reads as identity, not size.
- **Cluster-level "why" surface.** Galaxy-mode panel surfaces the AI's per-theme `evidence` text (the 100-200 word paragraph explaining why this theme exists in your profile) split into editorial summary, anchor titles, and reinforcing titles. Per-item rationale was deliberately removed because it was inconsistently populated, which read as broken.
- **Anti-stars.** Disliked titles render as muted X marks around the canvas perimeter, in the negative space outside the cluster orbits. Visualizes "what's outside your taste" alongside the constellation.
- **Cosmic background.** Tiered starfield (anchor stars with cross-flares, mid-bright stars, faint stars) layered over four nebula gradients (twilight blue, aurora green, warm pink, deep teal) and a soft viewport-anchored vignette. The starfield breathes via `prefers-reduced-motion`-respecting opacity drift.
- **Bottom-sheet mobile panels.** DetailPanel and ClusterPanel slide up from the bottom on phones, slide in from the side on desktop. Same component, breakpoint-driven transform.
- **Pre-focus zoom restore.** Entering galaxy mode snapshots the current pinch/pan state; exiting restores it instead of jumping to identity. Switching between clusters preserves the original snapshot (one back-stack item, no ping-pong).
- **Touch-aware hit areas.** 30px viewBox-unit invisible hit circles around every node so finger taps register reliably once the SVG scales to a phone viewport.
- **Editorial typography vocabulary.** IBM Plex Mono for chrome and mono captions, Iowan Old Style serif italic for in-canvas cluster labels (star-chart aesthetic). Semantic CSS color tokens, no `zinc-500` utility chains.
- **Sample fallback.** Signed-out, no-profile, and API-error states all fall back to a curated sample profile (`/demo` route exposes it directly). Banner explains why on the fallback paths.
- **Drift-on-rest.** `alphaTarget(0.03)` keeps the simulation gently ticking forever so nodes orbit slowly within their clusters. Disabled when `prefers-reduced-motion`.

## Stack

| Layer       | Choice                                                 |
| ----------- | ------------------------------------------------------ |
| Framework   | React 19 + TypeScript 5.9, Vite 6                      |
| Layout      | D3 v7 (`forceSimulation`, drag, zoom)                  |
| Styling     | Tailwind v4 (`@theme` directive), IBM Plex Mono + Iowan |
| Routing     | react-router-dom 7                                     |
| Auth        | Clerk (OAuth shared with [Resonance](https://github.com/Drubnerw98/Resonance)) |
| Tests       | Vitest + happy-dom (graph builder unit tests)          |
| Lint/format | ESLint flat config + Prettier + Tailwind class sorting |
| CI          | GitHub Actions (`typecheck` → `lint` → `test` → `build`) |
| Deploy      | Vercel (frontend-only; Resonance is the backend dependency) |

## Layout

```
constellation/
├── src/
│   ├── main.tsx              # ClerkProvider + BrowserRouter mount
│   ├── App.tsx               # Routes: / (Landing|Home), /demo, * → /
│   ├── routes/
│   │   ├── Landing.tsx       # signed-out hero with editorial typography
│   │   ├── Home.tsx          # signed-in: real-data hook + sample fallback
│   │   └── Demo.tsx          # /demo: always sample data
│   ├── components/
│   │   ├── ConstellationView.tsx          # orchestrator, owns view state
│   │   ├── SiteMark.tsx                   # asterism + wordmark, shared
│   │   ├── constellation/
│   │   │   ├── ConstellationCanvas.tsx    # D3 simulation + SVG layers
│   │   │   ├── ClusterPanel.tsx           # left slide-in (galaxy mode)
│   │   │   ├── DetailPanel.tsx            # right slide-in (selected node)
│   │   │   └── canvas/
│   │   │       ├── BackgroundLayers.tsx   # starfield, nebulas, vignette
│   │   │       ├── Clusters.tsx           # cluster glow + label rendering
│   │   │       ├── Graph.tsx              # constellation lines, edges, stars
│   │   │       └── helpers.ts             # MST computation + math
│   │   └── controls/
│   │       ├── FilterBar.tsx              # format toggles
│   │       └── SearchInput.tsx            # title search with pan-to-node
│   ├── lib/
│   │   ├── api.ts            # Resonance API client (Bearer token, status mapping)
│   │   ├── graph.ts          # buildGraph, spiral seeding, force placement
│   │   ├── graph.test.ts     # vitest unit tests (matching, dedupe, edges, clusters)
│   │   └── colors.ts         # cluster color palette
│   ├── hooks/
│   │   └── useResonanceProfile.ts # discriminated-union status hook
│   ├── data/
│   │   └── sampleProfile.ts  # curated fallback / demo source
│   └── types/                # GraphNode, ProfileExport, Avoidance, etc.
├── public/favicon.svg        # SVG asterism (matches in-app SiteMark glyph)
├── ARCHITECTURE.md           # subsystem-by-subsystem reasoning
├── eslint.config.js
├── vercel.json               # SPA fallback rewrite
└── .github/workflows/check.yml
```

## Setup

```sh
pnpm install
cp .env.local.example .env.local   # if it exists; else create one
```

Three environment variables are required to run:

```sh
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...           # same value Resonance uses
VITE_RESONANCE_API_URL=https://...                # Resonance API base URL
VITE_RESONANCE_FRONTEND_URL=https://...           # Resonance frontend (deep links from cluster panel)
```

All three are public (`VITE_*` are inlined at build). The Clerk key has to match the publishable key on the Resonance instance you're pointing at. They share OAuth identities. `VITE_RESONANCE_API_URL` is the API server (e.g. the Render-hosted Express service); `VITE_RESONANCE_FRONTEND_URL` is the Resonance web app (e.g. the Vercel-hosted React frontend). They're distinct because the cluster panel's "Generate a batch from this theme" button deep-links into Resonance's `/recommendations?prompt=...` route, which lives on the frontend.

To run against a local Resonance backend, point `VITE_RESONANCE_API_URL` at `http://localhost:3001` and add `http://localhost:5174` to that backend's `FRONTEND_ORIGIN` env var so its CORS middleware accepts the call. For the deep link, point `VITE_RESONANCE_FRONTEND_URL` at the local Resonance frontend (e.g. `http://localhost:5173`); if unset the button falls back to the prod URL with a console warning.

## Dev

```sh
pnpm dev                # Vite on :5174
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest run
pnpm check              # all three above
pnpm format:write       # apply Prettier
```

## Deployment

Constellation deploys as a static SPA on **Vercel**. Backend dependency (Resonance) lives separately on Render.

### Frontend (Vercel)

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). Vercel auto-detects Vite.
2. **Environment variables** (Settings → Environment Variables, scoped Production + Preview + Development):
   - `VITE_CLERK_PUBLISHABLE_KEY` to the same publishable key Resonance uses
   - `VITE_RESONANCE_API_URL` to the Resonance API base URL (no trailing slash, no whitespace)
   - `VITE_RESONANCE_FRONTEND_URL` to the Resonance frontend URL for deep links (no trailing slash, no whitespace)
3. **Deploy.** `vercel.json` ships an SPA rewrite so `/demo` and any future routes resolve to `index.html` on direct hit.

### Backend dependency: Resonance CORS

Constellation hits the Resonance API from the browser, so Resonance has to allow the prod origin. Append `https://<your-vercel-url>.vercel.app` to Resonance's `FRONTEND_ORIGIN` env var (comma-separated). Without this, signed-in users see "Resonance is unreachable" on the constellation.

### Gotchas

- **`VITE_*` env vars are baked in at build.** Setting them after a deploy doesn't retroactively apply. You have to redeploy. Trailing whitespace in the env value is also baked in literally; verify the saved value.
- **No backend of its own.** Constellation can't fall back to mock data on a Resonance outage transparently. It shows the sample with an amber banner explaining why. Acceptable for portfolio scope; would need a server-side cache for real production.

## Status

**Shipped + deployed:**

- Live at [constellation-alpha-eight.vercel.app](https://constellation-alpha-eight.vercel.app)
- Real OAuth via Clerk, real bearer-token data fetch from Resonance
- Spiral cluster placement (Fibonacci, weight-ordered) with per-theme constellation lines (MST)
- Three-tier fuzzy tag matching plus load-balanced primary assignment
- Per-format glyph language across 6 media types
- Editorial typography system (IBM Plex Mono + Iowan serif italic for canvas labels)
- Cosmic background (tiered starfield, four-nebula palette, soft vignette, breath animation)
- Bottom-sheet mobile panels, touch-tuned hit areas, mobile-aware filter layout
- Cluster info panel in galaxy mode with structured AI theme evidence (summary, anchors, reinforcing titles)
- Anti-stars (dislikedTitles) on the canvas perimeter
- Pre-focus zoom snapshot/restore (galaxy mode entry/exit)
- Sample fallback for signed-out, no-profile, and error states (`/demo` route exposes it as a stable URL)
- GitHub Actions CI: `typecheck → lint → test → build` on every push and PR

**Deferred (intentional):**

- Pattern avoidances (the abstract `kind: "pattern"` ones) would need a different surface; they don't have titles to attach to.
- Public read-only sharing (URL with a snapshot of someone else's constellation).
- Keyboard navigation (Tab through nodes, Esc to close panels, arrow keys to pan).
- Server-side caching of Resonance responses (would let it survive a backend outage).

See **[ARCHITECTURE.md → Open design questions](./ARCHITECTURE.md#9-open-design-questions)** for layout and design decisions deliberately left open.

## How this was built

Constellation is the second project in a paired build. [Resonance](https://github.com/Drubnerw98/Resonance) shipped first as the AI recommendation system; Constellation shipped after as the visualization layer.

Both projects were built with Claude (the LLM) as a pair-programmer in Claude Code. The implementation work, generating the D3 force tuning, refactoring the React components, writing the type-safe transforms, debugging mobile touch hit-areas, was done in conversation. Design judgment, copy decisions, when to push back on a suggestion, when to discard a pass and try a different direction, what visual quality bar to hold the result to: that was me.

The result is a real codebase I can defend in interviews (every architectural choice has a reason I can explain), not a one-shot generated project. The commit history is granular and honest about that work. Search for the small "fix"-style commits where I caught Claude doing something wrong, or for the visual-audit threads where I rejected a pass and asked for a redesign.

## License

Portfolio project; not currently licensed for redistribution.
