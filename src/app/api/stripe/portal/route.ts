import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { data: up, error } = await supabaseAdmin
    .from("user_profile")
    .select("stripe_customer_id")
    .eq("id", user_id)
    .single();

  if (error || !up?.stripe_customer_id)
    return NextResponse.json({ error: "no stripe_customer_id" }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: up.stripe_customer_id,
    return_url: `${new URL(req.url).origin}/account`,
  });

  return NextResponse.json({ url: session.url });
}
