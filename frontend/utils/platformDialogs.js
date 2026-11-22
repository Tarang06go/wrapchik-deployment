const getBrowserWindow = (providedWindow) => {
  if (providedWindow !== undefined) return providedWindow;
  return typeof window !== 'undefined' ? window : undefined;
};

export const showPlatformAlert = (platform, title, message, { browserWindow, nativeAlert } = {}) => {
  if (platform === 'web') {
    const browser = getBrowserWindow(browserWindow);
    if (typeof browser?.alert === 'function') {
      try { return browser.alert(`${title}\n\n${message}`); } catch { /* use the native fallback */ }
    }
  }
  if (typeof nativeAlert === 'function') return nativeAlert(title, message);
  return undefined;
};

export const confirmPlatformAction = ({
  platform, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmStyle, browserWindow, nativeAlert,
}) => {
  if (platform === 'web') {
    const browser = getBrowserWindow(browserWindow);
    if (typeof browser?.confirm === 'function') {
      try { return Promise.resolve(Boolean(browser.confirm(message))); } catch { /* use the native fallback */ }
    }
  }

  return new Promise(resolve => {
    let settled = false;
    const settle = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    if (typeof nativeAlert !== 'function') return settle(false);
    try {
      nativeAlert(title, message, [
        { text: cancelLabel, style: 'cancel', onPress: () => settle(false) },
        { text: confirmLabel, ...(confirmStyle ? { style: confirmStyle } : {}), onPress: () => settle(true) },
      ], { cancelable: true, onDismiss: () => settle(false) });
    } catch { settle(false); }
  });
};

export const runAfterPlatformConfirmation = async ({
  key, inFlight, action, ...confirmation
}) => {
  const actionKey = String(key || '');
  if (!actionKey || !(inFlight instanceof Set) || inFlight.has(actionKey)) return false;
  inFlight.add(actionKey);
  try {
    if (!await confirmPlatformAction(confirmation)) return false;
    await action();
    return true;
  } finally {
    inFlight.delete(actionKey);
  }
};
