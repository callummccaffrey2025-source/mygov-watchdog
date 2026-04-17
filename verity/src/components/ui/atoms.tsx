import React from "react";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"ghost"|"outline" };
export function UIButton({ variant="primary", className="", ...props }: ButtonProps){
  const base="btn rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald/60";
  const v = variant==="primary" ? "bg-emerald text-[#0b0f14]" :
            variant==="ghost"   ? "bg-transparent hover:bg-white/5" :
                                  "border border-white/10 hover:bg-white/5";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
export type CardProps = { className?: string; children: React.ReactNode };
export function UICard({ className="", children }: CardProps){
  return <div className={`card rounded-2xl border border-white/10 bg-white/5 ${className}`}>{children}</div>;
}
