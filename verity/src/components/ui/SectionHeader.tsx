export default function SectionHeader({title, caption}:{title:string; caption?:string}){
  return (
    <div className="section-h">
      <h2 className="section-title">{title}</h2>
      {caption ? <span className="section-cap">{caption}</span> : null}
    </div>
  );
}
