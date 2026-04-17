import CoverageBar from "./CoverageBar"; import { timeAgo, dayAndTZ } from "@/utils/datetime";
export type Source={name:string;owner?:string;url:string;stance?:"left"|"center"|"right"|"neutral"};
export type Story={title:string;excerpt?:string;topic:string;published_at:string;coverageMix:{left:number;center:number;right:number};primary:Source;others?:Source[]};
function Dot({ stance }:{stance?:Source["stance"]}){const map={left:"var(--left)",center:"var(--center)",right:"var(--right)",neutral:"var(--brand)"} as const; const bg=stance?map[stance]:"var(--center)"; return <span style={{background:bg}} className="inline-block w-2 h-2 rounded-full align-middle mr-1" />;}
export default function NewsCard({story}:{story:Story}){
  return(<article className="card rounded-2xl p-4">
    <div className="flex items-baseline justify-between gap-3 text-xs text-neutral-100"><div>{dayAndTZ(story.published_at)} · {story.topic}</div></div>
    <h3 className="mt-2 text-[18px] leading-snug font-semibold">{story.title}</h3>
    {story.excerpt&&<p className="mt-1 text-sm text-neutral-100">{story.excerpt}</p>}
    <div className="mt-3"><CoverageBar mix={story.coverageMix}/></div>
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="text-sm text-neutral-100"><Dot stance={story.primary.stance}/><span className="font-medium">{story.primary.name}</span>{story.primary.owner&&<span className="text-zinc-500"> · {story.primary.owner}</span>}<span className="text-zinc-500"> · {timeAgo(story.published_at)}</span></div>
      <a href={story.primary.url} className="btn" aria-label="Open source">Open source →</a>
    </div>
    {story.others?.length?(<div className="mt-3 space-y-2">
      {story.others.map((s,i)=>(<div key={i} className="flex items-center justify-between gap-3 text-sm">
        <div className="text-neutral-100"><Dot stance={s.stance}/><span>{s.name}</span>{s.owner&&<span className="text-zinc-500"> · {s.owner}</span>}</div>
        <a href={s.url} className="text-xs text-neutral-100 hover:text-white">Open source →</a>
      </div>))}
    </div>):null}
    <div className="mt-3 flex items-center gap-5 text-sm text-neutral-100"><a href="#" className="hover:text-white">Follow topic</a><a href="#" className="hover:text-white">Share</a><a href="#" className="hover:text-white">Report issue</a></div>
  </article>);
}
