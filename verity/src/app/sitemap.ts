import type { MetadataRoute } from "next";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  // TODO: source slugs from your data store. For now, include the alba demo.
  const pages = ["/", "/mps", "/mps/alba"];
  return pages.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "/" ? 1 : 0.6,
  }));
}
