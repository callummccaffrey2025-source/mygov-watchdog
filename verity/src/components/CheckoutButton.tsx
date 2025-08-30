"use client";
export default function CheckoutButton() {
  return (
    <button className="rounded-lg px-4 py-2 bg-black text-white"
      onClick={async ()=>{
        const r = await fetch("/api/stripe/create-checkout",{method:"POST"});
        if(!r.ok){ alert("Please sign in first."); return; }
        const { url } = await r.json(); window.location.href = url;
      }}>
      Start $1/month
    </button>
  );
}
