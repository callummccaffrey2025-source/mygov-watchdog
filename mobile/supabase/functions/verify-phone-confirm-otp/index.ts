// Supabase Edge Function — verify-phone-confirm-otp
//
// Confirms an OTP via Twilio VerificationCheck. On success, transitions
// the user from tier_0 to tier_1.
//
// Input:  POST { phone_number: "+61412345678", code: "123456" }
// Output: { success, new_tier } or { success: false, error, error_message, attempts_remaining }
//
// Deploy:
//   supabase functions deploy verify-phone-confirm-otp --project-ref zmmglikiryuftqmoprqm

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_VERIFY_SERVICE_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';

const MAX_ATTEMPTS = 5;

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
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return jsonResponse({
      success: false,
      error: 'not_configured',
      error_message: 'Phone verification is not yet configured.',
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
  const code = body?.code?.trim();

  if (!phone || !/^\+61\d{9}$/.test(phone)) {
    return jsonResponse({ success: false, error: 'invalid_phone', error_message: 'Invalid phone number.' }, 400);
  }
  if (!code || !/^\d{6}$/.test(code)) {
    return jsonResponse({ success: false, error: 'invalid_code', error_message: 'Please enter a 6-digit code.' }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const phoneHash = await sha256(phone);
  const clientIp = getClientIp(req);
  const ipHash = clientIp ? await sha256(clientIp) : null;

  // ── Find the latest pending verification for this user + phone ────────
  const { data: verification } = await db
    .from('phone_verifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('phone_hash', phoneHash)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!verification) {
    return jsonResponse({
      success: false,
      error: 'otp_expired',
      error_message: 'No active verification found. Please request a new code.',
    }, 400);
  }

  // ── Check expiry ──────────────────────────────────────────────────────
  if (new Date(verification.expires_at) < new Date()) {
    await db.from('phone_verifications').update({ status: 'expired' }).eq('id', verification.id);
    await db.from('verification_audit_log').insert({
      user_id: user.id, action: 'otp_expired', phone_hash: phoneHash, ip_hash: ipHash,
      metadata: { verification_id: verification.id },
    });
    return jsonResponse({
      success: false,
      error: 'otp_expired',
      error_message: 'Your code has expired. Please request a new one.',
    }, 400);
  }

  // ── Check attempt count ───────────────────────────────────────────────
  if (verification.attempt_count >= MAX_ATTEMPTS) {
    await db.from('phone_verifications').update({ status: 'max_attempts' }).eq('id', verification.id);
    await db.from('verification_audit_log').insert({
      user_id: user.id, action: 'otp_failed', phone_hash: phoneHash, ip_hash: ipHash,
      metadata: { reason: 'max_attempts_exceeded', verification_id: verification.id },
    });
    return jsonResponse({
      success: false,
      error: 'max_attempts_exceeded',
      error_message: 'Too many incorrect attempts. Please request a new code.',
      attempts_remaining: 0,
    }, 400);
  }

  // ── Increment attempt count ───────────────────────────────────────────
  const newAttemptCount = verification.attempt_count + 1;
  await db.from('phone_verifications').update({ attempt_count: newAttemptCount }).eq('id', verification.id);

  // ── Call Twilio VerificationCheck ──────────────────────────────────────
  let twilioStatus = 0;
  let verificationStatus = '';

  try {
    const twilioUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
    const twilioAuth = base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, Code: code }).toString(),
    });

    twilioStatus = twilioResp.status;
    const twilioData = await twilioResp.json();
    verificationStatus = twilioData?.status ?? '';

    // Log Twilio response
    await db.from('verification_audit_log').insert({
      user_id: user.id,
      action: verificationStatus === 'approved' ? 'otp_verified' : 'otp_failed',
      phone_hash: phoneHash,
      ip_hash: ipHash,
      metadata: {
        twilio_status: twilioStatus,
        twilio_verification_status: verificationStatus,
        twilio_sid: twilioData?.sid,
        attempt_number: newAttemptCount,
        attempts_remaining: MAX_ATTEMPTS - newAttemptCount,
      },
    });

    if (!twilioResp.ok && twilioStatus !== 404) {
      // Twilio error (not "not found" which means wrong code)
      return jsonResponse({
        success: false,
        error: 'verification_failed',
        error_message: 'Verification service error. Please try again.',
        attempts_remaining: MAX_ATTEMPTS - newAttemptCount,
      }, 502);
    }

  } catch (e: any) {
    await db.from('verification_audit_log').insert({
      user_id: user.id, action: 'twilio_error', phone_hash: phoneHash, ip_hash: ipHash,
      metadata: { twilio_status: 0, error: e?.message ?? 'network_error' },
    });
    return jsonResponse({
      success: false,
      error: 'verification_failed',
      error_message: 'Verification service unavailable. Please try again.',
      attempts_remaining: MAX_ATTEMPTS - newAttemptCount,
    }, 502);
  }

  // ── Handle result ─────────────────────────────────────────────────────

  if (verificationStatus === 'approved') {
    // ── SUCCESS: Tier 0 → Tier 1 ────────────────────────────────────────

    // Mark verification as verified
    await db.from('phone_verifications').update({ status: 'verified' }).eq('id', verification.id);

    // Update user profile: set phone_hash, phone_verified_at, tier
    await db.from('user_preferences').upsert({
      user_id: user.id,
      phone_hash: phoneHash,
      phone_verified_at: new Date().toISOString(),
      verification_tier: 'tier_1',
    }, { onConflict: 'user_id' });

    return jsonResponse({
      success: true,
      new_tier: 'tier_1',
    });
  }

  // Wrong code (Twilio returns 404 or status='pending')
  return jsonResponse({
    success: false,
    error: 'incorrect_code',
    error_message: `Incorrect code. ${MAX_ATTEMPTS - newAttemptCount} attempt${MAX_ATTEMPTS - newAttemptCount !== 1 ? 's' : ''} remaining.`,
    attempts_remaining: MAX_ATTEMPTS - newAttemptCount,
  }, 400);
});
