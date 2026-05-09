import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { hapticLight } from '../lib/haptics';

export type SaveContentType = 'news_story' | 'bill' | 'vote' | 'post';

export interface SavedItem {
  id: string;
  content_type: string;
  content_id: string;
  created_at: string;
}

// ── Single-item save toggle ──────────────────────────────────────────────────

export function useSave(contentType: SaveContentType, contentId: string) {
  const { user } = useUser();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setLoading(true);
      try {
        const deviceId = await AsyncStorage.getItem('device_id');

        let query = supabase
          .from('user_saves')
          .select('id')
          .eq('content_type', contentType)
          .eq('content_id', contentId);

        if (user) {
          query = query.eq('user_id', user.id);
        } else if (deviceId) {
          query = (query as any).eq('device_id', deviceId).is('user_id', null);
        } else {
          if (!cancelled) { setSaved(false); setLoading(false); }
          return;
        }

        const { data } = await (query as any).maybeSingle();
        if (!cancelled) setSaved(!!data);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [contentType, contentId, user?.id]);

  const toggle = async () => {
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!user && !deviceId) return;

    const next = !saved;
    setSaved(next); // optimistic
    hapticLight();

    try {
      if (!next) {
        // Remove
        let query = supabase
          .from('user_saves')
          .delete()
          .eq('content_type', contentType)
          .eq('content_id', contentId);

        if (user) {
          query = query.eq('user_id', user.id);
        } else {
          query = (query as any).eq('device_id', deviceId!);
        }
        const { error } = await (query as any);
        if (error) setSaved(!next);
      } else {
        // Add
        const { error } = await supabase.from('user_saves').insert({
          user_id: user?.id ?? null,
          device_id: deviceId ?? null,
          content_type: contentType,
          content_id: contentId,
        });
        if (error) setSaved(!next);
      }
    } catch {
      setSaved(!next); // revert on error
    }
  };

  return { saved, loading, toggle };
}

// ── List of saved items ──────────────────────────────────────────────────────

export function useSavedItems(contentType?: SaveContentType) {
  const { user } = useUser();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await AsyncStorage.getItem('device_id');

      let query = supabase
        .from('user_saves')
        .select('id, content_type, content_id, created_at')
        .order('created_at', { ascending: false });

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      if (user) {
        query = query.eq('user_id', user.id);
      } else if (deviceId) {
        query = (query as any).eq('device_id', deviceId).is('user_id', null);
      } else {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data, error } = await (query as any);
      if (!error && data) {
        setItems(data as SavedItem[]);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [contentType, user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { items, loading, refresh: fetch };
}
