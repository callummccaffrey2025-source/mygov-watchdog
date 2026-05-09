# Phone Verification — Test Plan

## Prerequisites

- Twilio secrets configured (see TWILIO_SETUP.md)
- Migration applied: `scripts/migration_phone_verification.sql`
- Edge Functions deployed: `verify-phone-send-otp`, `verify-phone-confirm-otp`
- Authenticated user in the app

## Twilio Test Credentials

For development without sending real SMS:
- Use Twilio test credentials (Account SID starts with `AC`, use test auth token)
- Test phone numbers: `+61491570006` (Twilio magic number for Australia)
- Test OTP: `123456` (always works with test credentials)

## Test Cases

### Happy Path
1. Open Profile → tap "Verify your phone"
2. Enter `412345678` → tap "Send verification code"
3. Receive SMS with 6-digit code
4. Enter code → auto-submits on 6th digit
5. See success screen → "Phone verified, Tier 1"
6. **Verify in DB:** `user_preferences.verification_tier = 'tier_1'`, `phone_verified_at` is set

### Wrong Code
1. Send OTP → enter `000000` (wrong code)
2. See: "Incorrect code. 4 attempts remaining."
3. Enter wrong code 4 more times
4. See: "Too many incorrect attempts. Please request a new code."
5. Resend button becomes available

### Expired Code
1. Send OTP → wait 5+ minutes → enter correct code
2. See: "Your code has expired. Please request a new one."

### Phone Already Claimed
1. User A verifies with +61412345678
2. User B tries to verify with the same number
3. See: "This phone number is already linked to another Verity account."
4. **Verify:** No SMS sent, no Twilio cost

### Rate Limiting
1. Send 3 OTPs in quick succession
2. 4th attempt: "Too many verification attempts. Please try again in an hour."

### Twilio Down
1. Set invalid TWILIO_AUTH_TOKEN in Supabase secrets
2. Try to send OTP
3. See: "We couldn't send a code right now. Please try again in a few minutes."
4. **Verify:** `verification_audit_log` has `twilio_error` entry with status code

### Resumable Flow
1. Send OTP → close app immediately
2. Reopen app → go to Profile → tap "Verify your phone"
3. Should go directly to OTP entry step (if within 5 min)
4. Enter code → should verify

### Not Authenticated
1. Sign out → try to access PhoneVerification (shouldn't be reachable, but if navigated directly)
2. Edge Function returns 401

## Manual Verification Queries

```sql
-- Check user's verification status
SELECT user_id, phone_hash, phone_verified_at, verification_tier
FROM user_preferences
WHERE user_id = 'YOUR_USER_ID';

-- Check verification attempts
SELECT * FROM phone_verifications
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Check audit trail
SELECT action, metadata, created_at
FROM verification_audit_log
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

## Cost Monitoring

After testing, check Twilio console:
- https://www.twilio.com/console/verify/services → Usage
- Each test sends 1 SMS (~$0.05 AU)
- Rate limit tests: only the first 3 sends per hour incur cost
