import SourceGuard from '../../../components/verity/SourceGuard';
const items = [{ mp:'MP Example', truthRate:0.78, receipts:[{url:'https://abc.net.au/factcheck',label:'ABC Fact Check'}]}];

export default function Page(){
  const receipts = items.flatMap(i=>i.receipts);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Trust Index™</h1>
      <p className="text-neutral-100 text-sm">Rate reflects share of externally fact-checked statements rated accurate over time.</p>
      <SourceGuard receipts={receipts}>
        <div className="space-y-2">{items.map((i,idx)=>(
          <div key={idx} className="rounded-xl border border-zinc-800 p-4 flex justify-between">
            <span>{i.mp}</span><span className="text-neutral-100">{Math.round(i.truthRate*100)}%</span>
          </div>
        ))}</div>
      </SourceGuard>
    </div>
  );
}
