type Params = { params:{ slug:string; id:string } };
export default function MPDetail({ params }: Params){
  return <div className="p-6">MP: {params.slug} — ID: {params.id} — placeholder</div>;
}
