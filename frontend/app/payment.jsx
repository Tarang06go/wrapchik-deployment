import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Platform, ActivityIndicator, KeyboardAvoidingView, AppState, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import paymentService from '../services/paymentService';
import orderService from '../services/orderService';
import { SocketContext } from '../context/SocketContext';
import { confirmPlatformAction } from '../utils/platformDialogs';
import { confirmWebUpiRetrySynchronously, isValidUpiTransactionReference, launchUpiPayment } from '../utils/paymentClientLogic.mjs';
import COLORS from '../constants/colors';

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { socket } = useContext(SocketContext);
  const routerRef = useRef(router);
  const confirmationHandled = useRef(false);
  const refreshVersionRef = useRef(0);
  routerRef.current = router;
  const rawOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const orderId = typeof rawOrderId === 'string' ? rawOrderId : '';
  const [order, setOrder] = useState(null);
  const [instructions, setInstructions] = useState(null);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [upiAppUnavailable, setUpiAppUnavailable] = useState(false);
  const [openingUpi, setOpeningUpi] = useState(false);
  const [upiHandoffStarted, setUpiHandoffStarted] = useState(false);
  const upiLaunchInFlight = useRef(false);
  const referenceSubmitInFlight = useRef(false);

  const refresh = useCallback(async (showFeedback = false) => {
    if (!orderId) { setLoading(false); return null; }
    const requestVersion = ++refreshVersionRef.current;
    try {
      let hasPendingClaim = false;
      let instructionsLoaded = true;
      const result = await orderService.getOrderById(orderId);
      if (!result?.success || !result.order) throw new Error('Order details are unavailable.');
      if (requestVersion !== refreshVersionRef.current) return null;
      setOrder(result.order);
      const currentOrder = result.order;
      if (currentOrder.paymentMethod === 'UPI_QR' && currentOrder.paymentStatus !== 'SUCCESS'
        && !['CANCELLED', 'REJECTED'].includes(currentOrder.orderStatus)) {
        hasPendingClaim = currentOrder.paymentId?.status === 'PENDING' && Boolean(currentOrder.paymentId?.upiTransactionReference);
        if (hasPendingClaim) {
          setInstructions(null);
          setMessage('Your submitted UPI reference is awaiting outlet verification. Do not pay again.');
          setIsError(false);
        } else {
          try {
            const response = await paymentService.getUpiInstructions(orderId);
            if (requestVersion !== refreshVersionRef.current) return null;
            setInstructions(response?.instructions || null);
            if (!showFeedback) { setMessage(''); setIsError(false); }
          } catch (instructionError) {
            instructionsLoaded = false;
            if (requestVersion !== refreshVersionRef.current) return null;
            setInstructions(null);
            setMessage(instructionError.message || 'Payment instructions are unavailable. Refresh the order or contact the outlet.');
            setIsError(true);
          }
        }
      } else {
        setInstructions(null);
      }
      if (currentOrder.paymentStatus === 'SUCCESS' && !confirmationHandled.current) {
        confirmationHandled.current = true;
        routerRef.current.replace({ pathname: '/order-confirmation', params: { orderId, orderNumber: currentOrder.orderNumber, method: 'UPI (verified by outlet)', celebrate: '1' } });
      }
      if (showFeedback && hasPendingClaim) { setMessage('Your submitted UPI reference is awaiting outlet verification. Do not pay again.'); setIsError(false); }
      else if (showFeedback && instructionsLoaded) { setMessage('Payment status refreshed.'); setIsError(false); }
      return currentOrder;
    } catch (error) {
      if (requestVersion === refreshVersionRef.current) { setMessage(error.message || 'Could not refresh payment status. Your saved order is unchanged.'); setIsError(true); }
      return null;
    } finally { if (requestVersion === refreshVersionRef.current) setLoading(false); }
  }, [orderId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void refresh(true).then(current => {
        if (upiHandoffStarted && current?.paymentMethod === 'UPI_QR' && current.paymentStatus !== 'SUCCESS'
          && !['CANCELLED', 'REJECTED'].includes(current.orderStatus)) {
          setMessage('Returned from your UPI app. Check its receipt, then submit the transaction reference. Do not pay again if the transfer succeeded.');
          setIsError(false);
        }
      });
    });
    return () => subscription.remove();
  }, [refresh, upiHandoffStarted]);

  useEffect(() => {
    if (!socket || !orderId) return undefined;
    const onOrderUpdated = event => {
      if (String(event?.orderId || '') !== String(orderId)) return;
      if (event?.paymentStatus === 'SUCCESS') {
        // Remove stale payment instructions immediately, then trust only the API response.
        setInstructions(null);
        setMessage('The outlet updated this order. Checking the verified payment status…');
        setIsError(false);
      }
      void refresh();
    };
    const refreshAuthoritativeState = () => { void refresh(); };
    socket.on('order_updated', onOrderUpdated);
    socket.on('connect', refreshAuthoritativeState);
    socket.on('refresh_authoritative_state', refreshAuthoritativeState);
    return () => {
      socket.off('order_updated', onOrderUpdated);
      socket.off('connect', refreshAuthoritativeState);
      socket.off('refresh_authoritative_state', refreshAuthoritativeState);
    };
  }, [socket, orderId, refresh]);

  const openUpiApp = useCallback(async () => {
    if (!instructions?.upiUri || upiLaunchInFlight.current || order?.paymentStatus === 'SUCCESS') return;
    if (upiHandoffStarted) {
      const warning = 'Opening payment again may create a second transfer. Continue only if your UPI app confirms that no payment was completed.';
      const confirmed = Platform.OS === 'web'
        ? confirmWebUpiRetrySynchronously(typeof window !== 'undefined' ? window : undefined, warning)
        : await confirmPlatformAction({
          platform: Platform.OS,
          title: 'Open the UPI app again?',
          message: warning,
          confirmLabel: 'Open app again',
          cancelLabel: 'Go back',
          nativeAlert: (...args) => Alert.alert(...args),
        });
      if (!confirmed) return;
    }
    upiLaunchInFlight.current = true;
    setOpeningUpi(true);
    setUpiAppUnavailable(false);
    try {
      await launchUpiPayment({
        platform: Platform.OS,
        uri: instructions.upiUri,
        linking: Linking,
        browserWindow: Platform.OS === 'web' && typeof window !== 'undefined' ? window : undefined,
      });
      setUpiHandoffStarted(true);
    } catch (error) {
      setUpiAppUnavailable(true);
      setMessage(Platform.OS === 'web'
        ? 'The browser could not open a UPI app. Scan the QR with another device or copy the merchant details to your UPI app.'
        : 'No compatible UPI app could be opened. Use the QR fallback or copy the merchant details. Payment remains pending until the outlet verifies receipt.');
      setIsError(false);
    } finally {
      upiLaunchInFlight.current = false;
      setOpeningUpi(false);
    }
  }, [instructions?.upiUri, order?.paymentStatus, upiHandoffStarted]);

  const copyPaymentLink = async () => {
    if (!instructions?.upiUri) return;
    try {
      await Clipboard.setStringAsync(instructions.upiUri);
      setMessage('Order-specific UPI payment link copied. Payment stays pending until the outlet verifies receipt.');
      setIsError(false);
    } catch {
      setMessage('Could not copy the payment link. Use the QR code or open a UPI app instead.');
      setIsError(true);
    }
  };

  const copyUpiId = async () => {
    if (!instructions?.upiId) return;
    try {
      await Clipboard.setStringAsync(instructions.upiId);
      setMessage('Merchant UPI ID copied. The order remains unpaid until the outlet verifies receipt.');
      setIsError(false);
    } catch { setMessage('Could not copy the UPI ID.'); setIsError(true); }
  };

  const copyPaymentDetails = async () => {
    if (!instructions) return;
    const details = `Payee: ${instructions.payeeName}\nUPI ID: ${instructions.upiId}\nAmount: ₹${Number(instructions.amount).toFixed(2)}\nOrder reference: ${instructions.orderNumber}`;
    try {
      await Clipboard.setStringAsync(details);
      setMessage('Order-specific payment details copied. Payment still needs outlet verification.');
      setIsError(false);
    } catch { setMessage('Could not copy the payment details.'); setIsError(true); }
  };

  const submitReference = async () => {
    if (busy || referenceSubmitInFlight.current || !isValidUpiTransactionReference(reference)) return;
    referenceSubmitInFlight.current = true;
    setBusy(true); setMessage('');
    try {
      const response = await paymentService.submitUpiReference(orderId, reference);
      setMessage(response?.message || 'Reference submitted. Payment remains pending until the outlet verifies receipt.');
      setIsError(false); setReference(''); await refresh();
    } catch (error) {
      const submittedReferenceValue = reference.trim().toUpperCase();
      const current = await refresh();
      const savedReference = String(current?.paymentId?.upiTransactionReference || '').trim().toUpperCase();
      if (current?.paymentId?.status === 'PENDING' && savedReference === submittedReferenceValue) {
        setReference('');
        setMessage('Your UPI reference was received and is awaiting outlet verification. Do not pay again.');
        setIsError(false);
      } else {
        setMessage(current
          ? `${error.message || 'Could not confirm the reference submission.'} Check the UPI app receipt and refresh before attempting another transfer.`
          : 'We could not confirm whether the reference was received. Refresh this order before retrying, and do not pay again if your UPI app shows a completed transfer.');
        setIsError(true);
      }
    }
    finally { referenceSubmitInFlight.current = false; setBusy(false); }
  };

  if (loading) return <View style={styles.container}><Header title="UPI payment" showBack showCart={false} /><ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} /></View>;
  if (!order) return <View style={styles.container}><Header title="Payment details" showBack showCart={false} /><View style={styles.content}><Text style={styles.title}>Order details are unavailable</Text><Text style={styles.muted}>Check your order history for the latest status.</Text><Button title="View orders" onPress={() => router.replace('/(tabs)/orders')} style={styles.buttonGap} /></View></View>;

  if (order.paymentMethod !== 'UPI_QR') {
    const legacy = ['CASHFREE', 'RAZORPAY'].includes(order.paymentMethod);
    return <View style={styles.container}><Header title="Payment status" showBack showCart={false} /><View style={styles.content}>
      <Text style={styles.title}>{legacy ? 'Historical gateway order' : 'Cash at counter'}</Text>
      <Text style={styles.muted}>{legacy ? 'This order uses a legacy payment method. Its saved payment status remains available in order details.' : 'Pay at the Wrapchik counter when you collect your order.'}</Text>
      <Text style={styles.status}>Order #{order.orderNumber} · {order.paymentStatus}</Text>
      <Button title="View order status" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
    </View></View>;
  }

  const submittedReference = order.paymentId?.upiTransactionReference;
  const rejectedReason = order.paymentId?.verificationReason;
  const hasPendingReference = order.paymentId?.status === 'PENDING' && Boolean(submittedReference);
  const closedOrder = ['CANCELLED', 'REJECTED'].includes(order.orderStatus);
  const canSubmit = order.paymentStatus !== 'SUCCESS' && order.orderStatus === 'PLACED' && !hasPendingReference && (!submittedReference || order.paymentStatus === 'FAILED');
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="UPI payment" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>PAY EXACTLY</Text>
        <Text style={styles.amount}>₹{Number(instructions?.amount ?? order.totalAmount).toFixed(2)}</Text>
        <Text style={styles.orderText}>Order #{order.orderNumber}</Text>
      </View>
      {instructions?.upiUri ? <View style={styles.qrCard}><QRCode value={instructions.upiUri} size={220} backgroundColor="#FFFFFF" color="#1E2633" /><Text style={styles.qrHint}>Scan with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.</Text></View> : null}
      {!instructions?.upiUri && !hasPendingReference && order.paymentStatus !== 'SUCCESS' && !closedOrder ? <Text style={styles.error}>UPI payment instructions are unavailable. Refresh the order or contact the outlet.</Text> : null}
      {order.paymentStatus === 'SUCCESS' ? <View style={styles.verifiedBox}><Text style={styles.verifiedTitle}>Payment successful</Text><Text style={styles.pendingText}>The outlet verified receipt. This order’s payment QR and app handoff are no longer available.</Text></View> : null}
      {upiAppUnavailable ? <Text style={styles.fallbackHint}>The UPI app handoff was unavailable. Use the QR code with another device or copy the merchant details.</Text> : null}
      {instructions ? <View style={styles.detailsCard}>
        <Text style={styles.detailLabel}>PAYEE</Text><Text style={styles.detailValue}>{instructions.payeeName}</Text>
        <Text style={styles.detailLabel}>UPI ID</Text><Text style={styles.detailValue}>{instructions.upiId}</Text>
        <Text style={styles.detailLabel}>ORDER REFERENCE</Text><Text style={styles.detailValue}>{instructions.orderNumber}</Text>
      </View> : null}
      {instructions?.upiUri && !hasPendingReference && order.paymentStatus !== 'SUCCESS' && !closedOrder ? <>
        <Button title={openingUpi ? 'Opening UPI app…' : upiHandoffStarted ? 'Open UPI app again' : 'Pay using UPI App'} onPress={openUpiApp} loading={openingUpi} disabled={openingUpi} />
        <View style={styles.copyActions}>
          <Button title="Copy UPI ID" onPress={copyUpiId} variant="outline" style={styles.copyButton} />
          <Button title="Copy payment details" onPress={copyPaymentDetails} variant="outline" style={styles.copyButton} />
        </View>
        <Button title="Copy order-specific UPI link" onPress={copyPaymentLink} variant="outline" style={styles.buttonGap} />
      </> : null}
      {instructions?.upiUri && order.paymentStatus !== 'SUCCESS' ? <Text style={styles.instruction}>After paying, return here and submit the UPI transaction reference. The outlet checks receipt records and confirms payment manually. Opening an app, scanning this QR or submitting a reference never marks an order as paid. If you already paid, do not make another transfer.</Text> : null}
      {hasPendingReference ? <View style={styles.pendingBox}><Text style={styles.pendingText}>Your submitted UPI reference is awaiting outlet verification. Do not pay again. The outlet will update this order after checking receipt.</Text></View> : null}
      {rejectedReason ? <View style={styles.rejectedBox}><Text style={styles.rejectedTitle}>Payment claim rejected</Text><Text style={styles.instruction}>{rejectedReason}</Text></View> : null}
      {canSubmit ? <>
        <Text style={styles.detailLabel}>UPI TRANSACTION REFERENCE</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Enter reference from your UPI app" autoCapitalize="characters" style={styles.input} editable={!busy} />
        <Text style={styles.referenceHint}>Use the UPI app’s 8–120 character reference (letters, numbers and hyphens).</Text>
        <Button title={busy ? 'Submitting…' : 'I have completed the payment'} onPress={submitReference} loading={busy} disabled={busy || !isValidUpiTransactionReference(reference)} style={styles.buttonGap} />
      </> : null}
      {message ? <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion={isError ? 'assertive' : 'polite'} style={[styles.message, isError && styles.error]}>{message}</Text> : null}
      <View style={styles.statusRow}><Text style={styles.status}>Payment status: {order.paymentStatus}</Text><Button title="Refresh status" variant="outline" onPress={() => refresh(true)} /></View>
      <Button title="View order status" variant="outline" onPress={() => router.replace(`/order-tracking/${orderId}`)} style={styles.buttonGap} />
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32, maxWidth: 620, width: '100%', alignSelf: 'center' },
  amountCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 16 },
  amountLabel: { color: '#FFE5D8', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  amount: { color: '#FFF', fontSize: 38, fontWeight: '900', marginTop: 4 },
  orderText: { color: '#FFF', fontSize: 13, marginTop: 4 },
  qrCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  qrHint: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 14 },
  fallbackHint: { color: COLORS.textSecondary, backgroundColor: COLORS.warningLight, borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12, lineHeight: 18 },
  detailsCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 15, marginBottom: 14 },
  copyActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  copyButton: { flex: 1, paddingHorizontal: 6 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 8 },
  detailValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  referenceHint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  instruction: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.textPrimary, marginTop: 7 },
  message: { backgroundColor: COLORS.warningLight, color: COLORS.textPrimary, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12, lineHeight: 18 },
  pendingBox: { backgroundColor: COLORS.warningLight, borderRadius: 12, padding: 12, marginTop: 12 },
  verifiedBox: { backgroundColor: COLORS.successLight, borderRadius: 12, padding: 12, marginTop: 12 },
  verifiedTitle: { color: COLORS.success, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  pendingText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  rejectedBox: { backgroundColor: COLORS.dangerLight, borderRadius: 12, padding: 12, marginTop: 12 },
  rejectedTitle: { color: COLORS.danger, fontWeight: '900' },
  status: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginVertical: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 20 },
  muted: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  buttonGap: { marginTop: 12 },
});
