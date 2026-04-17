import type { Metadata } from "next";
import Image from "next/image";
// was "../../components/section"
import Section from "../../../components/section";
// was "../../components/container"
import Container from "../../../components/container";


export const metadata: Metadata = {
  title: "Product",
  description: "Understand policy fast with traceable sources.",
  alternates: { canonical: "/product" },
  openGraph: { images: ["/og?title=Product&tag=Product"] },
};

type Tile = { id: string; title: string; desc: string; href: string; img: string };

const tiles: Tile[] = [
  { id: "ask",    title: "Ask",              desc: "Clear answers with citations.",               href: "#ask",    img: "/og.png" },
  { id: "search", title: "Search",           desc: "Bills, Hansard, press releases in one place.",href: "#search", img: "/og.png" },
  { id: "bills",  title: "Bill tracker",     desc: "Follow changes over time with diffs.",        href: "#bills",  img: "/og.png" },
  { id: "mps",    title: "MP profiles",      desc: "Positions, voting, integrity signals.",       href: "#mps",    img: "/og.png" },
  { id: "alerts", title: "Alerts & briefings",desc: "Daily updates on topics, bills, or MPs.",    href: "#alerts", img: "/og.png" },
] as const;

export default function Product() {
  return (
    <Section className="pt-16 md:pt-24">
      <Container>
        <h1 className="text-4xl md:text-5xl font-serif font-extrabold">Product</h1>
        <p className="mt-2 text-neutral-400">
          Modules that make Australian policy transparent — with sources.
        </p>

        {/* Module tiles */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <a key={t.id} href={t.href} className="card card-hover block p-6">
              <div className="text-lg font-semibold text-neutral-100">{t.title}</div>
              <p className="mt-1 text-sm text-neutral-400">{t.desc}</p>
              <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
                <Image
                  src={t.img}
                  alt={`${t.title} preview`}
                  width={800}
                  height={450}
                  className="h-auto w-full"
                  priority={t.id === "ask"}
                />
              </div>
            </a>
          ))}
        </div>

        {/* Anchored sections */}
        <div className="mt-12 grid gap-12">
          {tiles.map((t) => (
            <section key={t.id} id={t.id} className="scroll-mt-24">
              <h2 className="text-2xl font-semibold">{t.title}</h2>
              <p className="mt-1 text-neutral-400">{t.desc}</p>
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
                <Image src={t.img} alt={`${t.title} screenshot`} width={1200} height={675} className="h-auto w-full" />
              </div>
            </section>
          ))}
        </div>
      </Container>
    </Section>
  );
}
