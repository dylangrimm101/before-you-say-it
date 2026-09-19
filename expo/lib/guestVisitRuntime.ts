import {authEnvironment} from './supabase';
import {createGuestVisit} from './guestVisit';

// No new build setting or auth mode. Only the existing normal-production path.
export const guestVisitsEnabled = process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN === 'https://beforeyousayit.app'
  && process.env.EXPO_PUBLIC_BYSI_BUILD_MODE !== 'staging-account'
  && authEnvironment?.url === 'https://spvksnddzyvycfoefrcf.supabase.co'
  && !authEnvironment.staging;
export const guestVisit = createGuestVisit({now:()=>Date.now(),random:()=>{
  const Crypto=require('expo-crypto') as typeof import('expo-crypto');
  return Array.from(Crypto.getRandomBytes(32),byte=>byte.toString(16).padStart(2,'0')).join('');
}});
