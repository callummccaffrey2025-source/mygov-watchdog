export default function EmptyState(
  { children, role = "status" }: { children: React.ReactNode; role?: "status" | "alert" }
){
  return <div className="card p-4 text-sm text-zinc-400" role={role} aria-live="polite">{children}</div>;
}
