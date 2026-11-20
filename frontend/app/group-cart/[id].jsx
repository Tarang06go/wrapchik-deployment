import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react-native';
import Header from '../../components/common/Header';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import ProductImage from '../../components/common/ProductImage';
import { AuthContext } from '../../context/AuthContext';
import { SocketContext } from '../../context/SocketContext';
import groupService from '../../services/groupService';
import productService from '../../services/productService';
import settingsService from '../../services/settingsService';
import { deriveGroupRole } from '../../utils/groupRole';
import COLORS from '../../constants/colors';

const idOf = (value) => String(value?._id || value || '');
const money = (paise) => `₹${(Number(paise || 0) / 100).toFixed(2)}`;

export default function GroupCartScreen() {
  const params = useLocalSearchParams();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [group, setGroup] = useState(null);
  const { isLeader } = deriveGroupRole(group, user?._id);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyItem, setBusyItem] = useState('');
  const [checkoutMode, setCheckoutMode] = useState('SPLIT');
  const [paymentMethod, setPaymentMethod] = useState('UPI_QR');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [instructionsByContribution, setInstructionsByContribution] = useState({});
  const [referenceByContribution, setReferenceByContribution] = useState({});
  const [paymentBusy, setPaymentBusy] = useState('');
  const [minimumGroupOrderValue, setMinimumGroupOrderValue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [groupResult, productResult, settingsResult] = await Promise.all([
        groupService.getGroupDetails(groupId),
        productService.getProducts({ sortBy: 'name', sortOrder: 'asc' }),
        settingsService.getSettings(),
      ]);
      if (!groupResult?.success || !groupResult.group) throw new Error(groupResult?.message || 'The group could not be loaded.');
      setGroup(groupResult.group);
      setProducts((productResult?.products || []).filter((product) => product.available !== false));
      setMinimumGroupOrderValue(Math.max(0, Number(settingsResult?.settings?.groupMinimumOrderValue || 0)));
    } catch (loadError) {
      setError(loadError.message || 'The shared cart could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket || !groupId) return undefined;
    const onGroupUpdated = (event) => {
      if (String(event?.groupId) === String(groupId)) load();
    };
    const refresh = () => load();
    socket.on('group_updated', onGroupUpdated);
    socket.on('refresh_authoritative_state', refresh);
    return () => { socket.off('group_updated', onGroupUpdated); socket.off('refresh_authoritative_state', refresh); };
  }, [socket, groupId, load]);

  useEffect(() => {
    if (group?.status !== 'LOCKED' || !groupId || !user?._id) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }
    let active = true;
    setQuote(null);
    setQuoteError('');
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await groupService.previewCheckout(groupId, {
          checkoutMode,
          ...(isLeader && couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        });
        if (active) setQuote(response?.quote || null);
      } catch (quoteFailure) {
        if (active) {
          setQuoteError(quoteFailure.message || 'Could not calculate the server checkout quote.');
          if (/price or customization changed/i.test(quoteFailure.message || '')) load();
        }
      } finally { if (active) setQuoteLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [group?.status, groupId, user?._id, isLeader, checkoutMode, couponCode, load]);

  const activeMembers = useMemo(() => (group?.members || []).filter((member) => member.status === 'JOINED'), [group]);
  const items = group?.items || [];
  const totalPaise = items.reduce((sum, item) => sum + Number(item.itemTotalPaise || 0), 0);
  const isLocked = group?.status !== 'OPEN';
  const sharesAccepted = items.every((item) => item.shareMode !== 'SHARED' || (item.allocations || []).every((allocation) => allocation.acceptedRevision === item.revision && allocation.acceptedAt));

  const addProduct = (product) => router.push(`/product/${product._id}?groupId=${encodeURIComponent(groupId)}`);

  const updateItem = async (item, patch) => {
    setBusyItem(idOf(item));
    try {
      const response = await groupService.updateItem(groupId, idOf(item), {
        quantity: patch.quantity ?? item.quantity,
        customizations: item.customizations?.map((customization) => ({ name: customization.name })) || [],
      });
      setGroup(response.group);
    } catch (actionError) {
      Alert.alert('Could not update item', actionError.message || 'Refresh the shared cart and try again.');
    } finally {
      setBusyItem('');
    }
  };

  const removeItem = (item) => Alert.alert('Remove item', `Remove ${item.name} from the group cart?`, [
    { text: 'Keep item', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setBusyItem(idOf(item));
      try { const response = await groupService.removeItem(groupId, idOf(item)); setGroup(response.group); }
      catch (actionError) { Alert.alert('Could not remove item', actionError.message || 'Refresh and try again.'); }
      finally { setBusyItem(''); }
    } },
  ]);

  const shareEqually = async (item) => {
    setBusyItem(idOf(item));
    try {
      const response = await groupService.configureItemShares(groupId, idOf(item), activeMembers.map((member) => idOf(member.userId)));
      setGroup(response.group);
      Alert.alert('Shares proposed', 'Each participant must accept their share before the group can be locked.');
    } catch (actionError) {
      Alert.alert('Could not share dish', actionError.message || 'Refresh the group and try again.');
    } finally { setBusyItem(''); }
  };

  const acceptShare = async (item) => {
    setBusyItem(idOf(item));
    try {
      const response = await groupService.acceptItemShare(groupId, idOf(item));
      setGroup(response.group);
      Alert.alert('Share accepted', `Your assigned share is ${money(response.yourSharePaise)}.`);
    } catch (actionError) {
      Alert.alert('Could not accept share', actionError.message || 'Refresh the group and review the amount.');
    } finally { setBusyItem(''); }
  };

  const lockGroup = async () => {
    setCheckoutBusy(true);
    try {
      const response = await groupService.lockGroup(groupId);
      setGroup(response.group);
    } catch (actionError) {
      Alert.alert('Could not lock group', actionError.message || 'Refresh and review the group shares.');
    } finally { setCheckoutBusy(false); }
  };

  const placeOrder = async () => {
    setCheckoutBusy(true);
    try {
      const response = await groupService.checkout(groupId, { checkoutMode, paymentMethod, ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}) });
      if (!response?.success || !response.order) throw new Error(response?.message || 'The group order was not placed.');
      setGroup({ ...response.group, orderId: response.order });
      Alert.alert('Group order placed', 'Contributions remain pending until the outlet verifies each payment.');
    } catch (actionError) {
      Alert.alert('Checkout unavailable', actionError.message || 'Refresh the group and try again.');
      load();
    } finally { setCheckoutBusy(false); }
  };

  const loadContributionInstructions = async (contribution) => {
    const contributionId = idOf(contribution);
    setPaymentBusy(contributionId);
    try {
      const response = await groupService.getContributionInstructions(groupId, contributionId);
      const instructions = response.instructions;
      setInstructionsByContribution((current) => ({ ...current, [contributionId]: instructions }));
      if (Platform.OS !== 'web') {
        try { await Linking.openURL(instructions.upiUri); }
        catch { Alert.alert('UPI app unavailable', 'Scan the QR code below with a UPI app, or pay at the counter if the outlet allows it.'); }
      }
    } catch (actionError) {
      Alert.alert('UPI instructions unavailable', actionError.message || 'Try again or contact the outlet.');
    } finally { setPaymentBusy(''); }
  };

  const submitContributionReference = async (contribution) => {
    const contributionId = idOf(contribution);
    const transactionReference = String(referenceByContribution[contributionId] || '').trim();
    setPaymentBusy(contributionId);
    try {
      await groupService.submitContributionReference(groupId, contributionId, transactionReference);
      await load();
      Alert.alert('Reference submitted', 'Your contribution remains pending until the outlet verifies the receipt.');
    } catch (actionError) {
      Alert.alert('Could not submit reference', actionError.message || 'Check the reference and try again.');
    } finally { setPaymentBusy(''); }
  };

  if (loading) return <View style={styles.container}><Header title="Shared group cart" showBack showCart={false} /><View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View></View>;
  if (error || !group) return <View style={styles.container}><Header title="Shared group cart" showBack showCart={false} /><ErrorState title="Shared cart unavailable" message={error || 'This group could not be found.'} onRetry={load} /></View>;

  return (
    <View style={styles.container}>
      <Header title="Shared group cart" showBack showCart={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.summary}>
          <Text style={styles.eyebrow}>GROUP {group.groupCode}</Text>
          <Text style={styles.title}>Food picked together</Text>
          <Text style={styles.subtitle}>{activeMembers.length} active members · {isLocked ? 'Invite locked' : 'Each person manages their own items'}</Text>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Shared cart</Text><Text style={styles.total}>{money(totalPaise)}</Text></View>
        {minimumGroupOrderValue > 0 ? <View style={styles.minimumProgress}>
          <Text style={styles.minimumCopy}>{totalPaise >= minimumGroupOrderValue * 100 ? 'Minimum order reached' : `${money(Math.max(0, minimumGroupOrderValue * 100 - totalPaise))} to reach the outlet minimum`}</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, totalPaise / (minimumGroupOrderValue * 100) * 100)}%` }]} /></View>
          <Text style={styles.minimumHint}>Group minimum subtotal: ₹{minimumGroupOrderValue.toFixed(2)} before coupon, tax and delivery</Text>
        </View> : null}
        {items.length === 0 ? (
          <View style={styles.empty}><ShoppingBag size={24} color={COLORS.primary} /><Text style={styles.emptyTitle}>Nothing in the cart yet</Text><Text style={styles.emptyText}>Choose food below. Other group members will see additions live.</Text></View>
        ) : items.map((item) => {
          const ownerId = idOf(item.selectedBy);
          const mine = ownerId === String(user?._id);
          const currentShare = item.allocations?.find((allocation) => idOf(allocation.userId) === String(user?._id));
          const acceptedCount = item.allocations?.filter((allocation) => allocation.acceptedRevision === item.revision && allocation.acceptedAt).length || 0;
          const shareReady = item.shareMode !== 'SHARED' || acceptedCount === item.allocations?.length;
          return (
            <View key={idOf(item)} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{mine ? 'Added by you' : `Added by ${item.selectedBy?.name || 'group member'}`} · {item.quantity} × ₹{Number(item.priceAtPurchase).toFixed(2)}</Text>
                  {!!item.customizations?.length && <Text style={styles.itemMeta}>{item.customizations.map((customization) => customization.name).join(', ')}</Text>}
                  <Text style={styles.itemPrice}>{money(item.itemTotalPaise)}</Text>
                </View>
                {mine && !isLocked && <TouchableOpacity onPress={() => removeItem(item)} disabled={Boolean(busyItem)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} style={styles.removeButton}><Trash2 size={17} color={COLORS.danger} /></TouchableOpacity>}
              </View>
              {mine && !isLocked && <View style={styles.quantityRow}>
                <Text style={styles.muted}>Quantity</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity disabled={item.quantity <= 1 || Boolean(busyItem)} onPress={() => updateItem(item, { quantity: item.quantity - 1 })} style={styles.stepButton}><Minus size={16} color={COLORS.textPrimary} /></TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity disabled={item.quantity >= 50 || Boolean(busyItem)} onPress={() => updateItem(item, { quantity: item.quantity + 1 })} style={styles.stepButton}><Plus size={16} color={COLORS.textPrimary} /></TouchableOpacity>
                </View>
              </View>}
              {item.shareMode === 'SHARED' ? <View style={styles.shareBox}>
                <Text style={styles.shareTitle}>Shared dish · {acceptedCount}/{item.allocations?.length || 0} accepted</Text>
                {item.allocations?.map((allocation) => <Text key={idOf(allocation.userId)} style={styles.shareLine}>{allocation.userId?.name || 'Member'}: {money(allocation.amountPaise)} · {allocation.acceptedRevision === item.revision && allocation.acceptedAt ? 'Accepted' : 'Awaiting acceptance'}</Text>)}
                {currentShare && !shareReady && !(currentShare.acceptedRevision === item.revision && currentShare.acceptedAt) && !isLocked && <Button title={`Accept your ${money(currentShare.amountPaise)} share`} onPress={() => acceptShare(item)} loading={busyItem === idOf(item)} style={styles.smallButton} />}
                {!shareReady && <Text style={styles.warning}>Group locking waits for every participant to accept. Editing the dish resets acceptance.</Text>}
              </View> : null}
              {mine && !isLocked && activeMembers.length >= 2 && item.shareMode !== 'SHARED' && <Button title="Share this dish equally with group" variant="outline" onPress={() => shareEqually(item)} loading={busyItem === idOf(item)} style={styles.smallButton} />}
              {busyItem === idOf(item) && <Text style={styles.muted}>Updating…</Text>}
            </View>
          );
        })}

        {group.status === 'OPEN' && isLeader ? <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTitle}>Ready to order together?</Text>
          <Text style={styles.noticeText}>Locking closes the invite and freezes the cart. Everyone must accept assigned shared-dish amounts first.</Text>
          <Button title="Lock group and continue" onPress={lockGroup} loading={checkoutBusy} disabled={items.length === 0 || activeMembers.length < 2 || !sharesAccepted} style={styles.smallButton} />
          {(!sharesAccepted || activeMembers.length < 2 || items.length === 0) && <Text style={styles.warning}>Add food, invite at least one friend, and collect every shared-dish acceptance to continue.</Text>}
        </View> : null}
        {group.status === 'OPEN' && !isLeader ? <View style={styles.notice}><Text style={styles.noticeTitle}>The group leader controls checkout</Text><Text style={styles.noticeText}>Add food or accept your shared-dish allocation. The leader can lock the cart when everyone is ready.</Text></View> : null}
        {group.status === 'LOCKED' && isLeader ? <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTitle}>Place the group order</Text>
          <Text style={styles.noticeText}>The server will recheck catalogue prices, fees, coupon eligibility and every item share before creating one kitchen order.</Text>
          <Text style={styles.choiceLabel}>Who pays Wrapchik?</Text>
          <View style={styles.choiceRow}>
            {['SPLIT', 'HOST_PAYS'].map((mode) => <TouchableOpacity key={mode} onPress={() => setCheckoutMode(mode)} style={[styles.choice, checkoutMode === mode && styles.choiceActive]}><Text style={[styles.choiceText, checkoutMode === mode && styles.choiceTextActive]}>{mode === 'SPLIT' ? 'Members pay shares' : 'Host pays total'}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.choiceLabel}>Payment at the outlet</Text>
          <View style={styles.choiceRow}>
            {['UPI_QR', 'COUNTER'].map((method) => <TouchableOpacity key={method} onPress={() => setPaymentMethod(method)} style={[styles.choice, paymentMethod === method && styles.choiceActive]}><Text style={[styles.choiceText, paymentMethod === method && styles.choiceTextActive]}>{method === 'UPI_QR' ? 'UPI (manual verify)' : 'Cash at counter'}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.choiceLabel}>Coupon code (optional)</Text>
          <TextInput value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" maxLength={32} placeholder="Enter a coupon code" style={styles.referenceInput} />
          {quoteLoading ? <Text style={styles.muted}>Checking current prices and member shares…</Text> : null}
          {!!quoteError && <Text style={styles.warning}>{quoteError}</Text>}
          {quote && <View style={styles.quoteBox}>
            <Text style={styles.shareTitle}>Server checkout estimate</Text>
            <Text style={styles.quoteLine}>Items <Text style={styles.quoteAmount}>{money(quote.subtotalPaise)}</Text></Text>
            {quote.discountPaise > 0 && <Text style={styles.quoteLine}>Coupon {quote.discountCode ? `(${quote.discountCode})` : ''} <Text style={styles.quoteAmount}>−{money(quote.discountPaise)}</Text></Text>}
            <Text style={styles.quoteLine}>Tax and fees <Text style={styles.quoteAmount}>{money(quote.taxAndFeesPaise)}</Text></Text>
            {quote.deliveryFeePaise > 0 && <Text style={styles.quoteLine}>Delivery <Text style={styles.quoteAmount}>{money(quote.deliveryFeePaise)}</Text></Text>}
            <Text style={styles.quoteTotal}>Order total <Text style={styles.quoteAmount}>{money(quote.totalPaise)}</Text></Text>
            <View style={styles.quoteDivider} />
            {quote.memberShares?.map((share) => {
              const member = activeMembers.find((row) => idOf(row.userId) === idOf(share.userId));
              const owesOutlet = quote.contributions?.some((row) => idOf(row.userId) === idOf(share.userId));
              return <Text key={idOf(share.userId)} style={styles.quoteLine}>{member?.name || 'Member'} · {money(share.amountPaise)}{owesOutlet ? '' : ' · informational'}</Text>;
            })}
            <Text style={styles.itemMeta}>{quote.message}</Text>
          </View>}
          {quote?.meetsMinimumOrder === false ? <Text style={styles.warning}>The current verified menu subtotal is below the outlet’s group minimum. Add items and refresh the quote before checkout.</Text> : null}
          <Button title="Place group order" onPress={placeOrder} loading={checkoutBusy} disabled={!quote || quoteLoading || Boolean(quoteError) || quote.meetsMinimumOrder === false} style={styles.smallButton} />
        </View> : null}
        {group.status === 'LOCKED' && !isLeader ? <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTitle}>The group leader controls checkout</Text>
          <Text style={styles.noticeText}>Review this server-calculated estimate. The leader confirms final checkout and any coupon used.</Text>
          <View style={styles.quoteBox}>
            {quoteLoading ? <Text style={styles.muted}>Checking current prices…</Text> : null}
            {!!quoteError && <Text style={styles.warning}>{quoteError}</Text>}
            {quote && <>
              <Text style={styles.quoteLine}>Estimated order total <Text style={styles.quoteAmount}>{money(quote.totalPaise)}</Text></Text>
              {quote.memberShares?.map((share) => {
                const member = activeMembers.find((row) => idOf(row.userId) === idOf(share.userId));
                return <Text key={idOf(share.userId)} style={styles.quoteLine}>{member?.name || 'Member'} · {money(share.amountPaise)}{checkoutMode === 'HOST_PAYS' && idOf(share.userId) !== idOf(group.leaderId) ? ' · informational' : ''}</Text>;
              })}
              <Text style={styles.itemMeta}>{quote.message}</Text>
            </>}
          </View>
        </View> : null}

        {group.status === 'ORDERED' ? <View style={styles.checkoutCard}>
          <Text style={styles.checkoutTitle}>Order {group.orderId?.orderNumber ? `#${group.orderId.orderNumber}` : 'placed'}</Text>
          <Text style={styles.noticeText}>Total {group.orderId?.totalAmount != null ? `₹${Number(group.orderId.totalAmount).toFixed(2)}` : '—'} · order status {group.orderId?.orderStatus || 'PLACED'} · payment {group.orderId?.paymentStatus || 'PENDING'}</Text>
          {group.checkoutMode === 'HOST_PAYS' && <Text style={styles.noticeText}>The host’s single contribution pays the outlet. Member amounts below are informational; private reimbursements are not recorded as outlet payments.</Text>}
          {(group.memberShares || []).map((share) => {
            const member = activeMembers.find((row) => idOf(row.userId) === idOf(share.userId));
            return <Text key={idOf(share.userId)} style={styles.shareLine}>{member?.name || member?.userId?.name || 'Member'} · share {money(share.amountPaise)}</Text>;
          })}
          {(group.contributions || []).map((contribution) => {
            const contributionId = idOf(contribution);
            const mine = idOf(contribution.userId) === String(user?._id);
            const member = activeMembers.find((row) => idOf(row.userId) === idOf(contribution.userId));
            const instructions = instructionsByContribution[contributionId];
            return <View key={contributionId} style={styles.contributionCard}>
              <Text style={styles.shareTitle}>{member?.name || 'Member'} · {money(contribution.amountPaise)} · {contribution.status}</Text>
              <Text style={styles.itemMeta}>{contribution.method === 'UPI_QR' ? 'UPI · outlet verification required' : 'Cash at counter · outlet confirmation required'}</Text>
              {mine && contribution.method === 'UPI_QR' && contribution.status !== 'SUCCESS' ? <>
                  {contribution.status === 'CLAIMED' ? <Text style={styles.warning}>Your reference is waiting for outlet verification. {contribution.verificationReason || ''}</Text> : <>
                  {!!contribution.verificationReason && <Text style={styles.warning}>{contribution.verificationReason}</Text>}
                  <Button title={instructions ? 'Refresh UPI payment QR' : 'Pay my UPI share'} variant="outline" onPress={() => loadContributionInstructions(contribution)} loading={paymentBusy === contributionId} style={styles.smallButton} />
                  {instructions?.upiUri ? <View style={styles.qrWrap}><QRCode value={instructions.upiUri} size={190} /><Text style={styles.itemMeta}>Scan to pay exactly {money(contribution.amountPaise)}. Opening an app does not confirm payment.</Text></View> : null}
                  <TextInput value={referenceByContribution[contributionId] || ''} onChangeText={(value) => setReferenceByContribution((current) => ({ ...current, [contributionId]: value }))} placeholder="UPI transaction reference" autoCapitalize="none" style={styles.referenceInput} editable={paymentBusy !== contributionId} />
                  <Button title="Submit for outlet verification" onPress={() => submitContributionReference(contribution)} loading={paymentBusy === contributionId} disabled={!String(referenceByContribution[contributionId] || '').trim()} style={styles.smallButton} />
                </>}
              </> : null}
              {mine && contribution.method === 'COUNTER' && contribution.status !== 'SUCCESS' ? <Text style={styles.warning}>Pay this share at the counter. It remains pending until the outlet confirms receipt.</Text> : null}
            </View>;
          })}
        </View> : null}

        {!isLocked && <>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Choose food</Text></View>
          {products.map((product) => <TouchableOpacity key={String(product._id)} style={styles.productRow} onPress={() => addProduct(product)} accessibilityRole="button" accessibilityLabel={`Customize ${product.name}`}>
            <ProductImage uri={product.imageUrl} style={styles.productImage} fallbackIconSize={20} accessibilityLabel={product.name} />
            <View style={styles.productInfo}><Text style={styles.itemName}>{product.name}</Text><Text numberOfLines={2} style={styles.itemMeta}>{product.description}</Text><Text style={styles.itemPrice}>₹{Number(product.price).toFixed(2)}</Text></View>
            <Text style={styles.choose}>Choose</Text>
          </TouchableOpacity>)}
          {products.length === 0 && <Text style={styles.emptyText}>No available menu items right now.</Text>}
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 44, width: '100%', maxWidth: 760, alignSelf: 'center' },
  summary: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 18 },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginTop: 6 },
  subtitle: { color: COLORS.textSecondary, marginTop: 4, fontSize: 13 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' },
  total: { color: COLORS.primary, fontSize: 17, fontWeight: '900' },
  minimumProgress: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12, gap: 7 },
  minimumCopy: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: COLORS.primary },
  minimumHint: { color: COLORS.textSecondary, fontSize: 10 },
  empty: { alignItems: 'center', backgroundColor: '#FFF', padding: 24, borderRadius: 16, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 5, lineHeight: 19 },
  itemCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, padding: 14, borderRadius: 16, marginBottom: 10, gap: 10 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemMain: { flex: 1 },
  itemName: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 15 },
  itemMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  itemPrice: { color: COLORS.primary, fontWeight: '900', marginTop: 6 },
  removeButton: { padding: 8 },
  quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { width: 32, height: 32, borderRadius: 10, borderColor: COLORS.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 18, textAlign: 'center', color: COLORS.textPrimary, fontWeight: '800' },
  shareBox: { backgroundColor: '#FFF7F0', borderColor: '#FFD8C4', borderWidth: 1, borderRadius: 12, padding: 12, gap: 5 },
  shareTitle: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 13 },
  shareLine: { color: COLORS.textSecondary, fontSize: 12 },
  warning: { color: '#A65A00', fontSize: 12, lineHeight: 17, marginTop: 3 },
  smallButton: { marginTop: 6 },
  notice: { padding: 14, marginVertical: 12, borderRadius: 14, backgroundColor: '#FFF3E8', borderWidth: 1, borderColor: '#FFD9BE' },
  noticeTitle: { color: '#9A4312', fontWeight: '900', fontSize: 13 },
  noticeText: { color: '#704A34', fontSize: 12, lineHeight: 18, marginTop: 5 },
  checkoutCard: { padding: 16, marginVertical: 12, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  checkoutTitle: { color: COLORS.textPrimary, fontWeight: '900', fontSize: 17 },
  choiceLabel: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 7 },
  choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: { borderRadius: 12, borderColor: COLORS.border, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFF' },
  choiceActive: { borderColor: COLORS.primary, backgroundColor: '#FFF3E8' },
  choiceText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12 },
  choiceTextActive: { color: COLORS.primary },
  quoteBox: { padding: 12, borderRadius: 12, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: COLORS.border, marginTop: 8, gap: 6 },
  quoteLine: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  quoteAmount: { color: COLORS.textPrimary, fontWeight: '800' },
  quoteTotal: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900', marginTop: 2 },
  quoteDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  contributionCard: { padding: 12, borderRadius: 12, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: COLORS.border, marginTop: 8, gap: 5 },
  qrWrap: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, gap: 10 },
  referenceInput: { minHeight: 46, borderRadius: 10, borderColor: COLORS.border, borderWidth: 1, paddingHorizontal: 12, color: COLORS.textPrimary, backgroundColor: '#FFF' },
  productRow: { backgroundColor: '#FFF', borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImage: { width: 64, height: 64, borderRadius: 11, backgroundColor: '#F3F4F6' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  choose: { color: COLORS.primary, fontWeight: '900', fontSize: 12, paddingHorizontal: 6 },
});
