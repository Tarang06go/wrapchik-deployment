import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { CartProvider } from '../context/CartContext';
import { NotificationProvider } from '../context/NotificationContext';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { backFallback } from '../utils/navigation';
import OfflineBanner from '../components/common/OfflineBanner';
import RouteErrorBoundary from '../components/common/RouteErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../utils/reducedMotion';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function reportExpensiveRender(id, phase, actualDuration, baseDuration) {
  if (__DEV__ && actualDuration >= 16) {
    console.warn('[Wrapchik Render] slow commit', { id, phase, actualDuration: Math.round(actualDuration), baseDuration: Math.round(baseDuration) });
  }
}

function PushNotificationBridge() {
  const router = useRouter();
  const { user, isLoading } = React.useContext(AuthContext);
  const lastResponseId = useRef(null);
  useEffect(() => {
    if (Platform.OS === 'web' || isLoading) return undefined;
    const navigateFromResponse = (response) => {
      const responseId = response?.notification?.request?.identifier;
      if (!responseId || lastResponseId.current === responseId) return;
      lastResponseId.current = responseId;
      Notifications.clearLastNotificationResponseAsync().catch((error) => console.warn('[Push Navigation] Could not clear launch response:', error.message));
      const data = response.notification.request.content.data || {};
      if (user?.role === 'admin') router.push('/admin/orders');
      else if (typeof data.orderId === 'string') router.push(`/order-tracking/${data.orderId}`);
      else if (data.type === 'MEAL_PLAN_REMINDER') router.push('/meal-plans');
      else router.push('/notifications');
    };
    Notifications.getLastNotificationResponseAsync().then(navigateFromResponse).catch((error) => console.warn('[Push Navigation] Could not read launch response:', error.message));
    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromResponse);
    return () => subscription.remove();
  }, [router, user?.role, isLoading]);
  return null;
}

function AndroidBackFallback() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = React.useContext(AuthContext);
  useEffect(() => {
    if (Platform.OS !== 'android' || isLoading) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      const fallback = backFallback(pathname);
      if (!fallback || fallback === pathname) return false;
      if (pathname.startsWith('/admin/') && user?.role !== 'admin') return false;
      router.replace(fallback);
      return true;
    });
    return () => subscription.remove();
  }, [isLoading, pathname, router, user?.role]);
  return null;
}

function MobileInteractionDiagnostics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!__DEV__) return undefined;
    console.log('[Wrapchik Navigation] screen mounted', pathname);
    return () => console.log('[Wrapchik Navigation] screen unmounted', pathname);
  }, [pathname]);

  useEffect(() => {
    if (!__DEV__) return undefined;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      console.log('[Wrapchik Keyboard] did-show', { screen: pathname, height: event.endCoordinates?.height });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      console.log('[Wrapchik Keyboard] did-hide', { screen: pathname });
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <SafeAreaProvider>
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
        <CartProvider>
          <View style={styles.root}>
          <StatusBar style="dark" />
        <OfflineBanner />
        <PushNotificationBridge />
        <AndroidBackFallback />
        <MobileInteractionDiagnostics />
        <RouteErrorBoundary>
        <React.Profiler id="expo-router" onRender={reportExpensiveRender}>
        <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />

          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/signup" />
          <Stack.Screen name="(auth)/email-verification" />
          <Stack.Screen name="(auth)/forgot-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="offers" />
          <Stack.Screen name="product/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="order-confirmation" />
          <Stack.Screen name="order-tracking/[id]" />
          <Stack.Screen name="favourites" />
          <Stack.Screen name="support" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="meal-plans" />
          <Stack.Screen name="review-order" />
          <Stack.Screen name="loyalty" />
          <Stack.Screen name="group-order" />
          <Stack.Screen name="my-groups" />
          <Stack.Screen name="my-group/[id]" />
          <Stack.Screen name="group/[code]" />
          <Stack.Screen name="group-cart/[id]" />
          <Stack.Screen name="report-issue" />
          <Stack.Screen name="admin/issues" />
        </Stack>
        </React.Profiler>
        </RouteErrorBoundary>
          </View>
        </CartProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
