export default function Section({ title, children }:{title?:string; children:React.ReactNode}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}
