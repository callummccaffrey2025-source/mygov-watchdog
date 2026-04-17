import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date().toISOString();

  return [
    { url: `${base}/`,            lastModified: now, changeFrequency: "daily",  priority: 1.0 },
    { url: `${base}/news`,        lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/bills`,       lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/mps`,         lastModified: now, changeFrequency: "daily",  priority: 0.8 },
    { url: `${base}/pricing`,     lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
}
