# Verity Office Hours — May 18, 2026

## The Six Forcing Questions

### 1. Who desperately needs this right now?

Australians watching One Nation poll at 24.5% while the Coalition sits at 20.6%.
That's the most dramatic primary vote shift in modern Australian political history.
People want to understand what's happening — is their MP crossing the floor? How
does their electorate compare? Is this real or just one pollster?

The desperate user isn't "someone who likes politics." It's:
- A voter in a marginal seat who just saw their MP's party drop to third place
- A journalist covering the election cycle who needs vote-by-vote MP records fast
- A politically engaged 25-45 year old who's tired of being told what to think and
  wants to see the actual data

Today, these people Google "how did my MP vote on immigration," get a wall of
Hansard PDFs, give up, and read a hot take on Sky News or the Guardian instead.
Verity is the only app that can answer that question in 3 taps.

**But here's the problem:** these people don't know Verity exists.

### 2. What's the status quo without Verity?

- **News:** ABC News, Guardian, Sky News apps — biased, no personalisation, no MP accountability layer
- **Parliament data:** APH website, TheyVoteForYou — ugly, desktop-only, no context
- **Polls:** Wikipedia tables, individual pollster websites — scattered, no aggregation
- **Election tools:** ABC Vote Compass (once every 3 years), Tally Room (desktop blog)

The status quo works well enough that most Australians never look for an
alternative. Verity has to be 10x better at the moment someone cares, or they
won't switch.

### 3. Who is the single most desperate user? Name them.

**Sarah, 34, Bennelong.** Her seat flipped at the last election. She works in
healthcare and wants to know how her new MP voted on the Medicare bill. She
Googled it, got nothing useful, and gave up. If Verity showed up in her search
results with "Your MP voted NO on the Medicare Urgent Care Clinics bill — here's
the full record," she'd install it in 30 seconds and tell five friends.

Sarah doesn't browse the App Store for politics apps. She finds tools through
Google search results, social media shares, and news articles that cite data.

### 4. What's the narrowest wedge that wins?

Verity has 20+ screens. That's a platform, not a wedge. The narrowest wedge:

> "Look up how your MP voted — verified from parliament records"

One search, one answer, with a share card. That's the atomic unit of value.
Everything else (news, polls, daily brief, community feed, councils) is
nice-to-have that can grow from that core.

The share cards are actually the most strategically important feature you've
built. An MP report card shared on Facebook is free distribution. A "Your MP
voted NO" share card is a conversation starter. Those are the growth loops.

### 5. What have you observed from actual users?

**Nothing.** This is the biggest problem.

Verity is on TestFlight. There's no mention of:
- How many TestFlight users exist
- Which screens get used
- What the retention curve looks like
- Whether anyone has ever shared a card
- Whether the daily brief gets opened
- Whether anyone has written to their MP through the app

You've spent months building 20 screens, 8 data scrapers, 7 managed agents,
a community feed, a polls system, council profiles, donation tracking, and
ScrapeGraphAI integrations. All of this was built without a single data point
from a real user telling you what they actually want.

This isn't a criticism of the engineering — the engineering is genuinely
impressive. It's a criticism of the process. Every week spent building a
new screen is a week not spent learning whether the last five screens matter.

### 6. What does 20M users look like? Is the path plausible?

20M users is ~80% of Australian adults. The ABC News app — the most trusted
media brand in Australia, backed by a billion-dollar public broadcaster — has
roughly 2-3M monthly users.

20M is not a 4-week goal. It's not even a 4-year goal without a billion-dollar
media partnership or a mandatory-install government contract. Ground News has
~1M users globally after 6 years and significant VC funding.

A realistic near-term milestone: **1,000 users by election announcement day.**
If you can get 1,000 engaged users who use Verity weekly, you have:
- Proof of demand
- Data to learn from
- A user base that shares content
- A story for investors or media coverage

---

## The Verdict

### Your self-assessment is correct and you should act on it.

"95% of effort has been on screens" — yes. And continued screen iteration is
**below the line.** The product is feature-rich enough to ship. Further UI work
is procrastination dressed as productivity.

### The 3 highest-leverage things for the next 4 weeks:

#### 1. SUBMIT TO THE APP STORE THIS WEEK (Days 1-3)

Not "prepare for submission." Submit. The eas.json is configured. The icon is
valid. Run:

```
eas build --platform ios --profile production
eas submit --platform ios
```

Every day on TestFlight-only is a day with zero organic discovery. The App
Store is not a distribution strategy — but it's a prerequisite for every
distribution strategy. App Store search for "Australian politics," "MP voting
record," "Australia polls" should return Verity.

Write App Store copy that leads with the election moment:
> "See how your MP really voted. Track the polls. Verify political claims.
> Powered by real parliament data, not opinion."

**This is the single highest-ROI activity available to you right now.**

#### 2. INSTRUMENT AND LEARN (Days 1-7, parallel with submission)

Before adding another feature, add analytics. You need to know:

- Screen views (which screens do people actually open?)
- Session duration (do they browse or bounce?)
- Share events (are the share cards being used?)
- Electorate distribution (which electorates have users?)
- Feature adoption (polls voted? Claims verified? MPs searched?)
- Push notification open rates

The `track()` function already exists in `lib/analytics.ts`. The `share_events`
table exists. You need a dashboard — even a Supabase SQL query you run weekly.

Then get 50 real users. Not TestFlight testers. Real users who chose to install
the app because they wanted it. Sources:
- r/AustralianPolitics (190K members)
- r/australia (1.2M members)
- Australian political Facebook groups
- Political journalists (cold DM 20 journalists with a personalised "here's
  what Verity shows about YOUR electorate" pitch)
- Hacker News "Show HN" post

**50 real users with analytics will teach you more in 1 week than 4 more
weeks of building screens.**

#### 3. NAIL THE ELECTION WEDGE POSITIONING (Days 7-14)

One Nation at 24.5%. Coalition at 20.6%. This is a once-in-a-generation
political shift. Verity is the only app that can show:
- How every MP voted on every bill
- Where the polls stand with all parties
- What the coverage looks like from left and right

This is your marketing angle. Not "civic intelligence platform" (nobody knows
what that means). Not "Australian politics app" (boring).

Try: **"Your MP's real voting record. In your pocket."**

The election must happen by May 2028. The next 6-12 months are the ramp-up
period where political attention intensifies. Verity needs to be live, indexed,
and accumulating users before that wave crests.

Write a one-page landing page at verity.au (or verity.run) with:
- The value proposition in one sentence
- 3 screenshots (MP profile, polls, daily brief)
- App Store link
- Press kit (for journalists)

---

## What to STOP doing

| Stop | Why | Cold turkey or taper? |
|------|-----|-----------------------|
| Building new screens | 20+ is enough. Every new screen is maintenance debt with no users to see it. | Cold turkey |
| Perfecting UI on existing screens | The design system is solid. Users won't notice the difference between a good screen and a great one. They will notice if the app doesn't exist on the App Store. | Cold turkey |
| Adding data sources | 225 MPs, 6400 bills, 140K votes, 63 bias-rated sources is plenty. No user has ever said "I wish this app had more data sources." | Cold turkey |
| ScrapeGraphAI experiments | Fun, technically impressive, zero user impact. The state parliament scrapers, house interests PDFs, bulk MBFC — none of this matters until you have users who would use it. | Cold turkey |
| Community feed development | A community feed with zero users is a ghost town that actively hurts the product experience. Hide it or remove the entry point until you have 500+ users. | Taper (hide entry point) |

---

## What the numbers actually say

| Metric | Current | Where it should be in 4 weeks |
|--------|---------|-------------------------------|
| App Store status | TestFlight only | Live on App Store |
| Real users (non-tester) | ~0 | 50-100 |
| Analytics dashboard | None | Basic screen/feature tracking |
| Landing page | None | Live at verity.au/verity.run |
| App Store reviews | 0 | 5-10 (ask early users) |
| Press mentions | 0 | 1-2 (pitch journalists) |
| Share cards sent | Unknown | Tracked, target: 20/week |

---

## The uncomfortable truth

You've built a genuinely impressive product. The data depth is real — 225 MPs
with photos, 140K votes, bias-rated news coverage, AI-generated daily briefs,
polls with 6-party tracking. No other app in Australia has this.

But nobody knows it exists.

The gap between "impressive product" and "used product" is distribution, not
features. Every hour spent on a new screen, a new scraper, a new data source
is an hour not spent getting Verity into the hands of the person who would
tell their friends about it.

The product is ready. Ship it. Learn from real users. Then build what they need.

---

## Recommended next /autoplan invocation

```
/autoplan "Ship Verity to App Store, instrument analytics, acquire first 50
users. Scope: (1) eas build + submit for iOS, (2) analytics dashboard from
existing track() calls, (3) App Store listing copy + screenshots,
(4) landing page at verity.run, (5) outreach plan for r/AustralianPolitics
+ political journalists. No new screens. No new data sources. Distribution only."
```

---

*Generated by /office-hours on 2026-05-18. Strategy only, no code changes.*
