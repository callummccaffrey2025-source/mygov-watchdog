export function timeAgo(iso:string){
  const dt=new Date(iso); const m=Math.max(1,Math.floor((Date.now()-dt.getTime())/60000));
  if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; const d=Math.floor(h/24); return `${d}d ago`;
}
export function dayAndTZ(iso:string,tz="Australia/Sydney"){
  const d=new Date(iso);
  const day=new Intl.DateTimeFormat("en-AU",{weekday:"short"}).format(d);
  const hm=new Intl.DateTimeFormat("en-AU",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:tz}).format(d);
  return `${day} ${hm} · ${tz}`;
}
