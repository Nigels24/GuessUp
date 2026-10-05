/**
 * The administrator's profile photo, prepared in the browser before upload:
 * JPG, PNG or WebP originals up to 15 MB (a phone photo is often 3–5 MB) are
 * cropped to a center square and resized to a 512×512 JPEG. Only that result
 * has to fit the API's 2 MB limit (POST /api/me/avatar), which it does by far.
 */

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Largest original accepted; it is resized before upload. */
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
/** The API's limit (MAX_AVATAR_BYTES), checked on the resized JPEG. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** The size the API stores (CLOUDINARY_INCOMING.avatars). */
const PHOTO_SIZE = 512;
/** JPEG qualities tried in turn until the result fits MAX_UPLOAD_BYTES. */
const JPEG_QUALITIES = [0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

/** null when the file can be used, else the message to show. */
export function photoProblem(file: File): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "Choose a JPG, PNG or WebP image.";
  if (file.size > MAX_ORIGINAL_BYTES) return "Photo is too large (max 15 MB).";
  return null;
}

/** The largest centered square of a width × height image. */
export function centerSquare(width: number, height: number): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
}

/**
 * A 512×512 JPEG of the photo's center, under the API's 2 MB limit. Rejects
 * with a readable message when the image cannot be read or will not fit.
 */
export async function squarePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("This image could not be read. Export or save it again, then try again.");
    });
    const { x, y, size } = centerSquare(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare the photo.");
    // JPEG has no transparency: transparent PNG areas become white instead of black.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, x, y, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    for (const quality of JPEG_QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("Your browser could not prepare the photo.");
      if (blob.size <= MAX_UPLOAD_BYTES) return blob;
    }
    throw new Error("This photo could not be made small enough to upload. Try a different image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
