import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/providers/auth';
import { NO_PRACTICE_ADMISSION } from './stagingPracticeAccess';
const emptySubscribe = () => () => {};
const emptySnapshot = () => NO_PRACTICE_ADMISSION;
export function useStagingPracticeAdmission(autoVerify = true) {
  const { stagingPracticeAccess: access, user } = useAuth();
  const state = useSyncExternalStore(access?.subscribe ?? emptySubscribe, access?.getSnapshot ?? emptySnapshot, access?.getSnapshot ?? emptySnapshot);
  useEffect(() => {
    if (!access || !user || !autoVerify) return;
    // Recheck on entry and after expiry/foreground. Never restart a denied request
    // automatically: a visible retry is required for unavailable/denied decisions.
    if (state.status === 'idle') void access.verify();
  }, [access, user, autoVerify, state.status]);
  useEffect(() => {
    if (!access) return;
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') access.invalidate(); });
    return () => subscription.remove();
  }, [access]);
  return { access, state, enabled: !!access, allowed: !!access && !!user && state.status === 'allowed' && state.owner === user.id && state.expiresAt > Date.now() };
}
