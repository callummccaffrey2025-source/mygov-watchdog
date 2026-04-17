import type { ReactNode } from 'react';
import SiteLayout from '../(site)/layout';
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <SiteLayout>{children}</SiteLayout>;
}
