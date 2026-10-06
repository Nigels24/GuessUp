import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_MESSAGES,
  MAX_IMAGE_BYTES,
  checkImageFile,
  detectImageKind,
  mobileSafeSvg,
} from './image-file.js';

const file = (buffer: Buffer) => ({ buffer, size: buffer.length });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const svg = (s: string) => Buffer.from(s, 'utf8');

describe('detectImageKind', () => {
  it('recognizes JPG, PNG, WebP and SVG by content', () => {
    expect(detectImageKind(JPG)).toBe('jpg');
    expect(detectImageKind(PNG)).toBe('png');
    expect(detectImageKind(WEBP)).toBe('webp');
    expect(detectImageKind(svg('<?xml version="1.0"?>\n<!-- x -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
  });
  it('refuses other files, whatever their name', () => {
    expect(detectImageKind(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageKind(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(detectImageKind(svg('<html><svg></svg></html>'))).toBeNull();
  });
});

describe('checkImageFile', () => {
  it('needs a file', () => {
    expect(checkImageFile(undefined)).toEqual({ error: IMAGE_MESSAGES.missing });
    expect(checkImageFile(file(Buffer.alloc(0)))).toEqual({ error: IMAGE_MESSAGES.missing });
  });
  it('is at most 2 MB', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(checkImageFile(file(big))).toEqual({ error: IMAGE_MESSAGES.tooLarge });
    expect(checkImageFile(file(PNG))).toEqual({ kind: 'png' });
  });
  it('refuses SVG with scripts, event handlers or external links', () => {
    for (const bad of [
      '<svg><script>alert(1)</script></svg>',
      '<svg><rect onload="alert(1)"/></svg>',
      '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><image href="https://evil.example/x.png"/></svg>',
      '<svg><foreignObject><div/></foreignObject></svg>',
    ]) {
      expect(checkImageFile(file(svg(bad))), bad).toEqual({ error: IMAGE_MESSAGES.unsafeSvg });
    }
  });
  it('accepts every seeded picture (they are plain SVG)', () => {
    const dir = join(process.cwd(), 'public', 'images');
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
      expect(checkImageFile(file(readFileSync(join(dir, name)))), name).toEqual({ kind: 'svg' });
    }
  });
});

describe('mobileSafeSvg', () => {
  const marker = (orient: string) =>
    `<svg><defs><marker id="ar" viewBox="0 0 10 10" orient=${orient}><path d="M0 0L10 5z"/></marker></defs></svg>`;

  it('rewrites marker orient values that crash react-native-svg on Android', () => {
    expect(mobileSafeSvg(marker('"auto-start-reverse"'))).toBe(marker('"auto"'));
    expect(mobileSafeSvg(marker("'auto-start-reverse'"))).toBe(marker("'auto'"));
    expect(mobileSafeSvg(marker('"45deg"'))).toBe(marker('"45"'));
    expect(mobileSafeSvg(marker('"1rad"'))).toBe(marker('"auto"'));
    expect(mobileSafeSvg(marker('""'))).toBe(marker('"auto"'));
  });
  it('keeps values it can already draw, and orient outside a marker', () => {
    for (const ok of ['"auto"', '"0"', '"-90"', '"12.5"']) expect(mobileSafeSvg(marker(ok))).toBe(marker(ok));
    const text = '<svg><text>orient="auto-start-reverse"</text></svg>';
    expect(mobileSafeSvg(text)).toBe(text);
  });
  it('every seeded picture is already drawable by the app', () => {
    // dsa/prog/ias rounds closed the app on Android while their arrows had orient="auto-start-reverse".
    const dir = join(process.cwd(), 'public', 'images');
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
      const content = readFileSync(join(dir, name), 'utf8');
      expect(mobileSafeSvg(content), name).toBe(content);
    }
  });
});
