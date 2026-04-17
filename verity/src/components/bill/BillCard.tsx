import type { Bill } from /components/ui/badge'@/types/components/ui/badge';
import Card from /components/ui/badge'@/components/ui/card/components/ui/badge';
import { Badge } from /components/ui/badge'@/components/ui/badge/components/ui/badge';
export default function BillCard({ bill }: { bill: Bill }){
  return (
    <Card className=/components/ui/badge'p-5/components/ui/badge'>
      <div className=/components/ui/badge'mb-2 flex items-center justify-between/components/ui/badge'>
        <h3 className=/components/ui/badge'font-semibold/components/ui/badge'>{bill.title}</h3>
        <Badge>{bill.status}</Badge>
      </div>
      <p className=/components/ui/badge'text-sm text-white/70/components/ui/badge'>{bill.summary}</p>
      <div className=/components/ui/badge'mt-3 text-xs text-white/50/components/ui/badge'>
        Introduced {bill.introduced}{bill.sponsor && <> · Sponsor: {bill.sponsor}</>}
      </div>
    </Card>
  );
}
