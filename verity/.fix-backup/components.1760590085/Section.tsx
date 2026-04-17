import * as React from "react";

export function Section({
  title,
  children,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-10 sm:py-14 border-t first:border-t-0 border-border/50 ${className}`}>
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="text-base">{children}</div>
    </section>
  );
}

export default Section;
