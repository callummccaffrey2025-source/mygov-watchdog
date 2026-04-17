import * as React from "react";
export function Badge({ children, variant="secondary", className="", ...p }:
  { children: React.ReactNode; variant?: "secondary"|"outline"; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs";
  const v = variant==="outline" ? "border border-white/20 text-white/80" : "bg-white/10 text-white";
  return <span className={`${base} ${v} ${className}`} {...p}>{children}</span>;
}
