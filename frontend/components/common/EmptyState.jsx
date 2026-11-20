import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';
import Button from './Button';

const EmptyState = ({ title = 'No items found', message = 'Try searching for something else or explore categories.', buttonTitle, onButtonPress, icon }) => {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.iconCircle}>
        {icon || <UtensilsCrossed size={36} color={COLORS.primary} strokeWidth={1.5} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {buttonTitle && onButtonPress && (
        <Button title={buttonTitle} onPress={onButtonPress} style={styles.button} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.md,
    paddingVertical: THEME.spacing.xxl,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.lg,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.card,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  title: {
    ...THEME.type.section,
    color: COLORS.textPrimary,
    marginBottom: THEME.spacing.xs,
    textAlign: 'center',
  },
  message: {
    ...THEME.type.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: THEME.spacing.lg,
  },
  button: {
    minWidth: 160,
  },
});

export default EmptyState;
