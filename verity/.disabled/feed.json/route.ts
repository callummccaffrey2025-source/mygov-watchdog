export const runtime = "edge";
export const revalidate = 900;

import { BLOG_POSTS } from "@/lib/blog";
import { CHANGELOG } from "@/lib/changelog";

export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/,"");
  const items = [
    ...BLOG_POSTS.map(p => ({
      id: `${base}/blog/${p.slug}`,
      url: `${base}/blog/${p.slug}`,
      title: p.title,
      content_text: p.summary,
      date_published: new Date(p.date).toISOString(),
    })),
    ...CHANGELOG.map(c => ({
      id: `changelog:${c.slug}`,
      url: `${base}/changelog#${c.slug}`,
      title: c.title,
      content_text: c.items.join(" • "),
      date_published: new Date(c.date).toISOString(),
    })),
  ].sort((a,b) => (a.date_published < b.date_published ? 1 : -1));

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Verity — Updates",
    home_page_url: `${base}/`,
    feed_url: `${base}/feed.json`,
    items,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { "content-type": "application/feed+json; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
