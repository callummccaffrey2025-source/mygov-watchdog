import React from "react";
type GlassProps = React.PropsWithChildren<{ className?: string }>;
export default function Glass({ className = "", children }: GlassProps) {
  return (
    <section data-reveal className={`reveal rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_50px_-12px_rgba(0,0,0,0.55)] ${className}`}>
      {children}
    </section>
  );
}
