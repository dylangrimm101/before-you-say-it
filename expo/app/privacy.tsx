import { useRouter } from "expo-router";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, Reveal, tap } from "@/components/ui";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import {
  DEBRIEF_PROVIDER,
  ROLEPLAY_PROVIDER,
  TRANSCRIPTION_PROVIDER,
  VOICE_PROVIDER,
} from "@/lib/consent";
import { useStore } from "@/providers/store";

/**
 * Privacy & Data. Describes what this build actually stores and which real
 * services receive what, and gives the user working delete controls.
 *
 * Every claim here is checked against the implementation — no invented
 * provider practices, and no "completely private" language.
 */
export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState("");
  const {
    sessions,
    customScenarios,
    activePracticeSession,
    consent,
    setSaveCustomScenarioText,
    deleteAllSessions,
    deleteAllCustomScenarios,
    reset,
    devProEnabled,
    toggleDevPro,
  } = useStore();

  const confirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      tap("medium");
      if (Platform.OS === "web") {
        onConfirm();
        return;
      }
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onConfirm },
      ]);
    },
    [],
  );

  const onDeleteHistory = useCallback(() => {
    confirm(
      "Delete all practice history?",
      "Every saved session record and any legacy retained recording will be removed from this device. Your active Day 1 handoff, streak days, and program progress stay.",
      () => {
        setError("");
        void deleteAllSessions().catch(() => setError("Couldn’t delete practice history. Try again."));
      },
    );
  }, [confirm, deleteAllSessions]);

  const onDeleteScenarios = useCallback(() => {
    confirm(
      "Delete your saved scenarios?",
      "The scenarios you wrote will be removed from this device.",
      () => {
        setError("");
        void deleteAllCustomScenarios().catch(() => setError("Couldn’t delete your scenarios. Try again."));
      },
    );
  }, [confirm, deleteAllCustomScenarios]);

  const onResetAll = useCallback(() => {
    confirm(
      "Reset all app data?",
      "Removes local practice data and choices for the current guest or signed-in owner, clears local audio caches, and signs you out. Other owners' local data and server-held records are not deleted. Subscriptions are not cancelled.",
      () => {
        setError("");
        void reset().then(() => {
          router.replace("/onboarding");
        }).catch(() => setError("Couldn’t reset app data. Some data may already have been removed. Try again to finish."));
      },
    );
  }, [confirm, reset, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + 50,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PressCard onPress={() => router.back()} style={styles.backBtn}>
          <View style={styles.backInner}>
            <ChevronLeft size={20} color={C.textSoft} />
            <Text style={styles.backLabel}>Back</Text>
          </View>
        </PressCard>

        <Reveal index={0}>
          <Eyebrow color={C.purpleLight}>Privacy &amp; details</Eyebrow>
          <Text style={styles.title}>What this app keeps, and what it sends</Text>
          <Text style={styles.lede}>
            A plain-language guide to your practice data, where it goes, and the controls you have over it.
          </Text>
        </Reveal>

        <Section title="Stored on this device">
          <Bullet
            head="Session records"
            body={`${sessions.length} saved. Each saved session keeps a minimized record of the scenario, date, completion details, and result summary when one is available. It does not keep the rehearsal transcript.`}
          />
          <Bullet
            head="Your active Day 1 handoff"
            body={activePracticeSession
              ? "Stored on this device so the journey can resume: the practice-session and anonymous device IDs, route and scenario context, approved rehearsal turns, current checkpoint, and evidence-linked result once complete. Unapproved drafts and raw audio are excluded."
              : "No Day 1-to-Day-30 baseline record is stored on this device."}
          />
          <Bullet
            head="Other transcripts"
            body="An active scenario or lesson can keep approved attempts, counterpart lines, coaching and retry checkpoints so you can resume. Scored-practice evidence may also retain approved text. Unapproved drafts are not saved as evidence. Reset all app data removes these local records too."
          />
          <Bullet
            head="Your script for the real conversation"
            body="When a saved session includes suggested opening lines, they stay with that session so you still have them for the real conversation. These are AI-written suggestions — not a record of what you said. Deleting the saved session record deletes those lines."
          />
          <Bullet
            head="Recordings"
            body="Raw audio is not stored by this app. A recording is sent once for transcription, then its temporary file is deleted from this device."
          />
          <Bullet
            head="Your profile"
            body="Your relationship focus, chosen voice, reaction pattern and difficulty. The profile itself does not keep free text; the separate active Day 1 handoff keeps only the conversation details listed above so it can resume."
          />
          <Bullet
            head="Scenarios you wrote"
            body={
              consent.saveCustomScenarioText
                ? `${customScenarios.length} saved on this device, because you turned that on below.`
                : "Not saved to your scenario library or durable rehearsal records. Custom title, situation, objective, and counterpart text stay out of storage unless you opt in."
            }
          />
          <Bullet
            head="Streaks, drills, program days, reminder time"
            body="Dates, day numbers, curriculum version, and completed behavior IDs only. Nothing about what you said."
          />
          <Bullet
            head="Safety answers"
            body="Never stored, and never sent anywhere. They exist only while the safety screen is open."
          />
          <Bullet
            head="How it is stored"
            body="In the normal mobile app, guest conversation content stays in memory for the current visit. A cold relaunch, leaving the visit, or returning after 30 minutes in the background starts fresh. Brief interruptions keep the current practice. Authentication and content-free request identifiers remain protected on the device; starting fresh does not reset usage limits. Generated voice uses temporary owner-and-visit-scoped cache files; cleanup is attempted on leaving the visit and before the next visit's playback, not guaranteed while the app is closed. Choosing to save a result to an account creates a protected handoff copy, valid for 24 hours from that consent step. Expiry does not promise immediate physical erasure. Signed-in practice and older local records remain owner-separated; old records are not automatically imported into a new guest visit. Browser handoff remains limited to the browser session. Other local app data is not separately encrypted by BYSI."
            tone={C.amber}
          />
        </Section>

        <Section title="Sent off this device">
          <Bullet
            head="Free-session recovery"
            body="The new mobile guest-visit protocol uses short-lived server content to safely finish and retry current requests, not to offer cross-visit history. Guest conversation checkpoints, response audio and unclaimed results expire no later than 24 hours after the visit begins. Explicitly ending a visit, or beginning its replacement after pending work has finished, retires that visit's unclaimed content sooner when the server confirms it. A phone closing or losing connectivity cannot guarantee immediate server deletion. Older clients and registered-account practice can retain recovery content for up to 30 days of inactivity. Uploaded recording bytes are processed, not saved in this recovery store. The existing scheduled cleanup runs every minute in bounded batches; delays or outages are not an immediate erasure guarantee. Content-free operation and spend records remain for abuse and cost protection. Local handoff, backups and providers have separate retention."
          />
          <Bullet
            head="Your account"
            body="Signing in reconnects your eligible access through your existing web account. Access remains subject to a current access check; signing in alone does not create a subscription. An owned web result can be retrieved through the account connection. Local practice data does not automatically sync between devices."
          />
          <Bullet
            head="Saved results"
            body="A signed-in saved result is kept as account-owned content until you delete it or delete all saved results from the saved-result screen. Unclaimed results from the new guest-visit protocol expire with that visit's server content; older guest saved results expire after thirty days. Opening or browsing a guest result does not extend that clock."
          />
          <Bullet
            head="Recorded audio"
            body={`Sent to ${TRANSCRIPTION_PROVIDER} to be converted to text.`}
          />
          <Bullet
            head="What you said, as text"
            body={`Sent to ${ROLEPLAY_PROVIDER} to play the other person, and to ${DEBRIEF_PROVIDER} to write your debrief or one evidence-linked pilot coaching note.`}
          />
          <Bullet
            head="The other person's lines"
            body={`Sent to ${VOICE_PROVIDER} to be spoken aloud. Your own words are not sent for voice.`}
          />
          <Bullet
            head="Purchases"
            body="Handled by RevenueCat with an anonymous app ID or your signed-in account ID. No conversation content is involved."
          />
          <Bullet
            head="Reminders"
            body="Scheduled locally by your phone. No server, and no push token."
          />
          <Bullet
            head="Analytics"
            body="None. There is no analytics sink in this build."
          />
          <Bullet
            head="Account identity deletion"
            body="Settings has a separate account identity deletion control. It is currently unavailable until its server capability is enabled. When enabled, it requires your current password and explicit confirmation, then irreversibly soft-deletes the account provider’s sign-in identity. account deletion erases saved result content and owner-scoped free-session recovery content from BYSI’s private stores, and suppresses late result finishes, claims and replays for that owner. Purchase records, content-free accounting, other devices, backups, provider records and subscriptions are handled separately. Existing access tokens can last until expiry. Device reset below is separate and never deletes the server account."
          />
          <Bullet
            head="What deleting cannot undo"
            body="These controls remove the local records described below. Reset does not delete other owners' local data, your web account, server-held saved results, or provider records, and does not cancel a subscription. Saved-result deletion is separate. It cannot retroactively delete processing a provider has already completed — that is governed by that provider's own retention policy, not by this app."
            tone={C.amber}
          />
        </Section>

        <Section title="Your choices">
          {error ? <Text accessibilityRole="alert" style={styles.bulletBody}>{error}</Text> : null}
          <Toggle
            label="Save scenarios I write on this device"
            body="Off by default. When on, the exact text of scenarios you write is kept so you can rehearse them again another day."
            value={consent.saveCustomScenarioText}
            onChange={(v) => {
              tap("light");
              setError("");
              void setSaveCustomScenarioText(v).catch(() => {
                setError("Couldn’t save your privacy choice. Check the setting and try again.");
              });
            }}
          />
        </Section>

        {__DEV__ ? (
          <Section title="Development only">
            <Toggle
              label="Simulate a Pro subscription"
              body="Development builds only, and never present in a release build. Unlocks the paid path locally so it can be tested where the store's billing module is unavailable. This does not create a real subscription."
              value={devProEnabled}
              onChange={(v) => {
                tap("light");
                toggleDevPro(v);
              }}
            />
          </Section>
        ) : null}

        <Section title="Delete">
          <Danger
            label="Delete all practice history"
            body="Removes every saved session record, its suggested script, its in-memory debrief, and any legacy retained recording. The separate active Day 1 handoff stays available for restart or resume."
            onPress={onDeleteHistory}
          />
          <Danger
            label="Delete scenarios I wrote"
            body="Removes the scenarios you created."
            onPress={onDeleteScenarios}
          />
          <Danger
            label="Reset all app data"
            body="Removes local practice data and choices for the current guest or signed-in owner, clears local audio caches, and signs you out. Other owners' local data, your web account, server-held saved results and subscriptions remain. Use the saved-result screen for saved-result deletion."
            onPress={onResetAll}
          />
          <Text style={styles.perSession}>
            To delete a single saved session record, open it from History in the Progress tab. Reset all app data to remove the separate active Day 1 handoff too.
          </Text>
        </Section>

        <Text style={styles.footer}>
          This is practice, not therapy, and not a crisis service. If you or someone
          else is in danger, contact real-world support — in the US, call or text 988,
          or call 911 in an emergency.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal index={1}>
      <Eyebrow color={C.dim} style={styles.sectionHead}>
        {title}
      </Eyebrow>
      <View style={styles.card}>{children}</View>
    </Reveal>
  );
}

function Bullet({ head, body, tone = C.text }: { head: string; body: string; tone?: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletHead, { color: tone }]}>{head}</Text>
      <Text style={styles.bulletBody}>{body}</Text>
    </View>
  );
}

function Toggle({
  label,
  body,
  value,
  onChange,
}: {
  label: string;
  body: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.bullet}>
      <View style={styles.toggleRow}>
        <Text style={styles.bulletHead}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: C.surfaceHigh, true: `${C.sage}88` }}
          thumbColor={value ? C.sage : C.dim}
        />
      </View>
      <Text style={styles.bulletBody}>{body}</Text>
    </View>
  );
}

function Danger({
  label,
  body,
  onPress,
}: {
  label: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <PressCard onPress={onPress}>
      <View style={styles.dangerRow}>
        <Trash2 size={16} color={C.clay} />
        <View style={styles.flex}>
          <Text style={styles.dangerLabel}>{label}</Text>
          <Text style={styles.bulletBody}>{body}</Text>
        </View>
      </View>
    </PressCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  backBtn: { alignSelf: "flex-start", marginBottom: 16 },
  backInner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingRight: 12,
  },
  backLabel: { ...T.support, fontFamily: font.semi },
  title: { ...T.display, marginTop: 10 },
  lede: { ...T.support, marginTop: 14 },
  sectionHead: { marginTop: 32, marginBottom: 12 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    ...shadow.layer,
  },
  bullet: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    gap: 6,
  },
  bulletHead: { ...T.support, flex: 1, fontFamily: font.semi, color: C.text },
  bulletBody: T.caption,
  toggleRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  dangerRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  dangerLabel: { ...T.support, fontFamily: font.semi, color: C.clay, marginBottom: 6 },
  perSession: { ...T.caption, paddingVertical: 16 },
  footer: { ...T.caption, marginTop: 32 },
});
