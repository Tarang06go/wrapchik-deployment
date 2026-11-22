import React, { useContext } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Activity, ChefHat, CircleHelp, ClipboardList, Layers, LogOut, Package, QrCode, Settings, ShieldCheck, Tag, Users, Utensils, X } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';

const GROUPS = [
  { title: 'WORKSPACE', items: [['Dashboard', '/admin/dashboard', Activity], ['Kitchen & orders', '/admin/orders', ChefHat], ['QR pickup', '/admin/pickup', QrCode]] },
  { title: 'MENU & OFFERS', items: [['Products', '/admin/products', Package], ['Categories', '/admin/categories', Layers], ['Coupons & offers', '/admin/coupons', Tag]] },
  { title: 'OUTLET', items: [['Dine-in tables', '/admin/tables', Utensils], ['Store settings', '/admin/settings', Settings]] },
  { title: 'CUSTOMER CARE', items: [['Customer insights', '/admin/customers', Users], ['Support issues', '/admin/issues', CircleHelp]] },
];

export default function AdminDrawer({ visible, onClose }) {
  const router = useRouter();
  const { logout } = useContext(AuthContext);
  const open = (route) => { onClose?.(); router.push(route); };
  const signOut = async () => { onClose?.(); await logout(); router.replace('/(auth)/login'); };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close admin navigation" />
      <SafeAreaView style={styles.drawer}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><ShieldCheck size={19} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}><Text style={styles.brand}>WRAPCHIK</Text><Text style={styles.subtitle}>Outlet operations · TIET</Text></View>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close admin navigation"><X size={20} color="#46505A" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.groups}>
          {GROUPS.map(group => <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map(([label, route, Icon]) => <Pressable key={route} onPress={() => open(route)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel={label}>
              <Icon size={18} color="#69727C" /><Text style={styles.rowLabel}>{label}</Text>
            </Pressable>)}
          </View>)}
        </ScrollView>
        <Pressable onPress={signOut} style={({ pressed }) => [styles.logout, pressed && styles.rowPressed]} accessibilityRole="button" accessibilityLabel="Log out of administrator account">
          <LogOut size={18} color="#B3342A" /><Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(21,25,29,.5)' },
  drawer: { width: '86%', maxWidth: 350, height: '100%', backgroundColor: '#FFFDFB', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopRightRadius: 18, borderBottomRightRadius: 18 },
  brandRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#EEE9E3', paddingBottom: 12 },
  brandMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FF5722', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#242A32', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#7B8188', fontSize: 12, marginTop: 3 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F5F2EF' },
  groups: { paddingVertical: 10 },
  group: { marginBottom: 10 },
  groupTitle: { color: '#95877C', fontSize: 12, fontWeight: '900', letterSpacing: 0.9, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 5 },
  row: { minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10 },
  rowPressed: { backgroundColor: '#FFF0EB' },
  rowLabel: { color: '#353C44', fontSize: 14, fontWeight: '700' },
  logout: { minHeight: 52, borderTopWidth: 1, borderTopColor: '#EEE9E3', paddingHorizontal: 10, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoutLabel: { color: '#B3342A', fontSize: 14, fontWeight: '800' },
});
