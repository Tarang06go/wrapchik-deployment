import React, { useContext, useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { AuthContext } from '../../context/AuthContext';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import RouteErrorBoundary from '../../components/common/RouteErrorBoundary';

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useContext(AuthContext);

  useEffect(() => {
    if (isLoading || user?.role === 'admin') return;
    router.replace(user ? '/(tabs)/home' : '/(auth)/login');
  }, [isLoading, router, user?.role]);

  if (isLoading || user?.role !== 'admin') return <LoadingIndicator message="Checking administrator access…" />;
  return <RouteErrorBoundary key={pathname}>
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} initialRouteName="dashboard" />
  </RouteErrorBoundary>;
}
