import type { MP, Bill, NewsItem } from "@/types";

export const MPs: MP[] = [
  { id:"albanese", name:"Anthony Albanese", party:"Labor", electorate:"Grayndler" },
  { id:"dutton",   name:"Peter Dutton",    party:"Liberal", electorate:"Dickson" },
  { id:"bandt",    name:"Adam Bandt",     party:"Greens", electorate:"Melbourne" },
];

export const Bills: Bill[] = [
  { id:"privacy", title:"Privacy Amendment Bill", summary:"Strengthens privacy safeguards and penalties.", status:"House — Committee", introduced:"2025-08-12", sponsor:"Attorney-General" },
  { id:"netzero", title:"Clean Energy Transition Bill", summary:"Framework for renewable build-out and storage.", status:"Senate — Second Reading", introduced:"2025-07-03" }
];

export const News: NewsItem[] = [
  { id:"n1", title:"Budget negotiations intensify", source:"ABC", url:"https://www.abc.net.au", published:new Date().toISOString(), topic:"Economy" },
  { id:"n2", title:"Emissions scheme update clears Senate", source:"The Guardian AU", url:"https://www.theguardian.com/au", published:new Date().toISOString(), topic:"Climate" },
  { id:"n3", title:"New integrity watchdog powers debated", source:"SBS", url:"https://www.sbs.com.au", published:new Date().toISOString(), topic:"Integrity" },
];
