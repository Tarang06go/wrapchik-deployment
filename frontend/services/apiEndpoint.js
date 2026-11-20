const normalizeApiBaseUrl = (value) => {
  const input = String(value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(input)) return null;
  try {
    if (!new URL(input).hostname) return null;
  } catch (_) {
    return null;
  }
  return /\/api$/i.test(input) ? input : `${input}/api`;
};

const isLoopbackHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '::1' || host === '10.0.2.2' || /^127\./.test(host);
};

// An outlet backend on the campus/laptop LAN is plain HTTP. That is a private address the
// phone can only reach on the local network, so it is allowed in release builds too. Public
// hostnames still require HTTPS.
const isPrivateNetworkHost = (hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
};

export const resolveApiBaseUrl = ({
  configuredUrl,
  platform,
  development,
  debuggerHost,
  browserHostname,
}) => {
  const configured = normalizeApiBaseUrl(configuredUrl);
  if (configured) {
    if (platform === 'android' && isLoopbackHost(new URL(configured).hostname)) {
      return { baseUrl: null, error: 'Android phone testing cannot use localhost or 10.0.2.2. Set EXPO_PUBLIC_API_URL to http://<laptop-LAN-IPv4>:5000.' };
    }
    const configuredHost = new URL(configured).hostname;
    if (!development && !/^https:\/\//i.test(configured) && !isPrivateNetworkHost(configuredHost)) {
      return { baseUrl: null, error: 'Production builds require EXPO_PUBLIC_API_URL to use HTTPS (plain HTTP is only allowed for a private LAN address).' };
    }
    return { baseUrl: configured, error: null };
  }

  if (!development) {
    return { baseUrl: null, error: 'Set EXPO_PUBLIC_API_URL to the HTTPS URL of the Wrapchik backend before building.' };
  }

  if (platform === 'web') {
    const hostname = String(browserHostname || 'localhost').replace(/^\[|\]$/g, '');
    const host = hostname.includes(':') ? `[${hostname}]` : hostname;
    return { baseUrl: normalizeApiBaseUrl(`http://${host}:5000`), error: null };
  }

  if (debuggerHost) {
    try {
      const host = new URL(`http://${debuggerHost}`).hostname;
      if (host && !(platform === 'android' && isLoopbackHost(host))) {
        return { baseUrl: normalizeApiBaseUrl(`http://${host}:5000`), error: null };
      }
    } catch (_) {
      // Use the explicit URL instead of guessing a host that could be wrong for a phone.
    }
  }

  return {
    baseUrl: null,
    error: 'No Expo LAN host was detected. Start Expo with --host lan or set EXPO_PUBLIC_API_URL, then restart the app.',
  };
};

export const toSocketBaseUrl = (apiBaseUrl) => apiBaseUrl?.replace(/\/api\/?$/i, '') || null;
