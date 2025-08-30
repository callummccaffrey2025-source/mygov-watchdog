export function chunk(text: string, max = 800, overlap = 120): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];

  const pushCur = () => {
    const s = cur.join(' ').trim();
    if (s) out.push(s);
  };

  for (const w of words) {
    const next = (cur.length ? cur.join(' ') + ' ' : '') + w;
    if (next.length > max) {
      pushCur();
      // keep an approximate overlap by words (avoid breaking mid-sentence too aggressively)
      const keep = Math.max(0, Math.floor(overlap / 6));
      const tail = cur.slice(-keep);
      cur = tail.length ? tail : [];
    }
    cur.push(w);
  }
  if (cur.length) pushCur();
  return out;
}
