export default function Empty({ title, hint, children }:{
  title?: string; hint?: string; children?: React.ReactNode
}) {
  return (
    <div className="text-sm text-neutral-300 border border-white/10 rounded-xl p-6">
      {title && <div className="font-medium mb-1">{title}</div>}
      {hint && <div className="text-neutral-500 mb-2">{hint}</div>}
      {children}
    </div>
  );
}
