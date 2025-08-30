export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import React from 'react';
export default function Docs() {
  return <div className="p-6">
    <h1 className="text-2xl font-semibold">Verity Docs</h1>
    <p className="mt-2 text-sm opacity-80">Loaded at runtime.</p>
  </div>;
}
