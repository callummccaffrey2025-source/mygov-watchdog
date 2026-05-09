# Twilio Verify Setup for Verity

## 1. Create a Twilio Account

Sign up at https://www.twilio.com. Free trial includes $15 credit (~300 verifications).

## 2. Create a Verify Service

1. Go to https://www.twilio.com/console/verify/services
2. Click "Create new"
3. Name: `Verity Phone Verification`
4. Friendly name (shown in SMS): `Verity`
5. Code length: 6 digits
6. Code TTL: 300 seconds (5 minutes)
7. Save — note the **Service SID** (starts with `VA`)

## 3. Configure AU Sender ID

1. In the Verify Service settings, under "Messaging":
2. Set the messaging service or use default Twilio number
3. For Australian numbers, Twilio uses local routes automatically
4. No alpha sender ID needed for AU (regulations restrict it)

## 4. Set Rate Limits in Twilio Console

1. In the Verify Service → Rate Limits:
2. Max sends per phone: 3 per 10 minutes (matches our server-side limit)
3. Max send attempts: 5 per verification

## 5. Store Secrets in Supabase

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --project-ref zmmglikiryuftqmoprqm
```

**Never** commit these to git or put them in `.env`.

## 6. Deploy Edge Functions

```bash
supabase functions deploy verify-phone-send-otp --project-ref zmmglikiryuftqmoprqm
supabase functions deploy verify-phone-confirm-otp --project-ref zmmglikiryuftqmoprqm
```

## 7. Run the Migration

```bash
supabase db execute --project-ref zmmglikiryuftqmoprqm < scripts/migration_phone_verification.sql
```

## 8. Schedule Cleanup Job

In Supabase SQL editor:
```sql
SELECT cron.schedule('expire-phone-verifications', '0 * * * *',
  $$UPDATE phone_verifications SET status = 'expired' WHERE status = 'pending' AND expires_at < now()$$
);
```

## Cost Estimates

| Volume | Monthly Cost |
|--------|-------------|
| 100 verifications | ~$5 |
| 1,000 verifications | ~$50 |
| 10,000 verifications | ~$500 |

Twilio Verify is ~$0.05 per successful verification in AU.
Failed attempts (wrong code) don't incur additional SMS costs since the OTP was already sent.

## Failure Modes

| Scenario | Behaviour |
|----------|-----------|
| Twilio down | Edge Function returns `sms_delivery_failed`, user sees "try again later" |
| Invalid AU number | Rejected client-side before API call |
| Daily SMS budget exceeded | Set spending limit in Twilio console → Twilio rejects sends → we return `sms_delivery_failed` |
| Number already claimed | Rejected before Twilio is called → no cost |
