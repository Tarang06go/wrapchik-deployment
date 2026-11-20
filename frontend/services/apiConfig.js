import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiBaseUrl, toSocketBaseUrl } from './apiEndpoint';

const debuggerHost = Constants.expoGoConfig?.debuggerHost
  || Constants.manifest2?.extra?.expoGo?.debuggerHost
  || Constants.expoConfig?.hostUri
  || Constants.manifest?.debuggerHost;

const endpoint = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: __DEV__,
  debuggerHost,
  browserHostname: typeof window !== 'undefined' ? window.location?.hostname : undefined,
});

export const API_BASE_URL = endpoint.baseUrl || '';
export const API_ORIGIN = toSocketBaseUrl(endpoint.baseUrl) || '';
export const API_CONFIG_PROBLEM = endpoint.error || '';
export const API_CONFIG_SOURCE = process.env.EXPO_PUBLIC_API_URL
  ? 'environment'
  : Platform.OS === 'web'
    ? 'web-host'
    : debuggerHost
      ? 'expo-host'
      : 'unconfigured';
export const SOCKET_URL = API_ORIGIN;

export const resolveApiOrigin = () => ({
  origin: API_ORIGIN,
  source: API_CONFIG_SOURCE,
  problem: API_CONFIG_PROBLEM || undefined,
});

if (__DEV__) {
  console.log(`[Wrapchik API] ${API_BASE_URL || '(none)'} via ${API_CONFIG_SOURCE}${API_CONFIG_PROBLEM ? ` — ${API_CONFIG_PROBLEM}` : ''}`);
}
