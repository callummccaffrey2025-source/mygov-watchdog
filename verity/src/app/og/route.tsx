import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Verity").slice(0, 120);
  const subtitle = searchParams.get("subtitle") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          background: "#0a0a0a",
          color: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, marginBottom: 16 }}>
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "8px 14px",
              borderRadius: 999,
              width: "fit-content",
            }}
          >
            {subtitle}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 28,
            fontSize: 24,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          verity.run
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
