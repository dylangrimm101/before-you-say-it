import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Check, Clock3, RefreshCw, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { Backdrop, Eyebrow, GhostButton, GlassCard, PressCard, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
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

const VALUE_POINTS: readonly string[] = [
  "A short lesson tied to your first focus",
  "A spoken attempt with contextual pushback",
  "One evidence-linked adjustment, then the same moment again.",
  "The full eight-module curriculum, without daily lockouts",
];

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
  const purchaseLabel = isApprovedStoreOffer && terms ? "Start my free trial" : "Store setup required";
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
        <PressCard onPress={() => navigateOffer("back")} style={styles.iconButton} accessibilityLabel="Back"><ArrowLeft size={20} color={C.textSoft} /></PressCard>
        <Text style={styles.step}>OFFER · {stage} OF 3</Text>
        <PressCard onPress={() => void onRestore()} disabled={actions.isRestoreDisabled} style={styles.restoreHit} accessibilityLabel="Restore purchase"><Text style={[styles.restoreText, actions.isRestoreDisabled && styles.disabledText]}>Restore</Text></PressCard>
      </View>
      <View style={styles.progress}>{([1, 2, 3] as const).map((value) => <View key={value} style={[styles.progressPart, value <= stage && styles.progressOn]} />)}</View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 180 }]} showsVerticalScrollIndicator={false}>
        {stage === 1 ? <StageOne moduleName={recommendedModule?.name} /> : null}
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
        <GhostButton label="Keep my free debrief for now" onPress={() => navigateOffer("dismiss")} style={styles.secondary} />
      </StateDock>
    </View>
  );
}

function StageOne({ moduleName }: { moduleName?: string }) {
  return <Reveal><Eyebrow color={C.purple}>Your practice plan</Eyebrow><Text style={styles.title}>{moduleName ? `Start with ${moduleName}.` : "Practice the moment you just found."}</Text><Text style={styles.lede}>Based on this rehearsal, your first 7 days start where the conversation got stuck.</Text><View style={styles.planSummary}><DetailLine label="First module" value={moduleName ?? "Your first focus"} /><DetailLine label="Training focus" value="Keep the request usable after pushback" /></View><View style={styles.valueList}>{VALUE_POINTS.slice(0, 3).map((point, index) => <View key={point} style={styles.valueRow}><Text style={styles.valueNumber}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.valueText}>{point}</Text></View>)}</View><View style={styles.pricingSummary}><Text style={styles.trialPrice}>7 days free</Text><Text style={styles.priceLine}>then $11.99/month or $89.99/year · cancel anytime</Text><Text style={styles.priceNote}>The final screen verifies the live App Store or Google Play offer before purchase.</Text></View></Reveal>;
}

function StageTwo() {
  return <Reveal><Eyebrow color={C.purple}>No surprise charge</Eyebrow><Text style={styles.title}>We’ll email you 3 days before your free trial ends.</Text><Text style={styles.lede}>You’ll have time to decide whether you want to continue.</Text><View style={styles.timeline}><TimelineRow active label="Today" detail="Trial begins" /><TimelineRow label="3 days before it ends" detail="We’ll email you a reminder." /><TimelineRow label="Trial end" detail="You’ll be charged unless you cancel before the trial ends." last /></View></Reveal>;
}

function StageThree({ plans, billing, onBilling, terms, isLoading, unavailable, commerceState, onPrivacy }: { plans: { monthly: PurchasesPackage | null; annual: PurchasesPackage | null }; billing: "monthly" | "annual"; onBilling: (value: "monthly" | "annual") => void; terms: ReturnType<typeof storeProductSnapshot>; isLoading: boolean; unavailable: boolean; commerceState: CommercePresentationState; onPrivacy: () => void }) {
  return <Reveal><Eyebrow color={C.purple}>Your plan</Eyebrow><Text style={styles.title}>Start your free trial</Text><Text style={styles.lede}>7 days free, then $11.99/month or $89.99/year.</Text>{isLoading ? <ActivityIndicator color={C.purple} style={styles.loading} /> : unavailable ? <IapBlocker /> : <><View style={styles.planList}>{plans.monthly ? <PlanChoice label="Monthly option" price={plans.monthly.product.priceString} selected={billing === "monthly"} onPress={() => onBilling("monthly")} /> : null}{plans.annual ? <PlanChoice label="Annual option" price={plans.annual.product.priceString} selected={billing === "annual"} onPress={() => onBilling("annual")} /> : null}</View><GlassCard style={styles.termsCard}><View style={styles.termRow}><Text style={styles.termLabel}>Price</Text><Text style={styles.termValue}>{terms?.priceString}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Cadence</Text><Text style={styles.termValue}>{terms?.periodLabel}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Trial</Text><Text style={styles.termValue}>{terms?.trialDurationLabel} free</Text></View></GlassCard></>}{commerceState !== "ready" ? <StatusCard state={commerceState} /> : null}<View style={styles.links}><PressCard onPress={() => void Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} accessibilityLabel="Terms"><Text style={styles.link}>Terms</Text></PressCard><Text style={styles.dot}>·</Text><PressCard onPress={onPrivacy} accessibilityLabel="Privacy"><Text style={styles.link}>Privacy</Text></PressCard><Text style={styles.dot}>·</Text><Text style={styles.billingLink}>Billing & cancellation</Text></View></Reveal>;
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
  return <View style={styles.timelineRow}><View style={styles.rail}><View style={[styles.railDot, active && styles.railDotOn]} />{!last ? <View style={styles.railLine} /> : null}</View><View style={styles.timelineCopy}><Text style={styles.timelineLabel}>{label}</Text><Text style={styles.timelineDetail}>{detail}</Text></View></View>;
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
  top: { minHeight: 58, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, restoreHit: { minWidth: 70, minHeight: 44, alignItems: "flex-end", justifyContent: "center" }, restoreText: { ...T.caption, fontFamily: font.semi, color: C.purple }, step: { ...eyebrow, color: C.dim },
  progress: { flexDirection: "row", gap: 6, paddingHorizontal: GUTTER, marginBottom: 18 }, progressPart: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.track }, progressOn: { backgroundColor: C.purple }, scroll: { paddingHorizontal: GUTTER, paddingTop: 18 },
  title: { ...T.display, marginTop: 10 }, lede: { ...T.body, color: C.textSoft, marginTop: 14 }, planSummary: { marginTop: 24, borderRadius: radius.md, backgroundColor: C.surface, paddingHorizontal: 16 }, detailLine: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, detailLineLabel: { ...eyebrow, color: C.dim }, detailLineValue: { ...T.support, color: C.text, fontFamily: font.semi, marginTop: 4 }, valueList: { marginTop: 20 }, valueRow: { flexDirection: "row", gap: 14, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, valueNumber: { ...eyebrow, color: C.purple, width: 24 }, valueText: { ...T.support, color: C.text, flex: 1 },
  timeline: { marginTop: 34 }, timelineRow: { flexDirection: "row", minHeight: 82 }, rail: { width: 20, alignItems: "center" }, railDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.track, borderWidth: 2, borderColor: C.bg }, railDotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.purple }, railLine: { width: 1, flex: 1, backgroundColor: C.lineStrong }, timelineCopy: { flex: 1, paddingLeft: 10, paddingBottom: 20 }, timelineLabel: { ...T.support, fontFamily: font.semi, color: C.text }, timelineDetail: { ...T.caption, marginTop: 4 },
  loading: { marginTop: 50 }, planList: { gap: 10, marginTop: 24 }, plan: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft }, planLabel: { ...T.support, fontFamily: font.semi, color: C.text }, planPrice: { ...T.caption, marginTop: 4 },
  termsCard: { marginTop: 18, padding: 18, gap: 12 }, termRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, termLabel: { ...T.caption }, termValue: { ...T.caption, fontFamily: font.semi, color: C.text, textAlign: "right", flex: 1 }, status: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: C.surface, flexDirection: "row", alignItems: "flex-start", gap: 10 }, statusText: { ...T.caption, color: C.text, flex: 1 },
  pricingSummary: { alignItems: "center", marginTop: 28, paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, gap: 5 }, trialPrice: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, color: C.purple, textAlign: "center" }, priceLine: { ...T.support, fontFamily: font.semi, color: C.text, textAlign: "center" }, priceNote: { ...T.caption, color: C.dim, textAlign: "center", maxWidth: 310 }, links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }, link: { ...T.caption, color: C.purple, textDecorationLine: "underline", paddingVertical: 10 }, billingLink: { ...T.caption, color: C.purple }, dot: { ...T.caption }, disabledText: { color: C.dim }, secondary: { marginTop: 8 },
  iapBlocker: { marginTop: 28, borderRadius: radius.md, borderWidth: 1, borderColor: `${C.clay}55`, backgroundColor: `${C.clay}0D`, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }, iapBlockerCopy: { flex: 1, gap: 5 }, iapBlockerTitle: { ...T.support, fontFamily: font.semi, color: C.text }, iapBlockerBody: { ...T.caption, color: C.textSoft },
});
