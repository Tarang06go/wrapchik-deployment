import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Linking, Platform, ActivityIndicator, KeyboardAvoidingView, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import paymentService from '../services/paymentService';
import orderService from '../services/orderService';
import COLORS from '../constants/colors';

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const routerRef = useRef(router);
  const confirmationHandled = useRef(false);
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
  const autoLaunchAttemptedUri = useRef('');
  const upiLaunchInFlight = useRef(false);
  const referenceSubmitInFlight = useRef(false);

  const refresh = useCallback(async (showFeedback = false) => {
    if (!orderId) { setLoading(false); return; }
    try {
      let hasPendingClaim = false;
      let instructionsLoaded = true;
      const result = await orderService.getOrderById(orderId);
      if (!result?.success || !result.order) throw new Error('Order details are unavailable.');
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
            setInstructions(response?.instructions || null);
            setMessage(''); setIsError(false);
          } catch (instructionError) {
            instructionsLoaded = false;
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
    } catch (error) {
      setMessage(error.message || 'Could not refresh payment status. Your saved order is unchanged.'); setIsError(true);
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh(true);
    });
    return () => subscription.remove();
  }, [refresh]);

  const openUpiApp = useCallback(async () => {
    if (!instructions?.upiUri || upiLaunchInFlight.current || order?.paymentStatus === 'SUCCESS') return;
    upiLaunchInFlight.current = true;
    setOpeningUpi(true);
    setUpiAppUnavailable(false);
    try {
      await Linking.openURL(instructions.upiUri);
    } catch (error) {
      setUpiAppUnavailable(true);
      setMessage(Platform.OS === 'web'
        ? 'A UPI app could not be opened here. Scan the QR code with a UPI app on your phone.'
        : `No UPI app completed the handoff${error?.message ? ` (${String(error.message).slice(0, 90)})` : ''}. Wrapchik cannot read a provider's payment alert. Use the QR fallback or copy the link; payment remains pending until outlet verification.`);
      setIsError(false);
    } finally {
      upiLaunchInFlight.current = false;
      setOpeningUpi(false);
    }
  }, [instructions?.upiUri, order?.paymentStatus]);

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

  useEffect(() => {
    const uri = instructions?.upiUri;
    if (Platform.OS !== 'android' || !uri || order?.paymentStatus === 'SUCCESS' || autoLaunchAttemptedUri.current === uri) return;
    autoLaunchAttemptedUri.current = uri;
    openUpiApp();
  }, [instructions?.upiUri, order?.paymentStatus, openUpiApp]);

  const submitReference = async () => {
    if (busy || referenceSubmitInFlight.current) return;
    referenceSubmitInFlight.current = true;
    setBusy(true); setMessage('');
    try {
      const response = await paymentService.submitUpiReference(orderId, reference);
      setMessage(response?.message || 'Reference submitted. Payment remains pending until the outlet verifies receipt.');
      setIsError(false); setReference(''); await refresh();
    } catch (error) { setMessage(error.message || 'Could not submit this reference.'); setIsError(true); }
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
  const canSubmit = order.paymentStatus !== 'SUCCESS' && order.orderStatus === 'PLACED' && !hasPendingReference && (!submittedReference || order.paymentStatus === 'FAILED');
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="UPI payment" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>PAY EXACTLY</Text>
        <Text style={styles.amount}>₹{Number(instructions?.amount ?? order.totalAmount).toFixed(2)}</Text>
        <Text style={styles.orderText}>Order #{order.orderNumber}</Text>
      </View>
      {instructions?.upiUri ? <View style={styles.qrCard}><QRCode value={instructions.upiUri} size={220} backgroundColor="#FFFFFF" color="#1E2633" /><Text style={styles.qrHint}>Scan with Google Pay, PhonePe, Paytm, BHIM, or another UPI app.</Text></View> : <Text style={styles.error}>UPI payment is not currently available. Contact the outlet or choose another method for a new order.</Text>}
      {upiAppUnavailable ? <Text style={styles.fallbackHint}>No compatible UPI app was found. Use the QR code above with a UPI app on another device.</Text> : null}
      {instructions ? <View style={styles.detailsCard}>
        <Text style={styles.detailLabel}>PAYEE</Text><Text style={styles.detailValue}>{instructions.payeeName}</Text>
        <Text style={styles.detailLabel}>UPI ID</Text><Text style={styles.detailValue}>{instructions.upiId}</Text>
        <Text style={styles.detailLabel}>ORDER REFERENCE</Text><Text style={styles.detailValue}>{instructions.orderNumber}</Text>
      </View> : null}
      <Button title={openingUpi ? 'Opening UPI app…' : 'Pay using UPI App'} onPress={openUpiApp} loading={openingUpi} disabled={!instructions?.upiUri || openingUpi} />
      <Button title="Copy order-specific UPI link" onPress={copyPaymentLink} variant="outline" disabled={!instructions?.upiUri} style={styles.buttonGap} />
      <Text style={styles.instruction}>After paying, return here and submit the UPI transaction reference. The outlet will check its receipt records and confirm the payment manually. Opening an app or submitting a reference never marks an order as paid.</Text>
      {hasPendingReference ? <View style={styles.pendingBox}><Text style={styles.pendingText}>Your submitted UPI reference is awaiting outlet verification. Do not pay again. The outlet will update this order after checking receipt.</Text></View> : null}
      {rejectedReason ? <View style={styles.rejectedBox}><Text style={styles.rejectedTitle}>Payment claim rejected</Text><Text style={styles.instruction}>{rejectedReason}</Text></View> : null}
      {canSubmit ? <>
        <Text style={styles.detailLabel}>UPI TRANSACTION REFERENCE</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Enter reference from your UPI app" autoCapitalize="characters" style={styles.input} editable={!busy} />
        <Button title={busy ? 'Submitting…' : 'I have completed the payment'} onPress={submitReference} loading={busy} disabled={busy || reference.trim().length < 8} style={styles.buttonGap} />
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
  detailsCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 15, marginBottom: 14 },
  detailLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 8 },
  detailValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  instruction: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.textPrimary, marginTop: 7 },
  message: { backgroundColor: COLORS.warningLight, color: COLORS.textPrimary, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, padding: 12, borderRadius: 10, marginTop: 12, fontSize: 12, lineHeight: 18 },
  pendingBox: { backgroundColor: COLORS.warningLight, borderRadius: 12, padding: 12, marginTop: 12 },
  pendingText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  rejectedBox: { backgroundColor: COLORS.dangerLight, borderRadius: 12, padding: 12, marginTop: 12 },
  rejectedTitle: { color: COLORS.danger, fontWeight: '900' },
  status: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', marginVertical: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 20 },
  muted: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  buttonGap: { marginTop: 12 },
});
