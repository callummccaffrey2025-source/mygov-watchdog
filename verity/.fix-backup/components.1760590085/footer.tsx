export default function Footer() {
  return (
    <footer className="mt-12 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-100">
        © {new Date().getFullYear()} Verity — AI-powered civic intelligence for Australia.
      </div>
    </footer>
  );
}
