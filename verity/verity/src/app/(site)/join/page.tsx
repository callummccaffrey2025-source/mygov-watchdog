export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-semibold">Join the waitlist</h1>
      <p className="text-zinc-400 max-w-xl text-sm">
        Want early access and influence on features? Add your email and we’ll invite you as we roll out
        MP scorecards, bill briefings, and custom alerts.
      </p>
      {/* TODO: future: email capture form */}
    </main>
  );
}
