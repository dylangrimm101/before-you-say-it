import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { approvedLessonDeck } from "@/constants/approvedLessons";
import { C, GUTTER, T, font, shadow } from "@/constants/theme";
import { loadApprovedDeckHtml, loadConvertedHandoffDeckHtml, loadReturnedDeckHtml } from "@/lib/approvedDeckLoader";
import { conversionRuntimeEnabled, M1_L1_CONVERSION, type TransferChoice } from "@/lib/convertedLesson";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

/** Renders an approved source deck behind a strict internal-review boundary. */
export default function ApprovedLessonDeckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lessonId?: string; returnFromRehearsal?: string }>();
  const lesson = approvedLessonDeck(params.lessonId);
  const { activeScenarioRun, commitConvertedLessonProgress, saveActiveScenarioRun } = useStore();
  const isConverted = conversionRuntimeEnabled(params.lessonId);
  const isReturning = isConverted && params.returnFromRehearsal === "1";
  const [savedMoveHandled, setSavedMoveHandled] = useState<boolean>(false);
  const [completionCommitted, setCompletionCommitted] = useState<boolean>(false);
  const [deckHtml, setDeckHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;
    setDeckHtml(null);
    setLoadError(false);
    if (!__DEV__ || !lesson) return () => { isActive = false; };

    const loader = isReturning
      ? loadReturnedDeckHtml(lesson.archivePath, M1_L1_CONVERSION.returnCard)
      : isConverted
        ? loadConvertedHandoffDeckHtml(lesson.archivePath, M1_L1_CONVERSION.rehearsalHandoffCard)
        : loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    loader.then((html) => { if (isActive) setDeckHtml(html); })
      .catch((error: unknown) => {
        safeLog("[approved-lessons] approved archive failed", errorShape(error));
        if (isActive) setLoadError(true);
      });
    return () => { isActive = false; };
  }, [isConverted, isReturning, lesson]);

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
              var counter = currentCounter();
              var message = null;
              if (counter === "21 / 22" && document.body.innerText.indexOf("___") < 0) message = { type:"saved-move-handled" };
              if (counter === "22 / 22" && ["say it", "write it", "save it for later"].indexOf(label) >= 0) message = { type:"transfer-selected", label:label };
              if (message && window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }, 80);
          }
          return true;
        }, true);
        function enforce() {
          fitApprovedFrame();
          disableDeferredActions();
          protectScrollableCardContent();
        }
        new MutationObserver(enforce).observe(document, { childList: true, subtree: true });
        window.addEventListener("resize", enforce);
        enforce();
      })();
      true;
    `;
  }, [isConverted, isReturning, lesson]);

  const handleDeckMessage = useCallback(async (raw: string): Promise<void> => {
    let message: { type?: unknown; label?: unknown };
    try {
      message = JSON.parse(raw) as { type?: unknown; label?: unknown };
    } catch {
      return;
    }
    if (message.type === "start-rehearsal" && isConverted && !isReturning) {
      router.push({ pathname: "/approved-rehearsal/[lessonId]", params: { lessonId: M1_L1_CONVERSION.lessonId } });
      return;
    }
    if (message.type === "saved-move-handled" && isReturning) {
      setSavedMoveHandled(true);
      return;
    }
    if (message.type !== "transfer-selected" || !isReturning || completionCommitted) return;
    const transferByLabel: Record<string, TransferChoice> = { "say it": "say", "write it": "write", "save it for later": "save_later" };
    const transferChoice = typeof message.label === "string" ? transferByLabel[message.label] : undefined;
    const run = activeScenarioRun?.run;
    if (!transferChoice || !savedMoveHandled || !run?.retryAttempt || !run.comparison) return;
    try {
      await commitConvertedLessonProgress({
        lessonId: M1_L1_CONVERSION.lessonId,
        practiceId: M1_L1_CONVERSION.practiceId,
        contentVersion: M1_L1_CONVERSION.contentVersion,
        lessonCardCheckpoint: M1_L1_CONVERSION.completionCard,
        quizGatesCompleted: true,
        rehearsalCompleted: true,
        retryCompleted: true,
        comparisonViewed: true,
        savedMoveId: M1_L1_CONVERSION.namedMoveId,
        transferChoice,
        completedAt: Date.now(),
        sourceLineage: "approved-html-deck",
      });
      await saveActiveScenarioRun(null);
      setCompletionCommitted(true);
    } catch (error: unknown) {
      safeLog("[converted-lesson] progress commit failed", errorShape(error));
      Alert.alert("We couldn’t save your progress", "Stay on this screen and try again.");
    }
  }, [activeScenarioRun?.run, commitConvertedLessonProgress, completionCommitted, isConverted, isReturning, router, saveActiveScenarioRun, savedMoveHandled]);

  if (!__DEV__) {
    return <Unavailable title="Lesson review is unavailable." body="Approved source decks are available only in internal development builds." />;
  }
  if (!lesson) return <Unavailable title="That approved deck isn't available." body="Return to the internal lesson catalog and choose another deck." />;

  return (
    <View style={styles.root}>
      {deckHtml && !loadError ? (
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
      <View pointerEvents="none" style={[styles.qaBadge, { top: insets.top + 9 }]}>
        <Text style={styles.qaBadgeText}>{completionCommitted ? "PRACTICE COMPLETE" : isReturning ? "REHEARSAL COMPLETE" : "INTERNAL QA"}</Text>
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
  unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  unavailableTitle: { ...T.title, textAlign: "center", marginTop: 16 },
  unavailableBody: { ...T.support, textAlign: "center", marginTop: 8 },
});
