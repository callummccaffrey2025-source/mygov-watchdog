import { cn } from "@/lib/utils";

export default function Section({
  title,
  caption,
  className = "",
  children
}: {
  title?: string;
  caption?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("section z-card", className)}>
      {title ? (
        <div className="section-head">
          <h2 className="section-title">{title}</h2>
          {caption ? <span className="section-caption">{caption}</span> : null}
        </div>
      ) : null}
      <div className="section-body">{children}</div>
    </section>
  );
}
