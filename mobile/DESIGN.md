# DESIGN.md — Verity Design System
# The civic intelligence platform Australians trust every morning.
# Design language: editorial authority + consumer simplicity.
# Think: The Guardian meets Apple News meets Ground News.

## Brand
- Verity green: #00843D
- Green light: #E8F5EE
- Green dark: #006B31

## Semantic Colors
- Aye/Pass: #00843D
- No/Fail: #DC3545
- Neutral: #6C757D

## Bias Spectrum
- Left: #2563EB, Lean Left: #60A5FA, Centre: #6B7280, Lean Right: #F87171, Right: #DC2626

## Factuality
- Very High: #00843D, High: #22C55E, Mostly Factual: #EAB308, Mixed: #F97316, Low: #DC3545

## Topic Colors
politics: { bg: '#E6F1FB', text: '#0C447C' }
economy: { bg: '#FAEEDA', text: '#633806' }
climate: { bg: '#E1F5EE', text: '#085041' }
health: { bg: '#EEEDFE', text: '#3C3489' }
defence: { bg: '#FCEBEB', text: '#791F1F' }
housing: { bg: '#FAECE7', text: '#712B13' }
education: { bg: '#EAF3DE', text: '#27500A' }
immigration: { bg: '#FBEAF0', text: '#72243E' }
indigenous_affairs: { bg: '#FAECE7', text: '#712B13' }
technology: { bg: '#E6F1FB', text: '#0C447C' }
agriculture: { bg: '#EAF3DE', text: '#27500A' }
cost_of_living: { bg: '#FAEEDA', text: '#633806' }
infrastructure: { bg: '#F1EFE8', text: '#444441' }
foreign_policy: { bg: '#E6F1FB', text: '#0C447C' }
justice: { bg: '#F1EFE8', text: '#444441' }

## Light Mode Surfaces
Background: #FFFFFF, Surface: #F8F9FA, Card: #FFFFFF, Hero: #00843D, Divider: #E9ECEF

## Dark Mode Surfaces
Background: #000000, Surface: #1C1C1E, Card: #2C2C2E, Hero: #00843D, Divider: #38383A

## Typography
Display: 32/700/1.1 (hero greetings)
H1: 24/700/1.2 (screen titles)
H2: 17/600/1.3 (section headers)
SectionLabel: 11/600/uppercase/letterSpacing:0.8/secondary
Body: 15/400/1.5
BodyBold: 15/600
Caption: 13/400/secondary
Micro: 11/500/tertiary

## Spacing
xs:4 sm:8 md:12 lg:16 xl:24 xxl:32 xxxl:48

## Components
Cards: bg card, borderRadius 14, shadow(0,1,0.04,3), padding 16, NO borders, gap 12
Buttons Primary: green bg, white text, radius 10, height 48
Buttons Secondary: white bg, green 1px border, green text, radius 10, height 48
Badges: topic bg+text from topic colors, paddingV 6, paddingH 10, radius 6
Press: Pressable scale(0.98) opacity(0.92) on pressIn, spring back
Lists: 0.5px divider, inset 16 left, row height 56
Skeletons: shimmer animation, gray pulse 0.3-0.7, 1.5s ease
Empty states: 48px icon + 17px title + 15px description + action button. NEVER "coming soon"

## Visual Principles (non-negotiable)

These are taste decisions, not tokens. Every screen must embody all of them.

### White space is a feature
- When in doubt, add more space. Cramped screens feel cheap.
- 32px top margin before each section header. 12px between items within a section. 48px before footer content.
- Content never touches screen edges. Minimum 20px horizontal padding (use spacing.xl = 24).
- Lists show max 5-7 items before "See all". If more are visible, the screen is too dense.

### One hero per screen
- Every screen has ONE dominant visual element. Everything else is subordinate.
- HomeScreen hero: the greeting + daily brief card. ExploreScreen hero: the search bar. MemberProfile hero: the photo + name header.
- The hero gets the largest type, the most padding, the strongest color. Nothing else competes.

### Cards are elevated surfaces, not bordered boxes
- Cards float above the background via shadow. Never use borders on cards.
- Default: shadow-sm (shadowOffset {0,1}, shadowOpacity 0.04, shadowRadius 3).
- Pressed/active: shadow-md + scale(0.98). Spring animation back (200ms).
- Card padding: 16px. Card gap (between cards in a list): 12px. Card radius: 14px.

### Three font sizes per screen, maximum
- Pick from: Display (32), H1 (24), H2 (17), Body (15), Caption (13), Micro (11).
- A typical screen uses H1 + Body + Caption. If you need a 4th size, you have too much content — cut, don't add a size.
- Section labels: 11px, 600 weight, uppercase, letter-spacing 0.8, muted color. Consistent everywhere.

### One accent color per screen
- Green (#00843D) is for CTAs and the primary action only. One green element per viewport.
- Everything else: greyscale (text: #1A1A1A / #6C757D / #ADB5BD on light, inverted on dark).
- Topic colors are the exception — they appear in badges only, never as backgrounds for whole sections.
- Aye/No colors (green/red) appear only in vote context, never decoratively.

### Typography has rhythm
- Line heights: 1.1 for display, 1.2 for headings, 1.5 for body, 1.4 for captions.
- Never center-align body text. Left-align everything except single-line empty state titles.
- Bold (600/700) is for headings and emphasis only. Body text is always 400 weight.
- Numbers in stats/counts use tabular (monospace) figures when possible.

### Motion is subtle and purposeful
- Micro-interactions: 200ms ease-out (press feedback, toggle, icon change).
- Layout changes: 350ms spring (LayoutAnimation.configureNext for list reorders, section expand/collapse).
- Page transitions: use React Navigation defaults. Never custom transition unless it's the onboarding flow.
- Never use linear easing. Never animate for longer than 400ms.
- Haptics: light impact on press (hapticLight), medium on destructive actions. Never on scroll.

### Images are first-class
- News cards: image fills the top portion (aspect ratio 16:9), text below. Never image-left/text-right on mobile.
- MP photos: circular, 48px in lists, 80px in headers, 120px in profiles. Always with a 2px white border + shadow.
- Fallback: grey surface (#F3F4F6) with a centered Ionicon (24px, grey-400). Never a broken image icon.
- All images use expo-image with contentFit="cover", transition={200}, and a placeholder color.

### Skeleton loaders match the content shape
- Every component has a skeleton that mirrors its exact layout (same heights, widths, radii).
- Shimmer animation: pulse between opacity 0.3 and 0.7, 1.5s ease-in-out, infinite.
- Show skeletons for a minimum of 300ms to avoid flash (even if data loads instantly).
- Never show a blank screen or a centered spinner. Skeletons everywhere.

### Empty states are designed, not defaulted
- Every empty state has: 48px Ionicon + 17px title + 15px description + CTA button.
- Copy is specific: "No bills match your topics yet" not "No data available".
- CTA leads somewhere useful: "Browse all bills", "Set your topics", "Follow an MP".
- Never show an empty FlatList with no explanation.

### Iconography
- Ionicons only. 20px default size in body context, 24px in headers, 48px in empty states.
- Icons are grey-500 (#6C757D) by default. White on dark/colored backgrounds. Green only on active state.
- Icon + text pairs: 8px gap. Icon vertically centered with first line of text.

### Reference apps (study these)
- **Apollo** (Reddit client): Card density, information hierarchy, smooth transitions
- **Things 3**: White space mastery, typography rhythm, minimal color
- **Linear**: Section headers, keyboard navigation feel, status badges
- **Ground News**: Bias visualization, source attribution, coverage bars
- **Apple News**: Hero cards, editorial layout, image-forward design

## Don'ts
- No borders on cards (shadows only)
- No emoji in UI (Ionicons only)
- No hardcoded colors (theme constants only)
- No dates as "28 Mar" (use "2h ago" / "3d ago")
- No "coming soon" / "N/A" / "no data available"
- No inconsistent radius (14 cards, 10 buttons, 6 badges, full avatars)
- No Image component (use expo-image)
- No inline anonymous functions in FlatList renderItem
- No unstyled loading states (shimmer everywhere)
- No centered body text (left-align always, except single-line empty state titles)
- No more than 3 font sizes per screen
- No competing accent colors (one green element per viewport)
- No layout without vertical rhythm (32px between sections, 12px between items)
- No animation longer than 400ms or using linear easing
- No raw ActivityIndicator (use Skeleton shimmer instead)
