import { Module } from '@nestjs/common';
import { TeacherDashboardService } from './teacher-dashboard.service';
import { TeacherDashboardController } from './teacher-dashboard.controller';

@Module({
  providers: [TeacherDashboardService],
  controllers: [TeacherDashboardController],
  exports: [TeacherDashboardService],
})
export class TeacherDashboardModule {}
