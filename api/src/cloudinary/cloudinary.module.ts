import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';

/**
 * The one Cloudinary setup, shared by the Admin Panel (question images) and
 * /me (profile photos). Import this module; do not provide CloudinaryService
 * again elsewhere.
 */
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
