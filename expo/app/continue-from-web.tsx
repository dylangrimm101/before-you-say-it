import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { useAuth } from "@/providers/auth";
import { authEnvironment, supabase } from "@/lib/supabase";
import { subscriptionReturn } from "@/lib/subscriptionNavigation";


// Confirmation is completed by Supabase in the browser. This app deliberately
// uses verified password login on manual return, not an unimplemented token callback.
// Keep the isolated project's own redirect configuration separate.
const confirmationOptions = authEnvironment?.staging
  ? undefined
  : { emailRedirectTo: "https://beforeyousayit.app/" };


export default function ContinueFromWebScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string; moduleId?: string; gate?: string }>();
  const [signup, setSignup] = useState(params.mode === "signup");
  const subscriptionIntent = params.returnTo === "subscription";
  const [confirmationPending, setConfirmationPending] = useState(false);
  const busy = useRef(false);
  const insets = useSafeAreaInsets();
  const { login, isAuthConfigured, stagingWebBridge, normalResults, session, hasCurrentGuestPractice, cancelLogin, continuationIssue } = useAuth();
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
      if (result.continuationProblem) { router.replace("/account-practice"); return; }
      const subscription = subscriptionReturn(params);
      if (subscription && !stagingWebBridge) { router.replace(subscription); return; }
      if (result.continuationId) { router.replace(`/debrief/${result.continuationId}`); return; }
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
  }, [email, login, password, router, stagingWebBridge, normalResults, session, hasCurrentGuestPractice, signup, confirmationPending, params]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <PressCard onPress={() => { cancelLogin?.(); router.back(); }} style={styles.back} accessibilityLabel="Back"><ArrowLeft size={21} color={C.textSoft} /></PressCard>
          <Reveal>
            <Text style={styles.title}>{signup ? "Create your account" : "Enter your email"}</Text>
          </Reveal>
          {hasCurrentGuestPractice ? <Text style={styles.lede}>Save this current rehearsal to your account.</Text> : null}
          {subscriptionIntent ? <Text style={styles.lede}>After verification, you’ll return to checkout. Creating an account or signing in does not start a subscription or charge you.</Text> : null}
          {continuationIssue ? <Text style={styles.error} accessibilityRole="alert">{continuationIssue}</Text> : null}
          <Reveal index={1} style={styles.formWrap}>
            <TextInput
              value={email}
              onChangeText={(nextEmail) => {
                if (nextEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
                  setConfirmationPending(false);
                  setError("");
                }
                setEmail(nextEmail);
              }}
              placeholder="Email"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isSubmitting}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType={signup && !confirmationPending ? "newPassword" : "password"}
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
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <PrimaryButton label={isSubmitting ? "Connecting…" : signup ? (confirmationPending ? "I confirmed my email — log in" : "Create account") : hasCurrentGuestPractice ? "Sign in to save this result and continue" : "Log in"} disabled={isSubmitting || !isAuthConfigured} onPress={() => { void submit(); }} />
            {isSubmitting ? <ActivityIndicator color={C.purple} style={styles.spinner} /> : null}
          </Reveal>

          {(hasCurrentGuestPractice || subscriptionIntent) && !signup ? (
            <PressCard
              disabled={isSubmitting}
              onPress={() => { setSignup(true); setConfirmationPending(false); setError(""); }}
              style={styles.forgotWrap}
              accessibilityLabel={hasCurrentGuestPractice ? "Create an account to save this result" : "Create an account"}
            >
              <Text style={styles.forgot}>{hasCurrentGuestPractice ? "Create an account to save this result" : "Create an account"}</Text>
            </PressCard>
          ) : null}
          {(hasCurrentGuestPractice || subscriptionIntent) && signup && !confirmationPending ? (
            <PressCard
              disabled={isSubmitting}
              onPress={() => { setSignup(false); setConfirmationPending(false); setError(""); }}
              style={styles.forgotWrap}
              accessibilityLabel="Already have an account? Sign in"
            >
              <Text style={styles.forgot}>Already have an account? Sign in</Text>
            </PressCard>
          ) : null}
          {!signup && (!session?.user || session.user.is_anonymous) ? (
            <PressCard
              disabled={isSubmitting}
              onPress={() => router.push({ pathname: "/forgot-password", params: email.trim() ? { email } : {} })}
              style={styles.forgotWrap}
              accessibilityLabel="Forgot password?"
            >
              <Text style={styles.forgot}>Forgot password?</Text>
            </PressCard>
          ) : null}
          {__DEV__ ? <PrimaryButton label="Staging web result" onPress={() => router.push("/staging-web-result")} /> : null}
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
  title: { ...T.display, textAlign: "center", marginBottom: 28 },
  lede: { ...T.body, color: C.textSoft, marginTop: 8, marginBottom: 8 },
  formWrap: { marginTop: 8 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)", paddingHorizontal: 15, fontFamily: font.regular, fontSize: 16, color: C.text, marginBottom: 14 },
  error: { ...T.caption, color: C.clay, marginBottom: 12 },
  spinner: { marginTop: 14 },
  forgotWrap: { alignItems: "center", marginTop: 18, paddingVertical: 8 },
  forgot: { ...T.caption, fontSize: 13, color: C.textSoft, textAlign: "center" },
  configuration: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 16 },
});
