import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface WeeklyPoll {
  id: string;
  question: string;
  description: string | null;
  options: string[];
  starts_at: string;
  ends_at: string;
}

export interface PollResults {
  national: number[];      // vote count per option
  electorate: number[];    // vote count per option for user's electorate
  total: number;
  electorateTotal: number;
}

export function useWeeklyPoll(postcode: string | null, electorate: string | null) {
  const { user } = useUser();
  const [poll, setPoll] = useState<WeeklyPoll | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current active poll
  useEffect(() => {
    const fetch = async () => {
      try {
        const now = new Date().toISOString();
        const { data } = await supabase
          .from('weekly_polls')
          .select('*')
          .lte('starts_at', now)
          .gte('ends_at', now)
          .order('starts_at', { ascending: false })
          .limit(1);

        const activePoll = data?.[0] as WeeklyPoll | undefined;
        if (activePoll) {
          setPoll(activePoll);

          // Check if user already voted
          if (user) {
            const { data: existingVote } = await supabase
              .from('weekly_poll_votes')
              .select('option_selected')
              .eq('poll_id', activePoll.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (existingVote) {
              setUserVote(existingVote.option_selected);
              await fetchResults(activePoll.id, activePoll.options.length, electorate);
            }
          }
        }
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  const fetchResults = async (pollId: string, optionCount: number, elec: string | null) => {
    try {
      // National results
      const { data: allVotes } = await supabase
        .from('weekly_poll_votes')
        .select('option_selected, electorate')
        .eq('poll_id', pollId);

      const national = Array(optionCount).fill(0);
      const electorateVotes = Array(optionCount).fill(0);

      for (const v of (allVotes || [])) {
        if (v.option_selected >= 0 && v.option_selected < optionCount) {
          national[v.option_selected]++;
          if (elec && v.electorate === elec) {
            electorateVotes[v.option_selected]++;
          }
        }
      }

      setResults({
        national,
        electorate: electorateVotes,
        total: national.reduce((a, b) => a + b, 0),
        electorateTotal: electorateVotes.reduce((a, b) => a + b, 0),
      });
    } catch {}
  };

  const vote = useCallback(async (optionIndex: number) => {
    if (!poll || !user || userVote !== null) return;

    // Optimistic update
    setUserVote(optionIndex);

    try {
      await supabase.from('weekly_poll_votes').insert({
        poll_id: poll.id,
        user_id: user.id,
        option_selected: optionIndex,
        postcode: postcode ?? null,
        electorate: electorate ?? null,
      });

      await fetchResults(poll.id, poll.options.length, electorate);
    } catch {
      setUserVote(null); // revert on failure
    }
  }, [poll, user, userVote, postcode, electorate]);

  return { poll, userVote, results, loading, vote };
}
