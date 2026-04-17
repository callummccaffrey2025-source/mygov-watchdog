import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface CivicQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  source_url: string | null;
  category: string | null;
}

export interface QuizStats {
  correct_pct: number;
  total_answers: number;
}

export function useCivicQuiz() {
  const { user } = useUser();
  const [question, setQuestion] = useState<CivicQuizQuestion | null>(null);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        // Check if user has dismissed today's quiz
        const dismissKey = `quiz_dismissed_${today}`;
        const dismissedLocal = await AsyncStorage.getItem(dismissKey);
        if (dismissedLocal) {
          setDismissed(true);
          setLoading(false);
          return;
        }

        // Pick today's question deterministically (same for all users per day)
        // Using a hash of the date modulo total count
        const { data: allQuestions } = await supabase
          .from('civic_quiz')
          .select('id,question,options,correct_answer,explanation,source_url,category')
          .order('created_at', { ascending: true });

        if (!allQuestions?.length) {
          setLoading(false);
          return;
        }

        // Deterministic daily pick: days-since-epoch mod question count
        const daysSinceEpoch = Math.floor(Date.now() / 86400000);
        const picked = allQuestions[daysSinceEpoch % allQuestions.length] as CivicQuizQuestion;
        setQuestion(picked);

        // Check if user already answered this question today
        if (user) {
          const { data: existingAnswer } = await supabase
            .from('civic_quiz_answers')
            .select('id')
            .eq('user_id', user.id)
            .eq('question_id', picked.id)
            .limit(1);
          if (existingAnswer?.length) setAlreadyAnswered(true);
        } else {
          // For anonymous, check AsyncStorage
          const answeredKey = `quiz_answered_${picked.id}`;
          const answeredLocal = await AsyncStorage.getItem(answeredKey);
          if (answeredLocal) setAlreadyAnswered(true);
        }
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  const submitAnswer = async (optionIndex: number): Promise<QuizStats> => {
    if (!question) return { correct_pct: 0, total_answers: 0 };

    // Mark as answered locally
    AsyncStorage.setItem(`quiz_answered_${question.id}`, String(optionIndex)).catch(() => {});

    // Record answer
    if (user) {
      supabase.from('civic_quiz_answers').insert({
        user_id: user.id,
        question_id: question.id,
        answer: optionIndex,
        is_correct: optionIndex === question.correct_answer,
      }).then(() => {});
    }

    // Fetch stats (how many got it right)
    try {
      const { data: answers } = await supabase
        .from('civic_quiz_answers')
        .select('is_correct')
        .eq('question_id', question.id);
      const total = answers?.length ?? 0;
      const correct = answers?.filter(a => a.is_correct).length ?? 0;
      return {
        total_answers: total,
        correct_pct: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    } catch {
      return { total_answers: 0, correct_pct: 0 };
    }
  };

  const dismiss = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(`quiz_dismissed_${today}`, '1');
    setDismissed(true);
  };

  return { question, alreadyAnswered, dismissed, loading, submitAnswer, dismiss };
}
