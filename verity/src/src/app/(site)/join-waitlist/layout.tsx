import type { ReactNode } from "react";

export default function JoinWaitlistLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-950">
      <div className="container py-16 md:py-24">{children}</div>
    </div>
  );
}
