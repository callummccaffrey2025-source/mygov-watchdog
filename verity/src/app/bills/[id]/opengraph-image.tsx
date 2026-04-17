import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "white",
        }}
      >
        Verity — Bill
      </div>
    ),
    { ...size }
  );
}
