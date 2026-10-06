/**
 * Makes an SVG drawable by react-native-svg. Its Android code reads a
 * marker's `orient` with Double.parseDouble unless it is exactly "auto", so
 * any other value ("auto-start-reverse", "45deg") throws in native code while
 * the picture is drawn and closes the app without a JavaScript error. This
 * rewrites such values: "45deg" becomes "45", anything else "auto" (the same
 * as "auto-start-reverse" on marker-end and marker-mid).
 * Kept in step with mobileSafeSvg in api/src/admin/image-file.ts.
 * Tested by svg.test.mjs (npm test).
 */
export function mobileSafeSvg(svg: string): string {
  return svg.replace(
    /(<marker\b[^>]*?\sorient\s*=\s*)(["'])([^"']*)\2/gi,
    (_match, before: string, quote: string, value: string) =>
      `${before}${quote}${mobileSafeOrient(value)}${quote}`,
  );
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

function mobileSafeOrient(value: string): string {
  const v = value.trim();
  if (v === 'auto' || NUMBER.test(v)) return v;
  const deg = /^(.+?)deg$/i.exec(v);
  if (deg && NUMBER.test(deg[1]!)) return deg[1]!;
  return 'auto';
}
