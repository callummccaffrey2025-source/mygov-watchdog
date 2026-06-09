# Verity Sprint — Active Tasks

Shared task file read by all swarm agents. Each agent picks tasks matching their track.

## How it works
- Agents claim tasks by writing their track name to the Status field
- Only pick tasks matching your track tag
- Mark DONE with a one-line summary when finished
- If blocked, mark BLOCKED with the reason

---

## Track: infra (DONE — completed in previous swarm)

### S-001 | Fix pipeline_runs check constraint
- Status: DONE

### S-002 | Increase votes ingestion reliability
- Status: DONE

---

## Track: data (DONE — completed in previous swarm)

### S-004 | Env var naming consistency
- Status: DONE

---

## Track: perf (DONE — completed in previous swarm)

### S-005 | Memoize list item components
- Status: DONE

### S-006 | Lazy load screens in App.tsx
- Status: DONE

---

## Track: quality (DONE — completed in previous swarm)

### S-007 | Design system audit
- Status: DONE

---

## Track: ui — FLAGSHIP DESIGN SPRINT

All tasks below reference DESIGN.md Visual Principles. Read them before starting.
Same content, 10x better presentation. Do NOT add features or change functionality.

### S-010 | HomeScreen — flagship hero + rhythm
- Status: TODO
- Description: |
    The HomeScreen is the first thing users see. It must feel like opening Apollo or Apple News.
    
    1. HERO: Greeting + date header gets 48px top padding, Display size (32px). Below it, the daily brief card gets a subtle green gradient background (linear from #00843D to #006B31), white text, 20px padding, shadow-md. "Read today's brief →" right-aligned in Caption.
    2. SECTION RHYTHM: Every section header gets 32px top margin, 8px bottom margin. Use the SectionLabel style (11px/600/uppercase/letterSpacing 0.8/muted).
    3. VOTE CARDS: Each recent vote card shows the division name (Body/600), the date (Caption/muted), and an aye/no mini bar (height 4px, rounded, green/red proportional). No heavy borders.
    4. BILL SWIPE: The bill swipe card area needs 16px horizontal padding and cards with shadow-sm. Card content: bill title (H2), plain summary (Body, max 2 lines), topic badge.
    5. LEARN MODULES: Cards with image placeholder (16:9 aspect, grey surface with book-outline icon), title below (Body/600), lesson count (Caption).
    6. BOTTOM BREATHING: 48px paddingBottom on the ScrollView so content doesn't jam against the tab bar.
    7. All spacing uses theme tokens (spacing.xs/sm/md/lg/xl/xxl). No magic numbers.
- Files: screens/HomeScreen.tsx
- Acceptance: HomeScreen has clear hero, consistent 32px section gaps, shadow-only cards, green hero card, tsc passes

### S-011 | MemberProfileScreen — editorial portrait layout
- Status: TODO
- Description: |
    MP profiles should feel like reading a profile in The Monthly or Good Weekend.
    
    1. HERO: Full-width header area. Party color as background (subtle, 10% opacity). MP photo centered (120px circle, 3px white border, shadow-md). Name in H1 below, party + electorate in Caption. Ministerial role as a green badge below name.
    2. STATS ROW: Horizontal scroll of pill-shaped stat badges (votes, bills, committees, rebellion rate). Each pill: grey surface, Body/600 number, Caption label below. 12px gap between pills.
    3. TABS: Vote/About/Funding tabs. Active tab: green underline (3px), green text. Inactive: grey text, no underline. 48px tab height. Smooth indicator animation (200ms ease-out).
    4. VOTE LIST: Each vote row: division name (Body, max 2 lines), date (Caption/right-aligned), AYE/NO badge (topic bg color, rounded, 6px radius). Subtle 0.5px divider between rows, inset 16px.
    5. ABOUT TAB: Committee memberships as tags (badge style), contact details in a card with shadow-sm.
    6. FUNDING TAB: Donations as a clean list with amount (Body/600), donor name (Body), date (Caption). Top donors section with a simple bar chart (horizontal bars, green fill, grey track).
- Files: screens/MemberProfileScreen.tsx
- Acceptance: Photo hero with party tint, pill stats, clean tab indicator, vote rows with aye/no badges, tsc passes

### S-012 | ExploreScreen — search-first with discovery grid
- Status: TODO
- Description: |
    Explore should feel like opening Spotlight on Mac — search bar dominates, content below inspires browsing.
    
    1. SEARCH BAR: Full-width, 48px height, grey surface (#F1F3F5), 14px radius, search icon left (Ionicons search, 20px, grey-400), placeholder "Search MPs, bills, parties…" in Body/muted. 24px horizontal margin.
    2. SECTION HEADERS: "Browse by Topic" and "Parties" use SectionLabel style (11px/uppercase/muted). 32px top margin.
    3. TOPIC GRID: 2-column grid. Each card: topic bg color as full background (from topic colors), topic name in topic text color (H2/600), icon (Ionicons, 24px, topic text color) top-right. Card height 88px, radius 14, shadow-sm. 12px gap.
    4. PARTY SCROLL: Horizontal FlatList. Each party: circle logo (48px, white bg, shadow-sm), party name below (Caption, center-aligned). 16px gap between items. Shows Labor/LNP/Liberal/Greens first.
    5. VERIFY A CLAIM: Single card at bottom, green surface, white text, "Verify a Claim →". Full width, 14px radius, 16px padding.
    6. All touch targets minimum 44px.
- Files: screens/ExploreScreen.tsx
- Acceptance: Search bar hero, 2-col topic grid with colors, party scroll, tsc passes

### S-013 | BillDetailScreen — legislation feels important
- Status: TODO
- Description: |
    Bills are the core product. This screen should make legislation feel consequential, not bureaucratic.
    
    1. HEADER: Bill title in H1 (24px/700), max 3 lines. Below: status badge (Introduced/Passed/Royal Assent — green for passed, grey for others, 6px radius). Introduced date in Caption.
    2. PLAIN SUMMARY: In a card with shadow-sm, 16px padding. Body text. If no summary, show empty state: "Summary being prepared" with document-text-outline icon.
    3. HOW PARLIAMENT VOTED: Section with aye/no horizontal bar (height 8px, rounded caps, green/red proportional fill). Below bar: "X Aye · Y No" in Caption. Below that: party breakdown — each party on a row with party name (Body) and mini aye/no bar (height 4px).
    4. ARGUMENTS: For/Against in two cards side by side (flex row, equal width). "For" card: green-light bg. "Against" card: red-light bg (#FEF2F2). Each shows 2-3 bullet points in Caption.
    5. YOUR MP'S VOTE: Highlighted card — "Your MP [name] voted [AYE/NO]" with their photo (32px circle), name, and a colored badge.
    6. WRITE TO YOUR MP: CTA button at bottom, green, full-width. "Tell [name] what you think →".
    7. Spacing: 24px between sections. 32px bottom padding.
- Files: screens/BillDetailScreen.tsx
- Acceptance: Bill title hero, vote bar visualization, for/against cards, MP vote highlight, tsc passes

### S-014 | DailyBriefScreen — morning editorial
- Status: TODO
- Description: |
    This is the screen users wake up to. It should feel like a beautifully designed morning newsletter.
    
    1. HEADER: Green background (gradient #00843D → #006B31). White text. Date in SectionLabel style (uppercase, letter-spacing). "Your Daily Brief" in Display (32px/white). Subtle bottom curve (borderBottomLeftRadius: 24, borderBottomRightRadius: 24).
    2. SECTIONS: "What happened", "Your MP's week", "Bills to watch", "One thing to know". Each section: SectionLabel header, then content cards with shadow-sm. 32px gap between sections.
    3. WHAT HAPPENED: Each story is a card with a colored topic badge, headline (H2/600), 2-line summary (Body), source count ("from 8 sources" in Caption/muted).
    4. YOUR MP'S WEEK: Card with MP photo (48px circle), name, and a bullet list of their recent votes (Body, with AYE/NO colored text).
    5. ONE THING TO KNOW: Single card, slightly larger padding (20px), Body text with a lightbulb-outline icon top-left. This is the "aha moment".
    6. SHARE: Floating share button bottom-right (56px circle, green, share-outline icon, shadow-lg). 
    7. All text uses parseBold() for **bold** markdown rendering.
- Files: screens/DailyBriefScreen.tsx
- Acceptance: Green gradient header with curve, section cards, share FAB, tsc passes

### S-015 | ProfileScreen — personal dashboard
- Status: TODO
- Description: |
    Profile is where users see their civic identity. It should feel personal and clean.
    
    1. HEADER: User avatar (80px circle, green border if verified, grey if anonymous) centered. Name in H1 below. Electorate in Caption with map-outline icon. "Member since [date]" in Micro/muted.
    2. CIVIC STATS: Row of 3 stat cards (equal width, horizontal). Each: large number (H1/700), label (Caption). Stats: "Bills tracked", "Votes viewed", "Days active". Cards with shadow-sm.
    3. QUICK ACTIONS: List of rows with icon + label + chevron. Rows: Saved Items, Notification Preferences, Your Topics, Write to MP, Subscription. 56px row height, 0.5px dividers.
    4. SETTINGS: Separate section (32px top gap). Dark mode toggle (switch component), Privacy Policy, Terms, About Verity. Same row style.
    5. Sign out: Red text at bottom, 48px tap target, no background.
    6. Overall feel: personal dashboard, not a settings dump. Stats first, actions second, settings last.
- Files: screens/ProfileScreen.tsx
- Acceptance: Avatar hero, stat cards row, action rows with icons, tsc passes

### S-016 | Global polish pass
- Status: TODO
- Description: |
    After individual screen redesigns, do a consistency pass across ALL screens:
    
    1. Every screen uses SafeAreaView with correct edges.
    2. Every ScrollView has 48px paddingBottom.
    3. Every section header uses the SectionLabel style (11px/600/uppercase).
    4. Every card uses shadow-sm (never borders), 14px radius, 16px padding.
    5. No screen has more than 3 font sizes.
    6. All empty states follow the pattern: 48px icon + 17px title + 15px body + CTA.
    7. All press targets are minimum 44px and use PressableScale.
    8. Green appears max once per viewport as an accent.
    9. Fix any remaining hardcoded colors — everything through useTheme().
    10. Run tsc — zero errors.
    
    Do NOT change functionality. Visual consistency only.
- Files: screens/*.tsx
- Acceptance: All screens follow DESIGN.md visual principles, tsc passes
