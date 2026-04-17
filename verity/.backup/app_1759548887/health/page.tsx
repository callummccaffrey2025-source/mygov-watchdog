export const revalidate = 0;

function Row({ k, v }: { k: string; v: string | boolean | null }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-800 py-2 text-sm">
      <span className="text-neutral-400">{k}</span>
      <span className="font-mono text-neutral-200">{String(v)}</span>
    </div>
  );
}

export default async function HealthPage() {
  const flags = {
    NEXT_PUBLIC_SHOW_TRENDING: process.env.NEXT_PUBLIC_SHOW_TRENDING === '1',
    NEXT_PUBLIC_ENABLE_PLAUSIBLE: process.env.NEXT_PUBLIC_ENABLE_PLAUSIBLE === '1',
  };
  const deps = {
    TRENDING_JSON_present: Boolean(process.env.TRENDING_JSON),
    PLAUSIBLE_DOMAIN_present: Boolean(process.env.PLAUSIBLE_DOMAIN),
    EMAIL_WEBHOOK_URL_present: Boolean(process.env.EMAIL_WEBHOOK_URL),
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Health</h1>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <Row k="env" v={process.env.NODE_ENV ?? null} />
        <Row k="siteUrl" v={process.env.NEXT_PUBLIC_SITE_URL ?? null} />
        <Row k="flags.trending" v={flags.NEXT_PUBLIC_SHOW_TRENDING} />
        <Row k="flags.plausible" v={flags.NEXT_PUBLIC_ENABLE_PLAUSIBLE} />
        <Row k="deps.TRENDING_JSON_present" v={deps.TRENDING_JSON_present} />
        <Row k="deps.PLAUSIBLE_DOMAIN_present" v={deps.PLAUSIBLE_DOMAIN_present} />
        <Row k="deps.EMAIL_WEBHOOK_URL_present" v={deps.EMAIL_WEBHOOK_URL_present} />
        <div className="mt-3 text-xs text-neutral-400">
          API mirror: <code className="font-mono">/api/health</code>
        </div>
      </div>
    </main>
  );
}
