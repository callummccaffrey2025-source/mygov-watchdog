import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingAI() {
  return (
    <div className="min-h-[calc(100svh-64px)] grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 p-4 md:p-6">
      <aside className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-5/6" />
          <Skeleton className="h-9 w-4/6" />
        </div>
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-9 w-3/5" />
        </div>
      </aside>

      <main className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-24" />
        </div>

        <section aria-label="AI chat loading" className="space-y-6">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          </div>

          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-7/12" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-10/12" />
              <Skeleton className="h-4 w-9/12" />
              <Skeleton className="h-4 w-8/12" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

