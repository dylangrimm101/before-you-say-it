import AsyncStorage from '@react-native-async-storage/async-storage';
// Recovery hint only, never proof of purchase or entitlement. Persist before
// opening Apple so a restart cannot silently start a second uncertain purchase.
const key=(id:string)=>`bysi.purchaseFirst.pending.v1:${encodeURIComponent(id)}`;
export const purchasePending={
 read:async(id:string)=>['1','deferred'].includes((await AsyncStorage.getItem(key(id)))??''),
 deferred:async(id:string)=>(await AsyncStorage.getItem(key(id)))==='deferred',
 mark:async(id:string)=>{await AsyncStorage.setItem(key(id),'1');},
 markDeferred:async(id:string)=>{await AsyncStorage.setItem(key(id),'deferred');},
 clear:async(id:string)=>{await AsyncStorage.removeItem(key(id));},
};
