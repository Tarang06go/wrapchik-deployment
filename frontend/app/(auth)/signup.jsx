import React, { useCallback, useState, useContext, useEffect, useRef } from 'react';

import {
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';

import { useRouter } from 'expo-router';

import { AuthContext } from '../../context/AuthContext';

import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import COLORS from '../../constants/colors';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const focusedInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const {
    register,
    isLoading,
  } = useContext(AuthContext);

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [errors, setErrors] =
    useState({});

  const scrollFocusedInputIntoView = useCallback((input = focusedInputRef.current) => {
    if (!input) return;
    requestAnimationFrame(() => {
      const responder = scrollRef.current?.getScrollResponder?.() || scrollRef.current;
      responder?.scrollResponderScrollNativeHandleToKeyboard?.(input, 24, true);
    });
  }, []);

  const handleInputFocus = useCallback((inputRef) => {
    focusedInputRef.current = inputRef.current;
    scrollFocusedInputIntoView(inputRef.current);
  }, [scrollFocusedInputIntoView]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollFocusedInputIntoView(focusedInputRef.current);
    });
    return () => subscription.remove();
  }, [scrollFocusedInputIntoView]);

  useEffect(() => {
    if (__DEV__) console.log('[Wrapchik] signup screen mounted');
  }, []);

  const validate = () => {
    const err = {};

    if (!name.trim() || name.trim().length > 80) {
      err.name = 'Enter a name between 1 and 80 characters';
    }

    if (!/^[^\s@]+@thapar\.edu$/i.test(email.trim())) {
      err.email = 'Use your @thapar.edu student email';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      err.phone = 'Enter a valid phone number with country code if needed';
    }

    if (
      !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(
        password
      )
    ) {
      err.password = 'Use 8–128 characters with at least one letter and one number';
    }

    if (
      password !==
      confirmPassword
    ) {
      err.confirmPassword =
        'Passwords do not match';
    }

    setErrors(err);

    return (
      Object.keys(err)
        .length === 0
    );
  };

  const handleSignup = async () => {
    if (!validate()) {
      return;
    }

    const result =
      await register(
        name,
        email,
        phone,
        password
      );

    if (!result.success) {
      setErrors((current) => ({ ...current, server: result.message || 'Unable to create account' }));
      return;
    }

    router.push({
      pathname: '/(auth)/email-verification',
      params: {
        email: email.trim().toLowerCase(),
        purpose: 'SIGNUP',
        resendAfterSeconds: result.resendAfterSeconds || 60,
        expiresInSeconds: result.expiresInSeconds || 600,
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 12, paddingBottom: Math.max(insets.bottom, 18) + 20 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
      <Text style={styles.brand}>
        WRAPCHIK
      </Text>

      <Text style={styles.title}>
        Create your account
      </Text>

      <Text style={styles.subtitle}>
        Order your campus food
        in seconds
      </Text>

      <Input
        ref={nameInputRef}
        label="Full Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        error={errors.name}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => emailInputRef.current?.focus()}
      />

      <Input
        ref={emailInputRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@thapar.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => phoneInputRef.current?.focus()}
      />

      <Input
        ref={phoneInputRef}
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="9876543210"
        keyboardType="phone-pad"
        error={errors.phone}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordInputRef.current?.focus()}
      />

      <Input
        ref={passwordInputRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="8+ characters"
        secureTextEntry
        showPasswordToggle
        error={errors.password}
        onFocus={() => handleInputFocus(passwordInputRef)}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
      />

      <Input
        ref={confirmPasswordInputRef}
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repeat password"
        secureTextEntry
        showPasswordToggle
        error={errors.confirmPassword}
        onFocus={() => handleInputFocus(confirmPasswordInputRef)}
        returnKeyType="done"
        onSubmitEditing={() => { Keyboard.dismiss(); void handleSignup(); }}
      />

      <Button
        title="Create Account"
        onPress={() => { Keyboard.dismiss(); void handleSignup(); }}
        loading={isLoading}
        style={{
          marginTop: 10,
        }}
      />
      {errors.server ? <Text accessibilityRole="alert" style={styles.serverError}>{errors.server}</Text> : null}

      <Text style={styles.loginText}>
        Already have an account?
      </Text>

      <Button
        title="Sign In"
        variant="outline"
        onPress={() =>
          router.push(
            '/(auth)/login'
          )
        }
        style={{
          marginTop: 10,
        }}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
    },

    scroll: { flex: 1 },

    content: {
      padding: 24,
      paddingTop: 24,
      paddingBottom: 36,
      flexGrow: 1,
    },

    brand: {
      fontSize: 32,
      fontWeight: '900',
      color: COLORS.primary,
      marginBottom: 20,
    },

    title: {
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 30,
      color: COLORS.textSecondary,
    },

    loginText: {
      textAlign: 'center',
      marginTop: 25,
      color: COLORS.textSecondary,
    },
    serverError: {
      color: COLORS.danger,
      backgroundColor: COLORS.dangerLight,
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
      fontWeight: '700',
    },
  });
