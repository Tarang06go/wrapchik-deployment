import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import safeStorage from '../services/safeStorage';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const storageKey = user?._id ? `wrapchik_cart_items:${user._id}` : 'wrapchik_cart_items';
  const [cartItems, setCartItems] = useState([]);
  const [loadedStorageKey, setLoadedStorageKey] = useState(null);

  // Keep carts isolated by signed-in account. The legacy guest cart remains intact.
  useEffect(() => {
    let active = true;
    setLoadedStorageKey(null);
    setCartItems([]);
    if (authLoading) return () => { active = false; };

    safeStorage.getItem(storageKey)
      .then((storedCart) => {
        if (!active) return;
        if (!storedCart) return setCartItems([]);
        const parsed = JSON.parse(storedCart);
        setCartItems(Array.isArray(parsed) ? parsed : []);
      })
      .catch((error) => {
        console.error('[CartContext Error] Failed to load cached cart:', error);
        if (active) setCartItems([]);
      })
      .finally(() => {
        if (active) setLoadedStorageKey(storageKey);
      });

    return () => { active = false; };
  }, [authLoading, storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    void safeStorage.setItem(storageKey, JSON.stringify(cartItems));
  }, [cartItems, loadedStorageKey, storageKey]);

  // Add item to cart with customization matching
  const addToCart = useCallback((product, selectedCustomizations = [], quantity = 1) => {
    setCartItems((prevItems) => {
      // Calculate unit price with customizations
      const custPrice = selectedCustomizations.reduce((sum, c) => sum + c.price, 0);
      const unitPrice = product.price + custPrice;

      // Unique cart key based on product ID & customization signatures
      const custKey = selectedCustomizations
        .map((c) => c.name)
        .sort()
        .join('|');
      const itemKey = `${product._id}_${custKey}`;

      const existingIndex = prevItems.findIndex((item) => item.cartKey === itemKey);

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        return [
          ...prevItems,
          {
            cartKey: itemKey,
            productId: product._id,
            name: product.name,
            basePrice: product.price,
            unitPrice,
            quantity,
            imageUrl: product.imageUrl,
            isVeg: product.isVeg,
            customizations: selectedCustomizations,
          },
        ];
      }
    });
  }, []);

  const removeFromCart = useCallback((cartKey) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartKey !== cartKey));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((cartKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartKey);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.cartKey === cartKey ? { ...item, quantity: newQuantity } : item
      )
    );
  }, [removeFromCart]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    setCartItems([]);
    try {
      await safeStorage.removeItem(storageKey);
    } catch (e) {
      console.error('[CartContext Error] Failed to clear cached cart:', e);
    }
  }, [storageKey]);

  // Calculate cart totals and the common product lookup in one pass.
  const { cartCount, subtotal, cartItemByProductId } = useMemo(() => {
    const result = { cartCount: 0, subtotal: 0, cartItemByProductId: new Map() };
    for (const item of cartItems) {
      result.cartCount += item.quantity;
      result.subtotal += item.unitPrice * item.quantity;
      if (!result.cartItemByProductId.has(item.productId)) result.cartItemByProductId.set(item.productId, item);
    }
    return result;
  }, [cartItems]);
  const taxAndFees = Math.round(subtotal * 0.05); // 5% GST
  const grandTotal = subtotal + taxAndFees;
  const value = useMemo(() => ({
    cartItems,
    cartItemByProductId,
    cartCount,
    subtotal,
    taxAndFees,
    grandTotal,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  }), [cartItems, cartItemByProductId, cartCount, subtotal, taxAndFees, grandTotal, addToCart, updateQuantity, removeFromCart, clearCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
