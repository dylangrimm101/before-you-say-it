// Reuse the real Auth/Store/Onboarding/Rehearse harness, replacing only its
// transport/recorder seams. No app-source transformation and no live services.
export function recordTransitionSource(source:string):string {
    function replace(before:string,after:string){
      if(!source.includes(before))throw Error('Record fixture seam changed');
      source=source.replace(before,after);
    }
    replace("let recovery='start';const requests:any[]=[];",`let recovery='start';const requests:any[]=[];
      let checkpointState:any=null;let rejectRecovery=false;let cancelCount=0;
      let recorderStatus='idle';let playbackCount=0;`);
    replace('return Response.json({status:recovery,used:false});',`return Response.json(rejectRecovery?{status:'context_mismatch'}:checkpointState??{status:recovery,used:false});`);
    replace('nextCounterpartTurn:async()=>{counterpartCalls++;',`nextCounterpartTurn:async(...args:any[])=>{counterpartCalls++;
      const reply=counterpartCalls===1?'Synthetic counterpart: I still need the current handoff.':'Synthetic counterpart close: I can try, but the deadline remains.';
      const contract=args[8]??bysiContract(args[0],args[3],args[4],args[6],args[1]);
      const users=args[2].filter((t:any)=>t.role==='user');
      checkpointState={status:'resume',sessionId:'synthetic-session',generation:0,phase:counterpartCalls===1?'pushback':'close',
        audio:{text:reply,role:'hope',turn:counterpartCalls===1?'pushback':'close'},
        checkpoint:{revision:counterpartCalls,contract,transcript:{user_turn_1:users[0].text,counterpart_pushback:counterpartCalls===1?reply:args[2][1].text,...(users[1]?{user_turn_2:users[1].text,counterpart_close:reply}:{})}}};
    `);
    replace("useDictation:()=>dictation",`useDictation:()=>{
      const [status,setStatus]=React.useState('idle');
      return {...dictation,status,requestPermission:async()=>true,
        start:async()=>{recorderStatus='recording';setStatus('recording');return true;},
        stop:async(turn:string)=>{recorderStatus='idle';setStatus('idle');return turn==='opener'?'Synthetic spoken opener, let us choose a task.':'Synthetic spoken reply, which one comes first?';},
        cancel:async()=>{cancelCount++;recorderStatus='idle';setStatus('idle');}};
    }`);
    replace('MicControl:Host',"MicControl:(p:any)=>React.createElement('button',p)");
    replace('speak:async()=>{}',`speak:async(_text:any,_persona:any,options:any)=>{playbackCount++;options?.onPlaybackStart?.();return 'played';}`);
    replace("await press('Type this turn instead');",`await press('Allow microphone');
      await press('Record your line');await press('Stop and review your line');
      assert.equal(counterpartCalls,0);
      const openerApproval=root.root.findAllByType('button').find((n:any)=>n.findAll((c:any)=>c.type==='host'&&c.children.includes('Use this opener')).length>0);
      assert.ok(openerApproval);await act(async()=>{await openerApproval.props.onPress();});
      await act(async()=>{await new Promise(r=>setTimeout(r,10));});
      assert.equal(counterpartCalls,1);assert.equal(playbackCount,1);`);
    replace("['Synthetic opener, let us choose a task.','Synthetic reply, which one comes first?']","[]");
    replace("assert.equal(counterpartCalls,2,'both learner turns reach actual screen generation');",`
      const before=requests.filter(r=>r.op==='recover').length;
      await press('Record your line');
      assert.equal(recorderStatus,'recording');
      assert.equal(requests.filter(r=>r.op==='recover').length-before,1,'successful Record check must not schedule another check when it publishes its own contract');
      const hasText=(value:string)=>root.root.findAll((n:any)=>n.type==='host'&&n.children.includes(value)).length>0;
      assert.equal(hasText('Practice unavailable'),false);
      if(process.argv.includes('reject')){
        // Independently supplied context must still be checked, not trusted just
        // because a microphone is running. Rejection must release that mic.
        rejectRecovery=true;
        await act(async()=>{await store.saveActivePracticeSession({...store.activePracticeSession,normalFreeContract:undefined});});
        await act(async()=>{await new Promise(r=>setTimeout(r,10));});
        assert.equal(requests.filter(r=>r.op==='recover').length-before,2);
        assert.equal(hasText('Practice unavailable'),true);
        assert.equal(recorderStatus,'idle');assert.equal(cancelCount,1);
        assert.equal(hasText('R-CONTEXT'),true);
      }else{
        await press('Stop and review your line');
        assert.equal(counterpartCalls,1,'transcription waits for explicit approval');
        const edit=root.root.findAllByType('input').find((n:any)=>n.props.accessibilityLabel==='Your line, ready to send');
        await act(async()=>edit.props.onChangeText('Synthetic approved reply, can we choose the first task?'));
        const approve=root.root.findAllByType('button').find((n:any)=>n.findAll((c:any)=>c.type==='host'&&c.children.includes('Use this reply')).length>0);
        assert.ok(approve);await act(async()=>{await approve.props.onPress();});
        await act(async()=>{await new Promise(r=>setTimeout(r,10));});
        assert.equal(counterpartCalls,2);assert.equal(playbackCount,2);
        assert.equal(store.activePracticeSession.freeRehearsalTurns[2].text,'Synthetic approved reply, can we choose the first task?');
        assert.equal(hasText('Practice unavailable'),false);
        await press('Review complete transcript');await press('Approve transcript');
        for(let i=0;i<30&&!store.activePracticeSession.sharedResult;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
        assert.ok(store.activePracticeSession.sharedResult,'second spoken turn reaches approved result');
        params={id};await mount(Debrief);
        assert.equal(hasText('Practice unavailable'),false);
      }
      await act(async()=>root.unmount());client.clear();Date.now=originalNow;
      console.log('PASS Record transition');process.exit(0);
    `);
    if(process.argv.includes('voice-failure')){
      replace("mock.module('@/lib/voice',()=>({",`let voicePhase='idle';const voiceListeners=new Set<()=>void>();
        const publishVoice=(phase:string)=>{voicePhase=phase;for(const notify of voiceListeners)notify();};
        mock.module('@/lib/voice',()=>({`);
      replace("useSpeech:()=>({phase:'idle',canReplay:false})",`useSpeech:()=>({phase:React.useSyncExternalStore((notify:any)=>{voiceListeners.add(notify);return()=>voiceListeners.delete(notify);},()=>voicePhase),canReplay:true})`);
      replace("playbackCount++;options?.onPlaybackStart?.();return 'played';",`playbackCount++;
        if(playbackCount===2){publishVoice('failed');options?.onPlaybackUnavailable?.();return 'failed';}
        options?.onPlaybackStart?.();return 'played';`);
      replace("stopSpeech:async()=>{}", "stopSpeech:async()=>{throw Error('Synthetic native cleanup failure');}");
      replace("replaySpeech:async()=>{}", "replaySpeech:async()=>{playbackCount++;publishVoice('idle');return 'played';}");
      replace("await press('Review complete transcript');await press('Approve transcript');",`
        assert.ok(hasText('Keep reading'),'second audio failure has a reading escape');
        const pressVoice=async(label:string)=>{
          const button=root.root.findAllByType('button').find((n:any)=>n.findAll((c:any)=>c.type==='host'&&c.children.includes(label)).length>0);
          assert.ok(button);await act(async()=>{await button.props.onPress();});
        };
        if(process.argv.includes('voice-retry')){
          await pressVoice('Try voice again');assert.equal(playbackCount,3);
          await press('Review complete transcript');
        }else{
          await pressVoice('Keep reading');
        }
        assert.equal(counterpartCalls,2,'audio recovery never regenerates the conversation');
        await press('Approve transcript');`);
    }
    return source;
}
