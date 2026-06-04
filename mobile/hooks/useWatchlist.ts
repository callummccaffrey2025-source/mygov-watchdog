import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import AsyncStorage from '../lib/storage';

export type WatchlistEntityType = 'member' | 'bill' | 'topic' | 'party';

export interface WatchlistItem {
  id: string;
  entity_type: WatchlistEntityType;
  entity_id: string;
  created_at: string;
  // Enriched fields
  label: string;
  subtitle: string;
  icon: string;
  activity: WatchlistActivity[];
  hasNewActivity: boolean;
}

export interface WatchlistActivity {
  id: string;
  type: 'vote' | 'status_change' | 'donation' | 'rebellion' | 'speech';
  title: string;
  detail: string;
  date: string;
  meta?: Record<string, any>;
}

export function useWatchlist() {
  const { user } = useUser();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!user && !deviceId) { setItems([]); setLoading(false); return; }

      // Get all follows
      let query = supabase
        .from('user_follows')
        .select('id, entity_type, entity_id, created_at')
        .order('created_at', { ascending: false });

      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = (query as any).eq('device_id', deviceId).is('user_id', null);
      }

      const { data: follows } = await (query as any);
      if (!follows || follows.length === 0) { setItems([]); setLoading(false); return; }

      // Group by entity type
      const memberIds = follows.filter((f: any) => f.entity_type === 'member').map((f: any) => f.entity_id);
      const billIds = follows.filter((f: any) => f.entity_type === 'bill').map((f: any) => f.entity_id);
      const topicNames = follows.filter((f: any) => f.entity_type === 'topic').map((f: any) => f.entity_id);
      const partyIds = follows.filter((f: any) => f.entity_type === 'party').map((f: any) => f.entity_id);

      // Fetch enrichment data in parallel
      const [members, bills, memberVotes, billStatuses, parties] = await Promise.all([
        memberIds.length > 0
          ? supabase.from('members').select('id, first_name, last_name, party:parties!members_party_id_fkey(short_name,colour), electorate:electorates!members_electorate_id_fkey(name)').in('id', memberIds).then(r => r.data || [])
          : Promise.resolve([]),
        billIds.length > 0
          ? supabase.from('bills').select('id, short_title, title, current_status, last_updated').in('id', billIds).then(r => r.data || [])
          : Promise.resolve([]),
        // Recent votes for followed members (last 14 days)
        memberIds.length > 0
          ? supabase.from('votes').select('id, member_id, vote_cast, created_at, division:divisions(id, name, date, chamber)').in('member_id', memberIds).order('created_at', { ascending: false }).limit(50).then(r => r.data || [])
          : Promise.resolve([]),
        // Bill status changes — use last_updated as proxy
        Promise.resolve([]),
        // Parties
        partyIds.length > 0
          ? supabase.from('parties').select('id, name, short_name, colour').in('id', partyIds).then(r => r.data || [])
          : Promise.resolve([]),
      ]);

      const memberMap = new Map((members as any[]).map(m => [m.id, m]));
      const billMap = new Map((bills as any[]).map(b => [b.id, b]));
      const partyMap = new Map((parties as any[]).map(p => [p.id, p]));

      // Get last-seen timestamps from local storage
      const lastSeenRaw = await AsyncStorage.getItem('watchlist_last_seen');
      const lastSeen: Record<string, string> = lastSeenRaw ? JSON.parse(lastSeenRaw) : {};

      // Build enriched items
      const enriched: WatchlistItem[] = follows.map((f: any) => {
        const lastSeenDate = lastSeen[`${f.entity_type}:${f.entity_id}`] || f.created_at;

        if (f.entity_type === 'member') {
          const m = memberMap.get(f.entity_id);
          const votes = (memberVotes as any[])
            .filter(v => v.member_id === f.entity_id && v.division)
            .slice(0, 5)
            .map(v => ({
              id: v.id,
              type: 'vote' as const,
              title: `Voted ${v.vote_cast === 'aye' ? 'Aye' : 'No'}`,
              detail: v.division?.name?.replace(/^[A-Za-z\s]+\s*[—–]\s*/i, '').trim() || 'Division',
              date: v.division?.date || v.created_at,
            }));

          const hasNewActivity = votes.some(v => new Date(v.date) > new Date(lastSeenDate));

          return {
            id: f.id,
            entity_type: f.entity_type,
            entity_id: f.entity_id,
            created_at: f.created_at,
            label: m ? `${m.first_name} ${m.last_name}` : 'Unknown MP',
            subtitle: m ? `${m.party?.short_name || ''} · ${m.electorate?.name || ''}` : '',
            icon: 'person',
            activity: votes,
            hasNewActivity,
          };
        }

        if (f.entity_type === 'bill') {
          const b = billMap.get(f.entity_id);
          const activity: WatchlistActivity[] = [];
          if (b?.last_updated && b.current_status) {
            activity.push({
              id: `status-${b.id}`,
              type: 'status_change',
              title: `Status: ${b.current_status}`,
              detail: b.short_title || b.title || 'Bill',
              date: b.last_updated,
            });
          }
          const hasNewActivity = activity.some(a => new Date(a.date) > new Date(lastSeenDate));

          return {
            id: f.id,
            entity_type: f.entity_type,
            entity_id: f.entity_id,
            created_at: f.created_at,
            label: b?.short_title || b?.title || 'Unknown Bill',
            subtitle: b?.current_status || 'Tracking',
            icon: 'document-text',
            activity,
            hasNewActivity,
          };
        }

        if (f.entity_type === 'party') {
          const p = partyMap.get(f.entity_id);
          return {
            id: f.id,
            entity_type: f.entity_type,
            entity_id: f.entity_id,
            created_at: f.created_at,
            label: p?.name || 'Unknown Party',
            subtitle: p?.short_name || 'Party',
            icon: 'flag',
            activity: [],
            hasNewActivity: false,
          };
        }

        // Topic
        return {
          id: f.id,
          entity_type: f.entity_type,
          entity_id: f.entity_id,
          created_at: f.created_at,
          label: f.entity_id,
          subtitle: 'Topic',
          icon: 'pricetag',
          activity: [],
          hasNewActivity: false,
        };
      });

      setItems(enriched);
    } catch {
      // non-critical
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const markSeen = useCallback(async (entityType: string, entityId: string) => {
    const lastSeenRaw = await AsyncStorage.getItem('watchlist_last_seen');
    const lastSeen: Record<string, string> = lastSeenRaw ? JSON.parse(lastSeenRaw) : {};
    lastSeen[`${entityType}:${entityId}`] = new Date().toISOString();
    await AsyncStorage.setItem('watchlist_last_seen', JSON.stringify(lastSeen));
  }, []);

  return { items, loading, refresh: fetch, markSeen };
}
