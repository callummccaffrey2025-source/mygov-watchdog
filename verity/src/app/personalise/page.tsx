import { Card } from "@/components/ui/card";

export const metadata = { title: "Personalise — Verity" };

export default function Page(){
  const prefs = [
    { key:"economy",   label:"Economy" },
    { key:"climate",   label:"Climate & Energy" },
    { key:"integrity", label:"Integrity & Governance" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="h1">Personalise</h1>
      <p className="lead">Select topics to emphasise in your briefing (saved locally; future accounts can sync).</p>
      <div className="grid gap-4 md:grid-cols-3">
        {prefs.map(p=>(
          <Card key={p.key} className="p-5">
            <div className="font-medium">{p.label}</div>
            <div className="mt-1 text-sm text-white/60">High-priority for your daily brief.</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
