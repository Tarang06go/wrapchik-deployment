import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Clock3, MapPin, ShoppingBag, XCircle } from 'lucide-react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import LoadingIndicator from '../components/common/LoadingIndicator';
import ErrorState from '../components/common/ErrorState';
import orderService from '../services/orderService';
import COLORS from '../constants/colors';
import { shouldCelebrateOrderPlacement } from '../utils/orderCelebrationCore';
import { runAudioPlayerCommand } from '../utils/safeAudioPlayerCommand.mjs';

function progressMessage(status) {
  if (status === 'PLACED') return 'Your order request is with the outlet. We’ll show updates here.';
  if (status === 'ACCEPTED' || status === 'PREPARING') return 'The kitchen has accepted your order and is preparing it.';
  if (status === 'READY') return 'Your order is ready. Please follow the pickup details below.';
  if (status === 'REJECTED' || status === 'CANCELLED') return `This order is ${status.toLowerCase()}. Check the order details or contact campus support.`;
  return 'Your order details and latest status are below.';
}

function PartyPopperGraphic() {
  return (
    <Svg width={96} height={96} viewBox="0 0 96 96">
      <Path d="M62 48 82 22M67 54 91 49M59 42 57 15M52 46 38 26" stroke="#F4B942" strokeWidth="3" strokeLinecap="round" />
      <Circle cx="82" cy="18" r="4" fill="#F05D7A" />
      <Circle cx="90" cy="47" r="3.5" fill="#2E9D78" />
      <Rect x="52" y="12" width="7" height="7" rx="1.5" fill="#7B61C9" transform="rotate(18 55.5 15.5)" />
      <Path d="m77 35 4-7 4 7-4 6z" fill="#FF8A5B" />
      <Path d="M21 62 63 45 54 85Z" fill="#FF5A1F" stroke="#C8431B" strokeWidth="2" strokeLinejoin="round" />
      <Path d="m26 60 5 19M34 57l6 20M43 53l6 20" stroke="#FFD7A3" strokeWidth="3" strokeLinecap="round" />
      <Path d="m60 46 9-4 2 6-9 4z" fill="#FFD36A" stroke="#B98016" strokeWidth="1.5" strokeLinejoin="round" />
      <Circle cx="73" cy="25" r="2.5" fill="#FF5A1F" />
      <Circle cx="46" cy="28" r="3" fill="#F05D7A" />
    </Svg>
  );
}

export default function OrderConfirmationScreen() {
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(!orderId);
  const [reduceMotion, setReduceMotion] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [staticCelebration, setStaticCelebration] = useState(false);
  const successScale = useRef(new Animated.Value(1)).current;
  const partyPopperProgress = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const celebrationPlayedFor = useRef('');
  const staticCelebrationTimer = useRef(null);
  const celebrationPlayer = useAudioPlayer(require('../assets/sounds/celebration-pop.wav'));
  const confettiRef = useRef(null);
  if (!confettiRef.current) {
    const colors = [COLORS.primary, '#F4B942', '#FF8A5B', '#EACDAF', '#2E9D78', '#7B61C9', '#F05D7A'];
    confettiRef.current = Array.from({ length: 32 }, (_, index) => {
      const sideBurst = index < 16;
      const leftBurst = index < 8;
      const burstParticle = index % 8;
      return {
        progress: new Animated.Value(0),
        left: sideBurst
          ? (leftBurst ? `${4 + (burstParticle % 3) * 2}%` : `${90 + (burstParticle % 3) * 1.5}%`)
          : `${3 + ((index * 37) % 94)}%`,
        drift: sideBurst
          ? (leftBurst ? 55 + (burstParticle % 4) * 22 : -55 - (burstParticle % 4) * 22)
          : ((index * 43) % 121) - 60,
        fall: sideBurst ? 100 + (burstParticle % 5) * 34 : 360 + (index % 6) * 38,
        top: sideBurst ? `${22 + (burstParticle % 3) * 2}%` : '0%',
        color: colors[(index * 3) % colors.length],
        delay: sideBurst ? burstParticle * 20 : 90 + (index % 29) * 22,
        size: sideBurst ? 9 + (burstParticle % 3) * 2 : 8 + (index % 4) * 2,
        round: index % 3 === 0,
      };
    });
  }
  const confetti = confettiRef.current;
  const requestedCelebration = params.celebrate === '1' || (Array.isArray(params.celebrate) && params.celebrate[0] === '1');
  const celebrate = shouldCelebrateOrderPlacement(requestedCelebration, order);
  const orderWasDeclined = ['REJECTED', 'CANCELLED'].includes(order?.orderStatus);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(Boolean(value)); }).catch(() => setReduceMotion(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => setReduceMotion(Boolean(value)));
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!celebrate || loading || reduceMotion === null || !orderId || celebrationPlayedFor.current === orderId) return undefined;
    celebrationPlayedFor.current = orderId;
    setShowCelebration(true);
    setStaticCelebration(reduceMotion);
    let active = true;
    void (async () => {
      try {
        // Mix with other audio, but honor silent/vibrate mode and the device's media volume.
        await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
        if (!active) return;
        const reportAudioError = audioError => {
          if (__DEV__) console.warn('[Order celebration sound unavailable]', audioError);
        };
        await runAudioPlayerCommand(celebrationPlayer, 'seekTo', [0], () => active, reportAudioError);
        if (!active) return;
        try { celebrationPlayer.volume = 0.52; } catch (audioError) { reportAudioError(audioError); }
        await runAudioPlayerCommand(celebrationPlayer, 'play', [], () => active, reportAudioError);
      } catch (audioError) {
        if (__DEV__) console.warn('[Order celebration sound unavailable]', audioError);
      }
    })();

    if (reduceMotion) {
      successScale.setValue(1);
      partyPopperProgress.forEach(progress => progress.setValue(1));
      confetti.forEach(piece => piece.progress.setValue(1));
      // useAudioPlayer releases its native player when this route unmounts.
      // Let the short bundled sound finish naturally; never pause a player in cleanup.
      return () => { active = false; };
    }

    successScale.setValue(0.55);
    partyPopperProgress.forEach(progress => progress.setValue(0));
    confetti.forEach(piece => piece.progress.setValue(0));
    const animation = Animated.parallel([
      ...confetti.map(piece => Animated.timing(piece.progress, { toValue: 1, duration: 1550, delay: piece.delay, useNativeDriver: true })),
      Animated.spring(successScale, { toValue: 1, damping: 8, stiffness: 180, useNativeDriver: true }),
      ...partyPopperProgress.map((progress, index) => Animated.sequence([
        Animated.delay(index * 90),
        Animated.spring(progress, { toValue: 1, damping: 7, stiffness: 190, useNativeDriver: true }),
      ])),
    ]);
    animation.start(({ finished }) => {
      if (finished && active) {
        setShowCelebration(false);
        setStaticCelebration(false);
      }
    });
    return () => { active = false; animation.stop(); };
  }, [celebrate, loading, reduceMotion, orderId, confetti, partyPopperProgress, successScale, celebrationPlayer]);

  useEffect(() => {
    if (reduceMotion !== true || !showCelebration || celebrationPlayedFor.current !== orderId) return undefined;
    setStaticCelebration(true);
    successScale.setValue(1);
    partyPopperProgress.forEach(progress => progress.setValue(1));
    confetti.forEach(piece => piece.progress.setValue(1));
    if (staticCelebrationTimer.current) clearTimeout(staticCelebrationTimer.current);
    staticCelebrationTimer.current = setTimeout(() => {
      setShowCelebration(false);
      setStaticCelebration(false);
      staticCelebrationTimer.current = null;
    }, 1700);
    return undefined;
  }, [confetti, orderId, partyPopperProgress, reduceMotion, showCelebration, successScale, celebrationPlayer]);

  useEffect(() => () => {
    if (staticCelebrationTimer.current) clearTimeout(staticCelebrationTimer.current);
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); setError(true); return; }
    setLoading(true);
    try {
      const response = await orderService.getOrderById(orderId);
      if (!response?.success || !response.order) throw new Error('Order details are unavailable.');
      setOrder(response.order);
      setError(false);
    } catch (e) {
      console.warn('[Order Confirmation Error]:', e);
      setError(true);
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  if (loading) return <LoadingIndicator message="Loading your order details…" />;

  return (
    <View style={styles.container}>
      <Header title={order ? 'Order confirmation' : orderId ? 'Order details' : 'Order status'} showBack={false} showCart={false} />
      {error || !order ? <>
        <ErrorState
          title={orderId ? 'We couldn’t load the order' : 'No order to confirm'}
          message={orderId ? 'Your order may still have been placed. Check your order history or try loading the details again.' : 'No order reference was provided. Open your order history to check an existing order.'}
          onRetry={orderId ? fetchOrder : undefined}
        />
        {!orderId ? <Button title="Open order history" onPress={() => router.replace('/(tabs)/orders')} /> : null}
      </> : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.successMarkWrap}>
              <Animated.View style={[styles.iconCircle, orderWasDeclined && styles.declinedCircle, { transform: [{ scale: successScale }] }]}>{orderWasDeclined ? <XCircle size={38} color={COLORS.danger} /> : <CheckCircle2 size={38} color={COLORS.success} />}</Animated.View>
            </View>
            <Text style={styles.eyebrow}>ORDER #{order.orderNumber}</Text>
            <Text style={styles.title}>{orderWasDeclined ? 'Order update' : 'Thanks for ordering'}</Text>
            <Text style={styles.subtitle}>{progressMessage(order.orderStatus)}</Text>
            <View style={styles.statusRow}><Text style={styles.label}>Order status</Text><StatusBadge status={order.orderStatus} /></View>
            <View style={styles.statusRow}><Text style={styles.label}>Payment status</Text><StatusBadge status={order.paymentStatus} /></View>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}><ShoppingBag size={17} color={COLORS.primary} /><Text style={styles.sectionTitle}>Your items</Text></View>
            {(order.items || []).map((item, index) => <View key={`${item.productId || item.name}-${index}`} style={styles.itemRow}><Text style={styles.itemQuantity}>{item.quantity}×</Text><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text>{item.customizations?.length ? <Text style={styles.itemCustom}>{item.customizations.map((entry) => entry.name).join(' · ')}</Text> : null}</View><Text style={styles.itemPrice}>₹{item.itemTotal ?? (item.priceAtPurchase * item.quantity)}</Text></View>)}
            <View style={styles.divider} />
            {order.subtotal != null ? <View style={styles.detailRow}><Text style={styles.label}>Subtotal</Text><Text style={styles.detailValue}>₹{order.subtotal}</Text></View> : null}
            {Number(order.discountAmount) > 0 ? <View style={styles.detailRow}><Text style={styles.label}>Coupon{order.couponCode ? ` · ${order.couponCode}` : ''}</Text><Text style={styles.discountValue}>−₹{order.discountAmount}</Text></View> : null}
            {order.taxAndFees != null ? <View style={styles.detailRow}><Text style={styles.label}>Taxes & fees</Text><Text style={styles.detailValue}>₹{order.taxAndFees}</Text></View> : null}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Order total</Text><Text style={styles.totalValue}>₹{order.totalAmount}</Text></View>
            <View style={styles.detailRow}><Text style={styles.label}>Payment</Text><Text style={styles.detailValue}>{order.paymentMethod === 'CASHFREE' ? 'Legacy Cashfree' : order.paymentMethod === 'RAZORPAY' ? 'Legacy Razorpay' : order.paymentMethod === 'UPI_QR' ? 'UPI QR' : 'Cash at counter'}</Text></View>
            {order.orderType === 'TAKEAWAY' ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><View style={styles.itemCopy}><Text style={styles.locationTitle}>Pickup</Text><Text style={styles.locationText}>{order.pickupLocation || 'Wrapchik SAC Counter'}</Text>{order.pickupTimeSlot ? <Text style={styles.locationText}>Time: {order.pickupTimeSlot}</Text> : null}</View></View> : null}
            {order.orderType === 'DELIVERY' ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><View style={styles.itemCopy}><Text style={styles.locationTitle}>Delivery</Text><Text style={styles.locationText}>{[order.hostel, order.roomNumber].filter(Boolean).join(' · ')}</Text></View></View> : null}
            {order.orderType === 'DINE_IN' && order.tableId ? <View style={styles.location}><MapPin size={16} color={COLORS.primary} /><Text style={styles.locationText}>Dine-in at your selected table</Text></View> : null}
            {order.estimatedPrepTime ? <View style={styles.prep}><Clock3 size={15} color={COLORS.textSecondary} /><Text style={styles.prepText}>Estimated preparation: {order.estimatedPrepTime} min</Text></View> : null}
            <Button title="Track this order" onPress={() => router.replace(`/order-tracking/${order._id}`)} style={styles.primaryAction} />
            <Button title="Back to menu" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </ScrollView>
      )}
      {showCelebration ? <View pointerEvents="none" accessible={false} style={styles.celebrationLayer}>
        {partyPopperProgress.map((progress, index) => <Animated.View key={`party-popper-${index}`} accessible={false} style={[styles.partyPopper, index === 0 ? styles.partyPopperLeft : styles.partyPopperRight, {
          opacity: staticCelebration ? 1 : progress,
          transform: staticCelebration ? [{ scaleX: index === 0 ? 1 : -1 }] : [
            { scaleX: index === 0 ? 1 : -1 },
            { scale: progress.interpolate({ inputRange: [0, 0.68, 1], outputRange: [0.45, 1.3, 1] }) },
            { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [index === 0 ? '-35deg' : '35deg', index === 0 ? '-12deg' : '12deg'] }) },
          ],
        }]}><PartyPopperGraphic /></Animated.View>)}
        {confetti.map((piece, index) => <Animated.View key={`confetti-${index}`} style={[styles.confettiPiece, {
          top: staticCelebration ? `${5 + ((index * 29) % 82)}%` : piece.top,
          left: piece.left,
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 1.65,
          backgroundColor: piece.color,
          borderRadius: piece.round ? piece.size / 2 : 2,
          opacity: staticCelebration ? 0.94 : piece.progress.interpolate({ inputRange: [0, 0.06, 0.72, 1], outputRange: [0, 1, 0.94, 0] }),
          transform: staticCelebration ? [] : [
            { translateX: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
            { translateY: piece.progress.interpolate({ inputRange: [0, 1], outputRange: [-15, piece.fall] }) },
            { rotate: piece.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 ? '520deg' : '-520deg'] }) },
          ],
        }]} />)}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  celebrationLayer: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999, overflow: 'visible' },
  confettiPiece: { position: 'absolute', top: 0, borderRadius: 2 },
  partyPopper: { position: 'absolute', top: '12%', width: 96, height: 96, zIndex: 1000 },
  partyPopperLeft: { left: '1%' },
  partyPopperRight: { right: '1%' },
  scrollContent: { padding: 18, paddingBottom: 32, maxWidth: 660, width: '100%', alignSelf: 'center' },
  card: { padding: 22, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border },
  iconCircle: { width: 64, height: 64, borderRadius: 22, backgroundColor: COLORS.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  successMarkWrap: { position: 'relative', alignSelf: 'flex-start' },
  declinedCircle: { backgroundColor: COLORS.dangerLight },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 42 },
  label: { color: COLORS.textSecondary, fontSize: 13 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  itemQuantity: { color: COLORS.primary, fontSize: 13, fontWeight: '900', width: 28 },
  itemCopy: { flex: 1 }, itemName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  itemCustom: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  itemPrice: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }, totalValue: { color: COLORS.primary, fontSize: 19, fontWeight: '900' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, detailValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }, discountValue: { color: COLORS.success, fontSize: 13, fontWeight: '800' },
  location: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 15, backgroundColor: COLORS.primaryLight, marginBottom: 12 },
  locationTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 2 }, locationText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  prep: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 }, prepText: { color: COLORS.textSecondary, fontSize: 12 },
  primaryAction: { marginBottom: 10 },
});
