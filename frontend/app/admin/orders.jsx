import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ScrollView, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Header from '../../components/common/Header';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import EmptyState from '../../components/common/EmptyState';
import adminService from '../../services/adminService';
import { SocketContext } from '../../context/SocketContext';
import COLORS from '../../constants/colors';
import { isOrderOverdue, orderAgeMinutes } from '../../utils/orderAge';

export default function AdminOrdersScreen() {
  const { socket } = React.useContext(SocketContext);
  const [orders, setOrders] = useState([]);
  const [upiClaims, setUpiClaims] = useState([]);
  const [groupContributions, setGroupContributions] = useState([]);
  const [groupReconciliations, setGroupReconciliations] = useState([]);
  const [rejectingUpiId, setRejectingUpiId] = useState('');
  const [upiRejectReason, setUpiRejectReason] = useState('');
  const [rejectingGroupContributionId, setRejectingGroupContributionId] = useState('');
  const [groupRejectReason, setGroupRejectReason] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState('');
  const [orderRejectReason, setOrderRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('ACTIVE');
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [overdueMinutes, setOverdueMinutes] = useState(30);
  const [incomingOrderAlerts, setIncomingOrderAlerts] = useState(0);
  const [ageNow, setAgeNow] = useState(Date.now());
  const pageRef = useRef(1);
  const pagingRef = useRef(false);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    let active = true;
    adminService.getSettings().then(result => {
      const configured = Number(result?.settings?.orderOverdueMinutes);
      if (active && Number.isInteger(configured) && configured >= 1 && configured <= 240) setOverdueMinutes(configured);
    }).catch(error => console.warn('[Order desk settings]:', error.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setAgeNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchAdminOrders = useCallback(async ({ quiet = false, append = false } = {}) => {
    if (append && pagingRef.current) return;
    if (append) pagingRef.current = true;
    try {
      if (!quiet) setLoading(true);
      const page = append ? pageRef.current + 1 : 1;
      const params = { page, ...(selectedFilter !== 'ALL' ? { status: selectedFilter } : {}) };
      const res = await adminService.getAllOrders(params);

      if (res?.success && Array.isArray(res.orders)) {
        setOrders((current) => append ? [...current, ...res.orders] : res.orders);
        pageRef.current = page;
        setHasMore(page < (Number(res.pages) || 1));
        setLoadError(false);
      } else {
        throw new Error(res?.message || 'Order queue could not be loaded.');
      }
    } catch (e) {
      console.warn('[Admin Orders Fetch Error]:', e);
      setLoadError(true);
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
      pagingRef.current = false;
    }
  }, [selectedFilter]);

  const fetchUpiClaims = useCallback(async () => {
    try {
      const result = await adminService.getPendingUpiPayments();
      setUpiClaims(Array.isArray(result?.payments) ? result.payments : []);
    } catch (e) { console.warn('[UPI review queue]:', e.message); }
  }, []);

  const fetchGroupContributions = useCallback(async () => {
    try {
      const result = await adminService.getPendingGroupContributions();
      setGroupContributions(Array.isArray(result?.contributions) ? result.contributions : []);
      setGroupReconciliations(Array.isArray(result?.reconciliations) ? result.reconciliations : []);
    } catch (e) { console.warn('[Group contribution queue]:', e.message); }
  }, []);

  useEffect(() => {
    pageRef.current = 1;
    fetchAdminOrders();
  }, [fetchAdminOrders]);

  useEffect(() => { fetchUpiClaims(); fetchGroupContributions(); }, [fetchUpiClaims, fetchGroupContributions]);

  useEffect(() => {
    if (!socket) return undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => { fetchAdminOrders({ quiet: true }); fetchUpiClaims(); fetchGroupContributions(); }, 120);
    };
    const alertAndRefresh = () => {
      setIncomingOrderAlerts(count => count + 1);
      if (Platform.OS === 'web') {
        try {
          const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (AudioContextClass) {
            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.connect(gain); gain.connect(context.destination);
            gain.gain.setValueAtTime(0.075, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
            oscillator.frequency.setValueAtTime(740, context.currentTime);
            oscillator.frequency.setValueAtTime(940, context.currentTime + 0.12);
            oscillator.start(); oscillator.stop(context.currentTime + 0.32);
            oscillator.onended = () => { context.close().catch(() => {}); };
          }
        } catch (_) { /* The visible alert remains available if browser audio is blocked. */ }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      scheduleRefresh();
    };
    socket.on('new_order', alertAndRefresh);
    socket.on('order_updated', scheduleRefresh);
    socket.on('connect', scheduleRefresh);
    socket.on('refresh_authoritative_state', scheduleRefresh);
    return () => {
      clearTimeout(refreshTimerRef.current);
      socket.off('new_order', alertAndRefresh);
      socket.off('order_updated', scheduleRefresh);
      socket.off('connect', scheduleRefresh);
      socket.off('refresh_authoritative_state', scheduleRefresh);
    };
  }, [socket, fetchAdminOrders, fetchUpiClaims, fetchGroupContributions]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAdminOrders();
    fetchUpiClaims();
    fetchGroupContributions();
  };

  const handleUpdateStatus = async (orderId, newStatus, reason = '') => {
    try {
      const targetOrder = orders.find((o) => o._id === orderId);
      const orderNum = targetOrder ? targetOrder.orderNumber : orderId;
      await adminService.updateOrderStatus(orderId, newStatus, reason);
      if (newStatus === 'REJECTED') { setRejectingOrderId(''); setOrderRejectReason(''); }
      await fetchAdminOrders();
      const message = `Order #${orderNum} status updated to ${newStatus}.`;
      if (typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Status Updated', message);
    } catch (e) {
      console.error('[Update Order Status Error]:', e);
      const message = e.message || 'Could not update the order. Refresh and try again.';
      if (typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Update Failed', message);
    }
  };

  const handleConfirmCounterPayment = async (orderId) => {
    const confirmMessage = 'Confirm that cash was received for this order? This marks the payment as paid.';
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(confirmMessage)
      : await new Promise((resolve) => Alert.alert('Confirm Cash Payment', confirmMessage, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm Received', onPress: () => resolve(true) },
        ]));
    if (!confirmed) return;

    try {
      await adminService.confirmCounterPayment(orderId);
      await fetchAdminOrders();
      if (typeof window !== 'undefined') window.alert('Counter payment confirmed.');
      else Alert.alert('Payment Confirmed', 'Counter payment confirmed.');
    } catch (e) {
      const message = e.message || 'Could not confirm this payment.';
      if (typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Payment Not Confirmed', message);
    }
  };

  const handleReviewUpi = async (claim, action) => {
    const order = claim.orderId;
    if (action === 'REJECT') {
      setRejectingUpiId(claim._id);
      setUpiRejectReason('');
      return;
    }
    if (action === 'VERIFY') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(`Confirm you verified receipt of ₹${claim.amount} for order #${order?.orderNumber}?`)
        : await new Promise(resolve => Alert.alert('Verify UPI payment', `Confirm receipt of ₹${claim.amount} for order #${order?.orderNumber}?`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm verified', onPress: () => resolve(true) },
        ]));
      if (!confirmed) return;
    }
    try {
      await adminService.reviewUpiPayment(claim._id, action);
      await Promise.all([fetchUpiClaims(), fetchAdminOrders({ quiet: true })]);
    } catch (error) {
      const message = error.message || 'Could not review this UPI payment.';
      if (typeof window !== 'undefined') window.alert(message); else Alert.alert('Payment review failed', message);
    }
  };

  const submitUpiRejection = async (claim) => {
    const reason = upiRejectReason.trim();
    if (!reason) return;
    try {
      await adminService.reviewUpiPayment(claim._id, 'REJECT', reason);
      setRejectingUpiId(''); setUpiRejectReason('');
      await Promise.all([fetchUpiClaims(), fetchAdminOrders({ quiet: true })]);
    } catch (error) {
      const message = error.message || 'Could not reject this UPI claim.';
      if (typeof window !== 'undefined') window.alert(message); else Alert.alert('Payment review failed', message);
    }
  };

  const handleGroupContributionReview = async (entry, action, reason) => {
    const contribution = entry.contribution;
    if (action === 'VERIFY') {
      const amount = (Number(contribution.amountPaise) / 100).toFixed(2);
      const label = contribution.method === 'COUNTER' ? 'Confirm cash was received' : `Confirm the UPI receipt for reference ${contribution.upiTransactionReference || ''}`;
      const message = `${label} for ₹${amount} from ${entry.member?.name || 'this group member'}? Only verify money received by the outlet.`;
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(message)
        : await new Promise(resolve => Alert.alert('Verify group contribution', message, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm received', onPress: () => resolve(true) },
        ]));
      if (!confirmed) return;
    }
    try {
      await adminService.reviewGroupContribution(entry.groupId, contribution._id, action, reason);
      setRejectingGroupContributionId(''); setGroupRejectReason('');
      await Promise.all([fetchGroupContributions(), fetchAdminOrders({ quiet: true }), fetchUpiClaims()]);
    } catch (error) {
      const message = error.message || 'Could not update this group contribution.';
      if (typeof window !== 'undefined') window.alert(message); else Alert.alert('Group payment review failed', message);
    }
  };

  const handleReconcileGroupPayment = async (entry) => {
    const message = `All recorded contributions for group ${entry.groupCode} have outlet verification records. Reconcile their total against order #${entry.orderNumber}? This will not record a new payment.`;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(message)
      : await new Promise(resolve => Alert.alert('Reconcile group payment', message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Reconcile', onPress: () => resolve(true) },
      ]));
    if (!confirmed) return;
    try {
      await adminService.reconcileGroupPayment(entry.groupId);
      await Promise.all([fetchGroupContributions(), fetchAdminOrders({ quiet: true })]);
    } catch (error) {
      const text = error.message || 'Could not reconcile this group order payment.';
      if (typeof window !== 'undefined') window.alert(text); else Alert.alert('Reconciliation failed', text);
    }
  };

  const handleRejectOrder = orderId => { setRejectingOrderId(orderId); setOrderRejectReason(''); };

  return (
    <View style={styles.container}>
      <Header title="Kitchen & order desk" showBack showCart={false} />

      {incomingOrderAlerts > 0 ? <TouchableOpacity accessibilityRole="button" onPress={() => { setIncomingOrderAlerts(0); handleRefresh(); }} style={styles.newOrderAlert}>
        <Text style={styles.newOrderAlertText}>{incomingOrderAlerts} new order{incomingOrderAlerts === 1 ? '' : 's'} received · tap to refresh the kitchen queue</Text>
      </TouchableOpacity> : null}

      {upiClaims.length > 0 ? <View style={styles.upiQueue}>
        <Text style={styles.upiTitle}>UPI claims awaiting verification · {upiClaims.length}</Text>
        {upiClaims.map(claim => <View key={claim._id} style={styles.upiClaim}>
          <View style={{ flex: 1 }}>
            <Text style={styles.upiOrder}>#{claim.orderId?.orderNumber || 'Order'} · ₹{claim.amount}</Text>
            <Text style={styles.upiMeta}>{claim.orderId?.customerSnapshot?.name || claim.orderId?.userId?.name || 'Customer'} · Ref {claim.upiTransactionReference}</Text>
            {rejectingUpiId === claim._id ? <View style={styles.rejectForm}>
              <TextInput value={upiRejectReason} onChangeText={setUpiRejectReason} placeholder="Reason for rejecting this claim" maxLength={500} style={styles.rejectReasonInput} />
              <TouchableOpacity style={[styles.upiAction, styles.upiReject]} disabled={!upiRejectReason.trim()} onPress={() => submitUpiRejection(claim)}><Text style={styles.upiRejectText}>Submit reason</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setRejectingUpiId(''); setUpiRejectReason(''); }}><Text style={styles.upiCancelText}>Keep pending</Text></TouchableOpacity>
            </View> : null}
          </View>
          <View style={styles.upiActions}>
            <TouchableOpacity style={[styles.upiAction, styles.upiApprove]} onPress={() => handleReviewUpi(claim, 'VERIFY')}><Text style={styles.upiApproveText}>Verify received</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.upiAction, styles.upiReject]} onPress={() => handleReviewUpi(claim, 'REJECT')}><Text style={styles.upiRejectText}>Reject</Text></TouchableOpacity>
          </View>
        </View>)}
      </View> : null}

      {groupContributions.length > 0 || groupReconciliations.length > 0 ? <View style={styles.upiQueue}>
        <Text style={styles.upiTitle}>Group payment verification · {groupContributions.length + groupReconciliations.length} action{groupContributions.length + groupReconciliations.length === 1 ? '' : 's'}</Text>
        {groupReconciliations.map((entry) => <View key={`reconcile:${entry.groupId}`} style={styles.upiClaim}>
          <View style={{ flex: 1 }}><Text style={styles.upiOrder}>Group {entry.groupCode} · #{entry.orderNumber || 'Order'}</Text><Text style={styles.upiMeta}>Every member contribution has a saved verified payment record. Order payment status: {entry.paymentStatus || 'PENDING'}.</Text></View>
          <TouchableOpacity style={[styles.upiAction, styles.upiApprove]} onPress={() => handleReconcileGroupPayment(entry)}><Text style={styles.upiApproveText}>Reconcile total</Text></TouchableOpacity>
        </View>)}
        {groupContributions.map((entry) => {
          const contribution = entry.contribution;
          const rejectionKey = `${entry.groupId}:${contribution._id}`;
          return <View key={rejectionKey} style={styles.upiClaim}>
            <View style={{ flex: 1 }}>
              <Text style={styles.upiOrder}>Group {entry.groupCode} · #{entry.groupOrderNumber || 'Order'} · ₹{(Number(contribution.amountPaise) / 100).toFixed(2)}</Text>
              <Text style={styles.upiMeta}>{entry.member?.name || 'Member'} · {contribution.method === 'UPI_QR' ? `UPI ref ${contribution.upiTransactionReference || 'missing'}` : 'Cash at counter'} · {entry.checkoutMode === 'HOST_PAYS' ? 'Host pays' : 'Split payment'}</Text>
              {rejectingGroupContributionId === rejectionKey ? <View style={styles.rejectForm}>
                <TextInput value={groupRejectReason} onChangeText={setGroupRejectReason} placeholder="Reason for rejecting this UPI claim" maxLength={500} style={styles.rejectReasonInput} />
                <TouchableOpacity style={[styles.upiAction, styles.upiReject]} disabled={!groupRejectReason.trim()} onPress={() => handleGroupContributionReview(entry, 'REJECT', groupRejectReason.trim())}><Text style={styles.upiRejectText}>Submit reason</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setRejectingGroupContributionId(''); setGroupRejectReason(''); }}><Text style={styles.upiCancelText}>Keep pending</Text></TouchableOpacity>
              </View> : null}
            </View>
            <View style={styles.upiActions}>
              <TouchableOpacity style={[styles.upiAction, styles.upiApprove]} onPress={() => handleGroupContributionReview(entry, 'VERIFY')}><Text style={styles.upiApproveText}>{contribution.method === 'COUNTER' ? 'Confirm cash' : 'Verify UPI'}</Text></TouchableOpacity>
              {contribution.method === 'UPI_QR' && <TouchableOpacity style={[styles.upiAction, styles.upiReject]} onPress={() => { setRejectingGroupContributionId(rejectionKey); setGroupRejectReason(''); }}><Text style={styles.upiRejectText}>Reject</Text></TouchableOpacity>}
            </View>
          </View>;
        })}
      </View> : null}

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
        {['ACTIVE', 'ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED', 'REJECTED', 'CANCELLED'].map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setSelectedFilter(filter)}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <LoadingIndicator message="Fetching incoming orders..." />
      ) : orders.length === 0 ? (
        <EmptyState title={loadError ? 'Order queue unavailable' : 'No Orders'} message={loadError ? 'Check your connection and refresh. Existing order data is preserved when a refresh fails.' : 'No orders match the selected status filter.'} buttonTitle={loadError ? 'Refresh' : undefined} onButtonPress={loadError ? handleRefresh : undefined} />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={orders}
          ListHeaderComponent={loadError ? <Text style={styles.refreshWarning}>Could not refresh the queue. Showing the last loaded orders.</Text> : null}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
          }
          onEndReached={() => { if (hasMore && !loading) fetchAdminOrders({ quiet: true, append: true }); }}
          onEndReachedThreshold={0.45}
          renderItem={({ item }) => (
            <View style={[styles.orderCard, isOrderOverdue(item, overdueMinutes, ageNow) && styles.orderCardOverdue]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                    <Text style={[
                      styles.orderTypeBadge,
                      item.orderType === 'DELIVERY' && styles.deliveryBadge,
                      item.orderType === 'DINE_IN' && styles.dineInBadge
                    ]}>
                      {item.orderType || 'TAKEAWAY'}
                    </Text>
                    <Text style={styles.customerName}>
                      👤 {item.customerSnapshot?.name || item.userId?.name || 'Student'} • 📱 {item.customerSnapshot?.phone || item.userId?.phone || 'N/A'}
                    </Text>
                    {item.customerSnapshot?.email || item.userId?.email ? <Text style={styles.customerName}>{item.customerSnapshot?.email || item.userId?.email}</Text> : null}
                  </View>
                </View>
                <View style={styles.statusBadges}><StatusBadge status={item.orderStatus} /><StatusBadge status={item.paymentStatus || 'PENDING'} /></View>
              </View>

              <View style={styles.orderAgeRow}>
                <Text style={styles.orderTime}>Placed {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {orderAgeMinutes(item.createdAt, ageNow) ?? '—'} min</Text>
                {isOrderOverdue(item, overdueMinutes, ageNow) ? <Text style={styles.overdueBadge}>OVERDUE</Text> : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.itemsSummary}>
                {item.items?.map((it, idx) => (
                  <View key={`${it.productId || it.name}-${idx}`} style={styles.itemSummaryRow}>
                    <Text style={styles.itemText}>{it.quantity} × {it.name} (₹{it.itemTotal ?? it.priceAtPurchase * it.quantity})</Text>
                    {it.customizations?.length ? <Text style={styles.customizationText}>Add-ons: {it.customizations.map((customization) => customization.name).join(', ')}</Text> : null}
                  </View>
                ))}
              </View>

              <Text style={styles.fulfillmentText}>
                {item.orderType === 'DELIVERY' ? `Delivery · ${[item.hostel, item.roomNumber].filter(Boolean).join(' / ')}` : item.orderType === 'DINE_IN' ? `Dine-in · ${item.tableId?.label || `Table ${item.tableId?.tableNumber || ''}`}` : `Pickup · ${item.pickupLocation || 'Wrapchik counter'} · ${item.pickupTimeSlot || 'Immediate'}`}
              </Text>
              {Number(item.discountAmount) > 0 ? <Text style={styles.customizationText}>Coupon {item.couponCode || ''} · −₹{item.discountAmount}</Text> : null}
              {item.deliveryInstructions ? <Text style={styles.customizationText}>Customer instructions: {item.deliveryInstructions}</Text> : null}

              <View style={styles.cardFooter}>
                <Text style={styles.totalVal}>Total: ₹{item.totalAmount}</Text>
                <Text style={styles.paymentStatus}>Payment: {item.paymentStatus || 'PENDING'} ({item.paymentMethod === 'UPI_QR' ? 'UPI' : (item.paymentMethod || 'COUNTER') === 'COUNTER' ? 'Cash at counter' : item.paymentMethod})</Text>

                {['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(item.paymentMethod) && item.paymentStatus !== 'SUCCESS' && ['PLACED', 'ACCEPTED', 'PREPARING'].includes(item.orderStatus) ? (
                  <Text style={styles.paymentGateNote}>Awaiting verified {item.paymentMethod === 'CASHFREE' ? 'legacy Cashfree' : item.paymentMethod === 'UPI_QR' ? 'UPI' : 'legacy Razorpay'} payment. Kitchen acceptance stays locked.</Text>
                ) : null}

                {(item.paymentMethod || 'COUNTER') === 'COUNTER' && item.paymentStatus !== 'SUCCESS' && !['CANCELLED', 'REJECTED'].includes(item.orderStatus) && (
                  <Button
                    title="Confirm cash received"
                    variant="outline"
                    onPress={() => handleConfirmCounterPayment(item._id)}
                    style={styles.actionBtnFull}
                  />
                )}

                {/* State Machine Action Controls */}
                <View style={styles.actionsRow}>
                  {item.orderStatus === 'PLACED' && (
                    <>
                      {(!['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(item.paymentMethod) || item.paymentStatus === 'SUCCESS') ? (
                        <Button
                          title="Accept"
                          onPress={() => handleUpdateStatus(item._id, 'ACCEPTED')}
                          style={styles.actionBtnSmall}
                        />
                      ) : null}
                      {item.paymentStatus !== 'SUCCESS' ? (
                        rejectingOrderId === item._id ? <View style={styles.orderRejectForm}>
                          <TextInput value={orderRejectReason} onChangeText={setOrderRejectReason} placeholder="Reason for rejecting this order" maxLength={500} accessibilityLabel="Required order rejection reason" style={styles.rejectReasonInput} />
                          <View style={styles.actionsRow}>
                            <Button title="Confirm reject" variant="danger" disabled={!orderRejectReason.trim()} onPress={() => handleUpdateStatus(item._id, 'REJECTED', orderRejectReason.trim())} style={styles.actionBtnSmall} />
                            <Button title="Keep order" variant="outline" onPress={() => { setRejectingOrderId(''); setOrderRejectReason(''); }} style={styles.actionBtnSmall} />
                          </View>
                        </View> : <Button title="Reject" variant="danger" onPress={() => handleRejectOrder(item._id)} style={styles.actionBtnSmall} />
                      ) : <Text style={styles.paymentGateNote}>Paid orders cannot be rejected here because refunds are not enabled.</Text>}
                    </>
                  )}

                  {item.orderStatus === 'ACCEPTED' && (
                    <Button
                      title="Start Preparing"
                      onPress={() => handleUpdateStatus(item._id, 'PREPARING')}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'PREPARING' && (
                    <Button
                      title={item.orderType === 'DINE_IN' ? "Mark as Served" : "Mark Ready for Pickup"}
                      onPress={() => handleUpdateStatus(item._id, item.orderType === 'DINE_IN' ? 'SERVED' : 'READY')}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'READY' && (
                    <Button
                      title={item.orderType === 'DELIVERY' ? "Mark Picked Up" : "Mark Completed"}
                      onPress={() => handleUpdateStatus(item._id, item.orderType === 'DELIVERY' ? 'PICKED_UP' : 'COMPLETED')}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'PICKED_UP' && item.orderType === 'DELIVERY' && (
                    <Button
                      title="Mark Delivered"
                      onPress={() => handleUpdateStatus(item._id, 'DELIVERED')}
                      style={styles.actionBtnFull}
                    />
                  )}

                  {item.orderStatus === 'SERVED' && item.orderType === 'DINE_IN' && (
                    <Button
                      title="Mark Completed"
                      onPress={() => handleUpdateStatus(item._id, 'COMPLETED')}
                      style={styles.actionBtnFull}
                    />
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  newOrderAlert: { marginHorizontal: 14, marginTop: 9, padding: 12, borderRadius: 10, backgroundColor: '#FFF0DE', borderWidth: 1, borderColor: '#E7AA54' },
  newOrderAlertText: { color: '#784900', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  upiQueue: { marginHorizontal: 14, marginTop: 8, padding: 14, backgroundColor: '#FFF8F3', borderRadius: 14, borderWidth: 1, borderColor: '#F2D7C8' },
  upiTitle: { color: COLORS.textPrimary, fontWeight: '900', fontSize: 14, marginBottom: 9 },
  upiClaim: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  upiOrder: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  upiMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  rejectForm: { marginTop: 8, gap: 6 },
  orderRejectForm: { width: '100%', gap: 8 },
  rejectReasonInput: { minWidth: 180, backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, padding: 8, fontSize: 12, color: COLORS.textPrimary },
  upiCancelText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', paddingVertical: 3 },
  upiActions: { gap: 5 },
  upiAction: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  upiApprove: { backgroundColor: '#EAF6ED' }, upiApproveText: { color: '#246A3B', fontSize: 11, fontWeight: '800' },
  upiReject: { backgroundColor: '#FCEBE8' }, upiRejectText: { color: '#97372B', fontSize: 11, fontWeight: '800' },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  refreshWarning: { color: COLORS.warning, backgroundColor: COLORS.warningLight, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: '700' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardOverdue: { borderColor: '#D95A4E', borderWidth: 2, backgroundColor: '#FFF9F8' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNum: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  orderTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    color: '#FFF',
  },
  deliveryBadge: {
    backgroundColor: COLORS.info,
  },
  dineInBadge: {
    backgroundColor: COLORS.success,
  },
  customerName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadges: { alignItems: 'flex-end', gap: 5 },
  orderTime: { color: COLORS.textSecondary, fontSize: 11, marginTop: 5 },
  orderAgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  overdueBadge: { color: '#982D24', backgroundColor: '#FCE8E6', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  itemsSummary: {
    marginBottom: 10,
  },
  itemSummaryRow: { marginBottom: 4 },
  itemText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  customizationText: { color: COLORS.textSecondary, fontSize: 11, marginLeft: 18, marginTop: 2 },
  fulfillmentText: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  cardFooter: {
    marginTop: 4,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 10,
  },
  paymentStatus: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  paymentGateNote: { color: COLORS.warning, fontSize: 12, lineHeight: 17, fontWeight: '700', marginBottom: 8 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    flex: 1,
    minHeight: 48,
  },
  actionBtnFull: {
    width: '100%',
    minHeight: 48,
  },
});
