import "./globals.css";

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Verity — Australian politics you can actually read",
  description:
    "Track legislation, understand what MPs are doing, and see how new bills impact you.",
  openGraph: {
    title: "Verity",
    description: "Australian politics you can actually read",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Verity",
    description: "Australian politics you can actually read",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black text-white">
      <body>{children}</body>
    </html>
  );
}
