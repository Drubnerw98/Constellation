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
│   │   │   ├── ConstellationCanvas.tsx    # orchestrator — owns refs, view state, wiring
│   │   │   ├── ClusterPanel.tsx           # slide-in (left) when galaxy mode is active
│   │   │   ├── DetailPanel.tsx            # slide-in (right) for selected node
│   │   │   └── canvas/
│   │   │       ├── helpers.ts             # constants, seededStars, wrapClusterLabel, etc.
│   │   │       ├── glyph.tsx              # per-format node glyph
│   │   │       ├── hooks.ts               # useForceSimulation/NodeDrag/ZoomBehavior/Fade-in
│   │   │       ├── BackgroundLayers.tsx   # Defs + Nebula + Starfield + Flares + AntiStars
│   │   │       ├── Clusters.tsx           # ClusterGlows + ClusterLabels
│   │   │       ├── Graph.tsx              # Edges + NodeHalos + Nodes
│   │   │       └── Overlays.tsx           # SelectedRing + NodeTooltip + ResetButton
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

Four routes, intentionally minimal:

| Path | Signed-in | Signed-out |
|------|-----------|------------|
| `/`  | `<Home>` (real data with sample fallback) | `<Landing>` (hero + CTAs) |
| `/demo` | `<Demo>` (always sample) | `<Demo>` (always sample) |
| `/diff` | `<Diff>` (animated profile-version diff) | `<Landing>` |
| `*`  | redirect to `/` | redirect to `/` |

**Why `/demo` exists:** for portfolio viewers who don't want to sign in. The sample profile is deliberately curated (`data/sampleProfile.ts`) — a coherent fictional taste that exercises every visual layer (constellation lines, cluster glow on focus, edges on selection, anti-stars at the perimeter, mixed media types, mixed statuses). The URL is shareable.

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

Pairwise edges are computed via shared theme/archetype overlap (`shared / min(a.tagcount, b.tagcount)`). Min-normalization captures "how well the smaller node fits inside the larger's space" — a single-tag node sharing its only theme with a 5-tag partner scores 1.0, not 0.2 (which would always prune). All pairs with `strength >= MIN_EDGE_STRENGTH (0.4)` are candidates. Then a **top-K-per-node cap (3)** prunes: an edge survives if it falls in either endpoint's top-3 by strength. Asymmetric ties survive (popular nodes accept many connections; sparse nodes cap at 3).

**Why a per-node cap, not a global cap:** the visualization should reflect each node's *strongest* relationships, not have well-connected nodes hog the edge budget while sparse nodes have nothing.

---

## 6. The simulation (`components/constellation/ConstellationCanvas.tsx`)

D3 force simulation tuned for ~30-70 nodes. Five forces, ordered by importance:

| Force | Strength | Role |
|-------|----------|------|
| `forceX/Y` to primary cluster | 0.38 | The main attractor — pulls each node toward its assigned cluster center without crushing it to the middle, so members spread to fill the cluster radius |
| `forceCollide(NODE_RADIUS+14)` | 0.95 | Prevents nodes from stacking on top of each other; widened from +8 so members have visible breathing room within the cluster |
| `forceManyBody` | -560 | Charge repulsion — gives clusters internal spacing; bumped from -420 alongside the lighter center pull |
| `forceLink` distance(140 + (1-s)*160) | 0.015 + s*0.05 | Weak link force — present so connected nodes drift slightly toward each other, but doesn't override cluster pull |
| Tick boundary clamp | — | Manual: zero velocity at canvas edges so nodes don't escape |

**Drift on rest:** `alphaTarget(0.03)` keeps the simulation ticking gently forever (nodes orbit slowly within their clusters instead of freezing). Set to 0 when `prefers-reduced-motion`.

**Why React renders, not D3 attribute updates:** the tick handler calls `setTick(t => t+1)` to force a React re-render, and SVG elements read `n.x` / `n.y` directly from simulation node data via React props. The alternative (D3 selection + .attr()) bypasses React's reconciliation, which clashes with our hover/select state being in React. The cost is acceptable at this node count; would NOT scale to 10k+ nodes.

**Drag attachment quirk:** `useEffect(() => { ... d3.select(svg).selectAll('.node').call(drag) })` runs after every render. D3's `.call(drag)` is idempotent — re-attaching is cheap. This guards against React reconciliation re-creating node DOM elements (which would silently drop the previous drag binding).

**Selector is `.node`, not `circle.node`** — node glyphs vary by media type (circle, rect, polygon). The shape lives inside a `<g class="node">` wrapper that hosts `data-id` and the drag/click/hover handlers.

---

## 7. Render layers (SVG composition)

The SVG tree is built in stacking order — earlier layers paint underneath later ones. The 2026-05-10 Phase 4 rework reordered the cluster identity layers: the cluster-glow bubbles dropped from primary visual to a focus-state indicator, and a new constellation-lines layer (per-cluster minimum spanning tree) became the primary carrier of cluster shape.

```
<svg>
  <defs>
    <radialGradient id="cluster-grad-N"/> ×N        {/* per-theme glow gradients */}
    <radialGradient id="nebula-*"/>                  {/* twilight / aurora / teal / warm */}
    <radialGradient id="vignette"/>                  {/* edge darkening */}
    <filter id="node-halo"/>
    <filter id="node-glow-strong"/>
    <filter id="label-shadow"/>                      {/* dark halo behind cluster labels */}
  </defs>

  <g className="zoom-layer" transform={d3.zoomTransform}>
    <g className="nebula">                {/* 10 large gradient blobs, cosmic atmosphere */}
    <g className="star-flares">           {/* anchor stars with diffraction spikes */}
    <g className="starfield">             {/* 1200 stars, opacity-breathing */}
    <g className="anti-stars">            {/* disliked titles as perimeter X marks */}
    <g className="clusters">              {/* glow gradient circles (faint by default,
                                              brighten on hover/focus) + hit areas */}
    <g className="constellation-lines">   {/* per-cluster MST, primary cluster visual */}
    <g className="edges">                 {/* bezier paths for the focused node only */}
    <g className="node-halos">            {/* blurred glow circles behind nodes */}
    <g className="nodes">                 {/* per-format glyphs */}
    <g className="cluster-labels">        {/* labels painted on top so node drift
                                              never buries them */}
  </g>

  {selectedNode && <circle/>}            {/* dashed selection ring (outside zoom layer) */}
  {hoveredNode && <foreignObject/>}      {/* tooltip (outside zoom layer) */}
  <Vignette/>                            {/* fixed-viewport edge darken */}
  <Reset button>                          {/* HTML overlay */}
</svg>
```

**Constellation lines as primary cluster visual.** Each theme's members are connected by a minimum spanning tree (Kruskal's with union-find, computed once 1.2s post-mount in `useEffect`, then frozen — `computeClusterMST` in `canvas/helpers.ts`). The line endpoints track current node positions every render so they follow the slow drift of the force-sim, but the topology stays stable so the figure shape doesn't twitch. This reads as a star chart: each theme is a connected asterism rather than a colored bubble. The previous always-visible cluster-glow bubble created a "blob chart" feel; recessing it solved that.

**Dedup against cross-cluster edges.** When an MST line connects the same pair of nodes as a cross-cluster bezier edge (typical when two nodes share more than one theme), the bezier skips drawing unless the edge is actively highlighted. A shared `mstPairs: Set<string>` of normalized pair keys flows from the parent into `<Edges>` for the check.

**Cluster glow as focus-state indicator.** The cluster gradient circles still render but default to ~0.10 opacity. Hover bumps to 0.55, focus (galaxy mode) to 1.0. Now a hint of "where the cluster lives" without competing with the constellation lines as the primary carrier of cluster identity.

**Why selection ring + tooltip live OUTSIDE the zoom layer:** they should NOT scale with zoom. Their position is computed via `transform.applyX(node.x)` so they track the zoomed node position, but their size and stroke width stay constant in screen pixels.

**Why split cluster glow into visual + hit circles:** cluster glow circles have `pointerEvents:none` and a large radius (the visual). A separate, smaller (`min(radius, 110)px`) invisible circle handles hover hit-detection. Without this split, mousemoves between adjacent clusters' overlapping glows triggered constant hover-flicker.

**Per-format glyphs:** circle (movie), rounded square (tv), hexagon (anime), diamond (game), portrait rect (manga), tall narrow rect (book). Sizes are tuned so each shape has roughly equal visual area — variation reads as identity, not size. Sized further by signal strength (rating for library, matchScore for recs) in a narrow 0.85-1.2× range.

**Cluster labels: anchored below the cluster centroid.** The earlier radial-from-canvas-center formula stacked labels on the same axis when clusters sat in the same direction, producing visible label-on-label overwrites. Labels now anchor at `cluster.centerY + cluster.radius * 1.4` (flipping above for clusters near the bottom edge). Different cluster X positions naturally give different label X positions. Painted in the last SVG layer so node drift can't bury the text; backed by an additive `label-shadow` SVG filter + 6px stroke for legibility against any layer beneath.

**Edges: focus-only.** Cross-cluster bezier edges render only for the focused (selected or hovered) node. The previous "show all connections" toggle was removed in the Phase 4 pass because the full-mesh view fought the constellation lines for primacy and never read well. When a node is focused: its specific edges pop on top, the rest of the canvas dims, and MST collapses to only the focused node's primary-theme cluster so the user sees a clean view of that node's web.

**Galaxy mode + ClusterPanel:** when the user clicks a cluster label or zooms in past the focus threshold, the canvas enters "galaxy mode" — the focused cluster's glow brightens, others dim. The canvas mirrors the focused-cluster state up via `onFocusedClusterChange`, and `ConstellationView` renders a `ClusterPanel` (slide-in from the left, mirror to the node `DetailPanel` on the right) showing the theme's summary text, anchor titles, and reinforcing titles. The panel's content blocks stagger in via a `panel-rise` keyframe (60/160/260ms delays) so the reveal feels composed rather than wholesale. Closing the panel calls `clearClusterFocus()` on the canvas handle, which resets zoom + clears focus.

**Why cluster-level rationale, not per-item:** the previous "Why this fits" surface in the node detail panel only had data for ~20% of items (consumed library + recs); rendering it inconsistently read as broken on the empty 80%. Theme `evidence` exists for every cluster, so cluster-level rationale is consistent. The per-item `explanation`/`fitNote` data still flows through the type chain — kept for a possible future hover/tooltip surface — but isn't currently displayed.

---

## 7b. Version diff (`/diff`)

The diff route is a stretch feature — animated layout morph between two
historical profile versions. Resonance mints a new profile version at
onboarding completion, after a feedback batch reshapes the profile, or on
manual edit. Resonance exposes:

- `GET /api/profile/versions` → `ProfileVersion[]` (`{ id, trigger, createdAt }`)
- `GET /api/profile/versions/:versionId/export` → same shape as `/api/profile/export`

`src/lib/api.ts:fetchVersions` + `fetchVersionExport` wrap these. The Diff
route defaults to the latest two versions (N and N-1) and falls through to
an empty state when only one version exists.

**`src/lib/diffGraph.ts:buildDiffGraph(fromExport, toExport)`** builds two
underlying graphs via `buildGraph` and partitions:

- **Clusters** (by normalized theme label): `shared` (in both), `addedTo`
  (only in `to`), `removedFrom` (only in `from`).
- **Nodes** (by canonicalized title — not db id, since favorites have
  synthetic ids and library/rec database ids may differ across versions):
  `stable` (both endpoints captured so the renderer can lerp positions +
  surface cluster migration via `primaryTheme` differing), `added`
  (`to`-only), `removed` (`from`-only).

**Why not "morph" categorical changes:** a theme that exists in version N
but not N-1 is a discrete fact about the profile. Smoothly interpolating
its cluster glow from radius 0 implies a continuous change that didn't
happen. We stage categorical changes explicitly via opacity ramps so the
viewer reads "this is new" / "this is gone" instead of "this got bigger".

**`src/components/constellation/DiffCanvas.tsx`** is the render. Two D3
force simulations are settled offscreen at mount via `settleSimulation`
(350 ticks, `alphaTarget=0`). Positions for stable nodes are captured into
`{ fromX, fromY, toX, toY }` and the scrub-driven render lerps between
them. Added nodes pin at `toX/toY` with an opacity ramp from `scrub=0.3
→ 1`; removed nodes pin at `fromX/fromY` with `1 → 0` over `scrub=0..0.7`.
Cluster glow centers + radii lerp for shared, opacity-ramp for categorical.

Edges cross-fade — `from`-edges visible scrub `< 0.6`, `to`-edges visible
scrub `> 0.4`, with a band of overlap. Documented in `DiffCanvas` that
per-stable-edge endpoint interpolation was rejected; the gain wasn't worth
the cost of title-keyed edge matching across two graphs.

**Why two parallel sims, not one with target swap:** the live canvas's
simulation uses cluster centers as `forceX/forceY` targets, so swapping
the cluster set mid-flight would yank everything across the canvas at
once. Two sims settled separately captures each layout's organic shape;
the slider then interpolates between captures. The cost is two sim runs
on mount; the render loop itself is cheap (just lerps).

**Reduced motion:** slider is replaced with `From` / `To` snap buttons.
Same rendering path, just `scrub ∈ {0, 1}` discretely.

**Mobile:** `<768px` shows a "compare on a larger screen" hint. Architecture
is desktop-first — the slider + canvas combo doesn't fit narrow viewports
and contorting it would compromise both ends.

**Resonance library/recs scope caveat:** the versioned export endpoint
returns the user's CURRENT library + recs alongside the historical
profile (this is a Resonance-side design choice — library/recs aren't
snapshotted per-version). So the diff between versions shows
**cluster-membership changes**, not library or rec set changes. The
visualization highlights "the same title moved between themes" rather
than "this title was added to your library since N-1" — which is the
right framing anyway, since the profile IS the thing that versions.

## 8. Auth (Clerk)

Same `pk_test_*` publishable key as Resonance. Sessions are **per-domain**, not per-Clerk-app — so signing in to localhost:5174 does NOT sign you into resonance-client.vercel.app, even though they share the same Clerk app. Once you sign in to BOTH separately, your `userId` is the same on both sides (because Clerk treats the two sessions as the same identity).

The client sends `Authorization: Bearer <getToken()>` to `/api/profile/export`. Resonance's `requireUser` middleware verifies the token and resolves it to a `users.id` (Resonance has a local users table mirroring Clerk identities). The `tasteProfiles.userId` foreign-keys to that local id, NOT to the Clerk id.

**Why Clerk vs. building our own auth:** zero-config OAuth + email/password + magic link, free up to 10k MAU, the right choice for a portfolio piece where auth is incidental to the demo. Resonance picked Clerk first; Constellation matches.

**CORS:** Resonance's CORS middleware reads `FRONTEND_ORIGIN` from env, comma-separated. For local dev against prod Resonance, `http://localhost:5174` is appended to the prod allowlist on Render. The middleware short-circuits OPTIONS with 204 for preflight handling.

---

## 9. Open design questions

Things flagged but NOT decided. Surfacing them so a future contributor (or future-me) doesn't quietly resolve them by accident.

### 9a. Cluster layout — resolved (spiral seed + force-resolved overlaps)

Originally: uniform circular orbit. Then: pure force-directed placement with random initial positions. Now (2026-05-10 Phase 4): **Fibonacci spiral seeding ordered by theme weight**, then a short force-sim that only resolves collision overlaps.

Themes are ranked by weight descending. The heaviest theme is placed at the canvas center; each subsequent theme is positioned on a golden-angle spiral with radius growing as `sqrt(rank) × spiralScale`. The force-sim then runs for 180 ticks (down from 400) with reduced charge (-1200 - w×1200, down from -1800 - w×1800) and a very weak center pull (0.01) — just enough to bump overlapping cluster glows apart without unwinding the spiral's heavy-themes-anchor-inward character.

The defensible design call: **weight has visual gravity.** A dominant theme reads as the anchor of the constellation, peripheral themes orbit outward. A reviewer flipping between two profiles sees the visual barycenter shift with the underlying weight distribution. Replaces the previous force-only layout where cluster positions read as arbitrary geometric spacing.

Cluster size: `radius = 45 + theme.weight × 55`. The previous "weight vs members" toggle was removed — cluster radius no longer carries visual weight (the glow bubble is hidden by default; constellation lines and node tints carry cluster identity now), and the radius only governs label-distance and the (faint) glow size.

### 9b. Density (20-40 nodes) — addressed

Resolved by Resonance-side Phase 1 + 2 (see `Resonance/CONSTELLATION_EXPORT_PLAN.md`). Active user now sees: ~10 manual library items (with AI-generated `fitNote` + canonical `tasteTags`) + ~5 recs + ~25 favorites − dedupe overlap = ~35-40 nodes. Re-evaluate density tuning if real-world numbers come in significantly higher or lower.

**Avoidances (`pattern` + `title`)** ship through the type chain but are not yet rendered. A future "anti-stars" or "negative space" layer should consume them — see open question 9d.

### 9c. Anti-stars rendering — partial

Disliked titles (avoidance kind === "title") render as muted X glyphs at the canvas perimeter, in the negative space outside the cluster orbits. Layer sits between starfield and clusters; dims further in galaxy mode to give the focused cluster prominence. Native SVG `<title>` provides hover affordance.

Pattern avoidances (kind === "pattern", abstract — "Mary Sue protagonists who face no real cost") are NOT yet surfaced visually — they don't have a title to attach to. Future surface options: a footer strip with mono captions, a toggleable panel, or per-cluster relevance in the cluster panel.

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

CI is configured via `.github/workflows/check.yml` — runs `typecheck`, `lint`, `test`, and `build` on every push to main and on every PR. Uses pnpm 10, Node 22, frozen lockfile.

---

## 11. Deployment

- **Frontend host:** Vercel.
- **Backend dependency:** Resonance API at `https://resonance-server-t4r8.onrender.com`. Constellation reads `VITE_RESONANCE_API_URL` from env.
- **Required env vars (set in Vercel project settings):**
  - `VITE_CLERK_PUBLISHABLE_KEY` — same value Resonance uses
  - `VITE_RESONANCE_API_URL` — Resonance API base URL
  - `VITE_RESONANCE_FRONTEND_URL` — Resonance frontend URL for `<ClusterPanel/>` deep links (`/recommendations?prompt=...`); distinct from the API URL because the deep link targets the web app, not the API. Falls back to the prod URL with a console warning if unset.
- **CORS dependency:** the Constellation prod URL must be appended to the Resonance backend's `FRONTEND_ORIGIN` env on Render (comma-separated) before prod-to-prod calls work.
- **SPA fallback:** `vercel.json` rewrites any path without a dot to `/` so `/demo` and future routes resolve to `index.html` on direct hit. Static assets (anything with a dot — `.svg`, `.js`, `.css`) are unaffected.

---

## Glossary

- **Cluster** — visual representation of a TasteTheme. Has `centerX/Y`, `radius`, `color`, `weight`, `memberNodeIds`. Rendered as a radial gradient + label.
- **Primary theme** — the single theme cluster a node is *positioned at*. Distinct from `themes` (full membership, used for hover-highlight + edges). Assigned via load-balanced greedy.
- **Drift on rest** — alphaTarget > 0 keeps the simulation ticking, so nodes orbit slowly within their clusters instead of freezing into a static layout.
- **Galaxy mode** — when zoom level exceeds a threshold and a single cluster fills the viewport, the camera enters "galaxy mode" — other clusters dim, the focused cluster gets a stronger vignette, and any zoomed-in interaction stays scoped to the cluster.
- **Anchored node** — has at least one matched theme or archetype. Unanchored nodes are dropped at build time.
