import fs from 'node:fs/promises';
import path from 'node:path';
import slugify from 'slugify';

type MP = {
  id:string; slug:string; name:string;
  party:'Labor'|'Liberal'|'National'|'Greens'|'Independent'|'Other';
  chamber:'House'|'Senate'; electorate:string; portraitUrl?:string;
  attendance:{overallPct:number;last12mPct:number;series:Array<[string,number]>};
  rebellions12m:number; committees:{name:string;role:'Chair'|'Member';attendancePct?:number}[];
  roles:string[]; votes:any[]; speeches:any[]; interestsUrl?:string;
  donations?:any[]; signals:any[]; receipts:any[];
};

const PORTRAIT='https://placehold.co/200x240';
const parties:MP['party'][]=['Labor','Liberal','National','Greens','Independent'];

const months=['2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01','2025-06-01','2025-07-01'];
const mkSeries=()=>months.map((m,i)=>[m,90+((i*2)%8)]) as Array<[string,number]>;

function mk(i:number, chamber:'House'|'Senate', name?:string, slug?:string, party?:MP['party'], electorate?:string):MP{
  const nm=name??(chamber==='House'?'Member ':'Senator ')+i;
  const sl=slug??slugify(nm,{lower:true,strict:true});
  const p=party??parties[i%parties.length];
  const el=electorate??(chamber==='House'?`Electorate ${i}`:`State/Territory ${((i-1)%8)+1}`);
  return {
    id: sl, slug: sl, name: nm, party: p, chamber, electorate: el, portraitUrl: PORTRAIT,
    attendance:{overallPct:92+(i%7), last12mPct:93+(i%6), series: mkSeries()},
    rebellions12m: i%4===0?1:0,
    committees:[{name:['Economics','Health','Environment','Infrastructure','Legal','Foreign Affairs'][i%6], role:i%5===0?'Chair':'Member', attendancePct:90+(i%9)}],
    roles:[chamber==='House'?'MP':'Senator'],
    votes:[{date:'2025-08-20', billId:'housing-bill-2025', billTitle:'Housing Affordability Bill 2025', position:(i%3?'Aye':'No'), division:'Passed', topics:['Housing','Economy'], receipts:[{label:'Division list', url:'#', source:'APH'}]}],
    speeches:[], interestsUrl:'#', donations:[], signals:[], receipts:[{label:'Attendance CSV', url:'#', source:'APH'}],
  };
}

async function main(){
  const list:MP[]=[];
  for(let i=1;i<=151;i++) list.push(mk(i,'House'));
  for(let i=1;i<=76;i++) list.push(mk(i,'Senate'));

  // Preserve known slugs you already tested/linked
  const replace=(m:MP)=>{ const idx=list.findIndex(x=>x.slug===m.slug); if(idx>=0) list[idx]=m; else list.unshift(m); };
  replace(mk(1,'House','Alex Smith','alex-smith','Independent','Sydney'));
  replace(mk(2,'House','Anthony Albanese','anthony-albanese','Labor','Grayndler'));
  replace(mk(3,'House','Peter Dutton','peter-dutton','Liberal','Dickson'));
  replace(mk(4,'Senate','Penny Wong','penny-wong','Labor','SA'));
  replace(mk(5,'Senate','Katy Gallagher','katy-gallagher','Labor','ACT'));

  // Deduplicate by slug and cap to exactly 227
  const map=new Map<string,MP>(); for(const m of list) map.set(m.slug,m);
  const final=Array.from(map.values()).slice(0,227);

  await fs.mkdir(path.join('public','data'),{recursive:true});
  await fs.writeFile(path.join('public','data','mps-au.json'), JSON.stringify(final,null,2));
  console.log(`Wrote ${final.length} MPs -> public/data/mps-au.json`);
  console.log('Sample slugs:', final.slice(0,8).map(x=>x.slug));
}
main().catch(e=>{console.error(e);process.exit(1);});
