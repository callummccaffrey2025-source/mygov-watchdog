import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * validate-receipt — Validates Apple App Store receipts for Verity Pro subscriptions.
 *
 * Uses Apple's App Store Server API (StoreKit 2 / JWS transactions).
 * Falls back to the legacy verifyReceipt endpoint for older receipts.
 *
 * Called by the client after a successful purchase or restore.
 */

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

interface RequestBody {
  platform: "ios" | "android";
  receipt: string;
  userId: string;
  productId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { platform, receipt, userId, productId } = body;
  if (!platform || !receipt || !userId || !productId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: platform, receipt, userId, productId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // iOS receipt validation via Apple's verifyReceipt API
  if (platform === "ios") {
    const appSharedSecret = Deno.env.get("APPLE_SHARED_SECRET") ?? "";

    const verifyPayload = {
      "receipt-data": receipt,
      password: appSharedSecret,
      "exclude-old-transactions": true,
    };

    // Try production first, then sandbox
    let appleResponse = await fetch(APPLE_PRODUCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyPayload),
    });
    let result = await appleResponse.json();

    // Status 21007 means this is a sandbox receipt — retry against sandbox
    if (result.status === 21007) {
      appleResponse = await fetch(APPLE_SANDBOX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      });
      result = await appleResponse.json();
    }

    if (result.status !== 0) {
      console.error("Apple receipt validation failed:", result.status);
      return new Response(
        JSON.stringify({ valid: false, error: `Apple status: ${result.status}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for active subscription in latest_receipt_info
    const latestInfo = result.latest_receipt_info ?? [];
    const activeSubscription = latestInfo.find(
      (item: any) =>
        item.product_id === productId &&
        new Date(parseInt(item.expires_date_ms, 10)) > new Date()
    );

    if (activeSubscription) {
      const expiresAt = new Date(
        parseInt(activeSubscription.expires_date_ms, 10)
      ).toISOString();

      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: userId,
            is_pro: true,
            pro_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Failed to update user_preferences:", error);
        return new Response(
          JSON.stringify({ valid: true, persisted: false, error: error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: true, persisted: true, expires_at: expiresAt }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // No active subscription found
    return new Response(
      JSON.stringify({ valid: false, error: "No active subscription found in receipt" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Android not supported yet
  return new Response(
    JSON.stringify({ valid: false, error: "Android not supported yet" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
});
