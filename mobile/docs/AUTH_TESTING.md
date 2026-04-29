# Auth Testing — Manual Test Plan

Last updated: 2026-04-29

---

## Prerequisites

Before testing, confirm:

- [ ] Supabase Dashboard → Authentication → URL Configuration → Site URL is set to `verity://auth-callback`
- [ ] Supabase Dashboard → Authentication → URL Configuration → Redirect URLs includes `verity://auth-callback`
- [ ] App is built via `eas build --platform ios --profile production` (NOT Expo Go)
- [ ] App is installed via TestFlight on a real iOS device
- [ ] You have access to a real email inbox (not a fake address)

---

## Test 1: New Email Signup via Magic Link

**Steps:**
1. Open the app (fresh install or signed out)
2. Complete onboarding (postcode, topics) if prompted
3. Go to the Profile tab
4. Tap "Continue with Email"
5. Enter a real email address you can access
6. Tap "Send Magic Link"
7. Confirm you see "Check your email" confirmation in the app
8. Open your email inbox on the same device
9. Find the email from Supabase (sender: noreply@mail.app.supabase.io)
10. Tap the magic link in the email
11. Confirm: the Verity app opens directly (not a browser error page)
12. Confirm: you are now signed in (Profile screen shows your email, sign out button appears)
13. Navigate to Home — confirm personalised content loads

**Expected result:** App opens, auth completes silently, user lands on Profile screen as authenticated.

**Failure modes to check:**
- If the email doesn't arrive: check spam folder. Check Supabase Dashboard → Authentication → Logs.
- If the link opens Safari instead of the app: the app wasn't built with the `verity` scheme, or the build is from before this fix was applied. Rebuild.
- If the link opens the app but nothing happens: check that Redirect URLs allowlist includes `verity://auth-callback`.

---

## Test 2: Already Signed-In User — Session Restore

**Steps:**
1. Complete Test 1 so you're signed in
2. Force-quit the app (swipe up from app switcher)
3. Reopen the app
4. Confirm: you are still signed in (no sign-in screen, Profile shows email)
5. Confirm: Home screen loads with personalised content

**Expected result:** Session restores from SecureStore. No network call needed for session restore.

---

## Test 3: Google Sign-In (No Regression)

**Steps:**
1. Sign out if currently signed in (Profile → Sign Out)
2. On the Profile screen, tap "Continue with Google"
3. Complete the Google OAuth flow in the browser
4. Confirm: app reopens and you are signed in
5. Confirm: Profile screen shows your Google account

**Expected result:** Google Sign-In works exactly as before. The `redirectTo: 'verity://auth-callback'` on the Google OAuth call was already set and is unchanged.

**Note:** If Google Sign-In shows "Google sign-in unavailable" — this is expected if Google OAuth is not configured in the Supabase project. This is not a regression from this change.

---

## Test 4: Apple Sign-In (No Regression)

**Steps:**
1. Sign out if currently signed in
2. On the Profile screen, tap "Continue with Apple"
3. Complete the Apple Sign-In prompt (Face ID / passcode)
4. Confirm: you are signed in immediately (no redirect needed)
5. Confirm: Profile screen shows your account

**Expected result:** Apple Sign-In works exactly as before. It uses `signInWithIdToken`, not email redirects. This change does not affect it.

---

## Test 5: Magic Link Expiry

**Steps:**
1. Sign out
2. Send a magic link to your email
3. Wait 61 minutes (or ask Supabase to reduce the expiry temporarily)
4. Tap the expired link
5. Confirm: the app opens but shows an error or fails silently (no crash)
6. Confirm: you are NOT signed in

**Expected result:** Expired links don't crash the app. The `setSession` call will fail because the tokens are expired, and the session state remains unauthenticated.

---

## Test 6: Magic Link on Different Device

**Steps:**
1. Send a magic link from the TestFlight device
2. Open the email on a desktop browser or a device without Verity installed
3. Tap the link

**Expected result:** The browser navigates to `verity://auth-callback`, which shows an error page on desktop (no app to handle the scheme). This is expected with custom scheme. Universal Links would solve this (future upgrade).

---

## Post-Test Checklist

- [ ] Test 1 passed: new email signup works end-to-end
- [ ] Test 2 passed: session restore works after force-quit
- [ ] Test 3 passed: Google Sign-In works (or shows expected "unavailable" message)
- [ ] Test 4 passed: Apple Sign-In works
- [ ] Test 5 passed: expired link doesn't crash (if tested)
- [ ] Test 6 noted: desktop behavior documented (expected limitation)

If all tests pass, email magic link auth is working for TestFlight and production.
