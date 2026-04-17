export default function Aspect({ ratio="16/9", children, className="" }: { ratio?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: ratio }}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}
