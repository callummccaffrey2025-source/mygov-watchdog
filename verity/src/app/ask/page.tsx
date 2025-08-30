
export default function AskPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Ask Verity</h1>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const question = (form.elements.namedItem("q") as HTMLInputElement).value;
        const res = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ question }) });
        const data = await res.json();
        (document.getElementById("answer") as HTMLPreElement).textContent = data.answer ?? data.error;
      }}>
        <input name="q" placeholder="What happened with the bill today?" className="w-full border rounded-lg p-3" />
        <button className="rounded-lg px-4 py-2 border">Ask</button>
      </form>
      <pre id="answer" className="whitespace-pre-wrap text-sm border rounded-lg p-3" />
    </main>
  );
}
