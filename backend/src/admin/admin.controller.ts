import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('teachers')
  async listTeachers(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.listTeachers(from, to);
  }

  @Patch('teachers/:id/toggle')
  async toggleTeacherStatus(@Param('id') id: string) {
    return this.adminService.toggleTeacherStatus(id);
  }

  @Patch('teachers/:id/plan')
  async updateTeacherPlan(
    @Param('id') id: string,
    @Body() body: { planId: string },
  ) {
    if (!body.planId) throw new BadRequestException('planId é obrigatório');
    return this.adminService.updateTeacherPlan(id, body.planId);
  }

  @Patch('teachers/:id/credits')
  async updateCredits(
    @Param('id') id: string,
    @Body()
    body: { amount: number; mode?: 'set' | 'add'; description?: string },
  ) {
    if (body.amount == null || body.amount < 0) {
      throw new BadRequestException('amount é obrigatório e deve ser >= 0');
    }
    return this.adminService.updateTeacherCredits(
      id,
      body.amount,
      body.mode || 'set',
      body.description,
    );
  }
}
