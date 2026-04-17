import SourceGuard from '../../../components/verity/SourceGuard';
import { Receipts } from '../../../components/verity/Receipts';

const scenarios = [
  { title: 'Digital ID Bill – small business compliance',
    summary: 'Potential KYC tooling changes; admin cost range $X–$Y.',
    receipts: [{ url:'https://parlinfo.aph.gov.au', label:'Bill text' }] }
];

export default function Page() {
  const receipts = scenarios.flatMap(s => s.receipts);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Legislation Impact Simulator</h1>
      <p className="text-neutral-100">Scenario outputs based on bill text & official notes. Analysis, not guarantees.</p>
      <SourceGuard receipts={receipts}>
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s, i) => (
            <article key={i} className="rounded-2xl border border-zinc-800 p-4">
              <div className="font-semibold">{s.title}</div>
              <p className="text-neutral-100 mt-2">{s.summary}</p>
            </article>
          ))}
        </div>
        <Receipts items={receipts} />
      </SourceGuard>
    </div>
  );
}
