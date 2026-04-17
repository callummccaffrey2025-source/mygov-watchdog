import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const allowIndex = process.env.NEXT_PUBLIC_INDEXING !== "false";
  return allowIndex
    ? { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${site}/sitemap.xml` }
    : { rules: [{ userAgent: "*", disallow: "/" }], sitemap: `${site}/sitemap.xml` };
}
