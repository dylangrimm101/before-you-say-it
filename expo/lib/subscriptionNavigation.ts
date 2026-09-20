import { isModuleId } from '@/constants/modules';

// A fixed internal destination, never a caller-controlled redirect URL. Login
// does not carry guest-owned result data into the newly authenticated store.
export function subscriptionReturn(params: { returnTo?: string; moduleId?: string; gate?: string }) {
  if (params.returnTo !== 'subscription') return null;
  return {
    pathname: '/paywall' as const,
    params: {
      source: 'account-offer',
      ...(isModuleId(params.moduleId) ? { moduleId: params.moduleId } : {}),
      ...(params.gate === 'recommended-path' ? { gate: params.gate } : {}),
    },
  };
}
