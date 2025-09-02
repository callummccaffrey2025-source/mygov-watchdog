import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-10 text-sm opacity-70">
      <div className="flex gap-4">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/press">Press kit</Link>
      </div>
      <div className="mt-4">Verity · Transparency for Australia © {new Date().getFullYear()}</div>
    </footer>
  );
}
