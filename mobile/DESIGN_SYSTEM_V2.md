# Verity Design System v2 — Editorial Civic Publication
# The visual position: this belongs next to serious journalism, not social media.
# Design language: The Economist meets Artifact meets the Financial Times.
# Defining move: serif headlines on warm off-white, restrained colour usage.

## 1. Colours

### Light mode palette

| Token | Hex / Value | Usage |
|---|---|---|
| `paper` | `#F5F3EF` | App-wide background canvas |
| `card` | `#FEFDFB` | Card surfaces, elevated containers |
| `textPrimary` | `#1A1A17` | Headlines, names, primary content |
| `textSecondary` | `rgba(26,26,23,0.55)` | Body text, descriptions |
| `textTertiary` | `rgba(26,26,23,0.40)` | Timestamps, meta labels, captions |
| `textQuiet` | `rgba(26,26,23,0.30)` | Hints, footers, methodology notes |
| `hairline` | `rgba(26,26,23,0.08)` | Dividers, card borders |
| `softBorder` | `rgba(26,26,23,0.15)` | Focus states, hover outlines |
| `brandGreen` | `#00843D` | Hero highlight — ONE per screen max |
| `semanticAye` | `#00843D` | Vote aye/yes only |
| `semanticNo` | `#8B1A1A` | Vote no/against only — deep red-brown |
| `semanticWarning` | `#B8841A` | Warnings, caution states |
| `semanticInfo` | `#1A4D7F` | Informational callouts |

### Dark mode palette

| Token | Value | Notes |
|---|---|---|
| `paper` | `#1A1A17` | Canvas inverts to near-black |
| `card` | `#242420` | Slightly elevated surface |
| `textPrimary` | `#FAF8F3` | Warm white, never pure white |
| `textSecondary` | `rgba(250,248,243,0.60)` | |
| `textTertiary` | `rgba(250,248,243,0.45)` | |
| `textQuiet` | `rgba(250,248,243,0.30)` | |
| `hairline` | `rgba(250,248,243,0.08)` | |
| `softBorder` | `rgba(250,248,243,0.15)` | |
| `brandGreen` | `#00843D` | Same in both modes |
| `semanticAye` | `#2D9F5E` | Slightly lighter for dark backgrounds |
| `semanticNo` | `#C75050` | Slightly lighter for dark backgrounds |
| `semanticWarning` | `#D4A84B` | |
| `semanticInfo` | `#4A8CC7` | |

### Bias spectrum (data visualisation only — never in UI chrome)

| Leaning | Hex | Usage |
|---|---|---|
| Left | `#2563EB` | Coverage bars, headline comparison strips |
| Lean left | `#60A5FA` | Coverage bars only |
| Centre | `#6B7280` | Coverage bars only |
| Lean right | `#F87171` | Coverage bars only |
| Right | `#DC2626` | Coverage bars, headline comparison strips |

### Colour rules

1. Brand green appears at most ONCE per screen. Reserved for the single highest-value data point.
2. Semantic aye/no colours appear only on votes and binary actions.
3. No other saturated colours in the UI. No party colours outside dedicated data visualisations.
4. Bias spectrum colours appear only inside coverage bars and headline comparison — never in navigation, cards, or labels.
5. No gradients. No glassmorphism.

---

## 2. Typography

### Font families

| Role | iOS | Android |
|---|---|---|
| Serif (display) | `'Charter', 'Iowan Old Style', 'Georgia', serif` | `'serif'` (Noto Serif) |
| Sans (body/UI) | System default (`-apple-system`) | System default (`Roboto`) |

In React Native, set `fontFamily` to the serif stack for display text. Omit `fontFamily` for sans text (system default).

### Type scale

| Token | Size | Line height | Weight | Letter spacing | Family | Usage |
|---|---|---|---|---|---|---|
| `heroHeadline` | 34 | 36 | 400 | -0.02em | Serif | Screen hero titles |
| `h1` | 24 | 28 | 400 | -0.01em | Serif | Section titles |
| `h2` | 20 | 24 | 400 | -0.01em | Serif | Subsection headings |
| `h3` | 17 | 22 | 400 | -0.005em | Serif | Card titles, MP names |
| `statNumber` | 28 | 30 | 400 | -0.02em | Serif | Large statistics |
| `body` | 15 | 22 | 400 | 0 | Sans | Body text, descriptions |
| `label` | 13 | 18 | 400 | 0.01em | Sans | UI labels, form fields |
| `meta` | 12 | 16 | 400 | 0.01em | Sans | Timestamps, attribution |
| `caption` | 11 | 14 | 500 | 0.04em | Sans | Badges, uppercase labels only |
| `button` | 14 | 20 | 500 | -0.01em | Sans | Button text |

### Typography rules

1. Only weights 400 (regular) and 500 (medium). Never 600 or 700.
2. UPPERCASE only for `caption`-sized badges and labels. Never for headings.
3. Title case never used. Sentence case always.
4. Italic serif ONLY for Hansard pullquotes — never for emphasis.
5. Minimum readable size: 11px. Nothing smaller.
6. Serif `letterSpacing` on Android: add `letterSpacing: -0.01` to compensate for Noto Serif's wider default tracking.

---

## 3. Spacing

### 8-point grid

All spacing values must come from this set:

`4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80`

No value outside this set is permitted. If you need 5, 10, 15, or 23 — use the nearest grid value.

### Semantic tokens

| Token | Value | Usage |
|---|---|---|
| `screenPadding` | 20 | Horizontal padding on all screens |
| `cardPadding` | 20 | Internal padding inside cards |
| `sectionGap` | 28 | Vertical gap between distinct sections |
| `itemGap` | 12 | Gap between related items in a list |
| `inlineGap` | 8 | Gap between inline elements (icon + text) |
| `hairlineHeight` | 0.5 | Divider line thickness |
| `cardRadius` | 20 | Card border radius |
| `buttonRadius` | 12 | Button border radius |
| `badgeRadius` | 4 | Badge pill border radius |

---

## 4. Components

All components live in `components/design-system/` and are exported from `components/design-system/index.ts`.

### Paper
Root container. Sets `paper` background, `screenPadding` horizontal, flex: 1.
Props: `children`, `scroll?: boolean` (wraps in ScrollView).

### Card
Elevated surface. `card` background, `cardRadius` border radius, `hairline` border (0.5px), `cardPadding` internal padding.
Props: `children`, `noPadding?: boolean`.

### Hero
Full-bleed section header inside a Card or at screen top.
Structure: uppercase `caption` label → serif `heroHeadline` or `h1` title → `meta` line.
Props: `label: string`, `title: string`, `meta?: string`.

### StatRow
Horizontal participation metric.
Structure: serif `statNumber` value → `label` name → percentile bar with 50% tick marker.
The single highest-percentile row on the screen uses `brandGreen`. All others use `textTertiary` fill.
Props: `value: string`, `label: string`, `percentile: number`, `isHighlight?: boolean`, `caption?: string`.

### VoteRow
Two-column vote record.
Left: serif `h3` bill title + `meta` date/context.
Right: `semanticAye` or `semanticNo` coloured text ("Aye"/"No") + `caption` context line.
Props: `title: string`, `date: string`, `vote: 'aye' | 'no'`, `context?: string`.

### Pullquote
Italic serif quotation from Hansard or official source.
Left border in `hairline` colour, 3px wide. Italic serif body text. `meta` attribution below.
Props: `text: string`, `source: string`, `sourceUrl?: string`.

### Divider
Hairline separator. `hairlineHeight` thickness, `hairline` colour. No margins — parent handles spacing.
Props: none.

### SectionHeading
Section title with optional right-aligned meta.
Serif `h2` left, `meta` right.
Props: `title: string`, `meta?: string`, `onMetaPress?: () => void`.

### Button
Two variants only.
- Primary: `textPrimary` background, `card` text, `buttonRadius`, full-width.
- Ghost: transparent background, `textPrimary` text, `softBorder` border, `buttonRadius`.
Props: `title: string`, `variant?: 'primary' | 'ghost'`, `onPress: () => void`, `compact?: boolean`.

### Badge
Tiny label pill. `caption` text, uppercase. No background unless semantic.
- Semantic variants: `aye` (green bg), `no` (red-brown bg), `warning` (amber bg).
- Default: no background, just `textTertiary` text.
Props: `label: string`, `variant?: 'default' | 'aye' | 'no' | 'warning'`.

### MethodologyFooter
Standard footer for any screen with calculated metrics.
`textQuiet` text: "Methodology v1.0 · Wilson 95% CI" with underlined "How we calculate" link.
Props: `version?: string`, `onPress?: () => void`.

### SourcesFooter
Standard footer for any screen with external data.
`textQuiet` text listing sources, last-updated timestamp, and "Report something wrong" link.
Props: `sources: string[]`, `lastUpdated?: string`, `onReport?: () => void`.

### EmptyState
Honest explanation of missing data. Never cheerful.
Structure: serif `h3` title → `body` explanation of WHY → `meta` note of what IS available.
Props: `title: string`, `explanation: string`, `available?: string`.

---

## 5. Layout patterns

### Detail screen vertical rhythm

```
[Compact nav: back chevron left, bookmark + share right]
[Hero: label → serif title → meta]
[CTA bar: max 2 buttons]
[Hairline]
[Primary data section]
[Hairline]
[Recent activity section]
[Hairline]
[Tertiary section or empty state]
[SourcesFooter]
```

### List screen pattern

```
[Serif H1 title + optional meta]
[Filter chips in sans — max 4]
[List of cards/rows separated by hairlines]
[EmptyState if no data]
```

### Card content pattern

```
[Caption label (uppercase, tertiary)]
[Serif H3 title]
[Meta line: date · count · context]
[Body text (2-3 lines max)]
```

---

## 6. Motion

1. Screen transitions: iOS native push/modal only. No custom transitions.
2. Button press: `transform: [{scale: 0.97}]`, 150ms ease-out.
3. Data loading: fade in at 200ms. No skeleton shimmer. Static neutral grey placeholder at 30% opacity.
4. Pull to refresh: iOS native only.
5. No spring animations. No bounces. No parallax.

---

## 7. Iconography

Use `lucide-react-native` exclusively. Stroke width 1.8. Default size 20.

Icons appear only on:
- Navigation (back, share, bookmark, tab bar)
- Input affordances (search, filter, clear)
- External link indicators

Icons never appear:
- As decoration inside cards
- Next to stat labels or headlines
- As section markers

Never mix icon libraries. Remove all Ionicons references when migrating.

---

## 8. Voice and tone

### Headlines
Factual, parliamentary register. No emojis. No exclamation marks.
- Yes: "Andrew Wilkie voted against party on housing bill"
- No: "Andrew Wilkie REBELS on housing! 🔥"

### Vote labels
Parliamentary language: "Aye" / "No", not "Voted Yes" / "Voted No".

### Meta captions
Parliamentary context: "with govt" / "against both" / "rebelled from crossbench"

### Empty states
State the fact. Name what exists. Never apologise cheerfully.
- Yes: "House members' interests are not yet published as structured data by the Parliament of Australia. Senate interests (1,753 records across 76 senators) are available."
- No: "No data yet! Check back soon 😊"

### Error messages
State the fact. State what the user can do. Never apologise in a cheerful voice.
- Yes: "Could not load voting data. Pull down to retry."
- No: "Oops! Something went wrong. We're working on it!"

---

## 9. Decision log

Decisions made during implementation that weren't in the original spec:

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | Created this document | Foundation for editorial redesign |
