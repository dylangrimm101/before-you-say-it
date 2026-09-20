import { NativeBillingGate } from '@/components/NativeBillingGate';
import { normalBillingEnabled } from '@/lib/nativeBillingRuntime';
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, Check, ChevronDown, Clock3, RefreshCw, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { Backdrop, Eyebrow, GlassCard, PressCard, PrimaryButton, Reveal, StateDock, tap, useReducedMotion } from "@/components/ui";
import { curriculumModule, isModuleId, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { storeProductSnapshot } from "@/lib/commerce";
import {
  commerceActionPresentation,
  commerceStatusMessage,
  openOffer,
  transitionOffer,
  transitionPurchase,
  transitionRestore,
  type CommercePresentationState,
  type OfferState,
} from "@/lib/nativeCommerce";
import { nextLaunchDeck } from "@/lib/launchCurriculum";
import { transitionPostRehearsal } from "@/lib/postRehearsalFlow";
import { errorShape, safeLog } from "@/lib/redact";
import { hasPro, useCustomerInfo, useOfferings, usePurchasePackage, useRestorePurchases } from "@/lib/purchases";
import { useStore } from "@/providers/store";
import { useAuth } from "@/providers/auth";
import { useStagingWebBridgeState } from "@/lib/useStagingWebBridgeState";
import { stagingPurchasePresentation } from "@/lib/stagingWebBridge";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

const DEFAULT_FOCUS_LABEL = "Focus: Specificity";
const SUBSCRIPTION_MANAGEMENT_URL = Platform.select({
  ios: "https://apps.apple.com/account/subscriptions",
  android: "https://play.google.com/store/account/subscriptions",
});

export default function Paywall() {
  const { stagingWebBridge } = useAuth();
  const params = useLocalSearchParams<{ moduleId?: string; gate?: string }>();
  const webState = useStagingWebBridgeState(stagingWebBridge);
  const router = useRouter();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!stagingWebBridge) return;
    const timer = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [stagingWebBridge]);
  if (__DEV__ && stagingWebBridge?.suppressPurchasePrompt()) {
    return <Unavailable title="Your web subscription is already verified." body="Don’t purchase again. This staging preview can show your saved web result; paid native practice still requires its own server authorization." onBack={() => router.replace("/staging-web-result")} />;
  }
  if (__DEV__ && stagingWebBridge && (stagingWebBridge.hasKnownWebPurchase() || stagingPurchasePresentation(webState, false) === "verify-web")) {
    return <Unavailable title="Check your web purchase first." body="Web subscription access is not currently verified. Recheck your saved result before purchasing again; this screen does not grant paid access." onBack={() => router.replace("/staging-web-result")} />;
  }
  const verifyAccount = () => router.push({ pathname: "/continue-from-web", params: {
    returnTo: "subscription",
    ...(isModuleId(params.moduleId) ? { moduleId: params.moduleId } : {}),
    ...(params.gate === "recommended-path" ? { gate: params.gate } : {}),
  } });
  if(normalBillingEnabled)return <NativeBillingGate
    guestPreview={<ApplePaywall onVerifyAccount={verifyAccount} />}
    renderStatus={content => <BillingStatus>{content}</BillingStatus>}
    onContinue={()=>router.replace("/(tabs)/library")} onLogin={verifyAccount}
  ><ApplePaywall /></NativeBillingGate>;
  return <ApplePaywall />;
}

function BillingStatus({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <View style={styles.root}><Backdrop /><ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: GUTTER, gap: 20 }}>
    <PrimaryButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} />
    <Text style={styles.title}>Subscription access</Text>
    {children}
  </ScrollView></View>;
}

function ApplePaywall({ onVerifyAccount }: { onVerifyAccount?: () => void } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gate?: string; source?: string; moduleId?: string }>();
  const { activePracticeSession, convertedLessonProgress, moduleCloseProgress, saveActivePracticeSession } = useStore();
  const nextDeck = nextLaunchDeck(convertedLessonProgress, moduleCloseProgress);
  const moduleId: ModuleId | null = isModuleId(params.moduleId) ? params.moduleId : activePracticeSession?.recommendation?.moduleId ?? null;
  const { data: offerings, isLoading, error: offeringsError } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();
  const customer = useCustomerInfo();
  const isPro = normalBillingEnabled ? false : hasPro(customer.data);
  const [offer, setOffer] = useState<OfferState<SharedResultContractV1 | undefined>>(() => {
    const opened = openOffer(activePracticeSession?.sharedResult);
    if (params.source === "account-offer") opened.stage = 3;
    const checkpoint = activePracticeSession?.postRehearsalState;
    if (params.source === "debrief" && (checkpoint === "pay2" || checkpoint === "pay3")) {
      opened.stage = checkpoint === "pay2" ? 2 : 3;
    }
    return opened;
  });
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [commerceState, setCommerceState] = useState<CommercePresentationState>("ready");
  const stage = offer.stage;

  const plans = useMemo((): { monthly: PurchasesPackage | null; annual: PurchasesPackage | null } => {
    const current = offerings?.current;
    return { monthly: current?.monthly?.product.identifier === "byis_pro_monthly_5" ? current.monthly : null, annual: null };
  }, [offerings]);
  const selectedPackage = billing === "annual" ? plans.annual ?? plans.monthly : plans.monthly ?? plans.annual;
  const terms = storeProductSnapshot(selectedPackage?.product);
  const monthlyTerms = storeProductSnapshot(plans.monthly?.product);
  const annualTerms = storeProductSnapshot(plans.annual?.product);
  const isApprovedStoreOffer = Boolean(
    plans.monthly && monthlyTerms?.periodLabel === "1 month" && monthlyTerms.priceString,
  );
  const purchaseLabel = onVerifyAccount ? "Continue to account" : "Subscribe monthly";
  const actions = commerceActionPresentation(commerceState, isPro, purchaseLabel);
  const hasCompleteEarnedResult = Boolean(activePracticeSession?.sharedResult?.pressure_moment && activePracticeSession.sharedResult.practice_shift && activePracticeSession.sharedResult.starting_index && activePracticeSession.sharedResult.first_focus);
  const earnedOfferBlocked = params.source === "debrief" && !hasCompleteEarnedResult;
  const practiceModule = curriculumModule(moduleId) ?? curriculumModule("make_a_clear_ask");
  const practiceFocus = activePracticeSession?.sharedResult?.starting_index?.focus_dimension
    ?? activePracticeSession?.sharedResult?.first_focus?.first_focus_label
    ?? "Specificity";
  const purchaseSuccessParams = {
    ...(moduleId ? { moduleId } : {}),
    ...(params.gate ? { gate: params.gate } : {}),
  };

  useEffect(() => {
    if (params.source !== "debrief") return;
    const screen = `pay${stage}`;
    safeLog("[evidence] native post-rehearsal screen", {
      platform: Platform.OS,
      screen,
      step: `${stage}-of-3`,
    });
    const currentSession = activePracticeSession;
    if (!currentSession || currentSession.postRehearsalState === screen) return;
    saveActivePracticeSession({
      ...currentSession,
      postRehearsalState: transitionPostRehearsal(currentSession.postRehearsalState, screen as "pay1" | "pay2" | "pay3"),
      updatedAt: Date.now(),
    }).catch((caught) => safeLog("[paywall] offer checkpoint failed", errorShape(caught)));
  }, [activePracticeSession, params.source, saveActivePracticeSession, stage]);

  useEffect(() => {
    if (isLoading) return;
    safeLog("[evidence] native store offer", {
      count: Number(Boolean(plans.monthly)) + Number(Boolean(plans.annual)),
      platform: Platform.OS,
      provider: "revenuecat",
      status: isApprovedStoreOffer ? "ready" : "iap-blocker",
    });
    safeLog("[evidence] native store product", {
      period: "monthly",
      price: monthlyTerms?.priceString ?? "missing",
      productId: plans.monthly?.product.identifier ?? "missing",
      provider: "revenuecat",
      trial: monthlyTerms?.trialDurationLabel ?? "missing",
    });
    safeLog("[evidence] native store product", {
      period: "annual",
      price: annualTerms?.priceString ?? "missing",
      productId: plans.annual?.product.identifier ?? "missing",
      provider: "revenuecat",
      trial: annualTerms?.trialDurationLabel ?? "missing",
    });
  }, [
    annualTerms?.priceString,
    annualTerms?.trialDurationLabel,
    isApprovedStoreOffer,
    isLoading,
    monthlyTerms?.priceString,
    monthlyTerms?.trialDurationLabel,
    plans.annual,
    plans.monthly,
  ]);

  useEffect(() => {
    if (!isPro || commerceState !== "ready") return;
    if (params.gate === "another-rehearsal") router.replace({ pathname: "/(tabs)/library", params: { view: "scenarios" } });
    else if (nextDeck) router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: nextDeck } });
    else router.replace("/(tabs)");
  }, [commerceState, isPro, nextDeck, params.gate, router]);

  const leave = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const navigateOffer = (event: "forward" | "back" | "dismiss"): void => {
    const next = transitionOffer(offer, event);
    if (next.isDismissed) leave();
    else setOffer(next);
  };

  const buy = async (): Promise<void> => {
    if (onVerifyAccount) { onVerifyAccount(); return; }
    if (isPro) {
      router.replace({ pathname: "/purchase-success", params: purchaseSuccessParams });
      return;
    }
    if (!selectedPackage || !isApprovedStoreOffer || purchase.isPending || restore.isPending) return;
    setCommerceState(transitionPurchase("ready", { type: "begin" }).state);
    tap("light");
    try {
      const result = await purchase.mutateAsync(selectedPackage);
      const next = result.status === "purchased"
        ? transitionPurchase("pending", { type: "provider_returned", hasActivePro: true })
        : result.status === "entitlement_delayed"
          ? transitionPurchase("pending", { type: "provider_returned", hasActivePro: false })
          : result.status === "pending"
            ? transitionPurchase("pending", { type: "provider_pending" })
            : transitionPurchase("pending", { type: "user_cancelled" });
      setCommerceState(next.state);
      if (next.shouldRouteToPurchased) {
        tap("success");
        router.replace({ pathname: "/purchase-success", params: purchaseSuccessParams });
      }
    } catch (error) {
      safeLog("[paywall] purchase failed", errorShape(error));
      setCommerceState(transitionPurchase("pending", { type: "provider_error" }).state);
    }
  };

  const onRestore = async (): Promise<void> => {
    if (onVerifyAccount) { onVerifyAccount(); return; }
    if (restore.isPending || purchase.isPending || actions.isRestoreDisabled) return;
    setCommerceState(transitionRestore("ready", { type: "begin" }).state);
    try {
      const restored = await restore.mutateAsync();
      const next = transitionRestore("restoring", { type: "provider_returned", hasActivePro: restored });
      setCommerceState(next.state);
      if (next.shouldRouteToPurchased) {
        router.replace({ pathname: "/purchase-success", params: purchaseSuccessParams });
      }
    } catch (error) {
      safeLog("[paywall] restore failed", errorShape(error));
      setCommerceState(transitionRestore("restoring", { type: "provider_error" }).state);
    }
  };

  const onPrimaryAction = async (): Promise<void> => {
    if (actions.primaryAction === "continue") {
      router.replace({ pathname: "/purchase-success", params: purchaseSuccessParams });
      return;
    }
    if (actions.primaryAction === "check_access") {
      await customer.refetch();
      return;
    }
    if (actions.primaryAction === "purchase") await buy();
  };

  if (earnedOfferBlocked) {
    return <Unavailable title="Finish your free result first." body="Your offer appears after Pressure Moment, Practice Shift, Starting Index, and practice path are complete." onBack={leave} />;
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressCard onPress={() => navigateOffer("back")} style={styles.topHit} accessibilityLabel="Back"><Text style={styles.topText}>Back</Text></PressCard>
        <Text style={styles.step}>{stage} OF 3</Text>
        <PressCard onPress={() => navigateOffer("dismiss")} style={[styles.topHit, styles.closeHit]} accessibilityLabel="Close offer. Keep my free debrief for now"><Text style={styles.topText}>Close</Text></PressCard>
      </View>

      {normalBillingEnabled && (purchase.error || restore.error) ? <Text>{purchase.error?.message || restore.error?.message}</Text> : null}
      {!normalBillingEnabled ? <PrimaryButton label="Log in before purchasing" disabled={purchase.isPending || restore.isPending} onPress={() => router.push("/continue-from-web")} /> : null}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          stage === 1 && styles.stageOneScroll,
          stage === 2 && styles.centeredStageScroll,
          { paddingBottom: 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {stage === 1 ? (
          <StageOne
            moduleName={practiceModule?.name ?? "Make a Clear Ask"}
            modulePreview={practiceModule?.promise ?? "Practice saying it clearly, holding it through pushback, and putting it in your own words."}
            focus={practiceFocus}
            monthlyPrice={monthlyTerms?.priceString ?? null}
            annualPrice={annualTerms?.priceString ?? null}
          />
        ) : null}
        {stage === 2 ? <StageTwo /> : null}
        {stage === 3 ? (
          <StageThree
            plans={plans}
            billing={billing}
            onBilling={setBilling}
            terms={terms}
            isLoading={isLoading}
            unavailable={Boolean(offeringsError || !isApprovedStoreOffer || !selectedPackage)}
            commerceState={commerceState}
            onPrivacy={() => router.push("/privacy")}
            onRestore={() => void onRestore()}
            isRestoreDisabled={actions.isRestoreDisabled}
            onManageSubscription={SUBSCRIPTION_MANAGEMENT_URL ? () => void Linking.openURL(SUBSCRIPTION_MANAGEMENT_URL) : undefined}
          />
        ) : null}
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        {stage === 3 && onVerifyAccount ? <Text style={styles.link}>Create an account or sign in before purchasing. Continuing does not charge you.</Text> : null}
        {stage < 3 ? <PrimaryButton label="Continue" onPress={() => navigateOffer("forward")} compact={stage === 1} /> : (
          <>
            <PrimaryButton
              label={actions.primaryLabel}
              onPress={() => void onPrimaryAction()}
              disabled={actions.isPrimaryDisabled || (actions.primaryAction === "purchase" && !isApprovedStoreOffer)}
            />
          </>
        )}

      </StateDock>
    </View>
  );
}

function StageOne({ moduleName, modulePreview, focus, monthlyPrice }: { moduleName: string; modulePreview: string; focus: string; monthlyPrice: string | null; annualPrice: string | null }) {
  const [isPlanOpen, setIsPlanOpen] = useState<boolean>(false);
  const isReduced = useReducedMotion();
  const segmentProgress = useRef<Animated.Value[]>(
    Array.from({ length: 7 }, () => new Animated.Value(isReduced ? 1 : 0)),
  ).current;

  useEffect(() => {
    if (isReduced) {
      segmentProgress.forEach((value) => value.setValue(1));
      return;
    }
    segmentProgress.forEach((value) => value.setValue(0));
    const entrance = Animated.stagger(
      85,
      segmentProgress.map((value) => Animated.timing(value, {
        toValue: 1,
        duration: 520,
        easing: Easing.bezier(0.2, 0.9, 0.25, 1),
        useNativeDriver: true,
      })),
    );
    entrance.start();
    return () => entrance.stop();
  }, [isReduced, segmentProgress]);

  const focusLabel = (focus || DEFAULT_FOCUS_LABEL.replace("Focus: ", "")).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <Reveal style={styles.stageOne}>
      <View style={styles.offerHero}>
        <Text style={styles.trialEyebrow}>YOUR PRACTICE SUBSCRIPTION</Text>
        <Text style={styles.offerTitle}>Build your practice</Text>
        <Text style={styles.priceLine}>{monthlyPrice ? `${monthlyPrice} monthly. Renews until cancelled.` : "Store pricing will be shown before checkout."}</Text>

        <View style={styles.sevenSegments} accessibilityLabel="Your practice path">
          {segmentProgress.map((progress, index) => (
            <Animated.View
              key={index}
              style={[
                styles.sevenSegment,
                {
                  opacity: progress,
                  transform: [
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [index % 2 === 0 ? -22 : 22, 0] }) },
                    { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.trialSupport}>Ten lessons and two module closes, at your own pace.</Text>
      </View>

      <PressCard
        onPress={() => setIsPlanOpen((current) => !current)}
        accessibilityLabel={`${isPlanOpen ? "Hide" : "Show"} your practice plan`}
        containerStyle={styles.planDisclosureHit}
        style={styles.planDisclosure}
      >
        <View>
          <Text style={styles.planDisclosureTitle}>Your practice plan</Text>
          <Text style={styles.planDisclosureHint}>{isPlanOpen ? "Tap to hide details" : "See where you’ll start"}</Text>
        </View>
        <ChevronDown
          size={20}
          color={C.purple}
          style={{ transform: [{ rotate: isPlanOpen ? "180deg" : "0deg" }] }}
        />
      </PressCard>

      {isPlanOpen ? (
        <View style={styles.planCard}>
          <Text style={styles.moduleEyebrow}>First module</Text>
          <Text style={styles.moduleTitle}>{moduleName}</Text>
          <View style={styles.focusPill}>
            <Text style={styles.focusPillText}>Focus: {focusLabel}</Text>
          </View>
          <Text style={styles.modulePreview}>Start with a clear ask. {modulePreview}</Text>
        </View>
      ) : null}
    </Reveal>
  );
}

function StageTwo() {
  return <Reveal><Eyebrow color={C.dim}>Your subscription</Eyebrow><Text style={styles.title}>You control whether your subscription renews.</Text><Text style={styles.lede}>Review the monthly price before confirming in the store. Any introductory offer and your eligibility are confirmed by the store, not promised here. Cancel in your store subscription settings before renewal.</Text><View style={styles.timeline}><TimelineRow active label="Today" detail="Access begins after store confirmation" /><TimelineRow label="Every month" detail="Your subscription renews unless cancelled." /><TimelineRow label="Your choice" detail="Manage or cancel in your store subscription settings." last /></View></Reveal>;
}

function StageThree({ plans, billing, onBilling, terms, isLoading, unavailable, commerceState, onPrivacy, onRestore, isRestoreDisabled, onManageSubscription }: { plans: { monthly: PurchasesPackage | null; annual: PurchasesPackage | null }; billing: "monthly" | "annual"; onBilling: (value: "monthly" | "annual") => void; terms: ReturnType<typeof storeProductSnapshot>; isLoading: boolean; unavailable: boolean; commerceState: CommercePresentationState; onPrivacy: () => void; onRestore: () => void; isRestoreDisabled: boolean; onManageSubscription?: () => void }) {
  const selectedRenewal = terms?.priceString && terms.periodLabel ? `${terms.priceString} every ${terms.periodLabel}` : "the price confirmed by the store";
  return <Reveal><Eyebrow color={C.dim}>Monthly subscription</Eyebrow><Text style={styles.title}>{terms ? `${selectedRenewal}.` : "Review your store offer."}</Text>
    {isLoading ? <ActivityIndicator color={C.purple} style={styles.loading} /> : unavailable ? <IapBlocker /> : <>
      {plans.monthly ? <PlanChoice label="Monthly option" price={plans.monthly.product.priceString} selected={billing === "monthly"} onPress={() => onBilling("monthly")} /> : null}
      <GlassCard style={styles.termsCard}><Text style={styles.lede}>Full access to all ten launch lessons and both module closes. Lessons unlock in order as you finish them.</Text></GlassCard>
    </>}
    {commerceState !== "ready" ? <StatusCard state={commerceState} /> : null}
    <Text style={styles.renewalCopy}>Renews automatically at {selectedRenewal} unless cancelled. Any introductory offer is subject to store eligibility and confirmation.</Text>
    <View style={styles.links}>
      {onManageSubscription ? <PressCard onPress={onManageSubscription} accessibilityLabel="Manage or cancel subscription"><Text style={styles.billingLink}>Manage or cancel subscription</Text></PressCard> : null}
      <PressCard onPress={onPrivacy} accessibilityLabel="Privacy"><Text style={styles.link}>Privacy</Text></PressCard>
      <PressCard onPress={() => void Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} accessibilityLabel="Terms of use"><Text style={styles.link}>Terms of use</Text></PressCard>
      <PressCard onPress={onRestore} disabled={isRestoreDisabled} accessibilityLabel="Restore purchases"><Text style={styles.link}>Restore purchases</Text></PressCard>
    </View>
  </Reveal>;
}

function IapBlocker() {
  return <View style={styles.iapBlocker}><AlertCircle size={20} color={C.clay} /><View style={styles.iapBlockerCopy}><Text style={styles.iapBlockerTitle}>In-app purchase configuration required</Text><Text style={styles.iapBlockerBody}>The store has not returned the approved monthly subscription. Checkout stays disabled until the store offer is available. You can still restore an existing purchase.</Text></View></View>;
}

function PlanChoice({ label, price, selected, onPress }: { label: string; price: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={`${label}, ${price}`} accessibilityRole="radio" accessibilityState={{ selected }}><View style={[styles.plan, selected && styles.planSelected]}><View><Text style={styles.planLabel}>{label}</Text><Text style={styles.planPrice}>{price}</Text></View>{selected ? <Check size={18} color={C.purple} /> : null}</View></PressCard>;
}

function TimelineRow({ label, detail, active = false, last = false }: { label: string; detail: string; active?: boolean; last?: boolean }) {
  return <View style={styles.timelineRow}><View style={styles.rail}><View style={[styles.railDot, active && styles.railDotOn]} />{!last ? <View style={styles.railLine} /> : null}</View><View style={styles.timelineCopy}><Text style={styles.timelineLabel}>{label.toUpperCase()}</Text><Text style={styles.timelineDetail}>{detail}</Text></View></View>;
}

function StatusCard({ state }: { state: CommercePresentationState }) {
  const copy = commerceStatusMessage(state) ?? "Ready";
  const Icon = state === "restoring" || state === "pending" ? RefreshCw : state === "cancelled" ? Clock3 : AlertCircle;
  const isFailure = state === "failed" || state === "restore_failed";
  return <View style={styles.status}><Icon size={17} color={isFailure ? C.clay : C.purple} /><Text style={styles.statusText}>{copy}</Text></View>;
}

function Unavailable({ title, body, onBack }: { title: string; body: string; onBack: () => void }) {
  return <View style={[styles.root, styles.center]}><Backdrop /><ShieldCheck size={30} color={C.purple} /><Text style={styles.title}>{title}</Text><Text style={[styles.lede, styles.centerText]}>{body}</Text><PrimaryButton label="Back to my result" onPress={onBack} containerStyle={styles.unavailableButton} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { alignItems: "center", justifyContent: "center", padding: GUTTER }, centerText: { textAlign: "center" }, unavailableButton: { width: "100%", marginTop: 28 },
  top: { minHeight: 58, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, topHit: { width: 72, minHeight: 44, justifyContent: "center" }, closeHit: { alignItems: "flex-end" }, topText: { ...T.support, color: C.textSoft, fontSize: 15 }, step: { ...eyebrow, color: C.dim, fontSize: 10 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, stageOneScroll: { flexGrow: 1, justifyContent: "flex-start", paddingTop: 12 }, centeredStageScroll: { flexGrow: 1, justifyContent: "center" },
  stageOne: { alignItems: "stretch" },
  title: { ...T.display, fontFamily: font.bold, fontSize: 29, lineHeight: 36, marginTop: 10 }, lede: { ...T.body, color: C.textSoft, marginTop: 14 },
  offerHero: { alignItems: "center", paddingTop: 22, paddingBottom: 28 }, trialEyebrow: { ...eyebrow, color: C.purple, fontSize: 10 }, offerTitle: { fontFamily: font.bold, fontSize: 43, lineHeight: 50, letterSpacing: -1.4, color: C.text, marginTop: 9 }, priceLine: { ...T.support, color: C.textSoft, textAlign: "center", fontSize: 15, lineHeight: 21, marginTop: 5 }, trialSupport: { ...T.caption, color: C.textSoft, textAlign: "center", fontSize: 12, marginTop: 14 },
  sevenSegments: { width: "100%", flexDirection: "row", gap: 7, marginTop: 27, overflow: "hidden", paddingVertical: 3 }, sevenSegment: { flex: 1, height: 11, borderRadius: 6, backgroundColor: C.purple },
  planDisclosureHit: { width: "100%" }, planDisclosure: { minHeight: 64, borderTopWidth: 1, borderBottomWidth: 1, borderColor: `${C.purple}24`, paddingVertical: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planDisclosureTitle: { ...T.support, color: C.purple, fontFamily: font.semi, fontSize: 14 }, planDisclosureHint: { ...T.caption, color: C.textSoft, fontSize: 11, marginTop: 2 },
  planCard: { marginTop: 14, borderRadius: radius.lg, backgroundColor: C.elevated, paddingHorizontal: 16, paddingVertical: 15, shadowColor: "#1C2430", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  moduleEyebrow: { ...eyebrow, color: C.dim, fontSize: 8 }, moduleTitle: { ...T.title, color: C.text, fontFamily: font.bold, fontSize: 17, lineHeight: 22, marginTop: 3 }, focusPill: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: C.purpleSoft, paddingHorizontal: 9, paddingVertical: 3, marginTop: 7 }, focusPillText: { ...T.caption, color: C.purple, fontFamily: font.semi, fontSize: 10, lineHeight: 16 }, modulePreview: { ...T.support, color: C.textSoft, fontSize: 13, lineHeight: 18, marginTop: 7 },
  timeline: { marginTop: 32 }, checkoutTimeline: { marginTop: 22 }, timelineRow: { flexDirection: "row", minHeight: 76 }, rail: { width: 20, alignItems: "center" }, railDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.bg, borderWidth: 2, borderColor: C.purple }, railDotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.purple }, railLine: { width: 2, flex: 1, backgroundColor: `${C.purple}35` }, timelineCopy: { flex: 1, paddingLeft: 10, paddingBottom: 16 }, timelineLabel: { ...eyebrow, color: C.dim, fontSize: 10 }, timelineDetail: { ...T.body, color: C.text, marginTop: 3, fontSize: 16, lineHeight: 23 },
  loading: { marginTop: 50 }, planList: { gap: 10, marginTop: 24 }, plan: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft }, planLabel: { ...T.support, fontFamily: font.semi, color: C.text }, planPrice: { ...T.caption, marginTop: 4 },
  termsCard: { marginTop: 18, padding: 18, gap: 12 }, termRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, termLabel: { ...T.caption }, termValue: { ...T.caption, fontFamily: font.semi, color: C.text, textAlign: "right", flex: 1 }, status: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: C.surface, flexDirection: "row", alignItems: "flex-start", gap: 10 }, statusText: { ...T.caption, color: C.text, flex: 1 },
  renewalCopy: { ...T.caption, color: C.textSoft, marginTop: 18, lineHeight: 20 }, links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: 18, rowGap: 0, marginTop: 16 }, link: { ...T.caption, color: C.textSoft, paddingVertical: 10 }, billingLink: { ...T.caption, color: C.textSoft }, disabledText: { color: C.dim },
  iapBlocker: { marginTop: 28, borderRadius: radius.md, borderWidth: 1, borderColor: `${C.clay}55`, backgroundColor: `${C.clay}0D`, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }, iapBlockerCopy: { flex: 1, gap: 5 }, iapBlockerTitle: { ...T.support, fontFamily: font.semi, color: C.text }, iapBlockerBody: { ...T.caption, color: C.textSoft },
});
