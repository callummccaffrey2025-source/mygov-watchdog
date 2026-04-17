const collections=[{slug:"site",name:"Verity — All Pages"},{slug:"personalisation",name:"Personalisation"}];
export default function PreviewsHome(){
  return (
    <div>
      <h1 className="text-2xl font-bold">Previews</h1>
      <ul className="mt-4 space-y-2">
        {collections.map(c=> <li key={c.slug}><a className="text-blue-400" href={`/previews/${c.slug}`}>{c.name}</a></li>)}
      </ul>
    </div>
  );
}
