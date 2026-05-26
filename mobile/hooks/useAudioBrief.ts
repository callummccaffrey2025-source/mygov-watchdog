import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from './useElectorateByPostcode';

export interface AudioBriefData {
  date: string;
  sections: AudioBriefSection[];
  totalDurationEstimate: number; // seconds
  script: string; // full script for TTS
}

export interface AudioBriefSection {
  id: string;
  label: string;
  text: string;
}

/**
 * Fetches today's daily brief data and builds a spoken script for TTS.
 *
 * MVP: on-device TTS via expo-speech (zero cost, works offline).
 * Upgrade path: server-side TTS (ElevenLabs/OpenAI) stored as audio_url in daily_briefs.
 */
export function useAudioBrief() {
  const { postcode } = useUser();
  const { electorate, member } = useElectorateByPostcode(postcode);
  const [brief, setBrief] = useState<AudioBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const speechRef = useRef<{ stop: () => void } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Try electorate-specific brief first, fall back to national
      let briefRow: any = null;

      if (electorate?.name) {
        const { data } = await supabase
          .from('daily_briefs')
          .select('date, ai_text, electorate')
          .eq('date', today)
          .eq('electorate', electorate.name)
          .maybeSingle();
        briefRow = data;
      }

      if (!briefRow) {
        const { data } = await supabase
          .from('daily_briefs')
          .select('date, ai_text, electorate')
          .eq('electorate', '__national__')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        briefRow = data;
      }

      if (!briefRow?.ai_text) {
        setBrief(null);
        setLoading(false);
        return;
      }

      const ai = briefRow.ai_text;
      const sections: AudioBriefSection[] = [];

      // Build sections from the brief structure
      if (ai.what_happened?.length) {
        sections.push({
          id: 'headlines',
          label: 'What happened',
          text: ai.what_happened.join('. '),
        });
      }

      if (ai.what_it_means) {
        sections.push({
          id: 'analysis',
          label: 'What it means',
          text: ai.what_it_means,
        });
      }

      if (ai.one_thing_to_know) {
        sections.push({
          id: 'takeaway',
          label: 'One thing to know',
          text: ai.one_thing_to_know,
        });
      }

      // Build the spoken script
      const mpName = member ? `${member.first_name} ${member.last_name}` : null;
      const dayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' });
      const monthDay = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });

      const scriptParts: string[] = [];

      // Intro
      scriptParts.push(`Good morning. Here's your Verity brief for ${dayName}, ${monthDay}.`);

      // Headlines
      if (ai.what_happened?.length) {
        scriptParts.push('Here\'s what happened.');
        for (const item of ai.what_happened) {
          scriptParts.push(item);
        }
      }

      // Analysis
      if (ai.what_it_means) {
        scriptParts.push('What it means for you.');
        scriptParts.push(ai.what_it_means);
      }

      // MP context
      if (mpName && electorate?.name) {
        scriptParts.push(`That's your brief from ${electorate.name}. Your MP is ${mpName}.`);
      }

      // Takeaway
      if (ai.one_thing_to_know) {
        scriptParts.push('One thing to know.');
        scriptParts.push(ai.one_thing_to_know);
      }

      // Sign-off
      scriptParts.push('That\'s your Verity brief. Have a good day.');

      const script = scriptParts.join(' ');

      // Rough estimate: ~150 words per minute for TTS
      const wordCount = script.split(/\s+/).length;
      const durationEstimate = Math.ceil((wordCount / 150) * 60);

      setBrief({
        date: briefRow.date,
        sections,
        totalDurationEstimate: durationEstimate,
        script,
      });
    } catch {
      // non-critical
    }
    setLoading(false);
  }, [electorate?.name, member?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const play = useCallback(async () => {
    if (!brief?.script) return;

    try {
      // Dynamic import — expo-speech may not be installed yet
      const Speech = await import('expo-speech');

      setPlaying(true);
      setProgress(0);

      // Estimate progress based on time
      const startTime = Date.now();
      const duration = brief.totalDurationEstimate * 1000;
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(elapsed / duration, 1);
        setProgress(p);
        if (p >= 1) clearInterval(interval);
      }, 500);

      Speech.speak(brief.script, {
        language: 'en-AU',
        rate: 0.95,
        pitch: 1.0,
        onDone: () => {
          clearInterval(interval);
          setPlaying(false);
          setProgress(1);
        },
        onStopped: () => {
          clearInterval(interval);
          setPlaying(false);
        },
        onError: () => {
          clearInterval(interval);
          setPlaying(false);
        },
      });

      speechRef.current = { stop: () => { Speech.stop(); clearInterval(interval); } };
    } catch {
      setPlaying(false);
    }
  }, [brief]);

  const stop = useCallback(() => {
    speechRef.current?.stop();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else play();
  }, [playing, play, stop]);

  return { brief, loading, playing, progress, toggle, refresh: fetch };
}
