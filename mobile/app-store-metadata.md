# Verity — App Store Metadata & Submission Audit

---

## App Name
Verity

## Subtitle (max 30 chars)
Australian Civic Intelligence
<!-- 29 chars ✓ -->

---

## App Store Description (max 4000 chars)
<!-- ~2,650 chars -->

Most Australians have no idea how their MP voted last week, who funds their campaigns, or what they said in parliament. Verity changes that.

🏛️ **Your MP, fully visible**
Find your local Member or Senator instantly. See every vote they've cast across 1,929 parliamentary divisions, read their speeches straight from Hansard, and understand exactly where their political funding comes from — individual donors and party-level AEC declarations, side by side.

📋 **Know what they actually do**
Beyond voting, Verity shows you your MP's current ministerial or shadow ministry role, every committee they sit on, and whether they're voting with or against their own party. Is your MP a Cabinet Minister, a Shadow Spokesperson, or a backbencher? Now you'll know.

📰 **News that shows you the full picture**
Verity's Ground News-style news feed pulls from 100+ Australian sources — newspapers, broadcasters, independent outlets — clusters them by topic, and shows you how many outlets are covering each story. Coverage bars reveal what's getting attention and what's being ignored.

📊 **Your personalised Daily Brief**
Each morning, Verity generates a summary built around your electorate: how your MP voted in the last week, which bills are moving through parliament right now, and the political stories that matter to you.

🔍 **Verify any political claim**
Heard that a politician voted against something? Check it yourself. Search any MP's full voting record and cross-reference any bill, topic, or claim — in seconds.

📜 **6,400+ bills, plain English**
Every federal bill since 2010, with plain English summaries explaining what each one actually does and where it is in the legislative process.

🗺️ **State and local government too**
NSW Legislative Assembly and Council — 135 members and 468 bills fully searchable. Council profiles for 20 of Australia's largest councils including full councillor lists, contact details, and population stats.

🗳️ **Federal Election countdown**
Track the days to the next federal election, explore your electorate's profile, and compare how different parties voted on the issues that matter most.

Verity is independent, non-partisan, and has no affiliation with any political party or parliament itself. We believe an informed electorate is a healthy democracy.

Free to use. **Verity Pro** ($4.99/month) unlocks extended voting history, detailed donation analytics, and advanced comparison tools.

---

*Data sourced from aph.gov.au, openaustralia.org.au, transparency.aec.gov.au, and parliament.nsw.gov.au.*
*© 2026 Verity. Not affiliated with the Australian Parliament or any political party.*

---

## Keywords (max 100 chars, comma-separated)
parliament,voting,MP,senator,politics,bills,news,democracy,australia,civic,elections
<!-- 84 chars ✓ -->

---

## What's New in This Version (v1.0.0)
Welcome to Verity — Australia's civic intelligence app.

Track your federal MP's votes across 1,929 parliamentary divisions, see their ministry role and committee memberships, and verify political claims against real voting data. Explore 6,400+ bills with plain English summaries, read Hansard speeches, and follow where your MP's funding comes from.

Your personalised Daily Brief arrives each morning — fresh news from 100+ sources, clustered by topic, plus a summary of what your MP has been up to.

NSW state parliament and 20 local council profiles are also included. More states coming soon.

This is v1.0. More features, deeper data, and better personalisation are on the way. We'd love your feedback at hello@verity.au.

---

## Primary Category
News

## Secondary Category
Reference

## Age Rating
4+ (no objectionable content)

## Support URL
https://verity.au/support
<!-- ⚠️ Needs to be live before submission. Check if verity.au is registered and pointing somewhere. -->

## Marketing URL
https://verity.au

## Privacy Policy URL
https://verity.au/privacy
<!-- ⚠️ MUST be a live public URL — in-app privacy screen alone is not sufficient for App Store Connect -->

---

# Submission Audit

## ✅ Ready

| Item | Status | Notes |
|------|--------|-------|
| App name | ✅ | "Verity" |
| Bundle identifier | ✅ | `au.com.verity.app` in app.json and eas.json |
| Version | ✅ | `1.0.0` |
| Build number | ✅ | `"1"` (iOS buildNumber) |
| Android versionCode | ✅ | `1` |
| EAS production profile | ✅ | Exists with `autoIncrement: true` |
| Privacy Policy screen | ✅ | Real content — email, postcode, poll votes, comments. Last updated 28 March 2026 |
| Terms of Service screen | ✅ | Real content — acceptable use, age 13+, Australian law |
| Splash screen config | ✅ | `./assets/splash.png`, `resizeMode: contain`, white background |
| Splash image file | ✅ | `assets/splash.png` exists |
| Portrait orientation only | ✅ | `"orientation": "portrait"` |
| Tablet support disabled | ✅ | `supportsTablet: false` — intentional |
| Apple Sign-In package | ✅ | `expo-apple-authentication ~55.0.9` installed |
| Privacy policy content | ✅ | Covers: email auth, postcode, poll votes, no ads/tracking, data sources |
| No location permission needed | ✅ | App uses manually entered postcode — no location APIs called |
| No camera/photos permission | ✅ | Not used |

---

## 🚨 BLOCKING — Must fix before any build

### 1. App Icon has transparency (CRITICAL)
**File:** `assets/icon.png`
**Problem:** The icon is **RGBA (color type 6)** with fully transparent corners (`alpha=0` in all four corners). Apple requires the app icon to be a **full-bleed square with no alpha channel**. Apple applies rounded corners in the OS. A transparent icon will be rejected by App Store Connect's automated checks before a human even reviews it.

**What the current icon looks like:** 1024×1024, green background, white V lettermark, with pre-applied rounded corners (corner pixels are transparent).

**Fix needed (you must do this manually in a design tool):**
- Open the icon in Figma, Sketch, or Photoshop
- Extend the green background (`#00843D`) to fill all four corners — no clipping mask
- Export as PNG: 1024×1024, **RGB** (not RGBA), no alpha channel, no rounded corners
- Replace `assets/icon.png` with the new file
- Verify: `python3 -c "from PIL import Image; img=Image.open('assets/icon.png'); print(img.mode)"` should print `RGB` not `RGBA`

---

### 2. `usesAppleSignIn: true` missing from app.json (CRITICAL)
**File:** `app.json`
**Problem:** `expo-apple-authentication` is installed and Apple Sign-In is used in the app, but the iOS config does not declare `"usesAppleSignIn": true`. Without this, the app will be **rejected by App Store review** because Sign in with Apple is detected but not declared, and the entitlement won't be included in the provisioning profile.

**Fix (Claude Code can do this):**
```json
"ios": {
  "supportsTablet": false,
  "bundleIdentifier": "au.com.verity.app",
  "buildNumber": "1",
  "usesAppleSignIn": true
}
```

---

### 3. `ascAppId` is empty in eas.json (CRITICAL for `eas submit`)
**File:** `eas.json`
**Problem:** `"ascAppId": ""` — this is the numeric App ID from App Store Connect. Without it, `eas submit` cannot upload the build.

**Fix (you must do this manually):**
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Create the app: My Apps → + → New App
   - Platform: iOS
   - Name: Verity
   - Bundle ID: `au.com.verity.app` (select from your registered IDs)
   - SKU: `verity-au` (internal only, can be anything)
3. After creation, go to App Information → Apple ID — copy the 10-digit number
4. Paste it into `eas.json` as `"ascAppId": "1234567890"`

---

### 4. `appleTeamId` is empty in eas.json (CRITICAL for `eas submit`)
**File:** `eas.json`
**Problem:** `"appleTeamId": ""` — required for code signing.

**Fix (you must do this manually):**
1. Go to [developer.apple.com](https://developer.apple.com) → Account → Membership
2. Copy your **Team ID** (10-character alphanumeric, e.g. `ABC123DEF4`)
3. Paste into `eas.json` as `"appleTeamId": "ABC123DEF4"`

---

### 5. `projectId` is a slug, not a UUID (CRITICAL for OTA updates)
**File:** `app.json`
**Problem:** `"projectId": "verity-au"` is a human-readable slug, not the UUID that EAS assigns. OTA updates (Expo Updates) won't work correctly without the real UUID.

**Fix:**
```bash
cd ~/verity/mobile && eas init
```
This links the project and replaces `"verity-au"` with the real UUID automatically.

---

## ⚠️ Needs Attention Before Submission

### 6. Privacy Policy URL must be live
**Problem:** App Store Connect requires a publicly accessible URL for the privacy policy — the in-app screen is not sufficient.
**Fix:** Publish `https://verity.au/privacy` with the same content as `PrivacyPolicyScreen.tsx`. If you don't have a website yet, even a simple one-page static site on Vercel pointing to a Notion page or similar will pass review.

### 7. Apple Developer account required
**Cost:** AUD $149/year (Individual or Organisation account)
**Enroll at:** [developer.apple.com/enroll](https://developer.apple.com/enroll)
**Notes:**
- Individual account is sufficient for a solo founder
- Takes 24–48 hours to activate after payment
- You need this before you can register `au.com.verity.app` as a Bundle ID or create the app in App Store Connect

### 8. Bundle ID must be registered in App Developer portal
After enrolling in the Developer Program:
1. developer.apple.com → Identifiers → + → App IDs
2. Register `au.com.verity.app`
3. Enable capability: **Sign In with Apple**

### 9. Screenshots required
App Store Connect requires at least one screenshot per supported device size. Minimum for iOS-only:
- 6.9" display (iPhone 16 Pro Max) — 1320×2868 or 1290×2796
- 6.1" display (iPhone 16) — optional but recommended

You'll need to take these manually in the Simulator or on device. EAS Build won't generate them.

---

## ℹ️ No Action Required

| Item | Note |
|------|------|
| Android build config | `versionCode: 1`, `package: au.com.verity.app` — ready if you ever submit to Play Store |
| `autoIncrement: true` in EAS | Correct — builds will auto-increment `buildNumber` |
| Supabase URL in app | Uses `EXPO_PUBLIC_SUPABASE_URL` via env — correct pattern for Expo |
| No push notification permission | App doesn't use push notifications yet — no NSPushNotification needed |
| No location permission | Postcode is manually entered — no CLLocationManager used |
| Gear icon | Expo Go dev overlay — doesn't appear in production builds |

---

## Summary: What Claude Code Can Do vs What You Must Do Manually

### Claude Code can handle:
- [x] Add `usesAppleSignIn: true` to app.json (one-line fix)
- [x] Any other app.json / eas.json config values once you have the credentials
- [x] Regenerate the icon from source if you have a vector file accessible

### You must do manually:
- [ ] **Re-export the app icon** as flat RGB square (no transparency, no rounded corners) in Figma/Sketch/Photoshop
- [ ] **Enroll in Apple Developer Program** — $149/year at developer.apple.com
- [ ] **Register Bundle ID** `au.com.verity.app` in the Developer portal + enable Sign In with Apple
- [ ] **Create the app in App Store Connect** — get the `ascAppId` number
- [ ] **Copy Team ID** from developer.apple.com → Membership → paste into eas.json
- [ ] **Run `eas init`** to get the real project UUID into app.json
- [ ] **Take App Store screenshots** (at least 6.9" size) in Simulator or on device
- [ ] **Publish the privacy policy** at a live public URL (verity.au/privacy)
- [ ] **Run `eas build --platform ios --profile production`** to trigger the first App Store build
- [ ] **Run `eas submit --platform ios`** to upload to App Store Connect

---

## Fix Claude Code Can Apply Right Now

The `usesAppleSignIn` flag is the only blocking item that's a pure code change. All other blockers require your Apple credentials or manual design work.
