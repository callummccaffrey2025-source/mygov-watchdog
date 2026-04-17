"use client";
export default function MPError({ error, reset }:{error:Error & {digest?:string}, reset:()=>void}) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-3 py-10">
      <h1 className="text-xl font-semibold">We couldn’t load this MP</h1>
      <p className="text-white/70">Something went wrong{error?.message?`: ${error.message}`:""}.</p>
      <div className="flex gap-3">
        <button onClick={()=>reset()} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Try again</button>
        <a href="/" className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15">Back home</a>
      </div>
    </main>
  );
}
