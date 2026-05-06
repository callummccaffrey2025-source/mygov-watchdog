# Dependencies

Canonical reference for all npm dependencies in Verity.
Last updated: 2026-05-06 (Prompt 6)

Expo SDK: **55** | React Native: **0.83.6** | React: **19.2.0**

---

## Direct dependencies (30)

### Core framework

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `expo` | ~55.0.23 | Expo SDK core | `index.ts` (registerRootComponent) |
| `react` | 19.2.0 | UI framework | All .tsx files |
| `react-native` | 0.83.6 | Native runtime | All .tsx files |

### Navigation

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `@react-navigation/bottom-tabs` | ^7.15.11 | Bottom tab navigator | `App.tsx` |
| `@react-navigation/native` | ^7.2.2 | Navigation container | `App.tsx` |
| `@react-navigation/stack` | ^7.8.11 | Stack navigator | `App.tsx` |
| `react-native-gesture-handler` | ~2.30.0 | Gesture system (peer dep of stack nav) | `App.tsx` |
| `react-native-safe-area-context` | ~5.6.2 | Safe area insets | `App.tsx`, many screens |
| `react-native-screens` | ~4.23.0 | Native screen containers (peer dep of stack nav) | Implicit — no direct imports |

### Expo modules

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `@expo/vector-icons` | ^15.1.1 | Icon library (Ionicons, MaterialIcons) | Most screens |
| `expo-apple-authentication` | ~55.0.13 | Apple Sign-In | `ProfileScreen.tsx`, `AuthPromptSheet.tsx` |
| `expo-application` | ~55.0.14 | App metadata | No direct imports — **peer dep of expo-notifications** |
| `expo-constants` | ~55.0.16 | Build constants (version, device) | `App.tsx`, `ProfileScreen.tsx`, `AboutScreen.tsx` |
| `expo-file-system` | ~55.0.19 | File system access | No direct imports — **dependency of expo core** |
| `expo-font` | ~55.0.7 | Custom fonts | `app.json` plugin (build-time) |
| `expo-haptics` | ~55.0.14 | Haptic feedback | `lib/haptics.ts`, `HomeScreen.tsx` |
| `expo-image` | ~55.0.10 | Optimized image component | `MemberProfileScreen`, `NewsStoryDetailScreen`, `EnhancedStoryCard` |
| `expo-linear-gradient` | ~55.0.13 | Gradient backgrounds | `HomeScreen.tsx` |
| `expo-localization` | ~55.0.13 | Locale detection | `app.json` plugin (build-time) |
| `expo-notifications` | ~55.0.22 | Push notifications | `App.tsx`, `OnboardingScreen`, `HomeScreen` |
| `expo-secure-store` | ~55.0.13 | Encrypted key-value storage | `lib/supabase.ts` |
| `expo-sharing` | ~55.0.18 | Share sheet | `utils/shareContent.ts` |
| `expo-status-bar` | ~55.0.6 | Status bar control | `App.tsx` |
| `expo-updates` | ~55.0.21 | OTA updates | `app.json` updates config (runtime, no imports) |
| `expo-web-browser` | ~55.0.15 | In-app browser | `ProfileScreen.tsx`, `AuthPromptSheet.tsx` |

### Data & utilities

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistent key-value storage | `App.tsx`, `UserContext.tsx`, `OnboardingScreen` |
| `@react-native-community/netinfo` | 11.5.2 | Network connectivity detection | `hooks/useNetworkStatus.ts` |
| `@supabase/supabase-js` | ^2.105.3 | Supabase client (auth, DB, functions) | `lib/supabase.ts`, `UserContext.tsx` |
| `react-native-url-polyfill` | ^3.0.0 | URL API polyfill for Supabase | `lib/supabase.ts` |
| `react-native-view-shot` | 4.0.3 | Screenshot capture for share cards | `utils/shareContent.ts`, `ShareCards.tsx` |

---

## Dev dependencies (2)

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/react` | ~19.2.2 | TypeScript type definitions for React |
| `typescript` | ~5.9.2 | TypeScript compiler |

---

## npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `expo start` | Start Expo dev server |
| `npm run typecheck` | `tsc --noEmit` | Type-check without emitting |
| `npm run audit` | `npm audit && npx expo-doctor && bash scripts/check_env.sh` | Full project health check |
| `npm run verify` | `tsc --noEmit && npx expo-doctor` | Pre-commit verification |

---

## Major updates pending manual review

These require breaking-change assessment. Do NOT apply without a dedicated session.

| Package | Current | Latest | Risk | Notes |
|---------|---------|--------|------|-------|
| `@react-native-async-storage/async-storage` | 2.2.0 | 3.0.2 | High | Major version — API changes likely |
| `@react-native-community/netinfo` | 11.5.2 | 12.0.1 | High | Major version |
| `react-native-view-shot` | 4.0.3 | 5.1.0 | Medium | Major version — used in share cards |
| `typescript` | 5.9.x | 6.0.x | Medium | Major version — may require config changes |
| `react` | 19.2.0 | 19.2.5 | Low | Pinned by Expo SDK 55 — upgrade with SDK |
| `react-native` | 0.83.6 | 0.85.3 | Low | Pinned by Expo SDK 55 — upgrade with SDK |
| `react-native-safe-area-context` | 5.6.2 | 5.7.0 | Low | Minor, but pinned by Expo SDK 55 |
| `react-native-screens` | 4.23.0 | 4.24.0 | Low | Minor, but pinned by Expo SDK 55 |

---

## Known unfixed advisories

### postcss < 8.5.10 — XSS via unescaped `</style>` in CSS stringify output

- **Severity:** Moderate
- **Advisory:** [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
- **Affected path:** `expo` > `@expo/cli` > `@expo/metro-config` > `postcss`
- **Why not fixed:** The only available fix (`npm audit fix --force`) would downgrade Expo from SDK 55 to SDK 49 — a catastrophic breaking change. This vulnerability is in the Metro bundler's CSS processing pipeline, which:
  - Runs at **build time only**, not in the shipped app
  - Processes developer-authored CSS, not untrusted user input
  - Is not exploitable in a React Native context (no browser DOM)
- **Risk to Verity:** None. The vulnerability requires an attacker to inject malicious CSS into the build pipeline, which implies they already have write access to the codebase.
- **Resolution path:** Will be fixed automatically when Expo SDK 56+ ships an updated `@expo/metro-config` with postcss >= 8.5.10. No action required from us.

---

## Removed in this session

| Package | Version | Reason |
|---------|---------|--------|
| `expo-device` | 55.0.15 | Zero imports in codebase, not in app.json plugins, not a peer dep of any other package |

---

## Changes applied in Prompt 6

| Change | Count |
|--------|-------|
| Expo patch updates (expo-doctor recommended) | 8 packages |
| Non-Expo patch/minor updates | 4 packages (@react-navigation x3, @supabase/supabase-js) |
| Security fixes (npm audit fix) | 2 advisories resolved (xmldom HIGH, brace-expansion moderate) |
| Unused deps removed | 1 (expo-device) |
| expo-doctor result | 18/18 checks pass |
| tsc --noEmit result | 0 errors |
