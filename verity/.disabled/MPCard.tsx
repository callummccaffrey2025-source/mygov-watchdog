import Link from 'next/link'
import type { MP } from "@/lib/types"

export default function MPCard({ mp }: { mp: MP }) {
  const attendance = (mp.attendancePct ?? 0) + '%'
  const partyLine  = (mp.partyLinePct ?? 0) + '%'
  const integrity  = mp.integrityGrade ?? '—'
  const recent = mp.recentVotes?.length ? mp.recentVotes.map(v => `${v.position} – ${v.title.replace('Bill','Amdt')}`).join('; ') : '—'

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/70 text-sm">👤</div>
        <div>
          <Link href={`/mps/${mp.id}`} className="font-semibold hover:underline">{mp.name}</Link>
          <p className="text-xs text-neutral-100">{mp.electorate}{mp.state?`, ${mp.state}`:''} • {mp.party}{mp.since?` • Since ${mp.since}`:''}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 max-w-lg">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-[11px] text-neutral-300">Attendance</div>
          <div className="mt-1 text-lg font-semibold">{attendance}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-[11px] text-neutral-300">Party line</div>
          <div className="mt-1 text-lg font-semibold">{partyLine}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-[11px] text-neutral-300">Integrity score</div>
          <div className="mt-1 text-lg font-semibold">{integrity}</div>
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-300">Recent votes: {recent}.</div>
    </div>
  )
}
