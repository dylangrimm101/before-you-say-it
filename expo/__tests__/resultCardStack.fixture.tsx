import { mock } from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import { verifyComponentTestDeps } from '../scripts/component-test-deps';
const { create, act } = await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const Host = (p: any) => React.createElement('view', p, p.children);
let reduced = false;
let range: any;
let nativeDriver = false;
class Value {
  constructor(_: number) {}
  interpolate(config: any) { range = config; return config; }
}
mock.module('react-native', () => ({
  ScrollView: Host, View: Host, StyleSheet: { create: (s: any) => s },
  Animated: { Value, View: Host, ScrollView: Host, event: (_: any, config: any) => { nativeDriver = config.useNativeDriver; return () => {}; } },
}));
mock.module('@/components/ui', () => ({ useReducedMotion: () => reduced }));
mock.module('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
mock.module('@/constants/theme', () => ({ C: { elevated: 'white' }, GUTTER: 24, shadow: { layer: {} } }));
const { ResultCardStack } = await import('../components/ResultCardStack');
let root: any;
let actions = 0;
const app = () => <ResultCardStack header={<Host>Starting Index</Host>} first={<Host>Entire evidence card</Host>}
  second={<Host><Host>Practice path</Host><button onClick={() => actions++}>See my practice plan</button></Host>} />;
await act(async () => { root = create(app()); });
const node = (id: string) => root.root.findAllByType('view').find((n: any) => n.props.testID === id);
assert.equal(node('result-card-stack').props.removeClippedSubviews, false);
assert.equal(nativeDriver, true);
await act(async () => {
  node('result-card-stack').props.onLayout({ nativeEvent: { layout: { height: 750 } } });
  node('result-index-card').props.onLayout({ nativeEvent: { layout: { height: 1000 } } });
  const header = root.root.findAllByType('view').find((n: any) => n.props.onLayout && !n.props.testID);
  header.props.onLayout({ nativeEvent: { layout: { y: 79, height: 120 } } });
});
assert.deepEqual(range.inputRange, [0, 569, 1569], 'long evidence finishes scrolling before it pins');
assert.deepEqual(range.outputRange, [0, 0, 1000]);
assert.equal(range.extrapolate, 'clamp');
assert.equal(node('result-plan-card').props.style[1].zIndex, 2, 'next card draws above pinned evidence');
await act(async () => root.root.findByType('button').props.onClick());
assert.equal(actions, 1);
reduced = true;
await act(async () => root.update(app()));
assert.equal(node('result-card-stack').props.onScroll, undefined);
assert.equal(node('result-index-card').props.style[1], undefined, 'reduced motion removes pinning, not content');
assert.ok(JSON.stringify(root.toJSON()).includes('Entire evidence card'));
assert.ok(JSON.stringify(root.toJSON()).includes('See my practice plan'));
await act(async () => root.unmount());
console.log('PASS measured stack, long content, overlapping order, reachable CTA and reduced motion; native rendering remains unverified.');
