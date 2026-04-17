export default function LogoCloud({
  items = ["ABC", "SBS", "Guardian", "AFR", "SMH", "Crikey"],
}: { items?: string[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-80">
        {items.map((name) => (
          <div
            key={name}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
