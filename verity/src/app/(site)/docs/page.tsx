export default function DocsPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold mb-4">Docs & API (preview)</h1>
      <pre className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm overflow-x-auto">
{`curl -sS -X POST https://verity.app/api/ask \
  -H "content-type: application/json" \
  --data '{"q":"What changed in the 2024-25 Budget?"}'`}
      </pre>
    </section>
  );
}
