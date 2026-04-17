"use client";
import type { MPContactOffice } from "@/types/mp";

export default function MPContacts({ offices }: { offices?: MPContactOffice[] }) {
  if (!offices?.length) return <p className="text-white/60">No office contact details published.</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {offices.map((o, i) => (
        <div key={i} className="rounded-xl border border-white/10 p-3">
          <div className="mb-1 text-sm font-medium">{o.kind} office</div>
          <dl className="text-sm">
            <div className="whitespace-pre-wrap text-white/80">
              <dt className="sr-only">Address</dt>
              <dd>{o.address}</dd>
            </div>

            {o.phone && (
              <div className="mt-1">
                <dt className="sr-only">Phone</dt>
                <dd>
                  ☎️{" "}
                  <a
                    className="underline decoration-white/20 hover:decoration-white"
                    href={`tel:${o.phone}`}
                  >
                    {o.phone}
                  </a>
                </dd>
              </div>
            )}

            {o.email && (
              <div>
                <dt className="sr-only">Email</dt>
                <dd>
                  ✉️{" "}
                  <a
                    className="underline decoration-white/20 hover:decoration-white"
                    href={`mailto:${o.email}`}
                  >
                    {o.email}
                  </a>
                </dd>
              </div>
            )}

            {o.hours && (
              <div className="mt-1 text-xs text-white/60">
                <dt className="sr-only">Hours</dt>
                <dd>{o.hours}</dd>
              </div>
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}
