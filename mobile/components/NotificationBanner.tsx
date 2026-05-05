import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const AUTO_DISMISS_MS = 5000;

export interface BannerNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

interface Props {
  notification: BannerNotification | null;
  onPress: (data: Record<string, any>) => void;
  onDismiss: () => void;
}

const NOTIF_ICONS: Record<string, { name: string; bg: string; color: string }> = {
  mp_vote:   { name: 'checkmark-done',   bg: '#E8F5EE', color: '#00843D' },
  mp_speech: { name: 'mic',              bg: '#EEF2FF', color: '#4F46E5' },
  mp_news:   { name: 'newspaper',        bg: '#FEF3C7', color: '#B45309' },
  mp_post:   { name: 'chatbubble-ellipses', bg: '#E8F5EE', color: '#00843D' },
  mp_absent: { name: 'alert-circle',     bg: '#FDECEA', color: '#DC3545' },
  bill:      { name: 'document-text',    bg: '#EEF2FF', color: '#4F46E5' },
  news:      { name: 'newspaper',        bg: '#FEF3C7', color: '#B45309' },
  default:   { name: 'notifications',    bg: '#E8F5EE', color: '#00843D' },
};

function getIcon(screen?: string) {
  if (!screen) return NOTIF_ICONS.default;
  return NOTIF_ICONS[screen] ?? NOTIF_ICONS.default;
}

export function NotificationBanner({ notification, onPress, onDismiss }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => dismissRef.current());
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -5,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -20) {
          if (timerRef.current) clearTimeout(timerRef.current);
          Animated.timing(translateY, {
            toValue: -120,
            duration: 200,
            useNativeDriver: true,
          }).start(() => dismissRef.current());
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (!notification) return;

    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification?.id]);

  if (!notification) return null;

  const screen = notification.data?.screen as string | undefined;
  const icon = getIcon(screen);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: (insets.top || 12) + SPACING.xs,
        paddingHorizontal: SPACING.sm,
        transform: [{ translateY }],
      }}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={() => {
          dismiss();
          if (notification.data) onPress(notification.data);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.md,
          backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.md,
          ...SHADOWS.lg,
          ...Platform.select({
            ios: {},
            android: { elevation: 8 },
          }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: BORDER_RADIUS.md,
            backgroundColor: icon.bg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: FONT_SIZE.small,
              fontWeight: FONT_WEIGHT.bold,
              color: colors.text,
            }}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text
            style={{
              fontSize: FONT_SIZE.caption,
              color: colors.textBody,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {notification.body}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}
