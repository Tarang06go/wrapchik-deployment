import React, { useContext, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { AuthContext } from '../../context/AuthContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';

export default function AdminLayout() {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext);

  useEffect(() => {
    if (isLoading || user?.role === 'admin') return;
    router.replace(user ? '/(tabs)/home' : '/(auth)/login');
  }, [isLoading, router, user?.role]);

  if (isLoading || user?.role !== 'admin') return <LoadingIndicator message="Checking administrator access…" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} initialRouteName="dashboard" />;
}
