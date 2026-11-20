import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import LoadingIndicator from '../../components/common/LoadingIndicator';

const first = value => Array.isArray(value) ? value[0] : value;

export default function GroupInviteRoute() {
  const params = useLocalSearchParams();
  const code = String(first(params.code) || '').trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code)) return <Redirect href="/group-order" />;
  return <Redirect href={{ pathname: '/group-order', params: { code } }} />;
}
