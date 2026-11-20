// Android UPI intent helpers. The standard `upi://pay` URI makes Android show every installed UPI app in
// a system chooser; app-specific schemes are optional shortcuts used only when canOpenURL() finds them.
// Opening an app proves nothing about payment: the outlet still verifies receipt manually.

export const UPI_APPS = [
  { id: 'gpay', label: 'Google Pay', scheme: 'tez://upi/pay' },
  { id: 'phonepe', label: 'PhonePe', scheme: 'phonepe://pay' },
  { id: 'paytm', label: 'Paytm', scheme: 'paytmmp://pay' },
];

export const isUpiUri = (uri) => typeof uri === 'string' && /^upi:\/\/pay\?/i.test(uri) && /[?&]pa=[^&]+/.test(uri) && /[?&]am=\d+(\.\d{1,2})?(&|$)/.test(uri);

/** Rewrites the standard upi://pay URI to an app-specific scheme, keeping the exact same query string. */
export const buildAppUri = (upiUri, app) => {
  if (!isUpiUri(upiUri)) throw new Error('Invalid UPI payment link.');
  const query = upiUri.slice(upiUri.indexOf('?'));
  return `${app.scheme}${query}`;
};

/** Returns the specific apps that are installed. `canOpen` is Linking.canOpenURL (injected for testing). */
export const discoverUpiApps = async (upiUri, canOpen) => {
  if (!isUpiUri(upiUri)) return [];
  const results = await Promise.all(UPI_APPS.map(async (app) => {
    try { return (await canOpen(buildAppUri(upiUri, app))) ? app : null; } catch { return null; }
  }));
  return results.filter(Boolean);
};

/** Maps a launch failure to a user-facing message. */
export const describeUpiLaunchFailure = (platform) => (platform === 'web'
  ? 'A UPI app cannot be opened from this browser. Scan the QR code with a UPI app on your phone.'
  : 'No compatible UPI app could be opened. Scan the QR code from another phone, or pay with cash at the counter.');
