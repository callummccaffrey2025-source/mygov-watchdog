import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  mpName: string | null;
  onEnable: () => void;
  onDismiss: () => void;
}

export function NotificationPermissionModal({ visible, mpName, onEnable, onDismiss }: Props) {
  const body = mpName
    ? `Get notified when ${mpName} votes, your Daily Brief arrives, and major political news breaks.`
    : 'Get your Daily Brief each morning, plus alerts when parliament votes on issues that matter to you.';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={32} color="#00843D" />
          </View>
          <Text style={styles.title}>Stay informed about Parliament</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={styles.enableBtn} onPress={onEnable}>
            <Text style={styles.enableBtnText}>Enable Notifications</Text>
          </Pressable>
          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a2332',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: '#5a6a7a',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableBtn: {
    backgroundColor: '#00843D',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  enableBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissBtnText: {
    color: '#9aabb8',
    fontSize: 14,
  },
});
