import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/search', '/ask', '/crawl'] },
    sitemap: 'https://verity.run/sitemap.xml',
  };
}
