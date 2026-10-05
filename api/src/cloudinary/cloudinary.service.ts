import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import {
  CLOUDINARY_FOLDERS,
  CLOUDINARY_INCOMING,
  isInFolder,
  type CloudinaryFolder,
} from '../common/cloudinary-folders.js';

export const CLOUDINARY_MESSAGES = {
  notConfigured:
    'Image upload is not set up on the server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the API environment, then restart it.',
  uploadFailed: 'The image could not be uploaded. Please try again.',
  unreadable: 'This image file appears to be damaged. Export or save it again, then upload it.',
} as const;

export interface UploadedImage {
  url: string;
  publicId: string;
}

export interface UploadOptions {
  /** The file name inside the folder (Cloudinary makes one up when omitted). */
  publicId?: string;
  /** SVG: stored as is, without the folder's resize. */
  vector?: boolean;
}

/**
 * Question images and profile photos on Cloudinary. Without the three CLOUDINARY_* variables the
 * API still starts; uploads then answer 503 with a clear message.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  readonly configured: boolean;

  constructor(config: ConfigService) {
    const cloud_name = config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const api_key = config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const api_secret = config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    this.configured = Boolean(cloud_name && api_key && api_secret);
    if (this.configured) cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  }

  assertConfigured(): void {
    if (!this.configured) throw new ServiceUnavailableException(CLOUDINARY_MESSAGES.notConfigured);
  }

  /**
   * Uploads into one of the GuessUp folders (never the account's root, which
   * another system shares), resized by the folder's CLOUDINARY_INCOMING. The
   * returned URL of a raster image asks for f_auto, so each device gets the
   * smallest format it can show.
   */
  async upload(buffer: Buffer, folder: CloudinaryFolder, options: UploadOptions = {}): Promise<UploadedImage> {
    this.assertConfigured();
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: CLOUDINARY_FOLDERS[folder],
            public_id: options.publicId,
            resource_type: 'image',
            overwrite: false,
            transformation: options.vector ? undefined : [CLOUDINARY_INCOMING[folder]],
          },
          (error, res) => (error || !res ? reject(error ?? new Error('No response')) : resolve(res)),
        );
        stream.end(buffer);
      });
      if (options.vector) return { url: result.secure_url, publicId: result.public_id };
      const url = cloudinary.url(result.public_id, {
        secure: true,
        version: result.version,
        transformation: [{ fetch_format: 'auto' }],
      });
      return { url, publicId: result.public_id };
    } catch (error) {
      this.logger.error(`Cloudinary upload failed: ${describe(error)}`);
      // 400 from Cloudinary: it could not read the file (the type check only looks at its first bytes).
      if (httpCode(error) === 400) throw new BadRequestException(CLOUDINARY_MESSAGES.unreadable);
      throw new ServiceUnavailableException(CLOUDINARY_MESSAGES.uploadFailed);
    }
  }

  /**
   * Removes an image that is no longer used. Best effort: a failure is logged,
   * never thrown, because the change it follows is already saved. Only ids
   * inside the given GuessUp folder are deleted; anything else is refused.
   */
  async destroy(publicId: string | null | undefined, folder: CloudinaryFolder): Promise<void> {
    if (!publicId || !this.configured) return;
    if (!isInFolder(publicId, folder)) {
      this.logger.warn(`Refused to delete ${publicId}: not inside ${CLOUDINARY_FOLDERS[folder]}/`);
      return;
    }
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    } catch (error) {
      this.logger.warn(`Could not delete Cloudinary image ${publicId}: ${describe(error)}`);
    }
  }
}

function httpCode(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'http_code' in error ? Number(error.http_code) : undefined;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}
