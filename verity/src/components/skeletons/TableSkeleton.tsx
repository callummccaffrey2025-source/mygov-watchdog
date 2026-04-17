import Shimmer from "./Shimmer";

export default function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="table-clean w-full text-sm">
        <div className="flex gap-2 p-3">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-6 w-20" />
          <Shimmer className="h-6 w-16" />
          <Shimmer className="h-6 w-14" />
        </div>
        <div className="px-3 pb-3 space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Shimmer key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
