import React, { useCallback, useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gift, Star } from 'lucide-react-native';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import LoadingIndicator from '../components/common/LoadingIndicator';
import { AuthContext } from '../context/AuthContext';
import loyaltyService from '../services/loyaltyService';
import COLORS from '../constants/colors';

const money = paise => `₹${(Number(paise || 0) / 100).toFixed(2)}`;
const ENTRY_LABELS = { EARN: 'Points earned', REDEEM: 'Points used', REDEEM_RELEASE: 'Points returned' };

export default function LoyaltyScreen() {
  const { user } = useContext(AuthContext);
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await loyaltyService.getMine();
      if (!result?.success || !result.rewards) throw new Error(result?.message || 'Rewards could not be loaded.');
      setRewards(result.rewards);
    } catch (loadError) { setError(loadError.message || 'Rewards could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === 'student') load(); else setLoading(false); }, [load, user?.role]);

  if (loading) return <LoadingIndicator message="Loading rewards…" />;
  return <View style={styles.container}>
    <Header title="Wrapchik Rewards" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content}>
      {!user ? <Text style={styles.copy}>Sign in with your student account to view rewards.</Text>
        : user.role !== 'student' ? <Text style={styles.copy}>Rewards are for student customers.</Text>
          : error ? <View><Text style={styles.error}>{error}</Text><Button title="Retry" onPress={load} style={styles.action} /></View>
            : <>
              <View style={styles.balanceCard}>
                <View style={styles.icon}><Gift size={23} color={COLORS.primary} /></View>
                <Text style={styles.eyebrow}>AVAILABLE POINTS</Text>
                <Text style={styles.balance}>{rewards.pointsBalance.toLocaleString('en-IN')}</Text>
                <Text style={styles.copy}>{rewards.redemptionEnabled
                  ? `${rewards.pointsBalance.toLocaleString('en-IN')} points are in your account. Eligible orders may use them within the outlet's redemption limits.`
                  : rewards.earningEnabled ? 'Your points remain available, but the outlet has not configured redemption yet.' : 'The outlet has not activated rewards. Your balance is shown without changing it.'}</Text>
                {rewards.tier ? <View style={styles.tier}><Star size={15} color={COLORS.primary} /><Text style={styles.tierText}>{rewards.tier.name} · {rewards.lifetimePoints.toLocaleString('en-IN')} lifetime points</Text></View> : null}
              </View>
              {rewards.earningEnabled || rewards.redemptionEnabled ? <View style={styles.policyCard}>
                <Text style={styles.sectionTitle}>How rewards work</Text>
                {rewards.earningEnabled ? <Text style={styles.copy}>Earn {rewards.policy.pointsPerStep} point{rewards.policy.pointsPerStep === 1 ? '' : 's'} for each ₹{rewards.policy.earnEveryRupees} of eligible completed spend.</Text> : <Text style={styles.copy}>New point earning is currently paused by the outlet.</Text>}
                {rewards.redemptionEnabled ? <Text style={styles.copy}>Each point is worth {money(rewards.policy.paisePerPoint)}. Redeem at least {rewards.policy.minimumRedemptionPoints} points, up to {rewards.policy.maxRedemptionPercent}% of eligible item subtotal. Taxes and delivery are not redeemable.</Text> : null}
                <Text style={styles.copy}>Points are added only after payment is confirmed and the order is completed. Group orders do not earn points.</Text>
              </View> : null}
              <View style={styles.historyCard}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {rewards.history?.length ? rewards.history.map(entry => <View key={`${entry._id || entry.orderId}-${entry.type}`} style={styles.row}>
                  <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{ENTRY_LABELS[entry.type] || 'Points activity'}</Text><Text style={styles.date}>{new Date(entry.createdAt).toLocaleDateString('en-IN')} · Order {String(entry.orderId).slice(-6).toUpperCase()}</Text></View>
                  <Text style={[styles.delta, entry.pointsDelta < 0 && styles.negative]}>{entry.pointsDelta > 0 ? '+' : ''}{entry.pointsDelta}</Text>
                </View>) : <Text style={styles.copy}>Completed eligible orders will appear here.</Text>}
              </View>
            </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 650, alignSelf: 'center', padding: 18, paddingBottom: 40, gap: 14 },
  balanceCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 22 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  eyebrow: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  balance: { color: COLORS.textPrimary, fontSize: 38, fontWeight: '900', marginVertical: 2 },
  copy: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: COLORS.primaryLight },
  tierText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },
  policyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 17 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 17 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }, date: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  delta: { color: COLORS.success, fontSize: 15, fontWeight: '900' }, negative: { color: COLORS.textPrimary },
  error: { color: COLORS.danger, fontSize: 13 }, action: { marginTop: 10 },
});
