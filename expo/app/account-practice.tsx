import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Backdrop, GhostButton, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T } from "@/constants/theme";
import { useAuth } from "@/providers/auth";
import { useStore } from "@/providers/store";

/** Explicit local-content consent; never server ownership or an entitlement. */
export default function AccountPractice() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthLoading, practiceOwner, canAttachCurrentGuestPractice, continuationIssue } = useAuth();
  const { hydrated, activePracticeSession, beginNativeJourney, attachCurrentGuestPractice, isLocalGuestContinuation } = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const ready = hydrated && !isAuthLoading && Boolean(user) && Boolean(practiceOwner?.storage.isActive());
  const attach = async () => {
    if (!ready || !canAttachCurrentGuestPractice || activePracticeSession || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const id = await attachCurrentGuestPractice();
      if (practiceOwner?.storage.isActive()) router.replace(`/debrief/${id}`);
    } catch {
      setError("Attachment could not be confirmed. No paid access was granted. Continue with this account to check its saved practice; this one-use request will not be replayed.");
    } finally { pending.current = false; setBusy(false); }
  };
  const restart = async () => {
    if (!ready || activePracticeSession || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await beginNativeJourney();
      if (!practiceOwner?.storage.isActive()) return;
      router.replace("/onboarding");
    } catch {
      setError("We couldn’t start a new rehearsal. No guest work was attached. Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return <View style={styles.root}><Backdrop /><ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}>
    <Text style={styles.title}>Choose your account’s next step.</Text>
    <Text style={styles.body}>{canAttachCurrentGuestPractice ? "Your current rehearsal can be attached on this device as local user-provided practice. This reuses the same approved attempt and saved result without running the assessment again. It is not an authenticated web result or a guarantee of provider truth. No history, lesson completion, subscription or paid access is imported. Attach only if this is your rehearsal and the account shown below is yours." : isLocalGuestContinuation ? "This account has a local rehearsal continuation on this device, not an authenticated web result. No paid access or lesson completion was granted." : "Guest work has not been attached. Older records without a current-run capability remain separate. No result, history, completion, or paid access has been carried over."}</Text>
    <Text style={styles.body}>{user ? `Signed in as ${user.email ?? "your account"}.` : "Log in to choose an account rehearsal."}</Text>
    {activePracticeSession ? <Text style={styles.body}>This account already has a rehearsal. Continue with this account to resume it; starting here will not overwrite it.</Text> : <Text style={styles.body}>You can continue with this account’s existing practice, or explicitly start a new rehearsal. Starting again does not purchase or unlock a subscription.</Text>}
    {continuationIssue ? <Text style={styles.body} accessibilityRole="alert">{continuationIssue}</Text> : null}
    {error ? <Text style={styles.body} accessibilityRole="alert">{error}</Text> : null}
    {canAttachCurrentGuestPractice ? <PrimaryButton label="Retry saving this result" disabled={!ready || busy || Boolean(activePracticeSession)} onPress={() => void attach()} /> : null}
    {isLocalGuestContinuation && activePracticeSession ? <PrimaryButton label="Continue saved rehearsal" disabled={!ready || busy} onPress={() => router.replace(`/debrief/${activePracticeSession.id}`)} /> : null}
    <PrimaryButton label="Continue with this account" disabled={!ready || busy} onPress={() => router.replace("/(tabs)")} />
    {!canAttachCurrentGuestPractice && !continuationIssue && !isLocalGuestContinuation ? <GhostButton label="Start a new account rehearsal" disabled={!ready || busy || Boolean(activePracticeSession)} onPress={() => void restart()} /> : null}
    {!user && !isAuthLoading ? <GhostButton label="Log in" onPress={() => router.replace("/continue-from-web")} /> : null}
  </ScrollView></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, content: { paddingHorizontal: GUTTER, gap: 20 }, title: { ...T.display }, body: { ...T.body, color: C.textSoft } });
