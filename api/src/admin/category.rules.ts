/**
 * Rules for subject categories saved from the Admin Panel. Pure, unit tested.
 */

export const CATEGORY_LIMITS = { name: 60, slug: 40, description: 300, icon: 16 } as const;

export const CATEGORY_MESSAGES = {
  notFound: 'Category not found.',
  nameTaken: 'A category with that name already exists.',
  slugTaken: 'A category with that short name (slug) already exists.',
  slugInvalid: 'The slug may only contain lowercase letters, digits and dashes.',
  slugFromName: 'Enter a name with at least one letter or digit.',
  iconInvalid: 'The icon must be a single emoji, e.g. 📘.',
  colorInvalid: 'The color must be a hex color such as #6C4CF1.',
} as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** "Operating Systems" -> "operating-systems" (the prototype's id rule, longer limit). */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CATEGORY_LIMITS.slug)
    .replace(/-+$/, '');
}

/**
 * One emoji: pictographs with their joiners, variation selectors and skin
 * tones (zero-width joiner sequences, the 🗄 + U+FE0F of the seed), keycaps or a
 * flag. Letters, digits alone and text are refused.
 */
export function isEmoji(value: string): boolean {
  if (!value || value.length > CATEGORY_LIMITS.icon) return false;
  const emojiChars = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200D|\uFE0F|\u20E3|[#*0-9])+$/u;
  if (!emojiChars.test(value)) return false;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value)) return false;
  return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)].length === 1;
}

/** Stored colors are uppercase, like the seeded ones. */
export function normalizeColor(color: string): string {
  return color.trim().toUpperCase();
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Why a category cannot be deleted, or null when it can. Questions and
 * recorded rounds point to it, and reports must stay accurate.
 */
export function deleteBlockedMessage(
  name: string,
  used: { questions: number; sessions: number },
): string | null {
  const parts: string[] = [];
  if (used.questions) {
    parts.push(
      `${name} still has ${plural(used.questions, 'question')}. Delete or move them first. The database keeps referential integrity, so a question cannot point to a missing category.`,
    );
  }
  if (used.sessions) {
    parts.push(
      `${used.questions ? 'It also has' : `${name} has`} ${plural(used.sessions, 'recorded game session')}. Categories with game history are kept so reports and leaderboards stay accurate.`,
    );
  }
  return parts.length ? parts.join(' ') : null;
}
