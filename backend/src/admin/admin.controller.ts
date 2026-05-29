import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
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

  @Patch('teachers/:id/credits')
  async updateCredits(
    @Param('id') id: string,
    @Body() body: { credit_balance: number },
  ) {
    return this.adminService.updateTeacherCredits(id, body.credit_balance);
  }
}
