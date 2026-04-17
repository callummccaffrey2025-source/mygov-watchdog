import { ImageResponse } from "next/og";

// Route Segment Config
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * This is the default OG image for the whole app.
 * Next will use this for any route that doesn't define its own.
 */
export default async function OgImage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(135deg, #030712 0%, #111827 100%)",
          color: "white",
          padding: 64,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Inter, Helvetica, Arial",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800 }}>Verity</div>
        <div style={{ marginTop: 12, fontSize: 28, opacity: 0.9 }}>
          Politics you can trust — bills, MPs & news at a glance.
        </div>
        <div style={{ marginTop: "auto", fontSize: 20, opacity: 0.75 }}>{base.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    size
  );
}
