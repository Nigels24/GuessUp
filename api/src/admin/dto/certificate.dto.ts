import { IsOptional, IsString, MaxLength } from 'class-validator';

/** GET /api/admin/certificates */
export class CertificateListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;
}
