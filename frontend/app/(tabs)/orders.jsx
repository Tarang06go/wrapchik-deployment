import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CartContext } from '../../context/CartContext';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/common/Header';
import OrderCard from '../../components/order/OrderCard';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import orderService from '../../services/orderService';
import COLORS from '../../constants/colors';
import { SocketContext } from '../../context/SocketContext';
import { orderFilterFromParam } from '../../utils/orderFilterCore.mjs';

const ORDER_PAGE_SIZE = 20;

export default function OrdersScreen() {
  const router = useRouter();
  const { addToCart } = useContext(CartContext);
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const { filter: filterParam } = useLocalSearchParams();
  const routeFilter = orderFilterFromParam(filterParam);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(routeFilter); // ALL, ACTIVE, COMPLETED
  const [loadError, setLoadError] = useState(false);
  const [reordering, setReordering] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const lastSocketEventRef = useRef('');
  const pageOffsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const lastRouteFilterRef = useRef(routeFilter);

  useEffect(() => {
    if (lastRouteFilterRef.current !== routeFilter) {
      lastRouteFilterRef.current = routeFilter;
      setOrders([]);
      pageOffsetRef.current = 0;
      hasMoreRef.current = false;
      setHasMore(false);
      setFilter(routeFilter);
    }
  }, [routeFilter]);

  const fetchOrders = useCallback(async ({ quiet = false, append = false } = {}) => {
    if (append && (loadingMoreRef.current || !hasMoreRef.current)) return;
    const requestId = ++requestSequenceRef.current;
    const skip = append ? pageOffsetRef.current : 0;
    const limit = quiet && !append ? Math.max(ORDER_PAGE_SIZE, Math.min(pageOffsetRef.current, 100)) : ORDER_PAGE_SIZE;
    if (append) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else if (!quiet) {
      pageOffsetRef.current = 0;
      hasMoreRef.current = false;
      setHasMore(false);
      setLoading(true);
    }
    try {
      const params = { limit, skip };
      if (filter !== 'ALL') params.statusGroup = filter;
      const res = await orderService.getMyOrders(params);
      if (!res?.success || !Array.isArray(res.orders)) throw new Error('Order history could not be loaded.');
      if (requestId !== requestSequenceRef.current) return;
      setOrders(current => {
        if (!append) return res.orders;
        const existingIds = new Set(current.map(order => order._id));
        return [...current, ...res.orders.filter(order => !existingIds.has(order._id))];
      });
      pageOffsetRef.current = skip + res.orders.length;
      hasMoreRef.current = Boolean(res.hasMore);
      setHasMore(hasMoreRef.current);
      setLoadError(false);
    } catch (e) {
      if (requestId !== requestSequenceRef.current) return;
      console.warn('[OrdersScreen Error]:', e);
      setLoadError(true);
    } finally {
      if (requestId === requestSequenceRef.current) {
        if (!quiet && !append) setLoading(false);
        setRefreshing(false);
      }
      if (append) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    if (!authLoading && user) {
      void fetchOrders();
    }
  }, [authLoading, user?._id, fetchOrders]));

  useFocusEffect(useCallback(() => {
    if (!socket || !user) return undefined;
    const refresh = (event) => {
      if (event?.orderId && event.orderStatus && event.paymentStatus) {
        const eventKey = `${event.orderId}:${event.orderStatus}:${event.paymentStatus}`;
        if (lastSocketEventRef.current === eventKey) return;
        lastSocketEventRef.current = eventKey;
      }
      fetchOrders({ quiet: true });
    };
    socket.on('order_updated', refresh);
    socket.on('connect', refresh);
    socket.on('refresh_authoritative_state', refresh);
    return () => { socket.off('order_updated', refresh); socket.off('connect', refresh); socket.off('refresh_authoritative_state', refresh); };
  }, [socket, user?._id, fetchOrders]));

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleReorder = async (orderId) => {
    if (reordering) return;
    setReordering(orderId);
    try {
      const res = await orderService.reorderFromPast(orderId);
      if (res.success) {
        const { reorderItems = [], unavailableItems = [] } = res;
        reorderItems.forEach(item => {
          addToCart({
            _id: item.productId,
            name: item.name,
            price: item.basePrice,
            imageUrl: item.imageUrl,
            isVeg: item.isVeg,
          }, item.customizations, item.quantity);
        });
        if (unavailableItems && unavailableItems.length > 0) {
          Alert.alert('Notice', 'Some items from your past order are currently unavailable and were not added to your cart.');
        } else {
          Alert.alert('Success', 'Items added to cart!');
        }
        router.push('/(tabs)/cart');
      } else {
        Alert.alert('Error', 'Failed to reorder.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred while reordering.');
    } finally {
      setReordering(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') {
      return ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'].includes(o.orderStatus);
    }
    if (filter === 'COMPLETED') {
      return ['COMPLETED', 'DELIVERED', 'SERVED', 'REJECTED', 'CANCELLED'].includes(o.orderStatus);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <Header title="My Orders" showCart={false} />

      {/* Filter Tabs */}
      {user ? <View style={styles.filterContainer}>
        {['ALL', 'ACTIVE', 'COMPLETED'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (filter === tab) return;
              setOrders([]);
              pageOffsetRef.current = 0;
              hasMoreRef.current = false;
              setHasMore(false);
              setFilter(tab);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === tab }}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === 'ALL' ? 'All Orders' : tab === 'ACTIVE' ? 'Live Orders' : 'Past Orders'}
            </Text>
          </TouchableOpacity>
        ))}
      </View> : null}

      {authLoading ? (
        <LoadingIndicator message="Restoring your session…" />
      ) : !user ? (
        <EmptyState title="Sign in to view your orders" message="Your order status and receipts are saved to your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'orders' } })} />
      ) : loadError && !loading && orders.length === 0 ? (
        <ErrorState title="Could not load your orders" message="Check your connection and retry. Your order history has not been cleared." onRetry={handleRefresh} retrying={refreshing} />
      ) : loading && !refreshing && orders.length === 0 ? (
        <LoadingIndicator message="Loading your order history..." />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={filter === 'ACTIVE' ? 'No live orders' : filter === 'COMPLETED' ? 'No past orders yet' : 'No Orders Found'}
          message={filter === 'ACTIVE' ? 'New orders will appear here while the outlet prepares them.' : filter === 'COMPLETED' ? 'Completed and cancelled orders will be saved here.' : "You haven't placed any food orders yet. Explore our menu."}
          buttonTitle={filter === 'ALL' ? 'Browse menu' : undefined}
          onButtonPress={filter === 'ALL' ? () => router.push('/(tabs)/menu') : undefined}
        />
      ) : (
        <FlatList
          data={filteredOrders}
          ListHeaderComponent={loadError ? <Text style={styles.refreshWarning}>Could not refresh. Showing the last loaded order history.</Text> : null}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.orderCardWrapper}>
              <OrderCard order={item} />
              {item.groupOrderId ? <View style={styles.reorderBtnContainer}><Button title="View group details" variant="outline" onPress={() => router.push({ pathname: '/my-group/[id]', params: { id: String(item.groupOrderId?._id || item.groupOrderId) } })} style={styles.reorderBtn} /></View> : null}
              {item.orderStatus === 'PLACED' && item.paymentMethod === 'UPI_QR' && item.paymentStatus !== 'SUCCESS' && !(item.paymentId?.status === 'PENDING' && item.paymentId?.upiTransactionReference) ? <View style={styles.reorderBtnContainer}><Button title={item.paymentStatus === 'FAILED' ? 'Retry payment for this order' : 'Complete payment'} onPress={() => router.push({ pathname: '/payment', params: { orderId: item._id, orderNumber: item.orderNumber } })} style={styles.reorderBtn} /></View> : null}
              {item.paymentId?.status === 'PENDING' && item.paymentId?.upiTransactionReference ? <Text style={styles.pendingPayment}>UPI reference submitted · awaiting outlet verification. Do not pay again.</Text> : null}
              {['COMPLETED', 'DELIVERED', 'SERVED'].includes(item.orderStatus) && (
                <View style={styles.reorderBtnContainer}>
                  <Button
                    title="Reorder"
                    onPress={() => handleReorder(item._id)}
                    loading={reordering === item._id}
                    style={styles.reorderBtn}
                  />
                </View>
              )}
            </View>
          )}
          onEndReached={() => { if (hasMoreRef.current) void fetchOrders({ append: true }); }}
          onEndReachedThreshold={0.45}
          initialNumToRender={5}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={40}
          ListFooterComponent={loadingMore ? <LoadingIndicator message="Loading more orders…" /> : null}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  orderCardWrapper: {
    marginBottom: 16,
  },
  reorderBtnContainer: {
    marginTop: -20,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  reorderBtn: {
    paddingVertical: 8,
  },
  pendingPayment: { marginTop: -8, marginBottom: 10, marginHorizontal: 10, color: COLORS.warning, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  refreshWarning: { color: COLORS.warning, backgroundColor: COLORS.warningLight, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: '700' },
});
