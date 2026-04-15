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
