import { db } from "@/lib/db";
export async function getBriefing(){
  const [topNews, recentBills] = await Promise.all([
    db.news.findMany({ orderBy: { published: "desc" }, take: 6 }),
    db.bill.findMany({ orderBy: { introduced: "desc" }, take: 5 }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    headlines: topNews.map((n: any) => ({ id:n.id, title:n.title, source:n.source, published:n.published, url:(n as any).url })),
    bills: recentBills.map((b: any) => ({ id:b.id, title:b.title, status:b.status, introduced:b.introduced })),
  };
}
