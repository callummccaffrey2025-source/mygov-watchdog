import fs from 'node:fs/promises';
import path from 'node:path';
import type { MP } from '../types/mp';

const PORTRAIT = 'https://placehold.co/200x240';

async function loadReal(): Promise<MP[]|null> {
  try {
    const p = path.join(process.cwd(), 'public', 'data', 'mps-au.json');
    const raw = await fs.readFile(p, 'utf8');
    const arr = JSON.parse(raw) as MP[];
    if (Array.isArray(arr) && arr.length) return arr;
    return null;
  } catch { return null; }
}

function synthetic(): MP[] {
  // 151 House + 76 Senate = 227
  const parties: MP['party'][] = ['Labor','Liberal','National','Greens','Independent'];
  const committees = ['Economics','Health','Environment','Infrastructure','Legal','Foreign Affairs'];
  const mkSeries = () => {
    const months = ['2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-07-01'];
    return months.map((m,i)=>[m, 90 + ((i*2)%8)]) as Array<[string,number]>;
  };
  const mk = (i: number, chamber: 'House'|'Senate', name?: string, slug?: string, party?: MP['party'], electorateOverride?: string): MP => {
    const _name = name ?? (chamber==='House'?'Member ':'Senator ') + i;
    const _slug = slug ?? (chamber==='House'?'member-':'senator-') + i;
    const _party = party ?? parties[i % parties.length];
    return {
      id: _slug, slug: _slug, name: _name, party: _party, chamber,
      electorate: electorateOverride ?? (chamber==='House' ? `Electorate ${i}` : `State/Territory ${((i-1)%8)+1}`),
      portraitUrl: PORTRAIT,
      attendance: { overallPct: 92 + (i%7), last12mPct: 93 + (i%6), series: mkSeries() },
      rebellions12m: i % 4 === 0 ? 1 : 0,
      committees: [{ name: committees[i%committees.length], role: i%5===0?'Chair':'Member', attendancePct: 90 + (i%9) }],
      roles: [chamber==='House' ? 'MP' : 'Senator'],
      votes: [
        { date:'2025-08-20', billId:'housing-bill-2025', billTitle:'Housing Affordability Bill 2025', position: (i%3? 'Aye':'No'), division:'Passed', topics:['Housing','Economy'], receipts:[{label:'Division list', url:'#', source:'APH'}]},
      ],
      speeches: [{ date:'2025-08-19', title:'Second reading contribution — Housing Bill', url:'#', receipts:[{label:'Hansard', url:'#', source:'Hansard'}]}],
      interestsUrl:'#',
      donations:[{ amount: 1000 + (i%5)*250, source:'Disclosure', date:'2025-05-01', receipts:[{label:'AEC disclosure', url:'#', source:'AEC'}]}],
      signals: i%7===0 ? [{kind:'FloorCross', summary:'Crossed floor on energy amendment', date:'2025-07-02', receipts:[{label:'Division list', url:'#', source:'APH'}]}] : [],
      receipts:[{label:'Attendance CSV', url:'#', source:'APH'}],
    };
  };

  const list: MP[] = [];
  for (let i=1;i<=151;i++) list.push(mk(i,'House'));
  for (let i=1;i<=76;i++) list.push(mk(i,'Senate'));

  // Seed friendly slugs you’ve been using so existing links work (keeps total at 227)
  list[0] = mk(1, 'House', 'Alex Smith', 'alex-smith', 'Independent', 'Sydney');
  list[1] = mk(2, 'House', 'Jamie Lee', 'jamie-lee', 'Labor', 'Grayndler');

  return list;
}

let cache: MP[]|null = null;

export async function listAllMPs(): Promise<MP[]> {
  if (cache) return cache;
  const real = await loadReal();
  cache = real ?? synthetic();
  return cache;
}

export async function getMPBySlug(slug: string): Promise<MP|null> {
  const all = await listAllMPs();
  return all.find(m => m.slug === slug) ?? null;
}

export type SearchInput = {
  q?: string;
  party?: string[];
  chamber?: ('House'|'Senate')[];
  minAttendance?: number;
  page?: number;
  pageSize?: number;
  sort?: 'alpha'|'attendance_desc'|'rebellions_desc';
};

export async function searchMPs(inp: SearchInput) {
  const all = await listAllMPs();
  let rows = all.slice();

  if (inp.q) {
    const q = inp.q.toLowerCase();
    rows = rows.filter(m => `${m.name} ${m.party} ${m.electorate}`.toLowerCase().includes(q));
  }
  if (inp.party?.length) rows = rows.filter(m => inp.party!.includes(m.party));
  if (inp.chamber?.length) rows = rows.filter(m => inp.chamber!.includes(m.chamber));
  if (typeof inp.minAttendance === 'number') rows = rows.filter(m => (m.attendance.last12mPct ?? 0) >= (inp.minAttendance as number));

  switch (inp.sort) {
    case 'attendance_desc': rows.sort((a,b)=> (b.attendance.last12mPct)-(a.attendance.last12mPct)); break;
    case 'rebellions_desc': rows.sort((a,b)=> (b.rebellions12m)-(a.rebellions12m)); break;
    default: rows.sort((a,b)=> a.name.localeCompare(b.name)); break;
  }

  const pageSize = Math.max(1, Math.min(inp.pageSize ?? 24, 60));
  const page = Math.max(1, inp.page ?? 1);
  const total = rows.length;
  const start = (page-1)*pageSize;
  const items = rows.slice(start, start+pageSize);

  return { items, total, page, pageSize };
}
