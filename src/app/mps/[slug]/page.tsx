import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fetch_mp_bySlug } from "@/lib/data/mp_bySlug";
import { fetch_mp_votes } from "@/lib/data/mp_votes";

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
          <TabsTrigger value="votes">Votes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent>Party & Electorate</CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value="votes"><Suspense>{/* @ts-expect-error Async Server Component */}<Votes slug={slug} /></Suspense></TabsContent>
      </Tabs>
    </div>
  );
}

async function Hero({ slug }: { slug: string }) {
  const mp = await fetch_mp_bySlug(slug);
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
async function Votes({ slug }: { slug: string }) {
  const rows = await fetch_mp_votes(slug);
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