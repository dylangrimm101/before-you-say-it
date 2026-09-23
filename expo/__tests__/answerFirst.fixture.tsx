import { mock } from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import { verifyComponentTestDeps } from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const Host=(p:any)=>{
  // React Native rejects raw text (including whitespace) inside a View.
  const check=(children:any)=>React.Children.forEach(children,(child:any)=>{
    assert.ok(typeof child!=='string'&&typeof child!=='number','Raw text child outside Text');
    if(React.isValidElement(child)&&child.type===React.Fragment)check((child.props as any).children);
  });check(p.children);
  return React.createElement('view',p,p.children);
};
const Text=(p:any)=>React.createElement('text',p,p.children);
const Pressable=(p:any)=>React.createElement('button',p,p.children);
class Value{constructor(public value:number){}setValue(v:number){this.value=v;}interpolate(c:any){return c;}}
let reduced=true;let fontScale=1;const realTimer=globalThis.setTimeout;
globalThis.setTimeout=((fn:any,ms:number,...args:any[])=>realTimer(fn,ms===900||ms===7500||ms===260?0:ms,...args)) as any;
mock.module('react-native',()=>({View:Host,Text,Pressable,ScrollView:Host,StyleSheet:{create:(s:any)=>s,absoluteFill:{},absoluteFillObject:{}},useWindowDimensions:()=>({width:393,height:852,fontScale}),AccessibilityInfo:{isReduceMotionEnabled:async()=>reduced,addEventListener:()=>({remove(){}})},Easing:{bezier:()=>null},Animated:{Value,View:Host,timing:()=>({start(){},stop(){}}),stagger:()=>({start(){},stop(){}})}}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:59,bottom:34})}));
mock.module('react-native-svg',()=>({default:Host,Polyline:Host,SvgXml:Host}));
mock.module('expo-linear-gradient',()=>({LinearGradient:Host}));
mock.module('@/components/ui',()=>({Backdrop:Host,tap:()=>{}}));
mock.module('@/constants/theme',()=>({C:{bg:'field',purple:'brand',onAccent:'white',text:'ink',dim:'dim',line:'line',lineStrong:'edge',textSoft:'soft',purpleSoft:'tint',purpleDeep:'deep',clay:'danger'},font:{regular:'regular',medium:'medium',semi:'semi',bold:'bold'}}));
const {AnswerFirstOnboarding}=await import('../components/AnswerFirstOnboarding');
let root:any;let saved:any;let account:any;let buys=0;let practices=0;let restores=0;
let props:any={initialAnswers:{},authenticated:false,access:false,offer:{available:true,loading:false,renewal:'$11.99 monthly',trial:true},confirmation:'ready',onSave:async(a:any)=>{saved=a;},onAccount:async(mode:any,a:any)=>{account={mode,a};},onBuy:async()=>{buys++;},onRestore:async()=>{restores++;},onCheckAccess(){},onPractice(){practices++;},onLessons(){},onPrivacy(){},onTerms(){}};
const mount=async(extra:any={})=>{props={...props,...extra};await act(async()=>{root=create(<AnswerFirstOnboarding {...props}/>);});};
const button=(label:string)=>root.root.findAllByType('button').find((b:any)=>b.props.accessibilityLabel===label);
const click=async(label:string)=>{const b=button(label);assert.ok(b,`missing ${label}`);assert.ok(!b.props.disabled,`disabled ${label}`);await act(async()=>{b.props.onPress();});await act(async()=>{await new Promise(r=>realTimer(r,5));});};
const screen=(name:string)=>assert.ok(root.root.findAllByType('view').some((v:any)=>v.props.testID===`answer-screen-${name}`),`expected ${name}`);
await mount();screen('welcome');await click('Get started');await click('I can learn this');await click('Continue');screen('commit');assert.equal(button('I’m ready').props.disabled,true);
const pad=()=>root.root.findAllByType('view').find((v:any)=>v.props.testID==='commitment-pad');
const commitmentScroll=()=>root.root.findAllByType('view').find((v:any)=>v.props.testID==='answer-screen-commit');
assert.equal(commitmentScroll().props.bounces,false,'commitment must not rubber-band');
await act(async()=>{const event:any={nativeEvent:{locationX:20,locationY:40}};pad().props.onResponderGrant(event);event.nativeEvent=null;});
assert.equal(commitmentScroll().props.scrollEnabled,false,'drawing must lock parent scrolling');
assert.equal(pad().props.onResponderTerminationRequest(),false,'parent must not steal the stroke');
await act(async()=>{const event:any={nativeEvent:{locationX:50,locationY:80}};pad().props.onResponderMove(event);event.nativeEvent=null;});
await act(async()=>{pad().props.onResponderMove({nativeEvent:{locationX:100,locationY:20}});pad().props.onResponderRelease();});
assert.ok(root.root.findAllByType('view').some((v:any)=>v.props.points==='20,40 20,40 50,80 100,20'),'complete two-direction check mark survives');
assert.equal(commitmentScroll().props.scrollEnabled,true,'outside-pad scrolling remains accessible after release');
await click('Clear commitment drawing');assert.equal(button('I’m ready').props.disabled,true);
await act(async()=>{pad().props.onResponderGrant({nativeEvent:{locationX:20,locationY:40}});});
await click('I’m ready');screen('q1');
await click('Getting my thoughts out clearly.');screen('q2');await click('At work');screen('q3');await click('Every detail feels important, so I lose the main point.');
await act(async()=>{await new Promise(r=>realTimer(r,10));});screen('result');
assert.equal(buys,0);assert.equal(practices,0);assert.equal(saved,undefined);
await click('Back');screen('q3');assert.equal(button('Every detail feels important, so I lose the main point.').props.accessibilityState.selected,true);
await click('Every detail feels important, so I lose the main point.');await act(async()=>{await new Promise(r=>realTimer(r,10));});
await click('See how the trial works');screen('trial');await click('Continue');screen('remind');await click('Continue');screen('offer');await click('Start my 7-day free trial');screen('account');assert.deepEqual(saved,{diff:'clarity',ctx:'work',rec:'bury'});assert.ok(!JSON.stringify(saved).includes('strokes'));
await click('Sign up with email');assert.equal(account.mode,'signup');assert.deepEqual(account.a,saved);assert.equal(buys,0);await act(async()=>root.unmount());
for(const status of ['pending','cancelled','failed','confirmed']){
  await mount({initialAnswers:saved,initialScreen:'confirm',authenticated:true,confirmation:status,access:status==='confirmed'});
  if(status==='pending')assert.equal(button('Waiting for confirmation').props.disabled,true);
  else if(status==='confirmed'){await click('Start my first lesson');screen('setup');await click('Start my first lesson');assert.equal(practices,1);}
  else{await click('Back to the offer');screen('offer');assert.equal(practices,0);}
  await act(async()=>root.unmount());
}
await mount({initialAnswers:saved,initialScreen:'offer',authenticated:false,confirmation:'ready',access:false,offer:{available:false,loading:false,renewal:'',trial:false}});assert.equal(button('Continue to subscription').props.disabled,true);await click('Restore purchases');assert.equal(account.mode,'login');assert.equal(restores,0);await act(async()=>root.unmount());
fontScale=1.8;await mount({initialScreen:'q1'});const large=root.root.findAllByType('view').find((v:any)=>v.props.testID==='answer-screen-q1');assert.equal(large.props.scrollEnabled,true);await act(async()=>root.unmount());
await mount({initialAnswers:saved,initialScreen:'offer',purchaseFirst:true,accountRequired:false,authenticated:false,confirmation:'ready',access:false,offer:{available:true,loading:false,renewal:'$11.99 monthly',trial:true}});
const beforeBuy=buys;await click('Start my 7-day free trial');screen('confirm');assert.equal(buys,beforeBuy,'review is not purchase');
await click('Confirm with Apple');assert.equal(buys,beforeBuy+1);
props={...props,accountRequired:true,confirmation:'confirmed'};await act(async()=>root.update(<AnswerFirstOnboarding {...props}/>));screen('account');
await click('Sign up with email');assert.equal(account.mode,'signup');assert.equal(buys,beforeBuy+1,'signup must not purchase twice');await act(async()=>root.unmount());
await mount({initialScreen:'offer',accountRequired:false});const beforeRestore=restores;await click('Restore purchases');assert.equal(restores,beforeRestore+1,'purchase-first restores before account creation');await act(async()=>root.unmount());
let recoveries=0;
await mount({initialScreen:'confirm',confirmation:'pending',accountRequired:false,onRecoverPurchase:async()=>{recoveries++;}});
await click('Review purchase with Apple');assert.equal(recoveries,1);assert.equal(buys,beforeBuy+1,'recovery action is distinct from ordinary buy');await act(async()=>root.unmount());
console.log('PASS answer-first mounted: drawing/released events, question/back/result, offer/account, pending/cancel/failure/confirmed, unavailable restore, Dynamic Type, and purchase-first confirmation then required signup. Auth, store, renderer and timers simulated.');
