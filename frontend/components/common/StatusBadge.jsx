import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const STATUS_CONFIG = {
  PLACED:     { label: 'Placed',           bg: COLORS.infoLight,    text: COLORS.info,    dot: COLORS.info },
  ACCEPTED:   { label: 'Accepted',         bg: COLORS.warningLight, text: COLORS.warning, dot: COLORS.warning },
  PREPARING:  { label: 'Preparing',        bg: COLORS.warningLight, text: COLORS.warning, dot: COLORS.warning },
  READY:      { label: 'Ready for Pickup', bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  COMPLETED:  { label: 'Completed',        bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  PICKED_UP:  { label: 'Picked up',        bg: COLORS.infoLight,    text: COLORS.info,    dot: COLORS.info },
  DELIVERED:  { label: 'Delivered',         bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  SERVED:     { label: 'Served',            bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  REJECTED:   { label: 'Rejected',          bg: COLORS.dangerLight,  text: COLORS.danger,  dot: COLORS.danger },
  CANCELLED:  { label: 'Cancelled',         bg: COLORS.dangerLight,  text: COLORS.danger,  dot: COLORS.danger },
  SUCCESS:    { label: 'Paid',              bg: COLORS.successLight, text: COLORS.success, dot: COLORS.success },
  PENDING:    { label: 'Payment Pending',   bg: COLORS.warningLight, text: COLORS.warning, dot: COLORS.warning },
  FAILED:     { label: 'Payment Failed',    bg: COLORS.dangerLight,  text: COLORS.danger,  dot: COLORS.danger },
};

const StatusBadge = ({ status, size = 'default' }) => {
  const config = STATUS_CONFIG[status] || {
    label: String(status || 'Unknown').replaceAll('_', ' '),
    bg: '#F3F4F6',
    text: '#374151',
    dot: '#9CA3AF',
  };
  const isSmall = size === 'small';

  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSmall]}
      accessibilityLabel={`Status: ${config.label}`}
      accessibilityRole="text"
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.text, { color: config.text }, isSmall && styles.textSmall]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
    alignSelf: 'flex-start',
    gap: 5,
  },
  badgeSmall: {
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSmall: {
    fontSize: 10,
    fontWeight: '800',
  },
});

export default StatusBadge;
