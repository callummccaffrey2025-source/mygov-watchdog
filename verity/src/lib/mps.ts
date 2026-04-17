export type MP = { id: string; name: string; party: string; attendance: number; vote_alignment: number; topics: string[]; links: string[] };
export const MPS: MP[] = [
  { id: "doe-anne", name: "Anne Doe", party: "Independent", attendance: 0.96, vote_alignment: 0.88, topics: ["privacy","economy"], links: ["#"] },
  { id: "smith-john", name: "John Smith", party: "Labor", attendance: 0.92, vote_alignment: 0.81, topics: ["health","education"], links: ["#"] },
];
export const getMP = (id: string) => MPS.find(x => x.id === id) || null;
