# CLAUDE.md — Constellation

## Project overview

An interactive, explorable visualization of a user's media taste profile. Takes a TasteProfile from Resonance (via shared Clerk auth + API) and renders it as a force-directed constellation map — themes as nebula clusters, individual titles as stars, connections between works as orbital lines showing shared archetypes and thematic threads. Hovering, clicking, zooming, and filtering all feel fluid and physical.

This is a **frontend-craft portfolio project** — the emphasis is on visual polish, animation quality, interaction design, and the feeling of exploring your own taste as a spatial experience. Minimal backend, no AI, no database. The interesting engineering is all in the browser.

**Pair project with [Resonance](https://github.com/Drubnerw98/Resonance)** — a cross-format AI recommendation engine that builds the taste profiles Constellation visualizes.

## The Connection to Resonance

Both apps share the same **Clerk application** for auth. A user signed into Constellation is the same user in Resonance. This means:

1. User signs into Constellation via Clerk (same Google/GitHub OAuth they used for Resonance)
2. Constellation calls Resonance's API with the Clerk session token
3. Resonance returns the user's TasteProfile, library items, and recommendation history
4. Constellation renders the visualization from that data

### Required: Add a public API endpoint to Resonance

Before building Constellation, add one endpoint to the Resonance backend:

```
GET /api/profile/export
Authorization: Bearer <clerk_token>

Response: {
  profile: TasteProfile,
  library: LibraryItem[],       // title, mediaType, rating, source
  recommendations: {             // aggregated, not per-batch
    title: string,
    mediaType: string,
    matchScore: number,
    tasteTags: string[],
    status: "saved" | "skipped" | "rated" | "plan_to",
    rating: number | null
  }[]
}
```

This is the only backend change to Resonance. Constellation is otherwise a standalone app.

### Fallback: Manual import

For users without a Resonance account (or for demo purposes), support pasting a TasteProfile JSON directly or loading a sample profile. This ensures the project works standalone for portfolio demos.

## Stack

- **Framework:** React 19 + TypeScript, Vite
- **Visualization:** D3.js for the force simulation + SVG rendering. If performance demands it, consider Three.js for WebGL rendering, but start with D3 — SVG is easier to style and animate, and the node count (~50-200) should be fine.
- **Animation:** Framer Motion for UI transitions, D3's force simulation for physics
- **Styling:** Tailwind CSS
- **Auth:** Clerk (same app as Resonance, shared publishable key)
- **Hosting:** Vercel
- **Package manager:** pnpm

No database. No backend beyond a Vite dev server. All state lives in memory during a session.

## The Visualization — What It Looks Like

### The Map

Imagine a dark canvas (space-themed, subtle star field background). On it:

- **Theme clusters** are nebula-like regions — soft, glowing areas of color. Each theme from the TasteProfile ("earned sacrifice through sustained commitment", "accountability without redemption shortcuts") gets a distinct hue and occupies a region of the map. The cluster's size reflects the theme's weight.

- **Title nodes** are stars. Every title from the user's library and recommendations is a point on the map. They're positioned by D3's force simulation, attracted toward the theme clusters they match (via tasteTags) and repelled from unrelated clusters. Size reflects rating (if available) or match score. Brightness reflects engagement (rated > saved > recommended > plan_to).

- **Connection lines** are orbital threads between titles that share archetypes or themes. If "Vinland Saga" and "Red Rising" both map to "earned sacrifice through sustained commitment" and "burden-carrying protagonist," they're connected by a faint line. Hovering over the line shows the shared DNA.

- **Format encoding** — each media type has a distinct shape or glow color:
  - Movies: circle
  - TV: circle with ring
  - Anime: diamond
  - Manga: diamond with ring
  - Games: hexagon
  - Books: square

### Interactions

**Hover on a title node:**
- Node brightens and enlarges slightly
- All connections from that node highlight
- A tooltip shows: title, format, year, rating/match score, and the themes/archetypes it connects to
- Connected nodes also brighten subtly (showing the "neighborhood")

**Click on a title node:**
- Smooth zoom into that region of the map
- Expanded detail panel slides in from the side showing: full metadata, the recommendation explanation (if from Resonance), all connected titles, all matching themes
- The rest of the map dims but stays visible

**Hover on a theme cluster:**
- All titles in that cluster brighten
- Cluster label and description appear
- Titles NOT in that cluster dim

**Click on a theme cluster:**
- Zoom into the cluster
- Titles within it rearrange for readability
- Sub-connections between titles in the cluster become more visible

**Zoom and pan:**
- Scroll to zoom, drag to pan (standard map controls)
- Smooth momentum-based scrolling
- Minimap in corner showing your viewport position on the full constellation

**Filter controls (sidebar or top bar):**
- Toggle formats on/off (show only games, show only anime + manga, etc.)
- Filter by theme (highlight one theme's constellation)
- Filter by rating (only show 4+ star items)
- Filter by status (library vs recommendations vs watchlist)
- Search: type a title name, map smoothly pans and zooms to that node

### The Physics

D3's forceSimulation with:
- **forceCenter** — keeps the whole constellation roughly centered
- **forceManyBody** — nodes repel each other (prevents overlap)
- **forceLink** — connected nodes attract gently (shared-theme pairs cluster naturally)
- **forceX/forceY** — theme clusters have gravity wells that pull their member nodes toward a region
- **forceCollide** — prevents node overlap based on node radius

The simulation should feel organic — nodes drift slightly even at rest, like stars with slow orbital movement. Not frozen, not chaotic. Gentle.

### Visual Polish Targets

- **Glow effects** on nodes and cluster regions (CSS/SVG filters, not overdone)
- **Smooth transitions** when filtering — nodes that are filtered out should fade and drift away, not disappear instantly
- **Color palette** should feel like a night sky — dark background, nodes in warm whites/golds/blues, theme clusters in distinct but harmonious hues (teal, amber, coral, violet, emerald, rose)
- **Loading state** — when the profile is being fetched, show stars appearing one by one with a subtle twinkle animation
- **Empty state** — if no profile is connected, show a dark sky with a gentle prompt: "Connect your Resonance profile to see your constellation" with a sign-in button
- **Responsive** — works on desktop (primary) and tablet. Mobile can show a simplified version or a "best viewed on desktop" note.

## Project Structure

```
src/
├── components/
│   ├── constellation/
│   │   ├── ConstellationCanvas.tsx  # Main D3 visualization
│   │   ├── TitleNode.tsx            # Individual star node
│   │   ├── ThemeCluster.tsx         # Nebula region
│   │   ├── ConnectionLine.tsx       # Orbital thread between nodes
│   │   ├── Tooltip.tsx              # Hover tooltip
│   │   ├── DetailPanel.tsx          # Click-expanded detail view
│   │   └── Minimap.tsx              # Corner viewport indicator
│   ├── controls/
│   │   ├── FilterBar.tsx            # Format/theme/rating filters
│   │   ├── SearchInput.tsx          # Title search with pan-to
│   │   └── Legend.tsx               # Format shape/color legend
│   ├── layout/
│   │   ├── Nav.tsx                  # Top nav with Clerk auth
│   │   ├── Sidebar.tsx              # Optional info sidebar
│   │   └── LandingPage.tsx          # Signed-out state
│   └── shared/
│       └── LoadingStars.tsx         # Loading animation
├── hooks/
│   ├── useResonanceProfile.ts       # Fetch profile from Resonance API
│   ├── useForceSimulation.ts        # D3 force simulation setup
│   ├── useZoomPan.ts                # Zoom/pan controls
│   └── useFilters.ts                # Filter state management
├── lib/
│   ├── graph.ts                     # Transform TasteProfile → graph nodes/edges
│   ├── colors.ts                    # Theme → color mapping, format → shape
│   ├── physics.ts                   # Force simulation config
│   └── api.ts                       # Resonance API client with Clerk token
├── types/
│   └── graph.ts                     # GraphNode, GraphEdge, ClusterRegion types
├── App.tsx
└── main.tsx
```

## Key Types

```typescript
interface GraphNode {
  id: string;
  title: string;
  mediaType: "movie" | "tv" | "anime" | "manga" | "game" | "book";
  year: number | null;
  rating: number | null;
  matchScore: number | null;
  status: "library" | "saved" | "skipped" | "rated" | "plan_to";
  themes: string[];         // theme labels this title connects to
  archetypes: string[];     // archetype labels
  source: "library" | "recommendation";
  // D3 force simulation adds x, y, vx, vy at runtime
}

interface GraphEdge {
  source: string;           // node id
  target: string;           // node id
  sharedThemes: string[];   // what connects them
  sharedArchetypes: string[];
  strength: number;         // 0-1, drives link force
}

interface ThemeCluster {
  label: string;
  weight: number;
  color: string;            // assigned hue
  centerX: number;          // gravity well position
  centerY: number;
  radius: number;           // region size based on weight + member count
  memberNodeIds: string[];
}
```

## The Graph Transformation Pipeline

This is the core logic — turning a TasteProfile + library + recommendations into a renderable graph:

1. **Collect all titles** from library items + recommendations. Deduplicate by canonical title.

2. **Assign theme memberships.** For each title:
   - If it came from a recommendation, it has `tasteTags` → map those to theme labels
   - If it came from the library, match it against themes by checking if the theme's `evidence` field mentions this title
   - A title can belong to multiple themes

3. **Build edges.** For every pair of titles that share at least one theme or archetype, create an edge. Edge strength = number of shared connections / max possible. Filter out edges below a minimum strength threshold to avoid visual noise.

4. **Position theme clusters.** Distribute theme clusters evenly around the canvas in a circle (or use a more organic layout). Weight determines radius. Each cluster becomes a gravity well in the force simulation.

5. **Run force simulation.** Nodes attracted to their theme clusters, repelled from each other, connected nodes attracted gently. Let it settle for ~300 ticks, then render.

6. **Render.** SVG (or Canvas) with nodes, edges, cluster regions, labels.

## Pages / Routes

- `/` — Landing page if signed out. Constellation if signed in with a connected profile.
- `/demo` — Loads a curated sample profile so anyone can explore the visualization without a Resonance account. This is important for portfolio demos.

## Build Order

1. **Scaffold** — Vite + React + TypeScript + Tailwind + Clerk (same app as Resonance)
2. **Sample data** — hardcode a realistic TasteProfile + library so you can build the visualization without the API connection first
3. **Force simulation** — get D3 force simulation running with basic circle nodes and line edges. Get the physics feeling good before any visual polish.
4. **Theme clusters** — add gravity wells, render cluster regions as soft glowing areas
5. **Interactions** — hover tooltips, click-to-zoom, node highlighting, connection highlighting
6. **Filters** — format toggles, theme highlighting, search with pan-to
7. **Visual polish** — glow effects, color palette, animations, transitions, loading state
8. **Resonance API connection** — add the export endpoint to Resonance, wire up Clerk auth, fetch real profile data
9. **Demo mode** — curated sample profile for the /demo route
10. **Landing page** — signed-out experience explaining what this is
11. **Deploy** to Vercel

## Key Conventions

- This is a frontend-craft project. Spend time making interactions FEEL good — easing curves, hover timing, zoom smoothness, filter transitions. These details are the whole point.
- No backend, no database, no AI. All state in React + D3.
- The visualization should work with 50 nodes (small library) and 200 nodes (large library) without performance degradation.
- Accessibility: keyboard navigation for node focus, screen reader labels on interactive elements, respect prefers-reduced-motion for animations.
- The /demo route is critical for portfolio value — a hiring manager who doesn't have a Resonance account should still be able to explore a full constellation.

## Environment Variables

```
VITE_CLERK_PUBLISHABLE_KEY=     # Same key as Resonance
VITE_RESONANCE_API_URL=         # https://your-resonance-backend.onrender.com
```
