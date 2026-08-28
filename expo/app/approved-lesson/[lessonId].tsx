import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Bookmark, Check, MoreHorizontal, RotateCcw, ShieldCheck, Sparkles, TrendingUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { approvedLessonDeck } from "@/constants/approvedLessons";
import { ProductCard, SectionLabel } from "@/components/PaidProductUI";
import { Backdrop, PrimaryButton, Reveal, useReducedMotion } from "@/components/ui";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { loadApprovedDeckHtml, loadConvertedHandoffDeckHtml, loadReturnedDeckHtml } from "@/lib/approvedDeckLoader";
import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import { approvedRehearsalConfig, approvedRehearsalIndexImpact, approvedRehearsalStrongVersion, validateApprovedRehearsalCompletion, type ApprovedRehearsalIndexImpact } from "@/lib/approvedRehearsals";
import { conversionRuntimeEnabled, m1L1GoodVersion, m1L1IndexImpact, M1_L1_CONVERSION, validateM1L1Completion, type ConvertedLessonProgress, type M1L1IndexImpact, type TransferChoice } from "@/lib/convertedLesson";
import { progressHistoryPresentation, SCORED_PRACTICE_HISTORY_VERSION, type ScoredPracticeRecord } from "@/lib/scoredPracticeHistory";
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
    resetConvertedLesson,
    saveScoredPracticeRecord,
    scoredPracticeHistory,
    activePracticeSession,
    undoConvertedLessonReset,
    writePendingConvertedLessonCompletion,
  } = useStore();
  const [lessonWasReset, setLessonWasReset] = useState<boolean>(false);
  const isM1L1 = conversionRuntimeEnabled(params.lessonId);
  const approvedConfig = approvedRehearsalConfig(params.lessonId);
  const rehearsalConfig = isM1L1 ? M1_L1_CONVERSION : approvedConfig;
  const isConverted = Boolean(rehearsalConfig);
  const isReturning = isConverted && params.returnFromRehearsal === "1" && !lessonWasReset;
  const returningRun = activeScenarioRun?.run;
  const hasValidReturn = isM1L1
    ? validateM1L1Completion(returningRun, params.runId).isValid
    : Boolean(approvedConfig && validateApprovedRehearsalCompletion(approvedConfig, returningRun, params.runId));
  const isApprovedMoveSaved = !isReturning || hasValidReturn;
  const [isStrongVersionSaved, setIsStrongVersionSaved] = useState<boolean>(false);
  const [completionCommitted, setCompletionCommitted] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [deckHtml, setDeckHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [loadAttempt, setLoadAttempt] = useState<number>(0);
  const [isLessonMenuOpen, setIsLessonMenuOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetNotice, setResetNotice] = useState<{ message: string; snapshot: ConvertedLessonProgress[]; canUndo: boolean } | null>(null);

  useEffect(() => {
    if (!resetNotice) return undefined;
    const timer = setTimeout(() => setResetNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [resetNotice]);

  useEffect(() => {
    let isActive = true;
    setDeckHtml(null);
    setLoadError(false);
    if (!__DEV__ || !lesson) return () => { isActive = false; };

    const loader = isReturning && rehearsalConfig
      ? loadReturnedDeckHtml(lesson.archivePath, rehearsalConfig.returnCard, rehearsalConfig.completionCard, isApprovedMoveSaved)
      : rehearsalConfig
        ? loadConvertedHandoffDeckHtml(lesson.archivePath, rehearsalConfig.rehearsalHandoffCard)
        : loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    loader.then((html) => { if (isActive) setDeckHtml(html); })
      .catch((error: unknown) => {
        safeLog("[approved-lessons] approved archive failed", errorShape(error));
        if (isActive) setLoadError(true);
      });
    return () => { isActive = false; };
  }, [isApprovedMoveSaved, isReturning, lesson, loadAttempt, rehearsalConfig]);

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
            style.textContent = "body *{visibility:hidden!important}[data-bysi=deck],[data-bysi=deck] *{visibility:visible!important}[data-bysi=deck] *{animation-duration:.001ms!important;animation-delay:0ms!important}#__bundler_err{display:none!important}html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#F2EDE4!important}";
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
        function suppressArtifactHostDiagnostic() {
          var diagnostic = document.getElementById("__bundler_err");
          if (diagnostic) diagnostic.remove();
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
          suppressArtifactHostDiagnostic();
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

  const handleResetLesson = useCallback(async (): Promise<void> => {
    if (!rehearsalConfig || isResetting) return;
    setIsLessonMenuOpen(false);
    setIsResetting(true);
    try {
      const snapshot = await resetConvertedLesson({
        lessonId: rehearsalConfig.lessonId,
        moduleId: rehearsalConfig.moduleId,
        practiceId: rehearsalConfig.practiceId,
      });
      setCompletionCommitted(false);
      setIsStrongVersionSaved(false);
      setLessonWasReset(true);
      setResetNotice({
        message: "Lesson reset. Starting again at Card 1.",
        snapshot,
        canUndo: snapshot.length > 0,
      });
    } catch (error: unknown) {
      safeLog("[converted-lesson] lesson reset failed", errorShape(error));
      Alert.alert("We couldn’t reset this lesson", "Your saved progress was not cleared. Try again.");
    } finally {
      setIsResetting(false);
    }
  }, [isResetting, rehearsalConfig, resetConvertedLesson]);

  const handleUndoReset = useCallback(async (): Promise<void> => {
    if (!rehearsalConfig || !resetNotice?.canUndo) return;
    try {
      await undoConvertedLessonReset(rehearsalConfig.lessonId, resetNotice.snapshot);
      setResetNotice({ message: "Completion restored. Private rehearsal content stays deleted.", snapshot: [], canUndo: false });
    } catch (error: unknown) {
      safeLog("[converted-lesson] lesson reset undo failed", errorShape(error));
      Alert.alert("We couldn’t undo the reset", "The lesson remains ready to begin again at Card 1.");
    }
  }, [rehearsalConfig, resetNotice, undoConvertedLessonReset]);

  const handleDeckMessage = useCallback(async (raw: string): Promise<void> => {
    let message: { type?: unknown; label?: unknown; runId?: unknown; category?: unknown };
    try {
      message = JSON.parse(raw) as { type?: unknown; label?: unknown; runId?: unknown; category?: unknown };
    } catch {
      return;
    }
    if (message.type === "deck-render-error") {
      safeLog("[approved-lessons] deck runtime did not mount", {
        category: typeof message.category === "string" ? message.category : "unknown",
      });
      setLoadError(true);
      return;
    }
    if (message.type === "deck-ready") return;
    if (message.type === "start-rehearsal" && rehearsalConfig && !isReturning) {
      router.push({ pathname: "/approved-rehearsal/[lessonId]", params: { lessonId: rehearsalConfig.lessonId } });
      return;
    }
    const run = activeScenarioRun?.run;
    const completionIsValid = isM1L1
      ? validateM1L1Completion(run, params.runId).isValid
      : Boolean(approvedConfig && validateApprovedRehearsalCompletion(approvedConfig, run, params.runId));
    if (message.type !== "transfer-selected" || !isReturning || message.runId !== params.runId || !completionIsValid || completionCommitted || !rehearsalConfig) return;
    const transferByLabel: Record<string, TransferChoice> = { "say it": "say", "write it": "write", "save it for later": "save_later" };
    const transferChoice = typeof message.label === "string" ? transferByLabel[message.label] : undefined;
    if (!transferChoice || !run) return;
    try {
      await finalizeConvertedLesson({
        lessonId: rehearsalConfig.lessonId,
        moduleId: rehearsalConfig.moduleId,
        practiceId: rehearsalConfig.practiceId,
        contentVersion: rehearsalConfig.contentVersion,
        runId: run.id,
        lessonCardCheckpoint: rehearsalConfig.completionCard,
        quizGatesCompleted: true,
        rehearsalCompleted: true,
        retryCompleted: true,
        comparisonViewed: true,
        savedMoveId: rehearsalConfig.namedMoveId,
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
  }, [activeScenarioRun, approvedConfig, clearActiveScenarioRunStrict, completionCommitted, isM1L1, isReturning, lesson?.id, markPendingConvertedLessonPrivateContentDeleted, params.runId, promotePendingConvertedLessonCompletion, rehearsalConfig, router, writePendingConvertedLessonCompletion]);

  const indexEvidence = useMemo(
    () => progressHistoryPresentation(scoredPracticeHistory, activePracticeSession?.sharedResult),
    [activePracticeSession?.sharedResult, scoredPracticeHistory],
  );
  const indexImpact = useMemo<M1L1IndexImpact | ApprovedRehearsalIndexImpact | null>(() => {
    if (!returningRun) return null;
    const currentSignals = indexEvidence.rows.flatMap((row) => row.value === null ? [] : [{ key: row.key, value: row.value }]);
    return isM1L1
      ? m1L1IndexImpact(returningRun, currentSignals)
      : approvedConfig
        ? approvedRehearsalIndexImpact(approvedConfig, returningRun, currentSignals)
        : null;
  }, [approvedConfig, indexEvidence.rows, isM1L1, returningRun]);
  const coachedOriginalResponse = isM1L1
    ? returningRun?.m1L1?.coachedBeat === 1 ? returningRun.attempt?.transcript : returningRun?.responseAttempt?.transcript
    : returningRun?.coachingObservation?.coachedBeat === 1
      ? returningRun.attempt?.transcript
      : returningRun?.coachingObservation?.coachedBeat === 5
        ? returningRun.approvedRehearsal?.secondResponseAttempt?.transcript
        : returningRun?.responseAttempt?.transcript;
  const strongVersion = isM1L1
    ? returningRun?.m1L1?.selectedDimension && returningRun.m1L1.coachedBeat
      ? m1L1GoodVersion(returningRun.m1L1.selectedDimension, returningRun.m1L1.coachedBeat)
      : null
    : approvedConfig
      ? approvedRehearsalStrongVersion(approvedConfig)
      : null;

  const finishLesson = useCallback(async (): Promise<void> => {
    const retryAttempt = returningRun?.retryAttempt;
    if (!activeScenarioRun || !returningRun || !retryAttempt || !indexImpact || !rehearsalConfig || isCompleting) return;
    setIsCompleting(true);
    const completedAt = Date.now();
    const record: ScoredPracticeRecord = {
      schemaVersion: SCORED_PRACTICE_HISTORY_VERSION,
      id: returningRun.id,
      rehearsalId: returningRun.id,
      completedAt,
      scenarioId: rehearsalConfig.scenario.id,
      scenarioTitle: lesson?.title ?? rehearsalConfig.scenario.title,
      observedSignals: [{ key: indexImpact.signalKey, value: indexImpact.signalValue, evidenceTurnIds: [retryAttempt.id] }],
      observedSignalSet: [indexImpact.signalKey],
      overallIndex: indexImpact.signalValue,
      evidence: [{ turnId: retryAttempt.id }],
      currentFocus: `Keep ${indexImpact.signalLabel.toLowerCase()} visible under pushback`,
    };
    try {
      await finalizeConvertedLesson({
        lessonId: rehearsalConfig.lessonId,
        moduleId: rehearsalConfig.moduleId,
        practiceId: rehearsalConfig.practiceId,
        contentVersion: rehearsalConfig.contentVersion,
        runId: returningRun.id,
        lessonCardCheckpoint: rehearsalConfig.completionCard,
        quizGatesCompleted: true,
        rehearsalCompleted: true,
        retryCompleted: true,
        comparisonViewed: true,
        savedMoveId: rehearsalConfig.namedMoveId,
        ...(isStrongVersionSaved && strongVersion ? { customWording: strongVersion } : {}),
        transferChoice: "finish",
        completedAt,
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
      await saveScoredPracticeRecord(record);
      setCompletionCommitted(true);
      router.replace("/(tabs)");
    } catch (error: unknown) {
      safeLog("[converted-lesson] native completion failed", errorShape(error));
      Alert.alert("We couldn’t finish securely", "Your rehearsal is still available. Please try again.");
      setIsCompleting(false);
    }
  }, [activeScenarioRun, clearActiveScenarioRunStrict, indexImpact, isCompleting, isStrongVersionSaved, lesson?.title, markPendingConvertedLessonPrivateContentDeleted, promotePendingConvertedLessonCompletion, rehearsalConfig, returningRun, router, saveScoredPracticeRecord, strongVersion, writePendingConvertedLessonCompletion]);

  if (!__DEV__) {
    return <Unavailable title="Lesson review is unavailable." body="Approved source decks are available only in internal development builds." />;
  }
  if (!lesson) return <Unavailable title="That approved deck isn't available." body="Return to the internal lesson catalog and choose another deck." />;
  if (isReturning && !hasValidReturn) {
    return <Unavailable
      title="We couldn’t verify that rehearsal result."
      body="The saved rehearsal does not match this lesson result. Return to the rehearsal and complete the retry again."
      onRetry={() => rehearsalConfig && router.replace({ pathname: "/approved-rehearsal/[lessonId]", params: { lessonId: rehearsalConfig.lessonId } })}
    />;
  }
  if (isReturning && hasValidReturn && indexImpact && strongVersion && coachedOriginalResponse && returningRun?.retryAttempt && returningRun.comparison) {
    return <LessonCompletionScreen
      impact={indexImpact}
      originalResponse={coachedOriginalResponse}
      retryResponse={returningRun.retryAttempt.transcript}
      comparison={returningRun.comparison.text}
      strongVersion={strongVersion}
      isSaved={isStrongVersionSaved}
      isCompleting={isCompleting}
      bottomInset={insets.bottom}
      onToggleSave={() => setIsStrongVersionSaved((current) => !current)}
      onFinish={() => void finishLesson()}
    />;
  }

  return (
    <View style={styles.root}>
      {deckHtml && !loadError && isApprovedMoveSaved ? (
        <WebView
          key={`${lesson.id}-${loadAttempt}`}
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
        <Unavailable
          title="The approved deck couldn't open."
          body="The lesson is still available. Try loading it again."
          onRetry={() => setLoadAttempt((current) => current + 1)}
        />
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
      {isConverted ? <Pressable
        onPress={() => setIsLessonMenuOpen((current) => !current)}
        style={[styles.menuButton, { top: insets.top + 6 }]}
        accessibilityRole="button"
        accessibilityLabel="Lesson options"
        accessibilityState={{ expanded: isLessonMenuOpen }}
      >
        <MoreHorizontal size={21} color={C.text} />
      </Pressable> : null}
      {isLessonMenuOpen && rehearsalConfig ? <View style={[styles.lessonMenu, { top: insets.top + 56 }]}>
        <Text style={styles.lessonMenuLabel}>LESSON OPTIONS</Text>
        <Pressable onPress={() => void handleResetLesson()} disabled={isResetting} style={styles.lessonMenuAction} accessibilityRole="button">
          {isResetting ? <ActivityIndicator size="small" color={C.clay} /> : <RotateCcw size={18} color={C.clay} />}
          <View style={styles.lessonMenuCopy}><Text style={styles.lessonMenuTitle}>Reset this lesson</Text><Text style={styles.lessonMenuBody}>Clear its completion and rehearsal, then return to Card 1.</Text></View>
        </Pressable>
      </View> : null}
      {completionCommitted && !lessonWasReset ? <View style={[styles.completionReset, { bottom: insets.bottom + 18 }]}><Pressable onPress={() => void handleResetLesson()} disabled={isResetting} style={styles.completionResetButton} accessibilityRole="button"><RotateCcw size={18} color={C.purple} /><Text style={styles.completionResetText}>{isResetting ? "Resetting…" : "Do this lesson again"}</Text></Pressable></View> : null}
      {resetNotice ? <View style={[styles.resetNotice, { bottom: insets.bottom + 18 }]}><Text style={styles.resetNoticeText}>{resetNotice.message}</Text>{resetNotice.canUndo ? <Pressable onPress={() => void handleUndoReset()} style={styles.undoButton} accessibilityRole="button"><Text style={styles.undoText}>Undo</Text></Pressable> : null}</View> : null}
      <View pointerEvents="none" style={[styles.qaBadge, { top: insets.top + 9 }]}>
        <Text style={styles.qaBadgeText}>{completionCommitted ? "COMPLETE · TRANSCRIPT DELETED" : isReturning ? "REHEARSAL COMPLETE" : "INTERNAL QA"}</Text>
      </View>
    </View>
  );
}

function LessonCompletionScreen({ impact, originalResponse, retryResponse, comparison, strongVersion, isSaved, isCompleting, bottomInset, onToggleSave, onFinish }: { impact: M1L1IndexImpact | ApprovedRehearsalIndexImpact; originalResponse: string; retryResponse: string; comparison: string; strongVersion: string; isSaved: boolean; isCompleting: boolean; bottomInset: number; onToggleSave: () => void; onFinish: () => void }): React.JSX.Element {
  const isReduced = useReducedMotion();
  const startingValue = impact.beforeIndex ?? impact.afterIndex;
  const [displayedIndex, setDisplayedIndex] = useState<number>(startingValue);
  const indexProgress = useRef<Animated.Value>(new Animated.Value(isReduced ? 1 : 0)).current;
  const resultLabel = impact.delta === null ? "Your first lesson Index" : impact.delta > 0 ? `+${impact.delta} to your Index` : impact.delta === 0 ? "Your Index held" : `${impact.delta} to your Index`;
  const animatedFill = indexProgress.interpolate({ inputRange: [0, 1], outputRange: [`${startingValue}%`, `${impact.afterIndex}%`] });
  const animatedScale = impact.delta === 0
    ? indexProgress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1.045, 1] })
    : indexProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const explanationOpacity = indexProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, 0, 1] });

  useEffect(() => {
    setDisplayedIndex(isReduced ? impact.afterIndex : startingValue);
    indexProgress.setValue(isReduced ? 1 : 0);
    if (isReduced) return undefined;
    const listenerId = indexProgress.addListener(({ value }) => {
      setDisplayedIndex(Math.round(startingValue + ((impact.afterIndex - startingValue) * value)));
    });
    const animation = Animated.timing(indexProgress, {
      toValue: 1,
      duration: 1100,
      delay: 380,
      easing: Easing.bezier(0.2, 0.82, 0.24, 1),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      setDisplayedIndex(impact.afterIndex);
      AccessibilityInfo.announceForAccessibility(`Communication Index ${resultLabel}. Current value ${impact.afterIndex} out of 100.`);
    });
    return () => {
      animation.stop();
      indexProgress.removeListener(listenerId);
    };
  }, [impact.afterIndex, indexProgress, isReduced, resultLabel, startingValue]);

  return <View style={styles.root}><Backdrop /><ScrollView contentContainerStyle={[styles.completionScroll, { paddingBottom: bottomInset + 34 }]} showsVerticalScrollIndicator={false}>
    <Reveal><View style={styles.celebrationIcon}><Sparkles size={26} color={C.onAccent} /></View><SectionLabel tone={C.purple}>Lesson complete</SectionLabel><Text style={styles.completionTitle}>You practiced it under pressure.</Text><Text style={styles.completionLede}>Hope compared the same behavior before and after your retry.</Text></Reveal>
    <Reveal index={1}><ProductCard accent style={styles.indexImpactCard}><View style={styles.impactTop}><View><SectionLabel tone={C.purple}>Communication Index</SectionLabel><Text style={styles.impactResult}>{resultLabel}</Text></View><TrendingUp size={24} color={C.purple} /></View><View style={styles.indexTransition} accessibilityLabel={`Communication Index moved from ${impact.beforeIndex ?? "no previous value"} to ${impact.afterIndex} out of 100`}><View style={styles.indexNumbers}>{impact.beforeIndex !== null ? <><Text style={styles.indexBefore}>{impact.beforeIndex}</Text><Text style={styles.indexArrow}>→</Text></> : null}<Animated.Text style={[styles.indexAfter, { transform: [{ scale: animatedScale }] }]}>{displayedIndex}</Animated.Text><Text style={styles.indexOutOf}>/ 100</Text></View><View style={styles.indexTrack}><Animated.View style={[styles.indexFill, { width: animatedFill }]} /></View></View><Animated.View style={{ opacity: explanationOpacity }}><Text style={styles.impactExplanation}>{impact.explanation}</Text><Text style={styles.signalNote}>Observed signal · {impact.signalLabel}</Text></Animated.View></ProductCard></Reveal>
    <Reveal index={2}><ProductCard style={styles.comparisonCard}><SectionLabel tone={C.purple}>Same moment · before and after</SectionLabel><View style={styles.responseBlock}><Text style={styles.responseLabel}>First response</Text><Text style={styles.responseText}>“{originalResponse}”</Text></View><View style={styles.responseDivider} /><View style={styles.responseBlock}><Text style={styles.responseLabel}>Retry</Text><Text style={styles.responseText}>“{retryResponse}”</Text></View><Text style={styles.comparisonText}>{comparison}</Text></ProductCard></Reveal>
    <Reveal index={3}><ProductCard style={styles.strongCard}><SectionLabel tone={C.purple}>A strong version</SectionLabel><Text style={styles.strongText}>“{strongVersion}”</Text><Pressable onPress={onToggleSave} style={[styles.saveStrongButton, isSaved && styles.saveStrongButtonSaved]} accessibilityRole="button" accessibilityState={{ selected: isSaved }}><View style={styles.saveIcon}>{isSaved ? <Check size={17} color={C.onAccent} strokeWidth={3} /> : <Bookmark size={17} color={C.purple} />}</View><Text style={[styles.saveStrongText, isSaved && styles.saveStrongTextSaved]}>{isSaved ? "Saved for later" : "Save this version for later"}</Text></Pressable></ProductCard></Reveal>
    <Reveal index={4}><PrimaryButton label={isCompleting ? "Updating your Index…" : "Done — back to Home"} disabled={isCompleting} onPress={onFinish} containerStyle={styles.finishButton} /><Text style={styles.privacyNote}>{isSaved ? "The strong version will be saved. Your rehearsal transcript will be deleted." : "Your rehearsal transcript will be deleted when you finish."}</Text></Reveal>
  </ScrollView></View>;
}

function Unavailable({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <View style={[styles.root, styles.unavailable]}>
      <ShieldCheck size={30} color={C.sage} />
      <Text style={styles.unavailableTitle}>{title}</Text>
      <Text style={styles.unavailableBody}>{body}</Text>
      {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} containerStyle={styles.retryButton} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2EDE4" },
  webView: { flex: 1, backgroundColor: "#F2EDE4" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { ...T.caption },
  backButton: { position: "absolute", left: 12, zIndex: 4, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  menuButton: { position: "absolute", right: 12, zIndex: 5, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  qaBadge: { position: "absolute", alignSelf: "center", zIndex: 3, minHeight: 32, borderRadius: 16, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line },
  qaBadgeText: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.1, color: C.purple },
  completionScroll: { paddingHorizontal: GUTTER, paddingTop: 76 }, celebrationIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.purple, alignItems: "center", justifyContent: "center", marginBottom: 18, ...shadow.hero }, completionTitle: { fontFamily: font.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: C.text, marginTop: 10, maxWidth: 340 }, completionLede: { ...T.support, marginTop: 10, maxWidth: 340 },
  indexImpactCard: { marginTop: 24, gap: 10 }, impactTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, impactResult: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, color: C.text, marginTop: 7 }, indexTransition: { gap: 9 }, indexNumbers: { flexDirection: "row", alignItems: "baseline", gap: 8 }, indexBefore: { fontFamily: font.semi, fontSize: 31, color: C.dim, textDecorationLine: "line-through" }, indexArrow: { fontFamily: font.regular, fontSize: 23, color: C.dim }, indexAfter: { fontFamily: font.bold, fontSize: 54, lineHeight: 60, color: C.purple, letterSpacing: -1.5 }, indexOutOf: { fontFamily: font.regular, fontSize: 14, color: C.dim }, indexTrack: { height: 8, overflow: "hidden", borderRadius: 4, backgroundColor: "rgba(81,40,136,0.11)" }, indexFill: { height: "100%", borderRadius: 4, backgroundColor: C.purple }, impactExplanation: { ...T.support, color: C.text }, signalNote: { ...T.caption, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  comparisonCard: { marginTop: 14, gap: 12 }, responseBlock: { gap: 5 }, responseLabel: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.7, textTransform: "uppercase", color: C.dim }, responseText: { fontFamily: font.medium, fontSize: 16, lineHeight: 23, color: C.text }, responseDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line }, comparisonText: { ...T.support, color: C.purple, paddingTop: 4 },
  strongCard: { marginTop: 14, gap: 10 }, strongText: { fontFamily: font.medium, fontSize: 18, lineHeight: 27, color: C.text }, saveStrongButton: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: C.purple, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, saveStrongButtonSaved: { backgroundColor: C.purple }, saveIcon: { width: 24, alignItems: "center" }, saveStrongText: { fontFamily: font.semi, fontSize: 14, color: C.purple }, saveStrongTextSaved: { color: C.onAccent }, finishButton: { marginTop: 22 }, privacyNote: { ...T.caption, textAlign: "center", marginTop: 10, paddingHorizontal: 20 },
  lessonMenu: { position: "absolute", right: 12, zIndex: 8, width: 278, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.98)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  lessonMenuLabel: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.2, color: C.dim, paddingHorizontal: 6, paddingBottom: 7 },
  lessonMenuAction: { minHeight: 70, borderRadius: 14, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.claySoft },
  lessonMenuCopy: { flex: 1 }, lessonMenuTitle: { fontFamily: font.bold, fontSize: 14, color: C.clay }, lessonMenuBody: { ...T.caption, marginTop: 2 },
  completionReset: { position: "absolute", left: 18, right: 18, zIndex: 6, alignItems: "center" }, completionResetButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: C.line, ...shadow.layer }, completionResetText: { fontFamily: font.bold, fontSize: 13, color: C.purple },
  resetNotice: { position: "absolute", left: 14, right: 14, zIndex: 10, minHeight: 56, borderRadius: 18, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.text, ...shadow.layer }, resetNoticeText: { flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: C.onAccent }, undoButton: { minWidth: 58, minHeight: 44, alignItems: "center", justifyContent: "center" }, undoText: { fontFamily: font.bold, fontSize: 13, color: "#DCC8F6" },
  unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  unavailableTitle: { ...T.title, textAlign: "center", marginTop: 16 },
  unavailableBody: { ...T.support, textAlign: "center", marginTop: 8 },
  retryButton: { marginTop: 20, minWidth: 160 },
});
