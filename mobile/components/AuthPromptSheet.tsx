import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AuthPromptSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionLabel: string; // e.g. "vote on this poll", "react to this post"
}

export function AuthPromptSheet({ visible, onClose, onSuccess, actionLabel }: AuthPromptSheetProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const AppleAuth = await import('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) {
          Alert.alert('Sign-in failed', error.message);
        } else {
          onSuccess();
        }
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in failed', e?.message ?? 'Unknown error');
      }
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const WebBrowser = await import('expo-web-browser');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'verity://auth-callback', skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert('Google sign-in', 'Use Apple or Email for now.');
        setLoading(false);
        return;
      }
      await WebBrowser.openAuthSessionAsync(data.url, 'verity://auth-callback');
      // Auth state change will be picked up by UserContext listener
      onSuccess();
    } catch {
      Alert.alert('Google sign-in', 'Use Apple or Email for now.');
    }
    setLoading(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="Close sign-in sheet"
        accessibilityRole="button"
      >
        {/* Sheet */}
        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: '#ffffff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: Platform.OS === 'ios' ? 48 : 32,
          }}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 20 }} />

            {/* Shield icon */}
            <View style={{ alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="shield-checkmark" size={28} color="#00843D" />
            </View>

            {/* Heading */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 }}>
              Verify you're a real person
            </Text>

            {/* Subtext */}
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Verity only counts verified voices. Sign in to {actionLabel}.
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color="#00843D" style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* Apple Sign-In */}
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#000000', borderRadius: 12, height: 52, marginBottom: 12 }}
                    onPress={handleAppleSignIn}
                    accessibilityLabel="Continue with Apple"
                    accessibilityRole="button"
                  >
                    <Ionicons name="logo-apple" size={20} color="#ffffff" />
                    <Text style={{ fontSize: 17, fontWeight: '600', color: '#ffffff' }}>Continue with Apple</Text>
                  </Pressable>
                )}

                {/* Google Sign-In */}
                <Pressable
                  style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 12, height: 52, borderWidth: 1, borderColor: '#D1D5DB', marginBottom: 20 }}
                  onPress={handleGoogleSignIn}
                  accessibilityLabel="Continue with Google"
                  accessibilityRole="button"
                >
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: '#1A1A1A' }}>Continue with Google</Text>
                </Pressable>
              </>
            )}

            {/* Trust text */}
            <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 }}>
              We verify accounts to keep bots out and ensure every voice is real.
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
