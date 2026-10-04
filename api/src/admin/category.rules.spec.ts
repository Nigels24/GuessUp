import { describe, expect, it } from 'vitest';
import { categories } from '../../prisma/seed-data/categories.js';
import { deleteBlockedMessage, isEmoji, normalizeColor, slugify } from './category.rules.js';

describe('slugify', () => {
  it('makes a lowercase, dash-separated slug', () => {
    expect(slugify('Operating Systems')).toBe('operating-systems');
    expect(slugify('  Data Communications & Networking!  ')).toBe('data-communications-networking');
    expect(slugify('Pagsusuri ng Sistema – Café')).toBe('pagsusuri-ng-sistema-cafe');
  });
  it('is empty when the name has no letters or digits', () => {
    expect(slugify('🙂 !!')).toBe('');
  });
  it('is at most 40 characters and never ends with a dash', () => {
    const slug = slugify('a'.repeat(39) + ' bcd');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('isEmoji', () => {
  it('accepts every seeded category icon', () => {
    for (const c of categories) expect(isEmoji(c.icon), c.icon).toBe(true);
  });
  it('accepts joined, skin-tone, keycap and flag emoji', () => {
    for (const e of ['👩‍💻', '👍🏽', '#️⃣', '🇵🇭', '📘']) expect(isEmoji(e), e).toBe(true);
  });
  it('refuses text, digits, several emoji and empty values', () => {
    for (const e of ['', 'A', 'ab', '1', '📘📘', '📘 x', '<b>']) expect(isEmoji(e), e).toBe(false);
  });
});

describe('normalizeColor', () => {
  it('stores uppercase hex like the seed', () => {
    expect(normalizeColor('#6c4cf1')).toBe('#6C4CF1');
  });
});

describe('deleteBlockedMessage', () => {
  it('is null when nothing uses the category', () => {
    expect(deleteBlockedMessage('Ethics', { questions: 0, sessions: 0 })).toBeNull();
  });
  it('explains questions, sessions or both', () => {
    expect(deleteBlockedMessage('Ethics', { questions: 1, sessions: 0 })).toMatch(/^Ethics still has 1 question\. Delete or move them first/);
    expect(deleteBlockedMessage('Ethics', { questions: 0, sessions: 2 })).toMatch(/^Ethics has 2 recorded game sessions\./);
    const both = deleteBlockedMessage('Ethics', { questions: 15, sessions: 1 })!;
    expect(both).toContain('15 questions');
    expect(both).toContain('It also has 1 recorded game session.');
  });
});
