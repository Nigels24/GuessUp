import { Module } from '@nestjs/common';
import { AdminCategoriesController } from './admin-categories.controller.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminQuestionsController } from './admin-questions.controller.js';
import { AdminQuestionsService } from './admin-questions.service.js';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminReportsService } from './admin-reports.service.js';
import { AdminSessionsController } from './admin-sessions.controller.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { AdminStudentsController } from './admin-students.controller.js';
import { AdminStudentsService } from './admin-students.service.js';
import { AdminUploadsController } from './admin-uploads.controller.js';
import { CloudinaryService } from './cloudinary.service.js';

/**
 * The administrator web panel's API, under /api/admin/... Every controller is
 * @Roles('ADMIN'); the global JwtAuthGuard and RolesGuard enforce it.
 */
@Module({
  controllers: [
    AdminCategoriesController,
    AdminQuestionsController,
    AdminUploadsController,
    AdminStudentsController,
    AdminSessionsController,
    AdminReportsController,
  ],
  providers: [
    AdminCategoriesService,
    AdminQuestionsService,
    AdminStudentsService,
    AdminSessionsService,
    AdminReportsService,
    AdminDashboardService,
    CloudinaryService,
  ],
})
export class AdminModule {}
