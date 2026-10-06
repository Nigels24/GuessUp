// Unit tests for svg.ts, run by Node's own test runner (npm test); Node
// 22.18+ strips the TypeScript types itself.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mobileSafeSvg } from './svg.ts';

const marker = (orient) =>
  `<svg><defs><marker id="ar" viewBox="0 0 10 10" orient=${orient}><path d="M0 0L10 5z"/></marker></defs></svg>`;

test('rewrites marker orient values that crash react-native-svg on Android', () => {
  assert.equal(mobileSafeSvg(marker('"auto-start-reverse"')), marker('"auto"'));
  assert.equal(mobileSafeSvg(marker("'auto-start-reverse'")), marker("'auto'"));
  assert.equal(mobileSafeSvg(marker('"45deg"')), marker('"45"'));
  assert.equal(mobileSafeSvg(marker('"1rad"')), marker('"auto"'));
});

test('keeps values react-native-svg can read, and text that only looks like orient', () => {
  for (const ok of ['"auto"', '"0"', '"-90"', '"12.5"']) assert.equal(mobileSafeSvg(marker(ok)), marker(ok));
  const text = '<svg><text>orient="auto-start-reverse"</text></svg>';
  assert.equal(mobileSafeSvg(text), text);
});

test('leaves no unreadable orient in any seeded picture', () => {
  // The arrows of the Programming, DSA and Security pictures closed the app on Android.
  const dir = new URL('../../../api/public/images/', import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
    const safe = mobileSafeSvg(readFileSync(new URL(name, dir), 'utf8'));
    for (const [, value] of safe.matchAll(/<marker\b[^>]*?\sorient\s*=\s*["']([^"']*)["']/gi)) {
      assert.ok(value === 'auto' || !Number.isNaN(Number(value)), `${name}: orient="${value}"`);
    }
  }
});
