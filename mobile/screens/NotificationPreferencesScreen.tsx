import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';

interface Prefs {
  new_bills: boolean;
  mp_votes: boolean;
  election_updates: boolean;
  local_announcements: boolean;
  daily_brief: boolean;
  breaking_news: boolean;
  weekly_summary: boolean;
  email_digest_enabled: boolean;
}

const DEFAULT_PREFS: Prefs = {
  new_bills: true,
  mp_votes: true,
  election_updates: true,
  local_announcements: true,
  daily_brief: true,
  breaking_news: true,
  weekly_summary: false,
  email_digest_enabled: true,
};

const PREF_ITEMS: { key: keyof Prefs; label: string; desc: string; icon: string }[] = [
  { key: 'daily_brief',        label: 'Daily Brief',             desc: 'Your morning parliamentary summary',       icon: 'newspaper-outline' },
  { key: 'new_bills',          label: 'New Bills in Parliament', desc: 'When significant bills are introduced',    icon: 'document-text-outline' },
  { key: 'mp_votes',           label: 'Your MP Voted',          desc: 'When your local MP votes on a bill',       icon: 'checkmark-done-outline' },
  { key: 'breaking_news',      label: 'Breaking Political News', desc: 'Major political stories as they happen',   icon: 'flash-outline' },
  { key: 'election_updates',   label: 'Election Updates',        desc: 'Election dates, calls, and results',       icon: 'flag-outline' },
  { key: 'local_announcements',label: 'Local Announcements',     desc: 'Funding and projects in your area',        icon: 'location-outline' },
  { key: 'weekly_summary',     label: 'Weekly Summary',          desc: 'A wrap-up of the week in parliament',      icon: 'calendar-outline' },
  { key: 'email_digest_enabled', label: 'Weekly Email Digest',   desc: 'Your personal weekly briefing sent every Sunday', icon: 'mail-outline' },
];

export function NotificationPreferencesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useUser();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
      } catch {
        setPermissionStatus('undetermined');
      }

      if (user) {
        const { data } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setPrefs({
            new_bills:            data.new_bills            ?? true,
            mp_votes:             data.mp_votes             ?? true,
            election_updates:     data.election_updates     ?? true,
            local_announcements:  data.local_announcements  ?? true,
            daily_brief:          data.daily_brief          ?? true,
            breaking_news:        data.breaking_news        ?? true,
            weekly_summary:       data.weekly_summary       ?? false,
            email_digest_enabled: data.email_digest_enabled ?? true,
          });
        }
      }
      setLoading(false);
    };
    run();
  }, [user?.id]);

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);

      if (status === 'granted' && user && !isExpoGo) {
        const tokenData = await Notifications.getExpoPushTokenAsync();

        // Resolve postcode → electorate → member_id for targeting
        let postcode: string | null = null;
        let electorate: string | null = null;
        let memberId: string | null = null;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('postcode')
          .eq('id', user.id)
          .maybeSingle();
        postcode = profile?.postcode ?? null;

        if (postcode) {
          const { data: electorates } = await supabase
            .from('electorates')
            .select('id, name')
            .contains('postcodes', [postcode])
            .eq('level', 'federal')
            .limit(1);
          const elec = electorates?.[0] ?? null;
          if (elec) {
            electorate = elec.name;
            const { data: members } = await supabase
              .from('members')
              .select('id')
              .eq('electorate_id', elec.id)
              .eq('chamber', 'house')
              .eq('is_active', true)
              .limit(1);
            memberId = members?.[0]?.id ?? null;
          }
        }

        await supabase.from('push_tokens').upsert(
          {
            user_id: user.id,
            token: tokenData.data,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            postcode,
            electorate,
            member_id: memberId,
          },
          { onConflict: 'token' },
        );
      }
    } catch {
      // Best-effort; not critical
    }
  };

  const savePref = async (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    if (!user) return;
    setSaving(true);
    await supabase.from('notification_preferences').upsert(
      { user_id: user.id, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    setSaving(false);
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.signedOut}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
          <Text style={[styles.signedOutTitle, { color: colors.text }]}>Sign in required</Text>
          <Text style={[styles.signedOutBody, { color: colors.textBody }]}>Sign in to save your notification preferences.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>

        {loading ? (
          <ActivityIndicator color="#00843D" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Permission status */}
            {permissionStatus !== 'granted' && (
              <View style={[styles.permissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="notifications-outline" size={24} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.permissionTitle, { color: colors.text }]}>Enable Notifications</Text>
                  <Text style={[styles.permissionBody, { color: colors.textBody }]}>
                    Allow Verity to send you updates about parliament, your MP, and local announcements.
                  </Text>
                </View>
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Enable</Text>
                </Pressable>
              </View>
            )}

            {permissionStatus === 'granted' && (
              <View style={styles.grantedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#00843D" />
                <Text style={styles.grantedText}>Notifications enabled</Text>
                {saving && <ActivityIndicator size="small" color="#9aabb8" style={{ marginLeft: 8 }} />}
              </View>
            )}

            {/* Pause all toggle */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDECEA', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="pause-circle-outline" size={20} color="#DC3545" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Pause All Notifications</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Temporarily silence everything</Text>
                </View>
              </View>
              <Switch
                value={Object.values(prefs).every(v => !v)}
                onValueChange={(paused) => {
                  const next = { ...prefs };
                  for (const key of Object.keys(next) as (keyof Prefs)[]) {
                    next[key] = !paused;
                  }
                  setPrefs(next);
                  if (user) {
                    setSaving(true);
                    supabase.from('notification_preferences').upsert(
                      { user_id: user.id, ...next, updated_at: new Date().toISOString() },
                      { onConflict: 'user_id' },
                    ).then(() => setSaving(false));
                  }
                }}
                trackColor={{ true: '#DC3545' }}
                disabled={permissionStatus !== 'granted'}
              />
            </View>

            {/* Preference toggles */}
            <View style={[styles.card, { backgroundColor: colors.surface, opacity: Object.values(prefs).every(v => !v) ? 0.5 : 1 }]}>
              {PREF_ITEMS.map((item, i) => (
                <View key={item.key}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <View style={styles.prefRow}>
                    <View style={[styles.prefIconWrap, { backgroundColor: colors.greenBg }]}>
                      <Ionicons name={item.icon as any} size={20} color="#00843D" />
                    </View>
                    <View style={styles.prefInfo}>
                      <Text style={[styles.prefLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.prefDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={v => savePref(item.key, v)}
                      trackColor={{ true: '#00843D' }}
                      disabled={
                        // Email digest doesn't need device push permission — always enabled
                        item.key === 'email_digest_enabled'
                          ? Object.values(prefs).every(v => !v)
                          : permissionStatus !== 'granted' || Object.values(prefs).every(v => !v)
                      }
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.note, { color: colors.textMuted }]}>
              Notifications are sent sparingly. You can change these preferences at any time.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  back: { padding: 20, paddingBottom: 0 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a2332', marginBottom: 24 },
  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  signedOutTitle: { fontSize: 18, fontWeight: '700', color: '#1a2332' },
  signedOutBody: { fontSize: 15, color: '#5a6a7a', textAlign: 'center' },
  permissionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  permissionTitle: { fontSize: 14, fontWeight: '700', color: '#1a2332' },
  permissionBody: { fontSize: 13, color: '#5a6a7a', lineHeight: 18, marginTop: 2 },
  permissionBtn: { backgroundColor: '#B45309', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  permissionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  grantedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  grantedText: { fontSize: 14, color: '#00843D', fontWeight: '600' },
  card: { backgroundColor: '#f8f9fa', borderRadius: 14, paddingVertical: 4, marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#e8ecf0', marginHorizontal: 16 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  prefIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center' },
  prefInfo: { flex: 1 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: '#1a2332' },
  prefDesc: { fontSize: 12, color: '#9aabb8', marginTop: 1 },
  note: { fontSize: 13, color: '#9aabb8', textAlign: 'center', lineHeight: 19 },
});
