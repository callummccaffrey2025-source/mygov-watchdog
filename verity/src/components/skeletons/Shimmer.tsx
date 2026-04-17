export default function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-xl bg-white/5 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <style jsx>{`
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}
