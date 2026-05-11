import { describe, it, expect } from "vitest";
import { computeClusterMST } from "./helpers";

describe("computeClusterMST", () => {
  it("returns empty edges for a cluster with fewer than two members", () => {
    expect(computeClusterMST([])).toEqual([]);
    expect(computeClusterMST([{ id: "a", x: 0, y: 0 }])).toEqual([]);
  });

  it("returns exactly N-1 edges for N members", () => {
    const members = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 20, y: 0 },
      { id: "d", x: 30, y: 0 },
      { id: "e", x: 40, y: 0 },
    ];
    const edges = computeClusterMST(members);
    expect(edges).toHaveLength(4);
  });

  it("produces a connected tree — every member reachable from any other", () => {
    const members = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 100, y: 0 },
      { id: "c", x: 50, y: 80 },
      { id: "d", x: -20, y: 60 },
    ];
    const edges = computeClusterMST(members);
    // Walk the tree from `a` via BFS — confirm all members reachable.
    const adj = new Map<string, Set<string>>();
    for (const m of members) adj.set(m.id, new Set());
    for (const e of edges) {
      adj.get(e.sourceId)?.add(e.targetId);
      adj.get(e.targetId)?.add(e.sourceId);
    }
    const visited = new Set<string>(["a"]);
    const queue = ["a"];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    expect(visited.size).toBe(members.length);
  });

  it("picks the shortest edges first — minimum total length", () => {
    // Three colinear points: edges should be a-b and b-c, not a-c.
    const members = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 20, y: 0 },
    ];
    const edges = computeClusterMST(members);
    expect(edges).toHaveLength(2);
    const pairs = new Set(edges.map((e) => [e.sourceId, e.targetId].sort().join("-")));
    expect(pairs.has("a-b")).toBe(true);
    expect(pairs.has("b-c")).toBe(true);
    expect(pairs.has("a-c")).toBe(false);
  });

  it("treats missing positions as origin without crashing", () => {
    const members = [
      { id: "a" },
      { id: "b", x: 5, y: 5 },
      { id: "c", x: 10, y: 10 },
    ];
    const edges = computeClusterMST(members);
    expect(edges).toHaveLength(2);
  });
});
