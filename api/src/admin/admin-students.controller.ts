import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  AdminStudentsService,
  type StudentDetail,
  type StudentRow,
} from './admin-students.service.js';
import type { Page } from './dto/query.dto.js';
import { SetStudentStatusDto, StudentListQueryDto } from './dto/student.dto.js';

/** Admin Panel > Students. Student accounts only; administrators are never listed. */
@Roles('ADMIN')
@Controller('admin/students')
export class AdminStudentsController {
  constructor(private readonly students: AdminStudentsService) {}

  /** GET /api/admin/students?search=&yearLevel=&status=&page=&pageSize= */
  @Get()
  list(@Query() query: StudentListQueryDto): Promise<Page<StudentRow>> {
    return this.students.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<StudentDetail> {
    return this.students.get(id);
  }

  /** PATCH /api/admin/students/:id/status { status: 'ACTIVE' | 'INACTIVE' } — 404 for an administrator. */
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStudentStatusDto): Promise<StudentRow> {
    return this.students.setStatus(id, dto.status);
  }
}
