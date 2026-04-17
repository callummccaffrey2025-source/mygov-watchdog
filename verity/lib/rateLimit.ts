const BUCKET: Record<string, { n: number; t: number }> = {};
export function basicLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = BUCKET[key] ?? { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n += 1; BUCKET[key] = b;
  return b.n <= limit;
}
