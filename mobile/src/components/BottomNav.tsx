/**
 * The prototype's floating .bottom-nav: a white rounded bar 12px off the
 * screen edges, emoji icons, the active tab on a soft brand background.
 * It floats over the screen, so tab screens pad their content by
 * useBottomNavSpace().
 */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const ICONS: Record<string, string> = {
  home: '🏠',
  ranks: '🏆',
  progress: '📈',
  profile: '👤',
};

/** The bar's distance from the bottom edge (above the system navigation). */
const BAR_OFFSET = 12;
/** Free space between the last row of a screen and the bar. */
const GAP = 16;
/** Used until the bar has been measured. */
const MIN_SPACE = 96;

// The bar's real height: it grows with the phone's font size, so a fixed
// guess left the last row (Profile's Log out) under it on some phones.
let barHeight = 0;
const listeners = new Set<() => void>();
function setBarHeight(height: number) {
  if (Math.abs(height - barHeight) < 1) return;
  barHeight = height;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Bottom padding for a tab screen's content, so nothing ends up under the bar. */
export function useBottomNavSpace(): number {
  const insets = useSafeAreaInsets();
  const height = useSyncExternalStore(subscribe, () => barHeight);
  return Math.max(MIN_SPACE, height + BAR_OFFSET + GAP) + insets.bottom;
}

export function BottomNav({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      style={[s.bar, { bottom: BAR_OFFSET + insets.bottom }]}
      onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={[s.item, focused && s.itemActive]}
          >
            <Text style={[s.icon, !focused && s.iconIdle]}>{ICONS[route.name] ?? '•'}</Text>
            <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  itemActive: { backgroundColor: colors.brandSoft },
  icon: { fontSize: 20, lineHeight: 24 },
  // React Native cannot grayscale an emoji; dimming stands in for the prototype's filter.
  iconIdle: { opacity: 0.45 },
  label: { fontSize: 11, fontWeight: '800', color: colors.muted },
  labelActive: { color: colors.brandDark },
});
