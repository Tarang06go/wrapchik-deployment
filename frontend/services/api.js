import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { emitAuthExpired } from './authEvents';
import { resolveApiBaseUrl } from './apiEndpoint';
import { clearStoredSession, getToken } from './tokenStore';
import { emitNetworkState } from './networkStatus';
import { shouldReportOfflineFailure } from '../utils/networkStatusCore';

let requestSequence = 0;
let latestSuccessfulSequence = 0;

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
const API_BASE_URL = endpoint.baseUrl;

if (API_BASE_URL) console.log('[Wrapchik API] Target Base URL:', API_BASE_URL);
else console.error('[Wrapchik API] Backend URL is not configured:', endpoint.error);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Automatically attach JWT Token
api.interceptors.request.use(
  async (config) => {
    if (!API_BASE_URL) {
      const configurationError = new Error(endpoint.error || 'The Wrapchik backend URL is not configured.');
      configurationError.code = 'API_CONFIG_MISSING';
      return Promise.reject(configurationError);
    }
    config.metadata = config.metadata || {};
    if (!Number.isSafeInteger(config.metadata.networkSequence)) {
      config.metadata.networkSequence = ++requestSequence;
    }
    if (__DEV__ && Platform.OS === 'android') {
      config.metadata.startedAt = Date.now();
      console.log(`[Wrapchik API] request ${String(config.method || 'get').toUpperCase()} ${config.url || ''}`);
    }
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle user-friendly error formatting
api.interceptors.response.use(
  (response) => {
    const sequence = Number(response.config?.metadata?.networkSequence);
    if (Number.isSafeInteger(sequence)) latestSuccessfulSequence = Math.max(latestSuccessfulSequence, sequence);
    emitNetworkState(true);
    if (__DEV__ && Platform.OS === 'android') {
      const elapsed = response.config?.metadata?.startedAt ? Date.now() - response.config.metadata.startedAt : undefined;
      console.log(`[Wrapchik API] response ${response.status} ${response.config?.url || ''}${elapsed === undefined ? '' : ` in ${elapsed}ms`}`);
    }
    return response.data;
  },
  async (error) => {
    if (__DEV__ && Platform.OS === 'android') {
      const elapsed = error.config?.metadata?.startedAt ? Date.now() - error.config.metadata.startedAt : undefined;
      console.warn(`[Wrapchik API] request failed ${error.response?.status || error.code || 'NO_RESPONSE'} ${error.config?.url || ''}${elapsed === undefined ? '' : ` after ${elapsed}ms`}`);
    }
    const config = error.config;
    const isIdempotentGet = String(config?.method || '').toLowerCase() === 'get';
    const retryable = !error.response && error.code !== 'API_CONFIG_MISSING';
    const retryCount = Number(config?._wrapchikRetryCount || 0);
    if (isIdempotentGet && retryable && retryCount < 2) {
      config._wrapchikRetryCount = retryCount + 1;
      await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** retryCount)));
      return api.request(config);
    }
    const failedSequence = Number(config?.metadata?.networkSequence);
    if (
      !error.response
      && error.code !== 'API_CONFIG_MISSING'
      && shouldReportOfflineFailure(failedSequence, latestSuccessfulSequence)
    ) emitNetworkState(false);

    let customError = 'Something went wrong. Please check your network connection.';

    if (error.code === 'API_CONFIG_MISSING') {
      customError = error.message;
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      customError = 'The Wrapchik server took too long to respond. Check your connection and try again.';
    } else if (error.response) {
      if (error.response.status === 401) {
        if (error.config?.headers?.Authorization) {
          try {
            // Clear in-memory credentials and notify routing immediately. Disk cleanup is bounded and detached.
            void clearStoredSession();
            emitAuthExpired();
          } catch (e) {}
        }
        customError = error.response.data?.message || 'Session expired. Please log in again.';
      } else if (error.response.data && error.response.data.message) {
        customError = error.response.data.message;
      } else if (error.response.status === 403) {
        customError = 'You do not have permission to perform this action.';
      } else if (error.response.status === 404) {
        customError = 'Requested resource was not found.';
      }
    } else {
      customError = 'Cannot reach the Wrapchik server. Check your internet or Wi-Fi and confirm the backend is running.';
    }

    const normalizedError = new Error(customError);
    normalizedError.status = error.response?.status;
    normalizedError.code = error.code;
    normalizedError.requiresVerification = error.response?.data?.requiresVerification;
    normalizedError.phone = error.response?.data?.phone;
    return Promise.reject(normalizedError);
  }
);

export default api;
