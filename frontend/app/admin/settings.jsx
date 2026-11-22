import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import api from '../../services/api';
import COLORS from '../../constants/colors';
import { AdminLoadingState } from '../../components/admin/AdminPrimitives';
import ErrorState from '../../components/common/ErrorState';
import { validateLoyaltyDraft, validateNumericText } from '../../utils/adminNumericForm.cjs';

const ToggleSwitch = ({ value, onValueChange, label }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={[styles.toggleContainer, value ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={[styles.toggleCircle, value ? styles.circleOn : styles.circleOff]} />
    </TouchableOpacity>
  </View>
);

const defaultPromoBanner = (sortOrder = 0) => ({ enabled: false, title: '', message: '', imageUrl: '', ctaLabel: '', ctaRoute: '/(tabs)/menu', activeFrom: '', activeUntil: '', sortOrder });
const defaultLoyalty = { enabled: false, earnEveryRupees: 0, pointsPerStep: 0, paisePerPoint: 0, minimumRedemptionPoints: 0, maxRedemptionPercent: 0, tiers: [] };

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res && res.settings) {
        const saved = res.settings;
        const hasLegacyBanner = saved.promoBanner?.title || saved.promoBanner?.message;
        const promoBanners = Array.isArray(saved.promoBanners) && saved.promoBanners.length
          ? saved.promoBanners
          : hasLegacyBanner ? [{ ...defaultPromoBanner(), ...saved.promoBanner }] : [];
        setSettings({ ...saved, promoBanners });
        setLoadError('');
      }
    } catch (e) {
      console.error('[Admin Settings Fetch Error]:', e);
      setLoadError(e.message || 'Could not load outlet settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const errors = {};
    const payload = { ...settings };
    const numericRules = {
      pickupSlotCapacity: { label: 'Orders per pickup slot', min: 1, max: 100, integer: true },
      estimatedPrepMinutes: { label: 'Preparation time', min: 5, max: 240, integer: true },
      orderOverdueMinutes: { label: 'Order overdue threshold', min: 1, max: 240, integer: true },
      deliveryFee: { label: 'Delivery fee', min: 0, max: 90071992547409, integer: false },
      groupMinimumOrderValue: { label: 'Share a Meal minimum subtotal', min: 0, max: 100000, integer: false },
    };
    for (const [key, rules] of Object.entries(numericRules)) {
      const parsed = validateNumericText(settings[key], rules);
      if (parsed.error) errors[key] = parsed.error;
      else payload[key] = parsed.value;
    }
    const loyaltyResult = validateLoyaltyDraft(settings.loyalty || defaultLoyalty);
    for (const [key, message] of Object.entries(loyaltyResult.errors)) errors[`loyalty.${key}`] = message;
    if (loyaltyResult.policy) payload.loyalty = loyaltyResult.policy;

    const banners = (settings.promoBanners || []).map((banner, index) => {
      const key = `promoBanners.${index}.sortOrder`;
      const parsed = validateNumericText(banner.sortOrder ?? index, { label: `Banner ${index + 1} carousel order`, min: 0, max: 4, integer: true });
      if (parsed.error) errors[key] = parsed.error;
      return parsed.error ? banner : { ...banner, sortOrder: parsed.value };
    });
    payload.promoBanners = banners;
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      setFeedback('Please correct the highlighted fields before saving.');
      setFeedbackError(true);
      return;
    }
    try {
      setSaving(true);
      const firstBanner = payload.promoBanners?.[0];
      await api.put('/settings', { ...payload, promoBanner: firstBanner ? {
        enabled: firstBanner.enabled === true, title: firstBanner.title || '', message: firstBanner.message || '',
        ctaLabel: firstBanner.ctaLabel || '', ctaRoute: firstBanner.ctaRoute || '/(tabs)/menu',
      } : settings.promoBanner });
      setFeedback('Settings saved successfully.'); setFeedbackError(false);
    } catch (e) {
      console.error('[Admin Settings Save Error]:', e);
      setFeedback(e.message || 'Failed to save settings.'); setFeedbackError(true);
    } finally {
      setSaving(false);
    }
  };

  const updatePromoBanner = (index, updates) => {
    const promoBanners = [...(settings.promoBanners || [])];
    promoBanners[index] = { ...promoBanners[index], ...updates };
    setSettings({ ...settings, promoBanners });
    if (updates.sortOrder !== undefined) setValidationErrors(previous => ({ ...previous, [`promoBanners.${index}.sortOrder`]: undefined }));
  };
  const addPromoBanner = () => {
    const banners = settings.promoBanners || [];
    if (banners.length < 5) setSettings({ ...settings, promoBanners: [...banners, defaultPromoBanner(banners.length)] });
  };
  const updateLoyalty = (updates) => {
    setSettings({ ...settings, loyalty: { ...defaultLoyalty, ...settings.loyalty, ...updates } });
    setValidationErrors(previous => {
      const next = { ...previous };
      for (const key of Object.keys(updates)) {
        delete next[`loyalty.${key}`];
        if (key === 'tiers') for (const errorKey of Object.keys(next)) if (errorKey.startsWith('loyalty.tier.') || errorKey === 'loyalty.tiers') delete next[errorKey];
      }
      return next;
    });
  };
  const updateLoyaltyTier = (index, updates) => {
    const tiers = [...(settings.loyalty?.tiers || [])];
    tiers[index] = { ...tiers[index], ...updates };
    updateLoyalty({ tiers });
  };

  const numericField = (label, value, onChangeText, keyboardType, errorKey, accessibilityLabel = label) => (
    <View style={styles.numericField} key={errorKey}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, validationErrors[errorKey] && styles.inputInvalid]}
        value={value == null ? '' : String(value)}
        onChangeText={nextValue => {
          onChangeText(nextValue);
          setValidationErrors(previous => ({ ...previous, [errorKey]: undefined }));
        }}
        keyboardType={keyboardType}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={validationErrors[errorKey] || undefined}
      />
      {validationErrors[errorKey] ? <Text accessibilityRole="alert" style={styles.fieldError}>{validationErrors[errorKey]}</Text> : null}
    </View>
  );

  const toggleLoyalty = enabled => {
    if (!enabled) { updateLoyalty({ enabled: false }); return; }
    const result = validateLoyaltyDraft({ ...settings.loyalty, enabled: true });
    const errors = Object.fromEntries(Object.entries(result.errors).map(([key, message]) => [`loyalty.${key}`, message]));
    if (Object.keys(errors).length) {
      setValidationErrors(previous => ({ ...previous, ...errors }));
      setFeedback('Complete the earning, redemption, and zero-point starting tier before enabling rewards.');
      setFeedbackError(true);
      return;
    }
    updateLoyalty({ enabled: true });
  };

  if (loading) {
    return <AdminLoadingState message="Loading settings…" />;
  }

  if (!settings) {
    return (
      <View style={styles.container}>
        <Header title="Restaurant Settings" showBack showCart={false} />
        <ErrorState title="Settings unavailable" message={loadError || 'The outlet settings could not be loaded.'} onRetry={fetchSettings} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Restaurant Settings" showBack showCart={false} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!!feedback && <View style={[styles.feedback, feedbackError && styles.feedbackError]}><Text style={[styles.feedbackText, feedbackError && styles.feedbackErrorText]}>{feedback}</Text></View>}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Payments</Text>
          <ToggleSwitch label="Cash at counter enabled" value={settings.cashEnabled !== false} onValueChange={val => setSettings({ ...settings, cashEnabled: val })} />
          <ToggleSwitch label="UPI payment enabled" value={settings.upiEnabled === true} onValueChange={val => setSettings({ ...settings, upiEnabled: val })} />
          <Text style={styles.inputLabel}>Outlet UPI ID</Text>
          <TextInput style={styles.input} value={settings.upiId || ''} onChangeText={val => setSettings({ ...settings, upiId: val })} placeholder="outlet@bank" autoCapitalize="none" />
          <Text style={styles.inputLabel}>Payee name</Text>
          <TextInput style={styles.input} value={settings.upiPayeeName || ''} onChangeText={val => setSettings({ ...settings, upiPayeeName: val })} placeholder="Wrapchik TIET" />
          <Text style={styles.paymentHelp}>UPI must be enabled only after entering the official outlet UPI ID and payee name. Wrapchik generates a fresh QR for each order with its server-calculated amount and order reference; a static image is not used. Submitted payment references remain pending until an administrator checks receipt.</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.bannerHeading}><Text style={styles.sectionTitle}>Home promotion carousel</Text><TouchableOpacity onPress={addPromoBanner} disabled={(settings.promoBanners || []).length >= 5} accessibilityRole="button" accessibilityLabel="Add promotional banner" style={styles.addBannerButton}><Text style={styles.addBannerText}>Add banner</Text></TouchableOpacity></View>
          <Text style={styles.paymentHelp}>Manage up to five customer-facing campaigns. Images must already be uploaded to Cloudinary over HTTPS. Optional dates use ISO-8601 with a timezone. Campaigns never change item prices or payment status.</Text>
          {(settings.promoBanners || []).map((banner, index) => <View key={banner._id || `banner-${index}`} style={styles.bannerEditor}>
            <View style={styles.bannerHeading}><Text style={styles.bannerEditorTitle}>Banner {index + 1}</Text><TouchableOpacity onPress={() => updatePromoBanner(index, { enabled: false })} accessibilityRole="button"><Text style={styles.archiveBannerText}>Archive</Text></TouchableOpacity></View>
            <ToggleSwitch label="Show on Home during its active window" value={banner.enabled === true} onValueChange={enabled => updatePromoBanner(index, { enabled })} />
            <Text style={styles.inputLabel}>Banner title</Text>
            <TextInput style={styles.input} value={banner.title || ''} onChangeText={val => updatePromoBanner(index, { title: val })} maxLength={80} placeholder="A fresh campus offer" />
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput style={styles.input} value={banner.message || ''} onChangeText={val => updatePromoBanner(index, { message: val })} maxLength={180} placeholder="Tell students what is available" />
            <Text style={styles.inputLabel}>Cloudinary image URL</Text>
            <TextInput style={styles.input} value={banner.imageUrl || ''} onChangeText={val => updatePromoBanner(index, { imageUrl: val })} maxLength={1000} autoCapitalize="none" keyboardType="url" placeholder="https://res.cloudinary.com/…" />
            <Text style={styles.inputLabel}>Button label</Text>
            <TextInput style={styles.input} value={banner.ctaLabel || ''} onChangeText={val => updatePromoBanner(index, { ctaLabel: val })} maxLength={24} placeholder="Explore menu" />
            <Text style={styles.inputLabel}>Button destination</Text>
            <View style={styles.statusRow}>{[
              ['/(tabs)/menu', 'Menu'],
              ['/(tabs)/home', 'Home'],
              ['/group-order', 'Share a Meal'],
            ].map(([route, label]) => <TouchableOpacity key={route} onPress={() => updatePromoBanner(index, { ctaRoute: route })} style={[styles.statusBtn, (banner.ctaRoute || '/(tabs)/menu') === route && styles.statusBtnActive]}><Text style={[styles.statusBtnText, (banner.ctaRoute || '/(tabs)/menu') === route && styles.statusBtnTextActive]}>{label}</Text></TouchableOpacity>)}</View>
            <Text style={styles.inputLabel}>Active from · ISO-8601, optional</Text>
            <TextInput style={styles.input} value={banner.activeFrom ? String(banner.activeFrom) : ''} onChangeText={val => updatePromoBanner(index, { activeFrom: val })} placeholder="2026-11-20T09:00:00+05:30" autoCapitalize="none" />
            <Text style={styles.inputLabel}>Active until · ISO-8601, optional</Text>
            <TextInput style={styles.input} value={banner.activeUntil ? String(banner.activeUntil) : ''} onChangeText={val => updatePromoBanner(index, { activeUntil: val })} placeholder="2026-11-30T23:00:00+05:30" autoCapitalize="none" />
            <Text style={styles.inputLabel}>Carousel order (0–4)</Text>
            {numericField('Carousel order (0–4)', banner.sortOrder ?? index, val => updatePromoBanner(index, { sortOrder: val }), 'number-pad', `promoBanners.${index}.sortOrder`)}
          </View>)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student loyalty rewards</Text>
          <Text style={styles.paymentHelp}>Rewards are off by default. Configure the outlet-approved earning value, redemption value and lifetime tiers before enabling. Points apply only to verified, paid, completed individual orders; group orders are excluded.</Text>
          <ToggleSwitch label="Enable loyalty rewards" value={settings.loyalty?.enabled === true} onValueChange={toggleLoyalty} />
          {numericField('Eligible spend block (₹)', settings.loyalty?.earnEveryRupees, value => updateLoyalty({ earnEveryRupees: value }), 'number-pad', 'loyalty.earnEveryRupees')}
          {numericField('Points earned per spend block', settings.loyalty?.pointsPerStep, value => updateLoyalty({ pointsPerStep: value }), 'number-pad', 'loyalty.pointsPerStep')}
          {numericField('Value per point (paise)', settings.loyalty?.paisePerPoint, value => updateLoyalty({ paisePerPoint: value }), 'number-pad', 'loyalty.paisePerPoint')}
          {numericField('Minimum redemption points', settings.loyalty?.minimumRedemptionPoints, value => updateLoyalty({ minimumRedemptionPoints: value }), 'number-pad', 'loyalty.minimumRedemptionPoints')}
          {numericField('Maximum item subtotal redeemed (%) · max 50', settings.loyalty?.maxRedemptionPercent, value => updateLoyalty({ maxRedemptionPercent: value }), 'number-pad', 'loyalty.maxRedemptionPercent')}
          <Text style={styles.inputLabel}>Lifetime tiers · first tier must start at 0 points</Text>
          {(settings.loyalty?.tiers || []).map((tier, index) => <View key={index} style={styles.tierRow}>
            <View style={styles.tierNameColumn}>
              <TextInput style={[styles.input, validationErrors[`loyalty.tier.${index}.name`] && styles.inputInvalid]} value={tier.name} onChangeText={name => updateLoyaltyTier(index, { name })} maxLength={24} placeholder="Tier name" accessibilityLabel={`Tier ${index + 1} name`} />
              {validationErrors[`loyalty.tier.${index}.name`] ? <Text accessibilityRole="alert" style={styles.fieldError}>{validationErrors[`loyalty.tier.${index}.name`]}</Text> : null}
            </View>
            <View style={styles.tierPoints}>
              <Text style={styles.inputLabel}>Starts at points</Text>
              <TextInput style={[styles.input, styles.tierPointInput, validationErrors[`loyalty.tier.${index}.minimumLifetimePoints`] && styles.inputInvalid]} value={tier.minimumLifetimePoints == null ? '' : String(tier.minimumLifetimePoints)} onChangeText={value => updateLoyaltyTier(index, { minimumLifetimePoints: value })} keyboardType="number-pad" placeholder="0" accessibilityLabel={`Tier ${index + 1} starting points`} accessibilityHint={validationErrors[`loyalty.tier.${index}.minimumLifetimePoints`] || undefined} />
              {validationErrors[`loyalty.tier.${index}.minimumLifetimePoints`] ? <Text accessibilityRole="alert" style={styles.fieldError}>{validationErrors[`loyalty.tier.${index}.minimumLifetimePoints`]}</Text> : null}
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove tier ${tier.name || index + 1}`} onPress={() => updateLoyalty({ tiers: settings.loyalty.tiers.filter((_, tierIndex) => tierIndex !== index) })} style={styles.removeTier}><Text style={styles.removeTierText}>Remove</Text></TouchableOpacity>
          </View>)}
          {(settings.loyalty?.tiers || []).length < 5 ? <TouchableOpacity onPress={() => updateLoyalty({ tiers: [...(settings.loyalty?.tiers || []), { name: '', minimumLifetimePoints: 0 }] })} style={styles.addTier}><Text style={styles.addTierText}>Add tier</Text></TouchableOpacity> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Toggles</Text>
          <Text style={styles.inputLabel}>Campus pickup point (optional)</Text>
          <TextInput
            style={styles.input}
            value={settings.pickupLocation || ''}
            onChangeText={value => setSettings({ ...settings, pickupLocation: value })}
            maxLength={200}
            placeholder="e.g. Wrapchik Counter, SAC Ground Floor"
            accessibilityLabel="Campus pickup point address"
          />
          <Text style={styles.paymentHelp}>Customers see this point and its map link only after you configure it. If left blank, order snapshots retain the existing TIET counter address.</Text>
          <ToggleSwitch 
            label="Accepting Orders" 
            value={settings.acceptingOrders} 
            onValueChange={(val) => setSettings({...settings, acceptingOrders: val})} 
          />
          <ToggleSwitch 
            label="Delivery Enabled" 
            value={settings.deliveryEnabled} 
            onValueChange={(val) => setSettings({...settings, deliveryEnabled: val})} 
          />
          <ToggleSwitch 
            label="Takeaway Enabled" 
            value={settings.takeawayEnabled} 
            onValueChange={(val) => setSettings({...settings, takeawayEnabled: val})} 
          />
          <ToggleSwitch 
            label="Dine-in Enabled" 
            value={settings.dineInEnabled} 
            onValueChange={(val) => setSettings({...settings, dineInEnabled: val})} 
          />
          <ToggleSwitch label="Scheduled pickup enabled" value={settings.scheduledPickupEnabled === true} onValueChange={val => setSettings({ ...settings, scheduledPickupEnabled: val })} />
          {settings.scheduledPickupEnabled ? <>
            <Text style={styles.inputLabel}>Pickup slot interval (minutes)</Text>
            <View style={styles.statusRow}>{[15, 30, 60].map(value => <TouchableOpacity key={value} onPress={() => setSettings({ ...settings, pickupSlotMinutes: value })} style={[styles.statusBtn, Number(settings.pickupSlotMinutes) === value && styles.statusBtnActive]}><Text style={[styles.statusBtnText, Number(settings.pickupSlotMinutes) === value && styles.statusBtnTextActive]}>{value}</Text></TouchableOpacity>)}</View>
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Orders per pickup slot</Text>
            {numericField('Orders per pickup slot', settings.pickupSlotCapacity, val => setSettings({ ...settings, pickupSlotCapacity: val }), 'number-pad', 'pickupSlotCapacity')}
          </> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Info</Text>
          <Text style={styles.inputLabel}>Open Time</Text>
          <TextInput
            style={styles.input}
            value={settings.openTime}
            onChangeText={(val) => setSettings({...settings, openTime: val})}
            placeholder="09:00 (24-hour time)"
          />
          
          <Text style={styles.inputLabel}>Close Time</Text>
          <TextInput
            style={styles.input}
            value={settings.closeTime}
            onChangeText={(val) => setSettings({...settings, closeTime: val})}
            placeholder="23:00 (24-hour time)"
          />

          <Text style={styles.inputLabel}>Est. Prep Minutes</Text>
          {numericField('Estimated prep minutes', settings.estimatedPrepMinutes, val => setSettings({ ...settings, estimatedPrepMinutes: val }), 'number-pad', 'estimatedPrepMinutes')}

          <Text style={styles.inputLabel}>Highlight active orders after (minutes)</Text>
          {numericField('Highlight active orders after (minutes)', settings.orderOverdueMinutes ?? 30, val => setSettings({ ...settings, orderOverdueMinutes: val }), 'number-pad', 'orderOverdueMinutes', 'Overdue order highlight threshold in minutes')}
          
          <Text style={styles.inputLabel}>Delivery Fee (₹)</Text>
          {numericField('Delivery fee (₹)', settings.deliveryFee, val => setSettings({ ...settings, deliveryFee: val }), 'decimal-pad', 'deliveryFee')}
          <Text style={styles.inputLabel}>Share a Meal minimum subtotal (₹, 0 disables)</Text>
          {numericField('Share a Meal minimum subtotal (₹, 0 disables)', settings.groupMinimumOrderValue ?? 0, val => setSettings({ ...settings, groupMinimumOrderValue: val }), 'decimal-pad', 'groupMinimumOrderValue')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Busy Status</Text>
          <View style={styles.statusRow}>
            {['NORMAL', 'BUSY', 'VERY_BUSY'].map(status => (
              <TouchableOpacity
                key={status}
                onPress={() => setSettings({...settings, busyStatus: status})}
                style={[styles.statusBtn, settings.busyStatus === status && styles.statusBtnActive]}
              >
                <Text style={[styles.statusBtnText, settings.busyStatus === status && styles.statusBtnTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button 
          title={saving ? "Saving..." : "Save Settings"} 
          onPress={handleSave} 
          disabled={saving}
          style={styles.saveBtn}
        />
        
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  bannerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addBannerButton: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.primaryLight },
  addBannerText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '900' },
  archiveBannerText: { color: COLORS.danger, fontSize: 12, fontWeight: '800', padding: 8 },
  bannerEditor: { marginTop: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFCFA' },
  bannerEditorTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '900' },
  paymentHelp: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: -8 },
  tierRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 10 }, tierNameColumn: { flex: 1, minWidth: 90 }, tierPoints: { width: 124 }, tierPointInput: { marginBottom: 8 }, removeTier: { paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' }, removeTierText: { color: COLORS.danger, fontSize: 11, fontWeight: '800' }, addTier: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, addTierText: { color: COLORS.primary, fontWeight: '900' },
  
  // Toggle Styles
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  toggleContainer: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: COLORS.success },
  toggleOff: { backgroundColor: COLORS.border },
  toggleCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  circleOn: { transform: [{ translateX: 22 }] },
  circleOff: { transform: [{ translateX: 0 }] },

  // Input Styles
  inputLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    color: COLORS.textPrimary,
  },
  numericField: { marginBottom: 3 }, inputInvalid: { borderColor: COLORS.danger }, fieldError: { color: COLORS.danger, fontSize: 12, lineHeight: 16, marginTop: -11, marginBottom: 12, fontWeight: '700' },

  // Busy Status Styles
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
  },
  statusBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  statusBtnTextActive: { color: '#FFF' },

  saveBtn: { marginTop: 10 },
  feedback: { padding: 11, borderRadius: 8, backgroundColor: '#E6F4E9', marginBottom: 12 }, feedbackError: { backgroundColor: '#FCEBE8' }, feedbackText: { color: '#236C3A', fontSize: 12, fontWeight: '700' }, feedbackErrorText: { color: '#97372B' },
});
