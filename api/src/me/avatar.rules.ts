/**
 * Rules for a student's profile photo (POST /api/me/avatar). Pure, unit
 * tested. Like question images, the file's first bytes decide its type; SVG
 * is not accepted for photos.
 */
import { isInFolder } from '../common/cloudinary-folders.js';
import { MAX_IMAGE_BYTES, detectImageKind } from '../admin/image-file.js';

export const MAX_AVATAR_BYTES = MAX_IMAGE_BYTES;

export const AVATAR_MESSAGES = {
  missing: 'Choose a photo to upload.',
  tooLarge: 'The photo must be 2 MB or smaller.',
  badType: 'Only JPG, PNG and WebP photos can be used.',
  changed: 'Your photo was changed somewhere else at the same time. Please try again.',
} as const;

/** null when the file can be uploaded, else the message to show. */
export function avatarFileProblem(file: { buffer: Buffer; size: number } | undefined): string | null {
  if (!file || !file.size) return AVATAR_MESSAGES.missing;
  if (file.size > MAX_AVATAR_BYTES) return AVATAR_MESSAGES.tooLarge;
  const kind = detectImageKind(file.buffer);
  if (kind !== 'jpg' && kind !== 'png' && kind !== 'webp') return AVATAR_MESSAGES.badType;
  return null;
}

/**
 * The photo's name inside guessup/avatars: tied to the user and unique per
 * upload, so a new photo never overwrites the old one before it is saved
 * (and phones never show a cached old photo under the same URL).
 */
export function avatarFileName(userId: string, now: Date = new Date()): string {
  return `user-${userId}-${now.getTime()}`;
}

/** Is a stored public id one of this user's photos? Only those are deleted. */
export function isOwnAvatar(publicId: string, userId: string): boolean {
  return isInFolder(publicId, 'avatars') && publicId.startsWith(`guessup/avatars/user-${userId}-`);
}
