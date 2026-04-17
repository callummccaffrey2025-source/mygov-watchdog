import "./globals.css";
import type { Metadata, Viewport } from "next";
import SiteHeader from "../components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "Verity — Transparent politics, made simple.",
    template: "%s · Verity",
  },
  description: "Verity pulls bills, votes and MPs into one clean feed. Built for Australians.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Verity",
    title: "Verity — Transparent politics, made simple.",
    description: "Track bills, stages and MPs in one place.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Verity" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Verity — Transparent politics, made simple.",
    description: "Track bills, stages and MPs in one place.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b0b0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-zinc-200">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
