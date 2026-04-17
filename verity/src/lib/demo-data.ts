export type Bill = {
  id: string; title: string; summary: string; stage: "Introduced"|"Committee"|"House"|"Senate"|"Passed";
  lastUpdated: string; sourceUrl: string; tags: string[];
};
export type MP = {
  id: string; name: string; party: string; electorate: string;
  bio: string; committees: string[]; integrityScore: number; image?: string;
};

export const bills: Bill[] = [
  { id:"privacy-amendment-2025", title:"Privacy Amendment Bill 2025",
    summary:"Strengthens privacy protections and penalties.",
    stage:"Committee", lastUpdated:"2025-09-01",
    sourceUrl:"https://www.aph.gov.au/", tags:["privacy","consumer","data"] },
  { id:"ai-safety-2025", title:"AI Safety (Standards) Bill 2025",
    summary:"Establishes baseline model transparency and safety reporting.",
    stage:"House", lastUpdated:"2025-08-20",
    sourceUrl:"https://www.aph.gov.au/", tags:["ai","standards"] },
];

export const mps: MP[] = [
  { id:"anne-doe", name:"Anne Doe", party:"Independent", electorate:"Sydney",
    bio:"Former journalist focused on transparency and elections.",
    committees:["Integrity","Legal"], integrityScore: 88, image:"/og.png" },
  { id:"ben-green", name:"Ben Green", party:"Greens", electorate:"Melbourne",
    bio:"Privacy advocate. Previously engineer.", committees:["Technology"], integrityScore: 91, image:"/og.png" },
];

export const siteIndex: { title:string; href:string; group?:string }[] = [
  { title:"Home", href:"/", group:"Site" },
  { title:"Product", href:"/product", group:"Site" },
  { title:"Pricing", href:"/pricing", group:"Site" },
  { title:"Trust", href:"/trust", group:"Company" },
  { title:"Integrity", href:"/integrity", group:"Company" },
  { title:"Ask", href:"/ask", group:"Modules" },
  { title:"Search", href:"/search", group:"Modules" },
  { title:"Bill tracker", href:"/bills", group:"Modules" },
  { title:"MP profiles", href:"/mps", group:"Modules" },
  { title:"Alerts & briefings", href:"/alerts", group:"Modules" },
  ...bills.map(b=>({title:`Bill · ${b.title}`, href:`/bills/${b.id}`, group:"Bills"})),
  ...mps.map(m=>({title:`MP · ${m.name}`, href:`/mps/${m.id}`, group:"MPs"})),
];
