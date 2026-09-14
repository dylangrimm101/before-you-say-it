import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { getRecovery } from "@/lib/accountLifecycleRuntime";

export default function ForgotPasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const busy = useRef(false);
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const request = async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const flow = getRecovery();
      if (!flow) {
        setMessage("Password recovery isn’t available in this build.");
        return;
      }
      const result = await flow.request(email);
      setMessage(result.message);
    } catch {
      setMessage("Recovery could not be requested. Check your connection and retry later.");
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
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.lede}>Enter the email you used to create your account, and we’ll send you a link to reset your password.</Text>
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
                editable={!pending}
                style={styles.input}
                accessibilityLabel="Email address for password recovery"
              />
              <PrimaryButton label={pending ? "Sending…" : "Send reset link"} disabled={pending} onPress={() => { void request(); }} />
              {message ? <Text style={styles.status} accessibilityLiveRegion="polite">{message}</Text> : null}
            </View>
          </Reveal>
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
  status: { ...T.body, color: C.textSoft, marginTop: 16 },
});
