import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import adminService from '../../services/adminService';
import COLORS from '../../constants/colors';
import { parsePickupQrPayload } from '../../utils/pickupQrPayload';

const first = (value) => Array.isArray(value) ? value[0] : value;

export default function AdminPickupScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orderId, setOrderId] = useState(String(first(params.orderId) || ''));
  const [token, setToken] = useState(String(first(params.token) || ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Scan the student’s pickup QR, or enter the order and code below.');
  const [verified, setVerified] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
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
    if (cameraLoading || scanning) return;
    if (Platform.OS === 'web') {
      setMessage('Camera scanning is supported in the Wrapchik Android/iOS app. Enter the order ID and one-time code below on web.');
      return;
    }
    setCameraLoading(true);
    let module = cameraModule;
    try {
      if (!module) module = await import('expo-camera');
      const cameraApi = module.Camera || module;
      const CameraViewComponent = module.CameraView;
      const getPermission = cameraApi.getCameraPermissionsAsync || module.getCameraPermissionsAsync;
      const requestPermission = cameraApi.requestCameraPermissionsAsync || module.requestCameraPermissionsAsync;
      if (typeof CameraViewComponent !== 'function' || typeof getPermission !== 'function' || typeof requestPermission !== 'function') {
        throw new Error('Expo Camera is not available in this installed app build.');
      }
      const current = await getPermission.call(cameraApi);
      const permission = current?.granted || current?.status === 'granted'
        ? current
        : current?.canAskAgain === false
          ? current
          : await requestPermission.call(cameraApi);
      if (!permission?.granted) {
        setScanning(false);
        const detail = permission?.canAskAgain === false
          ? 'Enable Camera permission for Wrapchik in Android Settings. You can still verify manually below.'
          : 'Allow Camera permission to scan pickup codes. You can still verify manually below.';
        setMessage(detail);
        if (Platform.OS !== 'web') Alert.alert('Camera permission needed', detail);
        return;
      }
    } catch (cameraError) {
      setScanning(false);
      const detail = String(cameraError?.message || cameraError || 'Unknown camera error');
      const nativeModuleMissing = /cannot find native module|native module.*(?:missing|not found|unavailable)|expo.?camera.*not available in this installed app build/i.test(detail);
      setMessage(nativeModuleMissing
        ? 'Camera support is not included in this installed Wrapchik build. Install a development APK built with Expo Camera, or verify manually below.'
        : `Could not initialize the camera: ${detail}. Manual verification is still available below.`);
      return;
    } finally {
      setCameraLoading(false);
    }
    setCameraModule(module);
    scanHandled.current = false;
    setScanning(true);
    setMessage('Opening the camera…');
  };

  const onCameraMountError = event => {
    setScanning(false);
    setMessage(`Camera preview could not start: ${event?.message || 'Check Camera permission and try again.'} Manual verification is still available below.`);
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
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{verified ? 'Pickup confirmed' : 'One-time pickup QR'}</Text>
      <Text style={[styles.message, verified && styles.success]} accessibilityRole="alert">{message}</Text>
      {!verified ? <>
        {scanning && cameraModule?.CameraView ? <View style={styles.cameraFrame}><cameraModule.CameraView style={styles.camera} active={scanning} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onBarcodeScanned} onCameraReady={() => setMessage('Point the camera at the customer’s Wrapchik pickup QR.')} onMountError={onCameraMountError} /><Text style={styles.cameraHint}>Scan the QR shown on the customer’s order tracking screen</Text><Button size="small" title="Stop camera" variant="outline" onPress={() => setScanning(false)} style={styles.action} /></View> : <Button size="small" title="Scan customer pickup QR" loading={cameraLoading} disabled={cameraLoading} onPress={openScanner} style={styles.action} />}
        <Text style={styles.label}>Order ID</Text>
        <TextInput value={orderId} onChangeText={setOrderId} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Order ID from the QR" />
        <Text style={styles.label}>One-time pickup code</Text>
        <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Pickup code from the QR" />
        <Button size="small" title="Verify collection" onPress={() => verify()} loading={busy} style={styles.action} />
      </> : null}
      <Button size="small" title="Back to kitchen orders" variant="outline" onPress={() => router.replace('/admin/orders')} style={styles.action} />
      <Text style={styles.note}>Only a paid, ready takeaway order can be completed here. The QR expires after 30 minutes and can be used once.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, flexGrow: 1 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900' },
  message: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 10 },
  success: { color: COLORS.success, fontWeight: '800' },
  label: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 4, marginTop: 8 },
  input: { minHeight: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#FFFFFF', color: COLORS.textPrimary },
  action: { marginTop: 8 },
  note: { color: COLORS.textSecondary, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 12 },
  cameraFrame: { width: '100%', overflow: 'hidden', borderRadius: 12, backgroundColor: '#121820', paddingBottom: 8 },
  camera: { width: '100%', height: 190 },
  cameraHint: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, textAlign: 'center', paddingHorizontal: 10, paddingTop: 7 },
});
