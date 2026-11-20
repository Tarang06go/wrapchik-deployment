import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/common/Header';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Button from '../components/common/Button';
import COLORS from '../constants/colors';
import couponService from '../services/couponService';

const offerTitle = offer => offer.discountType === 'PERCENT'
  ? `${offer.discountValue}% off`
  : `₹${offer.discountValue} off`;

export default function OffersScreen() {
  const router = useRouter();
  const { user } = React.useContext(AuthContext);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await couponService.getAvailable();
      if (!Array.isArray(result?.coupons)) throw new Error(result?.message || 'Offer information is unavailable.');
      setOffers(result.coupons);
    } catch (loadError) {
      setError(loadError.message || 'Offers could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user) void loadOffers();
    else { setOffers([]); setLoading(false); }
  }, [loadOffers, user]);

  return <View style={styles.container}>
    <Header title="Deals & offers" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>REAL OFFERS FROM WRAPCHIK</Text>
      <Text style={styles.heading}>A little extra with your meal</Text>
      <Text style={styles.copy}>Only active offers from the outlet are shown here. Apply an eligible code during checkout.</Text>
      {!user ? <EmptyState title="Sign in to see your offers" message="Offer eligibility is checked against your Wrapchik account." buttonTitle="Sign in" onButtonPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: 'offers' } })} /> : loading ? <View style={styles.loading}><Text style={styles.loadingText}>Loading current offers…</Text></View> : error ? <ErrorState title="Offers unavailable" message={error} onRetry={loadOffers} /> : offers.length === 0 ? <EmptyState title="No active offers right now" message="Check back later, or browse the current Wrapchik menu." buttonTitle="Browse menu" onButtonPress={() => router.push('/(tabs)/menu')} /> : offers.map(offer => <View key={offer._id || offer.code} style={styles.offerCard}>
        <View style={styles.offerTop}><Text style={styles.offerAmount}>{offerTitle(offer)}</Text><Text style={styles.offerType}>{offer.orderTypes?.length ? offer.orderTypes.join(' · ') : 'Eligible orders'}</Text></View>
        <View style={styles.code}><Text style={styles.codeLabel}>CODE</Text><Text style={styles.codeText}>{offer.code}</Text></View>
        {offer.minOrderValue > 0 ? <Text style={styles.terms}>Minimum order ₹{offer.minOrderValue}</Text> : null}
        {offer.maxDiscountAmount > 0 ? <Text style={styles.terms}>Maximum discount ₹{offer.maxDiscountAmount}</Text> : null}
        {offer.description ? <Text style={styles.terms}>{offer.description}</Text> : null}
      </View>)}
      {user && offers.length > 0 ? <Button title="Browse menu" onPress={() => router.push('/(tabs)/menu')} style={styles.browseButton} /> : null}
      {user ? <TouchableOpacity onPress={() => router.push('/checkout')} accessibilityRole="button" style={styles.checkoutLink}><Text style={styles.checkoutText}>Have items in your cart? Go to checkout</Text></TouchableOpacity> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 32 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heading: { color: COLORS.textPrimary, fontSize: 25, fontWeight: '900', marginTop: 6 },
  copy: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 16 },
  loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textSecondary, fontSize: 13 },
  offerCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16, marginBottom: 12 },
  offerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  offerAmount: { color: COLORS.primary, fontSize: 20, fontWeight: '900', flex: 1 },
  offerType: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800', textAlign: 'right', maxWidth: 120 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', backgroundColor: '#FFF4ED', borderColor: '#FFD4C1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  codeLabel: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  codeText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  terms: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
  browseButton: { marginTop: 10 },
  checkoutLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
});
