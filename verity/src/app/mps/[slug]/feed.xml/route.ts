import type { NextRequest } from "next/server";
export const revalidate = 300;
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/mps/${params.slug}`, { next: { revalidate: 300 }});
  if (!res.ok) return new Response("Not found", { status: 404 });
  const mp = await res.json();
  const items = [
    ...mp.recent_votes.map((v: any) => ({
      title: `Vote: ${v.decision} — ${v.bill_title}`,
      link: `${base}/bills/${v.bill_id}`,
      pubDate: new Date(v.date).toUTCString(),
    })),
    ...mp.news.map((n: any) => ({
      title: n.title, link: n.url, pubDate: new Date(n.published_at).toUTCString(),
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
<title>${mp.name} — Verity</title><link>${base}/mps/${mp.slug}</link>
<description>Profile updates for ${mp.name}</description>
${items.map(i=>`<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.pubDate}</pubDate></item>`).join("")}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type":"application/rss+xml; charset=utf-8", "Cache-Control":"s-maxage=300, stale-while-revalidate=3600" }});
}
