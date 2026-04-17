import { ImageResponse } from "next/og";
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "Verity").slice(0, 80);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "white",
          fontSize: 64,
          fontWeight: 800,
        }}
      >
        <div style={{ color: "#34d399", fontSize: 24, marginBottom: 16 }}>Verity</div>
        <div style={{ lineHeight: 1.05 }}>{title}</div>
        <div style={{ marginTop: 16, fontSize: 24, color: "#a3a3a3" }}>
          Transparency for Australia
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
