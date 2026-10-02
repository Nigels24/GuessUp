/**
 * The prototype's floating .bottom-nav: a white rounded bar 12px off the
 * screen edges, emoji icons, the active tab on a soft brand background.
 * It floats over the screen, so tab screens pad their content by
 * bottomNavSpace(insets.bottom).
 */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const ICONS: Record<string, string> = {
  home: '🏠',
  ranks: '🏆',
  progress: '📈',
  profile: '👤',
};

/** Height of the bar plus its margin, for the content underneath. */
export function bottomNavSpace(bottomInset: number): number {
  return 96 + bottomInset;
}

export function BottomNav({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[s.bar, { bottom: 12 + insets.bottom }]}>
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
