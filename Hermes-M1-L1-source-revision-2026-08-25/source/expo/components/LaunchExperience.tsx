import React, { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { font } from "@/constants/theme";

const FIELD = "#512888";
const YOU = "#E4DCF2";
const THEM = "#A491C6";
const WHITE = "#FFFFFF";
const EASE = Easing.bezier(0.22, 0.9, 0.28, 1);
const MARK_WIDTH_RATIO = 0.55;
const MARK_ASPECT_RATIO = 148 / 67;
const WORDMARK_GAP = 34;
const WORDMARK_LINE_HEIGHT = 38;
const SPEAK_DURATION = 2200;
const REDUCED_MOTION_HOLD = 800;

type AnimationSafeGProps = React.ComponentProps<typeof G> & {
  collapsable?: boolean;
};

const AnimationSafeG = React.forwardRef<
  React.ComponentRef<typeof G>,
  AnimationSafeGProps
>(({ collapsable: _collapsable, ...props }, ref) => <G ref={ref} {...props} />);
AnimationSafeG.displayName = "AnimationSafeG";

// RN Animated injects `collapsable={false}`. Strip it before react-native-svg
// forwards props to a web <g>, where React treats it as an invalid attribute.
const AnimatedG = Animated.createAnimatedComponent(AnimationSafeG);

type LaunchExperienceProps = {
  onFinish: () => void;
};

type DotMotion = {
  opacity: Animated.Value;
  rise: Animated.Value;
};

function makeDotMotion(): DotMotion {
  return {
    opacity: new Animated.Value(0),
    rise: new Animated.Value(0),
  };
}

/** Cold-start-only bridge between the native launch storyboard and the app. */
export function LaunchExperience({ onFinish }: LaunchExperienceProps) {
  const { height, width } = useWindowDimensions();
  const overlayOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;
  const bubbleScale = useRef<Animated.Value>(new Animated.Value(1)).current;
  const figureTurn = useRef<Animated.Value>(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef<Animated.Value>(new Animated.Value(0)).current;
  const wordmarkRise = useRef<Animated.Value>(new Animated.Value(9)).current;
  const dots = useRef<DotMotion[]>([makeDotMotion(), makeDotMotion(), makeDotMotion()]).current;

  const markWidth = width * MARK_WIDTH_RATIO;
  const markHeight = markWidth / MARK_ASPECT_RATIO;
  const lockupHeight = markHeight + WORDMARK_GAP + WORDMARK_LINE_HEIGHT;
  const lockupTop = (height - lockupHeight) / 2;

  const leftCounterRotation = figureTurn.interpolate({
    inputRange: [0, 1],
    outputRange: ["rotate(-4 10 91.95)", "rotate(0 10 91.95)"],
  });
  const rightCounterRotation = figureTurn.interpolate({
    inputRange: [0, 1],
    outputRange: ["rotate(4 110 91.95)", "rotate(0 110 91.95)"],
  });
  const bubbleTransform = bubbleScale.interpolate({
    inputRange: [1, 1.05],
    outputRange: [
      "translate(60 51) scale(1) translate(-60 -51)",
      "translate(60 51) scale(1.05) translate(-60 -51)",
    ],
  });

  const dotTransforms = useMemo(
    () =>
      dots.map((dot) =>
        dot.rise.interpolate({
          inputRange: [0, 1],
          outputRange: ["translate(0 7)", "translate(0 0)"],
        }),
      ),
    [dots],
  );

  useEffect(() => {
    let isMounted = true;
    let runningAnimation: Animated.CompositeAnimation | null = null;

    const finish = (): void => {
      if (isMounted) onFinish();
    };

    const crossFade = (): Animated.CompositeAnimation =>
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    AccessibilityInfo.isReduceMotionEnabled()
      .then((isReduced) => {
        if (!isMounted) return;

        if (isReduced) {
          bubbleScale.setValue(1);
          figureTurn.setValue(1);
          wordmarkOpacity.setValue(1);
          wordmarkRise.setValue(0);
          dots.forEach((dot) => {
            dot.opacity.setValue(0);
            dot.rise.setValue(1);
          });
          runningAnimation = Animated.sequence([
            Animated.delay(REDUCED_MOTION_HOLD),
            crossFade(),
          ]);
          runningAnimation.start(({ finished }) => {
            if (finished) finish();
          });
          return;
        }

        const dotAnimations = dots.map((dot, index) =>
          Animated.sequence([
            Animated.delay(index * 120),
            Animated.parallel([
              Animated.timing(dot.rise, {
                toValue: 1,
                duration: 480,
                easing: EASE,
                useNativeDriver: false,
              }),
              Animated.sequence([
                Animated.timing(dot.opacity, {
                  toValue: 1,
                  duration: 220,
                  easing: EASE,
                  useNativeDriver: false,
                }),
                Animated.delay(200),
                Animated.timing(dot.opacity, {
                  toValue: 0,
                  duration: 180,
                  easing: EASE,
                  useNativeDriver: false,
                }),
              ]),
            ]),
          ]),
        );

        runningAnimation = Animated.sequence([
          Animated.parallel([
            ...dotAnimations,
            Animated.sequence([
              Animated.delay(700),
              Animated.timing(bubbleScale, {
                toValue: 1.05,
                duration: 150,
                easing: EASE,
                useNativeDriver: false,
              }),
              Animated.timing(bubbleScale, {
                toValue: 1,
                duration: 150,
                easing: EASE,
                useNativeDriver: false,
              }),
            ]),
            Animated.sequence([
              Animated.delay(950),
              Animated.timing(figureTurn, {
                toValue: 1,
                duration: 350,
                easing: EASE,
                useNativeDriver: false,
              }),
            ]),
            Animated.sequence([
              Animated.delay(1100),
              Animated.parallel([
                Animated.timing(wordmarkOpacity, {
                  toValue: 1,
                  duration: 400,
                  easing: EASE,
                  useNativeDriver: true,
                }),
                Animated.timing(wordmarkRise, {
                  toValue: 0,
                  duration: 400,
                  easing: EASE,
                  useNativeDriver: true,
                }),
              ]),
            ]),
            Animated.delay(SPEAK_DURATION),
          ]),
          crossFade(),
        ]);
        runningAnimation.start(({ finished }) => {
          if (finished) finish();
        });
      })
      .catch(() => {
        if (!isMounted) return;
        figureTurn.setValue(1);
        wordmarkOpacity.setValue(1);
        wordmarkRise.setValue(0);
        runningAnimation = Animated.sequence([
          Animated.delay(REDUCED_MOTION_HOLD),
          crossFade(),
        ]);
        runningAnimation.start(({ finished }) => {
          if (finished) finish();
        });
      });

    return () => {
      isMounted = false;
      runningAnimation?.stop();
    };
  }, [bubbleScale, dots, figureTurn, onFinish, overlayOpacity, wordmarkOpacity, wordmarkRise]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlayOpacity }]}
      testID="cold-start-launch"
    >
      <View style={[styles.lockup, { height: lockupHeight, top: lockupTop, width }]}>
        <Svg height={markHeight} viewBox="-14 27 148 67" width={markWidth}>
          <AnimatedG transform={leftCounterRotation as unknown as string}>
            <G transform="rotate(4 10 91.95)">
              <Circle cx="13" cy="46" fill={YOU} r="17" />
              <Path d="M-12.95 91.95a22.95 22.95 0 0 1 45.9 0z" fill={YOU} />
            </G>
          </AnimatedG>
          <AnimatedG transform={rightCounterRotation as unknown as string}>
            <G transform="rotate(-4 110 91.95)">
              <Circle cx="107" cy="46" fill={THEM} r="17" />
              <Path d="M87.05 91.95a22.95 22.95 0 0 1 45.9 0z" fill={THEM} />
            </G>
          </AnimatedG>
          <AnimatedG transform={bubbleTransform as unknown as string}>
            <G>
              <Rect fill={WHITE} height="29.1" rx="8" width="33.6" x="43.2" y="31.45" />
              <Path d="M54 50.55h12l-3 21z" fill={WHITE} />
              {[51, 60, 69].map((x, index) => (
                <AnimatedG
                  key={x}
                  opacity={dots[index]?.opacity}
                  transform={dotTransforms[index] as unknown as string}
                >
                  <Circle cx={x} cy="45.5" fill={FIELD} r="3.4" />
                </AnimatedG>
              ))}
            </G>
          </AnimatedG>
        </Svg>
        <Animated.View
          style={{
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkRise }],
          }}
        >
          <Text allowFontScaling numberOfLines={1} style={styles.wordmark}>
            Before You Say It
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FIELD,
    zIndex: 1000,
  },
  lockup: {
    alignItems: "center",
    position: "absolute",
  },
  wordmark: {
    color: WHITE,
    fontFamily: font.bold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: WORDMARK_LINE_HEIGHT,
    marginTop: WORDMARK_GAP,
    textAlign: "center",
  },
});
