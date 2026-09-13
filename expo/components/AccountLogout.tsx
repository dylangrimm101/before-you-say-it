import React from 'react';
import { Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import { useAuth } from '@/providers/auth';
/** Logout is not destructive reset. Owner records remain quarantined on-device. */
export function AccountLogout() {
  const { user, logout, logoutError, isLoggingOut } = useAuth();
  if (!user && !logoutError && !isLoggingOut) return null;
  return <View>
    <PrimaryButton label={isLoggingOut ? 'Signing out…' : logoutError ? 'Try signing out again' : 'Sign out'} disabled={isLoggingOut} onPress={logout} />
    {logoutError ? <Text accessibilityRole="alert">{logoutError}</Text> : <Text>Signing out hides this account’s saved practice. It does not cancel your subscription.</Text>}
  </View>;
}
