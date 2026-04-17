import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://verity.run";
  const paths = [
    "", "/product", "/pricing", "/blog", "/trust", "/integrity", "/join-waitlist"
  ];
  const lastModified = new Date();

  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
