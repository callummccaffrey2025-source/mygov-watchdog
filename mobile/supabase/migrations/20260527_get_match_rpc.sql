-- get_match RPC — computes Verity Match alignment between a user and an MP (+ party rankings)
-- get_match_votes RPC — returns contributing votes behind a specific issue for Show-your-working

CREATE OR REPLACE FUNCTION get_match(p_device_id text, p_member_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_stances jsonb;
  v_per_issue jsonb := '[]'::jsonb;
  v_total_weight numeric := 0;
  v_weighted_alignment numeric := 0;
  v_total_contributing_votes int := 0;
  v_biggest_gap jsonb := null;
  v_biggest_gap_score numeric := 999;
  v_party_alignment jsonb;
  v_overall_pct numeric;
  v_limited_data boolean := false;
  v_stance record;
  v_mp_lean_val numeric;
  v_mp_sample int;
  v_alignment_score numeric;
  v_alignment_state text;
  v_issues_scored int := 0;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'issue_id', uis.issue_id, 'stance', uis.stance, 'importance', uis.importance,
    'slug', pi.slug, 'name', pi.name
  ))
  INTO v_stances
  FROM user_issue_stances uis
  JOIN policy_issues pi ON pi.id = uis.issue_id
  WHERE uis.device_id = p_device_id AND uis.stance != 0;

  IF v_stances IS NULL THEN
    RETURN jsonb_build_object('error', 'no_stances', 'message', 'No issue stances found for this device');
  END IF;

  FOR v_stance IN SELECT * FROM jsonb_to_recordset(v_stances)
    AS x(issue_id uuid, stance int, importance int, slug text, name text)
  LOOP
    SELECT
      coalesce(sum(CASE
        WHEN dv.vote_cast = 'aye' AND dit.aye_supports = true THEN 1
        WHEN dv.vote_cast = 'aye' AND dit.aye_supports = false THEN -1
        WHEN dv.vote_cast = 'no' AND dit.aye_supports = true THEN -1
        WHEN dv.vote_cast = 'no' AND dit.aye_supports = false THEN 1
        ELSE 0 END), 0),
      count(*)
    INTO v_mp_lean_val, v_mp_sample
    FROM division_votes dv
    JOIN division_issue_tags dit ON dit.division_id = dv.division_id
      AND dit.issue_id = v_stance.issue_id AND dit.confidence >= 0.6
    WHERE dv.member_id = p_member_id;

    IF v_mp_sample < 3 THEN
      v_per_issue := v_per_issue || jsonb_build_object(
        'issue_slug', v_stance.slug, 'issue_name', v_stance.name,
        'user_stance', v_stance.stance, 'mp_lean', null, 'mp_sample', v_mp_sample,
        'alignment_state', 'insufficient_data', 'alignment_score', null);
      CONTINUE;
    END IF;

    v_total_contributing_votes := v_total_contributing_votes + v_mp_sample;
    v_mp_lean_val := v_mp_lean_val / v_mp_sample;
    v_alignment_score := (v_stance.stance::numeric * v_mp_lean_val + 1) / 2;

    IF v_alignment_score >= 0.65 THEN v_alignment_state := 'aligned';
    ELSIF v_alignment_score >= 0.4 THEN v_alignment_state := 'gap';
    ELSE v_alignment_state := 'big_gap'; END IF;

    IF v_alignment_score < v_biggest_gap_score THEN
      v_biggest_gap_score := v_alignment_score;
      v_biggest_gap := jsonb_build_object(
        'issue_slug', v_stance.slug, 'issue_name', v_stance.name,
        'user_stance', v_stance.stance, 'mp_lean', round(v_mp_lean_val::numeric, 3),
        'alignment_score', round(v_alignment_score::numeric, 3), 'mp_sample', v_mp_sample);
    END IF;

    v_total_weight := v_total_weight + v_stance.importance;
    v_weighted_alignment := v_weighted_alignment + (v_alignment_score * v_stance.importance);
    v_issues_scored := v_issues_scored + 1;

    v_per_issue := v_per_issue || jsonb_build_object(
      'issue_slug', v_stance.slug, 'issue_name', v_stance.name,
      'user_stance', v_stance.stance, 'mp_lean', round(v_mp_lean_val::numeric, 3),
      'mp_sample', v_mp_sample, 'alignment_state', v_alignment_state,
      'alignment_score', round(v_alignment_score::numeric, 3));
  END LOOP;

  IF v_total_contributing_votes < 8 OR v_total_weight = 0 THEN
    v_limited_data := true; v_overall_pct := null;
  ELSE
    v_overall_pct := round((v_weighted_alignment / v_total_weight * 100)::numeric, 1);
  END IF;

  SELECT jsonb_agg(party_row ORDER BY party_match DESC)
  INTO v_party_alignment
  FROM (
    SELECT p.id, p.name, p.short_name, p.abbreviation,
      round((sum(CASE WHEN sub.party_lean IS NOT NULL THEN
        ((uis.stance::numeric * sub.party_lean + 1) / 2) * uis.importance ELSE 0 END
      ) / NULLIF(sum(CASE WHEN sub.party_lean IS NOT NULL THEN uis.importance ELSE 0 END), 0) * 100)::numeric, 1) as party_match,
      jsonb_build_object(
        'party_id', p.id, 'party_name', p.name, 'short_name', p.short_name, 'abbreviation', p.abbreviation,
        'match_pct', round((sum(CASE WHEN sub.party_lean IS NOT NULL THEN
          ((uis.stance::numeric * sub.party_lean + 1) / 2) * uis.importance ELSE 0 END
        ) / NULLIF(sum(CASE WHEN sub.party_lean IS NOT NULL THEN uis.importance ELSE 0 END), 0) * 100)::numeric, 1),
        'issues_scored', count(CASE WHEN sub.party_lean IS NOT NULL THEN 1 END)
      ) as party_row
    FROM parties p
    CROSS JOIN user_issue_stances uis
    LEFT JOIN LATERAL (
      SELECT dit.issue_id,
        CASE WHEN count(*) >= 10 THEN
          sum(CASE WHEN dv.vote_cast = 'aye' AND dit.aye_supports = true THEN 1.0
            WHEN dv.vote_cast = 'aye' AND dit.aye_supports = false THEN -1.0
            WHEN dv.vote_cast = 'no' AND dit.aye_supports = true THEN -1.0
            WHEN dv.vote_cast = 'no' AND dit.aye_supports = false THEN 1.0 ELSE 0 END) / count(*)
        ELSE null END as party_lean
      FROM division_votes dv
      JOIN members m ON m.id = dv.member_id AND m.party_id = p.id
      JOIN division_issue_tags dit ON dit.division_id = dv.division_id
        AND dit.issue_id = uis.issue_id AND dit.confidence >= 0.6
      GROUP BY dit.issue_id
    ) sub ON true
    WHERE uis.device_id = p_device_id AND uis.stance != 0
      AND p.id IN (SELECT DISTINCT m2.party_id FROM members m2 WHERE m2.is_active = true AND m2.party_id IS NOT NULL)
    GROUP BY p.id, p.name, p.short_name, p.abbreviation
    HAVING count(CASE WHEN sub.party_lean IS NOT NULL THEN 1 END) >= 1
  ) ranked;

  RETURN jsonb_build_object(
    'overall_match_pct', v_overall_pct, 'limited_data', v_limited_data,
    'issues_scored', v_issues_scored, 'total_contributing_votes', v_total_contributing_votes,
    'per_issue', v_per_issue, 'biggest_gap', v_biggest_gap, 'party_alignment', v_party_alignment);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_match_votes(p_member_id uuid, p_issue_slug text)
RETURNS jsonb AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(vote_row ORDER BY vote_date DESC)
    FROM (
      SELECT DISTINCT ON (dv.division_id)
        jsonb_build_object(
          'division_id', dv.division_id, 'division_name', d.name,
          'division_date', d.date, 'vote_cast', dv.vote_cast,
          'aye_supports', dit.aye_supports,
          'vote_signal', CASE
            WHEN dv.vote_cast = 'aye' AND dit.aye_supports = true THEN 'support'
            WHEN dv.vote_cast = 'aye' AND dit.aye_supports = false THEN 'oppose'
            WHEN dv.vote_cast = 'no' AND dit.aye_supports = true THEN 'oppose'
            WHEN dv.vote_cast = 'no' AND dit.aye_supports = false THEN 'support'
            ELSE 'neutral' END,
          'confidence', dit.confidence, 'rationale', dit.rationale,
          'source_url', d.source_url
        ) as vote_row,
        d.date as vote_date
      FROM division_votes dv
      JOIN division_issue_tags dit ON dit.division_id = dv.division_id AND dit.confidence >= 0.6
      JOIN policy_issues pi ON pi.id = dit.issue_id AND pi.slug = p_issue_slug
      JOIN divisions d ON d.id = dv.division_id
      WHERE dv.member_id = p_member_id
      ORDER BY dv.division_id, d.date DESC
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
