import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const Button = ({ title, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle, accessibilityLabel, testID, icon, size = 'default' }) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      activeOpacity={0.75}
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        isPrimary && styles.btnPrimary,
        isSecondary && styles.btnSecondary,
        isOutline && styles.btnOutline,
        isDanger && styles.btnDanger,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? COLORS.primary : COLORS.textInverse} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.text,
              isSmall && styles.textSmall,
              isPrimary && styles.textPrimary,
              isSecondary && styles.textSecondary,
              isOutline && styles.textOutline,
              isDanger && styles.textDanger,
              disabled && styles.textDisabled,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: THEME.layout.touchTarget,
    borderRadius: THEME.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
    flexDirection: 'row',
  },
  buttonSmall: {
    minHeight: 48,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    ...THEME.shadow.md,
  },
  btnSecondary: {
    backgroundColor: COLORS.primaryLight,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
    ...THEME.shadow.sm,
  },
  btnDisabled: {
    backgroundColor: '#E5E7EB',
    borderColor: '#E5E7EB',
    elevation: 0,
    shadowOpacity: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    marginRight: THEME.spacing.xs,
  },
  text: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: 13,
    fontWeight: '700',
  },
  textPrimary: {
    color: COLORS.textInverse,
  },
  textSecondary: {
    color: COLORS.primary,
  },
  textOutline: {
    color: COLORS.primary,
  },
  textDanger: {
    color: COLORS.textInverse,
  },
  textDisabled: {
    color: '#9CA3AF',
  },
});

export default Button;
