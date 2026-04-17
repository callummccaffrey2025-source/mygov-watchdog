import * as React from "react";
export function Card({ className="", ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-white/10 bg-neutral-900 ${className}`} {...p} />;
}
export function CardHeader({ className="", ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 text-white ${className}`} {...p} />;
}
export function CardContent({ className="", ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 text-white/80 ${className}`} {...p} />;
}
