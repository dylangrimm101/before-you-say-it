import { mock } from 'bun:test';
import { plugin } from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {accountAccessRoute, accountAccessState} from '../lib/accountAccess';
import { verifyComponentTestDeps } from '../scripts/component-test-deps';
plugin({ name: 'subscription-assets', setup(b) { b.onLoad({ filter: /\.(png|ttf)$/ }, () => ({ contents: 'export default 1', loader: 'js' })); } });
const { create, act } = await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__DEV__ = false;
const Host = (p: any) => React.createElement('view', p, p.children);
const Button = (p: any) => React.createElement('button', p, p.label ?? p.children);
class Value { constructor(_: number) {} setValue(_: number) {} interpolate() { return 1; } }
mock.module('react-native', () => ({ View: Host, Text: Host, ScrollView: Host, ActivityIndicator: Host, KeyboardAvoidingView: Host, TextInput: (p: any) => React.createElement('input', p), Platform: { OS: 'ios', select: (p: any) => p.ios }, Linking: { openURL: async () => {} }, StyleSheet: { create: (s: any) => s }, Animated: { Value, View: Host }, Easing: {}, useWindowDimensions: () => ({ width: 390, height: 844 }) }));
mock.module('react-native-svg', () => ({ default: Host, Circle: Host, Path: Host }));
mock.module('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
mock.module('lucide-react-native', () => Object.fromEntries(['ArrowLeft','AlertCircle','Check','ChevronDown','Clock3','RefreshCw','ShieldCheck'].map(k => [k, () => null])));
mock.module('@/components/ui', () => ({ Backdrop: () => null, Eyebrow: Host, GlassCard: Host, PressCard: Button, PrimaryButton: Button, GhostButton: Button, Reveal: Host, StateDock: Host, tap() {}, useReducedMotion: () => true }));
mock.module('@/lib/nativeBillingRuntime', () => ({ normalBillingEnabled: true }));
mock.module('@/lib/useStagingWebBridgeState', () => ({ useStagingWebBridgeState: () => null }));
mock.module('@/lib/stagingWebBridge', () => ({ stagingPurchasePresentation: () => null }));
let params: any = { source: 'debrief', moduleId: 'make_a_clear_ask', gate: 'recommended-path' };
let path = '/practice-plan', key = 0, root: any;
const history: any[] = [];
const route = (r: any) => { path = typeof r === 'string' ? r : r.pathname; params = typeof r === 'string' ? {} : r.params ?? {}; key++; };
const router = { push(r: any) { history.push({ pathname: path, params }); route(r); }, replace: route, canGoBack: () => history.length > 0, back() { route(history.pop() ?? '/entry'); } };
mock.module('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => params }));
const completed = () => ({ id: 'synthetic-result', turns: [], freeJourneyCheckpoint: 'complete', postRehearsalState: 'pay1', sharedResult: { signals: [], pressure_moment: { headline: 'Synthetic starting point' }, practice_shift: {}, starting_index: { focus_dimension: 'Specificity', index_value: null, observed_count: 0 }, first_focus: { recommended_module_id: 'make_a_clear_ask', first_focus_label: 'Make a clear ask' } } });
let activePracticeSession: any = completed();
activePracticeSession.freeJourneyCheckpoint = 'practice_shift'; activePracticeSession.postRehearsalState = 'shift';
let hasCurrentGuestPractice = true;
let user: any = null, loginMode = 'success', logins = 0, signups = 0, purchases = 0, restores = 0;
let access: any = { data: false, isError: false, isPending: false, isFetching: false, refetch: async () => {} };
const login = async () => { logins++; if (loginMode === 'failed') return { success: false, message: 'Synthetic sign-in rejected' }; user = { id: 'owner-A' }; activePracticeSession = null; return { success: true, continuationId: 'saved-result-id', ...(loginMode === 'claim-problem' ? { continuationProblem: true } : {}) }; };
mock.module('@/providers/auth', () => ({ useAuth: () => ({ user, session: user ? { user } : { user: { is_anonymous: true } }, isAuthConfigured: true, hasCurrentGuestPractice, login, cancelLogin() {} }) }));
mock.module('@/lib/supabase', () => ({ authEnvironment: { staging: false }, supabase: { auth: { signUp: async () => { signups++; return { data: { user: null, session: null }, error: null }; } } } }));
const saveActivePracticeSession = async (next: any) => { activePracticeSession = next; };
mock.module('@/providers/store', () => ({ useStore: () => ({ activePracticeSession, convertedLessonProgress: [], moduleCloseProgress: [], sessions: [], pilotProgress: [], saveActivePracticeSession }) }));
let catalog = true;
let purchaseStatus = 'cancelled';
let eligibility = 0;
let reminderPermission = 'denied';
mock.module('@/lib/trialReminder', () => ({ trialReminderPreference: async () => 'off', enableTrialReminder: async () => reminderPermission, syncTrialReminder: async () => 'not-applicable' }));
const product: any = { identifier: 'byis_pro_monthly_5', priceString: '$7.49', price: 7.49, currencyCode: 'USD', subscriptionPeriod: 'P1M' };
const offer = { identifier: '$rc_monthly', product };
mock.module('@/lib/purchases', () => ({trialEligibility: async () => eligibility,
  useNativeServerAccess: () => access,
  useOfferings: () => ({ data: { current: { monthly: catalog ? offer : null } }, isLoading: false }),
  usePurchasePackage: () => ({ isPending: false, mutateAsync: async () => { assert.ok(user); purchases++; if(purchaseStatus === 'purchased') access.data = true; return { status: purchaseStatus }; } }),
  useRestorePurchases: () => ({ isPending: false, mutateAsync: async () => { assert.ok(user); restores++; return false; } }),
  useCustomerInfo: () => ({ data: null, refetch: async () => {} }), hasPro: () => false, useIsPro: () => access.data === true,
}));
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { default: Paywall } = await import('../app/paywall');
const { default: Login } = await import('../app/continue-from-web');
const { default: Success } = await import('../app/purchase-success');
const { FreeJourneyResults } = await import('../components/FreeJourneyResults');
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const app = () => <QueryClientProvider client={client}>{path === '/practice-plan' ? <FreeJourneyResults session={activePracticeSession} /> : path === '/paywall' ? <Paywall key={key} /> : path === '/continue-from-web' ? <Login key={key} /> : path === '/purchase-success' ? <Success key={key} /> : <Host>{path}</Host>}</QueryClientProvider>;
const render = async () => { await act(async () => { if (root) root.update(app()); else root = create(app()); }); };
const text = () => JSON.stringify(root.toJSON());
const button = (label: string) => root.root.findAllByType('button').find((b: any) => b.props.label === label || b.props.accessibilityLabel === label);
async function press(label: string) { const b = button(label); assert.ok(b, `missing ${label}`); assert.ok(!b.props.disabled, `disabled ${label}`); await act(async () => { await b.props.onPress(); }); await render(); }
async function fill() { await act(async () => { root.root.findAllByType('input')[0].props.onChangeText('synthetic@invalid'); root.root.findAllByType('input')[1].props.onChangeText('synthetic-only'); }); }
async function terms() { await press('Continue'); await press('Continue'); assert.ok(text().includes('$7.49')); assert.ok(text().includes('Monthly subscription')); assert.equal(purchases, 0); assert.equal(restores, 0); }
async function reset() { await act(async () => root?.unmount()); root = null; client.clear(); user = null; activePracticeSession = completed(); hasCurrentGuestPractice = true; access = { ...access, data: false, isError: false, isFetching: false, isPending: false }; params = { source: 'debrief' }; path = '/paywall'; key++; loginMode = 'success'; catalog = true; await render(); }

await render();
assert.ok(root.root.findAllByProps({ testID: 'result-card-stack' }).length);
assert.ok(text().includes('Where you are now'));
assert.ok(button('See my practice plan'));
await press('Back'); assert.ok(text().includes('Here’s what practice is helping you say'));
await press('See the practice plan'); assert.ok(button('See my practice plan'));
await press('See my practice plan'); assert.equal(path, '/paywall'); assert.equal(params.source, 'debrief');
assert.ok(!text().includes('Log in to verify purchases before viewing'));
assert.ok(text().includes('$7.49'), 'first offer screen shows the supplied localized monthly price');
await terms();
await press('Create account to continue'); assert.equal(path, '/continue-from-web');
assert.equal(params.returnTo, 'subscription');
assert.ok(text().includes('Create your account'), 'trial entry must default to account creation');
await press('Already have an account? Sign in');
await fill(); loginMode = 'failed'; await press('Sign in to save this result and continue');
assert.equal(path, '/continue-from-web'); assert.ok(text().includes('Synthetic sign-in rejected')); assert.equal(purchases, 0);
loginMode = 'success'; await press('Sign in to save this result and continue');
assert.equal(path, '/paywall'); assert.equal(params.source, 'account-offer');
assert.equal(activePracticeSession, null, 'return does not copy the previous owner’s result into the new store');
assert.equal(params.moduleId, 'make_a_clear_ask'); assert.equal(purchases, 0);
assert.equal(button('I have not subscribed — view Apple offer'), undefined, 'confirmed no access opens offer without recovery questionnaire');
assert.ok(button('Subscribe monthly')); assert.equal(button('Continue'), undefined, 'return directly to terms, not onboarding');
assert.equal(purchases, 0, 'login never auto-purchases');
await press('Subscribe monthly'); assert.equal(purchases, 1); assert.equal(path, '/paywall', 'cancelled purchase stays on offer');
// Synthetic owner-scoped result hydration; never copy the guest object on login.
activePracticeSession = completed();
activePracticeSession.sharedResult.starting_index = { index_value: 61, observed_count: 4, focus_dimension: 'specificity' };
purchaseStatus = 'purchased';
await press('Try again'); assert.equal(path, '/purchase-success');
assert.ok(text().includes('You’re in.')); assert.ok(text().includes('61'));
assert.ok(!root.root.findAllByType('view').some((n: any) => n.props.children === 64), 'reference screenshot score is not hardcoded');
await press('Start my first practice'); assert.equal(path, '/approved-lesson/[lessonId]');
purchaseStatus = 'cancelled';
purchases = 0;

await reset(); await terms(); await press('Restore purchases');
assert.equal(path, '/continue-from-web'); assert.equal(restores, 0, 'guest restore requires verified account too');
await press('Back'); assert.equal(path, '/paywall'); assert.equal(purchases, 0);
await reset(); await terms(); await press('Create account to continue'); await fill();
await press('Create account'); assert.equal(signups, 1); assert.equal(user, null);
assert.equal(path, '/continue-from-web'); assert.equal(purchases, 0);
loginMode = 'failed'; await press('I confirmed my email — log in');
assert.equal(path, '/continue-from-web', 'unverified account cannot reach checkout'); assert.equal(purchases, 0);
loginMode = 'success';
await press('I confirmed my email — log in'); assert.equal(path, '/paywall'); assert.equal(purchases, 0);
assert.equal(params.source, 'account-offer');

await reset(); await terms(); await press('Create account to continue'); await press('Already have an account? Sign in'); await fill(); loginMode = 'claim-problem';
await press('Sign in to save this result and continue'); assert.equal(path, '/account-practice', 'claim failure is not hidden by subscription return');
await reset(); catalog = false; await render(); await press('Continue'); await press('Continue');
assert.ok(button('Create account to continue').props.disabled); assert.ok(!text().includes('$7.49'), 'never fabricate unavailable store pricing');

await reset(); user = { id: 'owner-A' }; access = { ...access, data: true }; await render();
assert.ok(button('Continue to practice')); assert.equal(button('Subscribe monthly'), undefined);
access = { ...access, data: false, isError: true }; await render(); assert.ok(button('Retry access verification'));
access = { ...access, isError: false }; await render(); await press('Help with an existing purchase');
const safeScroll = root.root.findAllByType('view').find((n: any) => n.props.contentContainerStyle?.paddingTop === 75);
assert.ok(safeScroll, 'optional recovery status uses real safe-area inset plus spacing');
await press('I already subscribed on the web');
await act(async () => { await new Promise(r => setTimeout(r, 10)); }); await render();
assert.ok(text().includes('Do not subscribe again in Apple')); assert.equal(button('Subscribe monthly'), undefined);
assert.equal(purchases, 0); assert.equal(restores, 0); assert.ok(logins >= 4);
await reset(); await terms(); await press('Create account to continue'); hasCurrentGuestPractice = false; await render();
assert.ok(button('Create account')); assert.ok(text().includes('Create your account'), 'account creation remains available without a current guest result');
await press('Already have an account? Sign in'); await press('Create an account');
assert.ok(button('Create account'), 'sign-in can switch back to signup');
await reset(); activePracticeSession = null; await render();
assert.ok(!button('Continue'), 'debrief offer still requires an earned result');
await reset(); route('/continue-from-web'); await render(); await fill();
await press('Sign in to save this result and continue');
assert.equal(path, '/debrief/saved-result-id', 'ordinary result-saving login keeps its existing destination');
product.introPrice = { price: 0, priceString: '$0.00', period: 'P1W', cycles: 1 };
eligibility = 2;
await reset();
assert.ok(text().includes('Try BYSI free for 7 days.'));
await press('Continue');
assert.ok(text().includes('Get a reminder 2 days before your free trial ends.'));
await press('Enable trial reminder');
assert.ok(text().includes('Notifications are off'));
assert.ok(button('Continue'), 'permission denial never blocks checkout');
reminderPermission = 'enabled';
await press('Enable trial reminder');
assert.ok(text().includes('We’ll remind you 2 days before your free trial ends.'));
await press('Continue');
assert.ok(text().includes('7 days free, then'));
assert.ok(button('Create account to continue'), 'trial preserves required account gate');
eligibility = 1;
await reset();
assert.ok(!text().includes('Try BYSI free for 7 days.'), 'ineligible users never get a free-trial promise');
// Follow actual mounted exit controls, then apply the same account policy used
// by RootLayout. A router-only assertion previously missed the Home → offer loop.
for (const prior of [null, '/(tabs)', '/approved-lesson/first', '/entry']) {
  for (const exit of ['close', 'back', 'recovery'] as const) {
    await reset(); user = {id: 'owner-A'}; activePracticeSession = null;
    history.length = 0; if (prior) history.push({pathname: prior, params: {}});
    route({pathname: '/paywall', params: {source: 'access-gate'}}); await render();
    if (exit === 'back') { await press('Back'); await press('Back'); await press('Back'); }
    else if (exit === 'recovery') { await press('Help with an existing purchase'); await press('Back'); }
    else { const close = root.root.findAllByType('button').find((b: any) => b.props.accessibilityLabel?.startsWith('Close offer')); assert.ok(close); await act(async () => close.props.onPress()); await render(); }
    const first = path.split('/')[1];
    if (accountAccessRoute(first, true, params.source).protected && accountAccessState(true, access) === 'paywall') {
      route({pathname: '/paywall', params: {source: 'access-gate'}}); await render();
    }
    assert.equal(path, '/settings', `${exit} must leave the unpaid offer without bouncing back (prior ${prior})`);
    assert.equal(access.data, false, 'exit must not grant paid access');
    assert.equal(purchases, 0, 'exit must not purchase');
  }
}
await act(async () => root.unmount()); client.clear();
console.log('PASS guest subscription preview, sign-in/signup return, safe area, restore gate, cancellation, missing catalog, existing buyer guards. Mocked native/store/auth; no Apple purchase or physical-device proof.');
