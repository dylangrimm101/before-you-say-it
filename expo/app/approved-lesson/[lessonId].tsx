import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { approvedLessonDeck } from "@/constants/approvedLessons";
import { C, GUTTER, T, font, shadow } from "@/constants/theme";
import { safeLog } from "@/lib/redact";

/** Renders an approved source deck behind a strict internal-review boundary. */
export default function ApprovedLessonDeckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const lesson = approvedLessonDeck(params.lessonId);
  const [loadError, setLoadError] = useState<boolean>(false);

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
        var blockedLabels = ["start rehearsal", "start voice rehearsal", "continue lesson preview"];
        function textOf(node) {
          return String(node && (node.innerText || node.textContent) || "").trim().toLowerCase();
        }
        function currentCounter() {
          var counters = Array.prototype.slice.call(document.querySelectorAll("[data-tnum]"));
          for (var i = 0; i < counters.length; i += 1) {
            var value = textOf(counters[i]);
            if (value === boundary + " / " + total) return value;
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
          return true;
        }, true);
        function enforce() {
          fitApprovedFrame();
          disableDeferredActions();
        }
        new MutationObserver(enforce).observe(document, { childList: true, subtree: true });
        window.addEventListener("resize", enforce);
        enforce();
      })();
      true;
    `;
  }, [lesson]);

  if (!__DEV__) {
    return <Unavailable title="Lesson review is unavailable." body="Approved source decks are available only in internal development builds." />;
  }
  if (!lesson) return <Unavailable title="That approved deck isn't available." body="Return to the internal lesson catalog and choose another deck." />;

  return (
    <View style={styles.root}>
      {!loadError ? (
        <WebView
          source={{ html: lesson.deckHtml, baseUrl: "about:blank" }}
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
          onError={(event) => {
            safeLog("[approved-lessons] webview failed", { code: event.nativeEvent.code, description: event.nativeEvent.description });
            setLoadError(true);
          }}
          accessibilityLabel={`${lesson.title} approved source deck`}
        />
      ) : (
        <Unavailable title="The approved deck couldn't open." body="Return to the catalog and try again." />
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
        <Text style={styles.qaBadgeText}>INTERNAL QA</Text>
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
  backButton: { position: "absolute", left: 12, zIndex: 4, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line, ...shadow.layer },
  qaBadge: { position: "absolute", right: 14, zIndex: 3, minHeight: 32, borderRadius: 16, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: C.line },
  qaBadgeText: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.1, color: C.purple },
  unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  unavailableTitle: { ...T.title, textAlign: "center", marginTop: 16 },
  unavailableBody: { ...T.support, textAlign: "center", marginTop: 8 },
});
