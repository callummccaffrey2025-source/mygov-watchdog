import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppNotification {
  id: string;
  notification_type: string; // 'mp_vote' | 'bill_update' | 'mp_post' | 'topic_news' | 'daily_brief' | 'community_reply'
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await AsyncStorage.getItem('device_id');

      let query = supabase
        .from('user_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (user?.id) {
        query = query.eq('user_id', user.id);
      } else if (deviceId) {
        query = query.eq('device_id', deviceId);
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useNotifications] fetch error:', error.message);
        setLoading(false);
        return;
      }

      const items: AppNotification[] = (data ?? []).map((row: any) => ({
        id: row.id,
        notification_type: row.notification_type,
        title: row.title,
        body: row.body ?? null,
        data: row.data ?? null,
        is_read: !!row.is_read,
        created_at: row.created_at,
      }));

      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('[useNotifications] unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('[useNotifications] markRead error:', error.message);
        // Revert on failure
        fetchNotifications();
      }
    },
    [fetchNotifications]
  );

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('[useNotifications] markAllRead error:', error.message);
      fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refresh: fetchNotifications,
  };
}
