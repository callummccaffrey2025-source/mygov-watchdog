export default function Page(){
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Civic Assistant</h1>
      <p className="text-neutral-100 text-sm">
        Ask about a bill or MP. Answers are AI summaries with receipts. (Wire your model + receipts fetcher here.)
      </p>
      <div className="rounded-xl border border-zinc-800 p-4">
        <p className="text-neutral-100 text-sm">Chat UI placeholder — connect to your existing chat component.</p>
      </div>
    </div>
  );
}
