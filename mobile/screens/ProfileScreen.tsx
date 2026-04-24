import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Linking,
  ActivityIndicator, Platform, DevSettings, Keyboard, InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { supabase } from '../lib/supabase';
import Constants from 'expo-constants';
import { useEngagementScore, LEVEL_COLOURS } from '../hooks/useEngagementScore';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export function ProfileScreen({ navigation }: any) {
  const { session, user, postcode, setPostcode, signOut } = useUser();
  const [postcodeEdit, setPostcodeEdit] = useState(postcode || '');
  const { member: myMP } = useElectorateByPostcode(postcode);
  const { score, level, colour, data: engData } = useEngagementScore(user?.id);
  const { colors } = useTheme();

  // Verity Stats
  const [articlesRead, setArticlesRead] = useState(0);
  const [mpsFollowed, setMpsFollowed] = useState(0);
  const [daysActive, setDaysActive] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Articles read from AsyncStorage
        const readCount = await AsyncStorage.getItem('articles_read_count');
        if (readCount) setArticlesRead(parseInt(readCount, 10) || 0);

        // First open date — store if not set, then compute days
        const FIRST_OPEN_KEY = 'first_open_date';
        let firstOpen = await AsyncStorage.getItem(FIRST_OPEN_KEY);
        if (!firstOpen) {
          firstOpen = new Date().toISOString();
          await AsyncStorage.setItem(FIRST_OPEN_KEY, firstOpen);
        }
        const diffMs = Date.now() - new Date(firstOpen).getTime();
        const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
        setDaysActive(diffDays);

        // MPs followed from Supabase + streak
        if (user) {
          const { count } = await supabase
            .from('user_follows')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('entity_type', 'member');
          setMpsFollowed(count ?? 0);

          // Fetch latest streak from engagement stats
          const { data: streakRow } = await supabase
            .from('user_engagement_stats')
            .select('streak_days')
            .eq('user_id', user.id)
            .order('stat_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (streakRow?.streak_days) setStreakDays(streakRow.streak_days);
        } else {
          const deviceId = await AsyncStorage.getItem('device_id');
          if (deviceId) {
            const { count } = await supabase
              .from('user_follows')
              .select('id', { count: 'exact', head: true })
              .eq('device_id', deviceId)
              .is('user_id', null)
              .eq('entity_type', 'member');
            setMpsFollowed(count ?? 0);
          }
        }
      } catch {
        // Non-critical — stats show 0
      }
    };
    loadStats();
  }, [user?.id]);

  // Sign-in form state
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);

  const handleSendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    setSending(false);
    if (error) Alert.alert('Error', error.message);
    else setSent(true);
  };

  const handleAppleSignIn = async () => {
    try {
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) Alert.alert('Sign-in failed', error.message);
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in failed', e?.message ?? 'Unknown error');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'verity://auth-callback',
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        Alert.alert('Google sign-in unavailable', 'Please use Apple Sign-In or Email instead.');
        return;
      }
      await WebBrowser.openAuthSessionAsync(data.url, 'verity://auth-callback');
    } catch {
      Alert.alert('Google sign-in unavailable', 'Please use Apple Sign-In or Email instead.');
    }
  };

  const handleResetOnboarding = async () => {
    await AsyncStorage.removeItem('onboarding_complete');
    try {
      DevSettings.reload();
    } catch {
      Alert.alert('Onboarding reset', 'Close and reopen the app to trigger onboarding.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                method: 'POST',
              });
              if (error) {
                Alert.alert('Error', 'Failed to delete account. Please try again.');
                return;
              }
              await AsyncStorage.clear();
              await signOut();
              Alert.alert('Account Deleted', 'Your account and all data have been permanently removed.');
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please contact support@verity.au');
            }
          },
        },
      ],
    );
  };

  const handleSavePostcode = () => {
    const trimmed = postcodeEdit.trim();
    if (trimmed.length === 4 && /^\d+$/.test(trimmed)) {
      setPostcode(trimmed);
      Alert.alert('Saved', 'Your postcode has been updated.');
    } else {
      Alert.alert('Invalid postcode', 'Please enter a valid 4-digit postcode.');
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.signInContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoRow}>
            <Ionicons name="leaf-outline" size={28} color="#00843D" />
            <Text style={styles.logoText}>Verity</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textBody, textAlign: 'center' }}>
            Australia's civic intelligence platform
          </Text>

          {/* Verify to participate card */}
          <View style={{ width: '100%', backgroundColor: '#E8F5EE', borderRadius: 14, padding: 16, marginVertical: 12, borderLeftWidth: 4, borderLeftColor: '#00843D' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="shield-checkmark" size={18} color="#00843D" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }}>Verify your account</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>
              Sign in to participate in polls, react to posts, and join your electorate's community. Browsing is always free.
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 8 }}>
            Join 12,400 Australians tracking their democracy
          </Text>

          {sent ? (
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#E8F5EE', borderRadius: 12, padding: 16 }}>
              <Ionicons name="mail" size={24} color="#00843D" />
              <Text style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 }}>
                Check your email — we sent a sign-in link to {email.trim()}
              </Text>
            </View>
          ) : (
            <View style={{ width: '100%', gap: 12, marginTop: 4 }}>
              {Platform.OS === 'ios' && (
                <Pressable
                  style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#000000', borderRadius: 12, height: 48 }}
                  onPress={handleAppleSignIn}
                >
                  <Ionicons name="logo-apple" size={20} color="#ffffff" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Continue with Apple</Text>
                </Pressable>
              )}

              <Pressable
                style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 12, height: 48, borderWidth: 1, borderColor: colors.border }}
                onPress={handleGoogleSignIn}
              >
                <Ionicons name="logo-google" size={18} color="#4285F4" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Continue with Google</Text>
              </Pressable>

              {/* Email — progressive disclosure */}
              {emailExpanded ? (
                <View style={{ width: '100%', gap: 10 }}>
                  <TextInput
                    style={{ width: '100%', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor="#9aabb8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!sending}
                    autoFocus
                  />
                  <Pressable
                    style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00843D', borderRadius: 12, height: 48, opacity: sending ? 0.6 : 1 }}
                    onPress={handleSendMagicLink}
                    disabled={sending}
                  >
                    {sending
                      ? <ActivityIndicator color="#ffffff" />
                      : (
                        <>
                          <Ionicons name="send-outline" size={17} color="#ffffff" />
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Send Magic Link</Text>
                        </>
                      )
                    }
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#00843D', borderRadius: 12, height: 48 }}
                  onPress={() => setEmailExpanded(true)}
                >
                  <Ionicons name="mail-outline" size={18} color="#ffffff" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Continue with Email</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable onPress={() => setSent(false)} style={styles.ghostLink}>
            <Text style={[styles.guestNote, { color: colors.textMuted }]}>Browse without signing in</Text>
          </Pressable>

          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.privacyText, { color: colors.textMuted }]}>We never share your data. </Text>
            <Pressable onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Text style={styles.privacyLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        {/* User info */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, { backgroundColor: colors.green }]}>
              <Text style={styles.avatarInitials}>
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.email, { color: colors.text }]}>{user?.email}</Text>
              <Text style={[styles.joined, { color: colors.textMuted }]}>Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) : ''}</Text>
            </View>
          </View>
        </View>

        {/* Your Verity Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Verity Stats</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' }}>
            {[
              { label: 'Articles Read', value: articlesRead, icon: 'newspaper-outline' as const },
              { label: 'MPs Followed', value: mpsFollowed, icon: 'people-outline' as const },
              { label: 'Days Active', value: daysActive, icon: 'calendar-outline' as const },
              ...(streakDays > 0 ? [{ label: 'Day Streak', value: streakDays, icon: 'flame-outline' as const }] : []),
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: BORDER_RADIUS.md + 2,
                  padding: SPACING.md,
                  alignItems: 'center',
                  gap: SPACING.xs,
                }}
              >
                <Ionicons name={stat.icon} size={22} color="#00843D" />
                <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: FONT_SIZE.small - 1, color: colors.textMuted, textAlign: 'center' }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Postcode */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Location</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Postcode</Text>
            <View style={styles.postcodeRow}>
              <TextInput
                style={[styles.postcodeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={postcodeEdit}
                onChangeText={setPostcodeEdit}
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); handleSavePostcode(); }}
                maxLength={4}
                placeholder="Enter postcode"
                placeholderTextColor="#9aabb8"
                inputAccessoryViewID="profile-postcode-done"
              />
              {Platform.OS === 'ios' && (
                <InputAccessoryView nativeID="profile-postcode-done">
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#F1F1F1', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#C8C8C8' }}>
                    <Pressable onPress={() => { Keyboard.dismiss(); handleSavePostcode(); }} hitSlop={8}>
                      <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>Done</Text>
                    </Pressable>
                  </View>
                </InputAccessoryView>
              )}
              <Pressable style={styles.saveBtn} onPress={handleSavePostcode}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
            {myMP && (
              <Pressable style={[styles.mpRow, { borderTopColor: colors.border }]} onPress={() => navigation.navigate('MemberProfile', { member: myMP })}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Your MP</Text>
                <Text style={[styles.mpName, { color: colors.text }]}>{myMP.first_name} {myMP.last_name}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Civic Score */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Civic Score</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.scoreRow}>
              <View style={[styles.scoreRing, { borderColor: colour }]}>
                <Text style={[styles.scoreNum, { color: colour }]}>{score}</Text>
                <Text style={[styles.scorePts, { color: colors.textMuted }]}>pts</Text>
              </View>
              <View style={styles.scoreInfo}>
                <View style={[styles.levelBadge, { backgroundColor: colour + '18' }]}>
                  <Text style={[styles.levelText, { color: colour }]}>{level}</Text>
                </View>
                <View style={styles.scoreBreakdown}>
                  <Text style={[styles.breakdownItem, { color: colors.textBody }]}>📄 {engData?.bills_read ?? 0} bills read</Text>
                  <Text style={[styles.breakdownItem, { color: colors.textBody }]}>🗳️ {engData?.polls_voted ?? 0} polls voted</Text>
                  <Text style={[styles.breakdownItem, { color: colors.textBody }]}>👍 {engData?.reactions_given ?? 0} reactions</Text>
                  <Text style={[styles.breakdownItem, { color: colors.textBody }]}>📅 {engData?.days_active ?? 0} days active</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('Saved')}>
              <Ionicons name="bookmark-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>Saved Items</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.crownIcon}>👑</Text>
              <Text style={[styles.settingLabel, { flex: 1, color: '#00843D', fontWeight: '700' }]}>Upgrade to Pro</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('NotificationPreferences')}>
              <Ionicons name="notifications-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>Notification Preferences</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('ManageTopics')}>
              <Ionicons name="pricetags-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>Manage Topics</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('PrivacyPolicy')}>
              <Ionicons name="shield-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('Terms')}>
              <Ionicons name="document-text-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable style={styles.settingRow} onPress={() => navigation.navigate('About')}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textBody} />
              <Text style={[styles.settingLabel, { flex: 1, color: colors.text }]}>About Verity</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Legal & Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Pressable
              style={styles.linkRow}
              onPress={() => Linking.openURL('mailto:support@verity.au?subject=Issue%20Report')}
            >
              <Text style={[styles.linkText, { color: colors.text }]}>Report an Issue</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* DEV: Reset Onboarding (remove before App Store submission) */}
        <Pressable style={styles.resetOnboardingBtn} onPress={handleResetOnboarding}>
          <Ionicons name="refresh-outline" size={16} color="#B45309" />
          <Text style={styles.resetOnboardingText}>Reset Onboarding (Testing)</Text>
        </Pressable>

        {/* Sign out */}
        <Pressable style={[styles.signOutBtn, { backgroundColor: colors.redBg }]} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        {/* Delete account */}
        {user && (
          <Pressable
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.deleteAccountText, { color: colors.textMuted }]}>
              Delete Account
            </Text>
          </Pressable>
        )}

        <Text style={[styles.version, { color: colors.borderStrong }]}>
          Verity v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  signInContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.xxxl, gap: SPACING.md + 2 },
  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2, marginBottom: SPACING.xs },
  logoText: { fontSize: 36, fontWeight: FONT_WEIGHT.bold, color: '#00843D', letterSpacing: -1 },
  signInTagline: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.medium, textAlign: 'center' },
  signInSocialProof: { fontSize: FONT_SIZE.small, textAlign: 'center', marginBottom: SPACING.sm },
  // Auth buttons
  authButtons: { width: '100%', gap: SPACING.md, marginTop: SPACING.xs },
  appleBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm + 2, backgroundColor: '#000000', borderRadius: BORDER_RADIUS.lg, height: 52,
  },
  appleBtnText: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  googleBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm + 2, backgroundColor: '#4285F4', borderRadius: BORDER_RADIUS.lg, height: 52,
  },
  googleBtnText: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  emailBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm + 2, backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.lg, height: 52,
  },
  emailBtnText: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  emailForm: { width: '100%', gap: SPACING.sm + 2 },
  emailInput: {
    width: '100%', borderRadius: BORDER_RADIUS.md + 2,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md + 2, fontSize: FONT_SIZE.body,
    borderWidth: 1,
  },
  signInBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.md + 2, paddingVertical: SPACING.md + 2,
  },
  signInBtnDisabled: { opacity: 0.6 },
  signInBtnText: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  sentCard: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.lg,
  },
  sentText: { flex: 1, fontSize: FONT_SIZE.small + 1, lineHeight: 20 },
  ghostLink: { paddingVertical: SPACING.xs + 2 },
  guestNote: { fontSize: FONT_SIZE.small },
  privacyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  privacyText: { fontSize: FONT_SIZE.small - 1 },
  privacyLink: { fontSize: FONT_SIZE.small - 1, color: '#00843D', fontWeight: FONT_WEIGHT.semibold },
  crownIcon: { fontSize: 18, marginRight: SPACING.xs },
  // Signed-in avatar
  avatarInitials: { fontSize: 26, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  content: { padding: SPACING.lg + 4, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xl },
  card: { borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.lg, marginBottom: SPACING.sm },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md + 2 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  email: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.semibold },
  joined: { fontSize: FONT_SIZE.small - 1, marginTop: 2 },
  section: { marginBottom: SPACING.lg + 4 },
  sectionTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm + 2 },
  label: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', marginBottom: SPACING.xs + 2 },
  postcodeRow: { flexDirection: 'row', gap: SPACING.sm },
  postcodeInput: { flex: 1, borderRadius: BORDER_RADIUS.sm + 2, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONT_SIZE.body, borderWidth: 1 },
  saveBtn: { backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.sm + 2, paddingHorizontal: SPACING.lg, justifyContent: 'center' },
  saveBtnText: { color: '#ffffff', fontWeight: FONT_WEIGHT.semibold, fontSize: FONT_SIZE.small + 1 },
  mpRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1 },
  mpName: { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm + 2, paddingVertical: SPACING.xs },
  settingLabel: { fontSize: FONT_SIZE.body },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  linkText: { fontSize: FONT_SIZE.body },
  divider: { height: 1, marginVertical: SPACING.sm + 2 },
  resetOnboardingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md + 2, borderWidth: 1.5, borderColor: '#B45309', borderStyle: 'dashed',
    padding: SPACING.md + 2, marginBottom: SPACING.md,
  },
  resetOnboardingText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold, color: '#B45309' },
  signOutBtn: { borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.lg, alignItems: 'center' },
  signOutText: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.semibold, color: '#d32f2f' },
  deleteAccountBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  deleteAccountText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium },
  version: { textAlign: 'center', fontSize: FONT_SIZE.small - 1, marginTop: SPACING.lg },

  // Civic score
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg + 4 },
  scoreRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 8, justifyContent: 'center', alignItems: 'center' },
  scoreNum: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold },
  scorePts: { fontSize: FONT_SIZE.caption, marginTop: -2 },
  scoreInfo: { flex: 1, gap: SPACING.sm + 2 },
  levelBadge: { alignSelf: 'flex-start', borderRadius: BORDER_RADIUS.sm + 2, paddingHorizontal: SPACING.sm + 2, paddingVertical: 5 },
  levelText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  scoreBreakdown: { gap: 3 },
  breakdownItem: { fontSize: FONT_SIZE.small },

});
