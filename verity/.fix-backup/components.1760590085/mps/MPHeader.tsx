"use client";
import ImageFallback from "@/components/media/ImageFallback";
import { User, MapPin, Flag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { MPBasic, MPRole } from "@/types/mp";

export default function MPHeader({ mp, roles }: { mp: MPBasic; roles: MPRole[] }) {
  return (
    <header className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" aria-label="Member of Parliament header">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
          {mp.headshot_url ? (
            <ImageFallback src={mp.headshot_url ?? "/avatar-fallback.png"} alt={mp.name} width={80} height={80} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <img src="/og/verity-default.png" alt="" className="h-full w-full object-cover opacity-80" />
          )}
        </div>

        <div>
          <h1 className="text-lg font-semibold">{mp.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-white/70">
            <Badge className="border-white/20" aria-label={`Party: ${mp.party}`}>{mp.party}</Badge>
            <span className="inline-flex items-center gap-1" aria-label={`Electorate: ${mp.electorate}`}>
              <MapPin className="size-3.5" /> {mp.electorate}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={`State: ${mp.state}`}>
              <Flag className="size-3.5" /> {mp.state}
            </span>
          </div>

          {!!roles?.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((r) => (
                <Badge key={r.title} className="border-emerald-500/30 bg-emerald-500/10">
                  {r.title}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
