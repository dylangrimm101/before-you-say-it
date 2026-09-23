import AsyncStorage from '@react-native-async-storage/async-storage';
import { answersComplete, normalizeAnswers, type Answers } from './answerFirst';
import { serializeStoreOperation } from './storePersistence';

// These are self-reported preferences, never entitlement or assessment evidence.
// Drawing coordinates deliberately never enter this repository.
const draftKey = 'cc.answerFirst.draft.v1';
const claimKey = 'cc.answerFirst.claim.v1';
const ownerKey = (owner: string) => `bysi.owner.v1:${encodeURIComponent(owner)}:cc.answerFirst.v1`;
export async function readAnswerFirst(owner?: string): Promise<Answers> {
  const value = await AsyncStorage.getItem(owner ? ownerKey(owner) : draftKey);
  if (!value) return {};
  try { return normalizeAnswers(JSON.parse(value)); } catch { return {}; }
}
export async function writeAnswerFirst(answers: Answers, owner?: string): Promise<void> {
  await serializeStoreOperation(AsyncStorage, async()=>{
    await AsyncStorage.setItem(owner ? ownerKey(owner) : draftKey, JSON.stringify(normalizeAnswers(answers)));
    if(!owner)await AsyncStorage.removeItem(claimKey);
  });
}
// Called only after this onboarding's explicit account-return intent, not on
// arbitrary login. A different account never automatically acquires a draft.
export async function claimAnswerFirst(owner: string): Promise<Answers> {
  return serializeStoreOperation(AsyncStorage,async()=>{
    const answers = await readAnswerFirst();
    if (!answersComplete(answers)) return readAnswerFirst(owner);
    const claimed=await AsyncStorage.getItem(claimKey);
    if(claimed&&claimed!==owner)throw Error('Starting focus belongs to a different account handoff');
    // Pin the intended owner before writing; retry cannot give a partially
    // completed handoff to the next account signed into this device.
    await AsyncStorage.setItem(claimKey,owner);
    await AsyncStorage.setItem(ownerKey(owner),JSON.stringify(answers));
    await AsyncStorage.removeItem(draftKey);
    await AsyncStorage.removeItem(claimKey);
    return answers;
  });
}
