import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSubscription(userId: string | undefined) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('user_preferences')
      .select('is_pro,pro_expires_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const active =
          !!data?.is_pro &&
          (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
        setIsPro(active);
        setLoading(false);
      });
  }, [userId]);

  const subscribe = async () => {
    if (!userId) return;
    await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        is_pro: true,
        pro_expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    setIsPro(true);
  };

  const restore = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('is_pro,pro_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const active =
      !!data?.is_pro &&
      (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
    setIsPro(active);
  };

  return { isPro, loading, subscribe, restore };
}
