import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {authEnvironment,supabase} from './supabase';
import {createAccountRecovery} from './accountRecovery';
import {AUTH_URL, createImplicitRecovery} from './passwordRecoveryCallback';
import {createOwnerVoiceCache,quarantineOwnerVoiceCache} from './ownerVoiceCache';
import {Platform} from 'react-native';
import {createMigratingSecureSessionStorage} from './secureSessionStorage';
import {createReceiptlessDeletionJournal} from './receiptlessDeletionJournal';
import {invalidateOwnerPracticeLeases} from './ownerPracticeStorage';
import {serializeStoreOperation} from './storePersistence';
import {candidateAccountDeletionEndpoint,STAGING_ACCOUNT_DELETION_REVIEW_FLAG,checkAccountDeletionStatus as checkDeletionStatus,checkReceiptlessDeletionNotice,ensureReceiptlessDeletionCapability,requestAccountDeletion,reviewedAccountDeletionEndpoint,reviewedDeletionEndpoint,type AccountDeletionBilling,type AccountDeletionReceipt} from './accountDeletion';
// Source-reviewed rollout only: preserve the exact four-public-input Release
// contract. Remains OFF pending privacy policy and deployed acceptance.
const REVIEWED_DELETION_ENABLED=false;
const STAGING_DELETION_ENABLED=process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED===STAGING_ACCOUNT_DELETION_REVIEW_FLAG;
const REVIEWED_DELETION_ENDPOINT=process.env.EXPO_PUBLIC_NATIVE_ACCOUNT_DELETION!==undefined
 ? candidateAccountDeletionEndpoint({authUrl:authEnvironment?.url??null,flag:process.env.EXPO_PUBLIC_NATIVE_ACCOUNT_DELETION,development:typeof __DEV__!=='undefined'&&__DEV__,staging:authEnvironment?.staging,buildMode:process.env.EXPO_PUBLIC_BYSI_BUILD_MODE})
 : authEnvironment?.staging
 ? reviewedAccountDeletionEndpoint({authUrl:authEnvironment.url,enabled:STAGING_DELETION_ENABLED,staging:true,buildMode:process.env.EXPO_PUBLIC_BYSI_BUILD_MODE,applicationId:authEnvironment.applicationId,projectId:authEnvironment.projectId,reviewFlag:process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED})
 : reviewedDeletionEndpoint(authEnvironment?.url??null,REVIEWED_DELETION_ENABLED);
export const accountDeletionAvailable=Boolean(REVIEWED_DELETION_ENDPOINT && authEnvironment);
let recovery:ReturnType<typeof createAccountRecovery>|null=null;
let implicitRecoveryClient:ReturnType<typeof createClient>|null=null;
function recoveryClient(){
 if(!authEnvironment || authEnvironment.staging || authEnvironment.url!==AUTH_URL)return null;
 if(!implicitRecoveryClient){
  // Never replace the main app/guest session while consuming a recovery link.
  implicitRecoveryClient=createClient(authEnvironment.url,authEnvironment.key,{global:{fetch:async(url,init)=>{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
   try{return await fetch(url,{...init,signal:controller.signal,redirect:'error'});}finally{clearTimeout(timer);}
  }},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'bysi.recovery.memory-only'}});
 }
 return implicitRecoveryClient;
}
export function getRecovery(){
 const client=recoveryClient();
 if(!client || !authEnvironment)return null;
 if(!recovery) recovery=createAccountRecovery(client.auth,authEnvironment.url);
 return recovery;
}
export function getImplicitPasswordRecovery(){
 const client=recoveryClient();
 if(!client)return null;
 return createImplicitRecovery(client.auth);
}
export async function deleteAccountIdentity(owner:string,password:string,billing:AccountDeletionBilling,signal?:AbortSignal){
 if(!accountDeletionAvailable || !REVIEWED_DELETION_ENDPOINT || !supabase)return {success:false,message:'Account deletion is unavailable in this build. No deletion was requested.'};
 return requestAccountDeletion(supabase.auth,REVIEWED_DELETION_ENDPOINT,owner,password,billing,accountDeletionReceiptStore,fetch,{signal});
}
export async function checkAccountDeletionStatus(owner:string|null=null){
 if(!accountDeletionAvailable || !REVIEWED_DELETION_ENDPOINT)return {success:false,message:'Account deletion status is unavailable in this build.'};
 return checkDeletionStatus(REVIEWED_DELETION_ENDPOINT,owner,accountDeletionReceiptStore);
}
export async function enrollReceiptlessDeletionNotice(owner:string,signal?:AbortSignal){
 if(!accountDeletionAvailable || !REVIEWED_DELETION_ENDPOINT || !supabase)return {registered:false,uncertain:true,ownerId:owner};
 return ensureReceiptlessDeletionCapability(supabase.auth,REVIEWED_DELETION_ENDPOINT,owner,receiptlessDeletionCapabilityStore,fetch,{signal});
}
export async function checkReceiptlessAccountDeletionNotice(owner:string,signal?:AbortSignal){
 if(!accountDeletionAvailable || !REVIEWED_DELETION_ENDPOINT)return {deleted:false,uncertain:true,ownerId:owner};
 return checkReceiptlessDeletionNotice(REVIEWED_DELETION_ENDPOINT,owner,receiptlessDeletionCapabilityStore,fetch,{signal});
}
const deletionBackend=typeof REVIEWED_DELETION_ENDPOINT==='object'&&REVIEWED_DELETION_ENDPOINT?'normal-results-local-v1':'legacy';
const receiptPrefix=deletionBackend==='legacy'?'bysi.accountDeletion.receipt':`bysi.accountDeletion.${deletionBackend}.receipt`;
const receiptKey=(owner:string)=>`${receiptPrefix}.v1.${owner}`;
const receiptIndexKey=`${receiptPrefix}.index.v1`;
const practiceKeys=['cc.profile.v1','cc.sessions.v1','cc.sessions.v2','cc.custom.v1','cc.drills.v1','cc.reminder.v1','cc.challenge.v1','cc.freeze.v1','cc.consent.v1','cc.pilotProgress.v1','cc.scoredPracticeHistory.v1','cc.anonymousUserId.v1','cc.activePracticeSession.v1','cc.activeScenarioRun.v1','cc.archivedScenarioRuns.v1','cc.quarantinedScenarioRun.v1','cc.convertedLessonProgress.v1','cc.moduleCloseProgress.v1','cc.convertedCompletionPending.v1','cc.nativeJourneyStarted.v1','cc.devpro.v1','cc.devForceUnpaid.v1'];
const baselineReferenceKeys=['cc.sessions.v1','cc.sessions.v2','cc.activePracticeSession.v1','cc.activeScenarioRun.v1','cc.archivedScenarioRuns.v1','cc.quarantinedScenarioRun.v1','cc.convertedCompletionPending.v1'];
const ownerStorageKey=(owner:string)=>`${authEnvironment?.url??'local'}:${owner}`;
const ownerStoragePrefix=(storageOwner:string)=>`bysi.owner.v1:${encodeURIComponent(storageOwner)}:`;
const baselinePendingKey=(storageOwner:string)=>`bysi.accountDeletion.baselinePending.v1:${encodeURIComponent(storageOwner)}`;
const baselinePendingPrefix='bysi.accountDeletion.baselinePending.v1:';
async function cleanupSecureGuestContinuation(storageOwner:string){
 const {guestContinuationSecureStorage}=await import('./guestContinuationRuntime');
 const environment=JSON.stringify([authEnvironment?.url??'local',authEnvironment?.keychainService??'beforeyousayit.supabase']);
 const storage=await guestContinuationSecureStorage(environment);
 await storage.removeOwnedItem('current',storageOwner);
}
const parseActiveEnvelope=(raw:string,storageOwner:string|null):string[]=>{
 const value=JSON.parse(raw);
 if(value?.localGuestContinuation!==1)return [raw];
 if(typeof value.owner!=='string'||(storageOwner!==null&&value.owner!==storageOwner)||typeof value.value!=='string'
  ||(value.sourceSnapshot!==null&&typeof value.sourceSnapshot!=='string'))throw new Error('Invalid baseline continuation envelope');
 if(value.sourceSnapshot&&value.sourceSnapshot!==value.value){
  const snapshot=JSON.parse(value.sourceSnapshot);
  const current=JSON.parse(value.value);
  if(requireId(snapshot)!==requireId(current))throw new Error('Invalid baseline continuation envelope');
  return [value.value];
 }
 return [value.value];
};
const requireId=(value:unknown):string=>{
 if(!value||typeof value!=='object'||typeof (value as {id?:unknown}).id!=='string')throw new Error('Invalid baseline reference');
 return (value as {id:string}).id;
};
const collectBaselineIdsStrict=(raw:string|null,key:string,storageOwner:string|null):string[]=>{
 if(!raw)return [];
 const raws=key==='cc.activePracticeSession.v1'?parseActiveEnvelope(raw,storageOwner):[raw];
 const values=raws.map(value=>JSON.parse(value));
 const ids:string[]=[];
 for(const value of values){
 if(key==='cc.sessions.v1'||key==='cc.sessions.v2'){
  if(!Array.isArray(value))throw new Error('Invalid baseline session history');
  ids.push(...value.map(requireId));
  continue;
 }
 if(key==='cc.activePracticeSession.v1'){ids.push(requireId(value));continue;}
 if(key==='cc.activeScenarioRun.v1'||key==='cc.quarantinedScenarioRun.v1'){
  if(typeof value?.run?.id!=='string')throw new Error('Invalid baseline scenario run');
  ids.push(value.run.id);
  continue;
 }
 if(key==='cc.archivedScenarioRuns.v1'){
  if(!Array.isArray(value))throw new Error('Invalid baseline scenario archive');
  ids.push(...value.map(item=>{
   if(typeof item?.run?.id!=='string')throw new Error('Invalid baseline archived run');
   return item.run.id;
  }));
  continue;
 }
 if(key==='cc.convertedCompletionPending.v1'){
  const pendingIds=[value?.expectedActiveRevision?.runId,value?.record?.runId].filter((id):id is string=>typeof id==='string');
  if(pendingIds.length===0)throw new Error('Invalid baseline pending completion');
  ids.push(...pendingIds);
  continue;
 }
 }
 return [...new Set(ids)];
};
const ownerKeyParts=(key:string):{owner:string|null;practiceKey:string;malformedOwner:boolean}|null=>{
 const prefix='bysi.owner.v1:';
 if(!key.startsWith(prefix))return null;
 const rest=key.slice(prefix.length);
 const separator=rest.indexOf(':');
 if(separator<0)return {owner:null,practiceKey:'',malformedOwner:true};
 try{return {owner:decodeURIComponent(rest.slice(0,separator)),practiceKey:rest.slice(separator+1),malformedOwner:false};}
 catch{return {owner:null,practiceKey:rest.slice(separator+1),malformedOwner:true};}
};
type PendingBaselineReferences={ids:string[];quarantinedNames:string[];inventoryIncomplete:boolean};
const emptyPendingBaselineReferences=():PendingBaselineReferences=>({ids:[],quarantinedNames:[],inventoryIncomplete:false});
const readPendingBaselineReferences=(raw:string|null,storageOwner:string):PendingBaselineReferences=>{
 if(!raw)return emptyPendingBaselineReferences();
 const value=JSON.parse(raw);
 if(value?.version!==1||value.owner!==storageOwner||!Array.isArray(value.ids)||value.ids.some((id:unknown)=>typeof id!=='string'))throw new Error('Invalid pending baseline cleanup references');
 const quarantinedNames=value.quarantinedNames===undefined?[]:value.quarantinedNames;
 const inventoryIncomplete=value.inventoryIncomplete===undefined?false:value.inventoryIncomplete;
 if(!Array.isArray(quarantinedNames)||quarantinedNames.some((name:unknown)=>typeof name!=='string')||typeof inventoryIncomplete!=='boolean')throw new Error('Invalid pending baseline cleanup references');
 return {ids:value.ids,quarantinedNames,inventoryIncomplete};
};
const pendingOwnerFromKey=(key:string):{owner:string|null;malformed:boolean}|null=>{
 if(!key.startsWith(baselinePendingPrefix))return null;
 try{const owner=decodeURIComponent(key.slice(baselinePendingPrefix.length));return owner?{owner,malformed:false}:{owner:null,malformed:true};}
 catch{return {owner:null,malformed:true};}
};
async function cleanupOwnerBaselineAudio(storageOwner:string,storageKeys:readonly string[]){
 const {baselineFileName,deleteBaselineAudioStrict,listBaselineAudioFileNamesStrict}=await import('./baselineAudio');
 const ownerIds=new Set<string>();
 const foreignNames=new Set<string>();
 const pendingQuarantinedNames=new Set<string>();
 const blockers:string[]=[];
 const pendingKey=baselinePendingKey(storageOwner);
 let ownerPendingUnreadable=false;
 let pendingInventoryIncomplete=false;
 try{
  const pending=readPendingBaselineReferences(await AsyncStorage.getItem(pendingKey),storageOwner);
  for(const id of pending.ids)ownerIds.add(id);
  for(const name of pending.quarantinedNames)pendingQuarantinedNames.add(name);
  pendingInventoryIncomplete=pending.inventoryIncomplete;
 }catch{ownerPendingUnreadable=true;blockers.push('malformed-pending-baseline-references');}
 for(const fullKey of storageKeys){
  const pendingOwner=pendingOwnerFromKey(fullKey);
  if(pendingOwner===null)continue;
  if(pendingOwner.malformed){blockers.push('malformed-foreign-pending-baseline-key');continue;}
  if(pendingOwner.owner===storageOwner)continue;
  try{
   const pending=readPendingBaselineReferences(await AsyncStorage.getItem(fullKey),pendingOwner.owner!);
   for(const id of pending.ids)foreignNames.add(baselineFileName(id));
   for(const name of pending.quarantinedNames)foreignNames.add(name);
   if(pending.inventoryIncomplete)blockers.push('foreign-pending-inventory-incomplete');
  }
  catch{blockers.push('malformed-foreign-pending-baseline-references');}
 }
 for(const fullKey of storageKeys){
  const scoped=ownerKeyParts(fullKey);
  const practiceKey=scoped?.practiceKey??fullKey;
  if(scoped?.malformedOwner)blockers.push('malformed-owner-baseline-key');
  if(!baselineReferenceKeys.includes(practiceKey))continue;
  let ids:string[];
  try{ids=collectBaselineIdsStrict(await AsyncStorage.getItem(fullKey),practiceKey,scoped?.owner??null);}
  catch{blockers.push('malformed-baseline-reference');continue;}
  for(const id of ids){
   const name=baselineFileName(id);
   if(scoped?.owner===storageOwner)ownerIds.add(id);
   else foreignNames.add(name);
  }
 }
 const ownerByName=new Map<string,string[]>();
 for(const id of ownerIds){
  const name=baselineFileName(id);
  ownerByName.set(name,[...(ownerByName.get(name)??[]),id]);
 }
 let existing:string[]=[];
 try{existing=await listBaselineAudioFileNamesStrict();}
 catch{blockers.push('baseline-list-unconfirmed');}
 const inventoryIncomplete=pendingInventoryIncomplete||blockers.some(blocker=>blocker.startsWith('malformed')||blocker.endsWith('inventory-incomplete'));
 const quarantinedNames=new Set([...pendingQuarantinedNames].filter(name=>existing.includes(name)));
 const conflictNames=new Set<string>();
 for(const [name,ids] of ownerByName){
  if(!existing.includes(name))continue;
  if(inventoryIncomplete||ids.length>1||foreignNames.has(name)||pendingQuarantinedNames.has(name)){
   blockers.push('conflicting-baseline-reference');
   conflictNames.add(name);
   quarantinedNames.add(name);
   continue;
  }
  try{await deleteBaselineAudioStrict(ids[0]);}
  catch{blockers.push('baseline-delete-unconfirmed');}
 }
 let remaining:string[]=[];
 try{remaining=await listBaselineAudioFileNamesStrict();}
 catch{blockers.push('baseline-list-unconfirmed');}
 const remainingOwnerNames=new Set([...ownerByName.keys()].filter(name=>remaining.includes(name)));
 for(const name of remaining)if(!remainingOwnerNames.has(name)&&!foreignNames.has(name)){blockers.push('unknown-baseline-audio');quarantinedNames.add(name);}
 for(const name of pendingQuarantinedNames)if(remaining.includes(name))quarantinedNames.add(name);
 for(const name of conflictNames)if(remaining.includes(name))quarantinedNames.add(name);
 const pendingIds=[...ownerIds].filter(id=>remaining.includes(baselineFileName(id))||blockers.includes('conflicting-baseline-reference')||blockers.includes('malformed-baseline-reference')||blockers.includes('malformed-pending-baseline-references')||blockers.includes('baseline-delete-unconfirmed')||blockers.includes('baseline-list-unconfirmed'));
 if(blockers.length){
  if(ownerPendingUnreadable)return false;
  const raw=JSON.stringify({version:1,owner:storageOwner,ids:pendingIds.sort(),quarantinedNames:[...quarantinedNames].sort(),inventoryIncomplete});
  await AsyncStorage.setItem(pendingKey,raw);
  if(await AsyncStorage.getItem(pendingKey)!==raw)throw new Error('Pending baseline cleanup references were not saved');
  return false;
 }
 await AsyncStorage.removeItem(pendingKey);
 return true;
}
export function quarantineDeletedAccountOwner(owner:string){
 invalidateOwnerPracticeLeases(ownerStorageKey(owner));
 quarantineOwnerVoiceCache(ownerStorageKey(owner));
}
export async function cleanupDeletedAccountOwner(owner:string){
 if(!owner)throw new Error('Deleted account owner required');
 const storageOwner=ownerStorageKey(owner);
 invalidateOwnerPracticeLeases(storageOwner);
 await serializeStoreOperation(AsyncStorage,async()=>{
  const prefix=ownerStoragePrefix(storageOwner);
  const allKeys=await AsyncStorage.getAllKeys();
  const ownerKeys=allKeys.filter(key=>key.startsWith(prefix)).map(key=>key.slice(prefix.length));
  const keys=[...new Set([...ownerKeys,...practiceKeys])];
  const baselineComplete=await cleanupOwnerBaselineAudio(storageOwner,allKeys);
  await cleanupSecureGuestContinuation(storageOwner);
  // Remove/read back independently proven practice bytes before reporting an
  // unrelated unowned historical-voice blocker. Baseline references above remain
  // available until their strict cleanup succeeds, so retries do not lose targets.
  for(const key of keys)await AsyncStorage.removeItem(prefix+key);
  const remaining=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(prefix));
  if(remaining.length>0)throw new Error('Deleted account local cleanup was not confirmed');
  if(Platform.OS==='ios'||Platform.OS==='android')await createOwnerVoiceCache(await import('expo-file-system/legacy')).erase(storageOwner);
  if(!baselineComplete)throw new Error('Deleted account baseline cleanup is pending');
 });
}
const secureStore=()=>import('expo-secure-store');
const receiptOptions=(secure:typeof import('expo-secure-store'))=>({keychainAccessible:secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,requireAuthentication:false});
const parseReceipt=(raw:string|null):AccountDeletionReceipt|null=>{
 if(!raw)return null;
 const value=JSON.parse(raw);
 if(typeof value?.ownerId==='string' && /^[a-f0-9]{64}$/.test(value.secret) && /^[a-f0-9]{64}$/.test(value.digest))return value;
 throw new Error('Invalid deletion receipt');
};
export const accountDeletionReceiptStore={
 async load(owner:string):Promise<AccountDeletionReceipt|null>{const secure=await secureStore();return parseReceipt(await secure.getItemAsync(receiptKey(owner)));},
 async loadLatest():Promise<AccountDeletionReceipt|null>{const secure=await secureStore();const raw=await secure.getItemAsync(receiptIndexKey);if(!raw)return null;const index=JSON.parse(raw);if(typeof index?.latestOwnerId!=='string')throw new Error('Invalid deletion receipt index');return this.load(index.latestOwnerId);},
 async save(receipt:AccountDeletionReceipt){
  const secure=await secureStore();const options=receiptOptions(secure);
  const raw=JSON.stringify(receipt),index=JSON.stringify({latestOwnerId:receipt.ownerId});
  await secure.setItemAsync(receiptKey(receipt.ownerId),raw,options);
  if(await secure.getItemAsync(receiptKey(receipt.ownerId))!==raw)throw new Error('Deletion receipt was not saved');
  await secure.setItemAsync(receiptIndexKey,index,options);
  if(await secure.getItemAsync(receiptIndexKey)!==index)throw new Error('Deletion receipt index was not saved');
 }
};
export function createRuntimeDeletionJournal(){
 let storage:ReturnType<typeof createMigratingSecureSessionStorage>|null=null;
 return createReceiptlessDeletionJournal(async()=>{
  if(storage)return storage;
  const [secure,crypto]=await Promise.all([secureStore(),import('expo-crypto')]);
  if(!await secure.isAvailableAsync())throw new Error('Device secure storage unavailable');
  const scope=await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256,JSON.stringify(['receiptless-journal-v1',authEnvironment?.url??'local',authEnvironment?.keychainService??'beforeyousayit.supabase',...(deletionBackend==='legacy'?[]:[deletionBackend]) ]));
  const options={...receiptOptions(secure),keychainService:`bysi.deletion.journal.${scope}`};
  storage=createMigratingSecureSessionStorage({
   secure:{getItem:key=>secure.getItemAsync(key,options),setItem:(key,value)=>secure.setItemAsync(key,value,options),removeItem:key=>secure.deleteItemAsync(key,options)},
   legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},
   namespaceForKey:async()=>`bysi.deletion.journal.${scope}`,generation:()=>crypto.randomUUID().replaceAll('-',''),strictRead:true,strictCleanup:true,
  });
  return storage;
 });
}
export const receiptlessDeletionJournal=createRuntimeDeletionJournal();
export const receiptlessDeletionCapabilityStore=receiptlessDeletionJournal.capabilityStore;
export const isReceiptlessDeletionOwnerBlocked=receiptlessDeletionJournal.blocked;
