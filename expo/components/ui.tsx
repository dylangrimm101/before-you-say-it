import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import {
  C,
  FIELD_GLOWS,
  GUTTER,
  HERO_GRADIENT,
  eyebrow,
  font,
  radius,
  shadow,
  T,
} from "@/constants/theme";

/** Tracks the device Reduce Motion setting and updates if it changes at runtime. */
export function useReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setIsReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReduced,
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReduced;
}

export function tap(style: "light" | "medium" | "heavy" | "success" = "light"): void {
  if (Platform.OS === "web") return;
  if (style === "success") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  } as const;
  Haptics.impactAsync(map[style]).catch(() => {});
}

/**
 * Ambient background: a cool field lit by three soft glows — white falling in
 * from the top left, violet from the right shoulder, violet again rising from
 * below. Every glass layer in the app reads against this, so it is the one
 * surface that is always on screen.
 *
 * Each stop fades through the same RGB with `stopOpacity`, avoiding the grey
 * contamination produced by the `transparent` keyword. SVG paints in document
 * order, so the CSS layers are reversed: bottom first and top highlight last.
 */
export function Backdrop(): React.JSX.Element {
  const svgPaintOrder = [...FIELD_GLOWS].reverse();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {svgPaintOrder.map((glow) => (
            <RadialGradient
              key={glow.id}
              id={`field-${glow.id}`}
              cx={glow.cx}
              cy={glow.cy}
              rx={glow.rx}
              ry={glow.ry}
            >
              <Stop offset="0%" stopColor={glow.color} stopOpacity={1} />
              <Stop offset={glow.fadeAt} stopColor={glow.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {svgPaintOrder.map((glow) => (
          <Rect key={glow.id} width="100%" height="100%" fill={`url(#field-${glow.id})`} />
        ))}
      </Svg>
    </View>
  );
}

export function Eyebrow({
  children,
  color = C.dim,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Text style={[eyebrow, { color }]}>{children}</Text>
    </View>
  );
}

/** Caption in `textDim` with no container and no layer of its own. */
export function TrustNote({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[T.caption, style]}>{children}</Text>;
}

interface PressCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Applied to the outer pressable rather than the animated surface. Layout
   * such as `flex` has to live here, because flexing the inner view has no
   * effect on how much room the pressable itself claims in a row.
   */
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: "light" | "medium" | "heavy";
  accessibilityLabel?: string;
  /** Adds the 440ms left-to-right confirmation sheen used by primary actions. */
  wipeOnPress?: boolean;
}

/** Card with a springy press-down micro-interaction. */
export function PressCard({
  children,
  onPress,
  style,
  containerStyle,
  disabled,
  haptic = "light",
  accessibilityLabel,
  wipeOnPress = false,
}: PressCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const wipe = useRef(new Animated.Value(0)).current;
  const [surfaceWidth, setSurfaceWidth] = useState<number>(0);
  const isReduced = useReducedMotion();

  const to = useCallback(
    (v: number) => {
      if (isReduced) {
        scale.setValue(1);
        return;
      }
      Animated.spring(scale, {
        toValue: v,
        useNativeDriver: true,
        friction: 7,
        tension: 220,
      }).start();
    },
    [isReduced, scale],
  );

  return (
    <Pressable
      disabled={disabled}
      style={containerStyle}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPressIn={() => {
        to(0.972);
        if (!disabled) tap(haptic);
        if (wipeOnPress && !disabled && !isReduced) {
          wipe.setValue(0);
          Animated.timing(wipe, {
            toValue: 1,
            duration: 440,
            easing: Easing.bezier(0.3, 0, 0.2, 1),
            useNativeDriver: true,
          }).start();
        }
      }}
      onPressOut={() => to(1)}
      onPress={onPress}
    >
      <Animated.View
        onLayout={(event) => setSurfaceWidth(event.nativeEvent.layout.width)}
        style={[styles.pressSurface, { transform: [{ scale }] }, style]}
      >
        {children}
        {wipeOnPress && !isReduced && surfaceWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pressWipe,
              {
                width: surfaceWidth,
                opacity: wipe.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.16, 0.12, 0],
                }),
                transform: [
                  {
                    translateX: wipe.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-surfaceWidth, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * A resting layer. Translucent white over the field rather than a real blur
 * pass — at four to eight cards per scroll view the blur cost is not worth a
 * difference you cannot see against a near-static gradient.
 */
export function GlassCard({
  children,
  style,
  raised = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  return (
    <View style={[styles.glass, raised ? shadow.layer : null, style]}>{children}</View>
  );
}

/**
 * The one saturated surface on a screen, holding the single action that moves
 * the user forward. If a screen has two of these, one of them is wrong.
 */
export function HeroSurface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[shadow.hero, styles.heroShell, style]}>
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.heroFill}
      >
        <View style={styles.heroTopLight} pointerEvents="none" />
        {children}
      </LinearGradient>
    </View>
  );
}

/**
 * Full-width bottom container for the rehearsal's per-state control set. This
 * is one of the two places a real blur earns its cost: content scrolls
 * underneath it continuously.
 */
export function StateDock({
  children,
  bottomInset,
  style,
}: {
  children: React.ReactNode;
  bottomInset: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.dock, shadow.dock, style]}>
      {Platform.OS === "web" ? (
        <View style={[StyleSheet.absoluteFill, styles.dockFallback]} />
      ) : (
        <BlurView intensity={34} tint="light" style={StyleSheet.absoluteFill} />
      )}
      <View style={[styles.dockInner, { paddingBottom: bottomInset + 12 }]}>
        {children}
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = C.purple,
  style,
  containerStyle,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  return (
    <PressCard
      onPress={onPress}
      disabled={disabled}
      haptic="medium"
      style={style}
      containerStyle={containerStyle}
      accessibilityLabel={label}
      wipeOnPress
    >
      <View
        style={[
          styles.primary,
          compact && styles.primaryCompact,
          disabled
            ? styles.primaryDisabled
            : { backgroundColor: tone, shadowColor: tone },
        ]}
      >
        <Text
          style={[styles.primaryLabel, compact && styles.primaryLabelCompact, { color: disabled ? C.textDim : C.onAccent }]}
        >
          {label}
        </Text>
      </View>
    </PressCard>
  );
}

export function GhostButton({
  label,
  onPress,
  destructive = false,
  disabled = false,
  style,
  containerStyle,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PressCard
      onPress={onPress}
      disabled={disabled}
      style={style}
      containerStyle={containerStyle}
      accessibilityLabel={label}
    >
      <View style={[styles.ghost, disabled ? { opacity: 0.5 } : null, destructive ? { borderColor: `${C.clay}66` } : null]}>
        <Text style={[styles.ghostLabel, disabled ? { color: C.textDim } : null, destructive ? { color: C.clay } : null]}>
          {label}
        </Text>
      </View>
    </PressCard>
  );
}

/** Selectable row for onboarding and settings. Glass by default, filled when selected. */
export function ChoiceRow({
  title,
  subtitle,
  selected,
  onPress,
  leading,
  disabled,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <PressCard
      onPress={onPress}
      disabled={disabled}
      containerStyle={styles.choiceHit}
      accessibilityLabel={title}
    >
      <View style={[styles.choice, selected ? styles.choiceSelected : null]}>
        {leading ? <View style={styles.choiceLeading}>{leading}</View> : null}
        <View style={styles.choiceCopy}>
          <Text style={styles.choiceTitle}>{title}</Text>
          {subtitle ? <Text style={styles.choiceSub}>{subtitle}</Text> : null}
        </View>
        {selected ? (
          <Text style={[eyebrow, styles.choiceMark]}>Selected</Text>
        ) : null}
      </View>
    </PressCard>
  );
}

/** Left-to-right selection fill used by single-choice controls. */
export function SelectionWipe({ selected }: { selected: boolean }) {
  const isReduced = useReducedMotion();
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (!selected || isReduced) {
      progress.setValue(selected ? 1 : 0);
      return;
    }
    if (width <= 0) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 440,
      easing: Easing.bezier(0.3, 0, 0.2, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isReduced, progress, selected, width]);

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.selectionWipeClip}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            styles.selectionWipe,
            {
              width,
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width, 0],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Fades + lifts children in, staggered by index. */
export function Reveal({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isReduced = useReducedMotion();
  const v = useRef(new Animated.Value(isReduced ? 1 : 0)).current;

  useEffect(() => {
    if (isReduced) {
      v.setValue(1);
      return;
    }
    const animation = Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 70 * index,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [v, index, isReduced]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Animated horizontal meter used for scores and live tension. */
export function Meter({
  value,
  tone = C.sage,
  height = 6,
  delay = 0,
}: {
  value: number;
  tone?: string;
  height?: number;
  delay?: number;
}) {
  const isReduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Math.min(100, Math.max(0, value));
    if (isReduced) {
      v.setValue(target);
      return;
    }
    const overshoot = Math.min(100, target + Math.max(2, target * 0.035));
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, {
        toValue: overshoot,
        duration: 760,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(v, {
        toValue: target,
        speed: 18,
        bounciness: 4,
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [v, value, delay, isReduced]);

  return (
    <View style={[styles.meterTrack, { height, borderRadius: height }]}>
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: tone,
          width: v.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

type AnimationSafeCircleProps = React.ComponentProps<typeof Circle> & {
  collapsable?: boolean;
};

const AnimationSafeCircle = React.forwardRef<
  React.ComponentRef<typeof Circle>,
  AnimationSafeCircleProps
>(({ collapsable: _collapsable, ...props }, ref) => <Circle ref={ref} {...props} />);
AnimationSafeCircle.displayName = "AnimationSafeCircle";

// Prevent RN Animated's native-only `collapsable` prop from reaching the DOM.
const AnimatedCircle = Animated.createAnimatedComponent(AnimationSafeCircle);

/**
 * Animated circular score ring with a count-up number in the center.
 * Fills clockwise from the top; fires a success haptic when it lands.
 */
export function ScoreRing({
  value,
  size = 88,
  strokeWidth = 8,
  tone = C.purple,
  delay = 250,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: string;
  delay?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const isReduced = useReducedMotion();
  const progress = useRef(new Animated.Value(isReduced ? 1 : 0)).current;
  const [shown, setShown] = useState<number>(isReduced ? clamped : 0);

  useEffect(() => {
    if (isReduced) {
      progress.setValue(1);
      setShown(clamped);
      return;
    }
    const sub = progress.addListener(({ value: v }) =>
      setShown(Math.round(v * clamped)),
    );
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) tap("success");
    });
    return () => {
      progress.removeListener(sub);
      anim.stop();
    };
  }, [progress, clamped, delay, isReduced]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - clamped / 100)],
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringValue, { color: tone, fontSize: size * 0.32 }]}>
        {shown}
      </Text>
      {label ? <Text style={styles.ringLabel}>{label}</Text> : null}
    </View>
  );
}

/**
 * Animated voice waveform shown while the AI voice is generating or speaking.
 * "subtle" renders a low pulse (generating); otherwise lively bars (speaking).
 */
export function Waveform({
  active,
  tone = C.purple,
  bars = 5,
  height = 26,
  subtle = false,
}: {
  active: boolean;
  tone?: string;
  bars?: number;
  height?: number;
  subtle?: boolean;
}) {
  const isReduced = useReducedMotion();
  const anims = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.25)),
  ).current;

  useEffect(() => {
    if (!active || isReduced) {
      anims.forEach((a) => a.setValue(0.25));
      return;
    }
    const max = subtle ? 0.55 : 1;
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 90),
          Animated.timing(a, {
            toValue: max,
            duration: subtle ? 420 : 260 + (i % 3) * 70,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0.25,
            duration: subtle ? 420 : 300 + ((i + 1) % 3) * 60,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, anims, subtle, isReduced]);

  return (
    <View style={[styles.waveRow, { height }]}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            { height, backgroundColor: tone, transform: [{ scaleY: a }] },
          ]}
        />
      ))}
    </View>
  );
}

/** Three-dot breathing indicator while the counterpart "thinks". */
export function Thinking() {
  const dots = [0, 1, 2];
  const isReduced = useReducedMotion();
  const anims = useRef(dots.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (isReduced) {
      anims.forEach((animation) => animation.setValue(0.65));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(a, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
          Animated.timing(a, {
            toValue: 0.3,
            duration: 420,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.quad),
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims, isReduced]);

  return (
    <View style={styles.thinking}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: a }]} />
      ))}
    </View>
  );
}

export type MicState = "ready" | "listening" | "detected" | "disabled" | "error";

/**
 * The rehearsal microphone. 88 pt visual inside a 104 pt target, with shape,
 * glyph and colour all carrying state together. Where the state forbids
 * recording entirely the caller swaps this control out rather than greying it
 * in place, so a dead mic is never sitting there inviting a tap.
 */
export function MicControl({
  state,
  onPress,
  glyph,
  accessibilityLabel,
  disabled,
  accessibilityState,
  level = 0,
}: {
  state: MicState;
  onPress: () => void;
  glyph: React.ReactNode;
  accessibilityLabel: string;
  disabled?: boolean;
  accessibilityState?: { disabled: boolean };
  /** Normalized live microphone level from 0 to 1. */
  level?: number;
}) {
  const isReduced = useReducedMotion();
  const halo = useRef(new Animated.Value(0)).current;
  const liveLevel = useRef(new Animated.Value(0)).current;
  const live = state === "listening";

  useEffect(() => {
    if (!live || isReduced) {
      halo.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, halo, isReduced]);

  useEffect(() => {
    const animation = Animated.timing(liveLevel, {
      toValue: live && !isReduced ? Math.min(1, Math.max(0, level)) : 0,
      duration: live ? 90 : 600,
      easing: live ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isReduced, level, live, liveLevel]);

  const fill =
    state === "listening" || state === "detected"
      ? C.purple
      : state === "error"
        ? C.claySoft
        : C.surfaceHigh;
  const ring =
    state === "error"
      ? C.clay
      : state === "disabled"
        ? C.line
        : state === "ready"
          ? C.glassEdge
          : "transparent";

  return (
    <View style={styles.micTarget}>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.micHalo,
            {
              opacity: halo.interpolate({
                inputRange: [0, 1],
                outputRange: [0.55, 0.12],
              }),
              transform: [
                {
                  scale: halo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.12],
                  }),
                },
                {
                  scale: liveLevel.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {live && !isReduced ? (
        <View pointerEvents="none" style={styles.micLevelBars}>
          {[0.72, 1, 0.84, 0.62].map((peak, index) => (
            <Animated.View
              key={index}
              style={[
                styles.micLevelBar,
                {
                  transform: [
                    {
                      scaleY: liveLevel.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.18, peak],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      <PressCard
        onPress={onPress}
        haptic="medium"
        disabled={disabled ?? state === "disabled"}
        accessibilityLabel={accessibilityLabel}
      >
        <View
          accessibilityState={accessibilityState}
          style={[
            styles.mic,
            { backgroundColor: fill, borderColor: ring },
            state === "disabled" ? styles.micDisabled : null,
            state === "listening" || state === "detected" ? shadow.hero : null,
          ]}
        >
          {glyph}
        </View>
      </PressCard>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    padding: 18,
  },
  heroShell: { borderRadius: radius.lg },
  heroFill: {
    borderRadius: radius.lg,
    padding: 20,
    overflow: "hidden",
  },
  heroTopLight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    overflow: "hidden",
  },
  dockFallback: { backgroundColor: "rgba(248,248,252,0.92)" },
  dockInner: { paddingHorizontal: GUTTER, paddingTop: 16 },
  primary: {
    height: 56,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    // Without side padding the button collapses to the exact width of its
    // label whenever it sits in a row instead of a stretching column.
    paddingHorizontal: 28,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 5,
  },
  /**
   * A filled-but-pale disabled button disappears into the field, so the
   * unavailable state is drawn as an outline with readable type instead.
   */
  primaryDisabled: {
    backgroundColor: "rgba(23,26,31,0.04)",
    borderWidth: 1,
    borderColor: C.line,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryCompact: { height: 46, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 13 },
  primaryLabel: { fontFamily: font.semi, fontSize: 17, letterSpacing: 0.1 },
  primaryLabelCompact: { fontSize: 15 },
  ghost: {
    height: 52,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  ghostLabel: { fontFamily: font.semi, fontSize: 15, color: C.textSoft },
  choiceHit: { width: "100%" },
  choice: {
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.glassEdge,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  choiceSelected: {
    backgroundColor: C.surfaceHigh,
    borderColor: C.purple,
  },
  choiceLeading: { alignItems: "center", justifyContent: "center" },
  choiceCopy: { flex: 1, gap: 3 },
  choiceTitle: { ...T.body, fontFamily: font.medium },
  choiceSub: { ...T.caption },
  pressSurface: { position: "relative", overflow: "hidden" },
  pressWipe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.onAccent,
  },
  selectionWipeClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  selectionWipe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.purple,
  },
  choiceMark: { color: C.purple },
  meterTrack: {
    backgroundColor: "rgba(23,26,31,0.08)",
    overflow: "hidden",
    width: "100%",
  },
  thinking: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingVertical: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textSoft },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  waveBar: { width: 3.5, borderRadius: 2 },
  ringValue: { fontFamily: font.semi },
  ringLabel: {
    ...eyebrow,
    color: C.dim,
    fontSize: 9.5,
    marginTop: 2,
  },
  micTarget: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  micLevelBars: {
    position: "absolute",
    top: 7,
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    zIndex: 3,
  },
  micLevelBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: C.purple,
  },
  micHalo: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: C.purpleLight,
  },
  mic: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.purple,
  },
  micDisabled: { opacity: 0.38 },
});
