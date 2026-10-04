/**
 * Where GuessUp stores files on Cloudinary. The Cloudinary account is shared
 * with another system, so every GuessUp upload goes under CLOUDINARY_ROOT.
 * Add a folder here (e.g. avatars: `${CLOUDINARY_ROOT}/avatars`) and pass its
 * key to CloudinaryService.upload; nothing else needs to know the path.
 */
export const CLOUDINARY_ROOT = 'guessup';

export const CLOUDINARY_FOLDERS = {
  questions: `${CLOUDINARY_ROOT}/questions`,
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;

/**
 * Is `publicId` an asset inside the given GuessUp folder? (In Cloudinary's
 * fixed folder mode the folder is the public id's prefix.) Used before
 * accepting or deleting a public id sent by a client, so ids of the other
 * system's assets are never touched.
 */
export function isInFolder(publicId: string, folder: CloudinaryFolder): boolean {
  return publicId.startsWith(`${CLOUDINARY_FOLDERS[folder]}/`) && /^[\w/-]+$/.test(publicId) && !publicId.includes('..');
}
