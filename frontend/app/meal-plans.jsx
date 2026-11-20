import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import LoadingIndicator from '../components/common/LoadingIndicator';
import COLORS from '../constants/colors';
import safeStorage from '../services/safeStorage';
import productService from '../services/productService';
import { createMealPlanSnapshot, getMealReminderDate } from '../utils/mealPlanCore';

const storageKeyFor = userId => `wrapchik_meal_plans:${userId}`;
const message = (title, body) => Platform.OS === 'web' ? window.alert(`${title}\n\n${body}`) : Alert.alert(title, body);

export default function MealPlansScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const { cartItems, addToCart } = useContext(CartContext);
  const storageKey = useMemo(() => user?._id ? storageKeyFor(user._id) : null, [user?._id]);
  const [plans, setPlans] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState('');
  const [error, setError] = useState('');

  const loadPlans = useCallback(async () => {
    if (!storageKey) { setPlans([]); setLoading(false); return; }
    setLoading(true);
    try {
      const raw = await safeStorage.getItem(storageKey);
      const decoded = raw ? JSON.parse(raw) : [];
      setPlans(Array.isArray(decoded) ? decoded.filter(plan => plan && typeof plan.id === 'string' && Array.isArray(plan.items)) : []);
      setError('');
    } catch (e) { setError(e.message || 'Meal plans could not be loaded.'); }
    finally { setLoading(false); }
  }, [storageKey]);

  useEffect(() => { if (!authLoading) loadPlans(); }, [authLoading, loadPlans]);

  const persistPlans = async nextPlans => {
    setPlans(nextPlans);
    const stored = await safeStorage.setItem(storageKey, JSON.stringify(nextPlans));
    if (stored === false) setError('Device storage is unavailable. These changes may not survive closing the app.');
    else setError('');
  };

  const saveCurrentCart = async () => {
    if (!storageKey || saving) return;
    try {
      const plan = createMealPlanSnapshot(name, cartItems);
      setSaving(true);
      await persistPlans([plan, ...plans].slice(0, 20));
      setName('');
    } catch (e) { message('Meal plan not saved', e.message); }
    finally { setSaving(false); }
  };

  const orderPlan = async plan => {
    if (busyPlanId) return;
    setBusyPlanId(plan.id);
    const changed = [];
    let added = 0;
    try {
      for (const savedItem of plan.items) {
        try {
          const response = await productService.getProductById(savedItem.productId);
          const product = response?.product;
          if (!product?.available || (Number.isFinite(product.stock) && product.stock <= 0)) {
            changed.push(`${product?.name || 'An item'} is currently unavailable`);
            continue;
          }
          const options = Array.isArray(product.customizations) ? product.customizations : [];
          const selected = [];
          for (const optionName of savedItem.customizationNames || []) {
            const match = options.find(option => option.name === optionName);
            if (match) selected.push(match);
            else changed.push(`${product.name}: “${optionName}” is no longer offered`);
          }
          addToCart(product, selected, savedItem.quantity);
          added += 1;
        } catch {
          changed.push('An item could not be found in the current menu');
        }
      }
      if (!added) return message('Menu changed', changed.join('\n') || 'None of these items can be ordered now.');
      if (changed.length) message('Meal plan refreshed', changed.join('\n'));
      router.push('/(tabs)/cart');
    } finally { setBusyPlanId(''); }
  };

  const scheduleReminder = async (plan, kind) => {
    if (Platform.OS === 'web') return message('Reminder unavailable', 'Local reminders require the installed Android or iOS app. Your saved meal plan is still available here.');
    setBusyPlanId(plan.id);
    try {
      const permission = await Notifications.getPermissionsAsync();
      const requested = permission.status === 'granted' ? permission : await Notifications.requestPermissionsAsync();
      if (requested.status !== 'granted') throw new Error('Allow notifications in your phone settings to schedule a meal reminder.');
      if (plan.notificationId) await Notifications.cancelScheduledNotificationAsync(plan.notificationId).catch(() => {});
      const reminderAt = getMealReminderDate(kind);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: `Meal plan: ${plan.name}`, body: 'Your saved Wrapchik basket is ready to order. Choose a scheduled pickup time at checkout.', data: { type: 'MEAL_PLAN_REMINDER', route: '/meal-plans', mealPlanId: plan.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt },
      });
      const updated = plans.map(item => item.id === plan.id ? { ...item, notificationId, reminderAt: reminderAt.toISOString() } : item);
      await persistPlans(updated);
      message('Reminder scheduled', `We’ll remind you ${kind === 'TOMORROW' ? 'tomorrow' : 'next week'} at 9:00 AM.`);
    } catch (e) { message('Reminder not scheduled', e.message || 'Please try again.'); }
    finally { setBusyPlanId(''); }
  };

  const removePlan = async plan => {
    if (plan.notificationId && Platform.OS !== 'web') await Notifications.cancelScheduledNotificationAsync(plan.notificationId).catch(() => {});
    await persistPlans(plans.filter(item => item.id !== plan.id));
  };

  if (authLoading || loading) return <LoadingIndicator message="Loading your meal plans…" />;
  if (!user) return <EmptyState title="Sign in to save meal plans" message="Saved baskets stay private to your Wrapchik account on this device." buttonTitle="Sign in" onButtonPress={() => router.push('/(auth)/login')} />;

  return <View style={styles.container}>
    <Header title="Meal plans" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}><Text style={styles.kicker}>PLAN AHEAD</Text><Text style={styles.title}>Save a favourite basket</Text><Text style={styles.copy}>Save the current cart on this device. Ordering a plan rechecks today’s menu and prices before checkout.</Text></View>
      <View style={styles.saveCard}>
        <Text style={styles.cardTitle}>Save current cart</Text>
        <TextInput value={name} onChangeText={setName} maxLength={50} placeholder="e.g. Tuesday lunch" style={styles.input} accessibilityLabel="Meal plan name" />
        <Button title={saving ? 'Saving…' : `Save ${cartItems.length} cart item${cartItems.length === 1 ? '' : 's'}`} onPress={saveCurrentCart} disabled={saving || cartItems.length === 0} />
        {cartItems.length === 0 ? <Text style={styles.hint}>Add items to your cart first, then save the basket here.</Text> : null}
      </View>
      {error ? <TouchableOpacity onPress={loadPlans} accessibilityRole="button"><Text style={styles.error}>{error} · Tap to reload</Text></TouchableOpacity> : null}
      {plans.length === 0 ? <View style={styles.empty}><Text style={styles.cardTitle}>No meal plans yet</Text><Text style={styles.copy}>Save a cart when you find a combination you want again.</Text></View> : plans.map(plan => <View key={plan.id} style={styles.planCard}>
        <View style={styles.planHeader}><View style={{ flex: 1 }}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planMeta}>{plan.items.reduce((sum, item) => sum + item.quantity, 0)} items · saved {new Date(plan.createdAt).toLocaleDateString()}</Text></View><TouchableOpacity onPress={() => removePlan(plan)} accessibilityRole="button" accessibilityLabel={`Delete ${plan.name}`}><Text style={styles.delete}>Delete</Text></TouchableOpacity></View>
        <Text style={styles.items}>{plan.items.map(item => `${item.quantity} × ${item.productName || 'Menu item'}${item.customizationNames?.length ? ` · ${item.customizationNames.join(', ')}` : ''}`).join('\n')}</Text>
        {plan.reminderAt ? <Text style={styles.reminder}>Reminder: {new Date(plan.reminderAt).toLocaleString()}</Text> : null}
        <View style={styles.actions}><Button title={busyPlanId === plan.id ? 'Working…' : 'Order this basket'} onPress={() => orderPlan(plan)} disabled={Boolean(busyPlanId)} style={styles.actionButton} /><TouchableOpacity onPress={() => scheduleReminder(plan, 'TOMORROW')} disabled={Boolean(busyPlanId)} style={styles.reminderButton} accessibilityRole="button"><Text style={styles.reminderText}>Remind tomorrow</Text></TouchableOpacity></View>
        <TouchableOpacity onPress={() => scheduleReminder(plan, 'NEXT_WEEK')} disabled={Boolean(busyPlanId)} accessibilityRole="button"><Text style={styles.weekText}>Remind next week at 9:00 AM</Text></TouchableOpacity>
      </View>)}
      <Text style={styles.footnote}>Meal reminders are local to this phone. Checkout always uses current availability and server-calculated prices; choose a scheduled pickup slot during checkout if offered.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 40, gap: 12 },
  intro: { gap: 5, marginBottom: 2 }, kicker: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, title: { color: COLORS.textPrimary, fontSize: 23, fontWeight: '900' }, copy: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  saveCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 15, gap: 10 }, cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }, input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, color: COLORS.textPrimary }, hint: { color: COLORS.textSecondary, fontSize: 12 }, error: { color: COLORS.danger, fontSize: 12, padding: 8 }, empty: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 18, gap: 6, backgroundColor: '#FFFFFF' },
  planCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 15, gap: 10 }, planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, planName: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '900' }, planMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 }, delete: { color: COLORS.danger, fontSize: 12, fontWeight: '800', padding: 8 }, items: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 19 }, reminder: { color: COLORS.success, fontSize: 12, fontWeight: '700' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, actionButton: { flex: 1 }, reminderButton: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 11, minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 }, reminderText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' }, weekText: { alignSelf: 'center', padding: 8, color: COLORS.primary, fontWeight: '700', fontSize: 12 }, footnote: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
