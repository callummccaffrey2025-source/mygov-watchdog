import type { ReactNode } from "react";

/** Base Card container */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card-base ${className}`}>{children}</section>;
}

/** Optional header row used by Section.tsx */
export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-4 flex items-end justify-between gap-3 ${className}`}>{children}</div>;
}

/** Content wrapper to keep spacing consistent */
export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/** Default export (for places importing default) */
export default Card;
