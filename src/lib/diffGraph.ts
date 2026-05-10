import type { ProfileExport } from "./api";
import { buildGraph } from "./graph";
import type { Graph, GraphNode, ThemeCluster } from "../types/graph";

/**
 * Diff between two profile-version graph builds. Themes added or removed
 * between versions are categorical changes — pretending they smoothly
 * morph from nothing into a cluster (or vice versa) is dishonest viz.
 * Instead we partition both clusters and nodes into shared/added/removed
 * buckets so the renderer can stage the categorical change explicitly
 * (cross-fade per cluster, opacity ramp per node).
 *
 * Cluster identity = normalized theme label. Node identity = normalized
 * title (mirrors the dedupe logic in `buildGraph`). Stable nodes carry
 * BOTH endpoints because the interesting per-node signal in a diff is
 * cluster-membership change — a node's `primaryTheme` may differ between
 * versions even when the title is unchanged.
 */
export interface DiffGraph {
  fromGraph: Graph;
  toGraph: Graph;
  clusters: {
    /** Theme labels present in both versions. The cluster object from the
     * `to` graph is canonical here — the diff renderer interpolates
     * positions/radii from `fromGraph.clusters[label]` toward this. */
    shared: ThemeCluster[];
    /** Theme labels only in the `to` version — new themes the latest
     * profile surfaces that the previous version didn't. */
    addedTo: ThemeCluster[];
    /** Theme labels only in the `from` version — themes that have dropped
     * out by the `to` version. */
    removedFrom: ThemeCluster[];
  };
  nodes: {
    /** Titles in both versions. Carries both endpoints so the renderer
     * can lerp position and reveal cluster-migration via primaryTheme
     * differing between `from` and `to`. */
    stable: { id: string; from: GraphNode; to: GraphNode }[];
    /** Titles only in the `to` version. */
    added: GraphNode[];
    /** Titles only in the `from` version. */
    removed: GraphNode[];
  };
}

/** Mirror of `lib/graph.ts:normalize`. Re-implemented (not re-exported)
 * so we don't widen graph.ts's public surface for one consumer; the rule
 * (lowercase, strip punctuation, collapse whitespace) is stable enough
 * that the duplication is cheaper than the abstraction. If graph.ts
 * normalize ever changes shape, this needs to track. */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

export function buildDiffGraph(
  fromExport: ProfileExport,
  toExport: ProfileExport,
): DiffGraph {
  const fromGraph = buildGraph(
    fromExport.profile,
    fromExport.library,
    fromExport.recommendations,
    fromExport.favorites,
  );
  const toGraph = buildGraph(
    toExport.profile,
    toExport.library,
    toExport.recommendations,
    toExport.favorites,
  );

  // Cluster diff by normalized label. We use the actual label string
  // (post-normalize) as the bucket key, but emit the original cluster
  // objects so colors / centers / radii flow through unchanged.
  const fromClusterByNorm = new Map(
    fromGraph.clusters.map((c) => [normalize(c.label), c]),
  );
  const toClusterByNorm = new Map(
    toGraph.clusters.map((c) => [normalize(c.label), c]),
  );

  const sharedClusters: ThemeCluster[] = [];
  const removedFromClusters: ThemeCluster[] = [];
  const addedToClusters: ThemeCluster[] = [];

  for (const [norm, cluster] of fromClusterByNorm) {
    if (toClusterByNorm.has(norm)) {
      // Shared: emit the `to` version of the cluster as canonical so
      // colors track the latest profile's theme palette.
      sharedClusters.push(toClusterByNorm.get(norm)!);
    } else {
      removedFromClusters.push(cluster);
    }
  }
  for (const [norm, cluster] of toClusterByNorm) {
    if (!fromClusterByNorm.has(norm)) {
      addedToClusters.push(cluster);
    }
  }

  // Node diff by canonicalized title. `buildGraph` already dedupes inputs
  // by normalized title across library/recs/favorites, so within a single
  // graph each title maps to exactly one node — but the synthetic
  // favorite ids (`fav-<normalized>`) and library/rec database ids will
  // differ between versions even for the "same" title. Title-based match
  // is the only stable identity here.
  const fromByTitle = new Map<string, GraphNode>();
  for (const n of fromGraph.nodes) fromByTitle.set(normalize(n.title), n);
  const toByTitle = new Map<string, GraphNode>();
  for (const n of toGraph.nodes) toByTitle.set(normalize(n.title), n);

  const stable: { id: string; from: GraphNode; to: GraphNode }[] = [];
  const removed: GraphNode[] = [];
  const added: GraphNode[] = [];

  for (const [titleKey, fromNode] of fromByTitle) {
    const toNode = toByTitle.get(titleKey);
    if (toNode) {
      // Use the `to` node's id as the canonical diff-id; the renderer
      // keys on this for stable-node lerp lookups. Different from
      // either underlying graph node id.
      stable.push({ id: toNode.id, from: fromNode, to: toNode });
    } else {
      removed.push(fromNode);
    }
  }
  for (const [titleKey, toNode] of toByTitle) {
    if (!fromByTitle.has(titleKey)) added.push(toNode);
  }

  return {
    fromGraph,
    toGraph,
    clusters: {
      shared: sharedClusters,
      addedTo: addedToClusters,
      removedFrom: removedFromClusters,
    },
    nodes: { stable, added, removed },
  };
}
