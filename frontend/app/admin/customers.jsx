import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../../components/common/Header';
import adminService from '../../services/adminService';
import COLORS from '../../constants/colors';
import { AdminLoadingState } from '../../components/admin/AdminPrimitives';

const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AdminCustomersScreen() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminService.getCustomers({ search: search.trim(), limit: 100 });
      if (!response?.success || !Array.isArray(response.customers)) throw new Error('Customer response was incomplete.');
      setCustomers(response.customers);
      setError('');
    } catch (loadError) { setError(loadError.message || 'Could not load customer insights.'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer); }, [load]);

  const toggle = async (customer) => {
    if (busyId) return;
    const next = !customer.isActive;
    setBusyId(customer._id);
    try {
      const result = await adminService.setCustomerActive(customer._id, next);
      setCustomers((current) => current.map((row) => row._id === customer._id ? { ...row, isActive: result.isActive } : row));
    } catch (toggleError) { setError(toggleError.message || 'Customer account status did not change.'); }
    finally { setBusyId(''); }
  };

  return <View style={styles.container}>
    <Header title="Customer insights" showBack showCart={false} />
    <View style={styles.content}>
      <Text style={styles.caption}>Read-only verified order counts and spend. Account access changes are recorded in an admin audit log.</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search student name or email" accessibilityLabel="Search customers" style={styles.search} autoCapitalize="none" />
      {error ? <TouchableOpacity onPress={load} accessibilityRole="button"><Text style={styles.error}>{error} · Tap to retry</Text></TouchableOpacity> : null}
      {loading && !customers.length ? <AdminLoadingState message="Loading customers…" /> : <FlatList
        data={customers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={customers.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<Text style={styles.empty}>{loading ? 'Updating…' : 'No customer accounts found.'}</Text>}
        renderItem={({ item }) => <View style={styles.card}>
          <View style={styles.identity}><Text style={styles.name}>{item.name}</Text><Text style={styles.email}>{item.email}</Text><Text style={styles.stats}>{item.orderCount} verified order{item.orderCount === 1 ? '' : 's'} · {money(item.verifiedSpend)} verified spend</Text></View>
          <View style={styles.status}><Text style={[styles.statusText, !item.isActive && styles.disabled]}>{item.isActive ? 'ACTIVE' : 'DISABLED'}</Text><Switch value={item.isActive} onValueChange={() => toggle(item)} disabled={Boolean(busyId)} accessibilityLabel={`${item.isActive ? 'Disable' : 'Enable'} ${item.name} account`} /></View>
        </View>}
      />}
    </View>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background }, content: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16 }, caption: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 }, search: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14, marginBottom: 12, color: COLORS.textPrimary }, list: { gap: 9, paddingBottom: 28 }, emptyList: { flexGrow: 1, justifyContent: 'center' }, empty: { textAlign: 'center', color: COLORS.textSecondary, padding: 24 }, error: { color: COLORS.danger, paddingVertical: 10 }, card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, gap: 12 }, identity: { flex: 1 }, name: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' }, email: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 }, stats: { color: COLORS.textSecondary, fontSize: 11, marginTop: 7 }, status: { alignItems: 'center', minWidth: 70 }, statusText: { color: COLORS.success, fontWeight: '800', fontSize: 9 }, disabled: { color: COLORS.danger } });
