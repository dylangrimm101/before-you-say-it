import React from 'react';
import {ActivityIndicator, ScrollView, Text} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Backdrop, PrimaryButton} from './ui';
import {AccountLogout} from './AccountLogout';
import {C, GUTTER, T} from '@/constants/theme';
export function AccountAccessStatus({unavailable, retry}: {unavailable: boolean; retry: () => void}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 20, backgroundColor: C.bg}}>
    <Backdrop />
    <Text style={T.title}>{unavailable ? 'We couldn’t check your access' : 'Checking your access…'}</Text>
    {unavailable ? <><Text style={T.body}>Your purchase is unchanged. Check your connection and try again—you don’t need to buy again.</Text><PrimaryButton label="Retry access check" onPress={retry}/><PrimaryButton label="Account settings" onPress={() => router.push('/settings')}/><AccountLogout/></> : <ActivityIndicator color={C.purple}/>}
  </ScrollView>;
}
