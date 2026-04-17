"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="container-verity py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-white/70">{error.message}</p>
    </div>
  );
}
