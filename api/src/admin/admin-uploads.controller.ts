import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { IsString, MaxLength } from 'class-validator';
import { Roles } from '../auth/roles.decorator.js';
import { AdminQuestionsService } from './admin-questions.service.js';
import { CloudinaryService, type UploadedImage } from '../cloudinary/cloudinary.service.js';
import { MAX_IMAGE_BYTES, checkImageFile, mobileSafeSvg } from './image-file.js';
import { QUESTION_MESSAGES, isAllowedPublicId } from './question.rules.js';

/** The part of multer's file object this route uses (kept in memory, never on disk). */
interface UploadedImageFile {
  buffer: Buffer;
  size: number;
}

class DiscardImageQueryDto {
  @IsString()
  @MaxLength(200)
  publicId: string;
}

/** Question images for picture items, stored on Cloudinary. */
@Roles('ADMIN')
@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly questions: AdminQuestionsService,
  ) {}

  /**
   * GET /api/admin/uploads/library — the seeded pictures in public/images, for
   * the form's "…or pick from picture library" (as in the prototype).
   */
  @Get('library')
  async library(): Promise<{ name: string; url: string }[]> {
    const files = await readdir(join(process.cwd(), 'public', 'images')).catch(() => []);
    return files
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => ({ name: f.replace(/\.svg$/, ''), url: `/static/images/${f}` }));
  }

  /**
   * POST /api/admin/uploads/image (multipart, field "file") -> { url, publicId }.
   * JPG, PNG, WebP or SVG up to 2 MB, recognized by content. 503 when
   * Cloudinary is not configured on the server.
   */
  @Post('image')
  @UseInterceptors(
    // Multer's own cap is looser so a slightly larger file gets the friendly 2 MB message.
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES * 2, files: 1 } }),
  )
  async upload(@UploadedFile() file?: UploadedImageFile): Promise<UploadedImage> {
    this.cloudinary.assertConfigured();
    const checked = checkImageFile(file);
    if ('error' in checked) throw new BadRequestException(checked.error);
    if (checked.kind !== 'svg') return this.cloudinary.upload(file!.buffer, 'questions');
    // Stored as is, so first make it drawable by the app (see mobileSafeSvg).
    const safe = Buffer.from(mobileSafeSvg(file!.buffer.toString('utf8')), 'utf8');
    return this.cloudinary.upload(safe, 'questions', { vector: true });
  }

  /**
   * DELETE /api/admin/uploads/image?publicId= — discards an upload the form
   * did not save (replaced, removed or cancelled). 409 while a question uses it.
   */
  @Delete('image')
  @HttpCode(HttpStatus.NO_CONTENT)
  async discard(@Query() query: DiscardImageQueryDto): Promise<void> {
    if (!isAllowedPublicId(query.publicId)) {
      throw new BadRequestException(QUESTION_MESSAGES.badImagePublicId);
    }
    if (await this.questions.imageInUse(query.publicId)) {
      throw new ConflictException('A question still uses this image.');
    }
    this.cloudinary.assertConfigured();
    await this.cloudinary.destroy(query.publicId, 'questions');
  }
}
