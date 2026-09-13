import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, LockKeyhole } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { useAuth } from "@/providers/auth";
import { authEnvironment, supabase } from "@/lib/supabase";


// Confirmation is completed by Supabase in the browser. This app deliberately
// uses verified password login on manual return, not an unimplemented token callback.
// Keep the isolated project's own redirect configuration separate.
const confirmationOptions = authEnvironment?.staging
  ? undefined
  : { emailRedirectTo: "https://beforeyousayit.app/" };


export default function ContinueFromWebScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [signup, setSignup] = useState(params.mode === "signup");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const busy = useRef(false);
  const insets = useSafeAreaInsets();
  const { login, isAuthConfigured, stagingWebBridge, normalResults, session, hasCurrentGuestPractice, cancelLogin, durableGuestContinuation, continuationIssue } = useAuth();
  useEffect(() => () => cancelLogin?.(), [cancelLogin]);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const submit = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      if (signup && !confirmationPending) {
        if (!email.trim() || password.length < 8) { setError("Enter your email and a password of at least 8 characters."); return; }
        if (session?.user && !session.user.is_anonymous) { setError("Sign out before creating another account."); return; }
        if (!supabase) { setError("Account signup isn’t configured for this build."); return; }
        const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, ...(confirmationOptions ? { options: confirmationOptions } : {}) });
        if (result.error) { setError("We couldn’t create your account or send confirmation. Check your details and connection, then retry."); return; }
        setConfirmationPending(true);
        return;
      }
      const result = await login(email, password, hasCurrentGuestPractice);
      if (!result.success) {
        setError(result.message ?? "We couldn’t log you in.");
        return;
      }
      if (result.continuationId) { router.replace(`/debrief/${result.continuationId}`); return; }
      if (result.continuationProblem) { router.replace("/account-practice"); return; }
      if (signup) { router.replace("/account-practice"); return; }
      if (stagingWebBridge) { router.replace("/staging-web-result"); return; }
      if (normalResults) { router.replace("/saved-result"); return; }
      // AuthProvider has mounted this owner’s isolated store. Never write or
      // reassign the previous guest/account lease captured before login.
      router.replace(session?.user.is_anonymous === true ? "/account-practice" : "/(tabs)");
    } catch {
      setError("We couldn’t safely connect your local practice. Your saved practice has not been reassigned.");
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  }, [email, login, password, router, stagingWebBridge, normalResults, session, hasCurrentGuestPractice, signup, confirmationPending]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <PressCard onPress={() => { cancelLogin?.(); router.back(); }} style={styles.back} accessibilityLabel="Back"><ArrowLeft size={21} color={C.textSoft} /></PressCard>
          <Reveal>
            <Eyebrow color={C.purple}>{signup ? "Welcome" : "Welcome back"}</Eyebrow>
            <Text style={styles.title}>{signup ? "Create your account." : "Log in to your account."}</Text>
            <Text style={styles.lede}>{normalResults ? "Sign in to find your account’s saved result and continue with the same lessons and practice. Your result and subscription are checked separately. If you already bought a plan, don’t buy the same plan again." : stagingWebBridge ? "Use your staging web account to activate or restore its saved result after login. Don’t purchase again if you paid on the web." : "Use the same account you used on the web if you already have a password. Web subscription activation and web result restore aren’t available in this build. If you paid on the web, don’t purchase again in the app."}</Text>
          </Reveal>

          <Text style={styles.lede}>{hasCurrentGuestPractice ? "Sign in below to save this current rehearsal to the account you enter and continue on this device. By choosing “Sign in to save this result and continue”, you confirm this is your rehearsal and consent to saving it as local user-provided practice. This is not a verified web result, proof of provider truth, or a purchase; no paid access is granted." : "Guest practice cannot be transferred without a current-run capability. Logging in leaves older guest work separate; it does not attach results, scores, or purchases. You can go back without changing accounts."}</Text>
          {hasCurrentGuestPractice ? <Text style={styles.lede}>{durableGuestContinuation ? "This new rehearsal has a device-secured handoff for up to 24 hours from creation. You can reopen this app on the same device before signing in. Deleting the rehearsal or signing out cancels that handoff." : "Keep this browser session open until saving finishes. Secure device handoff is not available here; reloading or closing this session before saving can leave guest work separate from your account."}</Text> : null}
          {continuationIssue ? <Text style={styles.error} accessibilityRole="alert">{continuationIssue}</Text> : null}
          <Reveal index={1} style={styles.formWrap}>
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(nextEmail) => {
                  if (nextEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
                    setConfirmationPending(false);
                    setError("");
                  }
                  setEmail(nextEmail);
                }}
                placeholder="you@example.com"
                placeholderTextColor={C.dim}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!isSubmitting}
                style={styles.input}
                accessibilityLabel="Email address"
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={C.dim}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                textContentType="password"
                editable={!isSubmitting}
                style={styles.input}
                accessibilityLabel="Password"
                onSubmitEditing={() => { void submit(); }}
              />
              {confirmationPending ? <Text style={styles.lede} accessibilityLiveRegion="polite">Check your email and open the confirmation link. After confirming in your browser, return to this app and log in below with the same email and password. The link may open the BYSI website; you don’t need to start another assessment or purchase. If no email arrives, check spam or resend.</Text> : null}
              {confirmationPending ? <PrimaryButton label="Resend confirmation email" disabled={isSubmitting} onPress={async () => {
                if (busy.current || !supabase) return;
                busy.current = true; setIsSubmitting(true); setError("");
                try { const result = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase(), ...(confirmationOptions ? { options: confirmationOptions } : {}) }); if (result.error) setError("Confirmation email could not be sent. Wait a moment and retry."); }
                catch { setError("Couldn’t reach the email service. Check your connection and retry."); }
                finally { busy.current = false; setIsSubmitting(false); }
              }} /> : null}
              <PrimaryButton label={signup ? "Already have an account? Log in" : "Create an account"} disabled={isSubmitting} onPress={() => { setSignup(!signup); setConfirmationPending(false); setError(""); }} />
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <PrimaryButton label={isSubmitting ? "Connecting…" : signup ? (confirmationPending ? "I confirmed my email — log in" : "Create account") : hasCurrentGuestPractice ? "Sign in to save this result and continue" : "Log in"} disabled={isSubmitting || !isAuthConfigured} onPress={() => { void submit(); }} containerStyle={styles.submit} />
              {isSubmitting ? <ActivityIndicator color={C.purple} style={styles.spinner} /> : null}
            </View>
          </Reveal>

          {!signup && (!session?.user || session.user.is_anonymous) ? <PrimaryButton label="Forgot password?" disabled={isSubmitting} onPress={() => router.push({ pathname: "/forgot-password", params: email.trim() ? { email } : {} })} /> : null}
          {__DEV__ ? <PrimaryButton label="Staging web result" onPress={() => router.push("/staging-web-result")} /> : null}
          <View style={styles.security}><LockKeyhole size={16} color={C.sage} /><Text style={styles.securityText}>Your password is sent directly to the account provider and is never stored by this app.</Text></View>
          {!isAuthConfigured ? <Text style={styles.configuration}>Account login isn’t available in this build.</Text> : null}
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
  error: { ...T.caption, color: C.clay, marginBottom: 4 },
  submit: { marginTop: 12 },
  spinner: { marginTop: 14 },
  security: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 20, paddingHorizontal: 8 },
  securityText: { ...T.caption, flex: 1 },
  configuration: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 16 },
});
