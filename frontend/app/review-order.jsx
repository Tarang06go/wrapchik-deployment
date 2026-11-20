import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import LoadingIndicator from '../components/common/LoadingIndicator';
import reviewService from '../services/reviewService';
import COLORS from '../constants/colors';
import { successHaptic } from '../utils/haptics';

const first = value => Array.isArray(value) ? value[0] : value;

export default function ReviewOrderScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const orderId = String(first(params.orderId) || '');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    reviewService.getForOrder(orderId).then(result => {
      if (!active) return;
      if (result?.review) { setExisting(result.review); setRating(result.review.rating); setComment(result.review.comment || ''); }
      setError('');
    }).catch(loadError => { if (active) setError(loadError.message || 'Review details could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, orderId, user?._id]);

  const submit = async () => {
    if (saving || existing || !orderId) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await reviewService.createForOrder(orderId, { rating, comment });
      if (!result?.success || !result.review) throw new Error(result?.message || 'Your review was not saved.');
      setExisting(result.review); setNotice('Thanks for sharing feedback about your completed order.'); successHaptic();
    } catch (submitError) { setError(submitError.message || 'Your review could not be saved.'); }
    finally { setSaving(false); }
  };

  if (authLoading || loading) return <LoadingIndicator message="Loading order review…" />;
  return <View style={styles.container}>
    <Header title="Rate your order" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!user ? <Text style={styles.message}>Sign in with the account that placed this order to leave feedback.</Text> : user.role !== 'student' ? <Text style={styles.message}>Only student customers can review an order.</Text> : <>
        <Text style={styles.title}>{existing ? 'Your review' : 'How was your meal?'}</Text>
        <Text style={styles.message}>Reviews are available only after the order is paid and completed. One review is allowed per order.</Text>
        <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Order rating">
          {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} onPress={() => !existing && setRating(value)} disabled={Boolean(existing)} accessibilityRole="radio" accessibilityState={{ selected: rating === value, disabled: Boolean(existing) }} accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`} style={styles.starButton}><Star size={32} color={value <= rating ? '#F59E0B' : COLORS.border} fill={value <= rating ? '#F59E0B' : 'transparent'} /></TouchableOpacity>)}
        </View>
        <Text style={styles.label}>Optional comment · up to 500 characters</Text>
        <TextInput value={comment} onChangeText={setComment} editable={!existing} maxLength={500} multiline textAlignVertical="top" style={styles.input} placeholder="Tell the outlet what went well or what could improve" accessibilityLabel="Optional order review comment" />
        <Text style={styles.count}>{comment.length}/500</Text>
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        {notice ? <Text style={styles.success} accessibilityRole="status">{notice}</Text> : null}
        {existing ? <Text style={styles.message}>Submitted {new Date(existing.createdAt).toLocaleDateString()}.</Text> : <Button title={saving ? 'Submitting…' : 'Submit review'} onPress={submit} loading={saving} disabled={!orderId} style={styles.submit} />}
      </>}
      <Button title="Back to orders" variant="outline" onPress={() => router.replace('/(tabs)/orders')} style={styles.submit} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.background }, content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 40 }, title: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '900' }, message: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 }, stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 24 }, starButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, label: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 7 }, input: { minHeight: 130, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, padding: 12, backgroundColor: '#FFFFFF', color: COLORS.textPrimary }, count: { color: COLORS.textSecondary, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }, error: { color: COLORS.danger, fontSize: 12, marginTop: 10 }, success: { color: COLORS.success, fontSize: 13, fontWeight: '800', marginTop: 10 }, submit: { marginTop: 14 } });
