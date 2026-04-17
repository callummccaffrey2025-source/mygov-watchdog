const hits = new Map<string, { count: number; ts: number }>();
export function rateLimit(key: string, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.ts > windowMs) {
    hits.set(key, { count: 1, ts: now });
    return { ok: true };
  }
  rec.count += 1;
  if (rec.count > max) return { ok: false };
  return { ok: true };
}
