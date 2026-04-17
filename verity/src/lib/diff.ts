export type DiffToken = { type: "same" | "add" | "del"; text: string };

export function diffWords(a: string, b: string): DiffToken[] {
  const A = a.split(/\s+/), B = b.split(/\s+/);
  const m = A.length, n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = A[i-1] === B[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  // backtrack LCS
  const out: DiffToken[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (A[i-1] === B[j-1]) { out.push({ type: "same", text: A[i-1] }); i--; j--; }
    else if (dp[i-1][j] >= dp[i][j-1]) { out.push({ type: "del", text: A[i-1] }); i--; }
    else { out.push({ type: "add", text: B[j-1] }); j--; }
  }
  while (i > 0) { out.push({ type: "del", text: A[i-1] }); i--; }
  while (j > 0) { out.push({ type: "add", text: B[j-1] }); j--; }
  return out.reverse();
}
