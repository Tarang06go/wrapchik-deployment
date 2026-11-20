import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Text, TouchableOpacity, Alert, TextInput, Modal, ScrollView } from 'react-native';
import { AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import api from '../../services/api';
import COLORS from '../../constants/colors';

const notify = (title, text) => typeof window !== 'undefined' ? window.alert(`${title}\n\n${text}`) : Alert.alert(title, text);

export default function AdminIssuesScreen() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [resolveId, setResolveId] = useState(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchIssues = async () => {
    try {
      const res = await api.get('/admin/issues');
      if (res.success) {
        setIssues(res.issues || []);
        setError('');
      } else throw new Error(res.message || 'Issues could not be loaded.');
    } catch (e) {
      console.warn('[Admin Issues]:', e);
      setError(e.message || 'Could not load reported issues.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchIssues(); };

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setSaving(true);
    try {
      const res = await api.put(`/admin/issues/${resolveId}/resolve`, { adminResponse: resolution.trim(), resolution: resolution.trim() });
      if (res.success) {
        setResolveId(null); setResolution('');
        fetchIssues();
      } else throw new Error(res.message || 'Issue could not be resolved.');
    } catch (e) {
      notify('Resolution failed', e.message || 'Could not resolve this issue.');
    } finally { setSaving(false); }
  };

  const openCount = issues.filter(i => i.status !== 'RESOLVED').length;
  const resolvedCount = issues.filter(i => i.status === 'RESOLVED').length;

  if (loading) return <LoadingIndicator message="Loading reported issues…" />;

  return (
    <View style={styles.container}>
      <Header title="Customer issues" showBack showCart={false} />

      <View style={styles.intro}>
        <View>
          <Text style={styles.kicker}>SUPPORT</Text>
          <Text style={styles.title}>Issue management</Text>
        </View>
        {issues.length > 0 ? <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{openCount}</Text><Text style={styles.statLabel}>Open</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{resolvedCount}</Text><Text style={styles.statLabel}>Resolved</Text></View>
        </View> : null}
      </View>

      {!!error && <TouchableOpacity onPress={fetchIssues} style={styles.errorBanner}><Text style={styles.errorText}>{error} · Tap to retry</Text></TouchableOpacity>}

      {issues.length === 0 ? (
        <EmptyState title="No issues reported" message="Customers haven't reported any issues yet. Reports appear here when customers submit them from their order details." />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={item => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.iconBox, item.status === 'RESOLVED' ? styles.iconResolved : styles.iconOpen]}>
                  {item.status === 'RESOLVED' ? <CheckCircle2 size={18} color="#2E7D32" /> : <AlertTriangle size={18} color="#E65100" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNo}>Order #{item.orderId?.orderNumber || item.orderId?._id || item.orderId}</Text>
                  <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
                <View style={styles.badges}>
                  <View style={[styles.badge, item.category === 'QUALITY' ? styles.qualityBadge : item.category === 'MISSING_ITEM' ? styles.missingBadge : styles.defaultBadge]}>
                    <Text style={styles.badgeText}>{item.category?.replace(/_/g, ' ') || 'Issue'}</Text>
                  </View>
                  <View style={[styles.badge, item.status === 'RESOLVED' ? styles.resolvedBadge : styles.openBadge]}>
                    <Text style={[styles.badgeText, item.status === 'RESOLVED' ? styles.resolvedText : styles.openText]}>{item.status}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.description}>{item.description}</Text>

              {item.adminResponse ? <View style={styles.responseBox}>
                <MessageSquare size={14} color={COLORS.textSecondary} />
                <Text style={styles.responseText}>{item.adminResponse}</Text>
              </View> : null}

              {item.status !== 'RESOLVED' && (
                <TouchableOpacity style={styles.resolveAction} onPress={() => { setResolveId(item._id); setResolution(''); }}>
                  <Text style={styles.resolveActionText}>Write resolution</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Resolve Modal */}
      <Modal visible={!!resolveId} animationType="slide" transparent onRequestClose={() => setResolveId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Resolve issue</Text>
            <Text style={styles.modalHint}>Describe what was done to address this customer's concern.</Text>
            <TextInput
              value={resolution}
              onChangeText={setResolution}
              placeholder="Resolution details…"
              multiline
              maxLength={1000}
              style={styles.resolutionInput}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="outline" onPress={() => setResolveId(null)} style={{ flex: 1 }} />
              <Button title={saving ? 'Saving…' : 'Mark resolved'} disabled={saving || !resolution.trim()} onPress={handleResolve} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F4F1' },
  intro: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kicker: { color: '#89776A', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  title: { color: '#252B33', fontSize: 22, fontWeight: '900', marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { alignItems: 'center' },
  statValue: { color: '#252B33', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#7A8188', fontSize: 10, fontWeight: '700', marginTop: 2 },
  errorBanner: { marginHorizontal: 16, backgroundColor: '#FCEBE8', padding: 10, borderRadius: 8, marginBottom: 8 },
  errorText: { color: '#97372B', fontSize: 12 },
  list: { padding: 16, paddingTop: 0, gap: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E8E4DE', borderRadius: 10, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconOpen: { backgroundColor: '#FFF3E0' },
  iconResolved: { backgroundColor: '#E8F5E9' },
  orderNo: { color: '#2D333B', fontSize: 15, fontWeight: '900' },
  meta: { color: '#7A8188', fontSize: 11, marginTop: 2 },
  badges: { alignItems: 'flex-end', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  defaultBadge: { backgroundColor: '#F3F1EE' },
  qualityBadge: { backgroundColor: '#FFF3E0' },
  missingBadge: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, color: '#5A5F66' },
  openBadge: { backgroundColor: '#FFF3E0' },
  openText: { color: '#E65100' },
  resolvedBadge: { backgroundColor: '#E8F5E9' },
  resolvedText: { color: '#2E7D32' },
  description: { color: '#4B5259', fontSize: 13, lineHeight: 19, marginTop: 12 },
  responseBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: 10, backgroundColor: '#F6F4F1', borderRadius: 8 },
  responseText: { flex: 1, color: '#5A5F66', fontSize: 12, lineHeight: 17 },
  resolveAction: { borderTopWidth: 1, borderTopColor: '#EFECE8', marginTop: 12, paddingTop: 10, alignSelf: 'flex-start' },
  resolveActionText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  overlay: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(20,22,24,.5)' },
  modal: { backgroundColor: '#fff', borderRadius: 12, padding: 18, maxWidth: 500, width: '100%', alignSelf: 'center' },
  modalTitle: { color: '#252B33', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  modalHint: { color: '#7A8188', fontSize: 12, marginBottom: 12, lineHeight: 17 },
  resolutionInput: { minHeight: 100, borderWidth: 1, borderColor: '#DDD9D3', borderRadius: 8, padding: 12, color: '#252B33', fontSize: 14, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
