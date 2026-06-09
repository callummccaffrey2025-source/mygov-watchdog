# App Store Metadata — Verity v1.0

Drafted 2026-06-10. Everything here maps to App Store Connect fields. Edit freely — the voice aims for credible-civic, not startup-hype.

## App Information

- **Name** (30 chars max): `Verity — Know Your Parliament`
- **Subtitle** (30 chars max): `Your MP, bills & votes, live`
- **Bundle ID**: au.com.verity.app · **ASC App ID**: 6762104853
- **Primary category**: News · **Secondary**: Reference
- **Price**: Free (with Verity Pro auto-renewing subscription $4.99/mo, 7-day trial)

## Promotional Text (170 chars, editable without review)

> Parliament votes on your life every sitting day. Verity shows you what your MP actually did — every vote, every donation, every speech. Real records, no spin.

## Description (4000 chars max)

> **See what your MP actually does — not what they say.**
>
> Enter your postcode and Verity shows you your federal MP: their real voting record, their declared donations, their speeches in Parliament, and how often they vote with their party. All of it from official public records — TheyVoteForYou, the AEC, Hansard, and the Parliament of Australia.
>
> **EVERY VOTE, EXPLAINED**
> 6,400+ bills and 140,000+ vote records, translated into plain English. What the bill does, who it affects, how Parliament voted, and how YOUR representative voted.
>
> **FOLLOW THE MONEY**
> Declared donations from AEC records, matched to MPs and parties — and shown next to how they voted on related legislation. Correlation isn't causation, but you deserve to see both on one screen.
>
> **A DAILY BRIEF THAT RESPECTS YOUR TIME**
> One morning summary: what happened in Parliament, what it means, and one thing worth knowing. Written from fresh data every day.
>
> **NEWS WITH ITS BIAS ON THE LABEL**
> Political news from 100+ Australian sources with ownership and bias metadata, so you can see who's telling you what — and what one side isn't covering.
>
> **ACT, DON'T JUST SCROLL**
> Write to your MP about a specific vote in two taps. Pre-filled, factual, sent from your own email.
>
> **LEARN HOW IT ALL WORKS**
> Short lessons on how Australian democracy actually functions — preferential voting, how a bill becomes law, what the Senate does.
>
> Verity is independent. We are not affiliated with any party, candidate, or the Parliament of Australia. Every claim links to a public source. AI-generated summaries are labelled, and the underlying records are always one tap away.
>
> **VERITY PRO** ($4.99/month, 7-day free trial): AI impact analysis, advanced MP analytics, CSV export, priority support. Browsing Parliament is free, forever.
>
> Terms: https://verity.au/terms · Privacy: https://verity.au/privacy

## Keywords (100 chars, comma-separated, no spaces)

`parliament,MP,politics,australia,voting,election,bills,senate,democracy,civic,hansard,donations`

## Privacy Nutrition Labels (App Store Connect → App Privacy)

**Data used to track you**: NONE (no cross-app tracking, no ad SDKs).

**Data linked to you** (signed-in users):
| ASC category | What it is |
|---|---|
| Contact Info → Email | Magic-link / Apple Sign-In email |
| Identifiers → User ID | Supabase user id |
| User Content → Other | Poll votes, saved items, MP message subjects/sentiment |
| Usage Data → Product Interaction | Screens visited, features used (analytics + civic_events) |

**Data not linked to you** (anonymous browsing):
| ASC category | What it is |
|---|---|
| Identifiers → Device ID | Anonymous device id for prefs/push |
| Location → Coarse Location | User-entered postcode (electorate matching only) |
| Usage Data → Product Interaction | Anonymous analytics |
| Diagnostics → Crash Data | error_reports table |

## Age Rating questionnaire

All "None" except: **Unrestricted Web Access: No**, **Gambling: No**. News/political content → expect **12+** (infrequent/mild mature themes from news content). Answer "News" content honestly — political news can reference violence/drugs in headlines.

## App Review notes (paste into "Notes" field)

> Verity displays public Australian parliamentary records (votes, bills, donations, speeches) sourced from official datasets (aph.gov.au, AEC, TheyVoteForYou API). No account is required to browse — tap "Continue without signing in" on first run. To test signed-in features, use Sign in with Apple. The subscription (Verity Pro) is a standard auto-renewing IAP via RevenueCat with a 7-day trial; sandbox purchases work normally. Postcode entry: use 2113 (Bennelong, NSW) to see a populated electorate. AI-generated content (daily brief, bill summaries) is labelled in-app and disclaimed in our Terms.

## Screenshots required (6.9" iPhone 16 Pro Max + 6.5" iPhone 11 Pro Max sizes)

Suggested 6-shot story, in order:
1. Home — Daily Brief hero + "Your Representative" (postcode set, light mode)
2. MP profile — voting record with rebellion indicator
3. Bill detail — plain-English summary + How Parliament Voted bar
4. Donations vs Voting analysis (the money screen — most differentiated)
5. Explore — universal search + topics grid
6. Write to MP — the action moment
Take via Simulator (`xcrun simctl io booted screenshot`) or device; status bar should show full battery/wifi.

## Pre-submission checklist

- [x] eas.json production profile + submit block (ascAppId 6762104853, team BDNZL33WU9)
- [x] Icon 1024×1024 RGB no-alpha (`assets/icon-appstore.png`)
- [x] Privacy Policy + Terms screens in-app
- [x] IAP via RevenueCat integrated in code
- [ ] **RevenueCat dashboard**: webhook Authorization header set to same value as `REVENUECAT_WEBHOOK_SECRET` Supabase secret (required after the June 10 security fix)
- [ ] App Store Connect: create subscription product `verity_pro` ($4.99/mo, 7-day trial) and attach to app
- [ ] verity.au/privacy and verity.au/terms URLs live (ASC requires working URLs)
- [ ] privacy@verity.au + legal@verity.au mailboxes actually receive mail
- [ ] Screenshots taken (6 above)
- [ ] `eas build --platform ios --profile production` → `eas submit --platform ios`
