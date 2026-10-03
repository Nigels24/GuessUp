/**
 * The picture of a picture-guess item (the prototype's .q-img). Seeded
 * pictures are SVG, which React Native's Image cannot draw, so .svg URLs go
 * through react-native-svg; other formats use Image.
 */
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { imageSource } from '../../lib/game';
import { colors } from '../../theme';

export function QuestionImage({ imageUrl }: { imageUrl: string }) {
  const uri = imageSource(imageUrl);
  const isSvg = /\.svg($|\?)/i.test(uri);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  return (
    <View style={s.frame} accessibilityLabel="Question picture" accessible>
      {state === 'failed' ? (
        <Text style={s.fallback}>🖼️ Question picture</Text>
      ) : isSvg ? (
        <SvgUri
          uri={uri}
          width="100%"
          height="100%"
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      ) : (
        <Image
          source={{ uri }}
          style={s.image}
          resizeMode="contain"
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
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
  fallback: { color: colors.muted, fontWeight: '700' },
});
