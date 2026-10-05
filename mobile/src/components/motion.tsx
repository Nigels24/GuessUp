/**
 * The prototype's small animations (popIn, bounce, pulse, confetti), made
 * with React Native's Animated on the native driver: they run on the UI
 * thread, never re-render the screen, never block taps, and stay short.
 * With the phone's "Remove animations" / reduce-motion setting on they are
 * skipped and the final state is shown at once.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

/** True while the phone asks for reduced motion (read once, then kept in step). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** The prototype's popIn: fades in while growing from 96 % and rising 6 px. */
export function PopIn({
  children,
  style,
  duration = 220,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
}) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, reduce, duration, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** The prototype's trophy bounce: 30 % → 115 % → 100 %, once. */
export function Bounce({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (reduce) {
      scale.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [scale, reduce]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** The prototype's timer pulse: grows to 112 % and back while `active`. */
export function Pulse({
  active,
  children,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active || reduce) {
      scale.setValue(1);
      return;
    }
    const half = { duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, ...half }),
        Animated.timing(scale, { toValue: 1, ...half }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [active, reduce, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

const CONFETTI_COLORS = [colors.brand, colors.accent, '#22C55E', '#EC4899', '#0EA5E9'];
const PIECES = 40;
const MAX_MS = 1500;

/**
 * The prototype's confetti: pieces fall across the screen once, in at most
 * 1.5 s, then the layer removes itself. It never takes touches.
 */
export function Confetti() {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  // Fixed per mount, so a re-render never reshuffles the pieces.
  const pieces = useRef(
    Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random(),
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
      duration: 1000 + Math.random() * 300,
      delay: Math.random() * (MAX_MS - 1300),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      progress: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (reduce) return;
    const anim = Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    anim.start(() => setDone(true));
    return () => anim.stop();
  }, [pieces, reduce]);

  if (reduce || done) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            s.piece,
            {
              left: p.x * width,
              backgroundColor: p.color,
              opacity: p.progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 20] }) },
                { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  piece: { position: 'absolute', top: 0, width: 9, height: 14, borderRadius: 2 },
});
