import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const runHaptic = operation => {
  if (Platform.OS === 'web') return;
  Promise.resolve().then(operation).catch(() => {});
};

export const selectionHaptic = () => runHaptic(() => Haptics.selectionAsync());
export const addToCartHaptic = () => runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const successHaptic = () => runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
