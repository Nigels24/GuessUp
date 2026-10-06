/**
 * The picture of a picture-guess item (the prototype's .q-img). Seeded
 * pictures are SVG, which React Native's Image cannot draw, so .svg URLs are
 * downloaded, made safe for react-native-svg (mobileSafeSvg: some SVG values
 * crash it natively on Android) and drawn with SvgXml; other formats use
 * Image. A picture that cannot be loaded or drawn shows a message and Retry
 * in its frame, and the round goes on.
 */
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { imageSource } from '../../lib/game';
import { mobileSafeSvg } from '../../lib/svg';
import { colors } from '../../theme';

/** Same as the API client: the Render free tier can take ~50 s to wake. */
const SVG_TIMEOUT_MS = 60000;

type State = 'loading' | 'ready' | 'failed';

export function QuestionImage({ imageUrl }: { imageUrl: string }) {
  const uri = imageSource(imageUrl);
  const isSvg = /\.svg($|\?)/i.test(uri);
  const [state, setState] = useState<State>('loading');
  const [svg, setSvg] = useState<string | null>(null);
  /** Bumped by Retry to load the picture again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState('loading');
    setSvg(null);
    if (!isSvg) return;
    /** Set when this load is replaced (new picture, Retry) or the item is left. */
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SVG_TIMEOUT_MS);
    fetch(uri, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = mobileSafeSvg(await res.text());
        if (cancelled) return;
        setSvg(xml);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [uri, isSvg, attempt]);

  const failed = useCallback(() => setState('failed'), []);
  const retry = () => setAttempt((n) => n + 1);

  return (
    <View style={s.frame} accessibilityLabel="Question picture" accessible>
      {state === 'failed' ? (
        <Pressable onPress={retry} accessibilityRole="button" style={s.fallback} hitSlop={8}>
          <Text style={s.fallbackText}>🖼️ Couldn't load the picture</Text>
          <Text style={s.retry}>Retry</Text>
        </Pressable>
      ) : isSvg ? (
        svg !== null && (
          <DrawGuard key={attempt} onError={failed}>
            <SvgXml xml={svg} width="100%" height="100%" onError={failed} />
          </DrawGuard>
        )
      ) : (
        <Image
          key={attempt}
          source={{ uri }}
          style={s.image}
          resizeMode="contain"
          onLoad={() => setState('ready')}
          onError={failed}
        />
      )}
      {state === 'loading' && (
        <View style={s.spinner} pointerEvents="none">
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </View>
  );
}

/** Keeps an SVG that fails to parse or draw inside the picture frame. */
class DrawGuard extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const s = StyleSheet.create({
  frame: {
    marginTop: 12,
    width: '100%',
    // The seeded pictures are 320×200.
    aspectRatio: 1.6,
    maxHeight: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.imageBg,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  spinner: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  fallback: { alignItems: 'center', gap: 6, padding: 12 },
  fallbackText: { color: colors.muted, fontWeight: '700' },
  retry: { color: colors.brand, fontWeight: '800' },
});
