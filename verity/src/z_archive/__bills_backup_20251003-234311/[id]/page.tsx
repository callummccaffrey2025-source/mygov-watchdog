export default function Bill({ params }:{ params:{ id:string } }){
  return <main style={{padding:24}}>/bills/{params.id} ✅</main>;
}
