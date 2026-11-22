import React, { useEffect, useContext, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import COLORS from '../constants/colors';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useContext(AuthContext);
  const startedAt = useRef(Date.now());
  const logoEntrance = useRef(new Animated.Value(0)).current;
  const copyEntrance = useRef(new Animated.Value(0)).current;
  const foodFloaters = useRef([
    { emoji: '🌯', motion: new Animated.Value(0), position: { top: '19%', left: '9%' }, delay: 0 },
    { emoji: '🍟', motion: new Animated.Value(0), position: { top: '23%', right: '10%' }, delay: 180 },
    { emoji: '🍔', motion: new Animated.Value(0), position: { bottom: '22%', left: '12%' }, delay: 340 },
    { emoji: '🥤', motion: new Animated.Value(0), position: { bottom: '19%', right: '12%' }, delay: 520 },
  ]).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(Boolean(value)); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => setReduceMotion(Boolean(value)));
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { logoEntrance.setValue(1); copyEntrance.setValue(1); return undefined; }
    logoEntrance.setValue(0);
    copyEntrance.setValue(0);
    const animation = Animated.parallel([
      Animated.spring(logoEntrance, { toValue: 1, damping: 13, stiffness: 125, mass: 0.8, useNativeDriver: true }),
      Animated.timing(copyEntrance, { toValue: 1, duration: 620, delay: 120, useNativeDriver: true }),
    ]);
    animation.start();
    const floaterLoops = foodFloaters.map((floater, index) => Animated.loop(Animated.sequence([
      Animated.timing(floater.motion, { toValue: 0, duration: 1, delay: floater.delay, useNativeDriver: true }),
      Animated.timing(floater.motion, { toValue: 1, duration: 1200 + index * 110, useNativeDriver: true }),
      Animated.timing(floater.motion, { toValue: 0, duration: 1300 + index * 100, useNativeDriver: true }),
    ])));
    floaterLoops.forEach(loop => loop.start());
    return () => { animation.stop(); floaterLoops.forEach(loop => loop.stop()); };
  }, [copyEntrance, foodFloaters, logoEntrance, reduceMotion]);

  useEffect(() => {
    if (isLoading) return;

    if (__DEV__) console.log(`[Wrapchik] splash auth resolved: ${isAuthenticated ? 'authenticated' : 'signed-out'}`);

    // Keep a brief branded moment after auth is ready, without holding startup open indefinitely.
    const remaining = Math.max(0, 3000 - (Date.now() - startedAt.current));
    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        if (user.role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        {foodFloaters.map((floater, index) => <Animated.Text key={floater.emoji} style={[styles.foodFloater, floater.position, {
          opacity: floater.motion.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] }),
          transform: [
            { translateY: floater.motion.interpolate({ inputRange: [0, 1], outputRange: [5, -11] }) },
            { rotate: floater.motion.interpolate({ inputRange: [0, 1], outputRange: [index % 2 ? '7deg' : '-7deg', index % 2 ? '-5deg' : '5deg'] }) },
          ],
        }]}>{floater.emoji}</Animated.Text>)}
      </View>
      <Animated.View style={{ opacity: logoEntrance, transform: [{ scale: logoEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }, { rotate: logoEntrance.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) }] }}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>W</Text>
      </View>
      </Animated.View>
      <Animated.View style={{ opacity: copyEntrance, alignItems: 'center', transform: [{ translateY: copyEntrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Text style={styles.brandTitle}>WRAPCHIK</Text>
      <Text style={styles.tagline}>Campus cravings. One tap away.</Text>
      <Text style={styles.subtext}>Campus Food Ordering Platform</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    overflow: 'hidden',
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  subtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  foodFloater: { position: 'absolute', fontSize: 32 },
});
