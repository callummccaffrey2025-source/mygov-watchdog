import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSearch() {
  return (
    <div className="min-h-[calc(100svh-64px)] grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 p-4 md:p-6">
      <aside className="space-y-5">
        <div>
          <Skeleton className="h-8 w-44" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/6" />
            <Skeleton className="h-6 w-3/6" />
          </div>
        </div>
        <div>
          <Skeleton className="h-8 w-52" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-2/4" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
        <div>
          <Skeleton className="h-8 w-40" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
          </div>
        </div>
      </aside>

      <main className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        <ul className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-[72px] w-full rounded-md" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-center gap-2 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-20" />
        </div>
      </main>
    </div>
  );
}

