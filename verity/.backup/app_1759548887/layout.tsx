import "./globals.css";
import Script from "next/script";

// Site-wide metadata
export const metadata = {
  title: "Verity — Clear, trustworthy Australian politics",
  description:
    "Verity helps Australians understand Parliament with plain-English bill summaries, MP voting records, and live updates. Non-partisan. Privacy-minded.",
  openGraph: {
    title: "Verity — Clear, trustworthy Australian politics",
    description:
      "Plain-English bill summaries, MP voting records, and live updates. Non-partisan. Privacy-minded.",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    siteName: "Verity",
    images: [
      {
        url:
          (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") +
          "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Verity preview",
      },
    ],
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verity — Clear, trustworthy Australian politics",
    description:
      "Plain-English bill summaries, MP voting records, and live updates.",
    images: [
      (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") +
        "/og-default.png",
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Plausible (env-guarded) */}
        {process.env.NEXT_PUBLIC_ENABLE_PLAUSIBLE === "1" &&
        process.env.PLAUSIBLE_DOMAIN ? (
          <>
            <link rel="preconnect" href="https://plausible.io" />
            <Script
              src="https://plausible.io/js/script.js"
              defer
              data-domain={process.env.PLAUSIBLE_DOMAIN}
              strategy="afterInteractive"
            />
          </>
        ) : null}
        {process.env.NODE_ENV !== 'production' ? (
        <script
          /* ENV_WARNINGS */
          dangerouslySetInnerHTML={{__html: `
            (function(){
              try {
                var flags = {
                  trending: ${JSON.stringify(process.env.NEXT_PUBLIC_SHOW_TRENDING === '1')},
                  plausible: ${JSON.stringify(process.env.NEXT_PUBLIC_ENABLE_PLAUSIBLE === '1')}
                };
                var deps = {
                  TRENDING_JSON_present: ${JSON.stringify(Boolean(process.env.TRENDING_JSON))},
                  PLAUSIBLE_DOMAIN_present: ${JSON.stringify(Boolean(process.env.PLAUSIBLE_DOMAIN))},
                  EMAIL_WEBHOOK_URL_present: ${JSON.stringify(Boolean(process.env.EMAIL_WEBHOOK_URL))}
                };
                if (flags.trending && !deps.TRENDING_JSON_present) {
                  console.warn('[health] NEXT_PUBLIC_SHOW_TRENDING=1 but TRENDING_JSON is missing; /api/trending will return 204 unless populated.');
                }
                if (flags.plausible && !deps.PLAUSIBLE_DOMAIN_present) {
                  console.warn('[health] NEXT_PUBLIC_ENABLE_PLAUSIBLE=1 but PLAUSIBLE_DOMAIN is missing; plausible script will not attribute domain.');
                }
                if (!deps.EMAIL_WEBHOOK_URL_present) {
                  console.warn('[health] EMAIL_WEBHOOK_URL not set; /api/email-capture will 204 (no-op).');
                }
              } catch(e) {}
            })();
          `}}
        />
      ) : null}
    </head>
      <body>
        {/* Global CTA listener (Plausible) */}
        <script
          /* PLAUSIBLE_CTA_LISTENER */
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (typeof window === 'undefined') return;
                var send = function(name){
                  try {
                    if (window.plausible && typeof window.plausible === 'function') {
                      window.plausible('CTA Click', { props: { name: name }});
                    }
                  } catch(e){}
                };
                addEventListener('click', function(e){
                  var el = e.target;
                  while (el && el !== document.body) {
                    if (el.hasAttribute && el.hasAttribute('data-cta')) {
                      var name = el.getAttribute('data-cta') || 'unknown';
                      send(name);
                      break;
                    }
                    el = el.parentNode;
                  }
                }, { capture: true });
              })();
            `
          }}
        />
        {children}
        {/* JSON-LD Organization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Verity",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              logo:
                (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") +
                "/og-default.png",
              sameAs: ["https://twitter.com/", "https://www.linkedin.com/"],
            }),
          }}
        />
              {/* JSON-LD WebSite schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Verity",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
              potentialAction: {
                "@type": "RegisterAction",
                target: [(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + "/signup"],
              }
            })
          }}
        />
      </body>
    </html>
  );
}
