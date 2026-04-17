export default function CitationBlock({ url, title, publisher }:{ url:string; title?:string; publisher?:string; }) {
  return <div className="text-xs text-slate-600">Source: <a className="underline" href={url} target="_blank">{title ?? url}</a>{publisher ? ` — ${publisher}` : ""}</div>;
}
