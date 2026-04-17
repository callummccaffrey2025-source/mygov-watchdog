import type { MPProfile } from "@/types/mp";

export default function MPJsonLd({ mp }: { mp: MPProfile }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: mp.name,
    jobTitle: mp.roles?.[0]?.title ?? "Member of Parliament",
    affiliation: { "@type": "Organization", name: mp.party },
    address: { "@type": "PostalAddress", addressRegion: mp.state, addressLocality: mp.electorate, addressCountry: "AU" },
    image: mp.headshot_url || undefined,
    sameAs: [] as string[],
  };
  return <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
