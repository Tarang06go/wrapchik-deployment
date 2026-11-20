import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const LoadingIndicator = ({ message = 'Loading...', compact = false }) => {
  return (
    <View
      style={[styles.container, compact && styles.compact]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <View style={styles.spinnerWrap}>
        <ActivityIndicator size={compact ? 'small' : 'large'} color={COLORS.primary} />
      </View>
      <Text style={[styles.text, compact && styles.compactText]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
    backgroundColor: COLORS.background,
    borderRadius: THEME.radius.lg,
    minHeight: 200,
  },
  compact: {
    minHeight: 64,
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    padding: THEME.spacing.md,
    borderRadius: THEME.radius.md,
  },
  spinnerWrap: {
    // future: could add a subtle halo ring behind the spinner
  },
  text: {
    marginTop: THEME.spacing.md,
    ...THEME.type.label,
    color: COLORS.textSecondary,
  },
  compactText: {
    marginTop: 0,
  },
});

export default LoadingIndicator;
