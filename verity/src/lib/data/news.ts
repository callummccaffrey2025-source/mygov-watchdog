export type NewsArticle = { title: string; outlet: string; url: string; stance?: 'Left'|'Right'|'Centrist' };
export type NewsCluster = { id: string; title: string; summary: string; articles: NewsArticle[] };

export const CLUSTERS: NewsCluster[] = [
  {
    id: "housing",
    title: "Housing & Cost of Living",
    summary: "Rents, interest rates, and supply reforms dominate the agenda.",
    articles: [
      { title: "Govt unveils build-to-rent incentives", outlet: "ABC", url: "#", stance: "Centrist" },
      { title: "Opposition says policy misses demand side", outlet: "The Australian", url: "#", stance: "Right" },
      { title: "Advocates push for rent caps", outlet: "Guardian AU", url: "#", stance: "Left" },
    ],
  },
  {
    id: "digital-id",
    title: "Digital ID & Privacy",
    summary: "Debate over national identity infrastructure and safeguards.",
    articles: [
      { title: "Government: safeguards are robust", outlet: "SBS", url: "#", stance: "Centrist" },
      { title: "Critics warn of mission creep", outlet: "News.com.au", url: "#", stance: "Right" },
      { title: "Privacy groups seek stronger oversight", outlet: "Crikey", url: "#", stance: "Left" },
    ],
  },
  {
    id: "energy",
    title: "Energy & Climate",
    summary: "Transition policies, reliability, and bills in the spotlight.",
    articles: [
      { title: "New offshore wind licenses issued", outlet: "ABC", url: "#", stance: "Centrist" },
      { title: "Concerns over grid stability", outlet: "Sky News", url: "#", stance: "Right" },
      { title: "Scientists urge faster transition", outlet: "Guardian AU", url: "#", stance: "Left" },
    ],
  },
];
