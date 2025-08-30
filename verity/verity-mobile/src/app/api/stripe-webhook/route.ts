export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

export async function POST(req: Request){
  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion:"2024-06-20" });

  let evt: Stripe.Event;
  try { evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch(e:any){ return new NextResponse(`Webhook Error: ${e.message}`, { status: 400 }); }

  if (evt.type.startsWith("customer.subscription.")) {
    const sub = evt.data.object as Stripe.Subscription;
    await db.from("subscription").upsert({
      customer_id: String(sub.customer),
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString()
    }, { onConflict: "customer_id" });
  }
  return NextResponse.json({ received: true });
}
