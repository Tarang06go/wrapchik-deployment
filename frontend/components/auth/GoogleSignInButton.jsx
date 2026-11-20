import React, { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import authService from '../../services/authService';
import { performGoogleSignIn } from '../../services/googleSignIn';
import COLORS from '../../constants/colors';
import Constants from 'expo-constants';

let googleScriptPromise;

function loadGoogleIdentityScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google sign-in is available in a web browser.'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        googleScriptPromise = null;
        reject(new Error('Google sign-in could not load. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignInButton({ retryKey = 0, onCredential, onError }) {
  const element = useRef(null);
  const credentialCallback = useRef(onCredential);
  const errorCallback = useRef(onError);
  const [state, setState] = useState('checking');
  const [googleConfig, setGoogleConfig] = useState(null);
  const isExpoGo = Platform.OS !== 'web' && Constants.executionEnvironment === Constants.ExecutionEnvironment?.StoreClient;

  credentialCallback.current = onCredential;
  errorCallback.current = onError;

  useEffect(() => {
    let active = true;
    setState('checking');

    (async () => {
      try {
        if (isExpoGo) {
          if (active) setState('unavailable');
          return;
        }
        const config = await authService.googleConfig();
        if (!config?.enabled || !config.clientId) {
          if (active) setState('unavailable');
          return;
        }

        if (Platform.OS !== 'web') {
          if (active) {
            setGoogleConfig(config);
            setState('ready');
          }
          return;
        }

        if (active) setState('loading');
        const [challenge] = await Promise.all([
          authService.googleChallenge(),
          loadGoogleIdentityScript(),
        ]);
        if (!active || !element.current) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          nonce: challenge.nonce,
          hd: 'thapar.edu',
          auto_select: false,
          ux_mode: 'popup',
          callback: (response) => {
            if (active && response?.credential) {
              credentialCallback.current(response.credential, challenge.challengeId);
            }
          },
        });
        window.google.accounts.id.renderButton(element.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 300,
        });
        if (active) setState('ready');
      } catch (error) {
        if (active) {
          setState('error');
          errorCallback.current?.(error.message || 'Google sign-in could not load. Try again.');
        }
      }
    })();

    return () => { active = false; };
  }, [retryKey, isExpoGo]);

  const handleNativeSignIn = async () => {
    if (state === 'loading') return;
    setState('loading');
    try {
      const config = googleConfig || await authService.googleConfig();
      if (!config?.enabled || !config.clientId) {
        setState('unavailable');
        return;
      }
      const iosClientId = Constants.expoConfig?.extra?.googleSignIn?.iosClientId;
      if (Platform.OS === 'ios' && !iosClientId) {
        throw new Error('iOS Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and rebuild the iOS app.');
      }
      const challenge = await authService.googleChallenge();
      const result = await performGoogleSignIn({
        webClientId: config.clientId,
        iosClientId,
        nonce: challenge.nonce,
      });
      if (result.cancelled) {
        setState('ready');
        return;
      }
      credentialCallback.current?.(result.credential, challenge.challengeId);
      setState('ready');
    } catch (error) {
      setState('ready');
      errorCallback.current?.(error.message || 'Google sign-in could not start. Try again.');
    }
  };

  if (state === 'unavailable') {
    return <Text style={styles.error}>{isExpoGo ? 'Google sign-in needs the Wrapchik development build. Use student email OTP in Expo Go.' : 'Google sign-in is not configured. Use student email OTP or contact the Wrapchik administrator.'}</Text>;
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.divider}>Sign in with Google</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          accessibilityState={{ disabled: state !== 'ready', busy: state === 'loading' }}
          disabled={state !== 'ready'}
          onPress={handleNativeSignIn}
          style={({ pressed }) => [styles.nativeButton, pressed && styles.nativeButtonPressed, state !== 'ready' && styles.disabledButton]}
        >
          {state === 'loading' || state === 'checking'
            ? <ActivityIndicator color={COLORS.textPrimary} />
            : <Text style={styles.googleMark}>G</Text>}
          <Text style={styles.nativeButtonText}>{state === 'checking' ? 'Loading Google sign-in…' : 'Sign in with Google'}</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'checking') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.divider}>Sign in with Google</Text>
      {state === 'loading' ? <ActivityIndicator color={COLORS.primary} accessibilityLabel="Loading Google sign-in" /> : null}
      {state === 'error' ? <Text style={styles.error}>Google sign-in is temporarily unavailable.</Text> : null}
      {createElement('div', { ref: element, style: { minHeight: state === 'ready' ? 44 : 0, maxWidth: '100%' } })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%', marginTop: 16 },
  divider: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 10 },
  error: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 8 },
  nativeButton: { minHeight: 48, width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  nativeButtonPressed: { backgroundColor: '#F9FAFB' },
  disabledButton: { opacity: 0.6 },
  googleMark: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  nativeButtonText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
});
