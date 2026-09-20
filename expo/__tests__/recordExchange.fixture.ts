import {plugin} from 'bun';
import {readFileSync} from 'node:fs';
import {recordTransitionSource} from './recordTransitionHarness';
process.env.BYSI_APP_FIRST_POSITIVE='1';
// Initialize WASM/SQL before the mounted harness freezes its UI clock.
const {recordExchangeBackend}=await import('./recordExchangeBackend');
const bridge=await recordExchangeBackend();
mockBridge();
function mockBridge(){
  // One synthetic bridge per process, shared only through a test module.
  const {mock}=require('bun:test');
  mock.module('./recordExchangeBridge',()=>({bridge}));
}
plugin({name:'joined-record-exchange',setup(build){
  build.onLoad({filter:/guestVisitMounted\.fixture\.ts$/},({path})=>{
    let source=recordTransitionSource(readFileSync(path,'utf8'));
    source=source.replace("Platform:{OS:'web',select:(v:any)=>v.web??v.default}","Platform:{OS:'ios',select:(v:any)=>v.ios??v.default}");
    if(process.argv.includes('native-timing')){
      source=source.replace('Date.now=()=>now;', 'Date.now=originalNow;');
      source=source.replace('useReducedMotion:()=>true','useReducedMotion:()=>false');
      source=source.replace('timing:()=>animation,','timing:()=>animation,spring:()=>animation,sequence:()=>animation,delay:()=>animation,');
      source=source.replaceAll('setTimeout(r,10)','setTimeout(r,1800)');
      source=source.replaceAll('await chooseTrack();',`await chooseTrack();
        for(let i=0;route?.pathname!=='/rehearse/[id]'&&i<100;i++)await act(async()=>{await new Promise(r=>setTimeout(r,50));});`);
      source=source.replace("await act(async()=>root.root.findByType('input').props.onChangeText('Synthetic colleague",`
        for(let i=0;root.root.findAllByType('input').length===0&&i<100;i++)await act(async()=>{await new Promise(r=>setTimeout(r,50));});
        await act(async()=>root.root.findByType('input').props.onChangeText('Synthetic colleague`);
      source=source.replace("const b=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label)&&!n.props.disabled);assert.ok(b,`enabled control: ${label}`);",`
        const find=()=>root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label)&&!n.props.disabled);
        let b=find();
        for(let i=0;!b&&i<100;i++){await act(async()=>{await new Promise(r=>setTimeout(r,50));});b=find();}
        assert.ok(b,\`enabled control: \${label}\`);`);
    }
    if(process.argv.includes('delayed-storage')){
      source=source.replaceAll('setTimeout(r,5)','setTimeout(r,100)');
      source=source.replace("mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));",`
        for(const key of ['getItem','setItem','removeItem','getAllKeys','multiRemove']){
          const original=(raw as any)[key];
          (raw as any)[key]=async(...args:any[])=>{await new Promise(r=>setTimeout(r,3));return original(...args);};
        }
        mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));`);
    }
    if(process.argv.includes('partner'))source=source.replaceAll("await press('Work')","await press('Partner or co-parent')");
    const replace=(a:string,b:string)=>{if(!source.includes(a))throw Error('Joined record seam changed: '+a.slice(0,60));source=source.replace(a,b);};
    if(process.argv.includes('context-drift')){
      replace("await press('Stop and review your line');\n        assert.equal(counterpartCalls,1",`
        await press('Stop and review your line');
        // Model the observed class of failure: UI/store context changes AFTER
        // the successful Record check, before second-turn approval. No wire tampering.
        await act(async()=>{await store.saveActivePracticeSession({...store.activePracticeSession,
          normalFreeContract:{...store.activePracticeSession.normalFreeContract,success_target:'Synthetic changed display goal'},updatedAt:Date.now()});});
        assert.equal(counterpartCalls,1`);
      if(process.argv.includes('expect-context-rejection')){
        replace("assert.equal(counterpartCalls,2);assert.equal(playbackCount,2);",`
          assert.equal(bridge.responses.at(-1).status,422);
          assert.equal(bridge.responses.at(-1).code,'unverified_exchange');
          assert.equal(playbackCount,1);
          await act(async()=>root.unmount());client.clear();Date.now=originalNow;await bridge.close();
          console.log('PASS reproduced context drift rejection');process.exit(0);
          assert.equal(counterpartCalls,2);assert.equal(playbackCount,2);`);
      }
    }
    replace("let recovery='start';", "const {bridge}=await import('./recordExchangeBridge');let recovery='start';");
    replace("return Response.json(rejectRecovery?{status:'context_mismatch'}:checkpointState??{status:recovery,used:false});", "return bridge.request(op,body);");
    replace("const {bysiContract,fallbackCustomScenario:localScenario}=await import('../lib/ai');", "const {bysiContract,fallbackCustomScenario:localScenario,nextCounterpartTurn:actualCounterpart,generateDebrief:actualDebrief}=await import('../lib/ai');");
    const start=source.indexOf("mock.module('@/lib/ai',");const end=source.indexOf('\nconst Host=',start);
    if(start<0||end<0)throw Error('Missing AI seam');
    source=source.slice(0,start)+`mock.module('@/lib/ai',()=>({bysiContract,fallbackCustomScenario:localScenario,nextCounterpartTurn:async(...args:any[])=>{counterpartCalls++;return actualCounterpart(...args);},generateDebrief:async(...args:any[])=>{analysisCalls++;return actualDebrief(...args);}}));`+source.slice(end);
    replace("return turn==='opener'?'Synthetic spoken opener, let us choose a task.':'Synthetic spoken reply, which one comes first?';", "return bridge.recording(turn);");
    replace("playbackCount++;options?.onPlaybackStart?.();", "await bridge.play(_text);playbackCount++;options?.onPlaybackStart?.();");
    replace("assert.equal(counterpartCalls,2);assert.equal(playbackCount,2);", `
      if(process.argv.includes('provider-failure')){
        assert.equal(bridge.responses.at(-1).status,502);
        assert.equal(bridge.responses.at(-1).code,'failed');
        assert.equal(playbackCount,1);
        assert.equal(bridge.transcriptionCount,2);
        assert.ok(text().includes('502'));
        assert.equal(store.activePracticeSession.freeRehearsalTurns[2].text,'Synthetic approved reply, can we choose the first task?');
        const retry=root.root.findAllByType('button').find((n:any)=>n.props.accessibilityLabel==='Retry sending');
        assert.ok(retry);
        // Two taps before a render must admit only one provider retry.
        await act(async()=>{await Promise.all([retry.props.onPress(),retry.props.onPress()]);});
        await act(async()=>{await new Promise(r=>setTimeout(r,1800));});
        assert.equal(counterpartCalls,3);
        assert.equal(bridge.closeProviderCalls,2);
        assert.equal(bridge.transcriptionCount,2,'retry must not require rerecording');
        assert.equal(store.activePracticeSession.freeRehearsalTurns[2].text,'Synthetic approved reply, can we choose the first task?');
      }else if(process.argv.includes('mismatch')){
        assert.equal(bridge.responses.at(-1).status,422);
        assert.equal(bridge.responses.at(-1).code,'unverified_exchange');
        assert.equal(playbackCount,1);
        assert.ok(text().includes('R-EXCHANGE'));
        const retry=root.root.findAllByType('button').find((n:any)=>n.props.accessibilityLabel==='Check and retry');
        assert.ok(retry);assert.equal(retry.props.containerStyle.minHeight,52);assert.equal(retry.props.containerStyle.flex,undefined);
        assert.equal(store.activePracticeSession.freeRehearsalTurns[2].text,'Synthetic approved reply, can we choose the first task?');
        const beforeCheck=bridge.responses.length;
        await press('Check and retry');
        assert.equal(bridge.responses[beforeCheck].operation,'session','server verification precedes another generation');
        if(process.argv.includes('blocked-check')){
          assert.equal(bridge.responses.length,beforeCheck+1,'a failed check must not dispatch generation');
          assert.equal(counterpartCalls,2);assert.equal(playbackCount,1);
          assert.ok(text().includes('R-EXCHANGE'));
          assert.equal(store.activePracticeSession.freeRehearsalTurns[2].text,'Synthetic approved reply, can we choose the first task?');
          await act(async()=>root.unmount());client.clear();Date.now=originalNow;await bridge.close();
          console.log('PASS connected Record exchange');process.exit(0);
        }
        assert.equal(counterpartCalls,3);
      }else assert.equal(counterpartCalls,2);
      assert.equal(playbackCount,2,JSON.stringify(bridge.responses));`);
    replace("console.log('PASS Record transition');process.exit(0);", "await bridge.close();console.log('PASS connected Record exchange');process.exit(0);");
    return {contents:source,loader:'ts'};
  });
}});
await import('./guestVisitMounted.fixture');
