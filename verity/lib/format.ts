export function formatPercent(n?: number) {
  if (typeof n !== "number" || !isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}
