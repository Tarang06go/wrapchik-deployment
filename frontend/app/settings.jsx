import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Clock3, HelpCircle, UserRound } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/common/Header';
import EmptyState from '../components/common/EmptyState';
import COLORS from '../constants/colors';
import THEME from '../constants/theme';

const settingsLinks = [
  { title: 'Profile and personal details', message: 'Update your Wrapchik profile', route: '/(tabs)/profile', Icon: UserRound },
  { title: 'Notifications', message: 'View order and account updates', route: '/notifications', Icon: Bell },
  { title: 'Meal plans and reminders', message: 'Manage saved baskets and local reminders', route: '/meal-plans', Icon: Clock3 },
  { title: 'Help and support', message: 'Get help with an order or account', route: '/support', Icon: HelpCircle },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  return <View style={styles.container}>
    <Header title="Settings" showBack showCart={false} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOUR WRAPCHIK ACCOUNT</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.description}>Manage your profile, reminders, notifications, and support from one place.</Text>
      {!user ? <EmptyState title="Sign in to manage your account" message="Your account settings are available after you sign in." buttonTitle="Sign in" onButtonPress={() => router.push('/(auth)/login')} /> : (
        <View style={styles.card}>
          {settingsLinks.map(({ title, message, route, Icon }, index) => <TouchableOpacity key={route} style={[styles.row, index < settingsLinks.length - 1 && styles.rowBorder]} onPress={() => router.push(route)} activeOpacity={0.74} accessibilityRole="button" accessibilityLabel={`${title}. ${message}`}>
            <View style={styles.icon}><Icon size={19} color={COLORS.primary} /></View>
            <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMessage}>{message}</Text></View>
            <ChevronRight size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>)}
        </View>
      )}
      <Text style={styles.note}>Wrapchik keeps ordering and payment controls with the outlet. Payment status can only be confirmed by the outlet.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: THEME.layout.pageGutter, paddingBottom: 36 },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: COLORS.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 5 },
  description: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  rowMessage: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  note: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 18, textAlign: 'center' },
});
