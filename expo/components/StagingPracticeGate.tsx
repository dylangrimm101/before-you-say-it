import React from 'react';
import { Text, View } from 'react-native';
import { PrimaryButton } from './ui';
import type { useStagingPracticeAdmission } from '@/lib/useStagingPracticeAdmission';
export function StagingPracticeGate({ admission }: { admission: ReturnType<typeof useStagingPracticeAdmission> }) {
  return <View><Text accessibilityRole="alert">{admission.state.status === 'checking' ? 'Checking server practice access…' : 'Practice access is not currently verified. Your saved result is not a subscription credential. Don’t purchase again.'}</Text>
    <PrimaryButton label="Check practice access again" disabled={admission.state.status === 'checking'} onPress={() => { void admission.access?.verify(); }} />
  </View>;
}
