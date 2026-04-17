export type MPHit = { id: string; name: string; party: string; electorate: string; };
export type BillHit = { id: string; title: string; status?: string; predictedPass?: number; };
export type ArticleHit = { id: string; title: string; outlet: string; url: string; };

const DEMO: { mps: MPHit[]; bills: BillHit[]; articles: ArticleHit[] } = {
  mps: [
    { id: "mp1", name: "Jane Smith", party: "Independent", electorate: "Sydney" },
    { id: "mp2", name: "Alex Nguyen", party: "Greens", electorate: "Melbourne" }
  ],
  bills: [
    { id: "bill1", title: "Climate Action Bill 2025", status: "Second Reading", predictedPass: 0.72 },
    { id: "bill2", title: "Digital Integrity Bill", status: "Committee", predictedPass: 0.58 }
  ],
  articles: [
    { id: "a1", title: "Budget 2025: Key Measures", outlet: "ABC", url: "https://example.com/a1" },
    { id: "a2", title: "Election Reform Debate", outlet: "SBS", url: "https://example.com/a2" }
  ]
};

export async function search(q: string){
  const qn = (q||"").toLowerCase();
  const pick = (arr: any[]) => arr.filter(x => !qn || JSON.stringify(x).toLowerCase().includes(qn));
  return {
    mps: pick(DEMO.mps),
    bills: pick(DEMO.bills).map(b => ({ ...b, predictedPass: b?.predictedPass ?? 0 })),
    articles: pick(DEMO.articles)
  };
}

export async function demoSearch(){
  return {
    mps: DEMO.mps,
    bills: DEMO.bills.map(b => ({ ...b, predictedPass: b?.predictedPass ?? 0 })),
    articles: DEMO.articles
  };
}
