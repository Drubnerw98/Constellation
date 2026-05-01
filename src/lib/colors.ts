const CLUSTER_PALETTE = [
  "#5eead4",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#fdba74",
] as const;

export function colorForThemeIndex(index: number): string {
  return CLUSTER_PALETTE[index % CLUSTER_PALETTE.length]!;
}
