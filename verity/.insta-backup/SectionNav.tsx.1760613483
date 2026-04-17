export default function SectionNav(){
  const items = [
    {href:"#scorecard", label:"At a glance"},
    {href:"#highlights", label:"Highlights"},
    {href:"#votes", label:"Votes"},
    {href:"#committees", label:"Committees"},
    {href:"#contacts", label:"Contacts"},
  ];
  return (
    <nav className="sticky top-14 z-10 mt-4 -mx-1 flex flex-wrap gap-2 rounded-xl bg-black/20 p-1 backdrop-blur">
      {items.map(i=>(
        <a key={i.href} href={i.href}
           className="px-3 py-1.5 text-sm rounded-lg text-white/80 hover:text-white hover:bg-white/10">
          {i.label}
        </a>
      ))}
    </nav>
  );
}
