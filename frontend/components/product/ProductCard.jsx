import React, { useContext, useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { CartContext } from '../../context/CartContext';
import ProductImage from '../common/ProductImage';
import { isProductAvailable } from '../../utils/productAvailability';
import { addToCartHaptic } from '../../utils/haptics';
import COLORS from '../../constants/colors';
import { useReducedMotion } from '../../utils/reducedMotion';

const ProductCardPresentation = React.memo(function ProductCardPresentation({
  product, onPress, compact, isAvailable, existingItem, quantityInCart,
  reduceMotion, entrance, stepperScale, handleAdd, handleIncrement, handleDecrement,
}) {
  return (
    <Animated.View style={[styles.card, compact && styles.cardCompact, !isAvailable && styles.cardUnavailable, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name} details`}
        style={[styles.imageContainer, compact && styles.imageContainerCompact]}
      >
        <ProductImage uri={product.imageUrl} style={styles.image} fallbackIconSize={compact ? 21 : 26} accessibilityLabel={product.name} transition={reduceMotion ? 0 : 150} />
        {typeof product.isVeg === 'boolean' && <View style={[styles.vegBadge, { borderColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]}>
          <View style={[styles.vegDot, { backgroundColor: product.isVeg ? COLORS.vegGreen : COLORS.nonVegRed }]} />
        </View>}
        {!isAvailable && <View style={styles.unavailableOverlay}><Text style={styles.unavailableText}>Currently Unavailable</Text></View>}
      </TouchableOpacity>

      <View style={styles.content}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${product.name} details`}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={compact ? 2 : 1}>{product.name}</Text>
          {!compact && !!product.description?.trim() && <Text style={styles.description} numberOfLines={2}>{product.description}</Text>}
        </TouchableOpacity>
        <View style={[styles.footer, compact && styles.footerCompact]}>
          <Text style={[styles.price, compact && styles.priceCompact]}>₹{product.price}</Text>
          {quantityInCart > 0 && isAvailable ? (
            <Animated.View style={[styles.stepperBox, compact && styles.stepperBoxCompact, { transform: [{ scale: stepperScale }] }]}>
              <TouchableOpacity onPress={handleDecrement} style={[styles.stepperBtn, compact && styles.stepperBtnCompact]} accessibilityRole="button" accessibilityLabel={`Remove one ${product.name}`}>
                <Minus size={14} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperQty}>{quantityInCart}</Text>
              <TouchableOpacity onPress={handleIncrement} disabled={quantityInCart >= 50} style={[styles.stepperBtn, compact && styles.stepperBtnCompact]} accessibilityRole="button" accessibilityLabel={`Add one ${product.name}`}>
                <Plus size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity onPress={handleAdd} disabled={!isAvailable} accessibilityRole="button" accessibilityLabel={isAvailable ? `Add ${product.name} to cart` : `${product.name} unavailable`} style={[styles.addBtn, compact && styles.addBtnCompact, !isAvailable && styles.addBtnDisabled]}>
              <Plus size={16} color={isAvailable ? '#FFFFFF' : '#9E9E9E'} />
              <Text style={[styles.addBtnText, compact && styles.addBtnTextCompact, !isAvailable && styles.addBtnTextDisabled]}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const ProductCard = ({ product, onPress, compact = false }) => {
  const { cartItemByProductId, addToCart, updateQuantity, removeFromCart } = useContext(CartContext);

  const isAvailable = isProductAvailable(product);

  // Check if product already exists in cart
  const existingItem = cartItemByProductId?.get(product._id);
  const quantityInCart = existingItem ? existingItem.quantity : 0;
  const previousQuantity = useRef(quantityInCart);
  const stepperScale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(1)).current;
  const reduceMotionRef = useRef(true);
  const reduceMotion = useReducedMotion();
  reduceMotionRef.current = reduceMotion;

  useEffect(() => {
    if (reduceMotion !== false) {
      entrance.stopAnimation();
      entrance.setValue(1);
      stepperScale.stopAnimation();
      stepperScale.setValue(1);
      return undefined;
    }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); entrance.stopAnimation(); };
  }, [entrance, reduceMotion, stepperScale]);

  useEffect(() => {
    if (quantityInCart > previousQuantity.current) {
      if (reduceMotionRef.current) stepperScale.setValue(1);
      else {
        stepperScale.setValue(0.88);
        Animated.spring(stepperScale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }).start();
      }
    }
    previousQuantity.current = quantityInCart;
  }, [quantityInCart, stepperScale]);

  const handleAdd = React.useCallback((e) => {
    e?.stopPropagation?.();
    if (isAvailable) {
      addToCart(product, [], 1);
      addToCartHaptic();
    }
  }, [addToCart, isAvailable, product]);

  const handleIncrement = React.useCallback((e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart < 50) updateQuantity(existingItem.cartKey, quantityInCart + 1);
    } else {
      addToCart(product, [], 1);
    }
    if (isAvailable && quantityInCart < 50) addToCartHaptic();
  }, [addToCart, existingItem, isAvailable, product, quantityInCart, updateQuantity]);

  const handleDecrement = React.useCallback((e) => {
    e?.stopPropagation?.();
    if (existingItem) {
      if (quantityInCart > 1) {
        updateQuantity(existingItem.cartKey, quantityInCart - 1);
      } else {
        removeFromCart(existingItem.cartKey);
      }
    }
  }, [existingItem, quantityInCart, removeFromCart, updateQuantity]);

  return (
    <ProductCardPresentation product={product} onPress={onPress} compact={compact} isAvailable={isAvailable} existingItem={existingItem} quantityInCart={quantityInCart} reduceMotion={reduceMotion} entrance={entrance} stepperScale={stepperScale} handleAdd={handleAdd} handleIncrement={handleIncrement} handleDecrement={handleDecrement} />
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCompact: { borderRadius: 14, marginBottom: 8, padding: 8, shadowOpacity: 0.035, shadowRadius: 3, elevation: 1 },
  cardUnavailable: {
    opacity: 0.75,
    backgroundColor: '#F9FAFB',
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainerCompact: { width: 76, height: 76, borderRadius: 11 },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  vegBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  unavailableText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nameCompact: { fontSize: 14, lineHeight: 18, minHeight: 36 },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  footerCompact: { marginTop: 3, minHeight: 40 },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },
  priceCompact: { fontSize: 15 },
  addBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnCompact: { minWidth: 64, minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  addBtnTextCompact: { fontSize: 11 },
  addBtnDisabled: {
    backgroundColor: '#E0E0E0',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  addBtnTextDisabled: {
    color: '#9E9E9E',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    height: 32,
    paddingHorizontal: 4,
  },
  stepperBoxCompact: { height: 44, paddingHorizontal: 2 },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnCompact: { minWidth: 36, minHeight: 40, paddingHorizontal: 7, paddingVertical: 6 },
  stepperQty: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
    paddingHorizontal: 6,
    minWidth: 20,
    textAlign: 'center',
  },
});

export default ProductCard;
