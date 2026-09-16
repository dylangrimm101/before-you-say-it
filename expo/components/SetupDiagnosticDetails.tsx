import * as Clipboard from "expo-clipboard";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GhostButton } from "@/components/ui";
import { C, T, font } from "@/constants/theme";
import { authConfigurationDiagnostic } from "@/lib/supabase";

type CopyStatus = "idle" | "copying" | "copied" | "failed";

/** Visible only after setup fails; copying is user-initiated and sends nothing to a server. */
export default function SetupDiagnosticDetails(): React.JSX.Element {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copy = useCallback(async (): Promise<void> => {
    setCopyStatus("copying");
    try {
      const copied = await Clipboard.setStringAsync(authConfigurationDiagnostic);
      setCopyStatus(copied ? "copied" : "failed");
    } catch {
      setCopyStatus("failed");
    }
  }, []);

  return (
    <View style={styles.card} testID="setup-diagnostic-details">
      <Text style={styles.heading} accessibilityRole="header">Setup details</Text>
      <Text style={styles.note}>These checks contain no keys or account data. Copy them or send a screenshot so we can identify the failed check.</Text>
      <Text style={styles.report} selectable testID="setup-diagnostic-report">{authConfigurationDiagnostic}</Text>
      <GhostButton label="Copy setup details" onPress={copy} disabled={copyStatus === "copying"} />
      {copyStatus === "copied" ? <Text style={styles.note} accessibilityLiveRegion="polite">Copied. Paste the details into our chat.</Text> : null}
      {copyStatus === "failed" ? <Text style={styles.note} accessibilityRole="alert">Couldn’t copy. Take a screenshot of these details instead.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 16, gap: 12, borderRadius: 16, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.line },
  heading: { ...T.body, fontFamily: font.semi },
  note: { ...T.caption, color: C.textSoft },
  report: { ...T.caption, color: C.text, lineHeight: 22 },
});
