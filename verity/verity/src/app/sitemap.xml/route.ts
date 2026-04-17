import { sbRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let billUrls: string[] = [];
  try {
    const r = await sbRest("bills_mv?select=id&order=title.asc");
    const bills = (await r.json()) as Array<{ id: string }>;
    billUrls = bills.map((bill) => `${origin}/legislation/${bill.id}`);
  } catch {
    billUrls = [];
  }

  const staticUrls = [
    `${origin}/`,
    `${origin}/news`,
    `${origin}/legislation`,
    `${origin}/mps`,
    `${origin}/pricing`,
    `${origin}/search`,
    `${origin}/join`,
  ];

  const urls = [...staticUrls, ...billUrls];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `<url><loc>${url}</loc></url>`),
    "</urlset>",
  ].join("");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate",
    },
  });
}
