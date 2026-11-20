import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const Input = React.forwardRef(function Input({ label, value, onChangeText, placeholder, secureTextEntry, showPasswordToggle = false, keyboardType, error, autoCapitalize = 'none', accessibilityLabel, style, inputStyle, editable = true, showSoftInputOnFocus = true, autoFocus, onPressIn: onInputPressIn, onFocus: onInputFocus, onBlur: onInputBlur, ...textInputProps }, inputRef) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canTogglePassword = secureTextEntry && showPasswordToggle;
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, focused && styles.inputFocused, error ? styles.inputError : null]}>
        <TextInput
          ref={inputRef}
          {...textInputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !passwordVisible}
          keyboardType={keyboardType}
          editable={editable}
          autoFocus={autoFocus}
          showSoftInputOnFocus={Platform.OS === 'android' ? showSoftInputOnFocus : undefined}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={accessibilityLabel || label || placeholder}
          accessibilityHint={error || undefined}
          onPressIn={(event) => {
            if (__DEV__ && Platform.OS === 'android') console.log(`[Wrapchik Keyboard] ${label || accessibilityLabel || 'input'} press-in`);
            onInputPressIn?.(event);
          }}
          onFocus={(event) => {
            if (__DEV__ && Platform.OS === 'android') console.log(`[Wrapchik Keyboard] ${label || accessibilityLabel || 'input'} focus`);
            setFocused(true);
            onInputFocus?.(event);
          }}
          onBlur={(event) => {
            if (__DEV__ && Platform.OS === 'android') console.log(`[Wrapchik Keyboard] ${label || accessibilityLabel || 'input'} blur`);
            setFocused(false);
            onInputBlur?.(event);
          }}
          style={[styles.input, inputStyle]}
        />
        {canTogglePassword ? (
          <TouchableOpacity
            onPress={() => setPasswordVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            accessibilityState={{ checked: passwordVisible }}
            style={styles.visibilityButton}
          >
            {passwordVisible ? <EyeOff size={18} color={COLORS.textSecondary} /> : <Eye size={18} color={COLORS.textSecondary} />}
          </TouchableOpacity>
        ) : null}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    minHeight: THEME.layout.touchTarget + 4,
    ...(Platform.OS === 'android' ? { flexDirection: 'row', alignItems: 'center' } : {}),
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === 'android' ? { minHeight: THEME.layout.touchTarget, textAlignVertical: 'center' } : {}),
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none', boxShadow: 'none' } : {}),
  },
  visibilityButton: {
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
  },
});

export default Input;
