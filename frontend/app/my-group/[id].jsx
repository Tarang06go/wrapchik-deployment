import React, { useCallback, useContext, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BellRing, Clock3, Users } from 'lucide-react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import ErrorState from '../../components/common/ErrorState';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import groupService from '../../services/groupService';
import { SocketContext } from '../../context/SocketContext';
import COLORS from '../../constants/colors';
import { groupOrderLabel, groupPaymentLabel, viewerContributionLabel } from '../../utils/groupSummaryCore.mjs';

export default function MyGroupDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { socket } = useContext(SocketContext);
  const [group, setGroup] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [error, setError] = useState(false);
  const fetchDetails = useCallback(async ({ quiet = false } = {}) => {
    if (!id) { setLoading(false); setError(true); return; }
    if (!quiet) setLoading(true);
    try {
      const [summaryResult, feedResult] = await Promise.allSettled([groupService.getGroupSummary(id), groupService.getGroupActivity(id)]);
      if (summaryResult.status !== 'fulfilled') throw summaryResult.reason;
      const summary = summaryResult.value;
      if (!summary?.success || !summary.group) throw new Error('Group details are unavailable.');
      setGroup(summary.group);
      setActivity(feedResult.status === 'fulfilled' && Array.isArray(feedResult.value?.activity) ? feedResult.value.activity : []);
      setError(feedResult.status !== 'fulfilled');
    } catch { setError(true); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void fetchDetails(); }, [fetchDetails]));
  React.useEffect(() => {
    if (!socket || !id) return undefined;
    const refresh = event => { if (!event?.groupId || String(event.groupId) === String(id)) void fetchDetails({ quiet: true }); };
    socket.on('group_updated', refresh); socket.on('order_updated', refresh); socket.on('connect', refresh);
    return () => { socket.off('group_updated', refresh); socket.off('order_updated', refresh); socket.off('connect', refresh); };
  }, [fetchDetails, id, socket]);
  const sendReminder = async () => {
    if (reminding) return;
    setReminding(true);
    try { const result = await groupService.sendPaymentReminder(id); Alert.alert('Payment reminder', result?.message || 'Reminder sent.'); await fetchDetails({ quiet: true }); }
    catch (e) { Alert.alert('Reminder unavailable', e.message || 'Wait before sending another reminder.'); }
    finally { setReminding(false); }
  };
  if (loading) return <View style={styles.container}><Header title="Group" showBack showCart={false} /><LoadingIndicator message="Loading group…" /></View>;
  if (!group) return <View style={styles.container}><Header title="Group" showBack showCart={false} /><ErrorState title="Group details unavailable" message="Only an account that belongs to this group can view its details." onRetry={() => { setRefreshing(true); void fetchDetails(); }} retrying={refreshing} /></View>;
  const canLobby = group.membershipStatus === 'JOINED' && ['OPEN', 'LOCKED'].includes(group.status);
  const hasPendingOthers = group.status === 'ORDERED' && !['VERIFIED'].includes(group.paymentStatus) && group.contributionCounts?.pending > 0;
  return <View style={styles.container}>
    <Header title="Group Details" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchDetails(); }} colors={[COLORS.primary]} />}>
      {error ? <Text style={styles.warning}>Could not refresh the activity feed. Showing the last saved details.</Text> : null}
      <View style={styles.hero}><View style={styles.heroIcon}><Users size={22} color={COLORS.primary} /></View><Text style={styles.name}>{group.name}</Text><Text style={styles.sub}>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · {group.isLeader ? 'You are host' : 'You joined'}</Text><Text style={styles.code}>Invite code · {group.groupCode}</Text></View>
      <View style={styles.summaryCard}>
        <Text style={styles.label}>CONTRIBUTIONS</Text><Text style={styles.value}>{groupPaymentLabel(group.paymentStatus)}</Text>
        <Text style={styles.meta}>Your status: {viewerContributionLabel(group.viewerContributionStatus)}</Text>
        <Text style={styles.meta}>{group.contributionCounts?.verified || 0} verified · {group.contributionCounts?.awaitingVerification || 0} awaiting outlet review · {group.contributionCounts?.pending || 0} pending</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>ORDER PROGRESS</Text><Text style={styles.value}>{groupOrderLabel(group.orderStatus)}</Text>{group.orderNumber ? <Text style={styles.meta}>Order #{group.orderNumber}</Text> : null}
      </View>
      {canLobby ? <Button title="Open group lobby and shared cart" onPress={() => router.push({ pathname: '/group-order', params: { groupId: id } })} style={styles.action} /> : null}
      {group.status === 'ORDERED' && group.membershipStatus === 'JOINED' ? <Button title="View group contributions" variant="outline" onPress={() => router.push(`/group-cart/${id}`)} style={styles.action} /> : null}
      {group.orderId && group.membershipStatus === 'JOINED' ? <Button title="View group order tracking" variant="outline" onPress={() => router.push(`/order-tracking/${group.orderId}`)} style={styles.action} /> : null}
      {group.orderId && group.membershipStatus === 'JOINED' && ['ACCEPTED', 'PREPARING', 'READY'].includes(group.orderStatus) ? <Button title="Report a delay" variant="outline" onPress={() => router.push({ pathname: '/report-issue', params: { orderId: group.orderId, category: 'LATE' } })} style={styles.action} /> : null}
      {hasPendingOthers ? <Button title={reminding ? 'Sending reminder…' : 'Remind members to contribute'} variant="outline" onPress={sendReminder} loading={reminding} style={styles.action} /> : null}
      <View style={styles.feedHeader}><Clock3 size={17} color={COLORS.primary} /><Text style={styles.feedTitle}>Group activity</Text></View>
      {!activity.length ? <Text style={styles.noActivity}>No group activity has been recorded yet.</Text> : activity.map((event, index) => <View key={`${event._id || event.createdAt}-${index}`} style={styles.event}><View style={styles.eventDot} /><View style={styles.eventBody}><Text style={styles.eventText}>{event.actorName ? `${event.actorName} · ` : ''}{event.message}</Text><Text style={styles.eventTime}>{event.createdAt ? new Date(event.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</Text></View></View>)}
      {group.membershipStatus !== 'JOINED' ? <Text style={styles.notice}>You left this group. Historical status and activity remain available; the active lobby is restricted to current members.</Text> : null}
      {hasPendingOthers ? <View style={styles.reminderNote}><BellRing size={15} color={COLORS.warning} /><Text style={styles.reminderText}>Reminders are limited by a server cooldown and group-wide cap.</Text></View> : null}
      <TouchableOpacity onPress={() => router.push('/my-groups')} style={styles.backList} accessibilityRole="button"><Text style={styles.backListText}>Back to My Groups</Text></TouchableOpacity>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background }, content: { padding: 16, paddingBottom: 36, maxWidth: 700, width: '100%', alignSelf: 'center' }, warning: { color: COLORS.warning, fontSize: 12, marginBottom: 10 },
  hero: { backgroundColor: '#FFF', borderRadius: 20, alignItems: 'center', padding: 22, borderWidth: 1, borderColor: COLORS.border }, heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' }, name: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900', marginTop: 10 }, sub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 }, code: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800', marginTop: 10 },
  summaryCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 }, label: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, value: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', marginTop: 4 }, meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }, divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 }, action: { marginTop: 10 }, feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10 }, feedTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' }, noActivity: { color: COLORS.textSecondary, padding: 14, backgroundColor: '#FFF', borderRadius: 12 }, event: { flexDirection: 'row', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }, eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 5 }, eventBody: { flex: 1 }, eventText: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 18 }, eventTime: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 }, notice: { color: COLORS.textSecondary, backgroundColor: COLORS.surfaceMuted, borderRadius: 12, padding: 12, marginTop: 14, fontSize: 12, lineHeight: 18 }, reminderNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 }, reminderText: { flex: 1, color: COLORS.textSecondary, fontSize: 11 }, backList: { alignSelf: 'center', padding: 12, marginTop: 16 }, backListText: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '800' },
});
