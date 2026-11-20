import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, MapPin } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import Header from '../../components/common/Header';
import CartItem from '../../components/cart/CartItem';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import COLORS from '../../constants/colors';
import { outletDirectionsUrl } from '../../utils/outletDirections';
import settingsService from '../../services/settingsService';

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, cartCount, subtotal, taxAndFees, grandTotal, clearCart } = useContext(CartContext);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [directionsBusy, setDirectionsBusy] = useState(false);

  const confirmClear = () => Alert.alert('Clear your cart?', 'All items will be removed from this cart.', [
    { text: 'Keep items', style: 'cancel' },
    { text: 'Clear cart', style: 'destructive', onPress: clearCart },
  ]);

  const openDirections = async () => {
    if (directionsBusy) return;
    setDirectionsBusy(true);
    try {
      let location;
      try {
        const response = await settingsService.getSettings();
        location = response?.settings?.pickupLocation;
      } catch { /* use the documented TIET outlet fallback when settings cannot load */ }
      await Linking.openURL(outletDirectionsUrl(Platform.OS, location));
    } catch {
      if (Platform.OS !== 'web') Alert.alert('Directions unavailable', 'Open Google Maps and search for the Wrapchik SAC Counter at TIET Patiala.');
    } finally { setDirectionsBusy(false); }
  };

  return (
    <View style={styles.container}>
      <Header title="My Cart" showCart={false} />

      {cartItems.length === 0 ? (
        <EmptyState
          title="Your Cart is Empty"
          message="Looks like you haven't added any delicious food yet!"
          buttonTitle="Browse Menu"
          onButtonPress={() => router.push('/(tabs)/home')}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.clearHeader}>
            <Text style={styles.itemCountText}>
              {cartCount} {cartCount === 1 ? 'item' : 'items'} in your bag
            </Text>
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear cart">
              <Trash2 size={16} color={COLORS.danger} />
              <Text style={styles.clearText}>Clear Cart</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.cartKey}
            renderItem={({ item }) => <CartItem item={item} />}
            contentContainerStyle={styles.listContent}
          />

          {/* Pickup Counter Location Reminder */}
          <View style={styles.pickupBox}>
            <MapPin size={18} color={COLORS.primary} />
            <Text style={styles.pickupText}>
              Pickup at <Text style={styles.pickupBold}>Wrapchik SAC Counter</Text>. You can select another enabled option at checkout.
            </Text>
            <TouchableOpacity onPress={openDirections} disabled={directionsBusy} style={styles.directionsButton} accessibilityRole="button" accessibilityLabel="Open Google Maps directions to Wrapchik pickup">
              <Text style={styles.directionsText}>{directionsBusy ? 'Opening…' : 'Directions'}</Text>
            </TouchableOpacity>
          </View>

          {/* Bill Summary Breakdown */}
          <View style={styles.billCard}>
            <Text style={styles.billTitle}>Order estimate</Text>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Subtotal</Text>
              <Text style={styles.billValue}>₹{subtotal}</Text>
            </View>
            <View style={styles.billRow}>
            <Text style={styles.billLabel}>Taxes & fees (5%)</Text>
              <Text style={styles.billValue}>₹{taxAndFees}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.billRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
            </View>

            <Button
              title={`Continue · ₹${grandTotal}`}
              loading={checkoutBusy}
              onPress={() => { if (!checkoutBusy) { setCheckoutBusy(true); router.push('/checkout'); setTimeout(() => setCheckoutBusy(false), 1200); } }}
              style={styles.checkoutBtn}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  clearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  pickupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    gap: 8,
    marginVertical: 8,
  },
  pickupText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  directionsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  directionsText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },
  pickupBold: {
    fontWeight: '800',
    color: COLORS.primary,
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  checkoutBtn: {
    marginTop: 14,
  },
});
