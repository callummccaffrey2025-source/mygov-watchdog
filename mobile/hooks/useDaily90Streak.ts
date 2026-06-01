import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';

const STREAK_KEY = 'daily90_streak';
const LAST_DATE_KEY = 'daily90_last_date';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDaily90Streak() {
  const [streak, setStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedStreak, lastDate] = await Promise.all([
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(LAST_DATE_KEY),
      ]);

      const today = todayStr();
      const s = parseInt(storedStreak ?? '0', 10);

      if (lastDate === today) {
        setStreak(s);
        setCompletedToday(true);
      } else {
        // Check if yesterday was the last completion (streak continues)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);

        if (lastDate === yStr) {
          setStreak(s); // streak intact, not yet completed today
        } else {
          setStreak(0); // streak broken
          await AsyncStorage.setItem(STREAK_KEY, '0');
        }
        setCompletedToday(false);
      }
    })();
  }, []);

  const markComplete = useCallback(async () => {
    const today = todayStr();
    const lastDate = await AsyncStorage.getItem(LAST_DATE_KEY);

    if (lastDate === today) return; // already completed today

    const newStreak = streak + 1;
    setStreak(newStreak);
    setCompletedToday(true);

    await Promise.all([
      AsyncStorage.setItem(STREAK_KEY, String(newStreak)),
      AsyncStorage.setItem(LAST_DATE_KEY, today),
    ]);
  }, [streak]);

  return { streak, completedToday, markComplete };
}
