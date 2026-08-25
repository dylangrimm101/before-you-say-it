import { useRouter } from "expo-router";
import { ArrowLeft, LockKeyhole } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { useAuth } from "@/providers/auth";
import { useStore } from "@/providers/store";

export default function ContinueFromWebScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isAuthConfigured } = useAuth();
  const { beginNativeJourney, associateActivePracticeSessionWithUser } = useStore();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const submit = useCallback(async (): Promise<void> => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.message ?? "We couldn’t log you in.");
        return;
      }
      if (result.userId) await associateActivePracticeSessionWithUser(result.userId);
      await beginNativeJourney();
      router.replace("/(tabs)");
    } finally {
      setIsSubmitting(false);
    }
  }, [associateActivePracticeSessionWithUser, beginNativeJourney, email, isSubmitting, login, password, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <PressCard onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><ArrowLeft size={21} color={C.textSoft} /></PressCard>
          <Reveal>
            <Eyebrow color={C.purple}>Welcome back</Eyebrow>
            <Text style={styles.title}>Log in to your account.</Text>
            <Text style={styles.lede}>Use the same account you used on the web. If that account has paid access, the app will connect it automatically.</Text>
          </Reveal>

          <Reveal index={1} style={styles.formWrap}>
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
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
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <PrimaryButton label={isSubmitting ? "Logging in…" : "Log in"} disabled={isSubmitting || !isAuthConfigured} onPress={() => { void submit(); }} containerStyle={styles.submit} />
              {isSubmitting ? <ActivityIndicator color={C.purple} style={styles.spinner} /> : null}
            </View>
          </Reveal>

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
