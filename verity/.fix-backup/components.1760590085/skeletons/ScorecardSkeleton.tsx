export default function ScorecardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded bg-white/10" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-2 w-full rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
