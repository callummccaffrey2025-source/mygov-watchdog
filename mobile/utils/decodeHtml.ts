/**
 * Strips HTML tags and decodes common HTML entities from a string.
 * Used to sanitize article descriptions and snippets sourced from RSS/NewsAPI.
 */
export function decodeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')   // strip stray tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')      // collapse multiple spaces
    .trim();
}
