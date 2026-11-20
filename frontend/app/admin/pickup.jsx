import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import adminService from '../../services/adminService';
import COLORS from '../../constants/colors';
import { parsePickupQrPayload } from '../../utils/pickupQrPayload';

const first = (value) => Array.isArray(value) ? value[0] : value;

export default function AdminPickupScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [orderId, setOrderId] = useState(String(first(params.orderId) || ''));
  const [token, setToken] = useState(String(first(params.token) || ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Scan the student’s pickup QR with this phone’s camera, or enter the order and code below.');
  const [verified, setVerified] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraModule, setCameraModule] = useState(null);
  const attempted = useRef('');
  const scanHandled = useRef(false);

  const verify = useCallback(async (id = orderId, pickupToken = token) => {
    if (busy) return;
    if (!id.trim() || !pickupToken.trim()) {
      setMessage('Enter both the order ID and one-time pickup code.');
      return;
    }
    setBusy(true);
    setMessage('Checking order and pickup code…');
    try {
      const result = await adminService.verifyPickupQr(id.trim(), pickupToken.trim());
      if (!result?.success || !result.order) throw new Error(result?.message || 'Pickup could not be verified.');
      setVerified(true);
      setMessage(result.message || `Order #${result.order.orderNumber} pickup verified.`);
    } catch (error) {
      setMessage(error?.message || 'Pickup code is invalid or expired. Ask the student to refresh their QR.');
    } finally { setBusy(false); }
  }, [busy, orderId, token]);

  const openScanner = async () => {
    if (Platform.OS === 'web') {
      setMessage('Camera scanning is available in the installed Android/iOS app. You can enter the order ID and one-time code below.');
      return;
    }
    let module = cameraModule;
    try {
      // Defer loading the native module. Expo Go builds that do not contain
      // ExpoCamera can still open this screen and use manual code entry.
      if (!module) module = await import('expo-camera');
      const cameraApi = module.Camera || module;
      if (!module.CameraView || !cameraApi.requestCameraPermissionsAsync) throw new Error('ExpoCamera is not included in this app binary.');
      const current = await cameraApi.getCameraPermissionsAsync();
      const permission = current?.granted ? current : await cameraApi.requestCameraPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan Wrapchik pickup codes. Manual code entry is still available.');
        return;
      }
    } catch (cameraError) {
      console.warn('[Pickup scanner] Camera is unavailable in this app binary:', cameraError?.message || cameraError);
      setScanning(false);
      setMessage('Camera scanning is unavailable in this Expo Go build. Use a Wrapchik development build to scan, or enter the order ID and one-time code below.');
      return;
    }
    setCameraModule(module);
    scanHandled.current = false;
    setScanning(true);
    setMessage('Point the camera at the student’s Wrapchik pickup QR.');
  };

  const onBarcodeScanned = result => {
    if (scanHandled.current || busy || verified) return;
    scanHandled.current = true;
    const payload = parsePickupQrPayload(result?.data);
    if (!payload) {
      setMessage('This is not a Wrapchik pickup QR. Keep scanning or enter the order and code below.');
      setTimeout(() => { scanHandled.current = false; }, 900);
      return;
    }
    setScanning(false);
    setOrderId(payload.orderId);
    setToken(payload.token);
    setMessage('Pickup code scanned. Checking the paid, ready order…');
    void verify(payload.orderId, payload.token).finally(() => {
      if (!verified) scanHandled.current = false;
    });
  };

  useEffect(() => {
    const incomingOrderId = String(first(params.orderId) || '');
    const incomingToken = String(first(params.token) || '');
    const key = `${incomingOrderId}:${incomingToken}`;
    if (!incomingOrderId || !incomingToken || attempted.current === key) return;
    attempted.current = key;
    void verify(incomingOrderId, incomingToken);
  }, [params.orderId, params.token, verify]);

  return <View style={styles.container}>
    <Header title="Verify pickup" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{verified ? 'Pickup confirmed' : 'One-time pickup QR'}</Text>
      <Text style={[styles.message, verified && styles.success]} accessibilityRole="alert">{message}</Text>
      {!verified ? <>
        {scanning && cameraModule?.CameraView ? <View style={styles.cameraFrame}><cameraModule.CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onBarcodeScanned} /><Text style={styles.cameraHint}>Scan the QR shown on the customer’s order tracking screen</Text><Button title="Stop camera" variant="outline" onPress={() => setScanning(false)} style={styles.action} /></View> : <Button title="Scan customer pickup QR" onPress={openScanner} style={styles.action} />}
        <Text style={styles.label}>Order ID</Text>
        <TextInput value={orderId} onChangeText={setOrderId} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Order ID from the QR" />
        <Text style={styles.label}>One-time pickup code</Text>
        <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Pickup code from the QR" />
        <Button title="Verify collection" onPress={() => verify()} loading={busy} style={styles.action} />
      </> : null}
      <Button title="Back to kitchen orders" variant="outline" onPress={() => router.replace('/admin/orders')} style={styles.action} />
      <Text style={styles.note}>Only a paid, ready takeaway order can be completed here. The QR expires after 30 minutes and can be used once.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, flexGrow: 1, justifyContent: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 25, fontWeight: '900' },
  message: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  success: { color: COLORS.success, fontWeight: '800' },
  label: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF', color: COLORS.textPrimary },
  action: { marginTop: 12 },
  note: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 20 },
  cameraFrame: { width: '100%', overflow: 'hidden', borderRadius: 16, backgroundColor: '#121820', paddingBottom: 12 },
  camera: { width: '100%', height: 260 },
  cameraHint: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12, paddingTop: 10 },
});
