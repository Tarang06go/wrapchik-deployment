import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock3, MapPin, ShoppingBag } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import Header from '../../components/common/Header';
import OrderStatusTimeline from '../../components/order/OrderStatusTimeline';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import ErrorState from '../../components/common/ErrorState';
import orderService from '../../services/orderService';
import { SocketContext } from '../../context/SocketContext';
import COLORS from '../../constants/colors';
import { AuthContext } from '../../context/AuthContext';
import { runAfterPlatformConfirmation } from '../../utils/platformDialogs';
import { newlyCreditedLoyaltyPoints } from '../../utils/loyaltyCelebrationCore';

export default function OrderTrackingScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { socket } = React.useContext(SocketContext);
  const { user } = React.useContext(AuthContext);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pickupQr, setPickupQr] = useState(null);
  const [pickupQrLoading, setPickupQrLoading] = useState(false);
  const [pickupQrError, setPickupQrError] = useState('');
  const [pointsCelebration, setPointsCelebration] = useState(0);
  const [error, setError] = useState(false);
  const lastSocketEventRef = useRef('');
  const pickupQrRef = useRef(null);
  const pickupQrBusyRef = useRef(false);
  const pickupQrRequestRef = useRef(0);
  const orderRef = useRef(null);
  const cancelConfirmationInFlightRef = useRef(new Set());
  const reduceMotionRef = useRef(true);
  const pointsScale = useRef(new Animated.Value(1)).current;
  const pointsOpacity = useRef(new Animated.Value(1)).current;
  const pointsCelebrationTimer = useRef(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduceMotionRef.current = Boolean(value); }).catch(() => { reduceMotionRef.current = true; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotionRef.current = Boolean(value); });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => () => clearTimeout(pointsCelebrationTimer.current), []);

  const loadPickupQr = useCallback(async ({ replace = false } = {}) => {
    if (!id || pickupQrBusyRef.current || (!replace && pickupQrRef.current)) return;
    const requestId = ++pickupQrRequestRef.current;
    pickupQrBusyRef.current = true;
    setPickupQrLoading(true);
    setPickupQrError('');
    try {
      const currentGroupId = orderRef.current?.groupOrderId;
      const result = await orderService.getPickupQr(id, currentGroupId?._id || currentGroupId || null);
      if (!result?.success || !result.pickupUri) throw new Error(result?.message || 'Pickup QR could not be created.');
      if (requestId !== pickupQrRequestRef.current || orderRef.current?.orderStatus !== 'READY') return;
      const next = { uri: result.pickupUri, expiresAt: result.expiresAt };
      pickupQrRef.current = next;
      setPickupQr(next);
    } catch (e) {
      if (requestId === pickupQrRequestRef.current) setPickupQrError(e?.message || 'Pickup QR is temporarily unavailable.');
    } finally {
      if (requestId === pickupQrRequestRef.current) {
        pickupQrBusyRef.current = false;
        setPickupQrLoading(false);
      }
    }
  }, [id]);

  const fetchOrderDetails = useCallback(async ({ refresh = false } = {}) => {
    if (!id) { setError(true); setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await orderService.getOrderById(id);
      if (!res?.success || !res.order) throw new Error('Order could not be found.');
      const previousOrder = orderRef.current;
      const pointsEarned = newlyCreditedLoyaltyPoints(previousOrder, res.order);
      if (pointsEarned > 0 && !reduceMotionRef.current) {
        clearTimeout(pointsCelebrationTimer.current);
        setPointsCelebration(pointsEarned);
        pointsScale.setValue(0.76);
        pointsOpacity.setValue(0);
        Animated.parallel([
          Animated.spring(pointsScale, { toValue: 1, damping: 9, stiffness: 190, useNativeDriver: true }),
          Animated.timing(pointsOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
        pointsCelebrationTimer.current = setTimeout(() => setPointsCelebration(0), 2500);
      }
      orderRef.current = res.order;
      setOrder(res.order);
      setError(false);
      const pickupReady = res.order.orderType === 'TAKEAWAY' && res.order.orderStatus === 'READY' && res.order.paymentStatus === 'SUCCESS';
      if (pickupReady) void loadPickupQr();
      else {
        pickupQrRequestRef.current += 1;
        pickupQrBusyRef.current = false;
        setPickupQrLoading(false);
        pickupQrRef.current = null;
        setPickupQr(null);
        setPickupQrError('');
      }
    } catch (e) {
      console.warn('[Order Tracking Fetch Error]:', e);
      if (!refresh) setError(true);
    } finally { setLoading(false); setRefreshing(false); }
  }, [id, loadPickupQr, pointsOpacity, pointsScale]);

  useEffect(() => {
    setOrder(null);
    orderRef.current = null;
    pickupQrRequestRef.current += 1;
    pickupQrBusyRef.current = false;
    pickupQrRef.current = null;
    setPickupQr(null);
    setPickupQrLoading(false);
    setPickupQrError('');
    setError(false);
    fetchOrderDetails();
  }, [fetchOrderDetails, user?._id]);

  useEffect(() => {
    if (!socket || !id) return undefined;
    const handler = (data) => {
      if (String(data?.orderId) !== String(id)) return;
      const eventKey = `${data.orderId}:${data.orderStatus}:${data.paymentStatus}:${data.updatedAt || ''}`;
      if (lastSocketEventRef.current === eventKey) return;
      lastSocketEventRef.current = eventKey;
      fetchOrderDetails({ refresh: true });
    };
    const onReconnect = () => fetchOrderDetails({ refresh: true });
    socket.on('order_updated', handler);
    socket.on('connect', onReconnect);
    socket.on('refresh_authoritative_state', onReconnect);
    return () => { socket.off('order_updated', handler); socket.off('connect', onReconnect); socket.off('refresh_authoritative_state', onReconnect); };
  }, [socket, id, fetchOrderDetails]);

  const performCancel = async () => {
      if (cancelBusy || !order) return;
      setCancelBusy(true);
      setActionError('');
      try {
        const response = await orderService.cancelOrder(order._id);
        if (!response?.success) throw new Error(response?.message || 'Cancellation was not confirmed.');
        await fetchOrderDetails({ refresh: true });
      } catch (e) { setActionError(e?.message || 'Could not cancel this order. Refresh and try again.'); }
      finally { setCancelBusy(false); }
  };

  const confirmCancel = async () => {
    const message = 'The outlet may already have started preparing it. Paid orders cannot be cancelled here because refunds are not enabled.';
    await runAfterPlatformConfirmation({
      key: order?._id, inFlight: cancelConfirmationInFlightRef.current, platform: Platform.OS,
      title: 'Cancel this order?', message, cancelLabel: 'Keep order', confirmLabel: 'Cancel order', confirmStyle: 'destructive',
      browserWindow: Platform.OS === 'web' && typeof window !== 'undefined' ? window : undefined,
      nativeAlert: (...args) => Alert.alert(...args), action: performCancel,
    });
  };

  if (loading) return <LoadingIndicator message="Loading live order details…" />;
  return (
    <View style={styles.container}>
      <Header title={order ? `Order ${order.orderNumber}` : 'Order tracking'} showBack showCart={false} />
      {error || !order ? <ErrorState title="Order details are unavailable" message="Check your connection and try again, or open your order history." onRetry={() => fetchOrderDetails()} /> : (
        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrderDetails({ refresh: true })} colors={[COLORS.primary]} />}>
          <View style={styles.heroCard}>
            <Text style={styles.eyebrow}>ORDER #{order.orderNumber}</Text>
            <Text style={styles.heroTitle}>{order.orderType === 'TAKEAWAY' ? 'Pickup order' : order.orderType === 'DELIVERY' ? 'Delivery order' : 'Dine-in order'}</Text>
            <Text style={styles.date}>Placed {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            <View style={styles.badgeRow}><StatusBadge status={order.orderStatus} /><StatusBadge status={order.paymentStatus} /></View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}><Clock3 size={17} color={COLORS.primary} /><Text style={styles.sectionTitle}>Order progress</Text></View>
            <OrderStatusTimeline currentStatus={order.orderStatus} orderType={order.orderType || 'TAKEAWAY'} order={order} />
            {order.estimatedPrepTime && ['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.orderStatus) ? <Text style={styles.estimate}>Prep estimate: about {order.estimatedPrepTime} minutes{order.estimatedPrepTimeSource === 'rolling_hourly_average' ? ` · based on ${order.estimatedPrepTimeSamples} similar recent orders` : ' · outlet estimate'}</Text> : null}
            {order.paymentStatus !== 'SUCCESS' ? <Text style={styles.paymentNote}>
              {order.paymentStatus === 'FAILED' ? 'Payment failed. This order is still unpaid; retry payment before the outlet can accept it.'
                : order.paymentStatus === 'CANCELLED' ? 'Payment was cancelled. This order is not available for fulfillment.'
                  : ['RAZORPAY', 'CASHFREE'].includes(order.paymentMethod) ? 'Payment is pending. The kitchen cannot accept this order until the gateway confirms payment.'
                    : order.paymentMethod === 'UPI_QR' ? 'UPI reference is awaiting verification by the outlet. The order stays unpaid until it is confirmed.'
                      : 'Payment is due at the Wrapchik counter.'}
            </Text> : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionTitleRow}><ShoppingBag size={17} color={COLORS.primary} /><Text style={styles.sectionTitle}>Order summary</Text></View>
            {(order.items || []).map((item, index) => <View key={`${item.productId || item.name}-${index}`} style={styles.itemRow}><Text style={styles.quantity}>{item.quantity}×</Text><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text>{item.customizations?.length ? <Text style={styles.customizations}>{item.customizations.map((entry) => entry.name).join(' · ')}</Text> : null}</View><Text style={styles.itemPrice}>₹{item.itemTotal ?? item.priceAtPurchase * item.quantity}</Text></View>)}
            <View style={styles.divider} />
            {order.subtotal != null ? <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>₹{order.subtotal}</Text></View> : null}
            {Number(order.discountAmount) > 0 ? <View style={styles.totalRow}><Text style={styles.totalLabel}>Coupon{order.couponCode ? ` · ${order.couponCode}` : ''}</Text><Text style={styles.discountValue}>−₹{order.discountAmount}</Text></View> : null}
            {Number(order.loyaltyDiscountAmount) > 0 ? <View style={styles.totalRow}><Text style={styles.totalLabel}>Reward points · {order.loyaltyPointsRedeemed}</Text><Text style={styles.discountValue}>−₹{order.loyaltyDiscountAmount}</Text></View> : null}
            {order.taxAndFees != null ? <View style={styles.totalRow}><Text style={styles.totalLabel}>Taxes & fees</Text><Text style={styles.totalValue}>₹{order.taxAndFees}</Text></View> : null}
            <View style={styles.totalRow}><Text style={styles.finalLabel}>Order total</Text><Text style={styles.finalValue}>₹{order.totalAmount}</Text></View>
            {pointsCelebration > 0 ? <Animated.View pointerEvents="none" style={[styles.pointsCelebration, { opacity: pointsOpacity, transform: [{ scale: pointsScale }] }]}><Text accessibilityLiveRegion="polite" style={styles.pointsCelebrationText}>✨ +{pointsCelebration} reward points earned</Text></Animated.View> : null}
            {Number(order.loyaltyPointsEarned) > 0 ? <Text style={styles.estimate}>{order.loyaltyPointsEarned} reward points earned</Text> : null}
          </View>

          <View style={styles.locationCard}>
            <MapPin size={17} color={COLORS.primary} />
            <View style={styles.itemCopy}>
              <Text style={styles.locationTitle}>{order.orderType === 'TAKEAWAY' ? 'Pickup location' : order.orderType === 'DELIVERY' ? 'Delivery details' : 'Dine-in'}</Text>
              <Text style={styles.locationText}>{order.orderType === 'TAKEAWAY' ? (order.pickupLocation || 'Wrapchik SAC Counter') : order.orderType === 'DELIVERY' ? [order.hostel, order.roomNumber].filter(Boolean).join(' · ') : (order.tableId ? 'Selected table' : 'Table details unavailable')}</Text>
              {order.pickupTimeSlot ? <Text style={styles.locationText}>Pickup window: {order.pickupTimeSlot}</Text> : null}
              {order.deliveryInstructions ? <Text style={styles.locationText}>Note: {order.deliveryInstructions}</Text> : null}
            </View>
          </View>

          {order.orderType === 'TAKEAWAY' && order.orderStatus === 'READY' && order.paymentStatus === 'SUCCESS' ? <View style={styles.pickupQrCard}>
            <Text style={styles.pickupQrTitle}>Ready for collection</Text>
            <Text style={styles.pickupQrCopy}>{order.groupOrderId ? 'All current group members can show this same one-time code to Wrapchik staff. It expires after 30 minutes and never changes payment status.' : 'Show this one-time code to Wrapchik staff. It expires after 30 minutes and never changes payment status.'}</Text>
            {pickupQr?.uri ? <>
              <View style={styles.qrWrap}><QRCode value={pickupQr.uri} size={240} backgroundColor="#FFFFFF" color="#1E2633" /></View>
              <Text style={styles.pickupQrExpiry}>Valid until {new Date(pickupQr.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Button title={order.groupOrderId ? 'Refresh shared pickup QR' : 'Refresh pickup QR'} variant="outline" onPress={() => loadPickupQr({ replace: true })} style={styles.cancelButton} />
            </> : <Button title={pickupQrError ? 'Retry pickup QR' : order.groupOrderId ? 'Show shared pickup QR' : 'Show Pickup QR'} onPress={() => loadPickupQr()} loading={pickupQrLoading} style={styles.cancelButton} />}
            {pickupQrError ? <Text style={styles.actionError}>{pickupQrError}</Text> : null}
          </View> : null}

          {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
          {order.orderStatus === 'PLACED' && ['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(order.paymentMethod) && order.paymentStatus !== 'SUCCESS' && !(order.paymentId?.status === 'PENDING' && order.paymentId?.upiTransactionReference) ? <Button title={order.paymentStatus === 'FAILED' ? 'Retry payment for this order' : order.paymentMethod === 'UPI_QR' ? 'Complete payment' : 'Continue to payment'} onPress={() => router.push({ pathname: '/payment', params: { orderId: order._id, orderNumber: order.orderNumber } })} style={styles.cancelButton} /> : null}
          {order.paymentId?.status === 'PENDING' && order.paymentId?.upiTransactionReference ? <Text style={styles.paymentNote}>UPI reference submitted and awaiting outlet verification. Do not pay again.</Text> : null}
          {order.orderStatus === 'PLACED' && order.paymentStatus === 'SUCCESS' ? <Text style={styles.actionNote}>This order is paid. Cancellation and refunds are not available in the current workflow; contact the outlet for help.</Text> : null}
          {order.orderStatus === 'PLACED' && order.paymentStatus !== 'SUCCESS' ? <Button title="Cancel order" variant="danger" onPress={confirmCancel} loading={cancelBusy} style={styles.cancelButton} /> : null}
          {['COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order.orderStatus) && order.paymentStatus === 'SUCCESS' && !order.groupOrderId ? <Button title="Rate your order" variant="outline" onPress={() => router.push({ pathname: '/review-order', params: { orderId: order._id } })} style={styles.cancelButton} /> : null}
          {['ACCEPTED', 'PREPARING', 'READY'].includes(order.orderStatus) ? <Button title="Report a delay" variant="outline" onPress={() => router.push({ pathname: '/report-issue', params: { orderId: order._id, category: 'LATE' } })} style={styles.cancelButton} /> : null}
          {['COMPLETED', 'DELIVERED', 'SERVED'].includes(order.orderStatus) ? <Button title="Report an issue" variant="outline" onPress={() => router.push({ pathname: '/report-issue', params: { orderId: order._id } })} style={styles.cancelButton} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 32, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heroCard: { padding: 16, borderRadius: 18, backgroundColor: COLORS.textPrimary, marginBottom: 12 },
  eyebrow: { color: '#FFD8C9', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 6 },
  date: { color: '#D0D5DB', fontSize: 12, marginTop: 5 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  card: { padding: 15, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900' },
  estimate: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  paymentNote: { color: COLORS.warning, backgroundColor: COLORS.warningLight, borderRadius: 11, padding: 11, marginTop: 8, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  itemRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 }, quantity: { color: COLORS.primary, width: 27, fontSize: 13, fontWeight: '900' },
  itemCopy: { flex: 1 }, itemName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' }, customizations: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 }, itemPrice: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }, totalLabel: { color: COLORS.textSecondary, fontSize: 12 }, totalValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' }, discountValue: { color: COLORS.success, fontSize: 12, fontWeight: '800' }, finalLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900' }, finalValue: { color: COLORS.primary, fontSize: 18, fontWeight: '900' }, pointsCelebration: { alignSelf: 'flex-start', backgroundColor: '#FFF2D2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4, marginBottom: 10 }, pointsCelebrationText: { color: '#815218', fontSize: 12, fontWeight: '900' },
  locationCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: COLORS.primaryLight, marginBottom: 14 }, locationTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 3 }, locationText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  pickupQrCard: { alignItems: 'center', padding: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 }, pickupQrTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '900', alignSelf: 'flex-start' }, pickupQrCopy: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5, alignSelf: 'flex-start' }, qrWrap: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, marginTop: 14 }, pickupQrExpiry: { color: COLORS.textSecondary, fontSize: 11, marginTop: 6 },
  cancelButton: { marginTop: 4 },
  actionError: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 12, fontWeight: '700' },
  actionNote: { color: COLORS.warning, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 },
});
