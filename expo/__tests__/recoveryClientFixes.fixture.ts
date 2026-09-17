import { mock } from 'bun:test';
import { plugin } from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import { verifyComponentTestDeps } from '../scripts/component-test-deps';
import type { Scenario, Turn } from '../types/convo';

const testCase = process.argv[2];
plugin({ name: 'recovery-host-assets', setup(b) { b.onLoad({ filter: /\.(png|ttf)$/ }, () => ({ contents: 'export default 1', loader: 'js' })); } });
const { create, act } = await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const Host = (p: any) => React.createElement('host', p, p.children);
const Button = (p: any) => React.createElement('button', p, p.label ?? p.children);
const animation = () => ({ start: (done?: any) => done?.({ finished: true }), stop() {} });
class Value { setValue() {} stopAnimation() {} interpolate() { return 0; } }
mock.module('react-native', () => ({
  View: Host, Text: Host, TextInput: (p: any) => React.createElement('input', p), ScrollView: Host,
  Pressable: Button, ActivityIndicator: Host, KeyboardAvoidingView: Host,
  Animated: { Value, View: Host, timing: animation, loop: animation, sequence: animation, parallel: animation },
  Easing: { bezier: () => 0, linear: 0, out: () => 0, cubic: 0 },
  Platform: { OS: 'ios', select: (p: any) => p.ios ?? p.default },
  StyleSheet: { create: (v: any) => v, hairlineWidth: 1, absoluteFillObject: {} },
  Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
  InteractionManager: { runAfterInteractions: (f: any) => { f(); return { cancel() {} }; } },
  Alert: { alert() {} }, Linking: { openSettings: async () => {} },
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
mock.module('expo-blur', () => ({ BlurView: Host }));
mock.module('lucide-react-native', () => Object.fromEntries(['ArrowUp','Keyboard','Mic','RotateCcw','Settings','Square','Volume2','VolumeX'].map(n => [n, Host])));
mock.module('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
mock.module('@/components/ui', () => ({ Backdrop: () => null, PressCard: Button, PrimaryButton: Button, GhostButton: Button,
  Meter: Host, MicControl: Button, StateDock: Host, Thinking: Host, Waveform: Host, tap() {}, useReducedMotion: () => true }));
mock.module('@/components/RehearsalBriefing', () => ({ RehearsalBriefing: Host }));
mock.module('@/components/ScenarioPaidPractice', () => ({ ScenarioPaidPractice: Host }));
mock.module('@/lib/redact', () => ({ safeLog() {}, errorShape: () => ({}) }));

const scenario: Scenario = { id: 'fixture-scene', category: 'work', title: 'Priorities', counterpart: 'Hope', situation: 'The client added a deadline.', persona: 'woman-hope', goal: 'Agree on priorities', opensWith: 'user', openingLine: '', minutes: 5, isCustom: true };
const approvedReply = '"The client added those. Everyone is stretched right now."';
const turns: Turn[] = [
  { id: 'u1', role: 'user', text: 'Can we agree on one priority?' }, { id: 'h1', role: 'them', text: approvedReply },
  { id: 'u2', role: 'user', text: 'Which task can wait until Friday?' }, { id: 'h2', role: 'them', text: 'The client still expects all of it.' },
];
// Synthetic whitespace proves final approval does not reconstruct/trim the stored
// exchange. It is not a claim about the server's normal transcription formatting.
if (testCase === 'final-read-only') {
  turns[0] = { ...turns[0], text: '  Can we agree on one priority?\n' };
  turns[2] = { ...turns[2], text: '\tWhich task can wait until Friday?  ' };
}
const isFinal = ['duplicate-approval', 'approval-setup-retry', 'approval-back', 'final-read-only', 'final-record-again'].includes(testCase);
const protectedFinal = ['approval-back', 'final-read-only'].includes(testCase);
const session = { id: 'fixture-session', scenarioId: scenario.id, category: 'work', topic: scenario.situation, usefulOutcome: scenario.goal, counterpart: 'Hope', counterpartDisplayLabel: 'Hope', persona: 'woman-hope', entryRoute: 'real_conversation', freeJourneyCheckpoint: 'rehearsal', freeRehearsalTurns: isFinal ? turns : testCase === 'recovered-playback' ? [turns[0]] : [] };
const events: string[] = [];
let added: any = null;
let buildCalls = 0;
let generationCalls = 0;
let analysisCalls = 0;
let analysisTurns: Turn[] = [];
let failSetup = ['approval-setup-retry', 'approval-back'].includes(testCase);
const spoken: string[] = [];
const routes: any[] = [];
const router = { replace: (route: any) => { routes.push(route); }, push() {}, back() {}, canGoBack: () => false };
const store = { activePracticeSession: testCase === 'custom' ? null : session, anonymousUserId: 'synthetic-owner',
  profile: null, access: { entitlement: 'free' }, findScenario: () => scenario,
  saveProfile: async () => { events.push('profile'); }, addCustomScenario: async (s: any) => { added = s; events.push('scenario'); },
  createCurrentOnboardingPractice: async () => { events.push('practice'); },
  saveActivePracticeSession: async (s: any) => {
    if (s?.freeJourneyCheckpoint !== 'generating') return;
    events.push('generating');
    if (failSetup) { failSetup = false; throw Error('Synthetic persistence failure'); }
  },
  upsertSession: async () => {}, markChallengeDayDone: async () => {}, saveScoredPracticeRecord: async () => {}, saveCurrentGuestAssessment: async () => {},
};
mock.module('@/providers/store', () => ({ useStore: () => store }));
mock.module('@/providers/auth', () => ({ useAuth: () => ({ startNativeSession: async () => { events.push('auth'); return { success: true }; } }) }));
mock.module('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => ({ id: scenario.id, entry: 'onboarding', practiceSessionId: session.id, persona: 'woman-hope' }) }));
// This fixture isolates UI behavior. Real transport ordering/digests have separate tests.
mock.module('@/lib/normalFreeRuntime', () => ({ normalFreeRecoveryEnabled: protectedFinal || ['exact-playback', 'recovered-playback'].includes(testCase), requestNormalFree: async (op: string) => {
  assert.equal(op, 'recover');
  if (protectedFinal) return Response.json({ status: 'resume', phase: 'close', sessionId: session.id, generation: 0, audio: { text: turns[3].text, role: 'hope', turn: 'close' } });
  return Response.json(generationCalls || testCase === 'recovered-playback'
    ? { status: 'resume', phase: 'pushback', sessionId: session.id, generation: 0, audio: { text: approvedReply, role: 'hope', turn: 'pushback' } }
    : { status: 'new' });
} }));
mock.module('@/lib/ai', () => ({
  buildCustomScenario: async () => { buildCalls++; return { ...scenario }; },
  fallbackCustomScenario: (situation: string, category: string, form: any) => ({ ...scenario, situation, category, persona: form.persona, goal: form.outcome }),
  bysiContract: () => ({}), nextCounterpartTurn: async () => {
    generationCalls++;
    if (testCase === 'counterpart-failure') throw Error('Synthetic counterpart failure');
    return { reply: approvedReply, tension: 50, nudge: '' };
  },
  generateDebrief: async (_scenario: Scenario, _difficulty: string, approvedTurns: Turn[]) => { analysisCalls++; analysisTurns = approvedTurns; throw Error('Synthetic unavailable result'); },
}));
mock.module('@/lib/conversionBuild', () => ({ beginConversionBuild: () => { events.push('build'); }, cancelConversionBuild() {}, emitConversionEvent() {}, failConversionBuild() {}, isConversionBuildActive: () => true }));
const speech = { phase: 'idle', canReplay: false };
mock.module('@/lib/voice', () => ({ useSpeech: () => speech, unlockAudioPlayback: async () => {}, resetSpeech: async () => {}, stopSpeech: async () => {}, replaySpeech: async () => {}, speak: async (text: string) => { spoken.push(text); return 'played'; } }));
const dictation = { status: 'recording', error: '', cancel: async () => {}, start: async () => { dictation.status = 'recording'; }, stop: async () => { dictation.status = 'idle'; return 'Can we agree on one priority?'; } };
mock.module('@/lib/useDictation', () => ({ useDictation: () => dictation }));

const Component = testCase === 'custom' ? (await import('../app/onboarding')).default : (await import('../app/rehearse/[id]')).default;
let root: any;
await act(async () => { root = create(React.createElement(Component)); });
const childText = (n: any): string => typeof n === 'string' ? n : Array.isArray(n) ? n.map(childText).join(' ') : n?.props ? childText(n.props.children) : '';
const button = (label: string) => root.root.findAllByType('button').find((n: any) => n.props.label === label || n.props.accessibilityLabel === label || childText(n.props.children) === label);
const input = (label: string) => root.root.findAllByType('input').find((n: any) => n.props.accessibilityLabel === label);
const press = async (label: string) => { const b = button(label); assert.ok(b, `Missing button: ${label}`); assert.ok(!b.props.disabled); await act(async () => { await b.props.onPress(); }); await act(async () => { await new Promise(r => setTimeout(r, 5)); }); };

if (testCase === 'custom') {
  await press('I have a conversation I need to prepare for');
  await press('Work');
  const field = root.root.findAllByType('input')[0];
  await act(async () => { field.props.onChangeText('The client added a deadline.'); });
  await press('Continue');
  await press('Say the request clearly');
  await press('Gets defensive');
  assert.equal(buildCalls, 0, 'Free custom onboarding must construct locally, not call the paid generator');
  assert.equal(added.situation, 'The client added a deadline.');
  assert.equal(added.opensWith, 'user');
  assert.equal(added.isCustom, true);
  assert.deepEqual(events, ['auth', 'profile', 'scenario', 'practice']);
  assert.equal(routes.at(-1).pathname, '/rehearse/[id]');
} else if (testCase === 'recovered-playback') {
  assert.deepEqual(spoken, [approvedReply], 'Recovered playback must not reformat authorized text');
  assert.equal(generationCalls, 0, 'Recovery must not regenerate the accepted turn');
} else if (isFinal) {
  await press('Review complete transcript');
  if (testCase === 'final-record-again') {
    assert.ok(!button('Record again'), 'Final Record again is misleading: it does not reset a completed exchange');
    assert.ok(input('Edit your opening'));
    assert.ok(input('Edit your response under pressure'));
    assert.ok(button('Back to rehearsal'));
  } else if (testCase === 'final-read-only') {
    assert.equal(root.root.findAllByType('input').length, 0, 'Protected final review must expose no editing controls');
    const opening = root.root.findAllByType('host').find((n: any) => n.props.accessibilityLabel === 'Approved opening');
    const response = root.root.findAllByType('host').find((n: any) => n.props.accessibilityLabel === 'Approved response under pressure');
    assert.equal(childText(opening), turns[0].text);
    assert.equal(childText(response), turns[2].text);
    assert.ok(JSON.stringify(root.toJSON()).includes('previously approved lines can’t be edited here'));
    await press('Approve transcript');
    assert.deepEqual(analysisTurns, turns, 'Debrief receives the exact stored exchange, with no trimming or draft reconstruction');
    assert.deepEqual(routes, ['/debrief/fixture-session']);
  } else if (testCase === 'approval-back') {
    await press('Approve transcript');
    assert.ok(JSON.stringify(root.toJSON()).includes("We couldn't prepare your debrief"));
    await press('Back to rehearsal');
    assert.ok(button('Review complete transcript'), 'Approval setup failure must not replace the complete dock with a counterpart error');
    assert.ok(!button('Back to today'), 'Do not offer a misleading error exit after Back');
    assert.ok(!JSON.stringify(root.toJSON()).includes('Response unavailable'));
    await press('Review complete transcript');
    assert.ok(!JSON.stringify(root.toJSON()).includes("We couldn't prepare your debrief"));
    await press('Approve transcript');
    assert.equal(analysisCalls, 1);
    assert.deepEqual(analysisTurns, turns);
  } else if (testCase === 'approval-setup-retry') {
    await press('Approve transcript');
    assert.equal(analysisCalls, 0);
    assert.equal(routes.length, 0);
    assert.ok(JSON.stringify(root.toJSON()).includes("We couldn't prepare your debrief"));
    assert.equal(input('Edit your opening').props.value, turns[0].text);
    await press('Approve transcript');
    assert.equal(analysisCalls, 1);
    assert.deepEqual(routes, ['/debrief/fixture-session']);
  } else {
    await act(async () => { input('Edit your opening').props.onChangeText('Corrected opening for review.'); });
    // Invoke the same rendered callback twice before React can commit disabled state.
    const approve = button('Approve transcript').props.onPress;
    await act(async () => { approve(); approve(); });
    assert.equal(events.filter(x => x === 'build').length, 1, 'Only one conversion build may start');
    assert.equal(events.filter(x => x === 'generating').length, 1);
    assert.equal(analysisCalls, 1);
    assert.equal(analysisTurns[0].text, 'Corrected opening for review.', 'Keep final editing; this is not a backend acceptance claim');
    assert.deepEqual(routes, ['/debrief/fixture-session']);
  }
} else {
  // MicControl's accessibility label is set by the screen; stop this modeled capture.
  const mic = button('Stop and review your line');
  assert.ok(mic, 'Expected stop-recording control');
  await act(async () => { await mic.props.onPress(); });
  assert.ok(input('Your line, ready to send'));
  assert.equal(generationCalls, 0, 'Recognizer completion must not submit');
  if (testCase === 'review-cleared') {
    await act(async () => { input('Your line, ready to send').props.onChangeText(''); });
    assert.ok(input('Your line, ready to send'), 'Clearing text must keep the explicit review state');
    assert.ok(button('Use this opener').props.disabled);
    assert.equal(generationCalls, 0);
    await act(async () => { input('Your line, ready to send').props.onChangeText('Corrected opening.'); });
    assert.ok(!button('Use this opener').props.disabled);
    await press('Re-record');
    assert.equal(input('Your line, ready to send'), undefined);
    assert.equal(generationCalls, 0);
  } else if (testCase === 'counterpart-failure') {
    await press('Use this opener');
    assert.equal(generationCalls, 1);
    assert.ok(JSON.stringify(root.toJSON()).includes('Response unavailable'), 'Unrelated counterpart failures remain visible');
  } else {
    await act(async () => { input('Your line, ready to send').props.onChangeText('Edited before first approval.'); });
    await press('Use this opener');
    assert.deepEqual(spoken, [approvedReply], 'Playback must receive the exact approved counterpart text, not display formatting');
    await press('Record your line');
    await press('Stop and review your line');
    assert.equal(generationCalls, 1, 'The second recording also waits for explicit approval');
    await act(async () => { input('Your line, ready to send').props.onChangeText('Edited before second approval.'); });
    await press('Use this reply');
    assert.equal(generationCalls, 2);
    assert.deepEqual(spoken, [approvedReply, approvedReply], 'Both playback points retain authorized text');
    await press('Review complete transcript');
    assert.equal(root.root.findAllByType('input').length, 0, 'Protected final review is read-only after editable per-turn approval');
    await press('Approve transcript');
    assert.equal(analysisTurns[0].text, 'Edited before first approval.', 'Pre-submission edits are the approved stored words');
    assert.equal(analysisTurns[2].text, 'Edited before second approval.');
  }
}
await act(async () => { root.unmount(); });
console.log(`PASS ${testCase}: actual screen callbacks with synthetic native hosts, not a device test.`);
