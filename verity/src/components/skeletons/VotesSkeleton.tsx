export default function VotesSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-6 w-full rounded bg-white/10" />
      ))}
    </div>
  );
}
