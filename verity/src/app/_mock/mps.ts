export type MP = {
  id: string;
  name: string;
  electorate?: string;
  party?: string;
  state?: string;
  roles?: string[];
  votes?: Array<{ billId?: string; motion?: string; vote?: string; date?: string }>;
};

export const MPS: MP[] = [
  { id: "alba",  name: "Anthony Albanese", party: "Labor", electorate: "Grayndler", state: "NSW",
    roles: ["Prime Minister"], votes: [{ motion: "Privacy Amendment Bill — 2nd reading", vote: "Aye" }] },
  { id: "dutt",  name: "Peter Dutton",     party: "LNP",   electorate: "Dickson",    state: "QLD",
    roles: ["Leader of the Opposition"] },
  { id: "bandt", name: "Adam Bandt",       party: "Greens",electorate: "Melbourne", state: "VIC" }
];
