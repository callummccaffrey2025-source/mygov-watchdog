import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Member } from '../hooks/useMembers';

type Step = 'email' | 'verify' | 'done';

const APH_EMAIL_DOMAIN = '@aph.gov.au';

export function ClaimProfileScreen({ route, navigation }: any) {
  const { member }: { member: Member } = route.params;
  const { user } = useUser();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const displayName = `${member.first_name} ${member.last_name}`;

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(APH_EMAIL_DOMAIN)) {
      Alert.alert(
        'Invalid email',
        `Please use your official parliamentary email address ending in ${APH_EMAIL_DOMAIN}.`,
      );
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setStep('verify');
  };

  const handleVerifyCode = async () => {
    if (code.trim().length < 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code from your email.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in to the app first before claiming your profile.');
      return;
    }
    setLoading(true);
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'magiclink',
    });
    if (otpError) {
      setLoading(false);
      Alert.alert('Verification failed', otpError.message);
      return;
    }

    // Link this user to the member record
    const { error: insertError } = await supabase
      .from('verified_officials')
      .insert({
        user_id: user.id,
        member_id: member.id,
        verified_method: 'email_aph',
      });
    setLoading(false);
    if (insertError) {
      if (insertError.code === '23505') {
        Alert.alert('Already claimed', 'This profile has already been claimed.');
      } else {
        Alert.alert('Error', insertError.message);
      }
      return;
    }
    setStep('done');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#1a2332" />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={40} color="#00843D" />
          </View>
          <Text style={styles.title}>Claim your profile</Text>
          <Text style={styles.subtitle}>
            Verify your identity as <Text style={{ fontWeight: '700' }}>{displayName}</Text> to
            post updates, announcements, and policy positions directly to your constituents.
          </Text>
        </View>

        {step === 'email' && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Step 1 of 2 — Verify your email</Text>
            <Text style={styles.fieldLabel}>Parliamentary email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={`firstname.lastname${APH_EMAIL_DOMAIN}`}
              placeholderTextColor="#9aabb8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              We'll send a verification code to this address. Only official{' '}
              <Text style={{ fontWeight: '600' }}>{APH_EMAIL_DOMAIN}</Text> addresses are accepted.
            </Text>
            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Send verification code</Text>
              }
            </Pressable>
          </View>
        )}

        {step === 'verify' && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Step 2 of 2 — Enter the code</Text>
            <Text style={styles.fieldLabel}>Verification code</Text>
            <Text style={styles.hint}>
              We sent a 6-digit code to <Text style={{ fontWeight: '600' }}>{email}</Text>.
              Check your inbox and enter the code below.
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="#9aabb8"
              keyboardType="number-pad"
              maxLength={6}
            />
            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Verify and claim profile</Text>
              }
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setStep('email')}>
              <Text style={styles.secondaryBtnText}>Use a different email</Text>
            </Pressable>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.card}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#00843D" />
            </View>
            <Text style={styles.successTitle}>Profile claimed!</Text>
            <Text style={styles.successBody}>
              Your identity as <Text style={{ fontWeight: '700' }}>{displayName}</Text> has been
              verified. You can now post updates from your profile.
            </Text>
            <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Go to my profile</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Ionicons name="lock-closed-outline" size={14} color="#9aabb8" />
          <Text style={styles.footerText}>
            Your email is used only for identity verification and is not displayed publicly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 48 },
  back: { paddingBottom: 16 },
  hero: { alignItems: 'center', gap: 12, marginBottom: 24 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#e8f5ee', justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1a2332', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#5a6a7a', textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: '#f8f9fa', borderRadius: 16, padding: 20, gap: 12, marginBottom: 20,
  },
  stepLabel: { fontSize: 12, color: '#9aabb8', fontWeight: '600', textTransform: 'uppercase' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#1a2332' },
  input: {
    backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1a2332', borderWidth: 1, borderColor: '#e8ecf0',
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  hint: { fontSize: 13, color: '#5a6a7a', lineHeight: 18 },
  btn: {
    backgroundColor: '#00843D', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 8 },
  secondaryBtnText: { color: '#00843D', fontWeight: '600', fontSize: 14 },
  successIcon: { alignItems: 'center', marginBottom: 4 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#1a2332', textAlign: 'center' },
  successBody: { fontSize: 15, color: '#5a6a7a', textAlign: 'center', lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  footerText: { flex: 1, fontSize: 12, color: '#9aabb8', lineHeight: 17 },
});
