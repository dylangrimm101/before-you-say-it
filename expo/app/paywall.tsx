import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, Check, Clock3, RefreshCw, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { Backdrop, Eyebrow, GlassCard, PressCard, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
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
import { transitionPostRehearsal } from "@/lib/postRehearsalFlow";
import { errorShape, safeLog } from "@/lib/redact";
import { useCustomerInfo, useIsPro, useOfferings, usePurchasePackage, useRestorePurchases } from "@/lib/purchases";
import { useStore } from "@/providers/store";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

const TRAINING_FOCUS_BY_MODULE: Partial<Record<ModuleId, string>> = {
  get_to_the_point: "Clarity",
  make_a_clear_ask: "Specificity",
  start_the_conversation: "Clarity",
  listen_and_respond: "Listening",
  stay_clear_under_pushback: "Steadiness",
  pause_say_no_boundary: "Boundaries",
  repair_what_went_wrong: "Repair",
  use_it_in_real_life: "Clarity",
};

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gate?: string; source?: string; moduleId?: string }>();
  const isPro = useIsPro();
  const { activePracticeSession, saveActivePracticeSession } = useStore();
  const moduleId: ModuleId | null = isModuleId(params.moduleId) ? params.moduleId : activePracticeSession?.recommendation?.moduleId ?? null;
  const recommendedModule = curriculumModule(moduleId);
  const { data: offerings, isLoading, error: offeringsError } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();
  const customer = useCustomerInfo();
  const [offer, setOffer] = useState<OfferState<SharedResultContractV1 | undefined>>(() => openOffer(activePracticeSession?.sharedResult));
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [commerceState, setCommerceState] = useState<CommercePresentationState>("ready");
  const stage = offer.stage;

  const plans = useMemo((): { monthly: PurchasesPackage | null; annual: PurchasesPackage | null } => {
    const current = offerings?.current;
    return { monthly: current?.monthly ?? null, annual: current?.annual ?? null };
  }, [offerings]);
  const selectedPackage = billing === "annual" ? plans.annual ?? plans.monthly : plans.monthly ?? plans.annual;
  const terms = storeProductSnapshot(selectedPackage?.product);
  const monthlyTerms = storeProductSnapshot(plans.monthly?.product);
  const annualTerms = storeProductSnapshot(plans.annual?.product);
  const isApprovedStoreOffer = Boolean(
    plans.monthly && plans.annual
      && monthlyTerms?.trialDurationLabel === "7 days"
      && annualTerms?.trialDurationLabel === "7 days",
  );
  const purchaseLabel = "Start my free trial";
  const actions = commerceActionPresentation(commerceState, isPro, purchaseLabel);
  const hasCompleteEarnedResult = Boolean(activePracticeSession?.sharedResult?.pressure_moment && activePracticeSession.sharedResult.practice_shift && activePracticeSession.sharedResult.starting_index && activePracticeSession.sharedResult.first_focus);
  const earnedOfferBlocked = params.source === "debrief" && !hasCompleteEarnedResult;

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
    if (moduleId) router.replace({ pathname: "/module/[day]", params: { day: moduleId } });
    else router.replace("/(tabs)");
  }, [commerceState, isPro, moduleId, router]);

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
    if (isPro) {
      router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
      return;
    }
    if (!selectedPackage || purchase.isPending) return;
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
        router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
      }
    } catch (error) {
      safeLog("[paywall] purchase failed", errorShape(error));
      setCommerceState(transitionPurchase("pending", { type: "provider_error" }).state);
    }
  };

  const onRestore = async (): Promise<void> => {
    if (restore.isPending || purchase.isPending || actions.isRestoreDisabled) return;
    setCommerceState(transitionRestore("ready", { type: "begin" }).state);
    try {
      const restored = await restore.mutateAsync();
      const next = transitionRestore("restoring", { type: "provider_returned", hasActivePro: restored });
      setCommerceState(next.state);
      if (next.shouldRouteToPurchased) {
        router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
      }
    } catch (error) {
      safeLog("[paywall] restore failed", errorShape(error));
      setCommerceState(transitionRestore("restoring", { type: "provider_error" }).state);
    }
  };

  const onPrimaryAction = async (): Promise<void> => {
    if (actions.primaryAction === "continue") {
      router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
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

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          stage === 1 && styles.centeredStageScroll,
          stage === 2 && styles.centeredStageScroll,
          { paddingBottom: 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {stage === 1 ? <StageOne moduleId={moduleId} moduleName={recommendedModule?.name} trainingFocus={activePracticeSession?.sharedResult?.starting_index?.focus_dimension} /> : null}
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
          />
        ) : null}
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        {stage < 3 ? <PrimaryButton label="Continue" onPress={() => navigateOffer("forward")} /> : (
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

function StageOne({ moduleId, moduleName, trainingFocus }: { moduleId: ModuleId | null; moduleName?: string; trainingFocus?: string }) {
  const firstModule = moduleName ?? "Your first focus";
  const focus = trainingFocus?.trim() || (moduleId ? TRAINING_FOCUS_BY_MODULE[moduleId] ?? "Clarity" : "Clarity");
  return <Reveal style={styles.stageOne}><Eyebrow color={C.dim}>Your practice plan</Eyebrow><Text style={[styles.title, styles.centerTitle]}>{`Start with ${firstModule}.`}</Text><Text style={[styles.lede, styles.centerLede]}>Based on this rehearsal, your first 7 days start where the conversation got stuck.</Text><View style={styles.planCard}><DetailLine label="First module" value={firstModule} /><DetailLine label="Training focus" value={focus} /><View style={styles.repList} accessibilityLabel="One evidence-linked adjustment, then the same moment again."><Text style={styles.repText}>Rep 1 · Say the clear version out loud</Text><Text style={styles.repText}>Rep 2 · Hold it when they push back</Text><Text style={styles.repText}>Rep 3 · Say it clean, in your own words</Text></View></View><View style={styles.freeLockup}><Text style={styles.seven}>7</Text><View><Text style={styles.days}>days</Text><Text style={styles.free}>free</Text></View></View><Text style={styles.priceLine}>then $11.99/month or $89.99/year · cancel anytime</Text><View style={styles.sevenSegments}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.sevenSegment} />)}</View></Reveal>;
}

function StageTwo() {
  return <Reveal><Eyebrow color={C.dim}>No surprise charge</Eyebrow><Text style={styles.title}>We’ll email you 3 days before your free trial ends.</Text><Text style={styles.lede}>You’ll have time to decide whether you want to continue.</Text><View style={styles.timeline}><TimelineRow active label="Today" detail="Trial begins" /><TimelineRow label="3 days before it ends" detail="We’ll email you a reminder." /><TimelineRow label="Trial end" detail="You’ll be charged unless you cancel before the trial ends." last /></View></Reveal>;
}

function StageThree({ plans, billing, onBilling, terms, isLoading, unavailable, commerceState, onPrivacy, onRestore, isRestoreDisabled }: { plans: { monthly: PurchasesPackage | null; annual: PurchasesPackage | null }; billing: "monthly" | "annual"; onBilling: (value: "monthly" | "annual") => void; terms: ReturnType<typeof storeProductSnapshot>; isLoading: boolean; unavailable: boolean; commerceState: CommercePresentationState; onPrivacy: () => void; onRestore: () => void; isRestoreDisabled: boolean }) {
  return <Reveal><Eyebrow color={C.dim}>Start your free trial</Eyebrow><Text style={styles.title}>7 days free, then $11.99/month.</Text><View style={styles.checkoutTimeline}><TimelineRow active label="Today" detail="Full access begins · no charge" /><TimelineRow label="Reminder date" detail="We’ll send your trial reminder" /><TimelineRow label="First charge date" detail="$11.99/month charged unless cancelled beforehand. Annual option: $89.99/year." last /></View>{isLoading ? <ActivityIndicator color={C.purple} style={styles.loading} /> : unavailable ? <IapBlocker /> : <><View style={styles.planList}>{plans.monthly ? <PlanChoice label="Monthly option" price={plans.monthly.product.priceString} selected={billing === "monthly"} onPress={() => onBilling("monthly")} /> : null}{plans.annual ? <PlanChoice label="Annual option" price={plans.annual.product.priceString} selected={billing === "annual"} onPress={() => onBilling("annual")} /> : null}</View><GlassCard style={styles.termsCard}><View style={styles.termRow}><Text style={styles.termLabel}>Store price</Text><Text style={styles.termValue}>{terms?.priceString}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Billing</Text><Text style={styles.termValue}>{terms?.periodLabel}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Introductory trial</Text><Text style={styles.termValue}>{terms?.trialDurationLabel} free</Text></View></GlassCard></>}{commerceState !== "ready" ? <StatusCard state={commerceState} /> : null}<Text style={styles.renewalCopy}>Renews automatically after the trial. Monthly is $11.99/month. Annual is $89.99/year. Cancel in your App Store or Google Play subscription settings.</Text><View style={styles.links}><PressCard onPress={() => void Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} accessibilityLabel="Terms"><Text style={styles.link}>Terms</Text></PressCard><PressCard onPress={onPrivacy} accessibilityLabel="Privacy"><Text style={styles.link}>Privacy</Text></PressCard><Text style={styles.billingLink}>Billing & cancellation</Text><PressCard onPress={onRestore} disabled={isRestoreDisabled} accessibilityLabel="Restore purchases"><Text style={[styles.link, isRestoreDisabled && styles.disabledText]}>Restore purchases</Text></PressCard></View></Reveal>;
}

function IapBlocker() {
  return <View style={styles.iapBlocker}><AlertCircle size={20} color={C.clay} /><View style={styles.iapBlockerCopy}><Text style={styles.iapBlockerTitle}>In-app purchase configuration required</Text><Text style={styles.iapBlockerBody}>The live store has not returned both approved plans with a 7-day trial. Trial checkout stays disabled until the App Store or Google Play offer is configured.</Text></View></View>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailLine}><Text style={styles.detailLineLabel}>{label}</Text><Text style={styles.detailLineValue}>{value}</Text></View>;
}

function PlanChoice({ label, price, selected, onPress }: { label: string; price: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={`${label}, ${price}`}><View style={[styles.plan, selected && styles.planSelected]}><View><Text style={styles.planLabel}>{label}</Text><Text style={styles.planPrice}>{price}</Text></View>{selected ? <Check size={18} color={C.purple} /> : null}</View></PressCard>;
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
  top: { minHeight: 58, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, topHit: { width: 72, minHeight: 44, justifyContent: "center" }, closeHit: { alignItems: "flex-end" }, topText: { ...T.support, color: C.textSoft, fontSize: 17 }, step: { ...eyebrow, color: C.dim, fontSize: 11 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, centeredStageScroll: { flexGrow: 1, justifyContent: "center" },
  stageOne: { alignItems: "stretch" },
  title: { ...T.display, fontFamily: font.bold, fontSize: 29, lineHeight: 36, marginTop: 10 }, centerTitle: { textAlign: "center", marginTop: 26 }, lede: { ...T.body, color: C.textSoft, marginTop: 14 }, centerLede: { textAlign: "center" },
  planCard: { marginTop: 24, borderRadius: radius.lg, backgroundColor: C.elevated, paddingHorizontal: 16, paddingVertical: 8, shadowColor: "#1C2430", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 3 }, detailLine: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, detailLineLabel: { ...T.support, color: C.textSoft }, detailLineValue: { ...T.support, color: C.text, fontFamily: font.semi, flex: 1, textAlign: "right" }, repList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 10, paddingBottom: 8, gap: 8 }, repText: { ...T.support, color: C.text },
  freeLockup: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, seven: { fontFamily: font.bold, fontSize: 76, lineHeight: 84, color: C.purple }, days: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, color: C.text }, free: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, color: C.purple }, sevenSegments: { flexDirection: "row", gap: 6, marginTop: 20 }, sevenSegment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.purple },
  timeline: { marginTop: 32 }, checkoutTimeline: { marginTop: 22 }, timelineRow: { flexDirection: "row", minHeight: 76 }, rail: { width: 20, alignItems: "center" }, railDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.bg, borderWidth: 2, borderColor: C.purple }, railDotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.purple }, railLine: { width: 2, flex: 1, backgroundColor: `${C.purple}35` }, timelineCopy: { flex: 1, paddingLeft: 10, paddingBottom: 16 }, timelineLabel: { ...eyebrow, color: C.dim, fontSize: 10 }, timelineDetail: { ...T.body, color: C.text, marginTop: 3, fontSize: 16, lineHeight: 23 },
  loading: { marginTop: 50 }, planList: { gap: 10, marginTop: 24 }, plan: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft }, planLabel: { ...T.support, fontFamily: font.semi, color: C.text }, planPrice: { ...T.caption, marginTop: 4 },
  termsCard: { marginTop: 18, padding: 18, gap: 12 }, termRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, termLabel: { ...T.caption }, termValue: { ...T.caption, fontFamily: font.semi, color: C.text, textAlign: "right", flex: 1 }, status: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: C.surface, flexDirection: "row", alignItems: "flex-start", gap: 10 }, statusText: { ...T.caption, color: C.text, flex: 1 },
  priceLine: { ...T.support, color: C.text, textAlign: "center", marginTop: 4 }, renewalCopy: { ...T.caption, color: C.textSoft, marginTop: 18, lineHeight: 20 }, links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: 18, rowGap: 0, marginTop: 16 }, link: { ...T.caption, color: C.textSoft, paddingVertical: 10 }, billingLink: { ...T.caption, color: C.textSoft }, disabledText: { color: C.dim },
  iapBlocker: { marginTop: 28, borderRadius: radius.md, borderWidth: 1, borderColor: `${C.clay}55`, backgroundColor: `${C.clay}0D`, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }, iapBlockerCopy: { flex: 1, gap: 5 }, iapBlockerTitle: { ...T.support, fontFamily: font.semi, color: C.text }, iapBlockerBody: { ...T.caption, color: C.textSoft },
});
