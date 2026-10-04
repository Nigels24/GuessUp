/**
 * Checks an uploaded question image before it is sent to Cloudinary. Pure,
 * unit tested. The file's first bytes decide its type, not its name or the
 * browser's MIME type, which the client controls.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageKind = 'jpg' | 'png' | 'webp' | 'svg';

export const IMAGE_MESSAGES = {
  missing: 'Choose an image to upload.',
  tooLarge: 'The image must be 2 MB or smaller.',
  badType: 'Only JPG, PNG, WebP and SVG images can be uploaded.',
  unsafeSvg: 'This SVG contains scripts or links and cannot be used. Export it again as a plain SVG or PNG.',
} as const;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

export function detectImageKind(buf: Buffer): ImageKind | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  // SVG: text whose first element (after an XML declaration, doctype or comments) is <svg.
  const head = buf.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '');
  const body = head.replace(/^\s*(?:<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->|\s)*/i, '');
  if (/^<svg[\s>]/i.test(body)) return 'svg';
  return null;
}

/**
 * Scripts, event handlers, external links and embedded HTML are refused in SVG
 * files. Attributes are only looked for inside tags, so code shown as text
 * (e.g. "&lt;a href=...&gt;" in a seeded picture) is fine.
 */
export function isUnsafeSvg(buf: Buffer): boolean {
  const svg = buf.toString('utf8');
  if (/<(?:script|foreignObject|iframe|embed|object)\b/i.test(svg)) return true;
  if (/<[^>]*\son\w+\s*=/i.test(svg)) return true;
  if (/<[^>]*=\s*["']\s*javascript:/i.test(svg)) return true;
  // Links may only point inside the file (#id) or embed a raster image.
  return /<[^>]*\s(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpe?g|webp);)/i.test(svg);
}

/** The image's kind, or the message to show when it cannot be uploaded. */
export function checkImageFile(
  file: { buffer: Buffer; size: number } | undefined,
): { kind: ImageKind } | { error: string } {
  if (!file || !file.size) return { error: IMAGE_MESSAGES.missing };
  if (file.size > MAX_IMAGE_BYTES) return { error: IMAGE_MESSAGES.tooLarge };
  const kind = detectImageKind(file.buffer);
  if (!kind) return { error: IMAGE_MESSAGES.badType };
  if (kind === 'svg' && isUnsafeSvg(file.buffer)) return { error: IMAGE_MESSAGES.unsafeSvg };
  return { kind };
}
