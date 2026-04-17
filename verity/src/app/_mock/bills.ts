export type Bill = { id:string; title:string; stage?:string; introduced?:string; sponsor?:string; progress?:number; summary?:string; status?:string };
export const BILLS: Bill[] = [
  { id:"reform",   title:"Electoral Reform Bill 2025", stage:"Second reading", introduced:"22/09/2025", sponsor:"Attorney-General", progress:60, summary:"Reforms electoral processes." },
  { id:"privacy",  title:"Digital Privacy Amendment",  stage:"Introduced",     introduced:"22/09/2025", sponsor:"Attorney-General", progress:20, summary:"Strengthens privacy safeguards." },
  { id:"infra",    title:"Infrastructure Funding Act", stage:"Committee",      introduced:"22/09/2025", sponsor:"Treasurer",        progress:35, summary:"Funds national infrastructure." }
];
