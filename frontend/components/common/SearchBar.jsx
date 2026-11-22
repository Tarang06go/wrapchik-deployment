import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Search, X } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import THEME from '../../constants/theme';

const SearchBar = ({ value, onChangeText, onClear, onSubmitEditing, onFocus, onBlur, onKeyPress, placeholder = 'Search wraps, burgers and more', style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <Search size={20} color={COLORS.textSecondary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        accessibilityLabel="Search the menu"
        accessibilityRole="search"
        returnKeyType="search"
        blurOnSubmit={false}
        autoCapitalize="none"
        autoCorrect={false}
        showSoftInputOnFocus
      />
      {value ? (
        <TouchableOpacity
          onPress={onClear}
          style={styles.clearBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.clearCircle}>
            <X size={14} color={COLORS.textInverse} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: COLORS.cardBackground,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.sm,
    ...THEME.shadow.sm,
  },
  iconWrap: {
    marginRight: THEME.spacing.sm,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    ...THEME.type.body,
    color: COLORS.textPrimary,
    paddingVertical: 0, // prevent Android extra padding
  },
  clearBtn: {
    padding: THEME.spacing.xxs,
    marginLeft: THEME.spacing.xs,
  },
  clearCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SearchBar;
