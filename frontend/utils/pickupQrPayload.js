export const parsePickupQrPayload = rawValue => {
  if (typeof rawValue !== 'string' || rawValue.length > 4096) return null;
  try {
    const value = new URL(rawValue);
    if (value.protocol !== 'wrapchik:' || value.hostname !== 'admin' || value.pathname !== '/pickup') return null;
    const orderId = value.searchParams.get('orderId') || '';
    const token = value.searchParams.get('token') || '';
    // Backend pickup tokens are payload.signature, with both parts base64url.
    if (!/^[a-f\d]{24}$/i.test(orderId) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return { orderId, token };
  } catch { return null; }
};
