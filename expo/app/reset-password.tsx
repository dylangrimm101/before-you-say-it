import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { getImplicitPasswordRecovery } from "@/lib/accountLifecycleRuntime";
import { FORGOT_URL, parseCallback } from "@/lib/passwordRecoveryCallback";
import { callbackPartsFromUrl, takeCapturedRecoveryUrl } from "@/lib/passwordRecoveryIntent";

const OPEN_EMAIL_COPY = "Open the newest Before You Say It reset email and tap Reset password. That link opens the branded website so the reset session stays in your browser. Then return here and sign in. Do not copy a link from logs.";

export default function ResetPasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const recovery = useRef<ReturnType<typeof getImplicitPasswordRecovery> | null>(null);
  const [mode, setMode] = useState<"waiting" | "form" | "done">("waiting");
  const [intro, setIntro] = useState(OPEN_EMAIL_COPY);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const apply = async (url: string | null) => {
      if (!url || cancelled) return;
      const parts = callbackPartsFromUrl(url);
      if (!parts || (!parts.search && !parts.hash)) return;
      try {
        const callback = parseCallback(parts.search, parts.hash);
        const flow = getImplicitPasswordRecovery();
        if (!flow) {
          setIntro("Password recovery isn’t available in this build.");
          return;
        }
        recovery.current = flow;
        const opened = await flow.open(callback);
        if (cancelled) return;
        setIntro(`Set a new password for ${opened.email}. Keep this screen open until you save.`);
        setMode("form");
      } catch {
        if (!cancelled) {
          setIntro("This reset link could not be used in the app. Open the newest email on this device and tap Reset password so the Before You Say It website can finish the change.");
          setMode("waiting");
        }
      }
    };
    const captured = takeCapturedRecoveryUrl();
    void apply(captured);
    void Linking.getInitialURL().then((url) => { void apply(url); });
    const subscription = Linking.addEventListener("url", (event) => { void apply(event.url); });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const save = async (): Promise<void> => {
    if (busy.current || !recovery.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await recovery.current.save(password, confirm);
      const messages: Record<string, string> = {
        invalid_password: "Use matching passwords of 8–128 characters.",
        weak_password: "Choose a stronger password and try again.",
        same_password: "Choose a password different from your current password.",
        unavailable: "This reset session could not be verified. Request a new reset email.",
        update_unconfirmed: "We could not confirm whether your password changed. Try signing in with your new password before requesting another reset.",
        updated: "Password updated. Sign in with your new password.",
        updated_cleanup_unconfirmed: "Password updated, but signing out other sessions was not confirmed. Sign in with your new password and contact support.",
      };
      setStatus(messages[result.state] ?? messages.unavailable);
      if (result.state === "updated" || result.state === "updated_cleanup_unconfirmed") {
        setMode("done");
        setPassword("");
        setConfirm("");
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <PressCard onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><ArrowLeft size={21} color={C.textSoft} /></PressCard>
          <Reveal>
            <Eyebrow color={C.purple}>Before You Say It</Eyebrow>
            <Text style={styles.title}>{mode === "done" ? "Password updated" : "Choose a new password"}</Text>
            <Text style={styles.lede}>{intro}</Text>
          </Reveal>
          {mode === "form" ? (
            <Reveal index={1} style={styles.formWrap}>
              <View style={styles.form}>
                <Text style={styles.label}>New password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="8–128 characters"
                  placeholderTextColor={C.dim}
                  secureTextEntry={!show}
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!pending}
                  style={styles.input}
                  accessibilityLabel="New password"
                />
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  placeholderTextColor={C.dim}
                  secureTextEntry={!show}
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!pending}
                  style={styles.input}
                  accessibilityLabel="Confirm new password"
                />
                <PrimaryButton label={show ? "Hide passwords" : "Show passwords"} disabled={pending} onPress={() => setShow((value) => !value)} />
                <PrimaryButton label={pending ? "Saving…" : "Save new password"} disabled={pending} onPress={() => { void save(); }} containerStyle={styles.submit} />
              </View>
            </Reveal>
          ) : (
            <Reveal index={1} style={styles.formWrap}>
              <PrimaryButton label="Request a reset email" onPress={() => router.push("/forgot-password")} />
              <PrimaryButton label="Open the website reset page" onPress={() => { void Linking.openURL(FORGOT_URL); }} containerStyle={styles.submit} />
              <PrimaryButton label="Sign in" onPress={() => router.replace("/continue-from-web")} containerStyle={styles.submit} />
            </Reveal>
          )}
          {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: GUTTER },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -10, marginBottom: 24 },
  title: { ...T.display, marginTop: 10 },
  lede: { ...T.body, color: C.textSoft, marginTop: 14 },
  formWrap: { marginTop: 30 },
  form: { borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, backgroundColor: C.onAccent, padding: 20 },
  label: { fontFamily: font.semi, fontSize: 13, color: C.text, marginBottom: 8, marginTop: 4 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)", paddingHorizontal: 15, fontFamily: font.regular, fontSize: 16, color: C.text, marginBottom: 17 },
  submit: { marginTop: 12 },
  status: { ...T.body, color: C.textSoft, marginTop: 16 },
});
