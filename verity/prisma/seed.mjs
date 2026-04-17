import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run(){
  const mps = [
    { id:"albanese", name:"Anthony Albanese", party:"Labor",  electorate:"Grayndler" },
    { id:"dutton",   name:"Peter Dutton",    party:"Liberal", electorate:"Dickson"   },
    { id:"bandt",    name:"Adam Bandt",     party:"Greens",  electorate:"Melbourne" }
  ];
  const bills = [
    { id:"privacy-amendment-bill", title:"Privacy Amendment Bill", summary:"Strengthens privacy safeguards and penalties.", status:"House — Committee", introduced:new Date("2025-08-12T00:00:00Z"), sponsor:"Attorney-General" },
    { id:"clean-energy-transition-bill", title:"Clean Energy Transition Bill", summary:"Framework for renewable build-out and storage.", status:"Senate — Second Reading", introduced:new Date("2025-07-03T00:00:00Z") }
  ];
  const now = new Date();
  const news = [
    { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au/news", published:now, topic:"Economy" },
    { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:now, topic:"Climate" },
    { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au/news", published:now, topic:"Integrity" }
  ];
  await prisma.subscriber.deleteMany();
  await prisma.news.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.mP.deleteMany();
  await prisma.mP.createMany({ data:mps });
  await prisma.bill.createMany({ data:bills });
  await prisma.news.createMany({ data:news });
  console.log("Seed complete");
}
run().finally(()=>process.exit(0));
