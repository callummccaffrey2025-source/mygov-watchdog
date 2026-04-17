export const runtime = "edge";
import { MPS } from "@/lib/mps";
import { getBill } from "@/lib/bills";
import { diffWords } from "@/lib/diff";
import { requireKey, unauthorized } from "@/lib/auth";

function csv(rows: string[][]) {
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
}

export async function GET(req: Request) {
  if (!requireKey(req)) return unauthorized();

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "mps";
  const origin = url.origin;

  if (type === "mps") {
    const rows = [["id","name","party","attendance","vote_alignment"]];
    for (const m of MPS) rows.push([m.id, m.name, m.party, String(m.attendance), String(m.vote_alignment)]);
    return new Response(csv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="mps.csv"',
        "cache-control": "no-store"
      }
    });
  }

  if (type === "watchlist") {
    const res = await fetch(`${origin}/api/watchlist`, { cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(()=>[])) as {topic:string}[] || [];
    const rows = [["topic"], ...data.map(d => [d.topic])];
    return new Response(csv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="watchlist.csv"',
        "cache-control": "no-store"
      }
    });
  }

  if (type === "explainer") {
    const slug = url.searchParams.get("slug") || "";
    const bill = getBill(slug);
    if (!bill) return new Response("not_found", { status: 404 });
    const rows: string[][] = [
      ["slug","title","summary"],
      [bill.slug, bill.title, bill.summary],
      [],
      ["stages"], ...bill.stages.map(s => [s]),
      [],
      ["q","a"], ...bill.qas.map(x => [x.q, x.a]),
      [],
      ["source_title","url"], ...bill.sources.map(s => [s.title, s.url]),
    ];
    return new Response(csv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${bill.slug}.csv"`,
        "cache-control": "no-store"
      }
    });
  }

  if (type === "diff") {
    // Use the mock diff source for now
    const res = await fetch(`${origin}/api/diff/mock`, { cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(()=>null)) as { before: string; after: string } | null;
    if (!data) return new Response("not_found", { status: 404 });

    const tokens = diffWords(data.before, data.after);
    const rows: string[][] = [
      ["section","text"],
      ["before", data.before],
      ["after", data.after],
      [],
      ["token_type","token_text"],
      ...tokens.map(t => [t.type, t.text])
    ];
    return new Response(csv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="diff.csv"',
        "cache-control": "no-store"
      }
    });
  }

  return new Response("unknown type", { status: 400 });
}
