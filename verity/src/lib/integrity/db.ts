import fs from "node:fs";
import path from "node:path";

export type Source = {
  id: string;
  type: "bill" | "hansard" | "media";
  title: string;
  date: string;
  url: string;
  snippet?: string;
  text: string;
};
export type Bill = {
  id: string;
  title: string;
  stage: string;
  summary: string;
  sponsors: string[];
  last_updated: string;
  sources: string[];
};
export type MP = {
  id: string;
  name: string;
  party: string;
  electorate: string;
  roles: string[];
  integrity: { conflicts: string[]; gifts: string[] };
  votes: Array<{ billId: string; vote: "aye" | "no" | "absent"; date: string }>;
};

const dataDir = path.join(process.cwd(), "src", "data");
const read = <T,>(f: string): T =>
  JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));

export const db = {
  sources: (): Source[] => read<Source[]>("sources.json"),
  bills: (): Bill[] => read<Bill[]>("bills.json"),
  bill: (id: string) => db.bills().find((x) => x.id === id),
  mps: (): MP[] => read<MP[]>("mps.json"),
  mp: (id: string) => db.mps().find((x) => x.id === id),
  topics: (): string[] => read<string[]>("topics.json"),
  status: () => read<any>("status.json"),
  appendWaitlist(email: string, consent: boolean) {
    const file = path.join(dataDir, "waitlist.json");
    let list: any[] = [];
    try {
      list = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {}
    list.push({ email, consent, ts: new Date().toISOString() });
    fs.writeFileSync(file, JSON.stringify(list, null, 2));
  }
};
