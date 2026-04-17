import fs from "node:fs/promises";
import path from "node:path";
import { MP_PROFILE, type PageSpec } from "../ui-spec";

const out = (p: string) => path.join(process.cwd(), p);
const safe = (s: string) => s.replace(/\n{3,}/g, "\n\n").trim();
const idToFn = (id: string) => id.replace(/\./g,"_");

function genPage(spec: PageSpec) {
  const pagePath = `src/app${spec.route}/page.tsx`;
  const ds0 = spec.datasources[0].id;
  const ds1 = spec.datasources[1]?.id;

  const imports = `
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fetch_${idToFn(ds0)} } from "@/lib/data/${idToFn(ds0)}";
${ds1 ? `import { fetch_${idToFn(ds1)} } from "@/lib/data/${idToFn(ds1)}";` : ""}
`.trim();

  const hero = `
async function Hero({ slug }: { slug: string }) {
  const mp = await fetch_${idToFn(ds0)}(slug);
  if (!mp) { return <div className="p-6 text-white/70">Temporarily unavailable — data loading failed.</div>; }
  return (
    <div className="flex items-center gap-6">
      {mp.photoUrl ? <Image src={mp.photoUrl} alt={mp.name} width={96} height={96} className="rounded-2xl" /> : null}
      <div>
        <h1 className="text-2xl font-semibold">{mp.name}</h1>
        <div className="flex gap-2 mt-1">
          {mp.party ? <Badge variant="secondary">{mp.party}</Badge> : null}
          {mp.electorate ? <span className="text-sm text-white/60">{mp.electorate}</span> : null}
        </div>
      </div>
    </div>
  );
}
`.trim();

  const votes = ds1 ? `
async function Votes({ slug }: { slug: string }) {
  const rows = await fetch_${idToFn(ds1)}(slug);
  if (!rows?.length) { return <div className="p-6 text-white/70">No votes found.</div>; }
  return (
    <div className="mt-4 grid gap-2">
      {rows.map((r: any, i: number) => (
        <Card key={i}>
          <CardHeader className="text-base">{r.bill}</CardHeader>
          <CardContent className="flex justify-between text-sm text-white/80">
            <Badge variant="outline">{r.position}</Badge>
            <span>{new Date(r.date).toLocaleDateString("en-AU")}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
`.trim() : "";

  const page = `
${imports}

export default async function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return notFound();
  return (
    <div className="p-6 space-y-6">
      <Suspense>
        {/* @ts-expect-error Async Server Component */}
        <Hero slug={slug} />
      </Suspense>

      <Tabs defaultValue="overview" className="mt-2">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          ${ds1 ? `<TabsTrigger value="votes">Votes</TabsTrigger>` : ""}
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent>Party & Electorate</CardContent></Card>
          </div>
        </TabsContent>
        ${ds1 ? `<TabsContent value="votes"><Suspense>{/* @ts-expect-error Async Server Component */}<Votes slug={slug} /></Suspense></TabsContent>` : ""}
      </Tabs>
    </div>
  );
}

${hero}
${votes}
`.trim();

  return { pagePath, pageContent: safe(page) };
}

async function writeFile(p: string, c: string) {
  await fs.mkdir(path.dirname(out(p)), { recursive: true });
  await fs.writeFile(out(p), c, "utf8");
  console.log("✅ Generated", p);
}

async function main() {
  const specs: PageSpec[] = [MP_PROFILE];
  for (const spec of specs) {
    const { pagePath, pageContent } = genPage(spec);
    await writeFile(pagePath, pageContent);
  }
}
main().catch(err => { console.error(err); process.exit(1); });
