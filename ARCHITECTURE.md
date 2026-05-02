# Architecture

This is the architecture reference for Constellation — the *why* behind decisions, not just the *what*. If you're modifying structural code (data flow, graph builder, simulation, render layers, auth), update this doc **in the same commit**.

---

## 1. What this is

A frontend visualization companion to [Resonance](https://github.com/Drubnerw98/Resonance) (an AI media-recommendation engine). Constellation reads a user's `TasteProfile` from the Resonance API and renders it as a force-directed map: themes are cluster centers, titles (library + recommendations) are stars positioned by primary theme, edges connect titles that share themes/archetypes.

The product question is "is this just a graph viz?" The answer is three pillars:

1. **Real auth, real data** — Clerk-shared identity with Resonance, signed `Bearer` token to the Resonance API. The constellation renders YOUR profile, not a sample, when you're signed in.
2. **A non-trivial data transform** — raw profile JSON → cluster-tagged graph requires fuzzy matching, load-balanced cluster assignment, and edge pruning. Not just `.map()`.
3. **A non-trivial render** — D3 force simulation driving an SVG composition with custom glyphs, theme-tinted edges, radial label positioning, and zoom/pan/galaxy-mode interactions.

The portfolio framing is: *"this is the shape of my taste, mapped from a system I built"* — a visual statement, not a recommendation tool. Recommendation IS Resonance; Constellation visualizes the resulting profile.

---

## 2. Stack & layout

```
constellation/
├── src/
│   ├── main.tsx              # ClerkProvider + BrowserRouter mount
│   ├── App.tsx               # Routes: / (Landing|Home), /demo, * → /
│   ├── routes/
│   │   ├── Landing.tsx       # signed-out hero with sign-in + view-demo CTAs
│   │   ├── Home.tsx          # signed-in: real-data hook + sample fallback + banner
│   │   └── Demo.tsx          # /demo: always sample data, shareable URL
│   ├── components/
│   │   ├── ConstellationView.tsx          # canvas + filters + panel orchestrator
│   │   ├── constellation/
│   │   │   ├── ConstellationCanvas.tsx    # D3 simulation + SVG render layers (~1k lines)
│   │   │   ├── ClusterPanel.tsx           # slide-in (left) when galaxy mode is active
│   │   │   └── DetailPanel.tsx            # slide-in (right) for selected node
│   │   └── controls/
│   │       ├── FilterBar.tsx              # format toggles
│   │       └── SearchInput.tsx            # title search with pan-to-node
│   ├── lib/
│   │   ├── api.ts            # Resonance API client (fetch + Zod-light shape)
│   │   ├── graph.ts          # buildGraph: profile + library + recs → Graph
│   │   ├── graph.test.ts     # vitest unit tests for buildGraph
│   │   └── colors.ts         # cluster color palette
│   ├── hooks/
│   │   └── useResonanceProfile.ts # discriminated-union status hook
│   ├── data/
│   │   └── sampleProfile.ts  # curated fallback + /demo source
│   ├── types/
│   │   ├── graph.ts          # GraphNode, GraphEdge, ThemeCluster, Graph
│   │   └── profile.ts        # TasteProfile, LibraryItem, RecommendationItem
│   └── styles/
│       └── globals.css
├── eslint.config.js          # flat config, TS-aware
├── .prettierrc               # opinionated formatting
└── vite.config.ts
```

**Stack choices:**
- **Vite 6 + React 19 + TypeScript 5.9** — modern, fast, no SSR (the app is interactive client-rendered SVG, SSR adds nothing).
- **D3 7.9** — `forceSimulation` for the graph physics. D3 is the right level of abstraction here: we own the rendering (React/SVG) and only use D3 for the simulation, drag, and zoom behaviors.
- **Tailwind CSS 4 + PostCSS** — utility classes for the chrome (panels, buttons, banners). Canvas SVG uses inline `style` props because D3 transitions on attributes (cx, cy, r, opacity) need direct attribute control.
- **Clerk** — same `pk_test_*` publishable key as Resonance. Sessions are per-domain (localhost:5174 ≠ resonance-client.vercel.app), so signing in to one app doesn't sign you into the other; the Clerk *user identity* is shared once you sign in to both.
- **react-router-dom 7** — three routes (`/`, `/demo`, `*`). No nested routes, no loaders, just `<Routes>` with `<SignedIn>`/`<SignedOut>` gates inside `/`.
- **Vitest + happy-dom** — unit tests for the graph builder. The simulation/canvas isn't unit-tested (visual regression doesn't fit unit testing well — would want Playwright + screenshot diffs if we wanted that, deferred).

---

## 3. Data flow: Resonance → Constellation

```
   User signs in
        │
        ▼
  Clerk session    ────────────────────────┐
                                            │
        │ getToken()                        │
        ▼                                    
  fetch GET /api/profile/export       
  Authorization: Bearer <token>
        │
        ▼
  Resonance Express server (Render)         
        ├── requireUser middleware: ensureUser(clerkId) → users.id
        ├── getActiveProfile(userId) → tasteProfiles row
        ├── listLibraryItems(userId).filter(source === "manual")
        │   (each item carries fitNote + tasteTags from AI annotation;
        │    watchlist items ship null/empty — no engagement to annotate)
        ├── recommendations.findMany + dedupe by mediaCacheId
        ├── derive favorites from profile.mediaAffinities[].favorites
        │   (cluster-tagged via title-substring match against evidence)
        └── derive avoidances from profile.avoidances + dislikedTitles
        │
        ▼
  JSON response: { profile, library, recommendations, favorites, avoidances }
        │
        ▼
  Constellation api.ts: filter recs by RENDERABLE_STATUSES
                        (drop "skipped" + "seen", keep
                         "pending" + "saved" + "rated" + "plan_to")
        │
        ▼
  useResonanceProfile hook: discriminated status union
  (idle | loading | ready | no-profile | error)
        │
        ▼
  Home route: pick top-N by signal strength
              (library by rating, recs by matchScore)
              favorites pass through uncapped
              + sample fallback with banner if no-profile/error
        │
        ▼
  buildGraph(profile, library, recommendations, favorites) → Graph
        │
        ▼
  ConstellationView: D3 simulation + SVG render
```

**Why filter `source === "manual"` server-side:** the user's `library_items` table can contain thousands of bulk-imported entries (Letterboxd, Goodreads, MAL, Steam). Those represent consumption history, not curated taste signal, and would overwhelm the visualization. The filter lives on the Resonance side so the network payload stays small (we don't ship 1600 items the client throws away).

**Why ship favorites as a derived field instead of just shipping the profile:** the profile JSONB already contains `mediaAffinities[].favorites` as flat title strings. Resonance's `/api/profile/export` derives the `Favorite[]` shape (title + mediaType + cluster-tagged themes/archetypes) so consumers don't have to redo the title-substring match against evidence. Constellation also has a client-side `deriveFavorites` helper used by the sample/demo path; both produce identical output. The pre-derivation is API contract clarity — if a future consumer wants this data, it doesn't have to reimplement the derivation.

**Why surface `avoidances`:** profile carries them but they were invisible before. Currently shipped through the type chain but not yet rendered — reserved for a future "anti-stars" / "negative space" layer in the constellation portrait.

**Why the volume cap on the client:** even after the manual filter, an active user's recs and high-rated library items can exceed the simulation's tuned range. Capping to top-40 library by rating + top-25 recs by matchScore keeps the simulation in its sweet spot while preserving the highest-signal subset. See `routes/Home.tsx`.

**Why drop `skipped` recs at the API boundary:** active rejection — no positive signal for a "what you're drawn to" map. `pending` recs DO carry signal (the AI predicted fit before you engaged), so they're kept.

**Why discriminated union for the hook:** `idle | loading | ready | no-profile | error` is exhaustive at the type level. Adding a new state forces TS to flag every consumer. The alternative (`{ data: T | null, error: E | null, loading: boolean }`) admits invalid combos like loading + data + error simultaneously.

---

## 4. Routes

Three routes, intentionally minimal:

| Path | Signed-in | Signed-out |
|------|-----------|------------|
| `/`  | `<Home>` (real data with sample fallback) | `<Landing>` (hero + CTAs) |
| `/demo` | `<Demo>` (always sample) | `<Demo>` (always sample) |
| `*`  | redirect to `/` | redirect to `/` |

**Why `/demo` exists:** for portfolio viewers who don't want to sign in. The sample profile is deliberately curated (`data/sampleProfile.ts`) — a coherent fictional taste that exercises every visual layer (cluster glow, edges, mixed media types, mixed statuses). The URL is shareable.

**Why `<SignedIn>`/`<SignedOut>` instead of redirecting:** Clerk renders nothing during auth-loading. A redirect-based gate would flash the wrong page during that ~100ms window. Conditional render keeps the screen blank until auth resolves, which reads as intentional.

---

## 5. The graph builder pipeline (`lib/graph.ts`)

This is the **most opinionated** code in the repo. Five stages, each motivated by a real failure mode observed during real-data testing.

### 5a. Title-substring matching (library items with empty tasteTags)

When a library item arrives with empty `tasteTags` — currently the case for watchlist items (Resonance skips AI annotation for plan-to-consume) and any pre-backfill rows — we determine cluster membership by checking which `profile.themes[i].evidence` strings mention the title. **Two-stage:**

1. **Direct substring**: `normalize(evidence).includes(normalize(title))`. Catches short titles like "Aftersun", "Paterson", "Vinland Saga".
2. **Token-overlap fallback** (when direct fails AND title has 2+ content tokens): match if any 2+ content tokens from the title appear as content tokens in the evidence text. Catches long titles like "The Assassination of Jesse James by the Coward Robert Ford" → matches evidence saying "Jesse James (4★)".

**Why a 2-token threshold:** a single common token ("the", "story") would trigger trivial matches. Two tokens makes the match meaningfully specific.

### 5b. Fuzzy tag matching (recommendations + library items with tasteTags)

For tagged items, we reconcile the AI-generated tag against canonical theme/archetype labels via three tiers in `matchLabel`:

1. **Exact normalized match** — happy path.
2. **Full-string substring** with min-4-char floor — catches concise forms (`"earned sacrifice"` ↔ `"earned sacrifice through sustained commitment"`).
3. **Content-word token overlap** with bidirectional within-token substring — catches single-word tags (`"burden"` → `"burden-carrying protagonist who earns their suffering through real choices"`) and morphology drift (`"noble"` → `"nobility..."`). Stopwords (the, of, as, …) are excluded so connective glue doesn't trigger matches.

**Why three tiers, not just exact match:** the AI is *instructed* to emit canonical labels verbatim, but in practice it paraphrases or shortens. Strict exact-match drops most real-data nodes. Each successive tier is a deliberate concession to AI variance.

**Why we accept some false-positive matches:** for visualization, an over-anchored node (placed in a vaguely-related cluster) is better than an unanchored node (visually meaningless floater).

### 5c. Drop unanchored nodes

After tagging, any node with `themes.length === 0 && archetypes.length === 0` is dropped. Without an anchor, the simulation's `forceX/Y` would target the canvas center, and a pile of unanchored nodes turns into a blob in the middle. Better to render fewer, well-clustered stars than a chaotic ball.

### 5d. Load-balanced primary-theme assignment

Each anchored node belongs to N theme clusters via `themes`. We need to pick ONE as the physical position (`primaryTheme`). **Naive: pick highest-weight theme.** This concentrates every multi-theme node in the user's top 2-3 themes, leaving 5+ clusters empty.

**Solution: greedy load-balanced.**
1. Sort nodes ascending by candidate count — most-constrained first.
2. For each node, pick the **least-populated** theme it qualifies for.
3. **Tiebreak by weight ASCENDING** (lower-weight first) — high-weight themes have many candidate nodes, so they'll fill up via other nodes' picks; reserving early ties for weak themes guarantees they each get a resident.

This algorithm is the difference between "5 clusters populated, 3 empty" and "all 8 clusters have residents" on a 13-node graph.

### 5e. Favorites integration

Favorites enter the graph builder *after* library + recs but *before* the unanchored-node drop. They're inserted with a synthetic id (`fav-<normalized-title>`) since favorites have no DB primary key — they live as flat strings in profile JSONB.

Insert order matters: `library → recommendations → favorites`. Earlier inserts win on title collision (dedupe by normalized title) since they carry richer data — a library item has rating + status + AI fitNote; a favorite is just a title string with cluster tags. If you have "Vinland Saga" both as a manual library item and as a favorite, the library node wins.

Favorites' `themes`/`archetypes` come pre-validated from Resonance — canonical labels, no fuzzy matching needed at this stage.

### 5f. Edge pruning

Pairwise edges are computed via shared theme/archetype overlap (`shared / max(a.tagcount, b.tagcount)`). All pairs with `strength >= MIN_EDGE_STRENGTH (0.4)` are candidates. Then a **top-K-per-node cap (4)** prunes: an edge survives if it falls in either endpoint's top-4 by strength. Asymmetric ties survive (popular nodes accept many connections; sparse nodes cap at 4).

**Why a per-node cap, not a global cap:** the visualization should reflect each node's *strongest* relationships, not have well-connected nodes hog the edge budget while sparse nodes have nothing.

---

## 6. The simulation (`components/constellation/ConstellationCanvas.tsx`)

D3 force simulation tuned for ~30-70 nodes. Five forces, ordered by importance:

| Force | Strength | Role |
|-------|----------|------|
| `forceX/Y` to primary cluster | 0.4 | The main attractor — pulls each node to its assigned cluster center |
| `forceCollide(NODE_RADIUS+8)` | 0.95 | Prevents nodes from stacking on top of each other |
| `forceManyBody` | -420 | Charge repulsion — gives clusters internal spacing |
| `forceLink` distance(140 + (1-s)*160) | 0.015 + s*0.05 | Weak link force — present so connected nodes drift slightly toward each other, but doesn't override cluster pull |
| Tick boundary clamp | — | Manual: zero velocity at canvas edges so nodes don't escape |

**Drift on rest:** `alphaTarget(0.012)` keeps the simulation ticking gently forever (nodes orbit slowly within their clusters instead of freezing). Set to 0 when `prefers-reduced-motion`.

**Why React renders, not D3 attribute updates:** the tick handler calls `setTick(t => t+1)` to force a React re-render, and SVG elements read `n.x` / `n.y` directly from simulation node data via React props. The alternative (D3 selection + .attr()) bypasses React's reconciliation, which clashes with our hover/select state being in React. The cost is acceptable at this node count; would NOT scale to 10k+ nodes.

**Drag attachment quirk:** `useEffect(() => { ... d3.select(svg).selectAll('.node').call(drag) })` runs after every render. D3's `.call(drag)` is idempotent — re-attaching is cheap. This guards against React reconciliation re-creating node DOM elements (which would silently drop the previous drag binding).

**Selector is `.node`, not `circle.node`** — node glyphs vary by media type (circle, rect, polygon). The shape lives inside a `<g class="node">` wrapper that hosts `data-id` and the drag/click/hover handlers.

---

## 7. Render layers (SVG composition)

The SVG tree is built in stacking order — earlier layers paint underneath later ones:

```
<svg>
  <defs>
    <radialGradient id="cluster-glow-N"/> ×8
    <filter id="node-halo"/>
    <filter id="node-glow-strong"/>
  </defs>

  <g className="zoom-layer" transform={d3.zoomTransform}>
    <g className="starfield">          {/* 124 ambient bg stars, color-tinted */}
    <g className="clusters">            {/* radial-gradient glows + invisible hit areas */}
    <g className="cluster-labels">     {/* radial-positioned labels with stroke-bg */}
    <g className="node-halos">          {/* blurred glow circles behind nodes */}
    <g className="edges">               {/* quadratic-bezier paths, theme-tinted */}
    <g className="nodes">               {/* per-format glyphs in <g class=node> */}
  </g>

  {selectedNode && <circle/>}            {/* dashed selection ring (outside zoom layer) */}
  {hoveredNode && <foreignObject/>}      {/* tooltip (outside zoom layer) */}
  <Reset button>                          {/* HTML overlay */}
</svg>
```

**Why selection ring + tooltip live OUTSIDE the zoom layer:** they should NOT scale with zoom. Their position is computed via `transform.applyX(node.x)` so they track the zoomed node position, but their size and stroke width stay constant in screen pixels.

**Why split cluster glow into visual + hit circles:** cluster glow circles have `pointerEvents:none` and a large radius (the visual). A separate, smaller (`min(radius, 110)px`) invisible circle handles hover hit-detection. Without this split, mousemoves between adjacent clusters' overlapping glows triggered constant hover-flicker.

**Per-format glyphs:** circle (movie), rounded square (tv), hexagon (anime), diamond (game), portrait rect (manga), tall narrow rect (book). Sizes are tuned so each shape has roughly equal visual area — variation reads as identity, not size. Sized further by signal strength (rating for library, matchScore for recs) in a narrow 0.85-1.2× range.

**Cluster labels: radial outward positioning.** Adjacent labels at the bottom of every cluster overlapped each other badly. Now each label is projected along the unit vector from canvas center → cluster, past the glow's outer edge, with `text-anchor` swinging start/middle/end based on horizontal position. Long labels wrap to 2 lines via `wrapClusterLabel`.

**Galaxy mode + ClusterPanel:** when the user clicks a cluster label or zooms in past the focus threshold, the canvas enters "galaxy mode" — the focused cluster takes visual prominence, others dim. The canvas mirrors the focused-cluster state up via `onFocusedClusterChange`, and `ConstellationView` renders a `ClusterPanel` (slide-in from the left, mirror to the node `DetailPanel` on the right) showing the theme's AI-generated `evidence` text + member count. Closing the panel calls `clearClusterFocus()` on the canvas handle, which resets zoom + clears focus.

**Why cluster-level rationale, not per-item:** the previous "Why this fits" surface in the node detail panel only had data for ~20% of items (consumed library + recs); rendering it inconsistently read as broken on the empty 80%. Theme `evidence` exists for every cluster, so cluster-level rationale is consistent. The per-item `explanation`/`fitNote` data still flows through the type chain — kept for a possible future hover/tooltip surface — but isn't currently displayed.

---

## 8. Auth (Clerk)

Same `pk_test_*` publishable key as Resonance. Sessions are **per-domain**, not per-Clerk-app — so signing in to localhost:5174 does NOT sign you into resonance-client.vercel.app, even though they share the same Clerk app. Once you sign in to BOTH separately, your `userId` is the same on both sides (because Clerk treats the two sessions as the same identity).

The client sends `Authorization: Bearer <getToken()>` to `/api/profile/export`. Resonance's `requireUser` middleware verifies the token and resolves it to a `users.id` (Resonance has a local users table mirroring Clerk identities). The `tasteProfiles.userId` foreign-keys to that local id, NOT to the Clerk id.

**Why Clerk vs. building our own auth:** zero-config OAuth + email/password + magic link, free up to 10k MAU, the right choice for a portfolio piece where auth is incidental to the demo. Resonance picked Clerk first; Constellation matches.

**CORS:** Resonance's CORS middleware reads `FRONTEND_ORIGIN` from env, comma-separated. For local dev against prod Resonance, `http://localhost:5174` is appended to the prod allowlist on Render. The middleware short-circuits OPTIONS with 204 for preflight handling.

---

## 9. Open design questions

Things flagged but NOT decided. Surfacing them so a future contributor (or future-me) doesn't quietly resolve them by accident.

### 9a. Cluster layout — resolved (force-directed)

Was: uniform circular orbit. Now: force-directed placement in a small auxiliary D3 simulation (in `lib/graph.ts:placeClusters`). Each theme is a body with weight-derived charge (heavier themes repel more), collide enforces minimum spacing equal to render radius + margin, and a weak center force keeps the constellation centered. Initial positions seeded from a hash of theme labels — same profile produces the same layout across reloads.

Cluster size has two modes (toggle in FilterBar):
- `weight` (default): radius = 45 + theme.weight × 55. Reflects how strongly the theme matters in the user's profile.
- `members`: radius = 38 + min(memberCount, 8) × 9. Reflects how many titles populate the cluster.

### 9b. Density (20-40 nodes) — addressed

Resolved by Resonance-side Phase 1 + 2 (see `Resonance/CONSTELLATION_EXPORT_PLAN.md`). Active user now sees: ~10 manual library items (with AI-generated `fitNote` + canonical `tasteTags`) + ~5 recs + ~25 favorites − dedupe overlap = ~35-40 nodes. Re-evaluate density tuning if real-world numbers come in significantly higher or lower.

**Avoidances (`pattern` + `title`)** ship through the type chain but are not yet rendered. A future "anti-stars" or "negative space" layer should consume them — see open question 9d.

### 9c. Anti-stars rendering

`avoidances: Avoidance[]` arrives in the export but isn't visualized. A coherent rendering would surface them as desaturated/dashed/X'd-out nodes, possibly on a separate plane behind the main constellation, or as a peripheral ring labeled "outside your taste". Don't build speculatively — design first when surfacing them becomes the next user request.

### 9c. Layout for sparse profiles

A brand-new Resonance user might have only 2-3 themes and 4-5 nodes. The current layout assumes ≥6 themes. Below that threshold, the orbit math degenerates (clusters overlap, labels collide). Not addressed; tracked as a known edge case.

### 9d. Mobile

Current layout assumes ≥768px width. Mobile is unaddressed. The detail panel slides in at 400px which already breaks at narrow viewports. Punt until desktop story is complete.

---

## 10. Tooling & quality bar

- **Typecheck**: `pnpm typecheck` (`tsc -b --noEmit`). Required green before commits to main.
- **Tests**: `pnpm test` (vitest). Currently only `lib/graph.ts` is unit-tested. Visual regressions are not caught by tests; they're caught by manual screenshot review.
- **Lint**: `pnpm lint` (eslint flat config). Auto-fix via `pnpm lint:fix`.
- **Format**: `pnpm format` (prettier). Auto-format via `pnpm format:write`. Tailwind classes sorted via `prettier-plugin-tailwindcss`.
- **All-in-one check**: `pnpm check` runs typecheck + lint + test. Use before pushing.
- **Build**: `pnpm build` (`tsc -b && vite build`). Production output ~420KB / ~129KB gzipped.

CI is not configured yet — `pnpm check` is the manual gate. Add GitHub Actions before opening Constellation up to outside contributors.

---

## 11. Deployment

- **Frontend host:** Vercel (planned — not yet deployed at time of writing).
- **Backend dependency:** Resonance API at `https://resonance-server-t4r8.onrender.com`. Constellation reads `VITE_RESONANCE_API_URL` from env.
- **Required env vars:**
  - `VITE_CLERK_PUBLISHABLE_KEY` — same value Resonance uses
  - `VITE_RESONANCE_API_URL` — Resonance API base URL
- **CORS dependency:** the Constellation prod URL must be appended to the Resonance backend's `FRONTEND_ORIGIN` env on Render before prod-to-prod calls work.
- **SPA fallback:** Vercel needs `vercel.json` with a rewrite so `/demo` and any future routes resolve to `index.html` on direct hit. Not yet added.

---

## Glossary

- **Cluster** — visual representation of a TasteTheme. Has `centerX/Y`, `radius`, `color`, `weight`, `memberNodeIds`. Rendered as a radial gradient + label.
- **Primary theme** — the single theme cluster a node is *positioned at*. Distinct from `themes` (full membership, used for hover-highlight + edges). Assigned via load-balanced greedy.
- **Drift on rest** — alphaTarget > 0 keeps the simulation ticking, so nodes orbit slowly within their clusters instead of freezing into a static layout.
- **Galaxy mode** — when zoom level exceeds a threshold and a single cluster fills the viewport, the camera enters "galaxy mode" — other clusters dim, the focused cluster gets a stronger vignette, and any zoomed-in interaction stays scoped to the cluster.
- **Anchored node** — has at least one matched theme or archetype. Unanchored nodes are dropped at build time.
