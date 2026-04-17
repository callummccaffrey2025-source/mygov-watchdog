export type MP = {
  id: string; name: string;
  electorate?: string; party?: string; state?: string;
  headshot?: string; roles?: string[];
  donors?: Array<{ name?: string; amount?: number; date?: string }>;
  votes?: Array<{ billId?: string; motion?: string; vote?: string; date?: string }>;
};

// super small demo set
export const MPS: MP[] = [
  { id: "alba", name: "Alex Alban", party: "Labor", electorate: "Grayndler", state: "NSW",
    roles: ["Prime Minister"], votes:[{ motion:"Budget bill second reading", vote:"Aye"}] },
  { id: "dut", name: "Peter Dutton", party: "Liberal", electorate: "Dickson", state: "QLD",
    roles: ["Leader of the Opposition"], votes:[{ motion:"Budget bill second reading", vote:"No"}] },
  { id: "bandt", name: "Adam Bandt", party: "Greens", electorate: "Melbourne", state: "VIC",
    roles: ["Leader — Australian Greens"], votes:[{ motion:"Climate bill committee", vote:"Aye"}] },
];
