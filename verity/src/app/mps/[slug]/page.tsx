type Params = { params:{ slug:string } };
export default function MPPage({ params }: Params){
  return <div className="p-6">MP: {params.slug} — placeholder</div>;
}
