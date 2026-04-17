const fs = require("fs");
const path = require("path");

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? (process.argv[i+1] || d) : d;
};
const N_SRC = +arg("--sources", 120);
const N_BIL = +arg("--bills",   28);
const N_MPS = +arg("--mps",     52);

function rng(seed="verity"){
  let h=0; for(let i=0;i<seed.length;i++) h=(h*31+seed.charCodeAt(i))>>>0;
  return () => (h = (1103515245 * h + 12345) >>> 0) / 2**32;
}
const rnd = rng("verity-au-demo");

const parties = ["Labor","Liberal","National","Greens","Independent"];
const electorates = [
  "Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra","Higgins","Grayndler",
  "Kooyong","Wentworth","Warringah","Curtin","Fowler","Mackellar","Goldstein","Ryan"
];
const stages = ["Introduced","Second reading","Committee","Reported","Third reading","Assented"];
const topics = ["budget","housing","integrity","climate","health","education","defence","tax","immigration","transparency"];

function pick(arr){ return arr[Math.floor(rnd()*arr.length)] }
function idify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"") }

function genMP(i){
  const name = `MP ${String.fromCharCode(65 + (i%26))} ${100+i}`;
  return {
    id: `mp-${i+1}`,
    name, party: pick(parties), electorate: pick(electorates),
    roles: ["Member of Parliament"],
    integrity: { conflicts: [], gifts: [] },
    votes: []
  };
}

function genBill(i){
  const t = `Public Interest (Transparency) Amendment Bill ${2024 + (i%3)}`;
  return {
    id: `bill-${i+1}`,
    title: t,
    stage: pick(stages),
    summary: "Improves disclosure and accountability in public decision-making.",
    sponsors: [ pick(parties) ],
    last_updated: new Date(Date.now() - (i*86400000)).toISOString(),
    sources: []
  };
}

function genSource(i, bills){
  const kind = pick(["bill","hansard","media"]);
  const bill = pick(bills);
  const date = new Date(Date.now() - (i*3600*1000)).toISOString();
  const title = kind==="bill"
    ? `${bill.title} — Explanatory Memorandum`
    : kind==="hansard"
      ? `Hansard: Debate on ${pick(topics)} and ${pick(topics)}`
      : `Media release: ${pick(["Budget","Housing","Integrity","Transparency","Compliance"])} update`;
  const url = kind==="hansard"
    ? `https://parlinfo.aph.gov.au/hansard/${idify(title)}`
    : kind==="bill"
      ? `https://www.legislation.gov.au/bill/${bill.id}`
      : `https://minister.gov.au/releases/${idify(title)}`;
  const text = `${title}. Discussion of ${pick(topics)} and ${pick(topics)} with commitments to transparency.`;
  const snippet = text.slice(0,160);

  // Link some sources to bills
  if (rnd() < 0.6) bill.sources.push(`src-${i+1}`);

  return {
    id: `src-${i+1}`, type: kind, title, date, url, snippet, text
  };
}

function ensureDir(p){ fs.mkdirSync(path.dirname(p), { recursive: true }); }
function backup(p){
  if (fs.existsSync(p)) {
    const b = p.replace(/\.json$/, `.bak.${Date.now()}.json`);
    fs.copyFileSync(p,b);
  }
}

const dataDir = path.join("src","data");
ensureDir(path.join(dataDir,"x"));

const mps = Array.from({length: N_MPS}, (_,i)=>genMP(i));
const bills = Array.from({length: N_BIL}, (_,i)=>genBill(i));
const sources = Array.from({length: N_SRC}, (_,i)=>genSource(i, bills));

const status = {
  uptime30d: "99.98%",
  lastIngest: {
    bills: new Date().toISOString(),
    hansard: new Date().toISOString(),
    media: new Date().toISOString()
  }
};

const files = {
  "mps.json": mps,
  "bills.json": bills,
  "sources.json": sources,
  "topics.json": topics,
  "status.json": status
};
for (const [name, obj] of Object.entries(files)) {
  const p = path.join(dataDir, name);
  backup(p);
  fs.writeFileSync(p, JSON.stringify(obj,null,2));
  console.log("✓ wrote", p, Array.isArray(obj)?`(${obj.length})`:"");
}
