import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  AdminCertificatesService,
  type CertificateDetail,
  type CertificateRow,
} from './admin-certificates.service.js';
import { CertificateListQueryDto } from './dto/certificate.dto.js';

/** Admin Panel > Certificates: category completion certificates (read only). */
@Roles('ADMIN')
@Controller('admin/certificates')
export class AdminCertificatesController {
  constructor(private readonly certificates: AdminCertificatesService) {}

  /** GET /api/admin/certificates?categoryId= — every earned certificate, newest first. */
  @Get()
  list(@Query() query: CertificateListQueryDto): Promise<CertificateRow[]> {
    return this.certificates.list(query.categoryId);
  }

  /** GET /api/admin/certificates/:studentId/:categoryId — the printable certificate; 404 if not earned. */
  @Get(':studentId/:categoryId')
  get(@Param('studentId') studentId: string, @Param('categoryId') categoryId: string): Promise<CertificateDetail> {
    return this.certificates.get(studentId, categoryId);
  }
}
