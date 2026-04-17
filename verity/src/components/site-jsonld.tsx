'use client';
export default function SiteJSONLD(){
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Verity",
    "url": (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
    "potentialAction": {
      "@type": "SearchAction",
      "target": "{url}/search?q={query}",
      "query-input": "required name=query"
    }
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
