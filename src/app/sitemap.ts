import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://verity.run/', priority: 1.0 },
    { url: 'https://verity.run/search' },
    { url: 'https://verity.run/ask' },
    { url: 'https://verity.run/crawl' },
    { url: 'https://verity.run/account' },
  ];
}
