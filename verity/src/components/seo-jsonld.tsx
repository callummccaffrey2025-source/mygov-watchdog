import Script from "next/script";
export default function SeoJsonLd({ id, data }: { id: string; data: unknown }) {
  return <Script id={id} type="application/ld+json" strategy="afterInteractive"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
