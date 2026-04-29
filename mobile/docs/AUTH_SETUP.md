# Auth Setup — Email Magic Links

Last updated: 2026-04-29

---

## How Email Magic Links Work in Verity

1. User taps "Continue with Email" on the Profile screen
2. User enters their email address
3. App calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'verity://auth-callback' } })`
4. Supabase sends an email with a magic link
5. The magic link URL points to the Supabase project's auth endpoint with a redirect to `verity://auth-callback`
6. User taps the link in their Mail app
7. iOS opens the Verity app via the `verity://` custom URL scheme (configured in `app.json` as `expo.scheme: "verity"`)
8. The deep link handler in `App.tsx` (lines 252-267) fires:
   - Parses `access_token` and `refresh_token` from the URL fragment
   - Calls `supabase.auth.setSession()` with both tokens
9. The `onAuthStateChange` listener in `UserContext.tsx` detects the new session
10. The app re-renders as authenticated — user sees the Home screen

---

## Supabase Configuration Required

### In Supabase Dashboard → Authentication → URL Configuration:

| Setting | Value |
|---------|-------|
| **Site URL** | `verity://auth-callback` |
| **Redirect URLs** (allowlist) | `verity://auth-callback` |

### Important: Site URL Implications

The **Site URL** is the default redirect for ALL Supabase auth flows, not just email magic links. Changing it affects:

- **Email magic links** — the redirect after clicking the link
- **Password reset emails** — the redirect after setting a new password
- **Email change confirmation** — the redirect after confirming a new email
- **Email confirmation on signup** — the redirect after verifying email
- **Invite links** — if you ever use Supabase invite-by-email

All of these will now redirect to `verity://auth-callback`, which the app handles via the same deep link handler. The handler doesn't distinguish between auth types — it just reads the tokens and calls `setSession()`, which works for all of them.

If you ever add a web dashboard or admin panel that needs Supabase auth, you'll need to:
1. Set the Site URL to the web app's URL
2. Pass `emailRedirectTo: 'verity://auth-callback'` explicitly in the mobile app's auth calls (which we already do)
3. Add the web URL to the Redirect URLs allowlist

For now, with a mobile-only product, setting Site URL to `verity://auth-callback` is correct.

---

## Custom Scheme vs Universal Links

Currently using **custom scheme only** (`verity://`).

| Aspect | Custom Scheme | Universal Links |
|--------|--------------|-----------------|
| Works in TestFlight | Yes | Yes (with server config) |
| Requires server | No | Yes (apple-app-site-association file at verity.au) |
| Spoofable | Theoretically (another app could register `verity://`) | No (domain ownership verified by Apple) |
| Fallback if app not installed | Error page in browser | Can fall back to website |

**Upgrade path to Universal Links:**

When `verity.au` is ready to host static files:

1. Add to `app.json`:
   ```json
   "ios": {
     "associatedDomains": ["applinks:verity.au"]
   }
   ```

2. Host `https://verity.au/.well-known/apple-app-site-association`:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [{
         "appID": "BDNZL33WU9.au.com.verity.app",
         "paths": ["/auth-callback", "/mp/*", "/bill/*", "/news/*"]
       }]
     }
   }
   ```

3. Update Supabase Redirect URLs to include `https://verity.au/auth-callback`

4. Update `emailRedirectTo` to `https://verity.au/auth-callback`

No code changes needed in App.tsx — add the universal link URL pattern to the deep link handler's filter.

---

## Files Involved

| File | Role |
|------|------|
| `app.json` → `expo.scheme` | Registers `verity://` as the app's custom URL scheme |
| `screens/ProfileScreen.tsx` | `signInWithOtp` call with `emailRedirectTo: 'verity://auth-callback'` |
| `App.tsx` lines 252-267 | Deep link handler: parses tokens from URL, calls `setSession()` |
| `context/UserContext.tsx` | `onAuthStateChange` listener updates session state on auth events |
| `lib/supabase.ts` | Supabase client with SecureStore-backed session persistence |

---

## Debugging Magic Links

### Link doesn't open the app

1. Check the email link URL — it should eventually redirect to `verity://auth-callback#access_token=...`
2. Confirm `expo.scheme: "verity"` is in `app.json`
3. Confirm the app was built with this scheme (rebuild via `eas build` if changed)
4. On iOS: Settings → Verity → check if the URL scheme is registered
5. Custom schemes don't work in simulators with Expo Go — test on a real device with a TestFlight/production build

### Link opens app but auth fails

1. Check the Supabase Dashboard → Authentication → Logs for the auth attempt
2. Check if the magic link has expired (default: 60 minutes)
3. Check if the Redirect URLs allowlist includes `verity://auth-callback`
4. Check the JS console / error_reports table for errors in the `setSession` call

### Auth succeeds but app doesn't update

1. The `onAuthStateChange` listener in UserContext should fire on `SIGNED_IN` event
2. Check that UserProvider wraps the component tree in App.tsx
3. If the app was killed between tapping the link and it opening, `getInitialURL` (line 264) handles the cold-start case
