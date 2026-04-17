export function ProgressBar({ value=0 }:{ value?: number }) {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <div className="h-full" style={{ backgroundColor: "rgb(16 185 129)", width: `${v}%` }} />
    </div>
  );
}
