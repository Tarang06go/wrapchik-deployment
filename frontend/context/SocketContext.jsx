import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { AppState } from 'react-native';

// Get the API base URL from the same logic used in services/api.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiBaseUrl, toSocketBaseUrl } from '../services/apiEndpoint';

const debuggerHost = Constants.expoGoConfig?.debuggerHost
  || Constants.manifest2?.extra?.expoGo?.debuggerHost
  || Constants.expoConfig?.hostUri
  || Constants.manifest?.debuggerHost;
const socketEndpoint = resolveApiBaseUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: __DEV__,
  debuggerHost,
  browserHostname: typeof window !== 'undefined' ? window.location?.hostname : undefined,
});
const SOCKET_BASE_URL = toSocketBaseUrl(socketEndpoint.baseUrl);

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      const socketUrl = SOCKET_BASE_URL;
      if (!socketUrl) {
        console.warn('[Socket.IO] Not connecting:', socketEndpoint.error);
        setIsConnected(false);
        return undefined;
      }
      if (__DEV__ && Platform.OS === 'android') console.log('[Wrapchik Socket] connecting to', socketUrl);
      const client = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        timeout: 8000,
      });
      socketRef.current = client;
      setSocket(client);

      client.on('connect', () => {
        console.log('[Socket.IO] Connected');
        setIsConnected(true);
      });

      client.on('connect_error', (error) => {
        console.warn('[Socket.IO] Connection failed:', error.message);
        setIsConnected(false);
      });

      client.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected');
        setIsConnected(false);
      });

      return () => {
        client.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!socket) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && socket.connected) socket.emit('client_foreground');
    });
    return () => subscription.remove();
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
