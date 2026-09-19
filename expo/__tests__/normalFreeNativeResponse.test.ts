import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['limited','allowed'])test(`native Response compatibility for ${mode} guest visit`,()=>{
 const result=spawnSync(process.execPath,['__tests__/normalFreeNativeResponse.fixture.ts',mode],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:20000});
 expect({status:result.status,stderr:result.stderr}).toEqual({status:0,stderr:''});
 expect(result.stdout).toContain('PASS locked React Native Response');
},25000);

test('entry omits the long retention paragraph while privacy retains disclosures',async()=>{
 const entry=await Bun.file(import.meta.dir+'/../app/entry.tsx').text();
 const privacy=await Bun.file(import.meta.dir+'/../app/privacy.tsx').text();
 expect(entry).not.toContain('Guest practice lasts for this visit');
 expect(privacy).toContain('starting fresh does not reset usage limits');
});
