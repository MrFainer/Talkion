import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('teachers')
  async listTeachers(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.listTeachers(from, to);
  }

  @Patch('teachers/:id/toggle')
  async toggleTeacherStatus(@Param('id') id: string) {
    return this.adminService.toggleTeacherStatus(id);
  }
}
