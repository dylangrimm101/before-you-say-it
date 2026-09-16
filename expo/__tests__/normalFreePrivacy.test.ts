import {test,expect} from 'bun:test';
test('privacy separates server free-session recovery retention from local handoff expiry and provider policies',async()=>{
 const source=await Bun.file(`${import.meta.dir}/../app/privacy.tsx`).text();
 for(const disclosure of ['Free-session recovery','30 days of inactivity','renewed for ordinary practice','generated speech audio','account deletion erases saved result content','not an immediate erasure guarantee','provider retention'])expect(source).toContain(disclosure);
 for(const rejected of ['24-hour server session','prevent another free allocation','remaining allowance','This is not full data erasure'])expect(source).not.toContain(rejected);
});
