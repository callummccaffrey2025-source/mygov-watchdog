import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRO_EVENT_TYPES = ["INITIAL_PURCHASE", "RENEWAL"];
const REVOKE_PRO_EVENT_TYPES = ["CANCELLATION", "EXPIRATION"];

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  [key: string]: unknown;
}

interface RevenueCatPayload {
  event?: RevenueCatEvent;
  api_version?: string;
  [key: string]: unknown;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Auth: only RevenueCat may call this — otherwise anyone can grant
  // themselves Pro by posting a fake INITIAL_PURCHASE event.
  // Set the same value in: RevenueCat dashboard → Webhooks → Authorization header,
  // and `supabase secrets set REVENUECAT_WEBHOOK_SECRET=...`
  const expectedSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const gotAuth = req.headers.get("Authorization") ?? "";
  if (gotAuth !== expectedSecret && gotAuth !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: RevenueCatPayload;
  try {
    payload = (await req.json()) as RevenueCatPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = payload?.event;
  if (!event) {
    return new Response(JSON.stringify({ error: "Missing event object" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const type = event.type;
  const appUserId = event.app_user_id;

  if (!appUserId) {
    return new Response(JSON.stringify({ error: "Missing app_user_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (type && PRO_EVENT_TYPES.includes(type)) {
    const { error } = await supabase
      .from("user_preferences")
      .update({ is_pro: true, updated_at: new Date().toISOString() })
      .eq("user_id", appUserId);

    if (error) {
      console.error("RevenueCat webhook: update is_pro=true failed", error);
      return new Response(
        JSON.stringify({ error: "Database update failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else if (type && REVOKE_PRO_EVENT_TYPES.includes(type)) {
    const { error } = await supabase
      .from("user_preferences")
      .update({ is_pro: false, updated_at: new Date().toISOString() })
      .eq("user_id", appUserId);

    if (error) {
      console.error("RevenueCat webhook: update is_pro=false failed", error);
      return new Response(
        JSON.stringify({ error: "Database update failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  // Other event types (e.g. BILLING_ISSUE, PRODUCT_CHANGE) are ignored; still return 200

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
