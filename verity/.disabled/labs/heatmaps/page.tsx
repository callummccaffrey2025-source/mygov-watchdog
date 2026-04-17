import SourceGuard from '../../../components/verity/SourceGuard';
const cells = [
  { seat:'Warringah', score:82, receipts:[{url:'https://www.aph.gov.au/Parliamentary_Business/Hansard'}]},
  { seat:'Bradfield',  score:74, receipts:[{url:'https://www.aph.gov.au/Parliamentary_Business/Hansard'}]},
];

export default function Page() {
  const receipts = cells.flatMap(c=>c.receipts);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Accountability Heatmaps</h1>
      <SourceGuard receipts={receipts}>
        <div className="grid grid-cols-2 gap-2">
          {cells.map((c,i)=>(
            <div key={i} className="rounded-lg border border-zinc-800 p-4">
              <div className="font-medium">{c.seat}</div>
              <div className="text-neutral-100 text-sm">Engagement score: {c.score}</div>
            </div>
          ))}
        </div>
      </SourceGuard>
    </div>
  );
}
