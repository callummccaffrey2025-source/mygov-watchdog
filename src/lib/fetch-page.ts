import { load as loadHtml } from "cheerio";

/** Fetch with a realistic browser UA so WAFs don't insta-block us. */
export async function fetchWithHeaders(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AU,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    redirect: "follow",
  });
  return res;
}

/** Try to get HTML; if blocked (403/406/etc), try common RSS/Atom feed paths. */
export async function getHtmlOrRss(urlStr: string): Promise<{type:"html"|"rss", url:string, body:string}> {
  const tryOne = async (u: string) => {
    const r = await fetchWithHeaders(u);
    const body = await r.text();
    const ct = r.headers.get("content-type") || "";
    const looksXml = ct.includes("xml") || body.startsWith("<?xml") || body.includes("<rss") || body.includes("<feed");
    return { ok: r.ok, status: r.status, url: u, body, isRss: looksXml };
  };

  let r = await tryOne(urlStr);
  if (r.ok) return { type: r.isRss ? "rss" : "html", url: r.url, body: r.body };

  if ([403, 401, 406, 429].includes(r.status)) {
    const base = new URL(urlStr);
    const candidates = ["/rss.xml","/feed","/feed.xml","/atom.xml","/feeds/news.xml","/news/rss","/media-releases/rss","/media-releases.xml","/media/rss"]
      .map(p => new URL(p, base).toString());

    for (const c of candidates) {
      const rr = await tryOne(c);
      if (rr.ok && rr.isRss) return { type: "rss", url: rr.url, body: rr.body };
    }

    try {
      const $ = loadHtml(r.body);
      const link = $('link[rel="alternate"][type*="xml"]').attr("href");
      if (link) {
        const abs = new URL(link, base).toString();
        const rr = await tryOne(abs);
        if (rr.ok && rr.isRss) return { type: "rss", url: rr.url, body: rr.body };
      }
    } catch {}
  }

  throw new Error(`${r.status} Forbidden/blocked by origin`);
}
