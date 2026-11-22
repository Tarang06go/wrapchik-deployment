import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingIndicator from '../components/common/LoadingIndicator';
import groupService from '../services/groupService';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import COLORS from '../constants/colors';
import { groupOrderLabel, groupPaymentLabel, isGroupHistory, viewerContributionLabel } from '../utils/groupSummaryCore.mjs';

const GROUP_PAGE_SIZE = 20;

const GroupCard = React.memo(({ group, onOpen }) => (
  <View style={styles.card}>
    <View style={styles.cardTop}>
      <View style={styles.groupIcon}><Users size={18} color={COLORS.primary} /></View>
      <View style={styles.cardHeading}>
        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
        <Text style={styles.muted}>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}{group.isLeader ? ' · Host' : ''}</Text>
      </View>
      <View style={[styles.statePill, isGroupHistory(group) ? styles.historyPill : styles.activePill]}>
        <Text style={[styles.stateText, isGroupHistory(group) ? styles.historyText : styles.activeText]}>{isGroupHistory(group) ? 'History' : 'Active'}</Text>
      </View>
    </View>
    <View style={styles.statusBlock}>
      <Text style={styles.statusLabel}>Payment</Text><Text style={styles.statusValue}>{groupPaymentLabel(group.paymentStatus)}</Text>
      {group.contributionCounts?.total > 0 ? <Text style={styles.statusMeta}>{group.contributionCounts.verified} of {group.contributionCounts.total} contributions verified · {group.contributionCounts.pending} pending</Text> : null}
      <Text style={styles.statusMeta}>{viewerContributionLabel(group.viewerContributionStatus)}</Text>
      <Text style={[styles.statusLabel, { marginTop: 10 }]}>Order</Text><Text style={styles.statusValue}>{groupOrderLabel(group.orderStatus)}</Text>
      {group.orderNumber ? <Text style={styles.statusMeta}>Order #{group.orderNumber}</Text> : null}
    </View>
    <TouchableOpacity onPress={() => onOpen(group)} style={styles.viewButton} accessibilityRole="button" accessibilityLabel={`View group ${group.name}`}>
      <Text style={styles.viewButtonText}>View Group</Text><ChevronRight size={17} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
));

export default function MyGroupsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [groups, setGroups] = useState([]);
  const [tab, setTab] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageOffsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const fetchGroups = useCallback(async ({ quiet = false, append = false } = {}) => {
    if (!user?._id) { setGroups([]); setLoading(false); return; }
    if (append && (loadingMoreRef.current || !hasMoreRef.current)) return;
    const requestId = ++requestSequenceRef.current;
    const skip = append ? pageOffsetRef.current : 0;
    const limit = quiet && !append ? Math.max(GROUP_PAGE_SIZE, Math.min(pageOffsetRef.current, 100)) : GROUP_PAGE_SIZE;
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); }
    else if (!quiet) { pageOffsetRef.current = 0; hasMoreRef.current = false; setHasMore(false); setLoading(true); }
    try {
      const result = await groupService.getMyGroups({ limit, skip });
      if (!result?.success || !Array.isArray(result.groups)) throw new Error('Group list response was invalid.');
      if (requestId !== requestSequenceRef.current) return;
      setGroups(current => {
        if (!append) return result.groups;
        const existingIds = new Set(current.map(group => group._id));
        return [...current, ...result.groups.filter(group => !existingIds.has(group._id))];
      });
      pageOffsetRef.current = skip + result.groups.length;
      hasMoreRef.current = Boolean(result.hasMore);
      setHasMore(hasMoreRef.current);
      setError(false);
    } catch (e) { if (requestId === requestSequenceRef.current) setError(true); }
    finally {
      if (requestId === requestSequenceRef.current) { setLoading(false); setRefreshing(false); }
      if (append) { loadingMoreRef.current = false; setLoadingMore(false); }
    }
  }, [user?._id]);
  useFocusEffect(useCallback(() => { if (!authLoading) void fetchGroups(); }, [authLoading, fetchGroups]));
  useFocusEffect(useCallback(() => {
    if (!socket || !user?._id) return undefined;
    const refresh = () => { void fetchGroups({ quiet: true }); };
    socket.on('group_updated', refresh); socket.on('order_updated', refresh); socket.on('connect', refresh);
    return () => { socket.off('group_updated', refresh); socket.off('order_updated', refresh); socket.off('connect', refresh); };
  }, [fetchGroups, socket, user?._id]));
  const visibleGroups = useMemo(() => groups.filter(group => (tab === 'HISTORY') === isGroupHistory(group)), [groups, tab]);
  const onOpen = group => router.push({ pathname: '/my-group/[id]', params: { id: group._id } });
  const loadOlderGroups = () => { if (hasMoreRef.current) void fetchGroups({ append: true }); };
  const noVisibleGroups = <View style={styles.emptyList}><EmptyState title={tab === 'ACTIVE' ? 'No active group orders loaded' : 'No group history loaded'} message="Load older groups to check the rest of your activity." /><Button title="Load older groups" variant="outline" onPress={loadOlderGroups} /></View>;
  return <View style={styles.container}>
    <Header title="My Groups" showBack showCart={false} />
    <View style={styles.tabs}>
      {['ACTIVE', 'HISTORY'].map(value => <TouchableOpacity key={value} onPress={() => setTab(value)} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} style={[styles.tab, tab === value && styles.tabSelected]}>
        <Text style={[styles.tabText, tab === value && styles.tabTextSelected]}>{value === 'ACTIVE' ? 'Active' : 'History'}{value === 'ACTIVE' ? ` (${groups.filter(group => !isGroupHistory(group)).length})` : ''}</Text>
      </TouchableOpacity>)}
    </View>
    {authLoading || loading && !groups.length ? <LoadingIndicator message="Loading your groups…" /> : !user ? <EmptyState title="Sign in to view groups" message="Groups you create or join are saved to your account." buttonTitle="Sign in" onButtonPress={() => router.push('/(auth)/login')} /> : error && !groups.length ? <ErrorState title="Could not load your groups" message="Your groups are safe. Check your connection and retry." onRetry={() => { setRefreshing(true); void fetchGroups(); }} retrying={refreshing} /> : visibleGroups.length === 0 && !hasMore ? <EmptyState title={tab === 'ACTIVE' ? 'No active group orders' : 'No group history yet'} message={tab === 'ACTIVE' ? 'Create a Share a Meal group or join an invite to see it here.' : 'Completed or closed group orders will appear here.'} buttonTitle={tab === 'ACTIVE' ? 'Start Share a Meal' : undefined} onButtonPress={tab === 'ACTIVE' ? () => router.push('/group-order') : undefined} /> : <FlatList data={visibleGroups} keyExtractor={item => item._id} renderItem={({ item }) => <GroupCard group={item} onOpen={onOpen} />} contentContainerStyle={styles.list} initialNumToRender={6} maxToRenderPerBatch={8} windowSize={7} updateCellsBatchingPeriod={40} onEndReached={() => { if (visibleGroups.length) loadOlderGroups(); }} onEndReachedThreshold={0.45} ListEmptyComponent={noVisibleGroups} ListFooterComponent={loadingMore ? <LoadingIndicator message="Loading more groups…" /> : null} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchGroups(); }} colors={[COLORS.primary]} />} ListHeaderComponent={error ? <Text style={styles.refreshError}>Showing saved results; refresh failed.</Text> : null} />}
    {tab === 'ACTIVE' && !loading && user ? <Button title="Create or join a group" variant="outline" onPress={() => router.push('/group-order')} style={styles.createButton} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', margin: 16, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, tabSelected: { backgroundColor: COLORS.primaryLight },
  tabText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 14 }, tabTextSelected: { color: COLORS.primaryDark },
  list: { paddingHorizontal: 16, paddingBottom: 28, maxWidth: 720, width: '100%', alignSelf: 'center' },
  emptyList: { alignItems: 'center', paddingBottom: 24 },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, groupIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardHeading: { flex: 1 }, groupName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' }, muted: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  statePill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 }, activePill: { backgroundColor: COLORS.successLight }, historyPill: { backgroundColor: COLORS.surfaceMuted }, activeText: { color: COLORS.success }, historyText: { color: COLORS.textSecondary }, stateText: { fontSize: 10, fontWeight: '900' },
  statusBlock: { backgroundColor: COLORS.inputBackground, borderRadius: 13, padding: 12, marginTop: 14 }, statusLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }, statusValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 3 }, statusMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  viewButton: { minHeight: 46, marginTop: 12, borderRadius: 12, backgroundColor: COLORS.primary, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, viewButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  createButton: { marginHorizontal: 16, marginBottom: 14 }, refreshError: { color: COLORS.warning, paddingVertical: 8, fontSize: 12 },
});
