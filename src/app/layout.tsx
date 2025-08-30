import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Verity — AI-powered political watchdog for Australia",
  description:
    "Track bills, votes and speeches across Australia. Ask questions in plain English and get answers with verifiable sources.",
};

export const viewport: Viewport = { themeColor: "#0B1020" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-zinc-50 text-zinc-900 antialiased`}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
