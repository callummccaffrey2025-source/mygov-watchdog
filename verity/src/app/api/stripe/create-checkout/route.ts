export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabaseServer";
export const runtime = "nodejs";
export async function POST() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "auth required" }, { status: 401 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" as any });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID as string, quantity: 1 }],
    success_url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") + "/account?status=success",
    cancel_url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") + "/subscribe?status=cancel"
  });
  return NextResponse.json({ url: session.url });
}
