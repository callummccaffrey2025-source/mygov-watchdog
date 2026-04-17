import Image from 'next/image';
import { MP } from "@/lib/types";

export default function MPHeader({ mp }: { mp: MP }) {
  return (
    <header className="home-hero relative overflow-hidden rounded-2xl border p-6 md:p-8 bg-neutral-900 text-white">
      <div className="flex items-center gap-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
          <Image
            src={mp.headshot || '/icon.svg'}
            alt={`${mp.name} headshot`}
            fill
            sizes="80px"
            className="object-cover"
            priority
            decoding="async"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold">{mp.name}</h1>
          <p className="text-sm text-white/80">
            {mp.party} — {mp.electorate}, {mp.state}
          </p>
          {mp.roles?.length ? (
            <p className="text-xs text-white/70 mt-1">{mp.roles.join(' • ')}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
