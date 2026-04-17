import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';

const base = siteUrl();
const titleBase = 'Verity';
const tagline = 'Track bills. Know your MP. Get alerts.';
const desc =
  "Verity turns bills, votes, and MPs’ records into plain-English summaries. Built for Australians. Non-partisan. Privacy-minded.";

export const metadata: Metadata = {
  metadataBase: base,
  title: {
    default: `${titleBase} — ${tagline}`,
    template: `%s · ${titleBase}`,
  },
  description: desc,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: titleBase,
    title: tagline,
    description: desc,
    images: [{ url: '/og-default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: tagline,
    description: desc,
    images: ['/og-default.png'],
  },
  robots: { index: true, follow: true },
};
