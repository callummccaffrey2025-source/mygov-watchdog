export default function LogosBand() {
  const logos = ["/logos/abc.svg", "/logos/sbs.svg"].filter(Boolean);
  return (
    <section className="mt-10">
      <div className="text-sm text-zinc-500">As seen in</div>
      <div className="mt-3 flex flex-wrap items-center gap-6 opacity-70">
        {logos.map((src) => (
          <img key={src} src={src} alt="" className="h-6 w-auto" />
        ))}
      </div>
    </section>
  );
}
