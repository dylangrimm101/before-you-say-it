import {test,expect} from 'bun:test';
test('privacy separates server free-session recovery retention from local handoff expiry and provider policies',async()=>{
 const source=await Bun.file(`${import.meta.dir}/../app/privacy.tsx`).text();
 for(const disclosure of ['Free-session recovery','24-hour server session','scheduled cleanup','generated speech audio','spent-allocation record','not an immediate erasure guarantee','provider retention'])expect(source).toContain(disclosure);
});
