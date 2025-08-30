export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion:"2024-06-20" });

export async function POST(req: Request){
  const sig = (await req.headers).get("stripe-signature")!;
  const raw = await req.text();
  let evt;
  try { evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch(e:any){ return new NextResponse(`Webhook Error: ${e.message}`, { status: 400 }); }
  if (evt.type === "customer.subscription.updated" || evt.type === "customer.subscription.created"){
    const sub = evt.data.object as any;
    await db.from("subscription").upsert({
      customer_id: sub.customer, status: sub.status, current_period_end: new Date(sub.current_period_end*1000).toISOString()
    }, { onConflict: "customer_id" });
  }
  return NextResponse.json({ received: true });
}
