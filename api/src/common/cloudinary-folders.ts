/**
 * Where GuessUp stores files on Cloudinary. The Cloudinary account is shared
 * with another system, so every GuessUp upload goes under CLOUDINARY_ROOT.
 * Add a folder here and pass its key to CloudinaryService.upload; nothing
 * else needs to know the path.
 */
export const CLOUDINARY_ROOT = 'guessup';

export const CLOUDINARY_FOLDERS = {
  questions: `${CLOUDINARY_ROOT}/questions`,
  avatars: `${CLOUDINARY_ROOT}/avatars`,
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;

/**
 * The incoming transformation applied to raster uploads in each folder, so
 * Cloudinary stores the resized file and never the phone camera's original.
 * Format is chosen at delivery (f_auto in the saved URL): Cloudinary does not
 * allow f_auto in an incoming transformation. Vector (SVG) question pictures
 * are stored as they are.
 */
export const CLOUDINARY_INCOMING: Record<CloudinaryFolder, Record<string, string | number>> = {
  // At most 1280 px on the longest side; smaller pictures are not enlarged.
  questions: { width: 1280, height: 1280, crop: 'limit', quality: 'auto' },
  // A 512×512 square, cropped around the face or the most important area.
  avatars: { width: 512, height: 512, crop: 'fill', gravity: 'auto', quality: 'auto' },
};

/**
 * Is `publicId` an asset inside the given GuessUp folder? (In Cloudinary's
 * fixed folder mode the folder is the public id's prefix.) Checked before
 * accepting or deleting a public id, so question code never deletes a
 * profile photo, photo code never deletes a question picture, and ids of the
 * other system's assets are never touched.
 */
export function isInFolder(publicId: string, folder: CloudinaryFolder): boolean {
  return publicId.startsWith(`${CLOUDINARY_FOLDERS[folder]}/`) && /^[\w/-]+$/.test(publicId) && !publicId.includes('..');
}
