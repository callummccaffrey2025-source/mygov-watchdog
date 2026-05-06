/**
 * send-push-alerts – Supabase Edge Function
 *
 * Receives a vote event (vote_id, politician_id, bill_id, vote_cast), enriches
 * with politician name and bill title, finds followers of that politician,
 * and sends APNs push notifications to their registered devices.
 *
 * KNOWN ISSUES:
 * - References dropped "politicians" table (should use "members")
 * - References non-existent "user_push_tokens" table (should use "push_tokens")
 * - Uses raw APNs instead of Expo Push API (send-notification uses Expo Push)
 * - Requires APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY secrets (not in Vault)
 * - Largely superseded by send-notification which handles the same use case
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.0/index.ts";

const APNS_PRODUCTION = "https://api.push.apple.com";
const APNS_SANDBOX = "https://api.sandbox.push.apple.com";

interface RequestBody {
  vote_id?: number;
  politician_id: number;
  bill_id: number;
  vote_cast: string;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
  APNS_AUTH_KEY: string;
  APNS_TOPIC?: string;
  APNS_SANDBOX_MODE?: string;
}

interface PoliticianRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

interface BillRow {
  id: number;
  title: string | null;
}

function getEnv(): Env {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID");
  const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID");
  const APNS_AUTH_KEY = Deno.env.get("APNS_AUTH_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_AUTH_KEY) {
    throw new Error(
      "Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY"
    );
  }
  return {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    APNS_KEY_ID,
    APNS_TEAM_ID,
    APNS_AUTH_KEY,
    APNS_TOPIC: Deno.env.get("APNS_TOPIC") ?? undefined,
    APNS_SANDBOX_MODE: Deno.env.get("APNS_SANDBOX_MODE") ?? "0",
  };
}

function parseBody(raw: unknown): RequestBody {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Body must be a JSON object");
  }
  const o = raw as Record<string, unknown>;
  const politician_id = o.politician_id;
  const bill_id = o.bill_id;
  const vote_cast = o.vote_cast;
  if (typeof politician_id !== "number" || typeof bill_id !== "number") {
    throw new Error("politician_id and bill_id must be numbers");
  }
  if (typeof vote_cast !== "string" || !vote_cast.trim()) {
    throw new Error("vote_cast must be a non-empty string");
  }
  const vote_id = typeof o.vote_id === "number" ? o.vote_id : undefined;
  return { vote_id, politician_id, bill_id, vote_cast: vote_cast.trim().toLowerCase() };
}

function voteCastToLabel(vote_cast: string): string {
  switch (vote_cast) {
    case "aye":
    case "tellaye":
      return "Aye";
    case "no":
    case "noes":
    case "tellno":
      return "No";
    case "absent":
      return "Absent";
    default:
      return vote_cast;
  }
}

async function getPoliticianName(
  supabase: ReturnType<typeof createClient>,
  politicianId: number
): Promise<string> {
  const { data, error } = await supabase
    .from("politicians")
    .select("id, first_name, last_name")
    .eq("id", politicianId)
    .maybeSingle();

  if (error) {
    console.error("getPoliticianName error:", error);
    throw new Error(`Politicians fetch failed: ${error.message}`);
  }
  const row = data as PoliticianRow | null;
  if (!row) {
    throw new Error(`Politician not found: ${politicianId}`);
  }
  const first = (row.first_name ?? "").trim();
  const last = (row.last_name ?? "").trim();
  return first && last ? `${first} ${last}` : last || first || "A politician";
}

async function getBillTitle(
  supabase: ReturnType<typeof createClient>,
  billId: number
): Promise<string> {
  const { data, error } = await supabase
    .from("bills")
    .select("id, title")
    .eq("id", billId)
    .maybeSingle();

  if (error) {
    console.error("getBillTitle error:", error);
    throw new Error(`Bills fetch failed: ${error.message}`);
  }
  const row = data as BillRow | null;
  if (!row) {
    throw new Error(`Bill not found: ${billId}`);
  }
  const title = (row.title ?? "").trim();
  return title || "a bill";
}

async function getFollowerUserIds(
  supabase: ReturnType<typeof createClient>,
  politicianId: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_follows")
    .select("user_id")
    .eq("entity_type", "politician")
    .eq("entity_id", String(politicianId));

  if (error) {
    console.error("getFollowerUserIds error:", error);
    throw new Error(`user_follows fetch failed: ${error.message}`);
  }
  const ids = (data ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
  return [...new Set(ids)];
}

async function getApnsTokens(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("user_push_tokens")
    .select("apns_token")
    .in("user_id", userIds);

  if (error) {
    console.error("getApnsTokens error:", error);
    throw new Error(`user_push_tokens fetch failed: ${error.message}`);
  }
  const tokens = (data ?? [])
    .map((r: { apns_token: string }) => (r.apns_token ?? "").trim())
    .filter(Boolean);
  return [...new Set(tokens)];
}

async function createApnsJwt(env: Env): Promise<string> {
  const pem = env.APNS_AUTH_KEY.replace(/\\n/g, "\n").trim();
  if (!pem.includes("BEGIN PRIVATE KEY") && !pem.includes("BEGIN EC PRIVATE KEY")) {
    console.error("APNS_AUTH_KEY does not look like a PEM private key");
    throw new Error("Invalid APNS_AUTH_KEY format");
  }
  const privateKey = await importPKCS8(pem, "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID })
    .setIssuer(env.APNS_TEAM_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime("1h")
    .sign(privateKey);
  return jwt;
}

interface ApnsPayload {
  aps: {
    alert: { title: string; body: string };
    sound?: string;
    "mutable-content"?: number;
  };
  vote_id?: number;
  politician_id?: number;
  bill_id?: number;
}

async function sendApns(
  env: Env,
  token: string,
  payload: ApnsPayload,
  jwt: string,
  client: Deno.HttpClient
): Promise<{ ok: boolean; status: number; reason?: string }> {
  const baseUrl = env.APNS_SANDBOX_MODE === "1" ? APNS_SANDBOX : APNS_PRODUCTION;
  const url = `${baseUrl}/3/device/${token}`;
  const topic = env.APNS_TOPIC;
  if (!topic) {
    console.error("APNS_TOPIC not set; APNs requires apns-topic (bundle id)");
    return { ok: false, status: 0, reason: "APNS_TOPIC not set" };
  }

  const res = await fetch(url, {
    method: "POST",
    client,
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`APNs error for token ${token.slice(0, 12)}...: ${res.status} ${text}`);
    return { ok: false, status: res.status, reason: text || res.statusText };
  }
  return { ok: true, status: res.status };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    const raw = await req.json();
    body = parseBody(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    console.error("send-push-alerts parse error:", e);
    return new Response(
      JSON.stringify({ error: "Bad request", detail: message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let env: Env;
  try {
    env = getEnv();
  } catch (e) {
    console.error("send-push-alerts env error:", e);
    return new Response(
      JSON.stringify({ error: "Server configuration error", detail: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const [politicianName, billTitle] = await Promise.all([
      getPoliticianName(supabase, body.politician_id),
      getBillTitle(supabase, body.bill_id),
    ]);

    const voteLabel = voteCastToLabel(body.vote_cast);
    const title = `\u{1F6A8} ${politicianName} just voted.`;
    const bodyText = `They voted ${voteLabel} on the ${billTitle}. Tap to see the impact.`;

    const userIds = await getFollowerUserIds(supabase, body.politician_id);
    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          sent: 0,
          message: "No followers for this politician",
          politician_id: body.politician_id,
          bill_id: body.bill_id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const tokens = await getApnsTokens(supabase, userIds);
    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          sent: 0,
          message: "No push tokens for followers",
          politician_id: body.politician_id,
          followers: userIds.length,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!env.APNS_TOPIC) {
      console.error("APNS_TOPIC not set; cannot send APNs (required as apns-topic / bundle id)");
      return new Response(
        JSON.stringify({ error: "APNS_TOPIC not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const jwt = await createApnsJwt(env);
    const payload: ApnsPayload = {
      aps: {
        alert: { title, body: bodyText },
        sound: "default",
        "mutable-content": 1,
      },
      vote_id: body.vote_id,
      politician_id: body.politician_id,
      bill_id: body.bill_id,
    };

    let sent = 0;
    const errors: Array<{ token_prefix: string; status: number; reason?: string }> = [];
    const httpClient = Deno.createHttpClient({ http2: true });

    try {
      for (const token of tokens) {
        const result = await sendApns(env, token, payload, jwt, httpClient);
        if (result.ok) {
          sent += 1;
        } else {
          errors.push({
            token_prefix: token.slice(0, 12) + "...",
            status: result.status,
            reason: result.reason,
          });
        }
      }
    } finally {
      httpClient.close();
    }

    if (errors.length > 0) {
      console.error("send-push-alerts APNs partial failures:", errors);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent,
        total_tokens: tokens.length,
        politician_id: body.politician_id,
        bill_id: body.bill_id,
        politician_name: politicianName,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push-alerts error:", err);
    return new Response(
      JSON.stringify({
        error: "send-push-alerts failed",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
