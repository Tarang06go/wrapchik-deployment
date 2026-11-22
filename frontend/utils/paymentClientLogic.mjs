export const isUpiCheckoutAvailable = (settings) => Boolean(
  settings?.upiEnabled === true && settings?.upiId && settings?.upiPayeeName,
);

export const getAvailableCheckoutMethods = (settings) => [
  ...(settings?.cashEnabled !== false ? ['COUNTER'] : []),
  ...(isUpiCheckoutAvailable(settings) ? ['UPI_QR'] : []),
];

export const selectCheckoutMethod = (current, requested, settings) => {
  const available = getAvailableCheckoutMethods(settings);
  if (available.includes(requested)) return requested;
  if (available.includes(current)) return current;
  return available[0] || '';
};

export const reconcileCheckoutMethod = (current, settings) =>
  selectCheckoutMethod(current, current, settings);

// Keep this exactly aligned with manualPaymentController's authoritative validator.
export const isValidUpiTransactionReference = (value) =>
  /^[A-Za-z0-9-]{8,120}$/.test(String(value || '').trim());

export const launchUpiPayment = async ({ platform, uri, linking, browserWindow }) => {
  if (typeof uri !== 'string' || !uri.startsWith('upi://pay?')) {
    throw new Error('The order-specific UPI link is unavailable.');
  }
  if (platform === 'web') {
    if (typeof browserWindow?.open !== 'function') throw new Error('This browser cannot open UPI apps.');
    const opened = browserWindow.open(uri, '_blank');
    if (!opened) throw new Error('The browser blocked the UPI app handoff.');
    return;
  }
  if (typeof linking?.openURL !== 'function') throw new Error('UPI app handoff is unavailable on this device.');
  await linking.openURL(uri);
};

export const confirmWebUpiRetrySynchronously = (browserWindow, message) => {
  if (typeof browserWindow?.confirm !== 'function') return false;
  try { return Boolean(browserWindow.confirm(message)); } catch { return false; }
};
