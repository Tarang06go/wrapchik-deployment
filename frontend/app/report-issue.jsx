import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, Alert, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Clock, HelpCircle, Package, Utensils, Check } from 'lucide-react-native';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import api from '../services/api';
import COLORS from '../constants/colors';
import THEME from '../constants/theme';
import { safeBack } from '../utils/navigation';

const CATEGORIES = [
  { id: 'WRONG_ITEM', label: 'Wrong Item', icon: Utensils },
  { id: 'MISSING_ITEM', label: 'Missing Item', icon: Package },
  { id: 'QUALITY', label: 'Food Quality', icon: AlertTriangle },
  { id: 'LATE', label: 'Delayed Order', icon: Clock },
  { id: 'OTHER', label: 'Other Issue', icon: HelpCircle },
];

export default function ReportIssueScreen() {
  const { orderId, category: initialCategory } = useLocalSearchParams();
  const router = useRouter();
  const [category, setCategory] = useState(Array.isArray(initialCategory) ? initialCategory[0] : initialCategory === 'LATE' ? 'LATE' : CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please provide details about the issue with your order.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/issues', { orderId, category, description: description.trim() });
      if (res.success) {
        Alert.alert('Issue Reported', 'Our team has received your report and will review it promptly.', [
          { text: 'OK', onPress: () => safeBack(router, '/report-issue') }
        ]);
      } else {
        Alert.alert('Could Not Submit', res.message || 'Please try again later.');
      }
    } catch (e) {
      Alert.alert('Submission Error', e.message || 'Failed to report issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Report an Issue" showBack showCart={false} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        >
          {/* Order reference banner */}
          <View style={styles.orderBanner}>
            <View style={styles.orderBannerIcon}>
              <AlertTriangle size={18} color={COLORS.primary} />
            </View>
            <View style={styles.orderBannerContent}>
              <Text style={styles.orderEyebrow}>ORDER REFERENCE</Text>
              <Text style={styles.orderIdText}>{orderId || 'General order inquiry'}</Text>
            </View>
          </View>

          {/* Category selection */}
          <Text style={styles.sectionTitle}>What went wrong?</Text>
          <Text style={styles.sectionSubtitle}>Select the category that best matches your concern.</Text>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catBtn, isSelected && styles.activeCat]}
                  onPress={() => setCategory(cat.id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Icon size={16} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.catText, isSelected && styles.activeCatText]}>
                    {cat.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={11} color="#FFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description field */}
          <View style={styles.inputSection}>
            <View style={styles.inputHeader}>
              <Text style={styles.sectionTitle}>Details</Text>
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Please share specific details so our kitchen staff can investigate.</Text>

            <View style={[styles.inputContainer, focused && styles.inputFocused]}>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={(text) => {
                  if (text.length <= 500) setDescription(text);
                }}
                multiline
                numberOfLines={5}
                placeholder="E.g., Ordered paneer wrap but received spicy chicken wrap instead..."
                placeholderTextColor="#9CA3AF"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>

          {/* Submit Action */}
          <Button
            title={submitting ? 'Submitting report…' : 'Submit Issue'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !description.trim()}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  orderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  orderBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBannerContent: {
    flex: 1,
  },
  orderEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 24,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  activeCat: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeCatText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    minHeight: 130,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    minHeight: 100,
  },
  submitBtn: {
    marginTop: 8,
  },
});
