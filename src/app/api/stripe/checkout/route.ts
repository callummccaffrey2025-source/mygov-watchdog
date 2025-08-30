import { NextResponse } from "next/server";
import { stripe, PRICE_ID } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  // TODO: replace with real auth (e.g., Supabase Auth session); for now, require user_id in body
  const { user_id, email } = await req.json();

  if (!user_id || !email) {
    return NextResponse.json({ error: "user_id and email required" }, { status: 400 });
  }

  // Lookup or create Stripe customer
  let customerId: string | null = null;
  {
    const { data: up } = await supabaseAdmin
      .from("user_profile")
      .select("stripe_customer_id")
      .eq("id", user_id)
      .single();

    customerId = up?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { user_id } });
      customerId = customer.id;
      await supabaseAdmin
        .from("user_profile")
        .update({ stripe_customer_id: customerId })
        .eq("id", user_id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId!,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${new URL(req.url).origin}/account?state=success`,
    cancel_url: `${new URL(req.url).origin}/account?state=cancel`,
    subscription_data: {
      trial_period_days: 0,
      metadata: { user_id },
    },
    metadata: { user_id },
  });

  return NextResponse.json({ url: session.url });
}
