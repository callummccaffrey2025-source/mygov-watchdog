export default function SiteJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Verity",
    "url": "https://verity.example", // TODO: set production URL
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://verity.example/search?q={query}",
      "query-input": "required name=query"
    }
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
