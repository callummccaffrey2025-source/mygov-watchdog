import "dotenv/config";
import Parser from "rss-parser";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fetchNewsFromRSS(){
  const feeds = [
    process.env.NEWS_RSS_1 || "https://www.abc.net.au/news/feed/51120/rss.xml",
    process.env.NEWS_RSS_2 || "https://www.theguardian.com/australia-news/australian-politics/rss",
    process.env.NEWS_RSS_3 || "https://www.sbs.com.au/news/topic/politics/rss"
  ];
  const parser = new Parser();
  const items = [];
  for (const url of feeds) {
    try{
      const feed = await parser.parseURL(url);
      for (const it of feed.items.slice(0,20)) {
        const id = (it.guid || it.link || it.title || "").slice(0,64);
        if(!id) continue;
        items.push({
          id,
          title: it.title || "Untitled",
          source: (feed.title || new URL(url).hostname).replace(/ - .*$/,""),
          url: it.link || url,
          published: it.isoDate ? new Date(it.isoDate) : new Date(),
          topic: "Politics"
        });
      }
    }catch(e){ console.error("RSS error", url, e?.message); }
  }
  return items;
}

async function upsertNews(items){
  for(const n of items){
    await prisma.news.upsert({ where:{ id:n.id }, update:n, create:n });
  }
}

async function tick(){
  try{
    const news = await fetchNewsFromRSS();
    if(news.length){ await upsertNews(news); console.log("[ingest] upserted", news.length); }
    else console.log("[ingest] no items");
  }catch(e){ console.error("[ingest] error", e?.message); }
}

await tick();
const every = Number(process.env.INGEST_EVERY_MIN || 30);
setInterval(tick, every*60*1000);
console.log(`[ingest] running every ${every} minutes`);
