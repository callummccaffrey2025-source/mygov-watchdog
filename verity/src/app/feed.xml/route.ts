import { NextResponse } from "next/server";
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const items = [
    { title: "Bias bars v2", date: "2025-09-01", link: `${base}/changelog`, desc: "Improved calibration & coverage." },
    { title: "Bill diff viewer", date: "2025-08-15", link: `${base}/changelog`, desc: "Semantic + line diffs." },
    { title: "Ownership dataset (AU)", date: "2025-08-01", link: `${base}/changelog`, desc: "Outlet → parent mapping." },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>Verity Changelog</title>
    <link>${base}</link>
    <description>What changed and when.</description>
    ${items.map(i=>`<item><title>${i.title}</title><link>${i.link}</link><pubDate>${new Date(i.date).toUTCString()}</pubDate><description>${i.desc}</description></item>`).join("")}
  </channel></rss>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
