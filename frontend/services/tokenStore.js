import { Platform } from 'react-native';
import safeStorage from './safeStorage';

export const TOKEN_KEY = 'wrapchik_jwt_token';
export const USER_KEY = 'wrapchik_user_data';

let memoryToken = null;

export const getToken = () => memoryToken;

export const readStoredToken = async () => {
  try {
    const value = await safeStorage.getItem(TOKEN_KEY, { secure: Platform.OS !== 'web' });
    memoryToken = value || null;
  } catch (error) {
    memoryToken = null;
    console.warn('[Auth] Stored token unavailable; continuing signed out:', error.message);
  }
  return memoryToken;
};

export const readStoredUser = async () => {
  try {
    return await safeStorage.getItem(USER_KEY);
  } catch (error) {
    console.warn('[Auth] Cached profile unavailable:', error.message);
    return null;
  }
};

export const persistUser = (user) => safeStorage.setItem(USER_KEY, JSON.stringify(user));

export const removeCachedUser = () => safeStorage.removeItem(USER_KEY);

export const saveToken = (token) => {
  memoryToken = token || null;
  void safeStorage.setItem(TOKEN_KEY, token, { secure: Platform.OS !== 'web' });

  if (Platform.OS !== 'web') {
    void safeStorage.removeItem(TOKEN_KEY);
  }
};

export const clearStoredSession = () => {
  memoryToken = null;
  const operations = [safeStorage.multiRemove([TOKEN_KEY, USER_KEY])];
  if (Platform.OS !== 'web') operations.push(safeStorage.removeItem(TOKEN_KEY, { secure: true }));
  return Promise.allSettled(operations).then((results) => {
    results.forEach((result) => {
      if (result.status === 'rejected') console.warn('[Auth] Session storage cleanup failed:', result.reason?.message || 'unknown storage error');
    });
  });
};
