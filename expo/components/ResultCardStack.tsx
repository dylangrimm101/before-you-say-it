import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/components/ui';
import { C, GUTTER, shadow } from '@/constants/theme';

/** One scroll surface: read the entire first card, then slide the next over it.
 * Measured content (not screen-size guesses) keeps large text reachable.
 * Reduced motion uses ordinary, non-overlapping document order.
 */
export function ResultCardStack({ header, first, second }: {
  header: React.ReactNode; first: React.ReactNode; second: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scroll = useRef(new Animated.Value(0)).current;
  const [layout, setLayout] = useState({ header: 0, card: 0, viewport: 0 });
  const pinAt = Math.max(0, layout.header + layout.card - layout.viewport + 120);
  const travel = Math.max(1, layout.card);
  const measured = layout.header > 0 && layout.card > 0 && layout.viewport > 0;
  const motion = !reduced && measured ? { transform: [{ translateY: scroll.interpolate({
    inputRange: [0, pinAt || 0.01, (pinAt || 0.01) + travel],
    outputRange: [0, 0, travel], extrapolate: 'clamp',
  }) }] } : undefined;
  const Container = reduced ? ScrollView : Animated.ScrollView;
  return <Container testID="result-card-stack" removeClippedSubviews={false}
    onLayout={event => setLayout(current => ({ ...current, viewport: event.nativeEvent.layout.height }))}
    {...(!reduced ? { onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], { useNativeDriver: true }), scrollEventThrottle: 16 } : {})}
    contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
    showsVerticalScrollIndicator={false}>
    <View onLayout={event => setLayout(current => ({ ...current, header: event.nativeEvent.layout.y + event.nativeEvent.layout.height }))}>{header}</View>
    <Animated.View testID="result-index-card" onLayout={event => setLayout(current => ({ ...current, card: event.nativeEvent.layout.height }))}
      style={[styles.card, motion]}>{first}</Animated.View>
    <View testID="result-plan-card" style={[styles.card, styles.foreground]}>{second}</View>
  </Container>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.elevated, borderRadius: 30, padding: 24, marginTop: 18, ...shadow.layer },
  foreground: { zIndex: 2, elevation: 5 },
});
