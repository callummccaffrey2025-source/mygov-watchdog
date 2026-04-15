import * as Haptics from 'expo-haptics';

/** Light haptic tap for UI interactions (follow, bookmark, vote, tab switch) */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium haptic for confirmations (send, submit) */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success notification haptic (pull-to-refresh complete) */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
