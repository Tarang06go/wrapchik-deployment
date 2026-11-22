import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { UtensilsCrossed } from 'lucide-react-native';
import COLORS from '../../constants/colors';
import { selectionHaptic } from '../../utils/haptics';

const CategoryCard = ({ category, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      onPress={() => { selectionHaptic(); onPress?.(); }}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Show ${category.name} products`}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
      <View style={[styles.imageContainer, isSelected && styles.imageSelected]}>
        {category.imageUrl ? <ExpoImage source={{ uri: category.imageUrl }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={100} /> : <UtensilsCrossed size={21} color={isSelected ? COLORS.primary : COLORS.textSecondary} />}
      </View>
      <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginRight: 12,
    width: 68,
  },
  cardSelected: {
    transform: [{ scale: 1.05 }],
  },
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  name: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  nameSelected: {
    fontWeight: '800',
    color: COLORS.primary,
  },
});

export default CategoryCard;
