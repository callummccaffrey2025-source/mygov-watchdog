# Plan: Representation Gap

## Context

Show whether a user's MP votes the way their electorate's Verity voters lean,
by joining daily poll results against the MP's division_votes record. The
alignment direction (aligned / misaligned / mixed / no comparable vote)
matters more than any numeric score.

**Critical data state:** As of today, `daily_poll_responses` has 0 rows and
`daily_polls` has 0 published polls. The daily poll Edge Function exists but
hasn't been producing polls. This means the feature must be designed to handle
the cold-start gracefully -- showing "no poll data yet" without breaking the
UI -- while being ready to light up when users start voting in daily polls.

## Non-Negotiable Rules (enforced throughout)

1. **Neutrality is the moat.** Alignment and misalignment get identical visual
   treatment. No editorial language. Just the electorate number, the vote
   record, and a neutral indicator.

2. **Honesty about who voted.** Always "Verity voters in [electorate]", never
   "[electorate]". Show sample size. Minimum threshold: 10 responses per
   electorate-poll to show electorate-level data; below that, degrade to
   state or national aggregate with a label explaining why.

## Architecture

### New table: `poll_division_links`

Maps each daily poll to the specific division(s) that correspond to it.
**Never auto-matched.** Manual curation now; AI-suggested-human-approved later.

```sql
CREATE TABLE poll_division_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES daily_polls(id) ON DELETE CASCADE,
  division_id text NOT NULL REFERENCES divisions(id),
  match_confidence text DEFAULT 'manual',  -- 'manual' | 'ai_suggested' | 'ai_approved'
  match_reason text,  -- human-readable reason for the link
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, division_id)
);
```

### New view: `representation_alignment`

Computes alignment per member per linked poll-division pair:

```sql
CREATE VIEW representation_alignment AS
SELECT
  pdl.poll_id,
  pdl.division_id,
  dv.member_id,
  m.electorate_id,
  dv.vote_cast,
  dp.question,
  dp.option_a_text,
  dp.option_b_text,
  -- Poll results at electorate level
  e_results.electorate_majority_option,
  e_results.electorate_majority_pct,
  e_results.electorate_response_count,
  -- Poll results at national level (fallback)
  n_results.national_majority_option,
  n_results.national_majority_pct,
  n_results.national_response_count,
  -- Alignment classification
  CASE
    WHEN e_results.electorate_response_count >= 10 THEN
      CASE
        WHEN (e_results.electorate_majority_option = 'a' AND dv.vote_cast = 'aye')
          OR (e_results.electorate_majority_option = 'b' AND dv.vote_cast = 'no')
        THEN 'aligned'
        WHEN dv.vote_cast IN ('absent', 'abstain') THEN 'absent'
        ELSE 'misaligned'
      END
    WHEN n_results.national_response_count >= 10 THEN
      CASE
        WHEN (n_results.national_majority_option = 'a' AND dv.vote_cast = 'aye')
          OR (n_results.national_majority_option = 'b' AND dv.vote_cast = 'no')
        THEN 'aligned'
        WHEN dv.vote_cast IN ('absent', 'abstain') THEN 'absent'
        ELSE 'misaligned'
      END
    ELSE 'insufficient_data'
  END AS alignment,
  CASE
    WHEN e_results.electorate_response_count >= 10 THEN 'electorate'
    WHEN n_results.national_response_count >= 10 THEN 'national'
    ELSE 'none'
  END AS data_level
FROM poll_division_links pdl
JOIN division_votes dv ON dv.division_id = pdl.division_id
JOIN members m ON m.id = dv.member_id
JOIN daily_polls dp ON dp.id = pdl.poll_id
LEFT JOIN LATERAL (
  SELECT
    CASE WHEN SUM(CASE WHEN pr.option_chosen = 'a' THEN 1 ELSE 0 END) >
              SUM(CASE WHEN pr.option_chosen = 'b' THEN 1 ELSE 0 END)
         THEN 'a' ELSE 'b' END AS electorate_majority_option,
    ROUND(100.0 * GREATEST(
      SUM(CASE WHEN pr.option_chosen = 'a' THEN 1 ELSE 0 END),
      SUM(CASE WHEN pr.option_chosen = 'b' THEN 1 ELSE 0 END)
    ) / NULLIF(COUNT(*) FILTER (WHERE pr.option_chosen IN ('a','b')), 0), 1) AS electorate_majority_pct,
    COUNT(*) FILTER (WHERE pr.option_chosen IN ('a','b')) AS electorate_response_count
  FROM daily_poll_responses pr
  JOIN members voter_m ON voter_m.id = pr.user_id
  WHERE pr.poll_id = pdl.poll_id
    AND voter_m.electorate_id = m.electorate_id
) e_results ON TRUE
LEFT JOIN LATERAL (
  SELECT
    CASE WHEN SUM(CASE WHEN pr.option_chosen = 'a' THEN 1 ELSE 0 END) >
              SUM(CASE WHEN pr.option_chosen = 'b' THEN 1 ELSE 0 END)
         THEN 'a' ELSE 'b' END AS national_majority_option,
    ROUND(100.0 * GREATEST(
      SUM(CASE WHEN pr.option_chosen = 'a' THEN 1 ELSE 0 END),
      SUM(CASE WHEN pr.option_chosen = 'b' THEN 1 ELSE 0 END)
    ) / NULLIF(COUNT(*) FILTER (WHERE pr.option_chosen IN ('a','b')), 0), 1) AS national_majority_pct,
    COUNT(*) FILTER (WHERE pr.option_chosen IN ('a','b')) AS national_response_count
  FROM daily_poll_responses pr
  WHERE pr.poll_id = pdl.poll_id
) n_results ON TRUE
WHERE m.is_active = true;
```

**Note:** The electorate join assumes `daily_poll_responses.user_id` links to
a user who has an electorate set. If users don't have electorates set, the
electorate-level data will be empty and the view degrades to national. This
is correct behavior.

### Alignment mapping: poll option -> division vote

The `poll_division_links` table stores the link, but we also need to know
which poll option (a or b) corresponds to which vote direction (aye or no).
Add columns:

```sql
ALTER TABLE poll_division_links
  ADD COLUMN option_a_means text DEFAULT 'aye',  -- 'aye' | 'no'
  ADD COLUMN option_b_means text DEFAULT 'no';
```

This makes the alignment check explicit: if option_a_means = 'aye' and the MP
voted 'aye', they're aligned with option A voters.

### Minimum sample threshold

- **10 responses** per electorate-poll to show electorate-level ("Verity voters in Bennelong")
- **Below 10:** degrade to national aggregate ("Verity voters nationally")
- **Below 10 nationally:** show "Not enough responses yet" -- never force a comparison

### How new polls get linked

**v1 (now):** Manual. Admin seeds `poll_division_links` rows via SQL or a
simple admin script. Each row maps a poll_id to a division_id with a
human-readable match_reason.

**v2 (later):** AI-suggested. When a new daily poll is generated, an Edge
Function suggests matching divisions based on bill_title similarity to
poll question. These get `match_confidence = 'ai_suggested'` and are NOT
shown until a human changes it to `'ai_approved'` or `'manual'`.

## Surface Decision (resolved)

**MP Profile Votes tab.** Card after the stats bar, before the individual
vote list. Title: "How [first_name] votes vs. Verity voters in [electorate]".
Poll Results screen is a v2 addition.

## UI Design (MP Profile card, DESIGN.md compliant)

Card sits in the Votes tab. DESIGN.md: bg card, borderRadius 14, shadow sm,
padding 16, no borders.

```
┌─────────────────────────────────────────────┐
│  SECTION LABEL: "REPRESENTATION"            │
│                                             │
│  How Jerome votes vs. Verity voters         │
│  in Bennelong                               │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Climate Change Bill 2022                ││
│  │                                         ││
│  │  Jerome voted    AYE                    ││
│  │  Verity voters   68% in favour (n=42)   ││
│  │                                         ││
│  │  ● Aligned                              ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Migration Bill 2025                     ││
│  │                                         ││
│  │  Jerome voted    NO                     ││
│  │  Verity voters   71% in favour (n=38)   ││
│  │                                         ││
│  │  ● Misaligned                           ││
│  └─────────────────────────────────────────┘│
│                                             │
│  Caption: Based on Verity daily poll        │
│  responses, not a representative sample     │
│  of the electorate. n = Verity voters.      │
│                                             │
└─────────────────────────────────────────────┘
```

**Alignment indicator colors (identical visual weight):**
- Aligned: `#00843D` (Verity green) with filled circle
- Misaligned: `#6C757D` (Neutral gray) with filled circle
- Absent: `#6C757D` (Neutral gray, italic "Absent from division")
- No comparable vote: `#6C757D` ("No directly comparable vote on record")

**NOT red for misalignment.** Red = No/Fail in DESIGN.md semantic colors.
Using it for misalignment would editorialize. Gray keeps both states neutral.

**Degraded states:**
1. **No linked polls:** Card hidden entirely (no "coming soon")
2. **Linked polls but 0 responses:** Card hidden
3. **Linked polls, <10 electorate responses:** Show with national data,
   label: "Based on [n] Verity voters nationally (not enough local data yet)"
4. **No comparable division for a poll:** Show "No directly comparable
   parliamentary vote on record" for that specific poll
5. **MP was absent:** Show "Absent from this division"

## Files to Modify

1. **Supabase migration (dev branch first):**
   - Create `poll_division_links` table
   - Create `representation_alignment` view
   - Add RLS policies

2. **`hooks/useRepresentationGap.ts`** (new file):
   - Query `representation_alignment` view for a given member_id
   - Return: alignment data, loading state
   - Handle empty/degraded states

3. **`screens/MemberProfileScreen.tsx`:**
   - Import and render RepresentationGapCard in Votes tab
   - Position after stats bar, before vote list

4. **`components/RepresentationGapCard.tsx`** (new file):
   - Renders the alignment card with neutral styling
   - Handles all degraded states
   - Shows disclaimer caption

## Verification

1. `npx tsc --noEmit` -- zero errors
2. Apply migration to dev branch (azvwzfsnzopeyzxzexto), NOT prod
3. Seed 1 test `poll_division_links` row linking a real daily poll to one of
   Laxale's divisions (once a daily poll exists)
4. Open MemberProfileScreen for Jerome Laxale in Expo Go
5. Verify: card shows with correct alignment, sample size, disclaimer
6. Verify: card hidden when no linked polls exist
7. Verify: national fallback when electorate sample < 10
