import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { approvedLessonDeck } from "@/constants/approvedLessons";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { C, GUTTER, T, font, shadow } from "@/constants/theme";
import { loadApprovedDeckHtml, loadConvertedHandoffDeckHtml, loadReturnedDeckHtml } from "@/lib/approvedDeckLoader";
import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import { approvedCustomWording, conversionRuntimeEnabled, M1_L1_CONVERSION, validateM1L1Completion, type TransferChoice } from "@/lib/convertedLesson";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

/** Renders an approved source deck behind a strict internal-review boundary. */
export default function ApprovedLessonDeckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lessonId?: string; returnFromRehearsal?: string; runId?: string }>();
  const lesson = approvedLessonDeck(params.lessonId);
  const {
    activeScenarioRun,
    clearActiveScenarioRunStrict,
    markPendingConvertedLessonPrivateContentDeleted,
    promotePendingConvertedLessonCompletion,
    replaceActiveScenarioRunStrict,
    writePendingConvertedLessonCompletion,
  } = useStore();
  const isConverted = conversionRuntimeEnabled(params.lessonId);
  const isReturning = isConverted && params.returnFromRehearsal === "1";
  const returningRun = activeScenarioRun?.run;
  const isApprovedMoveSaved = !isReturning || Boolean(
    returningRun?.m1L1?.approvedMoveSavedAt && validateM1L1Completion(returningRun, params.runId).isValid,
  );
  const [customDraft, setCustomDraft] = useState<string>("");
  const [customWording, setCustomWording] = useState<string | null>(null);
  const [showWordingConsent, setShowWordingConsent] = useState<boolean>(isReturning);
  const [completionCommitted, setCompletionCommitted] = useState<boolean>(false);
  const [deckHtml, setDeckHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    const run = activeScenarioRun?.run;
    if (!isReturning || !activeScenarioRun || !run || run.m1L1?.approvedMoveSavedAt) return;
    if (!validateM1L1Completion(run, params.runId).isValid) return;
    void replaceActiveScenarioRunStrict(
      { ...activeScenarioRun, run: { ...run, m1L1: { ...run.m1L1!, approvedMoveSavedAt: Date.now() }, updatedAt: Math.max(Date.now(), run.updatedAt + 1) } },
      activeRunRevision(activeScenarioRun),
    ).catch((error: unknown) => {
      safeLog("[converted-lesson] approved move auto-save failed", errorShape(error));
      Alert.alert("We couldn’t save the approved move", "Stay on this screen and try returning from the rehearsal again.");
    });
  }, [activeScenarioRun, isReturning, params.runId, replaceActiveScenarioRunStrict]);

  useEffect(() => {
    let isActive = true;
    setDeckHtml(null);
    setLoadError(false);
    if (!__DEV__ || !lesson) return () => { isActive = false; };

    const loader = isReturning
      ? loadReturnedDeckHtml(lesson.archivePath, M1_L1_CONVERSION.returnCard, M1_L1_CONVERSION.completionCard, isApprovedMoveSaved)
      : isConverted
        ? loadConvertedHandoffDeckHtml(lesson.archivePath, M1_L1_CONVERSION.rehearsalHandoffCard)
        : loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    loader.then((html) => { if (isActive) setDeckHtml(html); })
      .catch((error: unknown) => {
        safeLog("[approved-lessons] approved archive failed", errorShape(error));
        if (isActive) setLoadError(true);
      });
    return () => { isActive = false; };
  }, [isApprovedMoveSaved, isConverted, isReturning, lesson]);

  const reviewGuard = useMemo(() => {
    if (!lesson) return "true;";
    const boundary = lesson.reviewThroughCard;
    const total = lesson.cardCount;
    const shouldStopDeckNavigation = lesson.isCloseDeck;
    return `
      (function () {
        var boundary = ${boundary};
        var total = ${total};
        var stopDeckNavigation = ${shouldStopDeckNavigation ? "true" : "false"};
        var blockedLabels = ${isConverted ? "[]" : '["start rehearsal", "start voice rehearsal", "continue lesson preview"]'};
        var expectedRunId = ${JSON.stringify(params.runId ?? "")};
        function textOf(node) {
          return String(node && (node.innerText || node.textContent) || "").trim().toLowerCase();
        }
        function currentCounter() {
          var counters = Array.prototype.slice.call(document.querySelectorAll("[data-tnum]"));
          for (var i = 0; i < counters.length; i += 1) {
            var value = textOf(counters[i]);
            if (value.match(new RegExp("^\\\\d+ / " + total + "$"))) return value;
          }
          return "";
        }
        function fitApprovedFrame() {
          var deck = document.querySelector('[data-bysi="deck"]');
          if (!deck) return;
          if (!document.getElementById("bysi-rork-review-style")) {
            var style = document.createElement("style");
            style.id = "bysi-rork-review-style";
            style.textContent = "body *{visibility:hidden!important}[data-bysi=deck],[data-bysi=deck] *{visibility:visible!important}html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#F2EDE4!important}";
            document.head.appendChild(style);
          }
          var scale = Math.min(window.innerWidth / 393, window.innerHeight / 852);
          deck.style.position = "fixed";
          deck.style.left = ((window.innerWidth - (393 * scale)) / 2) + "px";
          deck.style.top = ((window.innerHeight - (852 * scale)) / 2) + "px";
          deck.style.width = "393px";
          deck.style.height = "852px";
          deck.style.transformOrigin = "top left";
          deck.style.transform = "scale(" + scale + ")";
          deck.style.borderRadius = "0";
          deck.style.boxShadow = "none";
        }
        function disableDeferredActions() {
          var controls = Array.prototype.slice.call(document.querySelectorAll("button, [role=button]"));
          controls.forEach(function (control) {
            if (blockedLabels.indexOf(textOf(control)) < 0) return;
            control.setAttribute("aria-disabled", "true");
            control.style.display = "none";
          });
        }
        function enableApprovedMoveCompletion() {
          if (!${isReturning && isApprovedMoveSaved ? "true" : "false"}) return;
          var counters = Array.prototype.slice.call(document.querySelectorAll("[data-tnum]"));
          var isCard21 = counters.some(function (node) { return /^1 \/ 2$/.test(textOf(node)); });
          if (!isCard21) return;
          Array.prototype.slice.call(document.querySelectorAll("button, [role=button]")).forEach(function (control) {
            var label = textOf(control);
            if (!/^(next|continue|keep the approved move|complete)$/.test(label)) return;
            control.disabled = false;
            control.removeAttribute("disabled");
            control.setAttribute("aria-disabled", "false");
            control.style.pointerEvents = "auto";
            control.setAttribute("data-approved-move-satisfies-gate", "true");
          });
        }
        function protectScrollableCardContent() {
          var deck = document.querySelector('[data-bysi="deck"]');
          if (!deck) return;
          var cardFrame = Array.prototype.slice.call(deck.children).find(function (child) {
            return child.style.position === "relative" && child.style.minHeight === "0px";
          });
          var contentPane = cardFrame && cardFrame.firstElementChild;
          if (!contentPane) return;
          contentPane.style.overflowX = "hidden";
          contentPane.style.overflowY = "auto";
          contentPane.style.overscrollBehaviorY = "contain";
          contentPane.style.webkitOverflowScrolling = "touch";
          contentPane.style.scrollbarWidth = "none";
          contentPane.setAttribute("data-bysi-scrollable-content", "true");
        }
        document.addEventListener("click", function (event) {
          var target = event.target && event.target.closest ? event.target.closest("button, [role=button], span, div") : event.target;
          var label = textOf(target);
          if (blockedLabels.indexOf(label) >= 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return false;
          }
          if (stopDeckNavigation && currentCounter()) {
            var isBack = label === "back" || label === "×" || label.indexOf("restart") >= 0;
            if (!isBack) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return false;
            }
          }
          if (${isReturning ? "true" : "false"}) {
            window.setTimeout(function () {
              var message = null;
              if (["say it", "write it", "save it for later"].indexOf(label) >= 0) message = { type:"transfer-selected", label:label, runId:expectedRunId };
              if (message && window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }, 80);
          }
          return true;
        }, true);
        function enforce() {
          fitApprovedFrame();
          disableDeferredActions();
          enableApprovedMoveCompletion();
          protectScrollableCardContent();
        }
        new MutationObserver(enforce).observe(document, { childList: true, subtree: true });
        window.addEventListener("resize", enforce);
        enforce();
      })();
      true;
    `;
  }, [isApprovedMoveSaved, isConverted, isReturning, lesson, params.runId]);

  const handleDeckMessage = useCallback(async (raw: string): Promise<void> => {
    let message: { type?: unknown; label?: unknown; runId?: unknown };
    try {
      message = JSON.parse(raw) as { type?: unknown; label?: unknown; runId?: unknown };
    } catch {
      return;
    }
    if (message.type === "start-rehearsal" && isConverted && !isReturning) {
      router.push({ pathname: "/approved-rehearsal/[lessonId]", params: { lessonId: M1_L1_CONVERSION.lessonId } });
      return;
    }
    const run = activeScenarioRun?.run;
    const completion = validateM1L1Completion(run, params.runId);
    if (message.type !== "transfer-selected" || !isReturning || message.runId !== params.runId || !completion.isValid || completionCommitted) return;
    const transferByLabel: Record<string, TransferChoice> = { "say it": "say", "write it": "write", "save it for later": "save_later" };
    const transferChoice = typeof message.label === "string" ? transferByLabel[message.label] : undefined;
    if (!transferChoice || !run) return;
    try {
      await finalizeConvertedLesson({
        lessonId: M1_L1_CONVERSION.lessonId,
        moduleId: M1_L1_CONVERSION.moduleId,
        practiceId: M1_L1_CONVERSION.practiceId,
        contentVersion: M1_L1_CONVERSION.contentVersion,
        runId: run.id,
        lessonCardCheckpoint: M1_L1_CONVERSION.completionCard,
        quizGatesCompleted: true,
        rehearsalCompleted: true,
        retryCompleted: true,
        comparisonViewed: true,
        savedMoveId: M1_L1_CONVERSION.namedMoveId,
        ...(customWording ? { customWording } : {}),
        transferChoice,
        completedAt: Date.now(),
        sourceLineage: "approved-html-deck-pinned",
      }, {
        expectedActiveRevision: activeRunRevision(activeScenarioRun)!,
        writePending: writePendingConvertedLessonCompletion,
        markPrivateContentDeleted: markPendingConvertedLessonPrivateContentDeleted,
        clearActiveRunStrict: async (expectedRunId: string, afterPrivateCleanup: () => Promise<void>) => {
          const expected = activeRunRevision(activeScenarioRun);
          if (!expected || expected.runId !== expectedRunId) throw new Error("Active rehearsal identity changed");
          await clearActiveScenarioRunStrict(expected, afterPrivateCleanup);
        },
        promotePending: promotePendingConvertedLessonCompletion,
      });
      setCompletionCommitted(true);
    } catch (error: unknown) {
      safeLog("[converted-lesson] progress commit failed", errorShape(error));
      Alert.alert("We couldn’t finish securely", "Progress or rehearsal deletion did not complete. Stay on this screen and try again.");
    }
  }, [activeScenarioRun, clearActiveScenarioRunStrict, completionCommitted, customWording, isConverted, isReturning, markPendingConvertedLessonPrivateContentDeleted, params.runId, promotePendingConvertedLessonCompletion, router, writePendingConvertedLessonCompletion]);

  if (!__DEV__) {
    return <Unavailable title="Lesson review is unavailable." body="Approved source decks are available only in internal development builds." />;
  }
  if (!lesson) return <Unavailable title="That approved deck isn't available." body="Return to the internal lesson catalog and choose another deck." />;

  return (
    <View style={styles.root}>
      {deckHtml && !loadError && isApprovedMoveSaved ? (
        <WebView
          source={{ html: deckHtml, baseUrl: "about:blank" }}
          style={styles.webView}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled={false}
          incognito
          cacheEnabled={false}
          injectedJavaScript={reviewGuard}
          injectedJavaScriptBeforeContentLoaded={reviewGuard}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => request.url.startsWith("blob:") || request.url.startsWith("about:blank")}
          onMessage={(event) => { void handleDeckMessage(event.nativeEvent.data); }}
          onError={(event) => {
            safeLog("[approved-lessons] webview failed", { code: event.nativeEvent.code, description: event.nativeEvent.description });
            setLoadError(true);
          }}
          accessibilityLabel={`${lesson.title} approved source deck`}
        />
      ) : loadError ? (
        <Unavailable title="The approved deck couldn't open." body="Check your connection, return to the catalog, and try again." />
      ) : (
        <View style={styles.loading}><ActivityIndicator color={C.purple} /><Text style={styles.loadingText}>Opening approved deck…</Text></View>
      )}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 6 }]}
        accessibilityRole="button"
        accessibilityLabel="Back to approved lesson catalog"
      >
        <ArrowLeft size={20} color={C.text} />
      </Pressable>
      {showWordingConsent && isApprovedMoveSaved && !completionCommitted ? <View style={[styles.wordingPanel, { bottom: insets.bottom + 18 }]}><Text style={styles.wordingTitle}>Optional custom wording</Text><Text style={styles.wordingBody}>The approved move is already saved. Custom text is retained only if you choose Save this wording.</Text><TextInput value={customDraft} onChangeText={setCustomDraft} maxLength={240} placeholder="Optional wording" style={styles.wordingInput} /><Pressable onPress={() => { const approved = approvedCustomWording(customDraft); if (approved) { setCustomWording(approved); setShowWordingConsent(false); } }} style={styles.wordingPrimary} accessibilityRole="button"><Text style={styles.wordingPrimaryText}>Save this wording</Text></Pressable><Pressable onPress={() => setShowWordingConsent(false)} style={styles.wordingSecondary} accessibilityRole="button"><Text style={styles.wordingSecondaryText}>Keep the approved move only</Text></Pressable></View> : null}
      <View pointerEvents="none" style={[styles.qaBadge, { top: insets.top + 9 }]}>
        <Text style={styles.qaBadgeText}>{completionCommitted ? (customWording ? "COMPLETE · ONLY SAVED WORDING RETAINED" : "COMPLETE · TRANSCRIPT DELETED") : isReturning ? "REHEARSAL COMPLETE" : "INTERNAL QA"}</Text>
      </View>
    </View>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <View style={[styles.root, styles.unavailable]}>
      <ShieldCheck size={30} color={C.sage} />
      <Text style={styles.unavailableTitle}>{title}</Text>
      <Text style={styles.unavailableBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2EDE4" },
  webView: { flex: 1, backgroundColor: "#F2EDE4" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...T.caption },
  backButton: { position: "absolute", left: 12, zIndex: 4, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  qaBadge: { position: "absolute", right: 14, zIndex: 3, minHeight: 32, borderRadius: 16, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line },
  qaBadgeText: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.1, color: C.purple },
  wordingPanel: { position: "absolute", left: 18, right: 18, zIndex: 6, borderRadius: 20, padding: 16, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  wordingTitle: { ...T.support, color: C.text, fontFamily: font.bold }, wordingBody: { ...T.caption, marginTop: 5 }, wordingInput: { ...T.body, minHeight: 44, marginTop: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, backgroundColor: C.surfaceHigh }, wordingPrimary: { minHeight: 44, marginTop: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.purple }, wordingPrimaryText: { fontFamily: font.bold, fontSize: 13, color: C.onAccent }, wordingSecondary: { minHeight: 44, alignItems: "center", justifyContent: "center" }, wordingSecondaryText: { fontFamily: font.semi, fontSize: 12, color: C.purple },
  unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  unavailableTitle: { ...T.title, textAlign: "center", marginTop: 16 },
  unavailableBody: { ...T.support, textAlign: "center", marginTop: 8 },
});
