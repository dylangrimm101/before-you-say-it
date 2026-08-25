import { Stack, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T } from "@/constants/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Backdrop />
      <View style={styles.content}>
        <Eyebrow color={C.purple}>Wrong turn</Eyebrow>
        <Text style={styles.title}>This page isn’t part of your practice.</Text>
        <Text style={styles.body}>
          Your progress is safe. Head back to Today and pick up where you left off.
        </Text>
      </View>
      <PrimaryButton label="Back to Today" onPress={() => router.replace("/(tabs)")} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    backgroundColor: C.bg,
  },
  content: { flex: 1, justifyContent: "center" },
  title: { ...T.display, marginTop: 12 },
  body: { ...T.support, marginTop: 16 },
});
