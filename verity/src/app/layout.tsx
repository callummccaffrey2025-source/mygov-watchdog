import Link from "next/link";
export const metadata = { title: "Verity", description: "Transparency for Australia" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body className="antialiased">
      <header className="border-b">
        <div className="mx-auto max-w-6xl flex items-center justify-between p-4">
          <Link href="/" className="font-semibold">Verity</Link>
          <nav className="hidden md:flex gap-6 text-sm">
            <Link href="/features" className="opacity-80 hover:opacity-100">Features</Link>
            <Link href="/how-it-works" className="opacity-80 hover:opacity-100">How it works</Link>
            <Link href="/security" className="opacity-80 hover:opacity-100">Security</Link>
            <Link href="/pricing" className="opacity-80 hover:opacity-100">Pricing</Link>
            <Link href="/faq" className="opacity-80 hover:opacity-100">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-sm border rounded-lg px-3 py-1.5">Open App</Link>
            <Link href="/join-waitlist" className="text-sm rounded-lg px-3 py-1.5 bg-black text-white">Join waitlist</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl p-6 text-sm text-gray-600 flex items-center justify-between">
          <div>Verity · Transparency for Australia © 2025</div>
          <nav className="flex gap-6">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/press-kit">Press kit</Link>
          </nav>
        </div>
      </footer>
    </body></html>
  );
}
