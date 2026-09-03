import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { C, font } from "@/constants/theme";

interface TabLabelProps {
  focused: boolean;
  label: string;
}

function TabLabel({ focused, label }: TabLabelProps) {
  return (
    <View style={styles.labelWrap}>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
    </View>
  );
}

/** Today remains both the first tab and the app's initial destination. */
export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.purple,
        tabBarInactiveTintColor: C.dim,
        // The dock is one of the few surfaces where content continuously moves
        // underneath, so real blur is justified here.
        tabBarBackground:
          Platform.OS === "web"
            ? undefined
            : () => (
                <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
              ),
        tabBarStyle: {
          backgroundColor: Platform.OS === "web" ? C.barSolid : C.bar,
          borderTopColor: C.barEdge,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 88 : 66,
          paddingTop: 8,
          position: "absolute",
        },
        tabBarIconStyle: styles.hiddenIcon,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Today" />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Practice",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Practice" />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Progress" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hiddenIcon: {
    display: "none",
  },
  tabItem: {
    justifyContent: "center",
    paddingTop: 0,
  },
  labelWrap: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  label: {
    color: C.dim,
    fontFamily: font.semi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  labelActive: {
    color: C.purple,
  },
  indicator: {
    backgroundColor: "transparent",
    borderRadius: 2,
    height: 3,
    width: 26,
  },
  indicatorActive: {
    backgroundColor: C.purple,
  },
});
