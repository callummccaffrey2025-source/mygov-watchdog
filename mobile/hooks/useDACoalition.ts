import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface Coalition {
  id: string;
  da_id: string;
  name: string;
  member_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CoalitionMessage {
  id: string;
  coalition_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export function useDACoalition(daId: string | undefined) {
  const { user } = useUser();
  const [coalition, setCoalition] = useState<Coalition | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [messages, setMessages] = useState<CoalitionMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!daId) { setLoading(false); return; }
    try {
      // Get coalition for this DA
      const { data: coalData } = await supabase
        .from('da_coalitions')
        .select('*')
        .eq('da_id', daId)
        .maybeSingle();

      if (coalData) {
        setCoalition(coalData as Coalition);

        // Check membership
        if (user) {
          const { data: memData } = await supabase
            .from('da_coalition_members')
            .select('id')
            .eq('coalition_id', coalData.id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsMember(!!memData);
        }

        // Fetch messages if member
        if (user) {
          const { data: msgData } = await supabase
            .from('da_coalition_messages')
            .select('*')
            .eq('coalition_id', coalData.id)
            .order('created_at', { ascending: true })
            .limit(100);
          setMessages((msgData as CoalitionMessage[]) || []);
        }
      }
    } catch {}
    setLoading(false);
  }, [daId, user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const join = useCallback(async () => {
    if (!user || !coalition) return false;
    const { error } = await supabase
      .from('da_coalition_members')
      .insert({ coalition_id: coalition.id, user_id: user.id });
    if (!error) { setIsMember(true); fetch(); return true; }
    return false;
  }, [user?.id, coalition?.id, fetch]);

  const leave = useCallback(async () => {
    if (!user || !coalition) return;
    await supabase
      .from('da_coalition_members')
      .delete()
      .eq('coalition_id', coalition.id)
      .eq('user_id', user.id);
    setIsMember(false);
    fetch();
  }, [user?.id, coalition?.id, fetch]);

  const sendMessage = useCallback(async (body: string) => {
    if (!user || !coalition || !body.trim()) return;
    const { data } = await supabase
      .from('da_coalition_messages')
      .insert({ coalition_id: coalition.id, user_id: user.id, body: body.trim() })
      .select()
      .single();
    if (data) setMessages(prev => [...prev, data as CoalitionMessage]);
  }, [user?.id, coalition?.id]);

  return { coalition, isMember, messages, loading, join, leave, sendMessage, refresh: fetch };
}
