import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { NETWORK_STATUS_EVENT } from '../../services/networkStatus';
import { isOfflineStatus } from '../../utils/networkStatusCore';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(NETWORK_STATUS_EVENT, online => {
      setOffline(isOfflineStatus(online));
      if (online) setDismissed(false);
    });
    return () => subscription.remove();
  }, []);
  const retry = async () => {
    setChecking(true);
    try { await api.get('/ready'); setOffline(false); setDismissed(false); }
    catch { setOffline(true); }
    finally { setChecking(false); }
  };
  if (!offline || dismissed) return null;
  return <View style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]} accessibilityRole="alert"><Text style={styles.message}>The Wrapchik service is starting or temporarily unavailable. Check your connection and try again shortly.</Text><TouchableOpacity onPress={retry} disabled={checking} accessibilityRole="button"><Text style={styles.action}>{checking ? 'Checking…' : 'Retry'}</Text></TouchableOpacity><TouchableOpacity onPress={() => setDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss offline message" style={styles.dismiss}><X size={18} color="#FFFFFF" /></TouchableOpacity></View>;
}

const styles = StyleSheet.create({ banner: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: '#5A2700', paddingHorizontal: 12, paddingBottom: 8 }, message: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '600', lineHeight: 16 }, action: { color: '#FFFFFF', textDecorationLine: 'underline', fontWeight: '800', minHeight: 44, textAlignVertical: 'center', paddingHorizontal: 4 }, dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } });
