import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, SvgXml } from 'react-native-svg';
import { Backdrop, tap } from '@/components/ui';
import { C, font } from '@/constants/theme';
import { welcomeMark } from '@/constants/welcomeMark';
import { practiceGraph } from '@/constants/practiceGraph';
import { checkmarkGhost } from '@/constants/checkmarkGhost';
import { CTX, DIFF, chooseAnswer, nextAnswerScreen, recognitionOptions, suggestedFocus, type Answers, type AnswerScreen } from '@/lib/answerFirst';

export type Confirmation = 'ready' | 'pending' | 'cancelled' | 'failed' | 'confirmed';
export interface AnswerFirstProps {
  initialAnswers: Answers;
  initialScreen?: AnswerScreen;
  authenticated: boolean;
  purchaseFirst?: boolean;
  accountRequired?: boolean;
  access: boolean;
  offer: { available: boolean; loading: boolean; renewal: string; trial: boolean };
  confirmation: Confirmation;
  error?: string;
  reminder?: string;
  onSave: (answers: Answers) => Promise<void>;
  onAccount: (mode: 'signup' | 'login', answers: Answers) => Promise<void>;
  onBuy: () => Promise<void>;
  onRestore: () => Promise<void>;
  onRecoverPurchase?: () => Promise<void>;
  onCheckAccess: () => void;
  onPractice: (answers: Answers) => void;
  onLessons: () => void;
  onPrivacy: () => void;
  onTerms: () => void;
}
const ease = Easing.bezier(.22,.9,.28,1);
export function AnswerButton({ label, onPress, disabled = false, secondary = false, reduced = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; reduced?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => Animated.timing(scale, { toValue, duration: reduced ? 0 : 110, easing:ease, useNativeDriver:true }).start();
  return <Animated.View style={{ transform:[{scale}] }}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={() => animate(.972)} onPressOut={() => animate(1)} style={({ pressed }) => [s.button, secondary && s.secondary, disabled && s.disabled, pressed && !disabled && { opacity:.94 }]}><Text style={[s.buttonText, (secondary || disabled) && s.secondaryText]}>{label}</Text></Pressable></Animated.View>;
}
function Days({ reduced }: { reduced: boolean }) {
  const values = useRef(Array.from({ length:7 }, () => new Animated.Value(reduced ? 1 : 0))).current;
  useEffect(() => {
    if (reduced) { values.forEach(v => v.setValue(1)); return; }
    const animation = Animated.stagger(110, values.map(v => Animated.timing(v, { toValue:1, duration:320, delay:120, easing:ease, useNativeDriver:true })));
    animation.start(); return () => animation.stop();
  }, [reduced, values]);
  return <View style={s.days}>{values.map((v,i) => <Animated.View key={i} style={[s.day,{opacity:v.interpolate({inputRange:[0,1],outputRange:[.35,1]}),transform:[{scaleX:v}]}]} />)}</View>;
}
function Timeline({ rows }: { rows: [string,string][] }) {
  return <View>{rows.map(([label,body],i) => <View key={label} style={s.timelineRow}><View style={s.rail}><View style={[s.dot, i === 0 && s.dotOn]} />{i < rows.length-1 && <View style={s.railLine}/>}</View><View style={s.timelineCopy}><Text style={s.eyebrow}>{label}</Text><Text style={s.body}>{body}</Text></View></View>)}</View>;
}
export function AnswerFirstOnboarding(p: AnswerFirstProps) {
  const [screen,setScreen] = useState<AnswerScreen>(p.initialScreen ?? 'welcome');
  const [answers,setAnswers] = useState(p.initialAnswers);
  const [history,setHistory] = useState<AnswerScreen[]>([]);
  const [strokes,setStrokes] = useState<string[]>([]);
  const [drawing,setDrawing] = useState(false);
  const [reduced,setReduced] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [localError,setLocalError] = useState('');
  const [busy,setBusy] = useState(false);
  const transitionLock = useRef(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrance = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const f = suggestedFocus(answers);
  const question = screen === 'q1' ? { key:'diff' as const, title:'What would you like to feel easier?', help:'Choose one place to start. You can work on other skills later.', options:DIFF }
    : screen === 'q2' ? { key:'ctx' as const, title:'Where would you most like this to feel easier?', help:'We’ll use this to suggest a place to start practicing.', options:CTX }
    : screen === 'q3' ? { key:'rec' as const, title:'Which sounds most like you?', help:'Choose the one you’d most like to work on first.', options:recognitionOptions(answers) } : null;
  const go = (next: AnswerScreen) => { if (advance.current) clearTimeout(advance.current); transitionLock.current=false; setHistory(h => [...h,screen]); setScreen(next); setLocalError(''); };
  const back = () => {
    if (busy || p.confirmation === 'pending') return;
    if (advance.current) clearTimeout(advance.current);
    transitionLock.current=false;
    const h = [...history]; let previous = h.pop(); if (previous === 'building') previous=h.pop();
    setHistory(h); setScreen(previous ?? (screen === 'confirm' || screen === 'setup' ? 'offer' : 'welcome')); setLocalError('');
  };
  useEffect(() => {
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if(active)setReduced(value); });
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);
    return () => {active=false;sub.remove();if(advance.current)clearTimeout(advance.current);};
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({y:0,animated:false});
    entrance.setValue(reduced ? 1 : 0);
    const animation=Animated.timing(entrance,{toValue:1,duration:reduced?0:320,easing:ease,useNativeDriver:true});animation.start();return()=>animation.stop();
  }, [screen,reduced,entrance]);
  useEffect(() => {
    if(screen!=='building')return;
    const start=Date.now();setElapsed(reduced?7000:0);
    const interval=reduced?undefined:setInterval(()=>setElapsed(Math.min(7000,Date.now()-start)),80);
    const timer=setTimeout(()=>{setHistory(h=>[...h,'building']);setScreen('result');},reduced?900:7500);
    return()=>{clearInterval(interval);clearTimeout(timer);};
  },[screen,reduced]);
  const pick = (key: keyof Answers,id:string) => {
    if(transitionLock.current)return;
    transitionLock.current=true;
    const next=chooseAnswer(answers,key,id);setAnswers(next);
    // Copy primitives before any deferred work: never retain native events.
    advance.current=setTimeout(()=>go(nextAnswerScreen(screen,next)),reduced?0:260);
  };
  const account = async(mode:'signup'|'login') => { if(transitionLock.current)return;transitionLock.current=true;setBusy(true);try{await p.onAccount(mode,answers);}catch{setLocalError('Your answers are still here. We couldn’t open account setup. Please try again.');}finally{transitionLock.current=false;setBusy(false);} };
  useEffect(()=>{if(p.initialScreen)setScreen(p.initialScreen);},[p.initialScreen]);
  useEffect(()=>{if(p.purchaseFirst&&p.accountRequired)setScreen('account');},[p.purchaseFirst,p.accountRequired]);
  const primary = async() => {
    if(busy || transitionLock.current)return;
    if(screen==='commit' && !strokes.length)return;
    if(screen==='setup'){if(p.access)p.onPractice(answers);return;}
    if(screen==='confirm'){
      if(p.access){go('setup');return;}
      if(p.purchaseFirst&&p.accountRequired){go('account');return;}
      if(p.confirmation==='pending')return;
      if(p.confirmation==='ready'){await p.onBuy();return;}
      go('offer');return;
    }
    if(screen==='offer') {
      if(p.access){go('setup');return;}
      setBusy(true);
      try {await p.onSave(answers);go(p.purchaseFirst||p.authenticated?'confirm':'account');}
      catch{setLocalError('We couldn’t preserve your answers. Please try again.');}
      finally{setBusy(false);}return;
    }
    if(screen==='commit')tap('light');
    go(nextAnswerScreen(screen,answers));
  };
  const point=(e:GestureResponderEvent)=>`${Math.round(e.nativeEvent.locationX)},${Math.round(e.nativeEvent.locationY)}`;
  const labels: Partial<Record<AnswerScreen,string>>={welcome:'Get started',learn:'I can learn this',motive:'Continue',commit:'I’m ready',result:'See how the trial works',trial:'Continue',remind:'Continue',offer:p.access?'Continue to my practice':p.offer.trial?'Start my 7-day free trial':'Continue to subscription',confirm:p.access?'Start my first lesson':p.confirmation==='pending'?'Waiting for confirmation':p.confirmation==='ready'?'Confirm with Apple':'Back to the offer',setup:'Start my first lesson'};
  const phase=['welcome','learn','motive','commit','q1','q2','q3','building'].includes(screen)?0:screen==='result'?1:screen==='setup'?3:2;
  const compactScroll=height<800||fontScale>1.15;
  const footerDisabled=busy||(['result','trial','remind','offer'].includes(screen)&&p.offer.loading)||(screen==='commit'&&!strokes.length)||(screen==='offer'&&!p.access&&!p.offer.available)||(screen==='confirm'&&!p.access&&p.confirmation==='pending')||(screen==='setup'&&!p.access);
  const purchaseTitle=p.access?'Confirm your trial with Apple.':p.confirmation==='pending'?'Waiting for Apple.':p.confirmation==='cancelled'?'No trial started.':p.confirmation==='failed'?'Apple couldn’t confirm that.':'Confirm your subscription with Apple.';
  return <View style={s.root}><Backdrop/>
    {screen!=='welcome'?<View style={[s.header,{paddingTop:insets.top+4}]}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} disabled={busy||p.confirmation==='pending'} style={({pressed})=>[s.back,pressed&&s.pressed]}><Text style={s.backText}>‹</Text></Pressable><View style={s.progress}>{[0,1,2,3].map(i=><View key={i} style={[s.segment,{backgroundColor:i<phase?C.purple:i===phase?`${C.purple}8C`:C.line}]}/>)}</View><Text style={s.phase}>{['QUESTIONS','YOUR FOCUS','ACCESS','PRACTICE'][phase]}</Text></View>:<View style={{height:insets.top}}/>}
    <ScrollView ref={scroll} testID={`answer-screen-${screen}`} bounces={screen!=='commit'} scrollEnabled={!drawing&&(compactScroll||(!question&&screen!=='building'&&screen!=='trial'))} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[s.page,{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}]}>
      {screen==='offer'&&!p.offer.available&&!p.offer.loading&&<AnswerButton secondary reduced={reduced} label="Retry store setup" onPress={p.onCheckAccess}/>}
      {screen==='confirm'&&!p.authenticated&&!p.access&&p.purchaseFirst&&p.onRecoverPurchase&&['pending','failed','cancelled'].includes(p.confirmation)&&<View style={s.card}><Text style={s.note}>Still stuck? Restore first, then review this same subscription with Apple. Apple may show a purchase confirmation if no active subscription is found. A deferred payment must finish with Apple; we won’t retry it.</Text><AnswerButton secondary reduced={reduced} label="Review purchase with Apple" onPress={()=>void p.onRecoverPurchase?.()}/></View>}
      {screen==='welcome'&&<View style={[s.center,s.welcome]}><SvgXml xml={welcomeMark} width={176} height={88}/><Text style={s.welcomeTitle}>Build the qualities of world-class communicators.</Text><Text style={[s.lede,s.centerText]}>Learn to communicate with Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.</Text></View>}
      {screen==='learn'&&<View style={s.center}><Text style={s.titleLarge}>Communication is a skill you can build.</Text><Text style={s.body}>Putting your thoughts into words. Asking for what you need. Staying clear when a conversation gets difficult.</Text><Text style={[s.body,{color:C.text}]}>These are skills you can learn and practice, one conversation at a time.</Text></View>}
      {screen==='motive'&&<View style={s.center}><Text style={s.quote}>“The way we communicate with others and with ourselves ultimately determines the quality of our lives.”</Text><Text style={s.body}>Tony Robbins</Text></View>}
      {screen==='commit'&&<><Text style={s.title}>Make a commitment to yourself.</Text><View style={s.card}><Text style={s.pledge}>“I’ll make time to practice expressing myself clearly and listening with care.”</Text><Text style={s.help}>Start with one skill. Build from there.</Text></View><Text style={s.eyebrow}>SEAL IT BY DRAWING A CHECK MARK</Text><View testID="commitment-pad" accessibilityLabel="Draw any check mark to commit" style={[s.pad,strokes.length>0&&{borderColor:C.purple}]} onResponderTerminationRequest={()=>false} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>{const pt=point(e);setDrawing(true);setStrokes(v=>[...v,pt+' '+pt]);}} onResponderMove={e=>{const pt=point(e);if(drawing)setStrokes(v=>v.map((line,i)=>i===v.length-1?line+' '+pt:line));}} onResponderRelease={()=>setDrawing(false)} onResponderTerminate={()=>setDrawing(false)}><Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">{strokes.map((pts,i)=><Polyline key={i} points={pts} fill="none" stroke={C.purple} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"/>)}</Svg>{!strokes.length?<View pointerEvents="none" style={s.ghost}><SvgXml xml={checkmarkGhost} width={120} height={90}/></View>:<Pressable accessibilityRole="button" accessibilityLabel="Clear commitment drawing" onPress={()=>{setStrokes([]);setDrawing(false);}} style={({pressed})=>[s.clear,pressed&&s.pressed]}><Text style={s.body}>×</Text></Pressable>}</View></>}
      {question&&<View style={s.questions}><Text style={s.questionTitle}>{question.title}</Text><Text style={s.help}>{question.help}</Text><View style={s.options}>{question.options.map(o=><Pressable key={o.id} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{selected:answers[question.key]===o.id}} onPress={()=>pick(question.key,o.id)} style={({pressed})=>[s.option,answers[question.key]===o.id&&{borderColor:C.purple},pressed&&s.pressed]}><Text style={s.optionLabel}>{o.label}</Text><View style={[s.radio,answers[question.key]===o.id&&s.radioOn]}>{answers[question.key]===o.id&&<Text style={s.check}>✓</Text>}</View></Pressable>)}</View></View>}
      {screen==='building'&&<View style={s.center}><Text style={s.title}>Building your practice plan.</Text><Text style={s.body}>{elapsed<3500?'One skill first. The rest builds on it.':'Almost there.'}</Text><View style={s.buildRows}>{['Choosing the first skill to train','Finalizing your report'].map((label,i)=>{const pct=Math.round(Math.max(0,Math.min(1,(elapsed-i*3500)/3500))*100);return <View key={label} style={s.buildRow}><View style={s.between}><Text style={[s.buildLabel,pct===0&&{color:C.dim}]}>{label}</Text><Text style={s.figure}>{pct===100?'✓':`${pct}%`}</Text></View><View style={s.buildTrack}><View style={[s.buildFill,{width:`${pct}%`}]}/></View></View>;})}</View></View>}
      {screen==='result'&&<><Text style={s.eyebrow}>YOUR SUGGESTED STARTING FOCUS</Text><Text style={s.title}>{f.headline}</Text><View style={s.card}><Text style={s.pledge}>{f.recognition}</Text><Text style={s.help}>{f.context.label}</Text><Text style={s.body}>{f.rec}</Text></View>{!!f.after&&<View style={s.sample}><Text style={s.eyebrow}>A SMALL SHIFT TO TRY</Text><Text style={s.body}>{f.before}</Text><Text style={[s.pledge,{color:C.purple}]}>{f.after}</Text></View>}<View accessible accessibilityLabel="Illustration: with practice rises; the same ask repeats without practice."><Text accessibilityRole="header" style={s.eyebrow}>WHAT PRACTICE CAN CHANGE</Text><SvgXml xml={practiceGraph} width="100%" height={230} preserveAspectRatio="xMidYMid meet"/><View style={s.between}><Text style={s.eyebrow}>TODAY</Text><Text style={s.eyebrow}>WITH PRACTICE</Text></View></View><Text style={s.body}>In practice, you’ll say it in your own words, hear a response, and try again with feedback on your attempt.</Text><Text style={[s.note,{fontStyle:'italic'}]}>Suggested from your answers. We haven’t assessed your speaking.</Text></>}
      {screen==='trial'&&<><Text style={s.eyebrow}>{p.offer.trial?'YOUR 7-DAY FREE TRIAL':'YOUR PRACTICE SUBSCRIPTION'}</Text><Text style={s.titleLarge}>{p.offer.trial?'Try BYSI free for 7 days.':'Build your practice, one conversation at a time.'}</Text><Text style={s.lede}>{p.offer.trial?`Full access. No charge today. Then ${p.offer.renewal} unless cancelled.`:p.offer.available?`${p.offer.renewal}. Review the store terms before confirming.`:'Checking your store offer. Pricing and eligibility must be confirmed before checkout.'}</Text><View style={s.trialHero}><View style={s.heroRow}><Text style={s.seven}>{p.offer.trial?'7':'1'}</Text><Text style={s.heroWords}>{p.offer.trial?'days\nfree':'place to\npractice'}</Text></View>{p.offer.trial&&<Days reduced={reduced}/>}</View></>}
      {screen==='remind'&&<><Text style={s.eyebrow}>NO SURPRISE CHARGE</Text><Text style={s.titleLarge}>{p.offer.trial?'We’ll remind you 2 days before your free trial ends.':'You control whether your subscription renews.'}</Text><Text style={s.lede}>{p.offer.trial?'You’ll have time to decide whether you want to continue.':'Review the store price before you confirm.'}</Text><View style={s.timelineSpace}><Timeline rows={p.offer.trial?[['AFTER YOU CONFIRM','Your 7-day free trial begins.'],['2 DAYS BEFORE IT ENDS','We’ll schedule a notification on this device after your purchase is confirmed.'],['TRIAL END','Your subscription renews at the store price unless you cancel before the trial ends.']]:[['WHEN YOU CONFIRM','Apple shows the price and renewal terms before your purchase.'],['NEXT RENEWAL','Your subscription renews unless you cancel in your store settings.']]}/></View><Text style={s.note}>{p.offer.trial?'Reminders use this device’s notifications. Delivery depends on your notification settings; deleting the app removes the reminder.':'No charge is made until you confirm your purchase with Apple.'}</Text></>}
      {screen==='offer'&&<><Text style={s.title}>Build the skills for the conversations that matter to you.</Text><Text style={s.body}>Start with your suggested focus and explore more as you go.</Text>{['Lessons that turn communication skills into clear steps','Spoken practice for real-life situations','Feedback to help you adjust and try again'].map(t=><View key={t} style={s.benefit}><Text style={s.figure}>✓</Text><Text style={[s.body,s.flex]}>{t}</Text></View>)}<View style={s.card}><Text style={s.pledge}>{p.offer.available?`${p.offer.trial?'7 days free, then ':''}${p.offer.renewal}.`:p.offer.loading?'Loading your store offer…':'The store offer is unavailable.'}</Text><Text style={s.note}>Renews automatically unless cancelled. Apple shows the exact first-charge date before you confirm. Any introductory offer depends on store eligibility.</Text></View><AnswerButton secondary reduced={reduced} label="Restore purchases" onPress={()=>{if(!p.authenticated&&!p.purchaseFirst)void account('login');else{go('confirm');void p.onRestore();}}}/><View style={s.links}><Pressable accessibilityRole="link" onPress={()=>void account('login')} style={s.link}><Text style={s.help}>Sign in</Text></Pressable><Pressable accessibilityRole="link" onPress={p.onTerms} style={s.link}><Text style={s.help}>Terms</Text></Pressable><Pressable accessibilityRole="link" onPress={p.onPrivacy} style={s.link}><Text style={s.help}>Privacy</Text></Pressable></View></>}
      {screen==='account'&&<><Text style={s.title}>Keep your progress with you.</Text><Text style={s.body}>{p.purchaseFirst?'Your Apple purchase is confirmed. Create and verify your account to link your subscription and start Lesson 1.':'Create an account to save your focus and track your practice. Your answers will be here when you’re done.'}</Text><AnswerButton secondary label="Sign up with email" reduced={reduced} disabled={busy} onPress={()=>void account('signup')}/><AnswerButton secondary label="Already have an account? Sign in" reduced={reduced} disabled={busy} onPress={()=>void account('login')}/><Text style={s.note}>{p.purchaseFirst?'Account creation is required before practice. You will not be asked to purchase again.':'Next, you’ll review and confirm your subscription with Apple.'}</Text></>}
      {screen==='confirm'&&<><Text style={s.title}>{purchaseTitle}</Text><Text style={s.body}>{p.access?'Your access is verified. Your suggested focus is ready.':p.confirmation==='pending'?'Confirmation hasn’t come back yet. Your focus is preserved. Recheck access instead of purchasing again.':p.confirmation==='cancelled'?'You closed the sheet before confirming. Your focus and first practice are still here.':p.confirmation==='failed'?'We couldn’t verify your purchase. Check access or restore before trying another purchase.':'Apple handles payment and trial dates. Review the exact terms on its confirmation sheet.'}</Text><View style={s.card}><Text style={s.confirmIcon}>{p.access?'✓':p.confirmation==='pending'?'…':p.confirmation==='cancelled'?'–':p.confirmation==='failed'?'!':'◇'}</Text><Text style={s.pledge}>{p.access?'Access confirmed':p.confirmation==='pending'?'Confirmation pending':'No access granted yet'}</Text></View>{!p.access&&<AnswerButton secondary reduced={reduced} label="Recheck access" onPress={p.onCheckAccess}/>}{!p.access&&p.purchaseFirst&&<AnswerButton secondary reduced={reduced} label="Restore purchases" onPress={()=>void p.onRestore()}/>}{!!p.reminder&&<Text style={s.note}>{p.reminder}</Text>}</>}
      {screen==='setup'&&<><Text style={s.eyebrow}>ACCESS CONFIRMED</Text><Text style={s.title}>You’re all set.</Text><Text style={s.body}>Your account and access are ready. Start your first lesson and put your focus into practice.</Text><View style={s.card}><Text style={s.eyebrow}>YOUR STARTING INDEX</Text><Text style={s.pledge}>Your completed lesson rehearsal establishes your first observed signal—not your onboarding answers.</Text></View><Text style={s.body}>After the lesson, review your result and return to Home to see your progress and what comes next.</Text>{!p.access&&<Text style={s.note}>Checking your current access before practice…</Text>}</>}
      {!!(localError||p.error)&&<Text accessibilityRole="alert" style={s.error}>{localError||p.error}</Text>}
      </Animated.View>
    </ScrollView>
    {!!labels[screen]&&<LinearGradient colors={[`${C.bg}00`,C.bg,C.bg]} locations={[0,.3,1]} style={[s.footer,{paddingBottom:Math.max(16,insets.bottom)}]}><AnswerButton label={labels[screen]!} reduced={reduced} disabled={footerDisabled} onPress={()=>void primary()}/>{screen==='welcome'&&<AnswerButton label="I already have an account" reduced={reduced} secondary disabled={busy} onPress={()=>void account('login')}/>}{screen==='offer'&&<Text style={[s.note,s.centerText]}>{p.offer.trial?'No payment today':'No payment until you confirm with Apple'}</Text>}{screen==='setup'&&<AnswerButton secondary reduced={reduced} label="Explore my lessons" onPress={p.onLessons}/>}</LinearGradient>}
  </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},flex:{flex:1},header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:22,paddingBottom:8},back:{width:44,height:44,marginLeft:-8,alignItems:'center',justifyContent:'center'},backText:{fontFamily:font.regular,fontSize:32,color:C.text},progress:{flex:1,flexDirection:'row',gap:5},segment:{flex:1,height:4,borderRadius:999},phase:{fontFamily:font.semi,fontSize:11,letterSpacing:1.2,color:C.dim},content:{flexGrow:1,paddingHorizontal:22,paddingTop:12,paddingBottom:24},page:{flexGrow:1,gap:18},center:{flexGrow:1,justifyContent:'center',gap:18,paddingVertical:24},welcome:{alignItems:'center',gap:24},centerText:{textAlign:'center'},title:{fontFamily:font.bold,fontSize:28,lineHeight:32,letterSpacing:-.56,color:C.text},titleLarge:{fontFamily:font.bold,fontSize:30,lineHeight:35,letterSpacing:-.75,color:C.text},welcomeTitle:{fontFamily:font.bold,fontSize:36,lineHeight:40,letterSpacing:-.9,color:C.text,textAlign:'center'},quote:{fontFamily:font.semi,fontSize:28,lineHeight:34,letterSpacing:-.56,color:C.text},lede:{fontFamily:font.regular,fontSize:17,lineHeight:26,color:C.textSoft},body:{fontFamily:font.regular,fontSize:15,lineHeight:23,color:C.textSoft},pledge:{fontFamily:font.medium,fontSize:17,lineHeight:25,color:C.text},help:{fontFamily:font.regular,fontSize:14,lineHeight:21,color:C.dim},note:{fontFamily:font.regular,fontSize:13,lineHeight:20,color:C.dim},eyebrow:{fontFamily:font.semi,fontSize:10,letterSpacing:1.5,color:C.dim},card:{backgroundColor:C.onAccent,borderRadius:28,borderCurve:'continuous',padding:22,gap:8,shadowColor:C.purpleDeep,shadowOpacity:.07,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:2},sample:{backgroundColor:C.purpleSoft,borderRadius:20,borderCurve:'continuous',padding:20,gap:12},pad:{flex:1,minHeight:200,borderRadius:28,borderCurve:'continuous',borderWidth:1.5,borderStyle:'dashed',borderColor:C.lineStrong,backgroundColor:C.onAccent,overflow:'hidden'},ghost:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',opacity:.14},clear:{position:'absolute',right:12,bottom:12,width:44,height:44,borderRadius:999,backgroundColor:C.line,alignItems:'center',justifyContent:'center'},questions:{gap:12},questionTitle:{fontFamily:font.bold,fontSize:26,lineHeight:30,letterSpacing:-.52,color:C.text},options:{gap:8,paddingTop:4},option:{minHeight:48,paddingVertical:11,paddingHorizontal:18,borderWidth:1.5,borderColor:C.line,borderRadius:20,borderCurve:'continuous',backgroundColor:C.onAccent,flexDirection:'row',alignItems:'center',gap:12,shadowColor:C.purpleDeep,shadowOpacity:.04,shadowOffset:{width:0,height:2},shadowRadius:8},optionLabel:{fontFamily:font.medium,fontSize:15,lineHeight:20,color:C.text,flex:1},radio:{width:20,height:20,borderRadius:10,borderWidth:1.5,borderColor:C.lineStrong,alignItems:'center',justifyContent:'center'},radioOn:{borderColor:C.purple,backgroundColor:C.purple},check:{fontFamily:font.semi,fontSize:13,color:C.onAccent},footer:{paddingHorizontal:22,paddingTop:24,gap:10},button:{minHeight:54,paddingVertical:14,paddingHorizontal:20,borderRadius:999,borderCurve:'continuous',backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},buttonText:{fontFamily:font.semi,fontSize:16,lineHeight:24,color:C.onAccent,textAlign:'center'},secondary:{backgroundColor:'transparent',borderWidth:1.5,borderColor:C.lineStrong},disabled:{backgroundColor:'transparent',borderWidth:1.5,borderColor:C.lineStrong},secondaryText:{color:C.textSoft},pressed:{opacity:.94,transform:[{scale:.972}]},buildRows:{gap:32,paddingTop:36},buildRow:{gap:12},between:{flexDirection:'row',justifyContent:'space-between',gap:12},buildLabel:{fontFamily:font.semi,fontSize:15,lineHeight:22,color:C.text,flex:1},figure:{fontFamily:font.semi,fontSize:13,color:C.purple,fontVariant:['tabular-nums']},buildTrack:{height:6,borderRadius:999,backgroundColor:C.line,overflow:'hidden'},buildFill:{height:6,backgroundColor:C.purple,borderRadius:999},trialHero:{flex:1,justifyContent:'center',gap:36,paddingVertical:24},heroRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},seven:{fontFamily:font.bold,fontSize:108,lineHeight:125,color:C.purple,fontVariant:['tabular-nums']},heroWords:{fontFamily:font.semi,fontSize:26,lineHeight:30,color:C.purple},days:{flexDirection:'row',gap:7},day:{flex:1,height:8,borderRadius:999,backgroundColor:C.purple},timelineSpace:{flexGrow:1,justifyContent:'center',paddingVertical:28},timelineRow:{flexDirection:'row',gap:12,minHeight:76},rail:{width:16,alignItems:'center'},dot:{width:12,height:12,borderRadius:6,borderWidth:2,borderColor:C.purple,backgroundColor:C.bg},dotOn:{backgroundColor:C.purple},railLine:{width:2,flex:1,backgroundColor:C.purpleSoft},timelineCopy:{flex:1,paddingBottom:24,gap:4},benefit:{flexDirection:'row',alignItems:'center',gap:12},links:{flexDirection:'row',justifyContent:'center',gap:16},link:{minWidth:44,minHeight:44,justifyContent:'center'},confirmIcon:{fontFamily:font.bold,fontSize:32,color:C.purple},error:{fontFamily:font.regular,fontSize:14,lineHeight:21,color:C.clay}
});
