import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LaunchExperience } from "@/components/LaunchExperience";
import { MigrationNotice } from "@/components/MigrationNotice";
import { C, FONT_ASSETS } from "@/constants/theme";
import "@/lib/purchases";
import { AuthProvider, useAuth } from "@/providers/auth";
import { StoreProvider, useStore } from "@/providers/store";

// Expo Go does not always have a splash screen registered for the current view
// controller, and this rejects when it doesn't. An unhandled rejection here
// surfaces as a developer error overlay on top of the app, so it is absorbed:
// failing to hold the splash screen is never worth interrupting the user.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();
let hasPresentedLaunch = false;

function RootLayoutNav() {
  const { hydrated, profile, activePracticeSession, nativeJourneyStarted, migrationNotice, dismissMigrationNotice } = useStore();
  const { isAuthLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [showLaunch, setShowLaunch] = useState<boolean>(() => {
    if (hasPresentedLaunch) return false;
    hasPresentedLaunch = true;
    return true;
  });
  const finishLaunch = useCallback((): void => setShowLaunch(false), []);
  // A missing font file must not keep the app on a blank screen, so a load
  // failure falls through to the system face rather than blocking startup.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const ready = hydrated && !isAuthLoading && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    const firstSegment = segments[0];
    const onboarding = firstSegment === "onboarding";
    const entry = firstSegment === "entry";
    const continuation = firstSegment === "continue-from-web";
    const hasLocalJourney = Boolean(user || profile || activePracticeSession || nativeJourneyStarted);
    if (!hasLocalJourney && !entry && !continuation) {
      router.replace("/entry");
      return;
    }
    if (!user && hasLocalJourney && !profile && !activePracticeSession && !onboarding && !entry && !continuation) {
      router.replace("/onboarding");
      return;
    }
    const isFreeJourney = onboarding || firstSegment === "rehearse" || firstSegment === "debrief" || firstSegment === "safety";
    const canInterruptFreeJourney = isFreeJourney || firstSegment === "privacy";
    if (profile && activePracticeSession?.sharedResult && activePracticeSession.freeJourneyCheckpoint !== "complete" && !canInterruptFreeJourney) {
      router.replace(`/debrief/${activePracticeSession.id}`);
      return;
    }
    if (profile && activePracticeSession && !activePracticeSession.recommendation && !canInterruptFreeJourney) {
      const sharedParams = {
        id: activePracticeSession.scenarioId,
        difficulty: "steady" as const,
        reaction: activePracticeSession.expectedReaction,
        entry: "onboarding" as const,
        persona: activePracticeSession.persona ?? profile.persona,
        practiceSessionId: activePracticeSession.id,
      };
      router.replace({ pathname: "/rehearse/[id]", params: sharedParams });
    }
  }, [activePracticeSession, nativeJourneyStarted, ready, profile, segments, router, user]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <>
      <StatusBar style={showLaunch ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="continue-from-web" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="scenario/[id]" />
        <Stack.Screen name="rehearse/[id]" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="drill/[id]" options={{ animation: "fade" }} />
        <Stack.Screen
          name="module/[day]"
          options={{
            animation: "slide_from_right",
            animationTypeForReplace: "push",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="debrief/[id]" options={{ animation: "fade" }} />
        <Stack.Screen name="custom" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="paywall" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="purchase-success" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="path" />
        <Stack.Screen name="interrupted/[moduleId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="progress/dimension/[signal]" />
        <Stack.Screen name="progress/how-it-works" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="qa-access" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="approved-lessons" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="approved-lesson/[lessonId]" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="safety" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
        <Stack.Screen name="internal-review-evidence" options={{ animation: "fade" }} />
      </Stack>
      <MigrationNotice visible={migrationNotice} onDismiss={dismissMigrationNotice} />
      {showLaunch ? <LaunchExperience onFinish={finishLaunch} /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
