import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-600">
          Verity · Transparency for Australia © {new Date().getFullYear()}
        </p>
        <div className="flex gap-6 text-sm text-zinc-600">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/press">Press kit</Link>
        </div>
      </div>
    </footer>
  );
}
