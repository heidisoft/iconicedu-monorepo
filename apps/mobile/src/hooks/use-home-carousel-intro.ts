import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const seenThisSession = new Set<string>();
/** One gentle peek per parent/device. Never interrupt manual interaction or accessibility preferences. */
export function useHomeCarouselIntro(
  scope: string,
  enabled: boolean,
  animate: () => void | (() => void),
) {
  const key = `home-carousel-intro-v2:${scope}:family-promotions`;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interacted = useRef(false);
  const next = useRef(animate);
  next.current = animate;
  const animationCleanup = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    interacted.current = true;
    if (timer.current) clearTimeout(timer.current);
    animationCleanup.current?.();
    animationCleanup.current = null;
    if (seenThisSession.has(key)) return;
    seenThisSession.add(key);
    void AsyncStorage.setItem(key, '1').catch(() => {});
  }, [key]);
  useEffect(() => {
    if (!enabled || seenThisSession.has(key)) return;
    let active = true;
    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      animationCleanup.current?.();
      animationCleanup.current = null;
    };
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        interacted.current = true;
        cancel();
      }
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (value) stop();
    });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', (value) => {
      if (value) stop();
    });
    void Promise.all([
      AsyncStorage.getItem(key),
      AccessibilityInfo.isReduceMotionEnabled(),
      AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(([seen, reduced, screenReader]) => {
        if (!active || interacted.current || seen === '1' || seenThisSession.has(key))
          return;
        if (reduced || screenReader) {
          stop();
          return;
        }
        timer.current = setTimeout(() => {
          if (!active || interacted.current || AppState.currentState !== 'active') return;
          stop();
          animationCleanup.current = next.current() ?? null;
        }, 2200);
      })
      .catch(() => {
        /* Storage/accessibility state unavailable: keep the carousel manual. */
      });
    return () => {
      active = false;
      cancel();
      app.remove();
      motion.remove();
      reader.remove();
    };
  }, [enabled, key, stop]);
  return stop;
}
