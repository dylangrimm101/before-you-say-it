import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, View } from "react-native";

/**
 * Keeps the focused text field clear of the on-screen keyboard.
 *
 * `KeyboardAvoidingView` lifts a *sticky* footer, but it does nothing for an
 * input inside a `ScrollView` — the field simply stays under the keyboard.
 *
 * Scrolling to the end is not the fix either: these screens pad their scroll
 * content to clear a sticky footer, so "the end" sits far below the field and
 * the whole screen gets flung upward, hiding the question being answered.
 *
 * This measures how far the focused card actually overlaps the keyboard and
 * scrolls by exactly that much, so the correction can never overshoot. When
 * there is no overlap, nothing moves at all.
 */
export function useKeyboardReveal(gap: number = 16, dockHeight: number = 0) {
  const scrollRef = useRef<ScrollView>(null);
  /** Live scroll offset, so the correction is relative to where we already are. */
  const scrollY = useRef<number>(0);
  /** The card wrapping the input that currently has focus. */
  const activeCard = useRef<View | null>(null);
  /** Top edge of the keyboard while it is visible. */
  const keyboardTop = useRef<number | null>(null);
  const revealFrame = useRef<number | null>(null);

  const revealActiveCard = useCallback(() => {
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = null;
      const card = activeCard.current;
      const keyboardBoundary = keyboardTop.current;
      if (!card || keyboardBoundary === null) return;

      // The dock sits directly above the keyboard, so its full measured height
      // is also unavailable to the focused field.
      const visibleBottom = keyboardBoundary - dockHeight;
      card.measureInWindow((_x, y, _w, h) => {
        if (!h) return;
        const overlap = y + h + gap - visibleBottom;
        if (overlap <= 0) return;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + overlap),
          animated: true,
        });
      });
    });
  }, [dockHeight, gap]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      revealActiveCard();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    };
  }, [revealActiveCard]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  /**
   * Marks a card as the reveal target while its input holds focus. Screens with
   * several inputs call this on each one, so the right field is measured.
   */
  const trackFocus = useCallback((card: View | null) => {
    activeCard.current = card;
  }, []);

  /** Forgets the target and the offset, e.g. when the step or screen changes. */
  const resetReveal = useCallback(() => {
    activeCard.current = null;
    scrollY.current = 0;
  }, []);

  return { scrollRef, onScroll, trackFocus, resetReveal, revealActiveCard };
}
