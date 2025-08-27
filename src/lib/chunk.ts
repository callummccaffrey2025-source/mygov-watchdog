export function chunkText(text: string, maxLen = 1200, overlap = 120) {
  const chunks:string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + maxLen, text.length);
    chunks.push(text.slice(i, end));
    i = end - overlap; if (i < 0) i = 0;
  }
  return chunks;
}
