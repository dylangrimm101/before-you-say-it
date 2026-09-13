import {test,expect} from 'bun:test';
import * as runtime from '../lib/guestContinuationRuntime';
test('web advertises same-process only without touching native secure storage',async()=>{
 expect(typeof runtime.createGuestContinuationRuntime).toBe('function');
 const host={getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{},getAllKeys:async()=>[]};
 const c=runtime.createGuestContinuationRuntime(host,'web','production');
 expect(c.durable).toBe(false);expect(await c.restore({} as any)).toBe(false);
});
