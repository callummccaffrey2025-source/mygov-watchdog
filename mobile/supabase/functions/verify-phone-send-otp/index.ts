// Supabase Edge Function — verify-phone-send-otp
//
// Sends an OTP via Twilio Verify. Twilio is the OTP source of truth —
// we don't generate, hash, or store OTPs locally.
//
// Input:  POST { phone_number: "+61412345678" }
// Output: { success, expires_at, attempts_remaining } or { success: false, error, error_message }
//
// Rate limits (server-enforced):
//   - 3 OTP sends per phone_hash per hour
//   - 10 OTP sends per IP per hour
//
// Deploy:
//   supabase functions deploy verify-phone-send-otp --project-ref zmmglikiryuftqmoprqm
//
// Required secrets:
//   supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_VERIFY_SERVICE_SID=VA...

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';

const MAX_SENDS_PER_PHONE_PER_HOUR = 3;
const MAX_SENDS_PER_IP_PER_HOUR = 10;
const OTP_EXPIRY_MINUTES = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getClientIp(req: Request): string | null {
  // Try standard headers in order of reliability
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // ── Check Twilio config ───────────────────────────────────────────────
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return jsonResponse({
      success: false,
      error: 'not_configured',
      error_message: 'Phone verification is not yet configured. Please try again later.',
    }, 503);
  }

  // ── Authenticate ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'auth_required' }, 401);

  const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'invalid_token' }, 401);

  // ── Parse input ───────────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const phone = body?.phone_number?.trim();
  if (!phone || !/^\+61\d{9}$/.test(phone)) {
    return jsonResponse({
      success: false,
      error: 'invalid_phone',
      error_message: 'Please enter a valid Australian mobile number (+61 followed by 9 digits).',
    }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const phoneHash = await sha256(phone);

  // ── IP handling ───────────────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const ipHash = clientIp ? await sha256(clientIp) : null;

  // ── Check: phone already claimed by another user ──────────────────────
  const { data: existingClaim } = await db
    .from('user_preferences')
    .select('user_id')
    .eq('phone_hash', phoneHash)
    .neq('user_id', user.id)
    .maybeSingle();

  if (existingClaim) {
    await db.from('verification_audit_log').insert({
      user_id: user.id,
      action: 'phone_already_claimed',
      phone_hash: phoneHash,
      ip_hash: ipHash,
      metadata: {},
    });
    return jsonResponse({
      success: false,
      error: 'phone_already_claimed',
      error_message: 'This phone number is already linked to another Verity account. Each number can only verify one account.',
    }, 409);
  }

  // ── Rate limit: phone_hash (3 sends per hour) ────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: phoneSendCount } = await db
    .from('phone_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('phone_hash', phoneHash)
    .gte('created_at', oneHourAgo);

  if ((phoneSendCount ?? 0) >= MAX_SENDS_PER_PHONE_PER_HOUR) {
    await db.from('verification_audit_log').insert({
      user_id: user.id,
      action: 'rate_limited',
      phone_hash: phoneHash,
      ip_hash: ipHash,
      metadata: { reason: 'phone_hourly_limit', count: phoneSendCount },
    });
    return jsonResponse({
      success: false,
      error: 'rate_limited',
      error_message: 'Too many verification attempts. Please try again in an hour.',
    }, 429);
  }

  // ── Rate limit: IP (10 sends per hour) ────────────────────────────────
  if (ipHash) {
    const { count: ipSendCount } = await db
      .from('phone_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo);

    if ((ipSendCount ?? 0) >= MAX_SENDS_PER_IP_PER_HOUR) {
      await db.from('verification_audit_log').insert({
        user_id: user.id,
        action: 'rate_limited',
        phone_hash: phoneHash,
        ip_hash: ipHash,
        metadata: { reason: 'ip_hourly_limit', count: ipSendCount },
      });
      return jsonResponse({
        success: false,
        error: 'rate_limited',
        error_message: 'Too many verification attempts from this network. Please try again later.',
      }, 429);
    }
  } else {
    // No IP header available — log warning but don't block
    await db.from('verification_audit_log').insert({
      user_id: user.id,
      action: 'otp_sent',
      phone_hash: phoneHash,
      ip_hash: null,
      metadata: { warning: 'ip_header_missing', note: 'IP rate limiting not enforced' },
    });
  }

  // ── Call Twilio Verify API ────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  let twilioStatus = 0;
  let twilioSid: string | null = null;
  let twilioError: string | null = null;

  try {
    const twilioUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
    const twilioAuth = base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Channel: 'sms' }).toString(),
    });

    twilioStatus = twilioResp.status;
    const twilioData = await twilioResp.json();
    twilioSid = twilioData?.sid ?? null;

    if (!twilioResp.ok) {
      twilioError = twilioData?.message ?? `HTTP ${twilioStatus}`;
      await db.from('verification_audit_log').insert({
        user_id: user.id,
        action: 'twilio_error',
        phone_hash: phoneHash,
        ip_hash: ipHash,
        metadata: { twilio_status: twilioStatus, twilio_error: twilioError, twilio_code: twilioData?.code },
      });
      return jsonResponse({
        success: false,
        error: 'sms_delivery_failed',
        error_message: "We couldn't send a code right now. Please try again in a few minutes.",
      }, 502);
    }
  } catch (e: any) {
    await db.from('verification_audit_log').insert({
      user_id: user.id,
      action: 'twilio_error',
      phone_hash: phoneHash,
      ip_hash: ipHash,
      metadata: { twilio_status: 0, twilio_error: e?.message ?? 'network_error' },
    });
    return jsonResponse({
      success: false,
      error: 'sms_delivery_failed',
      error_message: "We couldn't send a code right now. Please try again in a few minutes.",
    }, 502);
  }

  // ── Store verification record ─────────────────────────────────────────
  await db.from('phone_verifications').insert({
    phone_hash: phoneHash,
    user_id: user.id,
    verification_sid: twilioSid,
    status: 'pending',
    attempt_count: 0,
    ip_hash: ipHash,
    expires_at: expiresAt.toISOString(),
  });

  // ── Audit log ─────────────────────────────────────────────────────────
  await db.from('verification_audit_log').insert({
    user_id: user.id,
    action: 'otp_sent',
    phone_hash: phoneHash,
    ip_hash: ipHash,
    metadata: {
      twilio_status: twilioStatus,
      twilio_sid: twilioSid,
      expires_at: expiresAt.toISOString(),
      sends_remaining: MAX_SENDS_PER_PHONE_PER_HOUR - (phoneSendCount ?? 0) - 1,
    },
  });

  return jsonResponse({
    success: true,
    expires_at: expiresAt.toISOString(),
    attempts_remaining: 5,
  });
});
