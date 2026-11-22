import React, { useContext, useEffect, useRef } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock3, Gift, Heart, HelpCircle, Home, LogOut, MapPin, Settings, Shield, Tag, UtensilsCrossed, User, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import COLORS from '../../constants/colors';
import { selectionHaptic } from '../../utils/haptics';
import { useReducedMotion } from '../../utils/reducedMotion';

const links = [
  { label: 'Home', route: '/(tabs)/home', Icon: Home },
  { label: 'Menu', route: '/(tabs)/menu', Icon: UtensilsCrossed },
  { label: 'Deals & Offers', route: '/offers', Icon: Tag },
  { label: 'Track Order', route: '/(tabs)/orders', params: { filter: 'ACTIVE' }, Icon: MapPin },
  { label: 'Order History', route: '/(tabs)/orders', params: { filter: 'COMPLETED' }, Icon: Clock3 },
  { label: 'Share a Meal', route: '/group-order', Icon: Users },
  { label: 'My Groups', route: '/my-groups', Icon: Users, studentsOnly: true },
  { label: 'Rewards', route: '/loyalty', Icon: Gift, studentsOnly: true },
  { label: 'Favourites', route: '/favourites', Icon: Heart },
  { label: 'Support', route: '/support', Icon: HelpCircle },
  { label: 'Profile', route: '/(tabs)/profile', Icon: User },
  { label: 'Settings', route: '/settings', Icon: Settings },
];

export default function AppDrawer({ visible, onClose }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, logout } = useContext(AuthContext);
  const progress = useRef(new Animated.Value(0)).current;
  const closeInFlight = useRef(false);
  const reduceMotion = useReducedMotion();
  const motionDisabled = reduceMotion !== false;

  useEffect(() => {
    if (!visible) return;
    closeInFlight.current = false;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: motionDisabled ? 0 : 210, useNativeDriver: true }).start();
  }, [visible, motionDisabled, progress]);

  const closeAfterAnimation = (action) => {
    if (closeInFlight.current) return;
    closeInFlight.current = true;
    selectionHaptic();
    Animated.timing(progress, { toValue: 0, duration: motionDisabled ? 0 : 170, useNativeDriver: true }).start(({ finished }) => {
      closeInFlight.current = false;
      if (!finished) return;
      onClose?.();
      action?.();
    });
  };

  const handleLogout = () => closeAfterAnimation(() => {
    logout().then(() => router.replace('/(auth)/login')).catch(error => Alert.alert('Could not log out', error?.message || 'Please try again.'));
  });

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-Math.min(width * 0.84, 340), 0] });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.46] });
  const menuLinks = links.filter(link => !link.studentsOnly || user?.role === 'student');

  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeAfterAnimation()}>
    <View style={styles.modalRoot} accessibilityViewIsModal accessibilityLabel="Wrapchik navigation menu">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closeAfterAnimation()} accessibilityRole="button" accessibilityLabel="Close navigation menu" />
      <Animated.View style={[styles.drawer, { width: Math.min(width * 0.84, 340), paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateX }] }]}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.trim()?.[0]?.toUpperCase() || 'W'}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Welcome to Wrapchik'}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email || 'Campus cravings. One tap away.'}</Text>
          </View>
          <TouchableOpacity onPress={() => closeAfterAnimation(() => router.push('/(tabs)/profile'))} style={styles.editButton} accessibilityRole="button" accessibilityLabel="Open profile settings">
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => closeAfterAnimation()} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close navigation menu" hitSlop={6}>
            <X size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.links} keyboardShouldPersistTaps="handled">
          {menuLinks.map(({ label, route, params, Icon }) => <TouchableOpacity key={label} onPress={() => closeAfterAnimation(() => router.push(params ? { pathname: route, params } : route))} style={styles.link} activeOpacity={0.72} accessibilityRole="button" accessibilityLabel={label}>
            <Icon size={20} color={COLORS.textSecondary} /><Text style={styles.linkText}>{label}</Text>
          </TouchableOpacity>)}
          {user?.role === 'admin' ? <TouchableOpacity onPress={() => closeAfterAnimation(() => router.push('/admin/dashboard'))} style={styles.link} activeOpacity={0.72} accessibilityRole="button" accessibilityLabel="Administrator dashboard"><Shield size={20} color={COLORS.primary} /><Text style={styles.linkText}>Administrator dashboard</Text></TouchableOpacity> : null}
        </ScrollView>

        <TouchableOpacity onPress={user ? handleLogout : () => closeAfterAnimation(() => router.push('/(auth)/login'))} style={styles.logout} activeOpacity={0.72} accessibilityRole="button" accessibilityLabel={user ? 'Log out' : 'Sign in'}>
          <LogOut size={19} color={user ? COLORS.danger : COLORS.primary} /><Text style={[styles.logoutText, !user && styles.signInText]}>{user ? 'Log out' : 'Sign in'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111827' },
  drawer: { backgroundColor: '#FFF8F3', maxWidth: 340, paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 18 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#F0E5DE', paddingBottom: 18, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900' },
  email: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  editButton: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  editText: { color: COLORS.primary, fontWeight: '900', fontSize: 12 },
  closeButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  links: { paddingBottom: 12 },
  link: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: '#F3EAE4', paddingHorizontal: 4 },
  linkText: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  logout: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#F0E5DE', paddingHorizontal: 4 },
  logoutText: { color: COLORS.danger, fontSize: 14, fontWeight: '900' },
  signInText: { color: COLORS.primary },
});
