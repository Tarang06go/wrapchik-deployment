import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

function ShimmerBlock({ style }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const bgColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.shimmerBase, COLORS.shimmerHighlight],
  });

  return <Animated.View style={[style, { backgroundColor: bgColor }]} />;
}

function ProductSkeleton() {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ShimmerBlock style={styles.image} />
      <View style={styles.content}>
        <ShimmerBlock style={[styles.line, styles.name]} />
        <ShimmerBlock style={[styles.line, styles.description]} />
        <View style={styles.footer}>
          <ShimmerBlock style={[styles.line, styles.price]} />
          <ShimmerBlock style={styles.add} />
        </View>
      </View>
    </View>
  );
}

export default function ProductListSkeleton({ count = 3 }) {
  return (
    <View accessibilityLabel="Loading menu items" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <ProductSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.radius.lg,
    backgroundColor: COLORS.cardBackground,
    ...THEME.shadow.card,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: THEME.radius.md,
  },
  content: {
    flex: 1,
    marginLeft: THEME.spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  line: {
    borderRadius: THEME.radius.xs,
  },
  name: {
    height: 16,
    width: '65%',
  },
  description: {
    height: 28,
    width: '90%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    height: 16,
    width: 52,
  },
  add: {
    height: 32,
    width: 72,
    borderRadius: THEME.radius.sm,
  },
});
