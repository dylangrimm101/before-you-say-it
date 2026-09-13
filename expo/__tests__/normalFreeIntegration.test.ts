import {test,expect} from 'bun:test';import {spawnSync} from 'node:child_process';
for(const [file,args] of [
 ['normalFreeMountedJoined.generated.fixture.ts',[]],['normalFreeMountedJoined.generated.fixture.ts',['positive']],['normalFreeMountedJoined.generated.fixture.ts',['recovery']],
 ['normalFreeRouting.fixture.ts',[]],['normalFreeVoice.fixture.ts',[]],['normalFreeJoined.fixture.ts',[]],['normalFreeJoined.fixture.ts',['positive']],['normalFreeRecoveryUI.generated.fixture.ts',[]],['normalFreeTerminalUI.generated.fixture.ts',[]],
] as [string,string[]][]){test('normal registered free integration: '+file+' '+args.join(' '),()=>{
 const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,...args],{cwd:new URL('..',import.meta.url).pathname,env:process.env,encoding:'utf8',timeout:120000});
 if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);expect(r.status).toBe(0);
},130000);}
