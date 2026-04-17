// src/lib/chunker.ts
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

/** Remove obvious boilerplate before extracting text */
function stripBoilerplate(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort article text using Readability, with safe fallbacks */
export function extractMainText(html: string): string {
  try {
    const dom = new JSDOM(html, { url: "https://example.org" });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = (article?.textContent ?? "").trim();
    if (text) return text;
    // fallback to just the document body text if readability is empty
    const fallback = dom.window.document.body?.textContent ?? "";
    const cleaned = fallback.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  } catch {
    // fall through to regex fallback
  }
  return stripBoilerplate(html);
}

/** Best-effort title from <title>, with fallback to H1 or blank */
export function extractTitle(html: string): string | undefined {
  try {
    const dom = new JSDOM(html, { url: "https://example.org" });
    const titleTag = dom.window.document.title?.trim();
    if (titleTag) return titleTag;
    const h1 = dom.window.document.querySelector("h1")?.textContent?.trim();
    if (h1) return h1;
  } catch {
    // ignore
  }
  return undefined;
}

/** Simple sentence-ish chunker honoring a max character length */
export function chunkBySentence(text: string, maxChars = 1400): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(“"'])/g);

  const chunks: string[] = [];
  let buf = "";

  for (const s of sentences) {
    if (!s) continue;
    if ((buf + " " + s).trim().length <= maxChars) {
      buf = (buf ? buf + " " : "") + s.trim();
    } else {
      if (buf) chunks.push(buf);
      if (s.length <= maxChars) {
        buf = s.trim();
      } else {
        // if a single sentence is huge, hard-wrap by words
        const words = s.trim().split(" ");
        let wbuf = "";
        for (const w of words) {
          if ((wbuf + " " + w).trim().length <= maxChars) {
            wbuf = (wbuf ? wbuf + " " : "") + w;
          } else {
            if (wbuf) chunks.push(wbuf);
            wbuf = w;
          }
        }
        buf = wbuf;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}
