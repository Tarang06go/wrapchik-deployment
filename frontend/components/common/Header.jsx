import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ShoppingBag, ArrowLeft, Shield, Bell, Menu } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import COLORS from '../../constants/colors';
import { NotificationContext } from '../../context/NotificationContext';
import { safeBack } from '../../utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Header = ({ title, showBack = false, showCart = true, showNotifications = true, showMenu = false, onMenuPress }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount } = useContext(CartContext);
  const { isAdmin } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: Math.max(0, insets.top || 0) }]}>
      <View style={styles.headerContainer}>
        <View style={styles.leftContainer}>
          {showMenu && !showBack ? <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Open navigation menu" hitSlop={8}><Menu size={23} color={COLORS.textPrimary} /></TouchableOpacity> : null}
          {showBack ? (
            <TouchableOpacity onPress={() => safeBack(router, pathname)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
              <ArrowLeft size={23} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.brandTitle} numberOfLines={1}>Wrapchik</Text>
          )}
        </View>

        {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}

        <View style={styles.rightContainer}>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin/dashboard')}
              style={styles.adminBadgeBtn}
              accessibilityRole="button"
              accessibilityLabel="Open administrator dashboard"
            >
              <Shield size={15} color="#FFFFFF" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </TouchableOpacity>
          )}

          {showNotifications && (
            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.cartBtn} accessibilityRole="button" accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
              <Bell size={21} color={COLORS.textPrimary} />
              {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </TouchableOpacity>
          )}

          {showCart && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.cartBtn} accessibilityRole="button" accessibilityLabel={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
              <ShoppingBag size={22} color={COLORS.textPrimary} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: COLORS.background,
    maxWidth: 1120,
    width: '100%',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  iconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  adminBadgeBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 4,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default Header;
