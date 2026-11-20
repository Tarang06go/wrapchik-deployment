import safeStorage from './safeStorage';

const STORAGE_KEY = 'wrapchik_checkout_intent_v1';

export const getCheckoutIntentKey = async (fingerprint) => {
  const stored = await safeStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const intent = JSON.parse(stored);
      if (intent.fingerprint === fingerprint && typeof intent.key === 'string') return intent.key;
    } catch (error) {
      // Replace malformed local intent data with a fresh request key.
    }
  }

  const randomPart = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const key = `wrapchik-${Date.now().toString(36)}-${randomPart}`;
  await safeStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, key }));
  return key;
};

export const clearCheckoutIntentKey = async () => {
  try {
    await safeStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[Checkout Intent] Could not clear the saved request key.');
  }
};
