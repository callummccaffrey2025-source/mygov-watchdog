import { prisma } from "./db";

export async function getMPs(){ return prisma.mP.findMany({ orderBy:{ name:"asc" } }); }
export async function getBills(){ return prisma.bill.findMany({ orderBy:{ introduced:"desc" } }); }
export async function getNews(){ return prisma.news.findMany({ orderBy:{ published:"desc" } }); }

export async function addSubscriber(email:string){
  email = email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  return prisma.subscriber.create({ data:{ email } });
}
