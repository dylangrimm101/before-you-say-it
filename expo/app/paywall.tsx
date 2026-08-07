import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Backdrop,
  Eyebrow,
  GhostButton,
  PrimaryButton,
  StateDock,
  tap,
} from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import {
  useIsPro,
  useOfferings,
  usePurchasePackage,
  useRestorePurchases,
} from "@/lib/purchases";
import { curriculumModule, isModuleId, type ModuleId } from "@/constants/modules";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

const UNLOCKS: readonly string[] = [
  "Brief teaching from Hope before you try the skill.",
  "A spoken attempt with Adam’s contextual response.",
  "One evidence-linked adjustment, then the same moment again.",
  "Eight modules you can browse without daily lockouts.",
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gate?: string; source?: string; moduleId?: string }>();
  const isPro = useIsPro();
  const { devProEnabled, toggleDevPro, activePracticeSession } = useStore();
  const moduleId: ModuleId | null = isModuleId(params.moduleId)
    ? params.moduleId
    : activePracticeSession?.recommendation?.moduleId ?? null;
  const recommendedModule = curriculumModule(moduleId);
  const { data: offerings, isLoading: loadingOfferings, error: offeringsError } = useOfferings();
  const purchase = usePurchasePackage();
  const restore = useRestorePurchases();
  const [notice, setNotice] = useState<string>("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const plans = useMemo(() => {
    const current = offerings?.current;
    return {
      monthly: current?.monthly ?? current?.availablePackages[0] ?? null,
      annual: current?.annual ?? null,
    };
  }, [offerings]);

  const selectedPackage = billing === "annual" && plans.annual ? plans.annual : plans.monthly;
  const selectedLabel = billing === "annual" && plans.annual ? "yearly" : "monthly";

  const proceed = (): void => {
    if (isPro && moduleId) {
      router.replace({ pathname: "/module/[day]", params: { day: moduleId } });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const unlockPilotPreview = async (): Promise<void> => {
    if (!__DEV__) return;
    tap("success");
    await toggleDevPro(true);
    if (moduleId) router.replace({ pathname: "/module/[day]", params: { day: moduleId } });
    else router.replace("/(tabs)");
  };

  const buy = async (): Promise<void> => {
    if (isPro) {
      proceed();
      return;
    }
    if (!selectedPackage || purchase.isPending) return;
    tap("light");
    setNotice("");
    try {
      const result = await purchase.mutateAsync(selectedPackage);
      if (result.status === "purchased") {
        tap("success");
        router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
      } else if (result.status === "pending") {
        setNotice("Your payment is pending approval — access unlocks once it clears.");
      }
    } catch (error) {
      safeLog("[paywall] purchase failed", errorShape(error));
      setNotice("Something went wrong with the purchase. Please try again.");
    }
  };

  const onRestore = async (): Promise<void> => {
    if (restore.isPending) return;
    tap("light");
    setNotice("");
    try {
      const restored = await restore.mutateAsync();
      if (restored) {
        tap("success");
        router.replace({ pathname: "/purchase-success", params: moduleId ? { moduleId } : {} });
      } else {
        setNotice("No previous subscription found for this account.");
      }
    } catch (error) {
      safeLog("[paywall] restore failed", errorShape(error));
      setNotice("Couldn't restore purchases. Please try again.");
    }
  };

  const primaryLabel = isPro
    ? `Open ${recommendedModule?.name ?? "my practice path"}`
    : purchase.isPending
      ? "Processing…"
      : `Start my recommended practice path · ${selectedLabel}`;

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + 190,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              tap("light");
              proceed();
            }}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="paywall-close"
          >
            <ChevronLeft size={19} color={C.purple} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRestore}
            style={styles.restoreButton}
            disabled={restore.isPending}
            accessibilityRole="button"
            testID="paywall-restore"
          >
            <Text style={styles.restoreText}>
              {restore.isPending ? "Restoring…" : "Restore purchase"}
            </Text>
          </TouchableOpacity>
        </View>

        <Eyebrow color={C.dim}>Your recommended practice path</Eyebrow>
        <Text style={styles.title}>{recommendedModule ? `Start with ${recommendedModule.name}.` : "Turn the rehearsal into practice."}</Text>
        <Text style={styles.body}>You have a starting point. The full path teaches the move, lets you try it with Adam, and gives you one focused retry with Hope.</Text>

        <Text style={[eyebrow, styles.unlockLabel]}>What unlocks</Text>
        <View style={styles.unlocks}>
          {UNLOCKS.map((item, index) => (
            <View key={item} style={[styles.unlockRow, index > 0 && styles.divider]}>
              <Text style={styles.unlockNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.unlockText}>{item}</Text>
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={styles.proCard}>
            <Check size={16} color={C.sage} strokeWidth={2.6} />
            <Text style={styles.proText}>Your plan is unlocked.</Text>
          </View>
        ) : loadingOfferings ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={C.purple} />
          </View>
        ) : offeringsError || !plans.monthly ? (
          <Text style={styles.notice}>
            Plans aren’t available right now. Keep your free debrief and try again later.
          </Text>
        ) : (
          <View style={styles.planGroup} accessibilityRole="radiogroup">
            <TouchableOpacity
              onPress={() => {
                tap("light");
                setBilling("monthly");
              }}
              style={[styles.priceCard, billing === "monthly" && styles.priceCardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: billing === "monthly" }}
            >
              <View style={styles.planCopy}>
                <Text style={styles.priceLabel}>Monthly</Text>
                <Text style={styles.priceSub}>
                  {plans.monthly.product.priceString} / month · renews monthly
                </Text>
              </View>
              {billing === "monthly" ? <Text style={styles.selected}>Selected</Text> : null}
            </TouchableOpacity>

            {plans.annual ? (
              <TouchableOpacity
                onPress={() => {
                  tap("light");
                  setBilling("annual");
                }}
                style={[styles.priceCard, billing === "annual" && styles.priceCardSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected: billing === "annual" }}
              >
                <View style={styles.planCopy}>
                  <Text style={styles.priceLabel}>Yearly</Text>
                  <Text style={styles.priceSub}>
                    {plans.annual.product.priceString} / year · renews yearly
                  </Text>
                </View>
                {billing === "annual" ? <Text style={styles.selected}>Selected</Text> : null}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {!isPro ? (
          <Text style={styles.priceNote}>
            Pricing, period, and any trial shown here come directly from the store.
          </Text>
        ) : null}
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        {__DEV__ && !devProEnabled ? (
          <>
            <PrimaryButton
              label="Unlock all modules for testing"
              onPress={unlockPilotPreview}
            />
            <Text style={styles.previewAccessNote}>
              Preview only · no purchase or subscription
            </Text>
          </>
        ) : null}
        <PrimaryButton
          label={primaryLabel}
          onPress={buy}
          disabled={!isPro && (!selectedPackage || purchase.isPending)}
        />
        <GhostButton label="Keep my free debrief for now" onPress={proceed} style={styles.secondary} />
        <View style={styles.legalRow}>
          <Text style={styles.legal}>Renews until you cancel in Settings. </Text>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}
          >
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legal}> · </Text>
          <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/privacy")}>
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>
        {Platform.OS === "web" ? (
          <Text style={styles.previewNote}>Preview purchases do not charge real money.</Text>
        ) : null}
      </StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerButton: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", marginLeft: -8, paddingHorizontal: 4 },
  backText: { ...T.support, color: C.purple, fontFamily: font.semi },
  restoreButton: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  restoreText: { ...T.support, color: C.text, fontFamily: font.medium },
  title: { ...T.display, marginTop: 9 },
  body: { ...T.body, color: C.textSoft, marginTop: 12 },
  unlockLabel: { color: C.dim, marginTop: 24 },
  unlocks: { marginTop: 7 },
  unlockRow: { flexDirection: "row", gap: 11, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  unlockNumber: { ...T.caption, color: C.purple, fontFamily: font.semi, width: 22 },
  unlockText: { ...T.support, color: C.text, flex: 1 },
  planGroup: { gap: 9, marginTop: 20 },
  priceCard: { minHeight: 72, flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, padding: 16 },
  priceCardSelected: { borderColor: `${C.purple}66`, backgroundColor: C.surfaceHigh, ...shadow.layer },
  planCopy: { flex: 1 },
  priceLabel: { ...T.support, color: C.text, fontFamily: font.semi },
  priceSub: { ...T.caption, marginTop: 2 },
  selected: { ...eyebrow, color: C.purple },
  priceNote: { ...T.caption, marginTop: 10 },
  notice: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 14 },
  loadingBox: { minHeight: 100, alignItems: "center", justifyContent: "center" },
  proCard: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: radius.md, backgroundColor: C.sageSoft, padding: 16 },
  proText: { ...T.support, color: C.sage, fontFamily: font.semi },
  secondary: { marginTop: 8 },
  legalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 8 },
  legal: { ...T.caption, fontSize: 11, lineHeight: 16 },
  legalLink: { ...T.caption, fontSize: 11, lineHeight: 16, color: C.purple, textDecorationLine: "underline" },
  previewNote: { ...T.caption, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 2 },
  previewAccessNote: { ...T.caption, color: C.purple, textAlign: "center", marginTop: 5, marginBottom: 4 },
});
