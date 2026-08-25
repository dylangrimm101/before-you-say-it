import { ShieldCheck } from "lucide-react-native";
import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T, radius, shadow } from "@/constants/theme";

/**
 * One-time notice shown after the privacy migration has removed older session
 * text from this device. Deliberately calm: nothing has gone wrong, and their
 * progress is intact.
 */
export function MigrationNotice({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={[styles.card, { marginBottom: insets.bottom + 24 }]}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={19} color={C.sage} strokeWidth={2.2} />
          </View>
          <Eyebrow color={C.sage}>Updated</Eyebrow>
          <Text style={styles.title}>Older session text was removed</Text>
          <Text style={styles.body}>
            To improve privacy, older session text and generated scripts were removed
            from this device. Your practice progress and completion history were kept.
          </Text>
          <PrimaryButton label="Got it" onPress={onDismiss} style={styles.btn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: "flex-end",
    paddingHorizontal: GUTTER,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.bg,
    padding: 24,
    ...shadow.layer,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${C.sage}44`,
    backgroundColor: C.sageSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { ...T.title, marginTop: 10 },
  body: { ...T.support, marginTop: 12 },
  btn: { marginTop: 22 },
});
