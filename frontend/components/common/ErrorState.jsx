import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import Button from './Button';

export default function ErrorState({ title = 'Could not load the menu', message = 'Check your connection and try again.', onRetry, retrying = false }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon}>
        <WifiOff size={28} color={COLORS.danger} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button
          title="Try again"
          onPress={onRetry}
          loading={retrying}
          variant="outline"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.md,
    paddingVertical: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.lg,
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: THEME.radius.lg,
    ...THEME.shadow.card,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  title: {
    ...THEME.type.section,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    ...THEME.type.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: THEME.spacing.xs,
    maxWidth: 300,
  },
  button: {
    marginTop: THEME.spacing.lg,
    minWidth: 150,
  },
});
