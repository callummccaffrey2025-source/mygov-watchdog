export function EmptyState({title="Nothing here yet",hint="Try adjusting filters or check back soon."}){return(<div className="card p-6 text-center text-neutral-100">{title}<div className="text-xs mt-2">{hint}</div></div>);}
export function ErrorState({message="Something went wrong."}){return(<div className="card border-red-900 p-6 text-center text-red-300">{message}</div>);}
export function SkeletonRow(){return(<div className="animate-pulse bg-zinc-800/50 h-6 rounded my-2" />);}
