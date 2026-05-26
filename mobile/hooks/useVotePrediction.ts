/**
 * The Mirror — guess-then-reveal for how your MP voted.
 * Prompt 10: stores guesses, reveals actual votes, tracks accuracy.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '../lib/storage';
import { useUser } from '../context/UserContext';

export interface VotePrediction {
  id: string;
  division_id: string;
  member_id: string;
  guess: 'aye' | 'no' | 'absent';
  actual_vote: string | null;
  was_correct: boolean | null;
  revealed_at: string | null;
  created_at: string;
}

export interface PredictionAccuracy {
  total: number;
  correct: number;
  rate: number | null; // percentage, null if no predictions yet
}

export function useVotePrediction(memberId: string | null) {
  const { user } = useUser();
  const [predictions, setPredictions] = useState<VotePrediction[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracy>({ total: 0, correct: 0, rate: null });
  const [loading, setLoading] = useState(false);

  // Load existing predictions for this member
  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId || cancelled) { setLoading(false); return; }

      const { data } = await supabase
        .from('vote_predictions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (!cancelled && data) {
        setPredictions(data as VotePrediction[]);
        const revealed = data.filter((p: any) => p.was_correct !== null);
        const correct = revealed.filter((p: any) => p.was_correct === true);
        setAccuracy({
          total: revealed.length,
          correct: correct.length,
          rate: revealed.length > 0 ? Math.round((correct.length / revealed.length) * 100) : null,
        });
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  // Submit a guess for a division
  const guess = useCallback(async (
    divisionId: string,
    guessValue: 'aye' | 'no' | 'absent',
  ): Promise<{ wasCorrect: boolean; actualVote: string } | null> => {
    if (!memberId) return null;
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) return null;

    // Look up actual vote from division_votes
    const { data: voteData } = await supabase
      .from('division_votes')
      .select('vote_cast')
      .eq('division_id', divisionId)
      .eq('member_id', memberId)
      .limit(1)
      .single();

    // Determine actual vote — if no record, they were absent
    const actualVote = voteData?.vote_cast ?? 'absent';
    const wasCorrect = guessValue === actualVote;

    // Upsert prediction with result
    const { data: inserted } = await supabase
      .from('vote_predictions')
      .upsert({
        device_id: deviceId,
        user_id: user?.id ?? null,
        division_id: divisionId,
        member_id: memberId,
        guess: guessValue,
        actual_vote: actualVote,
        was_correct: wasCorrect,
        revealed_at: new Date().toISOString(),
      }, { onConflict: 'device_id,division_id,member_id' })
      .select()
      .single();

    if (inserted) {
      setPredictions(prev => {
        const filtered = prev.filter(p => p.division_id !== divisionId);
        return [inserted as VotePrediction, ...filtered];
      });
      // Recalculate accuracy
      setAccuracy(prev => {
        const newTotal = prev.total + 1;
        const newCorrect = prev.correct + (wasCorrect ? 1 : 0);
        return { total: newTotal, correct: newCorrect, rate: Math.round((newCorrect / newTotal) * 100) };
      });
    }

    return { wasCorrect, actualVote };
  }, [memberId, user?.id]);

  // Check if user already guessed this division
  const hasGuessed = useCallback((divisionId: string): VotePrediction | null => {
    return predictions.find(p => p.division_id === divisionId) ?? null;
  }, [predictions]);

  return { predictions, accuracy, loading, guess, hasGuessed };
}

/**
 * Global accuracy across all MPs — for profile/stats display.
 */
export function useGlobalPredictionAccuracy() {
  const [accuracy, setAccuracy] = useState<PredictionAccuracy>({ total: 0, correct: 0, rate: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId || cancelled) { setLoading(false); return; }

      const { data } = await supabase
        .from('vote_predictions')
        .select('was_correct')
        .eq('device_id', deviceId)
        .not('was_correct', 'is', null);

      if (!cancelled && data) {
        const correct = data.filter((p: any) => p.was_correct === true);
        setAccuracy({
          total: data.length,
          correct: correct.length,
          rate: data.length > 0 ? Math.round((correct.length / data.length) * 100) : null,
        });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { accuracy, loading };
}
