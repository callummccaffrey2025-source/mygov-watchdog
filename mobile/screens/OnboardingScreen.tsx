import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { track } from '../lib/analytics';

const TOPICS = [
  { id: 'economy',        label: 'Economy',           icon: '💰' },
  { id: 'healthcare',     label: 'Healthcare',         icon: '🏥' },
  { id: 'environment',    label: 'Environment',        icon: '🌿' },
  { id: 'education',      label: 'Education',          icon: '📚' },
  { id: 'defence',        label: 'Defence',            icon: '🛡️' },
  { id: 'immigration',    label: 'Immigration',        icon: '✈️' },
  { id: 'housing',        label: 'Housing',            icon: '🏠' },
  { id: 'welfare',        label: 'Welfare',            icon: '❤️' },
  { id: 'indigenous',     label: 'Indigenous Affairs', icon: '🪃' },
  { id: 'infrastructure', label: 'Infrastructure',     icon: '🚧' },
  { id: 'technology',     label: 'Technology',         icon: '💻' },
  { id: 'foreign_policy', label: 'Foreign Policy',     icon: '🌏' },
  { id: 'agriculture',    label: 'Agriculture',        icon: '🌾' },
  { id: 'justice',        label: 'Justice',            icon: '⚖️' },
];

interface ElectorateResult { id: string; name: string; }

interface MemberResult {
  id: string;
  first_name: string;
  last_name: string;
  party: { name: string; short_name: string | null; colour: string | null } | null;
  electorate: { name: string; state: string } | null;
}

interface Props {
  onComplete: () => void;
}

function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const [step, setStepRaw] = useState(1);
  const setStep = (s: number) => {
    setStepRaw(s);
    track('onboarding_step_completed', { step: s }, 'Onboarding');
  };
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Step 2: Postcode
  const [postcode, setPostcode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [electorate, setElectorate] = useState<ElectorateResult | null>(null);
  const [member, setMember] = useState<MemberResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Step 4: Topics
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // Initialise device ID
  useEffect(() => {
    AsyncStorage.getItem('device_id').then(id => {
      if (id) {
        setDeviceId(id);
      } else {
        const newId = generateDeviceId();
        AsyncStorage.setItem('device_id', newId);
        setDeviceId(newId);
      }
    });
  }, []);

  // Postcode lookup (fires when postcode reaches 4 digits)
  useEffect(() => {
    if (postcode.length !== 4 || !/^\d{4}$/.test(postcode)) {
      setElectorate(null);
      setMember(null);
      setLookupError(null);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    const run = async () => {
      try {
        const { data: electorates } = await supabase
          .from('electorates')
          .select('id, name')
          .contains('postcodes', [postcode])
          .eq('level', 'federal')
          .limit(1);
        const elec = electorates?.[0] ?? null;
        setElectorate(elec);
        if (elec) {
          const { data: members } = await supabase
            .from('members')
            .select('id, first_name, last_name, party:parties(name, short_name, colour), electorate:electorates(name, state)')
            .eq('electorate_id', elec.id)
            .eq('chamber', 'house')
            .eq('is_active', true)
            .limit(1);
          setMember((members?.[0] as unknown as MemberResult) ?? null);
        } else {
          setMember(null);
          setLookupError('No electorate found for this postcode.');
        }
      } catch {
        setLookupError('Lookup failed. Please try again.');
      } finally {
        setLookupLoading(false);
      }
    };
    run();
  }, [postcode]);

  const saveAndComplete = async () => {
    if (postcode.length === 4) {
      await AsyncStorage.setItem('postcode', postcode);
    }
    if (deviceId) {
      supabase.from('user_preferences').upsert(
        {
          device_id: deviceId,
          postcode: postcode || null,
          electorate: electorate?.name ?? null,
          member_id: member?.id ?? null,
          selected_topics: selectedTopics,
          onboarding_completed_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' },
      ).then(() => {});

      // Auto-follow the user's local MP so they get value immediately
      if (member?.id) {
        supabase.from('user_follows').upsert(
          {
            device_id: deviceId,
            entity_type: 'member',
            entity_id: member.id,
          },
          { onConflict: 'device_id,entity_type,entity_id' },
        ).then(() => {});
      }
    }
    track('onboarding_completed', { postcode: postcode || null, topics: selectedTopics.length }, 'Onboarding');
    onComplete();
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id],
    );
  };

  // ── Screen 1: Welcome ──────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.bigIconWrap}>
            <Text style={styles.bigIcon}>🏛️</Text>
          </View>
          <Text style={[styles.h1, { color: colors.text }]}>Welcome to Verity</Text>
          <Text style={[styles.h2, { color: colors.text }]}>Australia's civic intelligence platform</Text>
          <Text style={[styles.body, { color: colors.textBody }]}>
            Your window into federal parliament — bills, votes, MPs and more, explained in plain English.
          </Text>
        </View>
        <View style={styles.footer}>
          <Pressable style={styles.btn} onPress={() => setStep(2)}>
            <Text style={styles.btnText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 2: Postcode ─────────────────────────────────────────────────────

  if (step === 2) {
    const canContinue = electorate !== null && !lookupLoading;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep(1)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.stepCount, { color: colors.textMuted }]}>2 of 5</Text>
          <Pressable onPress={() => setStep(4)} hitSlop={12}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
        <View style={styles.stepContent}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📍</Text>
          </View>
          <Text style={[styles.h1, { color: colors.text }]}>Find Your MP</Text>
          <Text style={[styles.subText, { color: colors.textBody }]}>Enter your postcode to personalise your experience</Text>
          <TextInput
            style={[styles.postcodeInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            value={postcode}
            onChangeText={setPostcode}
            placeholder="e.g. 2000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
          />
          {lookupLoading && <ActivityIndicator color="#00843D" style={{ marginTop: 12 }} />}
          {lookupError !== null && !lookupLoading && (
            <Text style={styles.errorText}>{lookupError}</Text>
          )}
          {electorate !== null && !lookupLoading && (
            <View style={styles.resultChip}>
              <Ionicons name="checkmark-circle" size={18} color="#00843D" />
              <Text style={styles.resultText}>{electorate.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <Pressable
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={() => { if (canContinue) setStep(member ? 3 : 4); }}
            disabled={!canContinue}
          >
            <Text style={styles.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 3: Your MP ──────────────────────────────────────────────────────

  if (step === 3) {
    if (!member) { setStep(4); return null; }
    const partyColour = member.party?.colour ?? '#9aabb8';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep(2)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.stepCount, { color: colors.textMuted }]}>3 of 5</Text>
          <Pressable onPress={() => setStep(4)} hitSlop={12}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
        <View style={styles.stepContent}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🧑‍⚖️</Text>
          </View>
          <Text style={[styles.h1, { color: colors.text }]}>Your Representative</Text>
          <Text style={[styles.subText, { color: colors.textBody }]}>Based on postcode {postcode}</Text>
          <View style={[styles.mpCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.mpAvatar, { backgroundColor: partyColour + '22' }]}>
              <Text style={[styles.mpInitials, { color: partyColour }]}>
                {member.first_name[0]}{member.last_name[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mpName, { color: colors.text }]}>{member.first_name} {member.last_name}</Text>
              <Text style={[styles.mpDetail, { color: colors.textBody }]} numberOfLines={1}>
                {member.party?.short_name ?? member.party?.name ?? ''}
                {member.electorate
                  ? ` · ${member.electorate.name}, ${member.electorate.state}`
                  : ''}
              </Text>
            </View>
          </View>
          {/* Auto-follow badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'center' }}>
            <Ionicons name="checkmark-circle" size={16} color="#00843D" />
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#00843D' }}>Auto-following your MP</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Pressable style={styles.btn} onPress={() => setStep(4)}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.btnText}>That's my MP</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => setStep(2)}>
            <Text style={[styles.ghostBtnText, { color: colors.textMuted }]}>Not me — change postcode</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 4: Topics ───────────────────────────────────────────────────────

  if (step === 4) {
    const canContinue = selectedTopics.length >= 2;
    const remaining = 2 - selectedTopics.length;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep(member ? 3 : 2)} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.stepCount, { color: colors.textMuted }]}>4 of 5</Text>
          <Pressable onPress={() => setStep(5)} hitSlop={12}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.topicsScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🎯</Text>
          </View>
          <Text style={[styles.h1, { color: colors.text }]}>What matters to you?</Text>
          <Text style={[styles.subText, { color: colors.textBody }]}>Select at least 2 topics to personalise your feed</Text>
          <View style={styles.topicsGrid}>
            {TOPICS.map(t => {
              const selected = selectedTopics.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  style={[styles.topicChip, { backgroundColor: colors.background, borderColor: colors.border }, selected && styles.topicChipSelected]}
                  onPress={() => toggleTopic(t.id)}
                >
                  <Text style={styles.topicIcon}>{t.icon}</Text>
                  <Text style={[styles.topicLabel, { color: colors.textBody }, selected && styles.topicLabelSelected]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: 110 }} />
        </ScrollView>
        <View style={[styles.footerAbsolute, { backgroundColor: colors.background }]}>
          <Pressable
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={() => { if (canContinue) setStep(5); }}
            disabled={!canContinue}
          >
            <Text style={styles.btnText}>
              {remaining > 0 ? `Select ${remaining} more` : 'Continue'}
            </Text>
            {canContinue && <Ionicons name="arrow-forward" size={20} color="#fff" />}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 5: Notifications ────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.stepHeader}>
        <Pressable onPress={() => setStep(4)} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.stepCount, { color: colors.textMuted }]}>5 of 5</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.centered}>
        <View style={styles.bigIconWrap}>
          <Text style={styles.bigIcon}>🔔</Text>
        </View>
        <Text style={[styles.h1, { color: colors.text }]}>Stay Informed</Text>
        <Text style={[styles.h2, { color: colors.text }]}>Never miss what matters</Text>
        <Text style={[styles.body, { color: colors.textBody }]}>
          Get your Daily Brief each morning, alerts when your MP votes on key bills, and breaking political news as it happens.
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.btn}
          onPress={async () => {
            if (Platform.OS !== 'web') {
              await Notifications.requestPermissionsAsync();
            }
            saveAndComplete();
          }}
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Enable Notifications</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={saveAndComplete}>
          <Text style={[styles.ghostBtnText, { color: colors.textMuted }]}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  stepCount: { fontSize: 14, color: '#9aabb8', fontWeight: '600' },
  skipText: { fontSize: 15, color: '#9aabb8', fontWeight: '500' },

  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 16,
  },
  stepContent: {
    flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 32, gap: 16,
  },

  bigIconWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#00843D18', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  bigIcon: { fontSize: 56 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#00843D18', justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  icon: { fontSize: 36 },

  h1: { fontSize: 26, fontWeight: '800', color: '#1a2332', textAlign: 'center' },
  h2: { fontSize: 17, fontWeight: '600', color: '#1a2332', textAlign: 'center' },
  body: { fontSize: 16, color: '#5a6a7a', textAlign: 'center', lineHeight: 24 },
  subText: { fontSize: 15, color: '#5a6a7a', textAlign: 'center' },

  postcodeInput: {
    width: '100%', borderWidth: 1.5, borderColor: '#e8ecf0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, textAlign: 'center',
    color: '#1a2332', letterSpacing: 6, marginTop: 8,
  },
  errorText: { fontSize: 14, color: '#DC3545', textAlign: 'center' },
  resultChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00843D12', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  resultText: { fontSize: 15, color: '#00843D', fontWeight: '600' },

  mpCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#f8f9fb', borderRadius: 16, padding: 16, width: '100%', marginTop: 8,
  },
  mpAvatar: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  mpInitials: { fontSize: 20, fontWeight: '700' },
  mpName: { fontSize: 17, fontWeight: '700', color: '#1a2332' },
  mpDetail: { fontSize: 14, color: '#5a6a7a', marginTop: 2 },

  topicsScroll: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center' },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#e8ecf0', backgroundColor: '#ffffff',
  },
  topicChipSelected: { borderColor: '#00843D', backgroundColor: '#00843D0F' },
  topicIcon: { fontSize: 16 },
  topicLabel: { fontSize: 14, color: '#5a6a7a', fontWeight: '500' },
  topicLabelSelected: { color: '#00843D', fontWeight: '700' },

  footer: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  footerAbsolute: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12,
    backgroundColor: '#ffffff',
  },

  btn: {
    backgroundColor: '#00843D', borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnDisabled: { backgroundColor: '#c8d6db' },
  btnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { fontSize: 15, color: '#9aabb8', fontWeight: '500' },
});
