import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, Check, Clock3, RefreshCw, ShieldCheck } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import { Backdrop, Eyebrow, GhostButton, GlassCard, PressCard, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
import { curriculumModule, isModuleId, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { storeProductSnapshot } from "@/lib/commerce";
import {
  commerceStatusMessage,
  openOffer,
  transitionOffer,
  transitionPurchase,
  transitionRestore,
  type CommercePresentationState,
  type OfferState,
} from "@/lib/nativeCommerce";
import { errorShape, safeLog } from "@/lib/redact";
import { useIsPro, useOfferings, usePurchasePackage, useRestorePurchases } from "@/lib/purchases";
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
  const { devProEnabled, toggleDevPro, activePracticeSession } = useStore();
  const moduleId: ModuleId | null = isModuleId(params.moduleId) ? params.moduleId : activePracticeSession?.recommendation?.moduleId ?? null;
  const recommendedModule = curriculumModule(moduleId);
  const { data: offerings, isLoading, error: offeringsError } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();
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
  const hasCompleteEarnedResult = Boolean(activePracticeSession?.sharedResult?.pressure_moment && activePracticeSession.sharedResult.practice_shift && activePracticeSession.sharedResult.starting_index && activePracticeSession.sharedResult.first_focus);
  const earnedOfferBlocked = params.source === "debrief" && !hasCompleteEarnedResult;

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
    if (restore.isPending) return;
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

  if (earnedOfferBlocked) {
    return <Unavailable title="Finish your free result first." body="Your offer appears after Pressure Moment, Practice Shift, Starting Index, and practice path are complete." onBack={leave} />;
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressCard onPress={() => navigateOffer("back")} style={styles.iconButton} accessibilityLabel="Back"><ArrowLeft size={20} color={C.textSoft} /></PressCard>
        <Text style={styles.step}>OFFER · {stage} OF 3</Text>
        <PressCard onPress={() => void onRestore()} style={styles.restoreHit} accessibilityLabel="Restore purchase"><Text style={styles.restoreText}>Restore</Text></PressCard>
      </View>
      <View style={styles.progress}>{([1, 2, 3] as const).map((value) => <View key={value} style={[styles.progressPart, value <= stage && styles.progressOn]} />)}</View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 180 }]} showsVerticalScrollIndicator={false}>
        {stage === 1 ? <StageOne moduleName={recommendedModule?.name} /> : null}
        {stage === 2 ? <StageTwo trialDuration={terms?.trialDurationLabel ?? null} /> : null}
        {stage === 3 ? (
          <StageThree
            plans={plans}
            billing={billing}
            onBilling={setBilling}
            terms={terms}
            isLoading={isLoading}
            unavailable={Boolean(offeringsError || !selectedPackage)}
            commerceState={commerceState}
            onPrivacy={() => router.push("/privacy")}
          />
        ) : null}
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        {stage < 3 ? <PrimaryButton label="Continue" onPress={() => navigateOffer("forward")} /> : (
          <>
            <PrimaryButton
              label={commerceState === "pending" ? "Waiting for the store…" : terms?.trialDurationLabel ? `Start ${terms.trialDurationLabel} free trial` : terms ? `Continue · ${terms.priceString}` : "Plans unavailable"}
              onPress={() => void buy()}
              disabled={!isPro && (!selectedPackage || purchase.isPending || commerceState === "pending")}
            />
            {__DEV__ && !devProEnabled ? (
              <><GhostButton label="Unlock all modules for testing" onPress={async () => { if (!__DEV__) return; await toggleDevPro(true); router.replace("/(tabs)"); }} style={styles.devButton} /><Text style={styles.devNote}>Preview only · no purchase or subscription</Text></>
            ) : null}
          </>
        )}
        <GhostButton label="Keep my free debrief for now" onPress={() => navigateOffer("dismiss")} style={styles.secondary} />
      </StateDock>
    </View>
  );
}

function StageOne({ moduleName }: { moduleName?: string }) {
  return <Reveal><Eyebrow color={C.purple}>Your recommended practice path</Eyebrow><Text style={styles.title}>{moduleName ? `Start with ${moduleName}.` : "Practice the moment you just found."}</Text><Text style={styles.lede}>Your free rehearsal found a starting point. The paid path teaches one move, lets you say it under pressure, and gives you a focused retry.</Text><View style={styles.valueList}>{VALUE_POINTS.map((point, index) => <View key={point} style={styles.valueRow}><Text style={styles.valueNumber}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.valueText}>{point}</Text></View>)}</View></Reveal>;
}

function StageTwo({ trialDuration }: { trialDuration: string | null }) {
  return <Reveal><Eyebrow color={C.purple}>No surprise charge</Eyebrow><Text style={styles.title}>{trialDuration ? `Your store offers a ${trialDuration} trial.` : "Review the store terms before you decide."}</Text><Text style={styles.lede}>{trialDuration ? "The App Store or Google Play controls eligibility and renewal. BYSI will show only terms supplied for your account." : "A free trial is not currently confirmed for this account. The final screen shows the available provider terms without substituting an invented trial."}</Text><View style={styles.timeline}><TimelineRow active label="Today" detail={trialDuration ? "Trial begins after provider confirmation" : "You review the live offer"} /><TimelineRow label="Before renewal" detail="Manage or cancel through the verified purchase provider" /><TimelineRow label="Renewal" detail="The provider applies the terms shown at confirmation" last /></View></Reveal>;
}

function StageThree({ plans, billing, onBilling, terms, isLoading, unavailable, commerceState, onPrivacy }: { plans: { monthly: PurchasesPackage | null; annual: PurchasesPackage | null }; billing: "monthly" | "annual"; onBilling: (value: "monthly" | "annual") => void; terms: ReturnType<typeof storeProductSnapshot>; isLoading: boolean; unavailable: boolean; commerceState: CommercePresentationState; onPrivacy: () => void }) {
  return <Reveal><Eyebrow color={C.purple}>Provider terms</Eyebrow><Text style={styles.title}>Choose with the live store details in view.</Text><Text style={styles.lede}>Access starts only after RevenueCat reports an active pro entitlement.</Text>{isLoading ? <ActivityIndicator color={C.purple} style={styles.loading} /> : unavailable ? <StatusCard state="failed" /> : <View style={styles.planList}>{plans.monthly ? <PlanChoice label="Monthly option" price={plans.monthly.product.priceString} selected={billing === "monthly"} onPress={() => onBilling("monthly")} /> : null}{plans.annual ? <PlanChoice label="Annual option" price={plans.annual.product.priceString} selected={billing === "annual"} onPress={() => onBilling("annual")} /> : null}</View>}<GlassCard style={styles.termsCard}><View style={styles.termRow}><Text style={styles.termLabel}>Price</Text><Text style={styles.termValue}>{terms?.priceString ?? "Unavailable"}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Cadence</Text><Text style={styles.termValue}>{terms?.periodLabel ?? "Confirmed by provider"}</Text></View><View style={styles.termRow}><Text style={styles.termLabel}>Trial</Text><Text style={styles.termValue}>{terms?.trialDurationLabel ?? "No confirmed trial"}</Text></View></GlassCard>{commerceState !== "ready" ? <StatusCard state={commerceState} /> : null}<View style={styles.links}><PressCard onPress={() => void Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} accessibilityLabel="Terms"><Text style={styles.link}>Terms</Text></PressCard><Text style={styles.dot}>·</Text><PressCard onPress={onPrivacy} accessibilityLabel="Privacy"><Text style={styles.link}>Privacy in app</Text></PressCard></View></Reveal>;
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
  title: { ...T.display, marginTop: 10 }, lede: { ...T.body, color: C.textSoft, marginTop: 14 }, valueList: { marginTop: 28 }, valueRow: { flexDirection: "row", gap: 14, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, valueNumber: { ...eyebrow, color: C.purple, width: 24 }, valueText: { ...T.support, color: C.text, flex: 1 },
  timeline: { marginTop: 34 }, timelineRow: { flexDirection: "row", minHeight: 82 }, rail: { width: 20, alignItems: "center" }, railDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.track, borderWidth: 2, borderColor: C.bg }, railDotOn: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.purple }, railLine: { width: 1, flex: 1, backgroundColor: C.lineStrong }, timelineCopy: { flex: 1, paddingLeft: 10, paddingBottom: 20 }, timelineLabel: { ...T.support, fontFamily: font.semi, color: C.text }, timelineDetail: { ...T.caption, marginTop: 4 },
  loading: { marginTop: 50 }, planList: { gap: 10, marginTop: 24 }, plan: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft }, planLabel: { ...T.support, fontFamily: font.semi, color: C.text }, planPrice: { ...T.caption, marginTop: 4 },
  termsCard: { marginTop: 18, padding: 18, gap: 12 }, termRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, termLabel: { ...T.caption }, termValue: { ...T.caption, fontFamily: font.semi, color: C.text, textAlign: "right", flex: 1 }, status: { marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: C.surface, flexDirection: "row", alignItems: "flex-start", gap: 10 }, statusText: { ...T.caption, color: C.text, flex: 1 },
  links: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }, link: { ...T.caption, color: C.purple, textDecorationLine: "underline", paddingVertical: 10 }, dot: { ...T.caption }, devButton: { marginTop: 8 }, devNote: { ...T.caption, color: C.purple, textAlign: "center", marginTop: 4 }, secondary: { marginTop: 8 },
});
