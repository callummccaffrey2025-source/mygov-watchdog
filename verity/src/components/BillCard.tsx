import Link from /components/ui/badge'next/link/components/ui/badge'
import type { Bill } from /components/ui/badge'@/lib/types/components/ui/badge'
import { Badge } from /components/ui/badge'@/components/ui/badge/components/ui/badge'

const stageTone = (s:Bill[/components/ui/badge'stage/components/ui/badge']) => (s===/components/ui/badge'Passed/components/ui/badge'?/components/ui/badge'success/components/ui/badge':s===/components/ui/badge'Rejected/components/ui/badge'?/components/ui/badge'warning/components/ui/badge':/components/ui/badge'muted/components/ui/badge')

export default function BillCard({ bill }: { bill: Bill }) {
  const pass = bill.predictedPassPct ?? 62
  const mpPos = bill.yourMPPosition ?? /components/ui/badge'—/components/ui/badge'
  return (
    <div className=/components/ui/badge'rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4/components/ui/badge'>
      <div className=/components/ui/badge'flex items-start justify-between gap-4/components/ui/badge'>
        <div>
          <Link href={`/bills/${bill.id}`} className=/components/ui/badge'font-semibold hover:underline/components/ui/badge'>{bill.title}</Link>
          <p className=/components/ui/badge'mt-1 text-sm text-neutral-300/components/ui/badge'>{bill.summary ?? /components/ui/badge'Plain-language summary coming soon./components/ui/badge'}</p>
          <div className=/components/ui/badge'mt-2 flex flex-wrap gap-2/components/ui/badge'>
            <Badge variant=/components/ui/badge'success/components/ui/badge'>Predicted pass {pass}%</Badge>
            <Badge>Your MP: {mpPos}</Badge>
          </div>
        </div>
        <Badge variant={stageTone(bill.stage)} className=/components/ui/badge'whitespace-nowrap/components/ui/badge'>Stage: {bill.stage}</Badge>
      </div>
    </div>
  )
}
