import { Controller, Get, Param, Query } from '@nestjs/common';
import { TeacherDashboardService } from './teacher-dashboard.service';

@Controller('teacher-dashboard')
export class TeacherDashboardController {
  constructor(private readonly service: TeacherDashboardService) {}

  @Get(':teacherId')
  async getDashboard(@Param('teacherId') teacherId: string) {
    return this.service.getDashboard(teacherId);
  }
}
