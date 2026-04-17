import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Verity";
  return new ImageResponse(
    (
      <div style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",justifyContent:"center",padding:"80px",background:"#000",color:"#e6e6ea"}}>
        <div style={{fontSize:64,fontWeight:800,lineHeight:1.1}}> {title} </div>
        <div style={{marginTop:16,color:"#6ee7b7"}}>verity.run — receipts instead of spin</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
