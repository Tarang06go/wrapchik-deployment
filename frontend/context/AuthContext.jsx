import React, { createContext, useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import authService from '../services/authService';
import notificationService from '../services/notificationService';
import { AUTH_EXPIRED_EVENT } from '../services/authEvents';
import { clearStoredSession, persistUser, readStoredToken, readStoredUser, removeCachedUser, saveToken } from '../services/tokenStore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [developmentOtp, setDevelopmentOtp] = useState('');

  const clearSession = useCallback(async () => {
    setUser(null);
    setToken(null);
    // Clear in-memory auth immediately; bounded disk cleanup must not delay routing.
    void clearStoredSession();
  }, []);

  useEffect(() => {
    const onExpired = () => { clearSession(); };
    let subscription;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    } else {
      subscription = DeviceEventEmitter.addListener(AUTH_EXPIRED_EVENT, onExpired);
    }
    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      }
      subscription?.remove();
    };
  }, [clearSession]);

  useEffect(() => {
    if (Platform.OS === 'web' || !token || !user || isLoading) return undefined;
    let active = true;
    notificationService.registerForPushNotifications().then(async (pushToken) => {
      if (!active || !pushToken || pushToken === user.pushToken) return;
      try {
        const response = await authService.updateProfile({ pushToken });
        if (active && response?.success && response.user) {
          setUser(response.user);
          void persistUser(response.user);
        }
      } catch (error) {
        console.warn('[Push Registration] Could not save this device token:', error.message);
      }
    });
    return () => { active = false; };
  }, [token, user?._id, user?.pushToken, isLoading]);

  useEffect(() => {
    let active = true;
    const loadStoredAuth = async () => {
      const restoreStartedAt = Date.now();
      if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Auth] session restore started');
      try {
        const [storedToken, storedUser] = await Promise.all([readStoredToken(), readStoredUser()]);

        if (!storedToken) {
          if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Auth] no saved session; continuing signed out');
          void removeCachedUser();
          return;
        }

        if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Auth] saved token found; restoring session');

        // A cached profile plus a stored token is enough to render the app right away.
        // Validating against the network here used to hold the splash screen for up to the
        // request timeout, which looked like a frozen app whenever the backend was slow or
        // unreachable. Restore optimistically, then validate in the background.
        let cachedUser = null;
        try {
          cachedUser = storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
          cachedUser = null;
        }

        if (!active) return;
        setToken(storedToken);
        if (cachedUser) {
          setUser(cachedUser);
          setIsLoading(false);
        }

        try {
          const request = authService.getMe();
          const result = cachedUser
            ? await request
            : await Promise.race([
                request,
                new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
              ]);
          if (result?.success && result.user) {
            void persistUser(result.user);
            if (active) setUser(result.user);
          } else if (result) {
            await clearSession();
          }
        } catch (error) {
          if (error.status === 401 || error.status === 403) {
            await clearSession();
          }
          // Any other failure keeps the cached profile for an offline launch; every API
          // request is still validated by the backend.
        }
      } catch (error) {
        console.warn('[Auth] Session restore failed:', error.message);
        await clearSession();
      } finally {
        if (__DEV__ && Platform.OS === 'android') console.log(`[Wrapchik Auth] session restore finished in ${Date.now() - restoreStartedAt}ms`);
        if (active) setIsLoading(false);
      }
    };
    loadStoredAuth();
    return () => { active = false; };
  }, [clearSession]);

  const saveSession = async (newToken, newUser) => {
    saveToken(newToken);
    void persistUser(newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email, password, expectedRole) => {
    const loginStartedAt = Date.now();
    if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Auth] password login request started');
    setIsLoading(true);
    try {
      const res = await authService.login(email, password, expectedRole);
      if (res.success && res.token) {
        await saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message };
    } catch (error) {
      return { success: false, message: error.message, requiresVerification: error.requiresVerification };
    } finally {
      if (__DEV__ && Platform.OS === 'android') console.log(`[Wrapchik Auth] password login request finished in ${Date.now() - loginStartedAt}ms`);
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (credential, challengeId, phone) => {
    setIsLoading(true);
    try {
      const res = await authService.googleLogin(credential, challengeId, phone);
      if (res.success && res.token) {
        await saveSession(res.token, res.user);
        return { success: true, user: res.user };
      }
      return res;
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, phone, password) => {
    setIsLoading(true);
    try {
      const result = await authService.register(name, email, phone, password);
      if (result.success && result.developmentCode) setDevelopmentOtp(result.developmentCode);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email, code, purpose = 'LOGIN') => {
    setIsLoading(true);
    try {
      const res = await authService.verifyOtp(email, code, purpose);
      if (res.success && res.token) {
        await saveSession(res.token, res.user);
        setDevelopmentOtp('');
        return { success: true, user: res.user };
      }
      return { success: false, message: res.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await authService.updateProfile(profileData);
      if (res.success && res.user) {
        setUser(res.user);
        void persistUser(res.user);
      }
      return res;
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    if (user?.pushToken) {
      try { await authService.updateProfile({ pushToken: null }); }
      catch (error) { console.warn('[Push Registration] Could not clear this device token:', error.message); }
    }
    setUser(null);
    setToken(null);
    void clearStoredSession();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!token && !!user,
      isAdmin: user?.role === 'admin',
      login,
      loginWithGoogle,
      register,
      verifyOtp,
      updateProfile,
      developmentOtp,
      clearDevelopmentOtp: () => setDevelopmentOtp(''),
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
