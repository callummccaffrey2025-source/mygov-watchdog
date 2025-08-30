export function chunk(text: string, max = 800, overlap = 80) {
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + max));
    i += Math.max(1, max - overlap);
  }
  return parts;
}
