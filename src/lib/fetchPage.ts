import { setTimeout as delay } from 'timers/promises';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export type FetchResult = {
  html: string;
  text?: string;
  source: 'direct' | 'jina';
  status: number;
};

export async function fetchPageSmart(url: string): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-AU,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': new URL(url).origin + '/',
  };

  // Try direct first
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (res.ok) {
    const html = await res.text();
    return { html, source: 'direct', status: res.status };
  }

  // Fallback for block statuses
  if ([403, 406, 451].includes(res.status)) {
    await delay(150);
    const proxied = 'https://r.jina.ai/http://' + url.replace(/^https?:\/\//i, '');
    const jr = await fetch(proxied, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (jr.ok) {
      const text = await jr.text();
      return { html: '', text, source: 'jina', status: res.status };
    }
  }

  throw new Error(`Fetch failed (${res.status}) for ${url}`);
}
