import {createCurrentGuestContinuation, type OwnerPracticeStorage, type OwnerStorageHost} from './ownerPracticeStorage';
import {createDurableGuestContinuation} from './durableGuestContinuation';
import {createMigratingSecureSessionStorage} from './secureSessionStorage';

export async function guestContinuationSecureStorage(environment:string) {
  const [secure,crypto]=await Promise.all([import('expo-secure-store'),import('expo-crypto')]);
  if(!await secure.isAvailableAsync())throw new Error('Device secure continuation is unavailable');
  const env=await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256,environment);
  const options={keychainService:`bysi.guest.handoff.v1.${env}`,keychainAccessible:secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,requireAuthentication:false};
  return createMigratingSecureSessionStorage({
    secure:{getItem:k=>secure.getItemAsync(k,options),setItem:(k,v)=>secure.setItemAsync(k,v,options),removeItem:k=>secure.deleteItemAsync(k,options)},
    legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},
    namespaceForKey:async()=>`bysi.guest.proof.${env}`,
    generation:()=>crypto.randomUUID().replaceAll('-',''),
  });
}

export function createGuestContinuationRuntime(host: OwnerStorageHost, platform: string, environment: string) {
  if (platform !== 'ios' && platform !== 'android') {
    const memory = createCurrentGuestContinuation();
    return {...memory,durable:false,
      prepare: (source: OwnerPracticeStorage, _email: string) => memory.prepare(source),
      restore: async (_source: OwnerPracticeStorage) => false,
      resumeVerified: async (_target: OwnerPracticeStorage, _email: string): Promise<string | null> => null,
      dispose: () => memory.invalidate(),
      cancelConsent: async () => {},
      acknowledge: async (_target: OwnerPracticeStorage, _id: string) => {},
      stageApproval: async (_source: OwnerPracticeStorage, _id: string, _raw: string) => {},
    };
  }
  // Lazy import is intentional: web must not evaluate native-only SecureStore.
  const native = async () => {
    const [secure,crypto] = await Promise.all([import('expo-secure-store'),import('expo-crypto')]);
    if (!await secure.isAvailableAsync()) throw new Error('Device secure continuation is unavailable');
    return {secure,crypto};
  };
  const storage = guestContinuationSecureStorage(environment);
  // Retain failure for callers while preventing an eager unhandled rejection.
  void storage.catch(()=>{});
  return createDurableGuestContinuation({host,
    secure:{getItem:async k=>(await storage).getItem(k),setItem:async(k,v)=>(await storage).setItem(k,v),removeItem:async k=>(await storage).removeItem(k)},
    nonce:async()=>(await native()).crypto.randomUUID(),
    digest:async raw=>{const {crypto}=await native();return crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256,raw);},
    now:()=>Date.now(),
  });
}
