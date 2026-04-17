export default function BreadcrumbJsonLd({ name, slug }: { name: string; slug: string }) {
  const data = {
    "@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"MPs","item":"/mps"},
      {"@type":"ListItem","position":2,"name":name,"item":`/mps/${slug}`}
    ],
  };
  return <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
