export default function MPPersonJsonLd({
  name, slug, headshot, party, electorate, state,
}: {
  name: string; slug: string;
  headshot?: string | null; party?: string;
  electorate?: string; state?: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const json = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "url": `${base}/mps/${slug}`,
    ...(headshot ? { "image": headshot } : {}),
    ...(party ? { "affiliation": { "@type": "Organization", "name": party } } : {}),
    ...(electorate || state
      ? { "homeLocation": { "@type": "Place", "name": [electorate, state].filter(Boolean).join(", ") } }
      : {})
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
