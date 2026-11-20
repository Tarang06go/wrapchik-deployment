import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import COLORS from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef(null);
  const { returnTo } = useLocalSearchParams();
  const { login, loginWithGoogle, verifyOtp, isLoading } = useContext(AuthContext);
  const [adminMode, setAdminMode] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleAttempt, setGoogleAttempt] = useState(0);
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const [googlePhone, setGooglePhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Login] screen mounted');
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Keyboard] did-show', event.endCoordinates?.height);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Keyboard] did-hide');
    });
    return () => {
      shown.remove();
      hidden.remove();
      if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Login] screen unmounted');
    };
  }, []);

  useEffect(() => {
    if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Login] auth view state', { adminMode, googlePhoneStep: Boolean(pendingGoogle) });
  }, [adminMode, pendingGoogle]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (expirySeconds <= 0) return undefined;
    const timer = setTimeout(() => setExpirySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [expirySeconds]);

  const goHome = (user) => {
    if (user?.role === 'admin') return router.replace('/admin/dashboard');
    const returnRoutes = {
      checkout: '/checkout',
      orders: '/(tabs)/orders',
      favourites: '/favourites',
      notifications: '/notifications',
      offers: '/offers',
    };
    if (typeof returnTo === 'string' && returnRoutes[returnTo]) return router.replace(returnRoutes[returnTo]);
    return router.replace('/(tabs)/home');
  };

  const handlePasswordLogin = async () => {
    if (isLoading) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) return setError('Enter a valid email and your password.');
    if (!adminMode && !/^[^\s@]+@thapar\.edu$/.test(email.trim().toLowerCase())) return setError('Use your @thapar.edu student email.');
    const res = await login(email.trim().toLowerCase(), password, adminMode ? 'admin' : 'student');
    if (res.success) goHome(res.user);
    else setError(res.message || 'Invalid credentials');
  };

  const handleSendOtp = async () => {
    const normalizedEmail = otpEmail.trim().toLowerCase();
    setError('');
    if (!/^[^\s@]+@thapar\.edu$/.test(normalizedEmail)) return setError('Use your @thapar.edu student email.');
    setOtpBusy(true);
    try {
      const result = await authService.requestOtp(normalizedEmail, 'LOGIN');
      if (!result?.success) throw new Error(result?.message || 'Could not send a verification code.');
      setOtpSent(true);
      setOtpCode('');
      setResendSeconds(Number(result.resendAfterSeconds) || 60);
      setExpirySeconds(Number(result.expiresInSeconds) || 600);
      if (__DEV__ && result.developmentCode) setError(`Local development code: ${result.developmentCode}`);
    } catch (requestError) {
      setError(requestError.message || 'Could not send a verification code.');
      if (requestError.status === 429) setResendSeconds(60);
    } finally { setOtpBusy(false); }
  };

  const handleOtpLogin = async () => {
    setError('');
    if (expirySeconds <= 0) return setError('This code expired. Request a new one.');
    if (!/^\d{6}$/.test(otpCode)) return setError('Enter the 6-digit code.');
    const result = await verifyOtp(otpEmail.trim().toLowerCase(), otpCode, 'LOGIN');
    if (result.success) goHome(result.user);
    else setError(result.message || 'The code could not be verified.');
  };

  const handleGoogleLogin = async (credential, challengeId, phone) => {
    setError('');
    try {
      const result = await loginWithGoogle(credential, challengeId, phone);
      if (result.requiresPhone) {
        setPendingGoogle({ credential, challengeId, email: result.email, name: result.name });
        setGooglePhone('');
      } else if (result.success) {
        goHome(result.user);
      } else {
        setError(result.message || 'Google sign-in failed. Please try again.');
      }
    } catch (e) {
      setError(e.message || 'Google sign-in failed. Please try again.');
    }
  };

  const cancelGoogleSignup = () => {
    setPendingGoogle(null);
    setGooglePhone('');
    setError('');
    setGoogleAttempt((attempt) => attempt + 1);
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
        <View style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoText}>W</Text></View>
          <Text style={styles.brand}>WRAPCHIK</Text>
          <Text style={styles.tagline}>Campus cravings. One tap away. 🌯</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>{adminMode ? 'Administrator access.' : otpMode ? 'Verify your Thapar student email with a one-time code.' : 'Sign in with your student email or Google account.'}</Text>

          {!pendingGoogle && !adminMode && !otpMode ? (
            <>
              <Input label="Thapar student email" value={email} onChangeText={setEmail} placeholder="you@thapar.edu" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordInputRef.current?.focus()} testID="student-email-input" />
              <Input ref={passwordInputRef} label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry showPasswordToggle autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => { Keyboard.dismiss(); void handlePasswordLogin(); }} testID="student-password-input" />
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
                <Text style={styles.changeLink}>Forgot password?</Text>
              </TouchableOpacity>
              <Button title="Sign In" onPress={() => { Keyboard.dismiss(); void handlePasswordLogin(); }} loading={isLoading} style={styles.mainButton} testID="student-sign-in-button" />
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR CONTINUE WITH</Text><View style={styles.dividerLine} /></View>
              <GoogleSignInButton retryKey={googleAttempt} onCredential={handleGoogleLogin} onError={setError} />
              <TouchableOpacity accessibilityRole="button" onPress={() => { setOtpMode(true); setError(''); }} style={styles.alternateSignIn}>
                <Text style={styles.changeLink}>Use student email OTP instead</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {!pendingGoogle && !adminMode && otpMode ? (
            <>
              <Input label="Thapar student email" value={otpEmail} onChangeText={setOtpEmail} placeholder="you@thapar.edu" keyboardType="email-address" autoCapitalize="none" editable={!otpSent} />
              {otpSent ? (
                <>
                  <Text style={styles.otpHint}>{expirySeconds > 0 ? `Code expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, '0')}` : 'Code expired. Request another.'}</Text>
                  <Input label="6-digit code" value={otpCode} onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" keyboardType="number-pad" maxLength={6} />
                  <Button title="Verify & Sign In" onPress={handleOtpLogin} loading={isLoading} disabled={expirySeconds <= 0} style={styles.mainButton} />
                  <TouchableOpacity onPress={handleSendOtp} disabled={otpBusy || resendSeconds > 0} accessibilityRole="button" style={styles.alternateSignIn}>
                    <Text style={styles.changeLink}>{otpBusy ? 'Sending…' : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}</Text>
                  </TouchableOpacity>
                </>
              ) : <Button title="Send email code" onPress={handleSendOtp} loading={otpBusy} style={styles.mainButton} />}
              <TouchableOpacity accessibilityRole="button" onPress={() => { setOtpMode(false); setOtpSent(false); setOtpCode(''); setError(''); setGoogleAttempt((attempt) => attempt + 1); }} style={styles.alternateSignIn}>
                <Text style={styles.changeLink}>Back to Google sign-in</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {pendingGoogle ? (
            <>
              <Text style={styles.googleSignupInfo}>{pendingGoogle.name || pendingGoogle.email}</Text>
              <Text style={styles.googleSignupHint}>Add a phone number so the outlet can contact you about your order.</Text>
              <Input label="Phone number" value={googlePhone} onChangeText={setGooglePhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
              <Button
                title="Complete Google sign-in"
                onPress={() => {
                  if (!googlePhone.trim()) return setError('Enter a phone number to continue.');
                  handleGoogleLogin(pendingGoogle.credential, pendingGoogle.challengeId, googlePhone.trim());
                }}
                loading={isLoading}
                style={styles.mainButton}
              />
              <TouchableOpacity accessibilityRole="button" onPress={cancelGoogleSignup} style={styles.googleCancel}>
                <Text style={styles.changeLink}>Cancel Google sign-in</Text>
              </TouchableOpacity>
            </>
          ) : adminMode ? (
            <>
              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordInputRef.current?.focus()} testID="admin-email-input" />
              <Input ref={passwordInputRef} label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry showPasswordToggle autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => { Keyboard.dismiss(); void handlePasswordLogin(); }} testID="admin-password-input" />
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotLink}>
                <Text style={styles.changeLink}>Forgot password?</Text>
              </TouchableOpacity>
              <Button title="Sign In" onPress={() => { Keyboard.dismiss(); void handlePasswordLogin(); }} loading={isLoading} style={styles.mainButton} testID="admin-sign-in-button" />
            </>
          ) : null}

          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>⚠ {error}</Text> : null}

          <View style={styles.securityRow}>
            <ShieldCheck size={17} color={COLORS.success} />
          <Text style={styles.securityText}>Encrypted session • Protected authentication</Text>
          </View>
        </View>

        {adminMode ? (
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" onPress={() => { setAdminMode(false); setError(''); }}><Text style={styles.link}>Back to student sign-in</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to Wrapchik?</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/signup')} style={styles.footerAction}><Text style={styles.link}>Create account</Text></TouchableOpacity>
            <Text style={styles.footerText}> · Administrator?</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { setAdminMode(true); setOtpMode(false); setError(''); }} style={styles.footerAction}><Text style={styles.link}>Sign in with password</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F3' },
  scrollContent: { padding: 22, paddingTop: 36, paddingBottom: 36, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start' },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 62, height: 62, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  logoText: { color: '#FFF', fontSize: 34, fontWeight: '900' },
  brand: { marginTop: 12, color: COLORS.textPrimary, fontSize: 23, fontWeight: '900', letterSpacing: 2 },
  tagline: { marginTop: 5, color: COLORS.textSecondary, fontSize: 13 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#F0E5DE', elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, width: '100%' },
  title: { fontSize: 25, fontWeight: '900', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 18 },
  mainButton: { marginTop: 4 },
  googleSignupInfo: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  googleSignupHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 },
  googleCancel: { alignItems: 'center', padding: 12 },
  alternateSignIn: { alignItems: 'center', paddingVertical: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  otpHint: { fontSize: 12, color: COLORS.warning, fontWeight: '700', marginBottom: 10 },
  changeLink: { color: COLORS.primary, fontWeight: '800', fontSize: 12 },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 8, marginTop: -6, marginBottom: 6 },
  error: { color: COLORS.danger, backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, fontWeight: '700' },
  securityRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 18 },
  securityText: { color: COLORS.textSecondary, fontSize: 11 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 3, rowGap: 0, marginTop: 16, paddingHorizontal: 4 },
  footerAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  footerText: { color: COLORS.textSecondary, fontSize: 13 },
  link: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
});
