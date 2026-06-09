import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  ActivityIndicator, Platform, Keyboard, KeyboardAvoidingView,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '../lib/storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { track } from '../lib/analytics';


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

  // Legacy fields — kept for saveAndComplete compatibility, populated with defaults
  const selectedTopics: string[] = [];
  const trackedIssues: string[] = [];
  const housingStatus: string | null = null;

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
            .select('id, first_name, last_name, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates!members_electorate_id_fkey(name, state)')
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
      // ACT ranges (26xx, 29xx) must be checked before the NSW '2' prefix
      const stateFromPostcode = postcode ? (
        postcode.startsWith('26') || postcode.startsWith('29') ? 'ACT' :
        postcode.startsWith('2') ? 'NSW' : postcode.startsWith('3') ? 'VIC' :
        postcode.startsWith('4') ? 'QLD' : postcode.startsWith('5') ? 'SA' :
        postcode.startsWith('6') ? 'WA' : postcode.startsWith('7') ? 'TAS' :
        postcode.startsWith('0') ? 'NT' : null
      ) : null;

      supabase.from('user_preferences').upsert(
        {
          device_id: deviceId,
          postcode: postcode || null,
          electorate: electorate?.name ?? null,
          state: stateFromPostcode,
          member_id: member?.id ?? null,
          selected_topics: selectedTopics,
          tracked_issues: trackedIssues,
          housing_status: housingStatus,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_version: 2,
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
    track('onboarding_completed', {
      postcode: postcode || null,
      topics: selectedTopics.length,
      issues: trackedIssues.length,
      housing: housingStatus,
      version: 2,
    }, 'Onboarding');
    onComplete();
  };

  // Steps 4-6 (topics, issues, housing) removed — users discover these later.
  // Onboarding is now: Welcome → Postcode → Your MP → Notifications → Done.

  // ── Screen 1: Welcome ──────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.bigIconWrap}>
            <Ionicons name="receipt-outline" size={56} color="#00843D" />
          </View>
          <Text style={[styles.h1, { color: colors.text }]}>What did your{'\n'}MP do this week?</Text>
          <Text style={[styles.body, { color: colors.textBody }]}>
            Every vote your MP casts in parliament, explained in plain English. The receipts, delivered weekly.
          </Text>
          {/* Data proof — credibility before asking for anything */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 24 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>225</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>MPs tracked</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>146k+</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>votes recorded</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>6,260</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>bills</Text>
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Pressable style={styles.btn} onPress={() => setStep(2)} accessibilityRole="button" accessibilityLabel="Get Started">
            <Text style={styles.btnText}>Find my MP</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 2: Postcode ─────────────────────────────────────────────────────

  if (step === 2) {
    const canContinue = electorate !== null && !lookupLoading;
    const handlePostcodeSubmit = () => {
      Keyboard.dismiss();
      if (canContinue) setStep(member ? 3 : 7);
    };
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep(1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.stepCount, { color: colors.textMuted }]}>1 of 2</Text>
          <Pressable onPress={() => setStep(7)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip step">
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Dismiss keyboard">
            <View style={styles.stepContent}>
              <View style={styles.iconWrap}>
                <Ionicons name="location-outline" size={36} color="#00843D" />
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
                returnKeyType="done"
                onSubmitEditing={handlePostcodeSubmit}
                maxLength={4}
                autoFocus
                inputAccessoryViewID="postcode-done"
                accessibilityLabel="Enter your postcode"
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
          </Pressable>
        </KeyboardAvoidingView>
        <View style={styles.footer}>
          <Pressable
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={handlePostcodeSubmit}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID="postcode-done">
            <View style={{
              flexDirection: 'row', justifyContent: 'flex-end',
              backgroundColor: '#F1F1F1', paddingHorizontal: 16, paddingVertical: 8,
              borderTopWidth: 0.5, borderTopColor: '#C8C8C8',
            }}>
              <Pressable onPress={handlePostcodeSubmit} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done">
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
      </SafeAreaView>
    );
  }

  // ── Screen 3: Your MP ──────────────────────────────────────────────────────

  if (step === 3) {
    if (!member) { setStep(7); return null; }
    const partyColour = member.party?.colour ?? '#9aabb8';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep(2)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.stepCount, { color: colors.textMuted }]}>2 of 2</Text>
          <Pressable onPress={() => setStep(7)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip step">
            <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        </View>
        <View style={styles.stepContent}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-outline" size={36} color="#00843D" />
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
          <Pressable style={styles.btn} onPress={() => setStep(7)} accessibilityRole="button" accessibilityLabel="Confirm MP">
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.btnText}>That's my MP</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => setStep(2)} accessibilityRole="button" accessibilityLabel="Change postcode">
            <Text style={[styles.ghostBtnText, { color: colors.textMuted }]}>Not me — change postcode</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Screen 7: Notifications ────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.centered}>
        <View style={styles.bigIconWrap}>
          <Ionicons name="notifications-outline" size={56} color="#00843D" />
        </View>
        <Text style={[styles.h1, { color: colors.text }]}>One last thing</Text>
        <Text style={[styles.body, { color: colors.textBody }]}>
          {member
            ? `We'll notify you when ${member.first_name} ${member.last_name} votes in parliament. No spam — just the receipts.`
            : 'Get notified when your MP votes in parliament. No spam — just the receipts.'}
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
          accessibilityRole="button"
          accessibilityLabel="Enable notifications"
        >
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Enable Notifications</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={saveAndComplete} accessibilityRole="button" accessibilityLabel="Skip notifications">
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
