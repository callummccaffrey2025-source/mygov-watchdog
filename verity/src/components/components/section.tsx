import { ReactNode } from "react";
export default function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`py-16 md:py-24 ${className}`}>{children}</section>;
}
