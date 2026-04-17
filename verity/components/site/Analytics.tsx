'use client';
import { useEffect } from 'react';

export default function Analytics() {
  useEffect(() => {
    const domain =
      process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ||
      process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID ||
      process.env.NEXT_PUBLIC_ANALYTICS;

    if (!domain) return; // no analytics configured

    const s = document.createElement('script');
    s.defer = true;
    s.setAttribute('data-domain', domain);
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
    return () => { try { document.head.removeChild(s); } catch {} };
  }, []);

  return null;
}
